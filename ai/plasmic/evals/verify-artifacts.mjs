import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
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
const iteration = path.join(workspace, "iteration-1");
const results = [];
const relative = (base, file) => path.relative(base, file).split(path.sep).join("/");
const replayVerifiers = [
  "ai/plasmic/evals/verify-artifacts.mjs",
  "ai/plasmic/evals/replay-edits.test.ts",
  "scripts/prepare-plasmic-evals.mjs",
];
const codegenVerifiers = ["ai/plasmic/evals/verify-artifacts.mjs", "ai/plasmic/evals/eval_evidence.py", "ai/plasmic/evals/Orders.test.tsx"];
function codegenInputs(root) {
  return JSON.parse(execFileSync("python3", [path.join(repo, "ai/plasmic/evals/eval_evidence.py"), "codegen-inputs", workspace, root], { encoding: "utf8" }));
}
async function hashes(base, files) {
  return Object.fromEntries(await Promise.all(files.map(async (file) => [
    file, createHash("sha256").update(await fs.readFile(path.join(base, file))).digest("hex"),
  ])));
}
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
        id = relative(iteration, root);
      if (name.startsWith("eval-2-")) {
        const verification = path.join(root, "verification");
        await fs.mkdir(verification, { recursive: true });
        const inputFiles = ["model-fixtures.json", relative(workspace, path.join(root, "calls.jsonl"))];
        const inputs = await hashes(workspace, inputFiles);
        const verifiers = await hashes(repo, replayVerifiers);
        const models = JSON.parse(await fs.readFile(path.join(workspace, "model-fixtures.json"), "utf8"));
        const calls = (
          await fs.readFile(path.join(root, "calls.jsonl"), "utf8")
        )
          .trim()
          .split("\n")
          .map(JSON.parse);
        const replay = {
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
        };
        const replayFile = path.join(verification, "replay.json");
        await fs.writeFile(replayFile, JSON.stringify([replay], null, 2));
        const check = await run(process.execPath, [
          path.join(repo, "scripts/prepare-plasmic-evals.mjs"),
          "--output", path.join(verification, "replay-output"),
          "--replay", replayFile,
        ], repo, path.join(verification, "replay.log"));
        const stable = JSON.stringify(inputs) === JSON.stringify(await hashes(workspace, inputFiles))
          && JSON.stringify(verifiers) === JSON.stringify(await hashes(repo, replayVerifiers));
        const evidence = await hashes(workspace, [
          relative(workspace, replayFile), relative(workspace, check.log),
        ]);
        results.push({ id, kind: "editor-replay", inputs, verifiers, evidence, stable, checks: [check] });
      } else {
        const verification = path.join(root, "verification");
        await fs.mkdir(verification, { recursive: true });
        const inputs = codegenInputs(root);
        const verifiers = await hashes(repo, codegenVerifiers);
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
        await fs.rm(path.join(verification, "behavior-results.json"), { force: true });
        await fs.rm(path.join(verification, "results.json"), { force: true });
        const checks = [
          { kind: "behavior", ...await run(
            path.join(repo, "platform/wab/node_modules/.bin/vitest"),
            ["run", "--config", "verification/vitest.config.mjs", "--reporter=json", "--outputFile=verification/behavior-results.json"],
            root,
            path.join(verification, "behavior.log"),
          ) },
          { kind: "typecheck", ...await run(
            path.join(repo, "platform/wab/node_modules/.bin/tsc"),
            ["--noEmit", "-p", "target-project/tsconfig.json"],
            root,
            path.join(verification, "typecheck.log"),
          ) },
        ];
        const stable = JSON.stringify(inputs) === JSON.stringify(codegenInputs(root))
          && JSON.stringify(verifiers) === JSON.stringify(await hashes(repo, codegenVerifiers));
        const evidence = {};
        for (const name of ["Orders.test.tsx", "vitest.config.mjs", "behavior.log", "typecheck.log", "behavior-results.json"]) {
          const file = relative(workspace, path.join(verification, name));
          evidence[file] = existsSync(path.join(workspace, file)) ? (await hashes(workspace, [file]))[file] : null;
        }
        results.push({ id, kind: "codegen", inputs, verifiers, evidence, stable, checks });
      }
    }
  }
}
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
if (results.some((r) => r.stable === false || r.checks.some((c) => c.status !== 0))) {
  process.exitCode = 1;
}
