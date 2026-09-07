/**
 * Should match main/preload.ts for typescript support in renderer
 */
export interface ElectronApi {
  captureScreen: () => Promise<string | null>;
  sendMessage: (message: string) => void;
  analyzeScreenshot: (screenshotDataUrl: string) => Promise<string>;
  onF5Press: (callback: () => void) => () => void;
  // Transcription API
  startTranscription: () => Promise<void>;
  stopTranscription: () => Promise<boolean>;
  writeAudioData: (audioData: ArrayBuffer) => Promise<boolean>;
  getAudioSources: () => Promise<
    Array<{ id: string; name: string; type: string }>
  >;
  onTranscriptionData: (
    callback: (data: {
      transcript: string;
      isFinal: boolean;
      timestamp: string;
    }) => void
  ) => () => void;
  onTranscriptionStarted: (callback: () => void) => () => void;
  onTranscriptionStopped: (callback: () => void) => () => void;
  onTranscriptionError: (callback: (error: string) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronApi;
  }
}
