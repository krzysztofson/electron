import { app, desktopCapturer, session } from "electron";
import { createLogger, errorMessage } from "../../logger";

const log = createLogger("display-media");

/**
 * Chromium flags required for system-audio loopback on macOS.
 *
 * Must be appended before `app.whenReady()`, which is why this is a separate
 * exported function rather than part of the handler registration below.
 */
export function enableLoopbackAudioSwitches(): void {
  if (process.platform !== "darwin") return;
  app.commandLine.appendSwitch(
    "enable-features",
    "MacLoopbackAudioForScreenShare,MacSckSystemAudioLoopbackOverride",
  );
}

/**
 * Serve `getDisplayMedia()` with the primary screen plus system audio.
 *
 * This is what removes the BlackHole requirement. System audio is a privileged
 * resource on macOS that only the screen-sharing pipeline may touch, so
 * capturing it means going through `getDisplayMedia` even though we only want
 * the audio track -- the renderer stops the video track immediately.
 *
 * Passing `audio: 'loopback'` is mandatory; without it macOS hands back a
 * silent track rather than an error. We use `loopback` rather than
 * `loopbackWithMute` so you can still hear the meeting you are transcribing.
 *
 * Requires macOS 13.2+. `useAudioCapture` in the renderer falls back to the
 * BlackHole virtual device when this yields no usable audio.
 */
export function registerDisplayMediaHandler(): void {
  session.defaultSession.setDisplayMediaRequestHandler(
    (_request, callback) => {
      desktopCapturer
        .getSources({ types: ["screen"], fetchWindowIcons: false })
        .then((sources) => {
          if (sources.length === 0) {
            log.warn("no screen sources for display-media request");
            // Electron requires a response; an empty one rejects the promise
            // in the renderer, which triggers the BlackHole fallback.
            callback({});
            return;
          }
          log.debug(`serving display-media with loopback audio`);
          callback({ video: sources[0], audio: "loopback" });
        })
        .catch((error: unknown) => {
          log.error("display-media request failed:", errorMessage(error));
          callback({});
        });
    },
    // We pick the source ourselves; the native picker would prompt the user
    // every time they start transcription.
    { useSystemPicker: false },
  );
}
