import { ipcMain } from "electron";
import { config } from "../config";
import { createLogger } from "../logger";
import {
  EventChannel,
  InvokeChannel,
  SendChannel,
  type AppStatus,
} from "../shared/ipc";
import { capturePrimaryScreen } from "../services/screen-capture";
import { analyzeScreenshot } from "../services/screenshot-analysis";
import { transcriptionService } from "../services/transcription/gemini-live";
import { sendToOverlay } from "../window/overlay-window";

const log = createLogger("ipc");

/**
 * Wire every main-process handler.
 *
 * Called before the window is created. The old code created the window first
 * and registered handlers afterwards, leaving a window in which the renderer
 * could invoke a channel that did not exist yet.
 *
 * Handlers deliberately let errors propagate: `ipcMain.handle` turns a thrown
 * error into a rejected promise in the renderer, which is what lets the UI
 * distinguish a real failure from a successful analysis.
 */
export function registerIpcHandlers(): void {
  ipcMain.handle(InvokeChannel.GetStatus, (): AppStatus => {
    return {
      analysisConfigured: Boolean(config.openaiApiKey),
      transcriptionConfigured: Boolean(config.geminiApiKey),
      analysisModel: config.analysisModel,
      transcriptionModel: config.transcriptionModel,
    };
  });

  ipcMain.handle(InvokeChannel.CaptureScreen, () => capturePrimaryScreen());

  ipcMain.handle(
    InvokeChannel.AnalyzeScreenshot,
    (_event, screenshotDataUrl: string) => analyzeScreenshot(screenshotDataUrl),
  );

  ipcMain.handle(InvokeChannel.StartTranscription, () =>
    transcriptionService.start({
      onChunk: (chunk) => sendToOverlay(EventChannel.TranscriptionData, chunk),
      onStatus: (status) =>
        sendToOverlay(EventChannel.TranscriptionStatus, status),
    }),
  );

  ipcMain.handle(InvokeChannel.StopTranscription, () => {
    transcriptionService.stop();
  });

  ipcMain.on(SendChannel.AudioChunk, (_event, chunk: Uint8Array) => {
    transcriptionService.sendAudio(chunk);
  });

  log.debug("ipc handlers registered");
}
