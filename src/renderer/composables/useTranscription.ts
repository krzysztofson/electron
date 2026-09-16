import {
  computed,
  onMounted,
  onUnmounted,
  reactive,
  ref,
  watch,
  type Ref,
} from "vue";
import { renderMarkdown } from "./useMarkdown";
import type {
  AnalysisChunk,
  AudioSourceKind,
  TranscriptAnswerProvider,
  TranscriptionState,
  TranscriptionStatus,
} from "@/ipc-types";
import { useAudioCapture } from "./useAudioCapture";

/** A long meeting would otherwise grow this array without bound. */
const MAX_HISTORY = 500;

const ANSWER_PROVIDER_STORAGE_KEY =
  "screen-analyzer:transcript-answer-provider";

function readStoredAnswerProvider(): TranscriptAnswerProvider {
  return localStorage.getItem(ANSWER_PROVIDER_STORAGE_KEY) === "gemini"
    ? "gemini"
    : "openai";
}

/**
 * How often a streaming answer's sanitized HTML is recomputed while text is
 * still arriving -- same reasoning as `useScreenshots.ts`'s identical
 * constant: `renderMarkdown` is too expensive to run on every token.
 */
const RENDER_THROTTLE_MS = 60;

export interface TranscriptEntry {
  id: number;
  text: string;
  at: string;
  /** Raw answer text, accumulated as deltas arrive. */
  answer?: string;
  /** Sanitized HTML for `answer`, recomputed on a throttle while streaming. */
  answerHtml?: string;
  isAnswering: boolean;
  answerError?: string;
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
 * Live transcription: owns the audio capture lifecycle, the transcript state
 * arriving from the main process, and per-line answers.
 *
 * `presetId` is a ref for the same reason `useScreenshots` takes one: an
 * answer needs whatever preset is selected at the moment the button is
 * clicked (or the line arrives, for auto-reply), not whatever it was when
 * this composable was created.
 */
export function useTranscription(presetId: Ref<string>) {
  const audio = useAudioCapture();

  const state = ref<TranscriptionState>("idle");
  const error = ref<string | null>(null);
  const audioSource = ref<AudioSourceKind | null>(null);
  /** The in-progress phrase, replaced as the model refines it. */
  const interim = ref("");
  const history = ref<TranscriptEntry[]>([]);
  /** When on, every finalized line is answered automatically. */
  const autoReply = ref(false);
  /** Which model answers a transcript line, persisted across restarts. */
  const answerProvider = ref<TranscriptAnswerProvider>(
    readStoredAnswerProvider(),
  );
  watch(answerProvider, (value) => {
    localStorage.setItem(ANSWER_PROVIDER_STORAGE_KEY, value);
  });

  const isRunning = computed(
    () => state.value !== "idle" && state.value !== "error",
  );
  const isBusy = computed(
    () => state.value === "starting" || state.value === "reconnecting",
  );

  /**
   * Chunks arrive tagged with an `analysisId` minted before the request goes
   * out, so one subscription can route each delta to whichever entry is
   * waiting for it -- same pattern as `useScreenshots.ts`'s `liveTurns`.
   */
  const liveAnswers = new Map<
    string,
    {
      entry: TranscriptEntry;
      renderTimer: ReturnType<typeof setTimeout> | null;
    }
  >();

  function findEntry(id: number): TranscriptEntry | undefined {
    return history.value.find((entry) => entry.id === id);
  }

  function handleAnalysisChunk({ analysisId, delta }: AnalysisChunk): void {
    const live = liveAnswers.get(analysisId);
    if (!live) return;

    live.entry.answer = (live.entry.answer ?? "") + delta;
    if (live.renderTimer) return;

    live.renderTimer = setTimeout(() => {
      live.renderTimer = null;
      live.entry.answerHtml = renderMarkdown(live.entry.answer ?? "");
    }, RENDER_THROTTLE_MS);
  }

  /** Get an answer for one transcript line, streamed in via `AnalysisChunk`. */
  async function getAnswer(id: number): Promise<void> {
    const entry = findEntry(id);
    if (!entry || entry.isAnswering) return;

    const analysisId = nextId();
    entry.isAnswering = true;
    entry.answerError = undefined;
    entry.answer = "";
    entry.answerHtml = "";
    liveAnswers.set(analysisId, { entry, renderTimer: null });

    try {
      const result = await window.electronAPI.answerTranscriptLine({
        analysisId,
        question: entry.text,
        presetId: presetId.value,
        provider: answerProvider.value,
      });
      // Streamed text wins; the invoke()'s returned text is only a fallback
      // for the rare case where no delta events arrived at all.
      if (!entry.answer?.trim()) entry.answer = result.text;
      entry.answerHtml = renderMarkdown(entry.answer);
    } catch (caught) {
      entry.answer = undefined;
      entry.answerHtml = undefined;
      entry.answerError = toMessage(caught);
    } finally {
      const live = liveAnswers.get(analysisId);
      if (live?.renderTimer) clearTimeout(live.renderTimer);
      liveAnswers.delete(analysisId);
      entry.isAnswering = false;
    }
  }

  async function start(): Promise<void> {
    if (isRunning.value) return;

    state.value = "starting";
    error.value = null;

    try {
      // Audio first: if capture fails there is no point opening a session.
      const result = await audio.start();
      audioSource.value = result.source;
      await window.electronAPI.startTranscription();
    } catch (caught) {
      await audio.stop();
      audioSource.value = null;
      state.value = "error";
      error.value = toMessage(caught);
    }
  }

  async function stop(): Promise<void> {
    if (state.value === "idle") return;
    try {
      await window.electronAPI.stopTranscription();
    } finally {
      await audio.stop();
      audioSource.value = null;
      interim.value = "";
      state.value = "idle";
    }
  }

  function clear(): void {
    history.value = [];
    interim.value = "";
    error.value = null;
  }

  const cleanups: Array<() => void> = [];

  onMounted(() => {
    cleanups.push(
      window.electronAPI.onTranscriptionData((chunk) => {
        if (!chunk.isFinal) {
          interim.value = chunk.transcript;
          return;
        }
        // `reactive()` up front, same as `useScreenshots.ts`'s screenshots and
        // turns: pushing a *plain* object into a ref array makes Vue
        // substitute its own proxy on read, so later mutations from
        // `handleAnalysisChunk` -- which holds onto this exact object via
        // `liveAnswers` -- would write to a target nothing is watching.
        const entry = reactive<TranscriptEntry>({
          id: Date.now() + history.value.length,
          text: chunk.transcript,
          at: new Date(chunk.timestamp).toLocaleTimeString(),
          isAnswering: false,
        });
        history.value.push(entry);
        if (history.value.length > MAX_HISTORY) {
          history.value.splice(0, history.value.length - MAX_HISTORY);
        }
        interim.value = "";

        if (autoReply.value) void getAnswer(entry.id);
      }),
    );

    cleanups.push(
      window.electronAPI.onTranscriptionStatus(
        (status: TranscriptionStatus) => {
          state.value = status.state;
          if (status.audioSource) audioSource.value = status.audioSource;
          error.value =
            status.state === "error" ? (status.message ?? null) : null;
        },
      ),
    );

    cleanups.push(window.electronAPI.onAnalysisChunk(handleAnalysisChunk));
  });

  onUnmounted(() => {
    cleanups.forEach((cleanup) => cleanup());
    liveAnswers.forEach((live) => {
      if (live.renderTimer) clearTimeout(live.renderTimer);
    });
    // Fire-and-forget: the window is going away regardless, but the audio
    // tracks and the Live session should not outlive it.
    void stop();
  });

  return {
    state,
    error,
    audioSource,
    interim,
    history,
    isRunning,
    isBusy,
    autoReply,
    answerProvider,
    start,
    stop,
    clear,
    getAnswer,
  };
}
