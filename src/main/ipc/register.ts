import { ipcMain } from "electron";
import { config } from "../config";
import { createLogger } from "../logger";
import { listPresetSummaries } from "../analysis-presets";
import {
  EventChannel,
  InvokeChannel,
  SendChannel,
  type AnalysisResult,
  type AnalyzeScreenshotRequest,
  type AnswerTranscriptLineRequest,
  type AppStatus,
  type AskFollowUpRequest,
} from "../shared/ipc";
import { captureCurrentScreen } from "../services/screen-capture";
import {
  analyzeScreenshot,
  answerTranscriptLine,
  askFollowUp,
} from "../services/screenshot-analysis";
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
      openaiTranscriptAnswerModel: config.openaiTranscriptAnswerModel,
      geminiTranscriptAnswerModel: config.geminiTranscriptAnswerModel,
      presets: listPresetSummaries(),
      defaultPresetId: config.analysisPreset,
    };
  });

  ipcMain.handle(InvokeChannel.CaptureScreen, () => captureCurrentScreen());

  ipcMain.handle(
    InvokeChannel.AnalyzeScreenshot,
    (_event, request: AnalyzeScreenshotRequest): Promise<AnalysisResult> =>
      analyzeScreenshot(request.dataUrls, request.presetId, (delta) =>
        sendToOverlay(EventChannel.AnalysisChunk, {
          analysisId: request.analysisId,
          delta,
        }),
      ),
  );

  ipcMain.handle(
    InvokeChannel.AskFollowUp,
    (_event, request: AskFollowUpRequest): Promise<AnalysisResult> =>
      askFollowUp(
        request.previousResponseId,
        request.question,
        request.presetId,
        (delta) =>
          sendToOverlay(EventChannel.AnalysisChunk, {
            analysisId: request.analysisId,
            delta,
          }),
      ),
  );

  ipcMain.handle(
    InvokeChannel.AnswerTranscriptLine,
    (_event, request: AnswerTranscriptLineRequest): Promise<AnalysisResult> =>
      answerTranscriptLine(
        request.question,
        request.presetId,
        request.provider,
        (delta) =>
          sendToOverlay(EventChannel.AnalysisChunk, {
            analysisId: request.analysisId,
            delta,
          }),
      ),
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
