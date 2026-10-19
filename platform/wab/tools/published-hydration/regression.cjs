const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { chromium, firefox, webkit } = require("../../node_modules/playwright");
const { PNG } = require("../../../node_modules/.pnpm/playwright-core@1.60.0/node_modules/playwright-core/lib/utilsBundle.js");
const esbuild = require("../../node_modules/esbuild");
const root = path.resolve(__dirname, "../../../..");
const fixtures = process.env.PLASMIC_PROBE_FIXTURES || "/tmp/plasmic-cover-probe";
const output = path.join(fixtures, "published-hydration");

function difference(a, b) {
  const first = PNG.sync.read(a), second = PNG.sync.read(b);
  assert.equal(first.width, second.width); assert.equal(first.height, second.height);
  let changed = 0;
  for (let i = 0; i < first.data.length; i += 4) {
    if ([0, 1, 2].some((channel) => Math.abs(first.data[i + channel] - second.data[i + channel]) > 20)) changed++;
  }
  return 100 * changed / (first.width * first.height);
}

async function browserCases(url) {
  const results = [], failures = [];
  for (const [engineName, engine] of Object.entries({ chromium, firefox, webkit })) {
    const browser = await engine.launch();
    try {
      for (const theme of ["dark", "light"]) {
        let baseline;
        for (const mode of ["baseline", "embedded", "remote", "cached-html"]) {
          const sample = { engine: engineName, theme, mode, passed: false };
          const page = await browser.newPage({ viewport: { width: 1440, height: 720 }, reducedMotion: "reduce" });
          const errors = [], unexpectedRequests = [], failedAssets = [], apiRequests = [];
          page.on("pageerror", (error) => errors.push(error.message));
          page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
          page.on("response", (response) => { if (response.status() >= 400) failedAssets.push(`${response.status()} ${response.url()}`); });
          await page.route("**/*", (route) => {
            const request = route.request();
            if (!request.url().startsWith(url + "/")) { unexpectedRequests.push(request.url()); return route.abort(); }
            if (request.url().includes("/api/v1/loader/code/published")) apiRequests.push(request.url());
            return route.continue();
          });
          try {
            await page.goto(`${url}/published?mode=${mode}&theme=${theme}`);
            await page.waitForFunction(() => document.querySelector("[data-plasmic-hydrated=true]"));
            await page.getByRole("button", { name: "增 加", exact: true }).waitFor();
            await page.waitForFunction(() => document.querySelector("img")?.complete && document.querySelector("img")?.naturalWidth === 32);
            assert.equal(await page.getByTestId("context").textContent(), `shiguang/${theme}`);
            assert.equal(await page.getByTestId("counter").textContent(), "0");
            assert.equal(await page.getByTestId("counter").evaluate((node) => getComputedStyle(node).color), "rgb(99, 91, 255)");
            assert.equal(await page.getByTestId("published-page").getAttribute("data-theme"), theme);
            assert.equal(await page.getByTestId("published-page").evaluate((node) => node === window.__publishedSsr), true, "Hydration must preserve the actual SSR root node");
            const image = await page.screenshot({ animations: "disabled", path: path.join(output, `${engineName}-${theme}-${mode}.png`) });
            if (mode === "baseline") baseline = image;
            else {
              assert.ok(baseline, "A rendered pre-migration baseline is required");
              sample.pixelsOver20Percent = difference(baseline, image);
              await fs.writeFile(path.join(output, `${engineName}-${theme}-${mode}-pixels.json`), JSON.stringify(sample, null, 2));
              assert.ok(sample.pixelsOver20Percent < 1, "Published page must retain the original less-than-1% pixel threshold");
            }
            await page.getByRole("button", { name: "增 加", exact: true }).click();
            assert.equal(await page.getByTestId("counter").textContent(), "1");
            await page.evaluate(() => window.__plasmicHydrater.hydrateAll());
            assert.equal(await page.getByTestId("counter").textContent(), "1", "Repeated hydration must not reset local state");
            await page.getByRole("button", { name: "提 交", exact: true }).click();
            assert.equal(await page.getByRole("alert").textContent(), "请填写目标");
            await page.getByRole("textbox", { name: "目标", exact: true }).fill("营销活动");
            await page.getByRole("button", { name: "提 交", exact: true }).click();
            assert.equal(await page.getByRole("textbox", { name: "目标", exact: true }).isDisabled(), true);
            assert.equal(await page.getByTestId("submit-action").isDisabled(), true);
            await page.getByRole("status").waitFor();
            assert.equal(await page.getByRole("status").textContent(), "已提交：营销活动");
            assert.equal(await page.getByTestId("submit-action").isDisabled(), false);
            assert.equal(await page.getByRole("textbox", { name: "目标", exact: true }).isDisabled(), false);
            await page.getByRole("button", { name: "详 情", exact: true }).click();
            const dialog = page.getByRole("dialog", { name: "发布详情", exact: true });
            await dialog.waitFor();
            const bounds = await dialog.boundingBox();
            assert.ok(bounds && bounds.y >= 0 && bounds.y + bounds.height <= 720);
            await dialog.getByRole("button", { name: "关 闭", exact: true }).click();
            assert.equal(await dialog.count(), 0);
            const link = page.getByRole("link", { name: "查看结果", exact: true });
            assert.equal(await link.getAttribute("target"), null);
            await link.click();
            assert.ok(page.url().endsWith("#result"));
            assert.equal(apiRequests.length, ["remote", "cached-html"].includes(mode) ? 1 : 0);
            assert.ok(apiRequests.every((request) => new URL(request).searchParams.get("projectId") === "published-hydration-regression@1.2.3"));
            assert.deepEqual(unexpectedRequests, []); assert.deepEqual(failedAssets, []); assert.deepEqual(errors, []);
            sample.passed = true;
          } catch (error) {
            sample.error = String(error.stack || error);
            failures.push(`${engineName}/${theme}/${mode}: ${error.message}`);
            await page.screenshot({ path: path.join(output, `${engineName}-${theme}-${mode}-failure.png`) }).catch(() => {});
          } finally {
            Object.assign(sample, { errors, unexpectedRequests, failedAssets, apiRequests });
            results.push(sample);
            await fs.writeFile(path.join(output, "browser-results.json"), JSON.stringify({ results, failures }, null, 2));
            await page.close();
          }
        }
      }
    } finally { await browser.close(); }
  }
  assert.deepEqual(failures, []);
  return results;
}

