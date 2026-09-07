process.env.NODE_ENV = "development";

import { spawn } from "node:child_process";
import { cpSync, existsSync } from "node:fs";
import { relative, sep } from "node:path";
import { styleText } from "node:util";
import { fileURLToPath } from "node:url";
import { createServer, build } from "vite";
import chokidar from "chokidar";
import electron from "electron";
import { compileTs } from "./private/tsc.mjs";

const resolvePath = (relative_) =>
  fileURLToPath(new URL(relative_, import.meta.url));

const MAIN_SRC = resolvePath("../src/main");
const STATIC_SRC = resolvePath("../src/main/static");
const STATIC_OUT = resolvePath("../build/main/static");
const ENTRY = resolvePath("../build/main/main.js");

let viteServer = null;
let electronProcess = null;
let restarting = false;
let rendererPort = 0;

const log = (message) =>
  console.log(styleText("blueBright", "[electron] ") + message);

/** tsc does not copy non-TS files, so mirror them for the dev run. */
function copyStaticFiles() {
  if (existsSync(STATIC_SRC)) {
    cpSync(STATIC_SRC, STATIC_OUT, { recursive: true });
  }
}

/** Compile the main process and bundle the sandboxed preload. */
async function buildMain() {
  await compileTs("src/main/tsconfig.build.json", { label: "main" });
  await build({
    configFile: resolvePath("../vite.preload.config.mjs"),
    mode: "development",
    logLevel: "warn",
  });
  copyStaticFiles();
}

async function startElectron() {
  if (electronProcess) return;

  try {
    await buildMain();
  } catch (error) {
    console.error(
      styleText("redBright", `Not starting Electron: ${error.message}`),
    );
    return;
  }

  // VSCode, Cursor and other Electron-based editors export
  // ELECTRON_RUN_AS_NODE=1 into their integrated terminals. Inherited, it makes
  // the Electron binary boot as plain Node: `process.type` is undefined and
  // `require("electron")` returns the npm shim's path string instead of the
  // built-in module, so the app dies on the first `app.` access.
  const { ELECTRON_RUN_AS_NODE: _ignored, ...childEnv } = process.env;

  electronProcess = spawn(electron, [ENTRY, String(rendererPort)], {
    env: childEnv,
  });

  electronProcess.stdout.on("data", (data) => {
    const text = data.toString().trim();
    if (text) log(text);
  });
  electronProcess.stderr.on("data", (data) => {
    const text = data.toString().trim();
    if (text)
      process.stderr.write(
        styleText("blueBright", "[electron] ") + text + "\n",
      );
  });

  electronProcess.on("exit", () => {
    // A restart kills the process deliberately; only a real exit should stop
    // the dev server.
    if (!restarting) void stop();
  });
}

async function restartElectron() {
  if (electronProcess) {
    restarting = true;
    electronProcess.removeAllListeners("exit");
    electronProcess.kill();
    electronProcess = null;
    restarting = false;
  }
  await startElectron();
}

async function stop() {
  await viteServer?.close();
  process.exit(0);
}

console.log(styleText("greenBright", "Starting Electron + Vite dev server…"));

viteServer = await createServer({
  configFile: resolvePath("../vite.config.mjs"),
  mode: "development",
});
await viteServer.listen();
rendererPort = viteServer.config.server.port;

await startElectron();

// Absolute paths and an explicit `relative()` rather than chokidar's `cwd`
// option, so this keeps working across chokidar majors.
chokidar.watch(MAIN_SRC, { ignoreInitial: true }).on("all", (_event, path) => {
  const changed = relative(MAIN_SRC, path);
  log(`change in ${changed} — reloading…`);

  if (changed.startsWith(`static${sep}`)) {
    copyStaticFiles();
    return;
  }
  void restartElectron();
});

process.on("SIGINT", () => void stop());
process.on("SIGTERM", () => void stop());
