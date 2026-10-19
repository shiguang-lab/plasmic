const { spawn, execFileSync } = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");
const root = path.resolve(__dirname, "../../../..");
const output = process.env.PLASMIC_PROBE_FIXTURES || "/tmp/plasmic-cover-probe";

async function run(script, file = path.join(__dirname, `${script}.cjs`)) {
  const log = await fs.open(path.join(output, `${script}.log`), "w");
  try {
    return await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [file], { stdio: ["ignore", log.fd, log.fd] });
      child.on("error", reject);
      child.on("exit", (code, signal) => resolve({ script, exitCode: code, signal }));
    });
  } finally { await log.close(); }
}
async function waitForServer(url, child) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error(`Probe server exited: ${child.exitCode}`);
    try { if ((await fetch(url)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Probe server not ready: ${url}`);
}
(async () => {
  const { sourceIdentity, readStudioBuild, hashFiles } = await import(path.join(root, "scripts/build-identity.mjs"));
  const build = await readStudioBuild(path.join(root, "platform/wab/build"), root);
  const renderer = process.env.PLASMIC_PROBE_RENDERER || path.join(root, "desktop/renderer");
  const { verifyHydrationAssets } = await import(path.join(root, "scripts/build-html-hydrate.mjs"));
  await verifyHydrationAssets(root, renderer);
  const assets = JSON.parse(await fs.readFile(path.join(renderer, "desktop-assets.json"), "utf8"));
  const bundledBuild = JSON.parse(await fs.readFile(path.join(renderer, "studio-build.json"), "utf8"));
  if (assets.build.sourceHash !== build.sourceHash || bundledBuild.sourceHash !== build.sourceHash || bundledBuild.artifactHash !== build.artifactHash) throw new Error("Probe must use the accepted Studio/Desktop build");
  if (await hashFiles(renderer, ["."], ["desktop-assets.json"]) !== assets.build.rendererHash) throw new Error("Desktop renderer bytes do not match the manifest");
  const hostDirectory = path.join(root, "platform/wab/build/static/sub/build");
  const hostMapName = (await fs.readdir(hostDirectory)).find((name) => name.endsWith(".map"));
  const hostMap = JSON.parse(await fs.readFile(path.join(hostDirectory, hostMapName), "utf8"));
  const hostIndex = hostMap.sources.findIndex((name) => name.endsWith("/packages/host/src/canvas-host.tsx"));
  if (hostIndex < 0 || hostMap.sourcesContent[hostIndex] !== await fs.readFile(path.join(root, "packages/host/src/canvas-host.tsx"), "utf8")) throw new Error("Built-in Host does not contain the current local SDK source");
  for (const folder of ["sub", "live-frame"]) {
    const directory = path.join(renderer, "static", folder, "build");
    const runtime = await fs.readFile(path.join(directory, `client.${build.sourceHash.slice(0, 6)}.js`), "utf8");
    if (runtime !== await fs.readFile(path.join(root, "platform/wab/build/static", folder, "build", `client.${build.sourceHash.slice(0, 6)}.js`), "utf8")) throw new Error(`Studio/Desktop ${folder} bytes differ`);
    if (/refreshXModules|__GetlibsReadyResolver|js\/getlibs\.js/.test(runtime)) throw new Error(`Legacy Preview remains in compiled ${folder}`);
    if (folder === "live-frame" && !runtime.includes("__plasmicLive")) throw new Error("Missing new Preview runtime");
  }
  const env = { ...process.env, NODE_ENV: "production", PLASMIC_SELF_HOSTED: "1", PLASMIC_COMMIT: build.sourceHash };
  const wab = path.join(root, "platform/wab");
  execFileSync(process.execPath, [path.join(wab, "node_modules/typescript/bin/tsc"), "--noEmit", "--project", "tools/dashboard-preview-probe/tsconfig.json"], { cwd: wab, env, stdio: "inherit" });
  execFileSync(process.execPath, [path.join(wab, "node_modules/@rsbuild/core/bin/rsbuild.js"), "build", "--config", "tools/dashboard-preview-probe/rsbuild.config.ts"], { cwd: wab, env: { ...env, STATIC_URL: "http://127.0.0.1:3217" }, stdio: "inherit" });
  execFileSync(process.execPath, [path.join(wab, "node_modules/@rsbuild/core/bin/rsbuild.js"), "build", "--config", "tools/dashboard-preview-probe/production.rsbuild.config.ts"], { cwd: wab, env: { ...env, STATIC_URL: "http://127.0.0.1:3218" }, stdio: "inherit" });
  const esbuild = require(path.join(wab, "node_modules/esbuild"));
  await esbuild.build({ absWorkingDir: wab, entryPoints: ["tools/dashboard-preview-probe/fidelity.tsx"], bundle: true, minify: true, outfile: path.join(output, "fidelity.js") });
  await esbuild.build({ absWorkingDir: wab, entryPoints: ["tools/dashboard-preview-probe/client.tsx"], bundle: true, format: "esm", define: { "process.env": JSON.stringify({ NODE_ENV: "production", COMMITHASH: build.sourceHash.slice(0, 6), PUBLICPATH: "/", STATIC_URL: "http://127.0.0.1:3218" }) }, outfile: path.join(output, "production-client.js") });
  const results = [], servers = [];
  try {
    const probe = spawn(process.execPath, [path.join(__dirname, "serve.cjs")], { stdio: "inherit" }); servers.push(probe);
    await waitForServer("http://127.0.0.1:3217/fixture/manifest.json", probe);
    // canvas-edge owns port 3218; production server starts only after it exits.
    for (const script of ["benchmark", "browsers", "canvas-edge", "shadow-fidelity"]) results.push(await run(script));
    const production = spawn(process.execPath, [path.join(__dirname, "production-serve.cjs")], { stdio: "inherit" }); servers.push(production);
    await waitForServer("http://127.0.0.1:3218/fixture/manifest.json", production);
    for (const script of ["production", "production-memory"]) results.push(await run(script));
    results.push(await run("published-hydration", path.join(__dirname, "../published-hydration/regression.cjs")));
  } finally {
    await Promise.all(servers.map((child) => new Promise((resolve) => { if (child.exitCode !== null) return resolve(); child.once("exit", resolve); child.kill(); })));
  }
  if ((await sourceIdentity(root)).sourceHash !== build.sourceHash) throw new Error("Probe sources changed during regression");
  await fs.writeFile(path.join(output, "regression.json"), JSON.stringify({ build, results, passed: results.length === 7 && results.every((r) => r.exitCode === 0) }, null, 2));
  console.log(JSON.stringify(results));
  if (results.some((r) => r.exitCode !== 0)) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exitCode = 1; });
