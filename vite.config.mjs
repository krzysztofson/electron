import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

const resolvePath = (relative) =>
  fileURLToPath(new URL(relative, import.meta.url));

/** Renderer build. See vite.preload.config.mjs for the preload bundle. */
export default defineConfig({
  root: resolvePath("src/renderer"),
  // Relative base so the production build works when loaded over file://.
  base: "./",
  server: {
    port: 8080,
    // Was a stray top-level `open: false`, which Vite silently ignored.
    open: false,
  },
  resolve: {
    alias: {
      "@": resolvePath("src/renderer"),
    },
  },
  build: {
    outDir: resolvePath("build/renderer"),
    emptyOutDir: true,
    sourcemap: true,
  },
  plugins: [vue()],
});
