import { app, BrowserWindow } from "electron";
import { loadEnvironment } from "./config";
import { createLogger } from "./logger";
import { registerIpcHandlers } from "./ipc/register";
import { transcriptionService } from "./services/transcription/gemini-live";
import {
  enableLoopbackAudioSwitches,
  registerDisplayMediaHandler,
} from "./services/transcription/display-media";
import { createOverlayWindow } from "./window/overlay-window";
import { applyNavigationGuards, applySessionSecurity } from "./window/security";
import {
  registerGlobalShortcuts,
  registerWindowShortcuts,
  unregisterGlobalShortcuts,
} from "./window/shortcuts";

const log = createLogger("main");

// Both of these must happen before the app is ready: command-line switches are
// read during Chromium startup, and the rest of the app reads config eagerly.
enableLoopbackAudioSwitches();
loadEnvironment();

function startOverlay(): void {
  const window = createOverlayWindow();
  registerWindowShortcuts(window);
  applyNavigationGuards(window.webContents);
}

app.whenReady().then(() => {
  // Handlers first, then the window -- otherwise the renderer can invoke a
  // channel before it exists.
  registerIpcHandlers();
  applySessionSecurity();
  registerDisplayMediaHandler();

  startOverlay();
  registerGlobalShortcuts();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) startOverlay();
  });

  log.info("application ready");
});

// Restored: this handler was deleted at some point, so on Windows and Linux
// the app kept running headless after the overlay was closed.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// Without this, F5/F6 stay claimed globally for the lifetime of the process.
app.on("will-quit", () => {
  unregisterGlobalShortcuts();
  transcriptionService.stop();
});
