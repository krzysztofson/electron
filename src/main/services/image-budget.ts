import { nativeImage } from "electron";

/**
 * Patch-based sizing math shared between single- and multi-image analysis.
 *
 * The Responses API tokenizes images as 32x32 patches and enforces a
 * per-image patch ceiling (~30,000) -- `detail: "original"` skips the API's
 * own downscaling, so a native screenshot needs to be brought under that
 * ceiling ourselves. `fitWithinPatchBudget` is that math, applied once at
 * capture time in `screen-capture.ts`.
 *
 * Sending several already-correctly-sized images in one multi-image analysis
 * doesn't risk that per-image limit -- it's per image, not aggregate -- but it
 * does multiply cost linearly with image count. `resizeDataUrlToPatchBudget`
 * lets `screenshot-analysis.ts` divide the budget across a selected set so a
 * 4-screenshot question doesn't cost 4x a 1-screenshot one.
 */

const PATCH_SIZE = 32;

export function countPatches(width: number, height: number): number {
  return Math.ceil(width / PATCH_SIZE) * Math.ceil(height / PATCH_SIZE);
}

/**
 * Scale `width`x`height` down (never up) so it fits within `maxPatches`,
 * preserving aspect ratio. A no-op if already within budget.
 */
export function fitWithinPatchBudget(
  width: number,
  height: number,
  maxPatches: number,
): { width: number; height: number } {
  const current = countPatches(width, height);
  if (current <= maxPatches || current === 0) {
    return { width, height };
  }

  // Patches scale ~linearly with pixel area, so the scale factor is the
  // square root of the budget ratio.
  const scale = Math.sqrt(maxPatches / current);
  return {
    width: Math.max(1, Math.floor(width * scale)),
    height: Math.max(1, Math.floor(height * scale)),
  };
}

/**
 * Downscale an already-captured screenshot to fit `maxPatches`, if needed.
 * Returns the original data URL unchanged when it's already within budget, to
 * avoid a pointless lossy re-encode.
 */
export function resizeDataUrlToPatchBudget(
  dataUrl: string,
  maxPatches: number,
): string {
  const image = nativeImage.createFromDataURL(dataUrl);
  const current = image.getSize();
  const target = fitWithinPatchBudget(
    current.width,
    current.height,
    maxPatches,
  );

  if (target.width === current.width && target.height === current.height) {
    return dataUrl;
  }

  return image.resize(target).toDataURL();
}
