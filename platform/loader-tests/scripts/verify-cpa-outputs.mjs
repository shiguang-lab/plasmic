import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fixtureProjectId, startConsumerFixture } from "./consumer-fixture.mjs";

const repository = fileURLToPath(new URL("../../../", import.meta.url));
const source = process.env.CPA_TEST_SOURCE
  ? path.resolve(process.env.CPA_TEST_SOURCE)
  : path.join(repository, "packages/create-plasmic-app/cpa-out");
const scope = process.env.CPA_TEST_SOURCE
  ? "Fresh CPA scaffolds, strict SDK installs and production builds"
  : "Existing maintained CPA output fixtures, fresh strict SDK installs and production builds";
const output = path.resolve(process.env.CPA_TEST_OUTPUT ?? "");
assert(process.env.CPA_TEST_OUTPUT && !output.startsWith(repository), "Use an independent CPA_TEST_OUTPUT outside the repository");
const userconfig = process.env.CPA_TEST_USERCONFIG;
assert(userconfig, "Set CPA_TEST_USERCONFIG to the isolated SDK registry configuration");
const npmrc = await readFile(userconfig, "utf8");
assert(/@plasmicapp:registry=http:\/\/127\.0\.0\.1:\d+/.test(npmrc), "SDKs must come from the isolated loopback registry");
await mkdir(output, { recursive: true, mode: 0o700 });
await writeFile(path.join(output, ".cpa-test-owned"), "Generated consumer verification artifacts\n");
const require = createRequire(path.join(repository, "platform/wab/package.json"));
const { chromium } = require("playwright");
const api = await startConsumerFixture();
const requested = process.env.CPA_TEST_CASES?.split(",");
const names = (await readdir(source, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).filter((name) => !requested || requested.includes(name));
assert(names.length > 0 && names.every((name) => /^[a-z0-9-]+$/.test(name)), "Select existing CPA output fixtures");
const results = [];
const env = { ...process.env, NPM_CONFIG_USERCONFIG: userconfig, NEXT_TELEMETRY_DISABLED: "1", CI: "1" };

async function run(command, args, cwd, logName) {
  const log = createWriteStream(path.join(output, logName));
  const child = spawn(command, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.pipe(log, { end: false });
  child.stderr.pipe(log, { end: false });
  const code = await new Promise((resolve, reject) => { child.once("error", reject); child.once("close", resolve); });
  await new Promise((resolve) => log.end(resolve));
  assert.equal(code, 0, `${path.basename(cwd)}: ${command} ${args.join(" ")} failed; see ${logName}`);
}

async function freePort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function configureLoader(directory, appRouter) {
  const file = (await readdir(directory)).find((name) => /^plasmic-init\.(ts|tsx|js|jsx)$/.test(name));
  assert(file, "Loader fixture needs its generated init module");
  const target = path.join(directory, file);
  const text = await readFile(target, "utf8");
  const pattern = /projects:\s*\[[\s\S]*?\]/;
  assert(pattern.test(text), "Expected generated projects configuration");
  const configured = text.replace(pattern, `host: ${JSON.stringify(api.origin)}, projects: [{id:${JSON.stringify(fixtureProjectId)},token:"fixture-token"}]`);
  const registration = appRouter ? `
    import {cache as fixtureCache} from "react";
    PLASMIC.registerFunction(fixtureCache(async () => ({
      zero:0,disabled:false,empty:"",source:"native-server-queries",requestId:Math.random().toString(36),
    })), {name:"getData",namespace:"fixture",params:[]});
  ` : "";
  await writeFile(target, configured + registration);
}

async function verify(name) {
  const directory = path.join(output, name);
  let child;
  let log;
  let browser;
  let page;
  const errors = [];
  const result = { name, sourceFixture: path.relative(repository, path.join(source, name)), status: "failed" };
  try {
    await rm(directory, { recursive: true, force: true });
    await cp(path.join(source, name), directory, {
      recursive: true,
      filter: (file) => !["node_modules", ".next", "dist", "build", ".git", "pnpm-lock.yaml", "package-lock.json", "yarn.lock"].includes(path.basename(file)),
    });
    const manifestFile = path.join(directory, "package.json");
    const manifest = JSON.parse(await readFile(manifestFile, "utf8"));
    manifest.packageManager = "pnpm@11.10.0";
    if (manifest.pnpm?.onlyBuiltDependencies) {
      delete manifest.pnpm.onlyBuiltDependencies;
    }
    await writeFile(manifestFile, JSON.stringify(manifest, null, 2) + "\n");
    await writeFile(path.join(directory, ".npmrc"), npmrc, { mode: 0o600 });
    await writeFile(path.join(directory, "pnpm-workspace.yaml"), "packages: []\nminimumReleaseAge: 0\nstrictPeerDependencies: true\nallowBuilds:\n  esbuild: true\n  sharp: true\n  unrs-resolver: true\n");
    const loader = name.includes("-loader-");
    const next = name.startsWith("nextjs-");
    const appRouter = name.startsWith("nextjs-app-");
    if (loader) {await configureLoader(directory, appRouter);}
    await run("pnpm", ["install", "--strict-peer-dependencies"], directory, `${name}-install.log`);
    await run("pnpm", ["--config.verify-deps-before-run=error", "build"], directory, `${name}-build.log`);
    const port = await freePort();
    const args = next
      ? ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", String(port)]
      : ["node_modules/vite/bin/vite.js", "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"];
    log = createWriteStream(path.join(output, `${name}-server.log`));
    child = spawn("node", args, { cwd: directory, env, detached: true, stdio: ["ignore", "pipe", "pipe"] });
    child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false });
    const origin = `http://127.0.0.1:${port}`;
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try { ready = (await fetch(origin, { signal: AbortSignal.timeout(1000) })).ok; } catch {}
      if (ready || child.exitCode !== null) {break;}
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert(ready, "Production consumer must start");
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") {errors.push(message.text());} });
    await page.route("https://docs.plasmic.app/**", (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html>Host documentation fixture" }));
    await page.goto(origin);
    if (loader) {
      await page.getByRole("heading", { name: "Fixture Home" }).waitFor();
      await page.waitForFunction(() => document.querySelector('[aria-label="Fixture data"]')?.textContent.startsWith("{"));
      const data = JSON.parse(await page.getByLabel("Fixture data").textContent());
      assert.equal(data.zero, 0); assert.equal(data.disabled, false); assert.equal(data.empty, "");
      assert.equal(await page.evaluate(() => window.cpaQueryCalls || 0), 0, "Prefetched queries must not refetch on hydration");
      assert.equal(await page.locator(".fixture-title").evaluate((element) => getComputedStyle(element).color), "rgb(10, 20, 30)");
      if (appRouter) {
        assert.equal(data.source, "native-server-queries");
        assert.equal(await page.locator('meta[name="description"]').getAttribute("content"), data.requestId, "Native React.cache must share data between RSC metadata and page execution");
      }
      await page.getByRole("button", { name: "Count 0" }).click();
      await page.getByRole("button", { name: "Count 1" }).click();
      await page.getByRole("button", { name: "Count 2" }).waitFor();
    } else {
      await page.getByRole("heading", { name: /^(create-plasmic-app|cpa)$/ }).waitFor();
      if (next || name.startsWith("tanstack-")) {
        await page.goto(`${origin}/dynamic/react19-consumer`);
        await page.waitForFunction(() => document.body.innerText.includes("react19-consumer"));
        const hash = createHash("sha256").update("react19-consumer").digest("hex").match(/../g).join("-");
        await page.getByText(`SHA-256(react19-consumer): ${hash}`, { exact: true }).waitFor();
        await page.getByText("Random Dynamic Page", { exact: true }).click();
        await page.waitForURL((url) => /^\/dynamic\/[^/]+\/?$/.test(url.pathname) && !url.pathname.includes("react19-consumer"));
        const slug = new URL(page.url()).pathname.split("/")[2];
        await page.waitForFunction((value) => document.body.innerText.includes(value), slug);
        await page.goBack();
        await page.waitForFunction(() => document.body.innerText.includes("react19-consumer"));
        await page.goBack();
      }
    }
    if (next) {
      await page.goto(`${origin}/plasmic-host`);
      await page.waitForFunction(() => window.__Sub?.React);
      result.browserReact = await page.evaluate(() => window.__Sub.React.version);
      const consumerRequire = createRequire(path.join(directory, "package.json"));
      const expectedReact = appRouter
        ? consumerRequire("next/dist/compiled/react").version
        : consumerRequire("react").version;
      assert.equal(result.browserReact, expectedReact, "Use the framework's official React runtime");
      assert.equal(await page.evaluate(() => typeof window.__Sub.PlasmicQuery.usePlasmicPrepass), "function");
    }
    assert.deepEqual(errors, [], "Production consumer must not emit browser or hydration errors");
    const appRequire = createRequire(path.join(directory, "package.json"));
    assert.equal(appRequire("react").version, "19.3.1");
    const runtimeRequire = loader
      ? createRequire(appRequire.resolve(next ? "@plasmicapp/loader-nextjs" : "@plasmicapp/loader-react"))
      : appRequire;
    const host = JSON.parse(await readFile(runtimeRequire.resolve("@plasmicapp/host/package.json"), "utf8"));
    assert.equal(host.version, "3.0.0", "Consumer must use the newly packed Host");
    result.status = "passed";
    result.host = host.version;
    result.lockfileSha256 = createHash("sha256").update(await readFile(path.join(directory, "pnpm-lock.yaml"))).digest("hex");
  } catch (error) {
    result.error = String(error);
    result.browserErrors = errors;
    if (page) {await writeFile(path.join(output, `${name}-page.html`), await page.content());}
  } finally {
    await browser?.close();
    if (child && child.exitCode === null) {
      process.kill(-child.pid, "SIGTERM");
      await new Promise((resolve) => child.once("close", resolve));
    }
    if (log) {await new Promise((resolve) => log.end(resolve));}
    await writeFile(path.join(output, `${name}-result.json`), JSON.stringify(result, null, 2) + "\n");
    results.push(result);
    console.log(`${result.status.toUpperCase()}: ${name}${result.error ? `: ${result.error}` : ""}`);
  }
}

try {
  let next = 0;
  const worker = async () => { while (next < names.length) {await verify(names[next++]);} };
  await worker();
  await writeFile(path.join(output, "results.json"), JSON.stringify({ scope, results, fixtureRequests: api.requests }, null, 2) + "\n");
  if (results.some((result) => result.status !== "passed")) {process.exitCode = 1;}
} finally {
  await api.close();
}
