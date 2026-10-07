const fs = require("node:fs/promises");
const path = require("node:path");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".wasm": "application/wasm",
  ".txt": "text/plain; charset=utf-8",
};

function createAssetHandler({
  root,
  studioOrigin,
  canvasOrigin,
  remoteFetch,
  bridgePath,
  authPagePath,
  updateUiPath,
  bundledFontCss = "",
}) {
  root = path.resolve(root);
  return async function handle(request) {
    const url = new URL(request.url);
    if (
      url.origin === "https://fonts.googleapis.com" &&
      ["/css", "/css2"].includes(url.pathname)
    ) {
      const families = url.searchParams
        .getAll("family")
        .flatMap((value) => value.split("|"))
        .map((value) => value.split(":")[0]);
      const faces = bundledFontCss.match(/@font-face\s*\{[^}]+\}/g) || [];
      const available = new Set(
        faces.map((face) => face.match(/font-family:\s*['"]([^'"]+)['"]/)?.[1]),
      );
      if (
        families.length &&
        families.every((family) => available.has(family))
      ) {
        const css = faces
          .filter((face) =>
            families.includes(
              face.match(/font-family:\s*['"]([^'"]+)['"]/)?.[1],
            ),
          )
          .join("\n");
        return new Response(request.method === "HEAD" ? null : css, {
          headers: {
            "Content-Type": "text/css; charset=utf-8",
            "Content-Length": String(Buffer.byteLength(css)),
            "Access-Control-Allow-Origin": "*",
            "X-Plasmic-Desktop-Asset": "local",
          },
        });
      }
    }
    const studio = url.origin === studioOrigin;
    if (studio && authPagePath && url.pathname === "/desktop/unified-login") {
      return new Response(
        request.method === "HEAD" ? null : await fs.readFile(authPagePath),
        {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
            "X-Plasmic-Desktop-Asset": "local",
          },
        },
      );
    }
    const canvas = url.origin === canvasOrigin;
    // Preserve the original HTTPS origin, cookies and API request body. WebSockets
    // use Chromium's network stack directly and retain the NAS URL as well.
    if (
      (!studio && !canvas) ||
      (studio &&
        (url.pathname === "/api" ||
          url.pathname.startsWith("/api/") ||
          url.pathname === "/healthcheck" ||
          url.pathname.startsWith("/assets/")))
    ) {
      return remoteFetch(request);
    }
    if (!["GET", "HEAD"].includes(request.method)) {
      return new Response("Method not allowed", { status: 405 });
    }
    let pathname;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      return new Response("Invalid path", { status: 400 });
    }
    if (pathname.includes("\\") || pathname.includes("\0")) {
      return new Response("Invalid path", { status: 400 });
    }
    const cors = { "Access-Control-Allow-Origin": "*" };
    if (bridgePath && pathname === "/static/desktop/editor-bridge.js") {
      return fileResponse(bridgePath);
    }
    if (updateUiPath && pathname === "/static/desktop/update-ui.js") {
      return fileResponse(updateUiPath);
    }
    const target = path.resolve(root, "." + pathname);
    if (target !== root && !target.startsWith(root + path.sep)) {
      return new Response("Forbidden", { status: 403 });
    }
    async function fileResponse(file) {
      let data = await fs.readFile(file);
      if (bridgePath && path.basename(file) === "index.html") {
        data = Buffer.from(
          data
            .toString()
            .replace(
              "</head>",
              `<script defer src="${studioOrigin}/static/desktop/editor-bridge.js"></script></head>`,
            ),
        );
      }
      if (
        updateUiPath &&
        [
          path.join(root, "index.html"),
          path.join(root, "static/host.html"),
        ].includes(file)
      ) {
        data = Buffer.from(
          data
            .toString()
            .replace(
              "</head>",
              `<script defer src="${studioOrigin}/static/desktop/update-ui.js" data-studio-origin="${studioOrigin}" data-canvas-origin="${canvasOrigin}"></script></head>`,
            ),
        );
      }
      return new Response(request.method === "HEAD" ? null : data, {
        headers: {
          ...cors,
          "Content-Type":
            mimeTypes[path.extname(file)] || "application/octet-stream",
          "Content-Length": String(data.length),
          "Cache-Control": "no-cache",
          "X-Plasmic-Desktop-Asset": "local",
        },
      });
    }
    try {
      return await fileResponse(target);
    } catch (error) {
      if (!["ENOENT", "EISDIR", "ENOTDIR"].includes(error.code)) {
        throw error;
      }
      // Missing assets must never fall back to the network or to index.html.
      if (
        !studio ||
        pathname.startsWith("/static/") ||
        path.extname(pathname)
      ) {
        return new Response("Bundled asset not found", {
          status: 404,
          headers: cors,
        });
      }
      return fileResponse(path.join(root, "index.html"));
    }
  };
}
module.exports = { createAssetHandler };
