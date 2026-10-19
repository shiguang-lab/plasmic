const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const fixtureIds = ["6M9xV1Vz9kawVFdoXVQdSG", "145nN6S5QQBwgjtNUwuiQZ"];
const fixtures = process.env.PLASMIC_PROBE_FIXTURES || "/tmp/plasmic-cover-probe";
const root = path.resolve(__dirname, "../../../..");
const renderer = process.env.PLASMIC_PROBE_RENDERER || path.join(root, "desktop/renderer");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2" };

function fixtureManifest(directory = fixtures) {
  return fixtureIds.map((id) => {
    const data = JSON.parse(fs.readFileSync(path.join(directory, `${id}.json`), "utf8"));
    if (data.project.id !== id || !Number.isInteger(data.rev.revision)) {
      throw new Error(`Invalid fixture identity or revision: ${id}`);
    }
    return { id, revision: data.rev.revision };
  });
}

function createProbeServer({ production = false, fixtureDirectory = fixtures, rendererDirectory = renderer, buildDirectory = production ? path.join(fixtures, "production-build") : path.join(fixtures, "build") } = {}) {
  return http.createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    const pathname = url.pathname;
    const json = (body) => { res.setHeader("content-type", "application/json"); res.end(JSON.stringify(body)); };
    if (req.method !== "GET") { res.writeHead(405); return res.end(); }
    res.setHeader("cache-control", "no-store");
    let base, relative;
    try {
      if (pathname === "/fixture/manifest.json") return json(fixtureManifest(fixtureDirectory));
      if (pathname.startsWith("/api/v1/projects/")) {
        const id = decodeURIComponent(pathname.split("/")[4]);
        if (!fixtureIds.includes(id)) { res.writeHead(404); return res.end(); }
        const data = JSON.parse(fs.readFileSync(path.join(fixtureDirectory, `${id}.json`), "utf8"));
        return json(pathname.endsWith("/revision-without-data") ? { rev: { ...data.rev, data: undefined }, project: data.project } : data);
      }
      if (pathname.startsWith("/api/v1/hostless-libraries/")) {
        const name = decodeURIComponent(pathname.split("/")[4]);
        if (!["antd6", "overseas", "react-ui", "antd-icons"].includes(name)) { res.writeHead(404); return res.end(); }
        base = fixtureDirectory;
        const version = url.searchParams.get("version");
        if (!version || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version)) { res.writeHead(400); return res.end("Pinned library version required"); }
        relative = `${name}@${version}.js`;
      } else if (pathname.startsWith("/static/")) {
        base = path.join(rendererDirectory, "static"); relative = pathname.slice(8);
      } else if (pathname.startsWith("/fixture/")) {
        base = fixtureDirectory; relative = pathname.slice(9);
      } else if (production && pathname === "/") {
        res.setHeader("content-type", "text/html");
        return res.end('<html><body style="margin:0;background:#15161b"><div id="root"></div><script type="module" src="/production-client.js"></script></body></html>');
      } else if (production && pathname === "/production-client.js") {
        base = fixtureDirectory; relative = "production-client.js";
      } else if (production && pathname.startsWith("/canvas-preview/")) {
        base = buildDirectory; relative = pathname.slice(16);
      } else if (!production && pathname === "/canvas-preview/index.html") {
        base = buildDirectory; relative = "engine.html";
      } else if (!production) {
        base = buildDirectory; relative = pathname.startsWith("/probe/") ? pathname.slice(7) : "index.html";
      } else { res.writeHead(404); return res.end(); }
      const file = path.resolve(base, decodeURIComponent(relative));
      if (!file.startsWith(path.resolve(base) + path.sep)) { res.writeHead(403); return res.end(); }
      if (!fs.statSync(file).isFile()) { res.writeHead(404); return res.end(); }
      res.setHeader("content-type", types[path.extname(file)] || "application/octet-stream");
      fs.createReadStream(file).pipe(res);
    } catch (error) {
      res.statusCode = error.code === "ENOENT" ? 404 : 500;
      res.end(String(error));
    }
  });
}
module.exports = { createProbeServer, fixtureManifest, fixtureIds };
