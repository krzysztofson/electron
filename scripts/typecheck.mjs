import { spawn } from "node:child_process";
import { styleText } from "node:util";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

/**
 * Type-check both processes.
 *
 * The renderer half is the point: `src/renderer/tsconfig.json` existed for a
 * year but was never executed, because the build only ran tsc over src/main
 * and @vitejs/plugin-vue strips types without checking them. Renderer type
 * errors simply could not fail a build.
 */
const projects = [
  { label: "main", command: "tsc", project: "src/main/tsconfig.json" },
  {
    label: "renderer",
    command: "vue-tsc",
    project: "src/renderer/tsconfig.json",
  },
];

function run({ label, command, project }) {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", [command, "-p", project, "--noEmit"], {
      cwd: repoRoot,
      shell: false,
    });

    const forward = (stream) => (data) =>
      stream.write(styleText("cyan", `[${label}] `) + data.toString());

    child.stdout.on("data", forward(process.stdout));
    child.stderr.on("data", forward(process.stderr));
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${label} type errors`)),
    );
  });
}

for (const project of projects) {
  try {
    await run(project);
    console.log(styleText("greenBright", `✓ ${project.label} types OK`));
  } catch (error) {
    console.error(styleText("redBright", `✗ ${error.message}`));
    process.exit(1);
  }
}
