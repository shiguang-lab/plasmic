const fs = require("node:fs"),
  fsp = fs.promises,
  http = require("node:http"),
  path = require("node:path");
const { createHmac, randomUUID } = require("node:crypto");
const { chromium } = require(
  process.env.PLAYWRIGHT_CORE || "/runtime/playwright-core",
);
const sharp = require("node:module").createRequire(
  "/plasmic/platform/wab/package.json",
)("sharp");
const origin = new URL(process.env.STUDIO_ORIGIN).origin;
const key = fs.readFileSync("/run/secrets/snapshot-key", "utf8").trim();
const socket = "/jobs/screenshot.sock",
  out = "/covers";
const trustedAssets = new Set([
  origin,
  ...(process.env.STUDIO_ASSET_ORIGINS || "").split(",").filter(Boolean),
]);
let browser,
  busy = false;
async function capture(id) {
  if (!browser?.isConnected())
    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH,
      headless: true,
      args: [
        "--disable-dev-shm-usage",
        "--no-proxy-server",
        "--disable-background-networking",
      ],
    });
  const context = await browser.newContext({
    viewport: { width: 640, height: 360 },
    deviceScaleFactor: 1,
    // The private HTTP Studio origin cannot register service workers.
    serviceWorkers: origin.startsWith("https:") ? "block" : "allow",
    acceptDownloads: false,
  });
  const temp = path.join(out, "." + randomUUID() + ".tmp");
  const deadline = setTimeout(() => {
    void context.close().catch(() => {});
  }, 180000);
  try {
    const page = await context.newPage(),
      url = new URL("/canvas-snapshot/" + id, origin);
    const expires = Math.floor(Date.now() / 1000) + 240;
    const signature = createHmac("sha256", key)
      .update(id + "." + expires)
      .digest("hex");
    const ticket = "Bearer " + expires + "." + signature;
    const errors = [];
    let modelHttpMs;
    page.on("pageerror", (e) => {
      errors.push(e.message.slice(0, 200));
    });
    await context.route("**/*", async (route) => {
      const request = route.request(),
        u = new URL(request.url());
      if (!["GET", "HEAD"].includes(request.method())) return route.abort();
      if (
        u.origin === origin &&
        [url.pathname, url.pathname + "/model"].includes(u.pathname) &&
        !u.search &&
        request.frame() === page.mainFrame() &&
        !request.redirectedFrom()
      ) {
        try {
          const requestStart = performance.now();
          const response = await context.request.get(u.href, {
            headers: { authorization: ticket },
            maxRedirects: 0,
            timeout: 60000,
          });
          if (u.pathname === url.pathname + "/model") {
            modelHttpMs = Math.round(performance.now() - requestStart);
          }
          try {
            if (response.status() >= 300 && response.status() < 400)
              return await route.abort();
            await route.fulfill({ response });
          } finally {
            await response.dispose();
          }
        } catch {
          await route.abort().catch(() => {});
        }
        return;
      }
      if (
        request.isNavigationRequest() &&
        (request.frame() === page.mainFrame() ||
          u.origin !== origin ||
          u.pathname !== "/static/host.html")
      ) {
        return route.abort();
      }
      if (
        trustedAssets.has(u.origin) &&
        ["/static/", "/assets/", "/canvas-snapshot-assets/"].some((prefix) =>
          u.pathname.startsWith(prefix),
        )
      )
        return route.continue();
      if (
        ["https://fonts.googleapis.com", "https://fonts.gstatic.com"].includes(
          u.origin,
        )
      )
        return route.continue();
      return route.abort();
    });
    const startEpochMs = Date.now(),
      start = performance.now();
    const response = await page.goto(url.href, {
      waitUntil: "commit",
      timeout: 60000,
    });
    if (response?.status() !== 200)
      throw Error("Studio document HTTP " + response?.status());
    const cover = page.locator("#overview");
    try {
      await page.waitForSelector("#overview[data-state]", { timeout: 150000 });
    } catch {
      throw Error(
        "Canvas did not become ready: " + errors.slice(0, 3).join(" / "),
      );
    }
    if ((await cover.getAttribute("data-state")) !== "ready")
      throw Error((await cover.getAttribute("data-error")) || "Canvas error");
    const revision = Number(await cover.getAttribute("data-revision")),
      boards = Number(await cover.getAttribute("data-boards"));
    if (!Number.isSafeInteger(revision) || revision < 1 || !boards)
      throw Error("Invalid cover metadata");
    const readyMs = performance.now() - start;
    const png = await cover.screenshot({ type: "png", timeout: 30000 });
    const bytes = await sharp(png).webp({ lossless: true }).toBuffer();
    const capturedMs = performance.now() - start;
    if (png.readUInt32BE(16) !== 640 || png.readUInt32BE(20) !== 360)
      throw Error("Invalid cover dimensions");
    const name = id + "-" + revision + ".webp";
    const file = await fsp.open(temp, "wx", 0o600);
    try {
      await file.writeFile(bytes);
      await file.sync();
    } finally {
      await file.close();
    }
    await fsp.rename(temp, path.join(out, name));
    const directory = await fsp.open(out, "r");
    try {
      await directory.sync();
    } finally {
      await directory.close();
    }
    // Keep the previous successful revision as well as the new one.
    // Cleanup cannot invalidate a successful durable write.
    try {
      const older = (await fsp.readdir(out))
        .filter((file) => {
          const match = /^([\w-]+)-(\d+)\.webp$/.exec(file);
          return match && match[1] === id && Number(match[2]) < revision;
        })
        .sort(
          (a, b) =>
            Number(b.slice(id.length + 1, -5)) -
            Number(a.slice(id.length + 1, -5)),
        );
      for (const old of older.slice(1))
        await fsp.rm(path.join(out, old), { force: true });
    } catch (error) {
      console.error("Cover cleanup:", error.message);
    }
    const endEpochMs = Date.now();
    const elapsedMs = Math.round(performance.now() - start);
    const marks = await page
      .evaluate(() =>
        performance
          .getEntriesByType("mark")
          .filter((entry) => entry.name.startsWith("snapshot:"))
          .map(({ name, startTime }) => [
            name.slice("snapshot:".length),
            Math.round(startTime),
          ]),
      )
      .catch(() => []);
    return {
      projectId: id,
      revision,
      boards,
      name,
      bytes: bytes.length,
      startEpochMs,
      endEpochMs,
      readyMs: Math.round(readyMs),
      elapsedMs,
      capturedMs: Math.round(capturedMs),
      modelHttpMs,
      marks,
    };
  } finally {
    clearTimeout(deadline);
    await context.close();
    await fsp.rm(temp, { force: true });
  }
}
async function start() {
  await fsp.mkdir(out, { recursive: true });
  await fsp.mkdir(path.dirname(socket), { recursive: true });
  await fsp.rm(socket, { force: true });
  const server = http.createServer(async (req, res) => {
    const match = /^\/covers\/([\w-]{1,128})$/.exec(req.url);
    if (req.method !== "POST" || !match) {
      res.writeHead(404).end();
      return;
    }
    if (busy) {
      res.writeHead(409).end();
      return;
    }
    busy = true;
    try {
      const result = await capture(match[1]);
      res
        .writeHead(200, { "Content-Type": "application/json" })
        .end(JSON.stringify(result));
    } catch (error) {
      console.error("Screenshot:", error.message);
      res.writeHead(500).end("Capture failed");
    } finally {
      busy = false;
    }
  });
  server.listen(socket);
  await new Promise((r) => server.once("listening", r));
  await fsp.chmod(socket, 0o600);
}
start().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
