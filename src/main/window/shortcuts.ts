import { globalShortcut, type BrowserWindow } from "electron";
import { config } from "../config";
import { createLogger } from "../logger";
import { EventChannel, type InteractionModeStatus } from "../shared/ipc";
import {
  getOverlayWindow,
  sendToOverlay,
  toggleClickThrough,
  toggleOverlayVisibility,
} from "./overlay-window";

const log = createLogger("shortcuts");

/** Horizontal step for F6 / Control+F6. */
const COARSE_STEP = 200;
/** Step for the Control+Arrow keys handled inside the window. */
const FINE_STEP = 50;

/**
 * Move the overlay without touching its size.
 *
 * The old Control+Arrow handlers each passed a hardcoded
 * `width: 1200, height: 600`, so simply nudging the window snapped it off its
 * `screenWidth / 3` x `screenHeight` geometry -- while F6 / Control+F6
 * recomputed the size correctly. Two input paths, two different opinions about
 * how big the window is. Every path is now move-only.
 */
function nudge(dx: number, dy: number): void {
  const window = getOverlayWindow();
  if (!window) return;
  const [x, y] = window.getPosition();
  window.setPosition(x + dx, y + dy);
}

function register(accelerator: string, handler: () => void): void {
  // register() returns false when another app already owns the accelerator --
  // the old code ignored this, so a clash looked like a dead keyboard.
  if (!globalShortcut.register(accelerator, handler)) {
    log.warn(`could not register ${accelerator} (already taken?)`);
  }
}

export function registerGlobalShortcuts(): void {
  register("F5", () => {
    log.info("F5 -> requesting capture and analysis");
    sendToOverlay(EventChannel.AnalyzeHotkey);
  });

  register("F6", () => nudge(COARSE_STEP, 0));
  register("Control+F6", () => nudge(-COARSE_STEP, 0));

  register(config.hideShowShortcut, () => {
    log.info("toggling overlay visibility");
    toggleOverlayVisibility();
  });

  // Must stay global: once click-through is on, the overlay itself cannot be
  // clicked to turn it back off.
  register(config.clickThroughShortcut, () => {
    const clickThrough = toggleClickThrough();
    log.info(`click-through ${clickThrough ? "enabled" : "disabled"}`);
    sendToOverlay(EventChannel.InteractionMode, {
      clickThrough,
    } satisfies InteractionModeStatus);
  });
}

/**
 * Must be called from `will-quit`. Without it the accelerators stay claimed
 * for the process lifetime, so F5 keeps being swallowed system-wide.
 */
export function unregisterGlobalShortcuts(): void {
  globalShortcut.unregisterAll();
}

/** Control+Arrow fine positioning, active only while the overlay has focus. */
export function registerWindowShortcuts(window: BrowserWindow): void {
  window.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown" || !input.control) return;

    const deltas: Record<string, [number, number]> = {
      ArrowUp: [0, -FINE_STEP],
      ArrowDown: [0, FINE_STEP],
      ArrowLeft: [-FINE_STEP, 0],
      ArrowRight: [FINE_STEP, 0],
    };

    const delta = deltas[input.key];
    if (!delta) return;

    nudge(delta[0], delta[1]);
    event.preventDefault();
  });
}
