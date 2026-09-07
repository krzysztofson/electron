import { computed, onMounted, onUnmounted, reactive, ref, type Ref } from "vue";
import { renderMarkdown } from "./useMarkdown";
import type { AnalysisChunk } from "@/ipc-types";

/** Full-size base64 PNGs, so this is a real memory ceiling, not politeness. */
const MAX_SCREENSHOTS = 12;

/**
 * How often a streaming answer's sanitized HTML is recomputed while text is
 * still arriving. `renderMarkdown` runs a full `marked.parse` +
 * `DOMPurify.sanitize` pass, which is too expensive to redo on every token;
 * raw text is appended immediately, and only the rendered HTML is throttled.
 */
const RENDER_THROTTLE_MS = 60;

export interface AnalysisTurn {
  role: "user" | "assistant";
  /** Raw text. On an assistant turn, this grows on every streamed delta. */
  text: string;
  /** Sanitized HTML. Empty for a user turn -- those render as plain text. */
  html: string;
}

export interface Screenshot {
  id: number;
  dataUrl: string;
  capturedAt: Date;
  /** Checked via the card's checkbox; feeds "analyze together". */
  selected: boolean;
  thread: AnalysisTurn[];
  /** Needed to thread a follow-up through `previous_response_id`. */
  lastResponseId?: string;
  isAnalyzing: boolean;
  error?: string;
}

/**
 * Several screenshots analyzed as one question. Kept separate from
 * `Screenshot` rather than trying to attach a multi-image answer to one of
 * its constituent screenshots, which doesn't have an honest owner among them.
 */
export interface AnalysisGroup {
  id: string;
  screenshotIds: number[];
  thumbnails: string[];
  thread: AnalysisTurn[];
  lastResponseId?: string;
  isAnalyzing: boolean;
  error?: string;
}

function toMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return String(error);
}

function nextId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Owns screenshots, single- and multi-image analysis, and follow-ups.
 *
 * `presetId` is a ref rather than a plain argument because every entry point
 * here (F5, the Analyze button, a follow-up typed minutes later) needs
 * whatever preset is selected *at that moment*, not whatever it was when this
 * composable was created.
 *
 * Every mutable `Screenshot` / `AnalysisGroup` / `AnalysisTurn` is created via
 * `reactive()` up front, and that same object is what gets pushed into the
 * arrays below and held onto in `liveTurns`. This matters more than it looks:
 * pushing a *plain* object into a `ref` array makes Vue substitute its own
 * reactive proxy for the copy the template reads, wrapping the original
 * lazily on first access. Code that then keeps mutating the original
 * pre-insertion object (exactly what streaming deltas need to do, since they
 * arrive after the object has already been inserted) writes to a target the
 * active proxy shares data with but never notifies -- the value changes, nothing
 * re-renders. `reactive()` up front sidesteps this: Vue never double-wraps an
 * object that is already reactive, so there is only ever one proxy in play.
 */
