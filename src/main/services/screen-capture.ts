import { desktopCapturer, screen } from "electron";
import { config } from "../config";
import { createLogger } from "../logger";
import { fitWithinPatchBudget } from "./image-budget";
import type { CapturedScreenshot } from "../shared/ipc";

const log = createLogger("screen-capture");

/**
 * Grab the display under the cursor as a data URL, at native resolution.
 *
 * The overlay itself never appears in the result: `setContentProtection(true)`
 * excludes it from every capture path, including this one.
 *
 * Two things changed from the first version of this function, both aimed at
 * answer quality:
 *
 * 1. **Display under the cursor, not the primary display.** On a multi-monitor
 *    setup the interview is wherever you're actually looking, which is not
 *    necessarily display 0.
 * 2. **Native pixels, not a fixed 1200x800 downscale.** `display.bounds` is in
 *    DIP points; multiplying by `scaleFactor` gives native pixels. This only
 *    pays off when the caller requests `detail: "original"` -- with
 *    `detail: "high"` the API refits everything to a 2048px long edge
 *    regardless of what we send, so native capture would be wasted bandwidth
 *    at that detail level. See `services/screenshot-analysis.ts`.
 *
 * The old implementation asked for `types: ["screen", "window"]` and then
 * picked a source whose *name* contained "Screen", "Display" or "Entire",
 * falling back to `sources[0]`. On a non-English macOS none of those match, so
 * it silently fell back to an arbitrary application window. Matching on
 * `display_id` is locale-independent and is kept here.
 */
export async function captureCurrentScreen(): Promise<CapturedScreenshot> {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const requestedSize = resolveCaptureSize(display);

  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: requestedSize,
    fetchWindowIcons: false,
  });

  if (sources.length === 0) {
    throw new Error(
      "No screen sources available. On macOS, grant Screen Recording permission in System Settings > Privacy & Security.",
    );
  }

  const targetId = String(display.id);
  const source =
    sources.find((candidate) => candidate.display_id === targetId) ??
    sources[0];

  if (source.thumbnail.isEmpty()) {
    throw new Error(
      "Screen capture returned an empty image. This usually means Screen Recording permission is missing.",
    );
  }

  const actual = source.thumbnail.getSize();
  log.debug(
    `captured "${source.name}" requested=${requestedSize.width}x${requestedSize.height} actual=${actual.width}x${actual.height}`,
  );

  return {
    dataUrl: source.thumbnail.toDataURL(),
    capturedAt: new Date().toISOString(),
  };
}

/**
 * Native pixel size for `display`, capped by the patch budget, unless an
 * explicit CAPTURE_WIDTH/CAPTURE_HEIGHT override is set.
 */
function resolveCaptureSize(display: Electron.Display): {
  width: number;
  height: number;
} {
  const override = config.captureSizeOverride;
  if (override) return override;

  const native = {
    width: Math.round(display.bounds.width * display.scaleFactor),
    height: Math.round(display.bounds.height * display.scaleFactor),
  };

  return fitWithinPatchBudget(
    native.width,
    native.height,
    config.captureMaxPatches,
  );
}
