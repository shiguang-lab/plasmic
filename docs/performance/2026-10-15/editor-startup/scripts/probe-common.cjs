const fs = require("fs"),
  http = require("http"),
  http2 = require("http2"),
  net = require("net");
const dir = process.env.PROBE_OUTPUT_ROOT;
async function startProxy(gatewayPort) {
  const server = http2.createSecureServer({
    key: fs.readFileSync(dir + "/proxy-key.pem"),
    cert: fs.readFileSync(dir + "/proxy-cert.pem"),
    allowHTTP1: true,
  });
  const requests = [];
  const agent = new http.Agent({ keepAlive: true, maxSockets: 32 });
  server.on("request", (req, res) => {
    const host = req.headers.host || req.headers[":authority"];
    const headers = Object.fromEntries(
      Object.entries(req.headers).filter(
        ([k]) =>
          !k.startsWith(":") && !["connection", "proxy-connection"].includes(k),
      ),
    );
    headers.host = host;
    headers["x-forwarded-proto"] = "https";
    headers["x-forwarded-host"] = host;
    const start = Date.now(),
      record = {
        path: req.url.split("?")[0],
        method: req.method,
        startAt: start,
      };
    requests.push(record);
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      /^\/api\/v1\/projects\//.test(req.url)
    ) {
      record.blocked = true;
      res.writeHead(409, { "content-type": "application/json" });
      res.end('{"error":"Performance probe blocks project writes"}');
      return;
    }
    const upstream = http.request(
      {
        host: process.env.PROBE_UPSTREAM_HOST,
        port: gatewayPort,
        path: req.url,
        method: req.method,
        headers,
        agent,
      },
      (response) => {
        record.status = response.statusCode;
        record.headersMs = Date.now() - start;
        record.serverTiming = response.headers["server-timing"];
        record.encoding = response.headers["content-encoding"];
        record.cacheControl = response.headers["cache-control"];
        const rh = Object.fromEntries(
          Object.entries(response.headers).filter(
            ([k]) =>
              ![
                "connection",
                "transfer-encoding",
                "keep-alive",
                "upgrade",
              ].includes(k),
          ),
        );
        res.writeHead(response.statusCode, rh);
        let bytes = 0;
        response.on("data", (x) => (bytes += x.length));
        response.on("end", () => {
          record.bytes = bytes;
          record.durationMs = Date.now() - start;
        });
        response.pipe(res);
      },
    );
    upstream.on("error", (e) => {
      record.error = e.message;
      if (!res.headersSent) res.writeHead(502);
      res.end("Test proxy upstream unavailable");
    });
    req.pipe(upstream);
  });
  server.on("upgrade", (req, socket, head) => {
    const headers = {
      ...req.headers,
      host: req.headers.host,
      "x-forwarded-proto": "https",
      "x-forwarded-host": req.headers.host,
    };
    const upstream = http.request({
      host: process.env.PROBE_UPSTREAM_HOST,
      port: gatewayPort,
      path: req.url,
      method: req.method,
      headers,
    });
    upstream.on("upgrade", (response, target, targetHead) => {
      socket.write(
        "HTTP/1.1 101 Switching Protocols\r\n" +
          Object.entries(response.headers)
            .map(([k, v]) => k + ": " + v)
            .join("\r\n") +
          "\r\n\r\n",
      );
      if (targetHead.length) socket.write(targetHead);
      if (head.length) target.write(head);
      target.pipe(socket).pipe(target);
    });
    upstream.on("error", () => socket.destroy());
    upstream.end();
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(3443, "127.0.0.1", resolve);
  });
  const tunnels = new Set();
  const connect = http.createServer();
  connect.on("connect", (req, socket, head) => {
    const [host, port] = req.url.split(":");
    const mapped = [
      "studio.plasmic.shiguanglab.com",
      "canvas.plasmic.shiguanglab.com",
    ].includes(host);
    const target = net.connect(
      mapped ? 3443 : Number(port || 443),
      mapped ? "127.0.0.1" : host,
      () => {
        socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        if (head.length) target.write(head);
        socket.pipe(target).pipe(socket);
      },
    );
    tunnels.add(target);
    tunnels.add(socket);
    target.on("close", () => {
      tunnels.delete(target);
      socket.destroy();
    });
    socket.on("close", () => {
      tunnels.delete(socket);
      target.destroy();
    });
    target.on("error", () => socket.destroy());
    socket.on("error", () => target.destroy());
  });
  await new Promise((resolve, reject) => {
    connect.once("error", reject);
    connect.listen(3444, "127.0.0.1", resolve);
  });
  return {
    server,
    requests,
    close: () => {
      for (const socket of tunnels) socket.destroy();
      connect.close();
      agent.destroy();
      server.close();
    },
  };
}
function bootstrap() {
  const probe = (window.__startupProbe = {
    longTasks: [],
    installedAt: Date.now(),
    globalRevealAt: null,
    visibleCanvasAt: null,
    editableAt: null,
    topRevealAt: null,
  });
  try {
    localStorage.setItem("shiguang.ui.language", "en");
    localStorage.setItem("shiguang.ui.appearance", "light");
  } catch {}
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries())
        probe.longTasks.push({ startMs: e.startTime, durationMs: e.duration });
    }).observe({ type: "longtask", buffered: true });
  } catch {}
  let value,
    editableStarted = false;
  Object.defineProperty(window, "studioCtx", {
    configurable: true,
    get: () => value,
    set: (s) => {
      value = s;
      if (s) clearInterval(s.asyncSaverTimer);
    },
  });
  function sample() {
    if (
      window.top === window &&
      document.querySelector("iframe.studio-frame")
    ) {
      const visible = [
        ...document.querySelectorAll(".studio-loading.visible"),
      ].some((el) => {
        const s = getComputedStyle(el);
        return (
          s.visibility !== "hidden" &&
          s.display !== "none" &&
          Number(s.opacity) > 0.05
        );
      });
      if (!visible && !document.querySelector(".canvas-editor"))
        probe.topRevealAt ??= Date.now();
    }
    const s = value,
      clipper = document.querySelector(".canvas-editor__canvas-container");
    if (
      s &&
      clipper &&
      s.initialRouteReady &&
      !clipper.querySelector(":scope > .studio-loading")
    ) {
      probe.globalRevealAt ??= Date.now();
      const box = clipper.getBoundingClientRect();
      for (const vc of s.viewCtxs) {
        if (!vc.initialRenderReady || vc.isDisposed) continue;
        const r = vc.canvasCtx.viewport().getBoundingClientRect();
        if (
          r.right > box.left + 10 &&
          r.left < box.right - 10 &&
          r.bottom > box.top + 10 &&
          r.top < box.bottom - 10
        ) {
          probe.visibleCanvasAt ??= Date.now();
          break;
        }
      }
      if (!editableStarted && s.activeCanvasReady && s.initialViewportReady) {
        editableStarted = true;
        const vc = s.tryGetViewCtxForFrame(s.activeCanvasFrame);
        Promise.resolve(vc?.awaitSync()).then(() => {
          probe.editableAt = Date.now();
        });
      }
    }
    requestAnimationFrame(sample);
  }
  requestAnimationFrame(sample);
}
module.exports = {
  startProxy,
  bootstrap,
};
