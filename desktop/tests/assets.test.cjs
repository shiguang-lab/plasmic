const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { createAssetHandler } = require("../src/asset-handler.cjs");
const config = require("../desktop.config.json");
let root, handler;
const remote = [];
before(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "desktop-assets-test-"));
  await fs.mkdir(path.join(root, "static"));
  await fs.writeFile(
    path.join(root, "index.html"),
    "<html>local studio</html>",
  );
  await fs.writeFile(
    path.join(root, "static", "antd6.js"),
    "window.antd6 = true;",
  );
  await fs.writeFile(
    path.join(root, "editor.worker.js"),
    "self.onmessage = () => {};",
  );
  handler = createAssetHandler({
    root,
    ...config,
    remoteFetch: async (request) => {
      remote.push({
        url: request.url,
        method: request.method,
        headers: request.headers,
        body: await request.text(),
      });
      return new Response('{"status":true}', {
        headers: { "Content-Type": "application/json" },
      });
    },
  });
});
after(() => fs.rm(root, { recursive: true, force: true }));
test("Studio navigation and refresh use local index without a network fallback", async () => {
  const count = remote.length;
  for (const pathname of [
    "/",
    "/login?continueTo=%2F",
    "/projects/project-123",
  ]) {
    const response = await handler(new Request(config.studioOrigin + pathname));
    assert.equal(response.headers.get("X-Plasmic-Desktop-Asset"), "local");
    assert.match(await response.text(), /local studio/);
  }
  assert.equal(remote.length, count);
});
test("update UI is injected and served locally without fetching NAS static assets", async () => {
  const page = path.join(root, "updates-page");
  await fs.mkdir(page);
  await fs.writeFile(
    path.join(page, "index.html"),
    "<html><head></head><body></body></html>",
  );
  await fs.mkdir(path.join(page, "static"));
  await fs.writeFile(
    path.join(page, "static/host.html"),
    "<html><head></head><body>canvas</body></html>",
  );
  const rendererI18nPath = path.join(page, "renderer-i18n.js");
  await fs.writeFile(rendererI18nPath, "window.desktopUiI18n = {};");
  const updateUiPath = path.join(page, "update-ui.js");
  await fs.writeFile(updateUiPath, "window.updateUiLoaded = true;");
  const updateDialogPath = path.join(page, "update-dialog.js");
  await fs.writeFile(updateDialogPath, "window.updateDialogLoaded = true;");
  const authPagePath = path.join(page, "login.html");
  await fs.writeFile(
    authPagePath,
    "<html><head></head><body>Sign in</body></html>",
  );
  const pageHandler = createAssetHandler({
    root: page,
    ...config,
    updateUiPath,
    updateDialogPath,
    rendererI18nPath,
    authPagePath,
    remoteFetch: () => {
      throw new Error("Unexpected network request");
    },
  });
  const response = await pageHandler(
    new Request(config.studioOrigin + "/projects/123"),
  );
  const studioHtml = await response.text();
  assert.match(
    studioHtml,
    /script defer src="https:\/\/studio.plasmic.shiguanglab.com\/static\/desktop\/update-ui.js"/,
  );
  assert.match(studioHtml, /static\/desktop\/update-dialog.js/);
  assert.equal((studioHtml.match(/renderer-i18n.js/g) || []).length, 1);
  assert.ok(
    studioHtml.indexOf("renderer-i18n.js") <
      studioHtml.indexOf("update-dialog.js"),
  );
  const login = await pageHandler(
    new Request(config.studioOrigin + "/desktop/unified-login"),
  );
  assert.match(await login.text(), /static\/desktop\/update-dialog.js/);
  const canvas = await pageHandler(
    new Request(config.canvasOrigin + "/static/host.html"),
  );
  const canvasHtml = await canvas.text();
  assert.match(canvasHtml, /static\/desktop\/update-ui.js/);
  assert.equal((canvasHtml.match(/renderer-i18n.js/g) || []).length, 1);
  assert.doesNotMatch(
    canvasHtml,
    /update-dialog.js/,
    "Only the trusted main document owns the dialog",
  );
  assert.match(
    canvasHtml,
    /data-studio-origin="https:\/\/studio.plasmic.shiguanglab.com"/,
  );
  assert.match(
    canvasHtml,
    /data-canvas-origin="https:\/\/canvas.plasmic.shiguanglab.com"/,
  );
  const script = await pageHandler(
    new Request(config.studioOrigin + "/static/desktop/update-ui.js"),
  );
  assert.match(script.headers.get("Content-Type"), /javascript/);
  assert.equal(await script.text(), "window.updateUiLoaded = true;");
  const localeScript = await pageHandler(
    new Request(config.studioOrigin + "/static/desktop/renderer-i18n.js"),
  );
  assert.equal(await localeScript.text(), "window.desktopUiI18n = {};");
  const dialogScript = await pageHandler(
    new Request(config.studioOrigin + "/static/desktop/update-dialog.js"),
  );
  assert.equal(await dialogScript.text(), "window.updateDialogLoaded = true;");
});
test("Canvas scripts and Monaco workers are local with executable MIME types", async () => {
  for (const url of [
    config.canvasOrigin + "/static/antd6.js?v=1",
    config.studioOrigin + "/editor.worker.js",
  ]) {
    const response = await handler(new Request(url));
    assert.equal(response.status, 200);
    assert.match(response.headers.get("Content-Type"), /javascript/);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
  }
});
test("Missing assets return 404 and never fetch remotely", async () => {
  const count = remote.length;
  for (const pathname of ["/static/missing.js", "/missing.worker.js"]) {
    assert.equal(
      (await handler(new Request(config.studioOrigin + pathname))).status,
      404,
    );
  }
  assert.equal(
    (await handler(new Request(config.canvasOrigin + "/projects/123"))).status,
    404,
  );
  assert.equal(remote.length, count);
});
test("API requests preserve POST body, origin and shared-cookie headers", async () => {
  const response = await handler(
    new Request(config.studioOrigin + "/api/v1/settings/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: config.studioOrigin,
        Cookie: "__Secure-sg_session=test",
      },
      body: '{"extraData":"{}"}',
    }),
  );
  assert.equal(response.status, 200);
  const request = remote.at(-1);
  assert.equal(request.method, "POST");
  assert.equal(request.headers.get("Origin"), config.studioOrigin);
  assert.equal(request.headers.get("Cookie"), "__Secure-sg_session=test");
  assert.equal(JSON.parse(request.body).extraData, "{}");
});
test("User uploads, health and external resources remain remote", async () => {
  for (const url of [
    config.studioOrigin + "/assets/abcd.png",
    config.studioOrigin + "/healthcheck",
    "https://example.com/image.png",
  ]) {
    await handler(new Request(url));
    assert.equal(remote.at(-1).url, url);
  }
});
test("Encoded traversal and malformed paths cannot read outside renderer", async () => {
  for (const pathname of [
    "/%2e%2e%2fpackage.json",
    "/%5c..%5cpackage.json",
    "/%00",
    "/%zz",
  ]) {
    assert.ok(
      [400, 403].includes(
        (await handler(new Request(config.studioOrigin + pathname))).status,
      ),
    );
  }
});
test("HEAD returns content metadata without a body; static writes are rejected", async () => {
  const response = await handler(
    new Request(config.canvasOrigin + "/static/antd6.js", { method: "HEAD" }),
  );
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "");
  assert.ok(Number(response.headers.get("Content-Length")) > 0);
  assert.equal(
    (
      await handler(
        new Request(config.studioOrigin + "/static/antd6.js", {
          method: "POST",
        }),
      )
    ).status,
    405,
  );
});

