import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const repo = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
if (!process.argv[2]) {
  throw new Error(
    "Provide the evaluation workspace containing model-fixtures.json and iteration-1",
  );
}
const workspace = path.resolve(process.argv[2]);
const models = JSON.parse(
  await fs.readFile(path.join(workspace, "model-fixtures.json"), "utf8"),
);
const iteration = path.join(workspace, "iteration-1");
const results = [],
  replays = [];
function run(command, args, cwd, log) {
  let status = 0,
    output;
  try {
    output = execFileSync(command, args, {
      cwd,
      encoding: "utf8",
      stdio: "pipe",
    });
  } catch (error) {
    status = error.status ?? 1;
    output = (error.stdout || "") + (error.stderr || "");
  }
  return fs
    .writeFile(log, output || "")
    .then(() => ({ command, args, status, log }));
}
for (const name of await fs.readdir(iteration)) {
  if (!/^eval-[23]-/.test(name)) {
    continue;
  }
  for (const config of await fs.readdir(path.join(iteration, name))) {
    const directory = path.join(iteration, name, config);
    if (!(await fs.stat(directory)).isDirectory()) {
      continue;
    }
    for (const repetition of await fs.readdir(directory)) {
      if (!repetition.startsWith("run-")) {
        continue;
      }
      const root = path.join(directory, repetition),
        id = path.relative(iteration, root);
      if (name.startsWith("eval-2-")) {
        const calls = (
          await fs.readFile(path.join(root, "calls.jsonl"), "utf8")
        )
          .trim()
          .split("\n")
          .map(JSON.parse);
        replays.push({
          id,
          componentUuid: models.identities.mutating,
          elementUuid: models.identities.editCard,
          operations: calls
            .filter(
              (c) =>
                c.ok &&
                c.tool === "execute" &&
                c.input.name === "changeElement",
            )
            .map((c) => c.input),
        });
      } else {
        const verification = path.join(root, "verification");
        await fs.mkdir(verification, { recursive: true });
        if (!existsSync(path.join(root, "node_modules"))) {
          await fs.symlink(
            path.join(repo, "platform/wab/node_modules"),
            path.join(root, "node_modules"),
            "dir",
          );
        }
        await fs.copyFile(
          path.join(repo, "ai/plasmic/evals/Orders.test.tsx"),
          path.join(verification, "Orders.test.tsx"),
        );
        await fs.writeFile(
          path.join(verification, "vitest.config.mjs"),
          "export default {test:{environment:'jsdom',include:['verification/Orders.test.tsx']}};\n",
        );
        const checks = [
          await run(
            path.join(repo, "platform/wab/node_modules/.bin/vitest"),
            ["run", "--config", "verification/vitest.config.mjs"],
            root,
            path.join(verification, "behavior.log"),
          ),
          await run(
            path.join(repo, "platform/wab/node_modules/.bin/tsc"),
            ["--noEmit", "-p", "target-project/tsconfig.json"],
            root,
            path.join(verification, "typecheck.log"),
          ),
        ];
        await fs.writeFile(
          path.join(verification, "results.json"),
          JSON.stringify(checks, null, 2),
        );
        results.push({ id, checks });
      }
    }
  }
}
const replay = path.join(workspace, "replays.json");
await fs.writeFile(replay, JSON.stringify(replays, null, 2));
results.push({
  id: "real-editor-replay",
  checks: [
    await run(
      process.execPath,
      [
        path.join(repo, "scripts/prepare-plasmic-evals.mjs"),
        "--output",
        path.join(workspace, "replay-output"),
        "--replay",
        replay,
      ],
      repo,
      path.join(workspace, "replay-check.log"),
    ),
  ],
});
await fs.writeFile(
  path.join(workspace, "artifact-verification.json"),
  JSON.stringify(results, null, 2),
);
console.log(
  JSON.stringify(
    results.map((r) => ({ id: r.id, statuses: r.checks.map((c) => c.status) })),
    null,
    2,
  ),
);
if (results.some((r) => r.checks.some((c) => c.status !== 0))) {
  process.exitCode = 1;
}
