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
      el.getBoundingClientRect().height > 0 &&
      getComputedStyle(el).visibility !== "hidden" &&
      getComputedStyle(el).opacity !== "0",
  );
  // Clone only for semantic text extraction; retain the live DOM for geometry.
  const textRoot = root.cloneNode(true);
  const textElements = [...textRoot.querySelectorAll("*")];
  const texts = new Map(elements.map((el) => [el, ""]));
  const sourceElements = [...root.querySelectorAll("*")];
  sourceElements.forEach((el, index) => {
    const style = getComputedStyle(el);
    if (
      ["SCRIPT", "STYLE", "LINK", "TEMPLATE"].includes(el.tagName) ||
      el.hidden ||
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.opacity === "0" ||
      el.hasAttribute("data-plasmic-editor-only")
    ) {
      textElements[index].remove();
    }
  });
  sourceElements.forEach((el, index) => {
    if (texts.has(el))
      texts.set(
        el,
        textRoot.contains(textElements[index])
          ? (textElements[index].textContent || "").trim().slice(0, 120)
          : "",
      );
  });
  return {
    ready:
      !!document.querySelector(".__wab_val_root") ||
      (new URLSearchParams(location.hash.slice(1)).get("live") === "true" &&
        visible.length > 0),
    frameUuid: document.documentElement.getAttribute("data-plasmic-frame-uuid"),
    width: innerWidth,
    height: innerHeight,
    contentHeight: document.documentElement.scrollHeight,
    truncated: visible.length > 2000,
    elements: visible.slice(0, 2000).map((el, index) => {
      const rect = el.getBoundingClientRect();
      const valKey = el.getAttribute("data-plasmic-valkey");
      let left = rect.left;
      let right = rect.right;
      for (
        let parent = el.parentElement;
        parent;
        parent = parent.parentElement
      ) {
        if (parent === document.scrollingElement) continue;
        if (
          ["auto", "scroll", "hidden", "clip"].includes(
            getComputedStyle(parent).overflowX,
          )
        ) {
          const bounds = parent.getBoundingClientRect();
          left = Math.max(left, bounds.left + parent.clientLeft);
          right = Math.min(
            right,
            bounds.left + parent.clientLeft + parent.clientWidth,
          );
        }
      }
      return {
        index,
        elementUuid: valKey?.split(".").at(-1) || null,
        tag: el.tagName.toLowerCase(),
        text: texts.get(el),
        classes: el.className?.baseVal ?? el.className,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        horizontalOverflow:
          right > left && (left < -1 || right > innerWidth + 1),
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
  clone.removeAttribute("data-plasmic-canvas-inspection");
  clone.removeAttribute("data-plasmic-frame-uuid");
  const originals = document.documentElement.querySelectorAll("*");
  const copies = clone.querySelectorAll("*");
  // Preserve inherited typography when canvas reset CSS is reloaded for export.
  originals.forEach((el, index) => {
    const copy = copies[index];
    if (el instanceof HTMLInputElement) {
      // File values cannot be assigned; no selected file is included in an export.
      if (el.type !== "file") copy.setAttribute("value", el.value);
      copy.toggleAttribute("checked", el.checked);
    } else if (el instanceof HTMLTextAreaElement) {
      copy.textContent = el.value;
    } else if (el instanceof HTMLOptionElement) {
      copy.toggleAttribute("selected", el.selected);
    }
    if (el.scrollLeft || el.scrollTop) {
      copy.setAttribute(
        "data-plasmic-export-scroll-left",
        String(el.scrollLeft),
      );
      copy.setAttribute("data-plasmic-export-scroll-top", String(el.scrollTop));
    }
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
    el.removeAttribute("data-plasmic-table-column-selected");
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
        if (sheet.ownerNode?.hasAttribute("data-plasmic-editor-style"))
          return "";
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
  const nonce = crypto.randomUUID();
  policy.httpEquiv = "Content-Security-Policy";
  policy.content = `script-src 'nonce-${nonce}'; object-src 'none'; frame-src 'none'; form-action 'none'`;
  head.prepend(policy);
  clone
    .querySelectorAll('meta[charset], meta[http-equiv="Content-Type" i]')
    .forEach((el) => el.remove());
  const encoding = document.createElement("meta");
  encoding.setAttribute("charset", "utf-8");
  head.prepend(encoding);
  const style = document.createElement("style");
  style.textContent =
    css +
    "\nhtml,body{margin:0!important} [data-plasmic-slot-placeholder]{display:none!important}";
  head.append(style);
  // Only this generated state restorer may run; authored scripts remain removed.
  const restore = document.createElement("script");
  restore.setAttribute("nonce", nonce);
  restore.textContent = `window.addEventListener("load", () => {
    const restore = () => document.querySelectorAll("[data-plasmic-export-scroll-left]").forEach(el => {
      el.scrollLeft = Number(el.getAttribute("data-plasmic-export-scroll-left"));
      el.scrollTop = Number(el.getAttribute("data-plasmic-export-scroll-top"));
    });
    restore();
    document.fonts?.ready.then(restore);
  });`;
  head.append(restore);
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
  document
    .querySelectorAll("[data-plasmic-export-scroll-left]")
    .forEach((el) => {
      el.scrollLeft = Number(
        el.getAttribute("data-plasmic-export-scroll-left"),
      );
      el.scrollTop = Number(el.getAttribute("data-plasmic-export-scroll-top"));
    });
  return Math.max(
    document.documentElement.scrollHeight,
    document.body.scrollHeight,
  );
}
const js = (fn) => `(${fn.toString()})()`;
async function canvasFrames(win, inspectionId) {
  const previewMode = new URL(win.webContents.getURL()).pathname.includes(
    "/preview/",
  );
  const end = Date.now() + 20000;
  while (Date.now() < end) {
    const frames = win.webContents.mainFrame.framesInSubtree.filter((frame) => {
      if (inspectionId) return true;
      try {
        const url = new URL(frame.url);
        const flags = new URLSearchParams(url.hash.slice(1));
        return (
          ["http:", "https:"].includes(url.protocol) &&
          flags.get(previewMode ? "live" : "canvas") === "true"
        );
      } catch {
        return false;
      }
    });
    const results = [];
    for (const frame of frames) {
      if (frame.isDestroyed?.()) continue;
      try {
        if (inspectionId) {
          const marker = await frame.executeJavaScript(
            'document.documentElement.getAttribute("data-plasmic-canvas-inspection")',
          );
          if (marker !== inspectionId) continue;
        }
        const layout = await frame.executeJavaScript(js(inspectCanvas));
        if (layout.ready) results.push({ frame, layout });
      } catch (error) {
        if (!frame.isDestroyed?.()) throw error;
      }
    }
    if (results.length) return results;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(
    "No rendered canvas available; open a page or component first",
  );
}
async function renderCanvas(win, input = {}) {
  const available = await canvasFrames(win, input.inspectionId);
  const matchingFrames = input.frameUuid
    ? available.filter(({ layout }) => layout.frameUuid === input.frameUuid)
    : available;
  const frames = input.artboardElementUuid
    ? matchingFrames.filter(({ layout }) =>
        layout.elements.some(
          (el) => el.elementUuid === input.artboardElementUuid,
        ),
      )
    : matchingFrames;
  if (!frames.length)
    throw new Error(
      "Artboard containing the requested element is not rendered",
    );
  let selected;
  if (input.frameUuid || input.artboardElementUuid || frames.length === 1) {
    if (frames.length !== 1)
      throw new Error("Multiple artboards match; specify frameUuid");
    selected = frames[0];
  } else {
    const context = await win.webContents.executeJavaScript(`(async () => {
      const result = await window.PLASMIC_AI_TOOLS.getEditorContext({});
      if (!result.success) throw new Error(result.error.message);
      return JSON.parse(result.output);
    })()`);
    selected = frames.find(
      ({ layout }) => layout.frameUuid === context.frameUuid,
    );
    if (!selected)
      throw new Error(
        "Multiple artboards available; select an artboard or specify frameUuid",
      );
  }
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
    // Offscreen windows expose their rendered bitmap through paint events.
    // capturePage can fail with UnknownVizError on hidden offscreen surfaces.
    const bitmap = await new Promise((resolve, reject) => {
      const contents = preview.webContents;
      const cleanup = () => {
        clearTimeout(timer);
        contents.removeListener("paint", painted);
      };
      const painted = (_event, _dirty, image) => {
        const size = image.getSize();
        if (size.width !== width || size.height !== height) return;
        cleanup();
        resolve(image);
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("Offscreen canvas did not finish painting"));
      }, 10000);
      contents.on("paint", painted);
      contents.invalidate();
    });
    const image = rect ? bitmap.crop(rect) : bitmap;
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
      frameUuid: selected.layout.frameUuid,
      sourceViewport: {
        width: selected.layout.width,
        height: selected.layout.height,
      },
      resized: width !== selected.layout.width,
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
async function exportCanvas(win, input) {
  if (!path.isAbsolute(input.outputPath))
    throw new Error("outputPath must be absolute");
  if (path.extname(input.outputPath).toLowerCase() !== "." + input.format)
    throw new Error("File extension must match export format");
  const result = await renderCanvas(win, input);
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
    rendering: "static",
    sourceViewport: result.sourceViewport,
    resized: result.resized,
  };
}
module.exports = { canvasFrames, renderCanvas, exportCanvas };
