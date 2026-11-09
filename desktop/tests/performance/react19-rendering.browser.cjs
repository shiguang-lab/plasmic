// node --test desktop/tests/performance/react19-rendering.browser.cjs
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const { createRequire } = require("node:module");
const os = require("node:os");
const path = require("node:path");
const { before, after, test } = require("node:test");
const vm = require("node:vm");
const { chromium } = require("playwright");
const repo = path.resolve(__dirname, "../../..");
const out = fs.mkdtempSync(path.join(os.tmpdir(), "plasmic-react19-fixtures-"));
let browser;
before(async () => { browser = await chromium.launch({ headless: true }); });
after(async () => { await browser?.close(); fs.rmSync(out, { recursive: true, force: true }); });

test("Skeleton reuses its root across updates and releases it on unmount", async () => {
  const file = path.join(__dirname, "skeleton-performance.cjs");
  const nativeRequire = createRequire(file);
  const electron = { app: { setPath() {}, on() {}, whenReady: () => new Promise(() => {}) } };
  const fixtureRequire = (id) => id === nativeRequire.resolve("electron") ? electron : nativeRequire(id);
  fixtureRequire.resolve = nativeRequire.resolve;
  const directory = path.join(out, "skeleton");
  vm.runInNewContext(fs.readFileSync(file, "utf8"), {
    require: fixtureRequire, __dirname, process: { argv: ["node", file, directory] },
  });
  const page = await browser.newPage();
  try {
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`file://${directory}/skeleton.html`);
    assert.equal(await page.locator(".ant-skeleton").count(), 12);
    await page.evaluate(() => window.renderFixture(1));
    assert.equal(await page.locator(".ant-skeleton-active").count(), 1);
    await page.evaluate(() => window.renderFixture(0));
    assert.equal(await page.locator(".ant-skeleton-active").count(), 0);
    await page.evaluate(() => window.unmountFixture());
    assert.equal(await page.locator("#root > *").count(), 0);
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

test("retention fixture mounts real editors, preserves the active editor and cleans up", async () => {
  const directory = path.join(out, "retention");
  execFileSync(process.execPath, [path.join(__dirname, "retention-build.cjs"), "current", directory], { cwd: repo, stdio: "pipe" });
  const page = await browser.newPage();
  try {
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`file://${directory}/index.html`);
    for (let cycle = 0; cycle < 2; cycle++) {
      await page.evaluate(() => window.__retention.open());
      await page.waitForFunction(() => window.__retention.stats().models.length === 10);
      const opened = await page.evaluate(() => window.__retention.stats());
      assert.equal(opened.envIds, 100);
      const edited = await page.evaluate(() => window.__retention.closeOneAndEdit());
      assert.deepEqual(edited, { models: 5, extraLibs: 3, undo: true });
      await page.evaluate(() => window.__retention.close());
      const closed = await page.evaluate(() => window.__retention.stats());
      assert.equal(closed.models.length, 0);
      assert.equal(closed.deepStoreSize, 0);
      assert.equal(closed.deletedArgumentCount, 0);
      assert.equal(closed.envIds, 0);
      assert.equal(closed.fullKeys, 0);
    }
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});
