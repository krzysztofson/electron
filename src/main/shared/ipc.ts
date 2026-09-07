/**
 * The single source of truth for the main <-> renderer contract.
 *
 * Imported by both `main.ts` (via `ipc/register.ts`) and `preload.ts`, so a
 * channel can never drift between the two sides. The renderer does not import
 * this file directly -- it gets the shape from `typeof api` in `preload.ts`.
 *
 * This file lives inside `src/main/` on purpose. A sibling `src/shared/` would
 * change the `rootDir` that tsc infers from `src/main/` to `src/`, silently
 * moving output to `build/main/main/main.js` and breaking both the dev-server
 * spawn path and the `main` field in package.json.
 */

/** Renderer -> main, request/response via `ipcRenderer.invoke`. */
export const InvokeChannel = {
  GetStatus: "app:get-status",
  CaptureScreen: "screen:capture",
  AnalyzeScreenshot: "screen:analyze",
  AskFollowUp: "screen:follow-up",
  StartTranscription: "transcription:start",
  StopTranscription: "transcription:stop",
} as const;

/**
 * Renderer -> main, fire-and-forget via `ipcRenderer.send`.
 *
 * Audio chunks arrive several times a second and nothing waits on the result,
 * so they skip the `invoke` promise round-trip.
 */
export const SendChannel = {
  AudioChunk: "transcription:audio-chunk",
} as const;

/** Main -> renderer, fire-and-forget via `webContents.send`. */
export const EventChannel = {
  AnalyzeHotkey: "hotkey:analyze",
  TranscriptionData: "transcription:data",
  TranscriptionStatus: "transcription:status",
  /** One text fragment of a streaming analysis or follow-up answer. */
  AnalysisChunk: "screen:analysis-chunk",
  /** Fired whenever F8 toggles click-through; the renderer can't detect it itself. */
  InteractionMode: "window:interaction-mode",
} as const;

/** Which providers actually have a key, so the UI can explain itself. */
export interface AppStatus {
  analysisConfigured: boolean;
  transcriptionConfigured: boolean;
  analysisModel: string;
  transcriptionModel: string;
  presets: AnalysisPresetSummary[];
  defaultPresetId: string;
}

export interface AnalysisPresetSummary {
  id: string;
  label: string;
}

export interface CapturedScreenshot {
  dataUrl: string;
  capturedAt: string;
}

/**
 * One or more screenshots analyzed as a single question. `analysisId` is
 * minted by the renderer (not the main process) so it can start listening for
 * `AnalysisChunk` events before the request round-trips at all.
 */
export interface AnalyzeScreenshotRequest {
  analysisId: string;
  dataUrls: string[];
  presetId: string;
}

export interface AskFollowUpRequest {
  analysisId: string;
  previousResponseId: string;
  question: string;
  presetId: string;
}

/**
 * Resolves the `invoke()` call once the stream completes. `text` is the full
 * answer as a fallback for the (expected-rare) case where no delta events
 * arrived -- the renderer normally prefers what it already accumulated from
 * `AnalysisChunk`.
 */
export interface AnalysisResult {
  responseId: string;
  text: string;
}

export interface AnalysisChunk {
  analysisId: string;
  delta: string;
}

export interface InteractionModeStatus {
  clickThrough: boolean;
}

export interface TranscriptionChunk {
  transcript: string;
  isFinal: boolean;
  timestamp: string;
}

/**
 * `reconnecting` is a real state, not an error: Gemini Live sessions are
 * capped at roughly ten minutes and we resume across that boundary.
 */
export type TranscriptionState =
  "idle" | "starting" | "listening" | "reconnecting" | "error";

export interface TranscriptionStatus {
  state: TranscriptionState;
  /** Present when `state` is `error`, or as a human-readable note otherwise. */
  message?: string;
  /** Which capture path won, so the UI can say so. */
  audioSource?: AudioSourceKind;
}

/** How we got at the meeting audio. */
export type AudioSourceKind = "loopback" | "blackhole" | "default-input";
