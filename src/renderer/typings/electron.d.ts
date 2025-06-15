/**
 * Should match main/preload.ts for typescript support in renderer
 */
export interface ElectronApi {
  captureScreen: () => Promise<string | null>;
  sendMessage: (message: string) => void;
  analyzeScreenshot: (screenshotDataUrl: string) => Promise<string>;
  onF5Press: (callback: () => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronApi;
  }
}
