import { execFileSync } from "node:child_process";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { values } = parseArgs({
  options: { output: { type: "string" }, replay: { type: "string" } },
});
if (!values.output) {
  throw new Error("--output is required");
}
const output = path.resolve(values.output);
await mkdir(output, { recursive: true });
const temporary = path.join(
  repo,
  "platform/wab/src/wab/client/copilot/skill-evaluation.generated.test.ts",
);
// A temporary test uses the actual Studio fixture and exporter; it is not a shipped skill resource.
await writeFile(
  temporary,
  await readFile(
    path.join(
      repo,
      values.replay
        ? "ai/plasmic/evals/replay-edits.test.ts"
        : "ai/plasmic/evals/generate-fixtures.test.ts",
    ),
  ),
  { flag: "wx" },
);
try {
  execFileSync(
    path.join(repo, "platform/wab/node_modules/.bin/vitest"),
    ["run", path.relative(path.join(repo, "platform/wab"), temporary)],
    {
      cwd: path.join(repo, "platform/wab"),
      env: {
        ...process.env,
        PLASMIC_SKILL_EVAL_OUTPUT: output,
        ...(values.replay
          ? { PLASMIC_SKILL_EVAL_REPLAY: path.resolve(values.replay) }
          : {}),
      },
      stdio: "inherit",
    },
  );
} finally {
  await unlink(temporary);
}
