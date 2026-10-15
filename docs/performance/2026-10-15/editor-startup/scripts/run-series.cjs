const fs = require("fs"),
  path = require("path"),
  { spawn } = require("child_process");
const base = process.env.PROBE_OUTPUT_ROOT,
  repo = process.env.PROBE_REPO;
const plan = [];
for (const platform of ["desktop", "browser"])
  for (let round = 0; round < 5; round++)
    for (const mode of round % 2 ? ["after", "before"] : ["before", "after"])
      plan.push({ platform, mode, round: round + 1 });
const results = [];
fs.writeFileSync(base + "/series-plan.json", JSON.stringify(plan, null, 2));
(async () => {
  for (const item of plan) {
    const { platform, mode, round } = item;
    const runId = `ab-v1-${platform}-${mode}-${round}`;
    const env = {
      ...process.env,
      PROBE_MODE: mode,
      PROBE_RUN: runId,
      PROBE_GATEWAY_PORT: mode === "before" ? "4400" : "4401",
      PROBE_DESKTOP_ROOT: base + "/" + mode + "/desktop",
      PROBE_ASSETS:
        base + "/" + mode + "/" + (mode === "after" ? "native-build" : "build"),
    };
    const command =
      platform === "desktop"
        ? repo + "/desktop/node_modules/.bin/electron"
        : process.execPath;
    const args = [path.join(__dirname, platform + "-probe.cjs")];
    console.log("START", runId, new Date().toISOString());
    const log = fs.openSync(base + "/" + runId + ".log", "w");
    const code = await new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd: repo,
        env,
        stdio: ["ignore", log, log],
      });
      child.once("error", reject);
      child.once("exit", resolve);
    });
    fs.closeSync(log);
    if (code !== 0) throw Error(runId + " exited " + code);
    const r = JSON.parse(fs.readFileSync(base + "/" + runId + "/report.json"));
    if (r.status !== "PASS") throw Error(runId + " " + r.status);
    if (!r.proxyRequests.length) throw Error("Uncontrolled route");
    fs.rmSync(path.join(base, runId, "profile"), {
      recursive: true,
      force: true,
    });
    results.push({
      ...item,
      runId,
      samples: r.samples.map((s) => ({
        phase: s.phase,
        visibleCanvasMs: s.visibleCanvasMs,
        editableMs: s.editableMs,
        revision: s.revision,
      })),
    });
    fs.writeFileSync(
      base + "/series-results.json",
      JSON.stringify(results, null, 2),
    );
    console.log("DONE", runId, JSON.stringify(results.at(-1).samples));
  }
})().catch((e) => {
  console.error(e.stack);
  process.exitCode = 1;
});