export function useScreenshots(presetId: Ref<string>) {
  const screenshots = ref<Screenshot[]>([]);
  const groups = ref<AnalysisGroup[]>([]);
  const isCapturing = ref(false);
  const captureError = ref<string | null>(null);

  const total = computed(() => screenshots.value.length);
  const selectedCount = computed(
    () => screenshots.value.filter((shot) => shot.selected).length,
  );
  const isAnalyzing = computed(
    () =>
      screenshots.value.some((shot) => shot.isAnalyzing) ||
      groups.value.some((group) => group.isAnalyzing),
  );

  /**
   * Chunks arrive tagged with an `analysisId` the renderer minted before the
   * request even went out, so a single subscription (set up once, below) can
   * route each delta to whichever turn -- on a screenshot or a group -- is
   * waiting for it, without every card needing its own listener.
   */
  const liveTurns = new Map<
    string,
    { turn: AnalysisTurn; renderTimer: ReturnType<typeof setTimeout> | null }
  >();

  function beginStreaming(analysisId: string, turn: AnalysisTurn): void {
    liveTurns.set(analysisId, { turn, renderTimer: null });
  }

  function endStreaming(analysisId: string): void {
    const entry = liveTurns.get(analysisId);
    if (entry?.renderTimer) clearTimeout(entry.renderTimer);
    liveTurns.delete(analysisId);
  }

  function handleChunk({ analysisId, delta }: AnalysisChunk): void {
    const entry = liveTurns.get(analysisId);
    if (!entry) return;

    entry.turn.text += delta;
    if (entry.renderTimer) return;

    entry.renderTimer = setTimeout(() => {
      entry.renderTimer = null;
      entry.turn.html = renderMarkdown(entry.turn.text);
    }, RENDER_THROTTLE_MS);
  }

  /** Streamed text wins; the invoke()'s returned text is only a fallback for
   *  the rare case where no delta events arrived at all. */
  function finalizeTurn(turn: AnalysisTurn, fallbackText: string): void {
    if (!turn.text.trim()) turn.text = fallbackText;
    turn.html = renderMarkdown(turn.text);
  }

  function findScreenshot(id: number): Screenshot | undefined {
    return screenshots.value.find((shot) => shot.id === id);
  }

  function findGroup(id: string): AnalysisGroup | undefined {
    return groups.value.find((group) => group.id === id);
  }

  async function capture(): Promise<Screenshot | null> {
    isCapturing.value = true;
    captureError.value = null;

    try {
      const result = await window.electronAPI.captureScreen();
      const shot = reactive<Screenshot>({
        id: Date.now(),
        dataUrl: result.dataUrl,
        capturedAt: new Date(result.capturedAt),
        selected: false,
        thread: [],
        isAnalyzing: false,
      });

      screenshots.value.push(shot);
      if (screenshots.value.length > MAX_SCREENSHOTS) {
        screenshots.value.splice(0, screenshots.value.length - MAX_SCREENSHOTS);
      }
      return shot;
    } catch (error) {
      captureError.value = toMessage(error);
      return null;
    } finally {
      isCapturing.value = false;
    }
  }

  async function analyze(id: number): Promise<void> {
    const shot = findScreenshot(id);
    if (!shot || shot.isAnalyzing) return;

    const analysisId = nextId();
    const turn = reactive<AnalysisTurn>({
      role: "assistant",
      text: "",
      html: "",
    });
    shot.isAnalyzing = true;
    shot.error = undefined;
    shot.thread.push(turn);
    beginStreaming(analysisId, turn);

    try {
      const result = await window.electronAPI.analyzeScreenshot({
        analysisId,
        dataUrls: [shot.dataUrl],
        presetId: presetId.value,
      });
      finalizeTurn(turn, result.text);
      shot.lastResponseId = result.responseId;
    } catch (error) {
      // This function throws in main on failure -- see screenshot-analysis.ts
      // -- so a bad model id or API error lands here, not as rendered text.
      shot.thread.pop();
      shot.error = toMessage(error);
    } finally {
      endStreaming(analysisId);
      shot.isAnalyzing = false;
    }
  }

  async function askFollowUp(id: number, question: string): Promise<void> {
    const shot = findScreenshot(id);
    if (!shot || shot.isAnalyzing || !shot.lastResponseId) return;

    const analysisId = nextId();
    shot.isAnalyzing = true;
    shot.error = undefined;
    shot.thread.push(
      reactive<AnalysisTurn>({ role: "user", text: question, html: "" }),
    );
    const turn = reactive<AnalysisTurn>({
      role: "assistant",
      text: "",
      html: "",
    });
    shot.thread.push(turn);
    beginStreaming(analysisId, turn);

    try {
      const result = await window.electronAPI.askFollowUp({
        analysisId,
        previousResponseId: shot.lastResponseId,
        question,
        presetId: presetId.value,
      });
      finalizeTurn(turn, result.text);
      shot.lastResponseId = result.responseId;
    } catch (error) {
      shot.thread.pop(); // the empty assistant placeholder
      shot.error = toMessage(error);
    } finally {
      endStreaming(analysisId);
      shot.isAnalyzing = false;
    }
  }

  /** The selected screenshots, analyzed as one question. */
  async function analyzeSelected(): Promise<void> {
    const selected = screenshots.value.filter((shot) => shot.selected);
    if (selected.length === 0) return;

    const group = reactive<AnalysisGroup>({
      id: nextId(),
      screenshotIds: selected.map((shot) => shot.id),
      thumbnails: selected.map((shot) => shot.dataUrl),
      thread: [],
      isAnalyzing: true,
    });
    groups.value.unshift(group);
    selected.forEach((shot) => (shot.selected = false));

    const analysisId = nextId();
    const turn = reactive<AnalysisTurn>({
      role: "assistant",
      text: "",
      html: "",
    });
    group.thread.push(turn);
    beginStreaming(analysisId, turn);

    try {
      const result = await window.electronAPI.analyzeScreenshot({
        analysisId,
        dataUrls: selected.map((shot) => shot.dataUrl),
        presetId: presetId.value,
      });
      finalizeTurn(turn, result.text);
      group.lastResponseId = result.responseId;
    } catch (error) {
      group.thread.pop();
      group.error = toMessage(error);
    } finally {
      endStreaming(analysisId);
      group.isAnalyzing = false;
    }
  }

  async function askGroupFollowUp(id: string, question: string): Promise<void> {
    const group = findGroup(id);
    if (!group || group.isAnalyzing || !group.lastResponseId) return;

    const analysisId = nextId();
    group.isAnalyzing = true;
    group.error = undefined;
    group.thread.push(
      reactive<AnalysisTurn>({ role: "user", text: question, html: "" }),
    );
    const turn = reactive<AnalysisTurn>({
      role: "assistant",
      text: "",
      html: "",
    });
    group.thread.push(turn);
    beginStreaming(analysisId, turn);

    try {
      const result = await window.electronAPI.askFollowUp({
        analysisId,
        previousResponseId: group.lastResponseId,
        question,
        presetId: presetId.value,
      });
      finalizeTurn(turn, result.text);
      group.lastResponseId = result.responseId;
    } catch (error) {
      group.thread.pop();
      group.error = toMessage(error);
    } finally {
      endStreaming(analysisId);
      group.isAnalyzing = false;
    }
  }

  function toggleSelected(id: number): void {
    const shot = findScreenshot(id);
    if (shot) shot.selected = !shot.selected;
  }

  function remove(id: number): void {
    screenshots.value = screenshots.value.filter((shot) => shot.id !== id);
  }

  function removeGroup(id: string): void {
    groups.value = groups.value.filter((group) => group.id !== id);
  }

  function clear(): void {
    screenshots.value = [];
    groups.value = [];
    captureError.value = null;
  }

  /** Capture and immediately analyze -- the F5 flow. */
  async function captureAndAnalyze(): Promise<void> {
    clear();
    const shot = await capture();
    if (shot) await analyze(shot.id);
  }

  let unsubscribeHotkey: (() => void) | null = null;
  let unsubscribeChunks: (() => void) | null = null;

  onMounted(() => {
    unsubscribeHotkey = window.electronAPI.onAnalyzeHotkey(() => {
      void captureAndAnalyze();
    });
    unsubscribeChunks = window.electronAPI.onAnalysisChunk(handleChunk);
  });

  onUnmounted(() => {
    unsubscribeHotkey?.();
    unsubscribeChunks?.();
    liveTurns.forEach((entry) => {
      if (entry.renderTimer) clearTimeout(entry.renderTimer);
    });
  });

  return {
    screenshots,
    groups,
    isCapturing,
    isAnalyzing,
    captureError,
    total,
    selectedCount,
    capture,
    analyze,
    askFollowUp,
    analyzeSelected,
    askGroupFollowUp,
    toggleSelected,
    remove,
    removeGroup,
    clear,
    captureAndAnalyze,
  };
}
