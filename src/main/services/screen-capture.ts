import { desktopCapturer, screen } from "electron";
import { config } from "../config";
import { createLogger } from "../logger";
import type { CapturedScreenshot } from "../shared/ipc";

const log = createLogger("screen-capture");

/**
 * Grab the primary display as a data URL.
 *
 * The overlay itself never appears in the result: `setContentProtection(true)`
 * excludes it from every capture path, including this one.
 *
 * The old implementation asked for `types: ["screen", "window"]` and then
 * picked a source whose *name* contained "Screen", "Display" or "Entire",
 * falling back to `sources[0]`. On a non-English macOS none of those match, so
 * it silently fell back to an arbitrary application window. Matching on
 * `display_id` is locale-independent.
 */
export async function capturePrimaryScreen(): Promise<CapturedScreenshot> {
  const { width, height } = config.captureSize;

  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: { width, height },
    fetchWindowIcons: false,
  });

  if (sources.length === 0) {
    throw new Error(
      "No screen sources available. On macOS, grant Screen Recording permission in System Settings > Privacy & Security.",
    );
  }

  const primaryId = String(screen.getPrimaryDisplay().id);
  const source =
    sources.find((candidate) => candidate.display_id === primaryId) ??
    sources[0];

  if (source.thumbnail.isEmpty()) {
    throw new Error(
      "Screen capture returned an empty image. This usually means Screen Recording permission is missing.",
    );
  }

  log.debug(`captured "${source.name}" at ${width}x${height}`);

  return {
    dataUrl: source.thumbnail.toDataURL(),
    capturedAt: new Date().toISOString(),
  };
}
