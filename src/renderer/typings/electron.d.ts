import type { ElectronApi } from "../../main/preload";

/**
 * Derived from the preload's actual `api` object rather than hand-written, so
 * the two can no longer disagree. The previous hand-maintained version had
 * drifted: it declared a `getAudioSources` method that existed nowhere in the
 * preload, which type-checked happily and threw at runtime.
 *
 * `import type` is fully erased, so `src/main/preload.ts` never enters Vite's
 * module graph and no `electron` import leaks into the renderer bundle.
 */
declare global {
  interface Window {
    electronAPI: ElectronApi;
  }
}
