import { rmSync } from "node:fs";
import { styleText } from "node:util";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { compileTs } from "./private/tsc.mjs";

const resolvePath = (relative) =>
  fileURLToPath(new URL(relative, import.meta.url));

rmSync(resolvePath("../build"), { recursive: true, force: true });

console.log(styleText("blueBright", "Building renderer, main and preload…"));

try {
  await Promise.all([
    build({
      configFile: resolvePath("../vite.config.mjs"),
      mode: "production",
    }),
    // tsc must finish before the preload bundle, because both write into
    // build/main and the preload config runs with emptyOutDir: false.
    compileTs("src/main/tsconfig.build.json", { label: "main" }).then(() =>
      build({
        configFile: resolvePath("../vite.preload.config.mjs"),
        mode: "production",
      }),
    ),
  ]);
} catch (error) {
  // Was Promise.allSettled, which never rejects -- a tsc failure printed
  // "successfully transpiled", exited 0, and let `&& electron-builder`
  // package a stale build directory.
  console.error(styleText("redBright", `Build failed: ${error.message}`));
  process.exit(1);
}

console.log(
  styleText("greenBright", "Build complete — ready for electron-builder."),
);
