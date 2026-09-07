import { app, BrowserWindow, screen } from "electron";
import { join } from "path";
import { createLogger } from "../logger";
import { PRELOAD_PATH } from "../paths";

const log = createLogger("overlay-window");

/**
 * ============================================================================
 * THE INVISIBLE LAYER -- this file is the product. Read before editing.
 * ============================================================================
 *
 * `setContentProtection(true)` is the entire capture-exclusion feature. It
 * maps to `NSWindowSharingNone` on macOS and `SetWindowDisplayAffinity` /
 * `WDA_EXCLUDEFROMCAPTURE` on Windows, which is what keeps this overlay out of
 * a Zoom/Meet screen share while it stays visible on the local display.
 * Everything else below is cosmetic.
 *
 * Four traps, all of which cost real debugging time before:
 *
 * 1. The old code had the comment "Disable content protection as it can
 *    interfere with screen capture" sitting directly above
 *    `setContentProtection(true)`, which *enables* it. Git history shows it was
 *    disabled, blamed for breaking `desktopCapturer`, then re-enabled without
 *    the comment being fixed. It does not interfere with `desktopCapturer`.
 *    Acting on that comment deletes the feature.
 *
 * 2. `alwaysOnTop` is intentionally set twice: `false` in the constructor, then
 *    `setAlwaysOnTop(true, "floating")` below. The "floating" level is only
 *    reachable through the setter. Collapsing this into the constructor option
 *    silently drops the level and the overlay falls behind fullscreen apps.
 *
 * 3. This window is NOT `transparent: true`. The see-through look comes from
 *    `setOpacity(0.7)`. Do not add `transparent: true` alongside `setOpacity`
 *    and `backgroundColor: "#000"` -- that combination renders opaque black on
 *    some platforms and ignores opacity on Windows. (Some now-inert
 *    `background: transparent` rules survive in the renderer CSS from an
 *    abandoned attempt at this.)
 *
 * 4. `enableLargerThanScreen: true` with `y: 50` and a full work-area height
 *    deliberately pushes the window past the bottom of the work area. It is a
 *    macOS-only option; removing it changes the geometry.
 *
 * 5. `toggleOverlayVisibility()` below re-applies `setContentProtection(true)`
 *    immediately after every `show()`. On Windows `SetWindowDisplayAffinity` is
 *    bound to the HWND lifetime, not guaranteed to survive a hide/show cycle --
 *    do not "simplify" this by calling `setContentProtection` only once at
 *    creation.
 *
 * `setContentProtection` is called synchronously right after construction and
 * before `loadURL`.
 */

let overlayWindow: BrowserWindow | null = null;

export function createOverlayWindow(): BrowserWindow {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } =
    primaryDisplay.workAreaSize;

  const window = new BrowserWindow({
    width: screenWidth / 3,
    height: screenHeight,
    x: 50,
    y: 50,
    alwaysOnTop: false, // see trap 2 -- overridden below, do not "tidy" away
    skipTaskbar: false,
    backgroundColor: "#000",
    frame: true,
    hasShadow: false,
    enableLargerThanScreen: true,
    // Cosmetic, unlike setContentProtection: keeps the overlay out of the
    // Mission Control window switcher so a three-finger swipe doesn't expose
    // it as a distinct "app" to switch to mid-meeting.
    hiddenInMissionControl: true,
    webPreferences: {
      preload: PRELOAD_PATH,
      nodeIntegration: false,
      contextIsolation: true,
      // Explicit rather than relying on the default: the preload is bundled by
      // Vite precisely so it can keep running sandboxed while still importing
      // the shared IPC contract. A sandboxed preload cannot `require` a
      // relative file, so an unbundled multi-file preload would throw at load
      // and leave `window.electronAPI` undefined.
      sandbox: true,
      backgroundThrottling: false,
    },
  });

  overlayWindow = window;

  window.setOpacity(0.7);
  window.setContentProtection(true); // <-- THE invisible layer. Do not remove.
  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  window.setAlwaysOnTop(true, "floating");

  log.info("overlay window created with content protection enabled");

  // A preload that throws fails silently: contextBridge never runs and the
  // renderer just sees `window.electronAPI === undefined`, usually blamed on
  // the renderer. Surface it instead.
  window.webContents.on("preload-error", (_event, path, error) => {
    log.error(`preload failed to load (${path}):`, error);
  });

  if (process.env.NODE_ENV === "development") {
    const rendererPort = process.argv[2];
    void window.loadURL(`http://localhost:${rendererPort}`);
  } else {
    void window.loadFile(join(app.getAppPath(), "renderer", "index.html"));
  }

  // The old code never cleared this, so global-shortcut callbacks could call
  // getBounds() on a destroyed window and throw.
  window.on("closed", () => {
    if (overlayWindow === window) overlayWindow = null;
  });

  return window;
}

/** The live overlay window, or null if it has been closed. */
export function getOverlayWindow(): BrowserWindow | null {
  if (overlayWindow?.isDestroyed()) return null;
  return overlayWindow;
}

/** Send an event to the renderer, no-op if the window is gone. */
export function sendToOverlay(channel: string, ...args: unknown[]): void {
  const window = getOverlayWindow();
  if (!window) return;
  window.webContents.send(channel, ...args);
}

/**
 * Panic-hide: F7 in `window/shortcuts.ts`. Hiding keeps the renderer alive
 * (transcription and any in-flight analysis keep running) -- it only stops
 * painting to the display, same as any other `BrowserWindow.hide()`.
 */
export function toggleOverlayVisibility(): void {
  const window = getOverlayWindow();
  if (!window) return;

  if (window.isVisible()) {
    window.hide();
    return;
  }

  window.show();
  // See trap 5 above: re-apply on every show(), not just at creation.
  window.setContentProtection(true);
}

let clickThroughEnabled = false;

export function isClickThroughEnabled(): boolean {
  return clickThroughEnabled;
}

/**
 * `forward: true` keeps delivering mouse-move events to the renderer (so
 * hover states don't get stuck) while clicks pass through to whatever is
 * behind the overlay -- an editor, a browser, whatever you're pointing at.
 */
export function setClickThrough(enabled: boolean): void {
  const window = getOverlayWindow();
  if (!window) return;
  clickThroughEnabled = enabled;
  window.setIgnoreMouseEvents(enabled, { forward: true });
}

/** F8 in `window/shortcuts.ts`. Returns the resulting state. */
export function toggleClickThrough(): boolean {
  setClickThrough(!clickThroughEnabled);
  return clickThroughEnabled;
}
