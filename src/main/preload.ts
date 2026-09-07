import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import {
  EventChannel,
  InvokeChannel,
  SendChannel,
  type AppStatus,
  type CapturedScreenshot,
  type TranscriptionChunk,
  type TranscriptionStatus,
} from "./shared/ipc";

/**
 * Subscribe to a main-process event and return an unsubscribe function.
 *
 * Replaces five near-identical copies of this listener boilerplate.
 */
function subscribe<T>(
  channel: string,
  callback: (payload: T) => void,
): () => void {
  const listener = (_event: IpcRendererEvent, payload: T) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}

/**
 * The renderer's entire view of the main process.
 *
 * Note there is no `sendMessage`: the old API exposed one that fired on a
 * `"message"` channel with no `ipcMain` listener anywhere, and `App.vue` called
 * it on every mount straight into the void.
 *
 * Errors are not caught here. The previous version wrapped every call in a
 * try/catch that logged and rethrew, which added noise without changing
 * behaviour -- rejections propagate to the caller either way.
 */
const api = {
  getStatus: (): Promise<AppStatus> =>
    ipcRenderer.invoke(InvokeChannel.GetStatus),

  captureScreen: (): Promise<CapturedScreenshot> =>
    ipcRenderer.invoke(InvokeChannel.CaptureScreen),

  analyzeScreenshot: (screenshotDataUrl: string): Promise<string> =>
    ipcRenderer.invoke(InvokeChannel.AnalyzeScreenshot, screenshotDataUrl),

  startTranscription: (): Promise<void> =>
    ipcRenderer.invoke(InvokeChannel.StartTranscription),

  stopTranscription: (): Promise<void> =>
    ipcRenderer.invoke(InvokeChannel.StopTranscription),

  /** Fire-and-forget: this runs several times a second. */
  sendAudioChunk: (chunk: ArrayBuffer): void => {
    ipcRenderer.send(SendChannel.AudioChunk, new Uint8Array(chunk));
  },

  onAnalyzeHotkey: (callback: () => void): (() => void) =>
    subscribe<void>(EventChannel.AnalyzeHotkey, () => callback()),

  onTranscriptionData: (
    callback: (chunk: TranscriptionChunk) => void,
  ): (() => void) =>
    subscribe<TranscriptionChunk>(EventChannel.TranscriptionData, callback),

  onTranscriptionStatus: (
    callback: (status: TranscriptionStatus) => void,
  ): (() => void) =>
    subscribe<TranscriptionStatus>(EventChannel.TranscriptionStatus, callback),
};

contextBridge.exposeInMainWorld("electronAPI", api);

/**
 * The renderer derives its `window.electronAPI` type from this, so the two can
 * no longer drift. The hand-written version had already grown a
 * `getAudioSources` method that existed nowhere in this file -- it type-checked
 * fine and threw at runtime.
 */
export type ElectronApi = typeof api;
