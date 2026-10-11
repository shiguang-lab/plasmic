const http = require("http"),
  fs = require("fs"),
  path = require("path");
const root = path.resolve(__dirname, "../../../..");
const fixtures = "/tmp/plasmic-cover-probe";
http
  .createServer((req, res) => {
    const pathname = new URL(req.url, "http://localhost").pathname;
    let file;
    if (pathname === "/") {
      res.setHeader("content-type", "text/html");
      return res.end(
        '<html><body style="margin:0;background:#15161b"><div id="root"></div><script type="module" src="/production-client.js"></script></body></html>',
      );
    }
    if (pathname.startsWith("/canvas-preview/")) {
      file = root + "/platform/wab/build" + pathname;
    } else if (pathname === "/static/sub/build/client.527c56.js") {
      file = root + "/platform/sub/public/static/sub/build/client.js";
    } else if (pathname.startsWith("/static/")) {
      file = root + "/desktop/renderer" + pathname;
    } else if (pathname.startsWith("/fixture/")) {
      file = fixtures + "/" + pathname.slice(9);
    } else if (pathname === "/production-client.js") {
      file = fixtures + "/production-client.js";
    } else if (pathname.startsWith("/api/v1/projects/")) {
      const id = pathname.split("/")[4];
      file = fixtures + "/" + id + ".json";
      if (pathname.endsWith("/revision-without-data")) {
        const data = JSON.parse(fs.readFileSync(file));
        res.setHeader("content-type", "application/json");
        return res.end(
          JSON.stringify({
            rev: { ...data.rev, data: undefined },
            project: data.project,
          }),
        );
      }
    } else if (pathname.startsWith("/api/v1/hostless-libraries/")) {
      file =
        pathname.split("/")[4] === "antd-icons"
          ? root +
            "/desktop/renderer/static/canvas-packages/build/antd-icons-v2.527c56.js"
          : fixtures + "/" + pathname.split("/")[4] + ".js";
    }
    if (!file || !fs.existsSync(file)) {
      res.statusCode = 404;
      return res.end(pathname);
    }
    res.setHeader(
      "content-type",
      {
        ".html": "text/html",
        ".js": "text/javascript",
        ".json": "application/json",
        ".css": "text/css",
        ".woff2": "font/woff2",
        ".svg": "image/svg+xml",
        ".png": "image/png",
      }[path.extname(file)] || "application/octet-stream",
    );
    fs.createReadStream(file).pipe(res);
  })
  .listen(3218, "127.0.0.1", () =>
    console.log("Production preview harness: 3218"),
  );
