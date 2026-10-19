const path = require("node:path");
const assert = require("node:assert/strict");
const repo = path.resolve(__dirname, "../../../..");
const { app, session, BrowserWindow } = require("node:module").createRequire(
  path.join(repo, "desktop/package.json"),
)("electron");
const fs = require("node:fs");
const { createAssetHandler } = require(
  path.join(repo, "desktop/src/asset-handler.cjs"),
);
const dir = process.env.PLASMIC_SELECTION_REPORT_DIR;
const projectUrl = process.env.PLASMIC_SELECTION_PROJECT_URL;
const storageState = process.env.PLASMIC_SELECTION_STORAGE_STATE;
assert(
  dir && path.isAbsolute(dir) && projectUrl && storageState,
  "Set PLASMIC_SELECTION_REPORT_DIR, PLASMIC_SELECTION_PROJECT_URL and PLASMIC_SELECTION_STORAGE_STATE",
);
fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
const variant = process.env.PLASMIC_SELECTION_BUILD || "after";
app.setName("Plasmic");
app.setPath("userData", path.join(dir, "profile"));
app.commandLine.appendSwitch(
  "remote-debugging-port",
  process.env.PLASMIC_SELECTION_CDP_PORT || "9339",
);
app.commandLine.appendSwitch("disable-background-timer-throttling");
app.whenReady().then(async () => {
  const ses = session.fromPartition("persist:selection-benchmark");
  const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  if (proxy)
    await ses.setProxy({
      proxyRules: proxy,
      proxyBypassRules: process.env.NO_PROXY || "",
    });
  const files = fs.readdirSync(
    path.join(dir, variant, "static/canvas-packages/build"),
  );
  const libs = Object.fromEntries(
    ["antd6", "overseas", "react-ui"].map((name) => {
      const match = files.filter(
        (file) => file.startsWith(name + "-v2.") && file.endsWith(".js"),
      );
      assert.equal(match.length, 1, "Expected one built " + name + " library");
      return [name, "static/canvas-packages/build/" + match[0]];
    }),
  );
  const remoteFetch = async (req) => {
    const u = new URL(req.url);
    if (
      req.method !== "GET" &&
      req.method !== "HEAD" &&
      (/\/projects\/[^/]+\/revisions\//.test(u.pathname) ||
        ["DELETE", "PATCH", "PUT"].includes(req.method))
    ) {
      console.log("BLOCKED_WRITE", req.method, u.pathname);
      return new Response('{"error":"Isolated selection benchmark"}', {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }
    const headers = new Headers(req.headers);
    if (u.hostname === "shiguanglab.com" || u.hostname.endsWith(".shiguanglab.com")) {
      const cookies = JSON.parse(fs.readFileSync(storageState, "utf8")).cookies;
      headers.set(
        "Cookie",
        cookies
          .filter((c) => u.hostname.endsWith(c.domain.replace(/^\./, "")))
          .map((c) => `${c.name}=${c.value}`)
          .join("; "),
      );
    }
    const cacheDir = path.join(dir, "api-fixtures");
    fs.mkdirSync(cacheDir, { recursive: true });
    const key = require("node:crypto")
      .createHash("sha256")
      .update(req.method + " " + req.url)
      .digest("hex");
    const cacheFile = path.join(cacheDir, key + ".json");
    if (req.method === "GET" && fs.existsSync(cacheFile)) {
      const cached = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
      return new Response(Buffer.from(cached.body, "base64"), {
        status: cached.status,
        headers: cached.headers,
      });
    }
    const result = await fetch(req.url, {
      method: req.method,
      headers,
      body: ["GET", "HEAD"].includes(req.method)
        ? undefined
        : Buffer.from(await req.arrayBuffer()),
      redirect: "follow",
    });
    const body = Buffer.from(await result.arrayBuffer());
    const responseHeaders = Object.fromEntries(result.headers);
    delete responseHeaders["content-encoding"];
    delete responseHeaders["content-length"];
    delete responseHeaders["set-cookie"];
    if (req.method === "GET" && result.ok && u.pathname.startsWith("/api/"))
      fs.writeFileSync(
        cacheFile,
        JSON.stringify({
          url: req.url,
          status: result.status,
          headers: responseHeaders,
          body: body.toString("base64"),
        }),
        { mode: 0o600 },
      );
    return new Response(body, {
      status: result.status,
      headers: responseHeaders,
    });
  };
  ses.protocol.handle(
    "https",
    createAssetHandler({
      root: path.join(dir, variant),
      studioOrigin: "https://studio.plasmic.shiguanglab.com",
      canvasOrigin: "https://canvas.plasmic.shiguanglab.com",
      remoteFetch,
      localCanvasLibraries: libs,
    }),
  );
  const win = new BrowserWindow({
    width: 1720,
    height: 1100,
    show: true,
    webPreferences: {
      session: ses,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  win.webContents.on("console-message", (e) => {
    if (e.level === "error")
      console.log("RENDER_ERROR", e.message.slice(0, 500));
  });
  await win.loadURL(projectUrl);
  console.log("LOADED", variant);
  global.benchWindow = win;
});
