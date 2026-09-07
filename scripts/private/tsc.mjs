import { spawn } from "node:child_process";
import { styleText } from "node:util";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

/**
 * Run a TypeScript compilation and reject on a non-zero exit code.
 *
 * `spawn` with an argv array rather than `exec` with an interpolated string,
 * so project paths containing spaces cannot break the command.
 */
export function compileTs(projectPath, { label = "tsc" } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["tsc", "-p", projectPath], {
      cwd: repoRoot,
      shell: false,
    });

    const forward = (stream) => (data) => {
      stream.write(styleText("yellowBright", `[${label}] `) + data.toString());
    };

    child.stdout.on("data", forward(process.stdout));
    child.stderr.on("data", forward(process.stderr));

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} failed with exit code ${code}`));
    });
  });
}
