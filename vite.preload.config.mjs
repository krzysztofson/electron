import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const resolvePath = (relative) =>
  fileURLToPath(new URL(relative, import.meta.url));

/**
 * Bundles the preload script into a single CommonJS file.
 *
 * This exists so the preload can stay sandboxed. `sandbox: true` is Electron's
 * default when `nodeIntegration` is off, and in a sandboxed preload `require`
 * is a polyfill that only resolves `electron`, `events`, `timers` and `url` --
 * a relative `require("./shared/ipc")` throws at load time, `contextBridge`
 * never runs, and `window.electronAPI` comes out undefined. Bundling inlines
 * the shared IPC contract so there is nothing to resolve at runtime.
 *
 * Emitted alongside the tsc output in build/main/, which is why
 * src/main/tsconfig.json excludes preload.ts from its own emit.
 */
export default defineConfig({
  build: {
    outDir: resolvePath("build/main"),
    // tsc has already written main.js et al. into this directory.
    emptyOutDir: false,
    sourcemap: true,
    minify: false,
    lib: {
      entry: resolvePath("src/main/preload.ts"),
      formats: ["cjs"],
      fileName: () => "preload.js",
    },
    rollupOptions: {
      external: ["electron"],
    },
  },
});