test("The packaged editor bridge is injected and served locally, including HEAD metadata", async () => {
  const index = path.join(root, "index.html");
  const original = await fs.readFile(index);
  await fs.writeFile(
    index,
    "<html><head></head><body>local studio</body></html>",
  );
  const bridgePath = path.resolve(__dirname, "../src/editor-bridge.js");
  const bridged = createAssetHandler({
    root,
    ...config,
    bridgePath,
    remoteFetch: () => assert.fail("Bridge must be local"),
  });
  try {
    const response = await bridged(
      new Request(config.studioOrigin + "/projects/test"),
    );
    const html = await response.text();
    assert.match(
      html,
      /<script defer src="https:\/\/studio.plasmic.shiguanglab.com\/static\/desktop\/editor-bridge.js"><\/script><\/head>/,
    );
    const head = await bridged(
      new Request(config.studioOrigin + "/", { method: "HEAD" }),
    );
    assert.equal(
      Number(head.headers.get("Content-Length")),
      Buffer.byteLength(html),
    );
    assert.equal(await head.text(), "");
    const bridge = await bridged(
      new Request(config.studioOrigin + "/static/desktop/editor-bridge.js"),
    );
    assert.equal(bridge.headers.get("X-Plasmic-Desktop-Asset"), "local");
    assert.match(await bridge.text(), /PLASMIC_AI_TOOLS/);
  } finally {
    await fs.writeFile(index, original);
  }
});

test("Project requests reuse bundled Google font faces; other families remain remote", async () => {
  let fetched = 0;
  const bundledFontCss =
    "@font-face {font-family: 'Roboto'; font-weight: 400; src: url(https://studio.plasmic.shiguanglab.com/static/desktop-fonts/roboto.ttf);} @font-face {font-family: 'Inter'; font-weight: 400; src: url(https://studio.plasmic.shiguanglab.com/static/desktop-fonts/inter.ttf);}";
  const fonts = createAssetHandler({
    root,
    ...config,
    bundledFontCss,
    remoteFetch: () => {
      fetched++;
      return new Response("remote");
    },
  });
  const response = await fonts(
    new Request(
      "https://fonts.googleapis.com/css?family=Roboto:regular,700&subset=latin",
    ),
  );
  assert.equal(response.headers.get("X-Plasmic-Desktop-Asset"), "local");
  assert.match(await response.text(), /roboto.ttf/);
  assert.equal(fetched, 0);
  await fonts(
    new Request("https://fonts.googleapis.com/css2?family=Unbundled+Font"),
  );
  assert.equal(fetched, 1);
});

test("Unified login intermediate page is bundled and never goes to the NAS or SPA", async () => {
  const auth = createAssetHandler({
    root,
    ...config,
    authPagePath: path.resolve(__dirname, "../src/unified-login.html"),
    remoteFetch: () => assert.fail("Login UI must be local"),
  });
  const response = await auth(
    new Request(config.studioOrigin + "/desktop/unified-login"),
  );
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.match(await response.text(), /Open browser/);
});