async function main() {
  process.chdir(path.join(root, "platform/wab"));
  await fs.mkdir(output, { recursive: true });
  const { readStudioBuild, hashFiles } = await import(path.join(root, "scripts/build-identity.mjs"));
  const build = await readStudioBuild(path.join(root, "platform/wab/build"), root);
  const renderer = process.env.PLASMIC_PROBE_RENDERER || path.join(root, "desktop/renderer");
  const assets = JSON.parse(await fs.readFile(path.join(renderer, "desktop-assets.json"), "utf8"));
  assert.equal(assets.build.rendererHash, await hashFiles(renderer, ["."], ["desktop-assets.json"]));
  assert.equal(assets.build.sourceHash, build.sourceHash);
  const { verifyHydrationAssets } = await import(path.join(root, "scripts/build-html-hydrate.mjs"));
  const hydration = await verifyHydrationAssets(root, renderer);
  const baseline = await fs.readFile(path.join(fixtures, "hydration-baseline.js"));
  const baselineManifest = JSON.parse(await fs.readFile(path.join(fixtures, "hydration-baseline.json"), "utf8"));
  assert.equal(createHash("sha256").update(baseline).digest("hex"), baselineManifest.sha256);
  assert.equal(baselineManifest.sdk, "2.0.23");
  assert.equal(baselineManifest.sha256, "53b75d8e09e2fc62db3dcf35d928068098cf92d52e4f0c98ff8be8a9c6a0a053", "The pre-migration visual baseline must remain pinned");
  execFileSync(process.execPath, [path.join(root, "platform/wab/node_modules/typescript/bin/tsc"), "--noEmit", "--project", path.join(__dirname, "tsconfig.json")], { cwd: path.join(root, "platform/wab"), stdio: "inherit" });
  const built = path.join(__dirname, "build");
  await fs.mkdir(built, { recursive: true });
  await esbuild.build({ absWorkingDir: path.join(root, "platform/wab"), entryPoints: [path.join(__dirname, "server.ts")], bundle: true, platform: "node", packages: "external", external: ["typeorm", "typeorm/*", "@plasmicapp/host", "@plasmicapp/host/*"], outfile: path.join(built, "server.cjs") });
  const clientModule = await esbuild.build({ entryPoints: [require.resolve("../../node_modules/react-dom/client")], bundle: true, format: "cjs", platform: "browser", minify: true, external: ["react-dom"], write: false });
  const { startServer } = require(path.join(built, "server.cjs"));
  const server = await startServer({ fixtureSource: path.join(__dirname, "fixture-page.tsx"), directory: path.join(built, "fixture"), baseline: baseline.toString(), reactDomClient: clientModule.outputFiles[0].text });
  try {
    const stable = await fetch(`${server.url}/static/js/loader-hydrate.js`, { redirect: "manual" });
    assert.equal(stable.status, 302);
    assert.equal(stable.headers.get("cache-control"), "max-age=60, s-maxage=60");
    assert.equal(stable.headers.get("location"), `${server.publicUrl}/static/js/${hydration.script}`);
    const versioned = await fetch(stable.headers.get("location"));
    assert.equal(versioned.status, 200);
    assert.equal(versioned.headers.get("cache-control"), "max-age=31536000, s-maxage=31536000");
    assert.deepEqual(Buffer.from(await versioned.arrayBuffer()), await fs.readFile(path.join(root, "platform/loader-html-hydrate/build", hydration.script)));
    assert.equal((await fetch(`${server.url}/static/js/loader-hydrate.deadbeef.js`)).status, 404);
    const ssr = await fetch(`${server.url}/published?mode=ssr&theme=dark`);
    assert.equal(ssr.status, 200);
    const html = await ssr.text();
    await fs.writeFile(path.join(output, "ssr-only.html"), html);
    const { JSDOM } = require("../../node_modules/jsdom");
    const document = new JSDOM(html).window.document;
    assert.equal(document.querySelector("h1")?.textContent, "发布页面验收");
    assert.equal(document.querySelector('[data-testid="context"]')?.textContent, "shiguang/dark");
    assert.equal(document.querySelector("#result")?.textContent, "发布内容保留");
    assert.ok(!html.includes('<script async="" src='), "SSR-only publishing must not add a hydration script");
    const results = await browserCases(server.url);
    assert.ok(server.requests.every((request) => request.method === "GET"));
    assert.ok(server.requests.filter((request) => request.url.includes("/api/v1/loader/code/")).every((request) => new URL(request.url, server.url).searchParams.get("projectId") === "published-hydration-regression@1.2.3"));
    await fs.writeFile(path.join(output, "regression.json"), JSON.stringify({ passed: true, build, hydration, baseline: baselineManifest, scope: "actual genLoaderHtmlBundle, current local SDK and compiled hydration; production bundleModules output for a synthetic published page using the real local AntdButton; historical visual control alone supplies the original react-dom/client module, current modes require the SDK builtin; 3 engines, 2 themes, embedded/remote/cached HTML, SSR-only, pinned URLs/cache, visual fidelity and interactions", results, requests: server.requests }, null, 2));
  } finally { await server.close(); }
}
if (require.main === module) main().catch((error) => { console.error(error); process.exitCode = 1; });
module.exports = { browserCases, difference };
