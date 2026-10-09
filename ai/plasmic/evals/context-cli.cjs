const fs = require("node:fs"),
  cp = require("node:child_process");
const [run, ...args] = process.argv.slice(2),
  env = JSON.parse(fs.readFileSync(run + "/environment.json", "utf8"));
const result = cp.spawnSync(
  process.execPath,
  [env.cliPath, ...args, "--feed", env.feed, "--home", env.cache],
  { encoding: "utf8" },
);
fs.appendFileSync(
  run + "/context-calls.jsonl",
  JSON.stringify({
    args,
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  }) + "\n",
);
process.stdout.write(result.stdout || "");
process.stderr.write(result.stderr || "");
process.exitCode = result.status ?? 1;
