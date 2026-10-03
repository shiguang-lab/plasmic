const { BrowserWindow } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");

// Read rendered DOM, never Studio's private model or user-supplied JavaScript.
async function inspectCanvas() {
  await Promise.race([
    document.fonts.ready,
    new Promise((resolve) => setTimeout(resolve, 5000)),
  ]);
  await Promise.race([
    new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    ),
    new Promise((resolve) => setTimeout(resolve, 100)),
  ]);
  const root = document.querySelector(".__wab_val_root") || document.body;
  const elements = [...root.querySelectorAll("*")].filter(
    (el) => !["SCRIPT", "STYLE", "LINK"].includes(el.tagName),
  );
  const visible = elements.filter(
    (el) =>
      el.getBoundingClientRect().width > 0 &&
      el.getBoundingClientRect().height > 0,
  );
  return {
    ready:
      !!document.querySelector(".__wab_val_root") ||
      (new URLSearchParams(location.hash.slice(1)).get("live") === "true" &&
        visible.length > 0),
    width: innerWidth,
    height: innerHeight,
    contentHeight: document.documentElement.scrollHeight,
    elements: visible.slice(0, 2000).map((el, index) => {
      const rect = el.getBoundingClientRect();
      const valKey = el.getAttribute("data-plasmic-valkey");
      return {
        index,
        elementUuid: valKey?.split(".").at(-1) || null,
        tag: el.tagName.toLowerCase(),
        text: (el.textContent || "").trim().slice(0, 120),
        classes: el.className?.baseVal ?? el.className,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      };
    }),
    images: [...document.images].map((el) => ({
      src: el.currentSrc || el.src,
      alt: el.alt,
      loaded: el.complete && el.naturalWidth > 0,
      width: el.naturalWidth,
      height: el.naturalHeight,
    })),
  };
}
function snapshotDocument() {
  const clone = document.documentElement.cloneNode(true);
  const originals = document.documentElement.querySelectorAll("*");
  const copies = clone.querySelectorAll("*");
  // Preserve inherited typography when canvas reset CSS is reloaded for export.
  originals.forEach((el, index) => {
    const computed = getComputedStyle(el);
    for (const property of [
      "font-family",
      "font-size",
      "font-weight",
      "font-style",
      "line-height",
      "letter-spacing",
      "color",
      "text-align",
      "text-transform",
      "white-space",
    ])
      copies[index].style.setProperty(
        property,
        computed.getPropertyValue(property),
      );
  });
  clone
    .querySelectorAll(
      "script, iframe, object, embed, base, [data-plasmic-slot-placeholder]",
    )
    .forEach((el) => el.remove());
  clone.querySelectorAll("*").forEach((el) => {
    [...el.attributes].forEach((attr) => {
      if (
        /^on/i.test(attr.name) ||
        /^(javascript|vbscript):/i.test(attr.value.trim())
      )
        el.removeAttribute(attr.name);
    });
  });
  // Canvas CSS can be inserted via CSSOM without text nodes.
  const css = [...document.styleSheets]
    .map((sheet) => {
      try {
        return [...sheet.cssRules].map((rule) => rule.cssText).join("\n");
      } catch {
        return "";
      }
    })
    .join("\n");
  clone.querySelectorAll("style").forEach((el) => el.remove());
  const head = clone.querySelector("head");
  clone
    .querySelectorAll('link[rel="stylesheet"]')
    .forEach((el) => head.append(el));
  const base = document.createElement("base");
  base.href = location.href;
  head.prepend(base);
  const policy = document.createElement("meta");
  policy.httpEquiv = "Content-Security-Policy";
  policy.content =
    "script-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'";
  head.prepend(policy);
  const style = document.createElement("style");
  style.textContent =
    css +
    "\nhtml,body{margin:0!important} [data-plasmic-slot-placeholder]{display:none!important}";
  head.append(style);
  return "<!doctype html>\n" + clone.outerHTML;
}
async function readyDocument() {
  await Promise.race([
    document.fonts.ready,
    new Promise((resolve) => setTimeout(resolve, 5000)),
  ]);
  await Promise.all(
    [...document.images].map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise((resolve) => {
            img.addEventListener("load", resolve, { once: true });
            img.addEventListener("error", resolve, { once: true });
            setTimeout(resolve, 10000);
          }),
    ),
  );
  await Promise.race([
    new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    ),
    new Promise((resolve) => setTimeout(resolve, 100)),
  ]);
  return Math.max(
    document.documentElement.scrollHeight,
    document.body.scrollHeight,
  );
}
const js = (fn) => `(${fn.toString()})()`;
async function canvasFrames(win, origin) {
  const previewMode = new URL(win.webContents.getURL()).pathname.includes(
    "/preview/",
  );
  const end = Date.now() + 20000;
  while (Date.now() < end) {
    const frames = win.webContents.mainFrame.framesInSubtree.filter((frame) => {
      try {
        const url = new URL(frame.url);
        const flags = new URLSearchParams(url.hash.slice(1));
        return (
          url.origin === origin &&
          flags.get(previewMode ? "live" : "canvas") === "true"
        );
      } catch {
        return false;
      }
    });
    const results = [];
    for (const frame of frames) {
      const layout = await frame.executeJavaScript(js(inspectCanvas));
      if (layout.ready) results.push({ frame, layout });
    }
    if (results.length) return results;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(
    "No rendered canvas available; open a page or component first",
  );
}
async function renderCanvas(win, origin, input = {}) {
  const frames = await canvasFrames(win, origin);
  const selected = input.width
    ? frames.reduce((a, b) =>
        Math.abs(a.layout.width - input.width) <
        Math.abs(b.layout.width - input.width)
          ? a
          : b,
      )
    : frames[0];
  const html = await selected.frame.executeJavaScript(js(snapshotDocument));
  const width = input.width || selected.layout.width;
  const preview = new BrowserWindow({
    show: false,
    width,
    height: 900,
    useContentSize: true,
    webPreferences: {
      session: win.webContents.session,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      offscreen: true,
      backgroundThrottling: false,
    },
  });
  preview.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  preview.webContents.on("will-navigate", (event) => event.preventDefault());
  try {
    await preview.loadURL(
      "data:text/html;charset=utf-8," + encodeURIComponent(html),
    );
    const contentHeight = await preview.webContents.executeJavaScript(
      js(readyDocument),
    );
    const height = input.height || contentHeight;
    if (height > 16384)
      throw new Error(
        "Canvas height exceeds 16384 pixels; specify a cropped height",
      );
    preview.setContentSize(width, height);
    await preview.webContents.executeJavaScript(js(readyDocument));
    let rect;
    if (input.elementUuid) {
      rect = await preview.webContents.executeJavaScript(`(() => {
        const matches = [...document.querySelectorAll("[data-plasmic-valkey]")].filter(el => el.getAttribute("data-plasmic-valkey").split(".").at(-1) === ${JSON.stringify(input.elementUuid)}).map(el => el.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0);
        if (!matches.length) throw new Error("Element is not visible in this artboard");
        const x = Math.floor(Math.min(...matches.map(r => r.x)));
        const y = Math.floor(Math.min(...matches.map(r => r.y)));
        return {x, y, width: Math.ceil(Math.max(...matches.map(r => r.right))) - x, height: Math.ceil(Math.max(...matches.map(r => r.bottom))) - y};
      })()`);
      if (
        rect.x < 0 ||
        rect.y < 0 ||
        rect.x + rect.width > width ||
        rect.y + rect.height > height
      )
        throw new Error(
          "Element extends beyond the captured artboard; increase width/height",
        );
    }
    const image = await preview.webContents.capturePage(rect);
    let webp;
    if (input.format === "webp") {
      const dataUrl = image.toDataURL();
      const encoded = await preview.webContents
        .executeJavaScript(`(async () => {
        const image = new Image();
        image.src = ${JSON.stringify(dataUrl)};
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        canvas.getContext("2d").drawImage(image, 0, 0);
        return canvas.toDataURL("image/webp", ${(input.quality || 90) / 100});
      })()`);
      if (!encoded.startsWith("data:image/webp;base64,"))
        throw new Error("WebP encoding is unavailable");
      webp = Buffer.from(encoded.split(",")[1], "base64");
    }
    return {
      image,
      html,
      webp,
      width: rect?.width || width,
      height: rect?.height || height,
      pdf:
        input.format === "pdf"
          ? await preview.webContents.printToPDF({
              printBackground: true,
              pageSize: { width: width / 96, height: height / 96 },
              margins: { top: 0, bottom: 0, left: 0, right: 0 },
            })
          : undefined,
    };
  } finally {
    preview.destroy();
  }
}
async function exportCanvas(win, origin, input) {
  if (!path.isAbsolute(input.outputPath))
    throw new Error("outputPath must be absolute");
  if (path.extname(input.outputPath).toLowerCase() !== "." + input.format)
    throw new Error("File extension must match export format");
  const result = await renderCanvas(win, origin, input);
  const data =
    input.format === "html"
      ? result.html
      : input.format === "pdf"
        ? result.pdf
        : input.format === "jpeg"
          ? result.image.toJPEG(input.quality || 90)
          : input.format === "webp"
            ? result.webp
            : result.image.toPNG();
  await fs.writeFile(input.outputPath, data, { flag: "wx" });
  return {
    path: input.outputPath,
    format: input.format,
    width: result.width,
    height: result.height,
    bytes: Buffer.byteLength(data),
    interactive: false,
  };
}
module.exports = { canvasFrames, renderCanvas, exportCanvas };
