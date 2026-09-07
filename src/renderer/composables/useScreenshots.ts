import { computed, onMounted, onUnmounted, ref } from "vue";
import { renderMarkdown } from "./useMarkdown";

/** Full-size base64 PNGs, so this is a real memory ceiling, not politeness. */
const MAX_SCREENSHOTS = 12;

export interface Screenshot {
  id: number;
  dataUrl: string;
  capturedAt: Date;
  /** Raw markdown from the model. */
  analysis?: string;
  /** Sanitized HTML derived from `analysis`. */
  analysisHtml?: string;
  /** Set when this particular screenshot's analysis failed. */
  error?: string;
  isAnalyzing: boolean;
}

function toMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return String(error);
}

/**
 * Owns the screenshot collection, capture, and per-item analysis.
 *
 * Analysis lives here rather than in its own composable because it mutates
 * this collection -- splitting them would just mean passing the list around.
 */
export function useScreenshots() {
  const screenshots = ref<Screenshot[]>([]);
  const isCapturing = ref(false);
  const captureError = ref<string | null>(null);

  // Derived, not a separate counter. The old `count` ref incremented on
  // capture but never decremented on delete, so the button label drifted out
  // of sync with the actual number of screenshots.
  const total = computed(() => screenshots.value.length);
  const isAnalyzing = computed(() =>
    screenshots.value.some((shot) => shot.isAnalyzing),
  );

  function find(id: number): Screenshot | undefined {
    return screenshots.value.find((shot) => shot.id === id);
  }

  async function capture(): Promise<Screenshot | null> {
    isCapturing.value = true;
    captureError.value = null;

    try {
      const result = await window.electronAPI.captureScreen();
      const shot: Screenshot = {
        id: Date.now(),
        dataUrl: result.dataUrl,
        capturedAt: new Date(result.capturedAt),
        isAnalyzing: false,
      };

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
    const shot = find(id);
    if (!shot || shot.isAnalyzing) return;

    shot.isAnalyzing = true;
    shot.error = undefined;

    try {
      const markdown = await window.electronAPI.analyzeScreenshot(shot.dataUrl);
      shot.analysis = markdown;
      shot.analysisHtml = renderMarkdown(markdown);
    } catch (error) {
      // The main process throws on API failure, so this branch is now
      // reachable. It previously was not: the main process returned its error
      // text as a successful value, which then got markdown-rendered and shown
      // as a legitimate analysis.
      shot.error = toMessage(error);
      shot.analysis = undefined;
      shot.analysisHtml = undefined;
    } finally {
      shot.isAnalyzing = false;
    }
  }

  function remove(id: number): void {
    screenshots.value = screenshots.value.filter((shot) => shot.id !== id);
  }

  function clear(): void {
    screenshots.value = [];
    captureError.value = null;
  }

  /** Capture and immediately analyze -- the F5 flow. */
  async function captureAndAnalyze(): Promise<void> {
    clear();
    const shot = await capture();
    if (shot) await analyze(shot.id);
  }

  let unsubscribe: (() => void) | null = null;

  onMounted(() => {
    unsubscribe = window.electronAPI.onAnalyzeHotkey(() => {
      void captureAndAnalyze();
    });
  });

  onUnmounted(() => unsubscribe?.());

  return {
    screenshots,
    isCapturing,
    isAnalyzing,
    captureError,
    total,
    capture,
    analyze,
    remove,
    clear,
    captureAndAnalyze,
  };
}
