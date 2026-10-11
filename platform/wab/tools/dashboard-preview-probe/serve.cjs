const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../../../..");
const fixtures = "/tmp/plasmic-cover-probe";
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};
http
  .createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    let base, rel;
    if (url.pathname.startsWith("/static/")) {
      base = path.join(root, "desktop/renderer/static");
      rel = url.pathname.slice(8);
    } else if (url.pathname.startsWith("/fixture/")) {
      base = fixtures;
      rel = url.pathname.slice(9);
    } else if (url.pathname.startsWith("/probe/")) {
      base = path.join(fixtures, "build");
      rel = url.pathname.slice(7);
    } else {
      base = path.join(fixtures, "build");
      rel = "index.html";
    }
    const file = path.resolve(base, rel);
    if (!file.startsWith(base + path.sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    fs.stat(file, (err, s) => {
      if (err || !s.isFile()) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.setHeader(
        "content-type",
        types[path.extname(file)] || "application/octet-stream",
      );
      res.setHeader("cache-control", "no-store");
      fs.createReadStream(file).pipe(res);
    });
  })
  .listen(3217, "127.0.0.1", () =>
    console.log("Cover probe: http://127.0.0.1:3217"),
  );
