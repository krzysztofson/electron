/**
 * Re-exports the main process's IPC payload types for renderer use.
 *
 * Type-only, so this compiles away to nothing -- it exists to give the
 * renderer one import path instead of relative reaches into `src/main`.
 */
export type {
  AnalysisChunk,
  AnalysisPresetSummary,
  AnalysisResult,
  AnswerTranscriptLineRequest,
  AppStatus,
  AudioSourceKind,
  CapturedScreenshot,
  InteractionModeStatus,
  TranscriptAnswerProvider,
  TranscriptionChunk,
  TranscriptionState,
  TranscriptionStatus,
} from "../main/shared/ipc";
