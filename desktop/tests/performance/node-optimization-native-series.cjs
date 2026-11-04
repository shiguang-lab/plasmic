const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
(async () => {
  const [baseline, output] = process.argv.slice(2); assert.ok(baseline && output);
  const report = { order: process.argv[4] === "after-only" ? ["after"] : ["before", "after", "after", "before"], runs: [] };
  await fs.mkdir(path.resolve(output), { recursive: true });
  for (const [index, variant] of report.order.entries()) {
    const profile = await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-optimization-native-"));
    const file = path.resolve(output, `native-${index}-${variant}.json`);
    try {
      const desktop = variant === "before" ? path.resolve(baseline) : path.resolve(__dirname, "../..");
      const hasBackground = await fs.access(path.join(desktop, "src/background-worker.cjs")).then(() => true, () => false);
      const stage = path.join(profile, "stage"), archive = path.join(profile, "fixture.asar");
      await fs.mkdir(path.join(stage, "src"), { recursive: true });
      for (const name of ["raster-vector.cjs", "vector.cjs", ...(hasBackground ? ["background-worker.cjs", "background-task.cjs"] : [])]) {
        await fs.copyFile(path.join(desktop, "src", name), path.join(stage, "src", name));
      }
      for (const name of ["paper", "pngjs", "imagetracerjs"]) {
        await fs.cp(path.resolve(__dirname, "../../node_modules", name), path.join(stage, "node_modules", name), { recursive: true });
      }
      await (await import("@electron/asar")).createPackage(stage, archive);
      await fs.rm(stage, { recursive: true });
      await new Promise((resolve, reject) => {
        const child = spawn(require("electron"), [path.join(__dirname, "node-optimization-native.cjs"), variant,
          desktop, file],
        { stdio: "inherit", env: { ...process.env, PLASMIC_BACKGROUND_PROFILE: profile, PLASMIC_BACKGROUND_ARCHIVE: archive } });
        const timeout = setTimeout(() => child.kill("SIGKILL"), 120000);
        child.on("error", reject); child.on("exit", code => { clearTimeout(timeout); code === 0 ? resolve() : reject(Error("Native case exited " + code)); });
      });
      report.runs.push(JSON.parse(await fs.readFile(file, "utf8")));
      const expected = report.runs[0].graphSamples?.map(sample => sample.digest);
      if (expected) for (const run of report.runs) assert.deepEqual(run.graphSamples.map(sample => sample.digest), expected, "Complete graph outputs must remain identical");
      await fs.writeFile(path.resolve(output, "native-series.json"), JSON.stringify(report, null, 2));
    } finally { await fs.rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
