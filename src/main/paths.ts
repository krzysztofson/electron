import { join } from "path";

/**
 * Absolute path to the bundled preload script.
 *
 * Deliberately resolved from a module that sits at the root of the compiled
 * output: `__dirname` here is always `build/main`, which is where both tsc and
 * the Vite preload bundle write. Computing this inside
 * `window/overlay-window.ts` instead makes it `build/main/window`, which is
 * how this silently broke once already -- the preload simply failed to load
 * and the renderer saw `window.electronAPI === undefined`.
 */
export const PRELOAD_PATH = join(__dirname, "preload.js");
