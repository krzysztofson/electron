import { computed, onMounted, onUnmounted, ref } from "vue";
import type {
  AudioSourceKind,
  TranscriptionState,
  TranscriptionStatus,
} from "@/ipc-types";
import { useAudioCapture } from "./useAudioCapture";

/** A long meeting would otherwise grow this array without bound. */
const MAX_HISTORY = 500;

export interface TranscriptEntry {
  id: number;
  text: string;
  at: string;
}

function toMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return String(error);
}

/**
 * Live transcription: owns the audio capture lifecycle plus the transcript
 * state arriving from the main process.
 */
export function useTranscription() {
  const audio = useAudioCapture();

  const state = ref<TranscriptionState>("idle");
  const error = ref<string | null>(null);
  const audioSource = ref<AudioSourceKind | null>(null);
  /** The in-progress phrase, replaced as the model refines it. */
  const interim = ref("");
  const history = ref<TranscriptEntry[]>([]);

  const isRunning = computed(
    () => state.value !== "idle" && state.value !== "error",
  );
  const isBusy = computed(
    () => state.value === "starting" || state.value === "reconnecting",
  );

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
        history.value.push({
          id: Date.now() + history.value.length,
          text: chunk.transcript,
          at: new Date(chunk.timestamp).toLocaleTimeString(),
        });
        if (history.value.length > MAX_HISTORY) {
          history.value.splice(0, history.value.length - MAX_HISTORY);
        }
        interim.value = "";
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
  });

  onUnmounted(() => {
    cleanups.forEach((cleanup) => cleanup());
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
    start,
    stop,
    clear,
  };
}
