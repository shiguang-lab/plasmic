import { ensure } from "@/wab/shared/common";

async function asDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// Preserve browser CSS and pixels from Canvas 2D in the isolated renderer.
export async function snapshot(doc: Document, width: number, height: number) {
  const win = ensure(doc.defaultView, "Snapshot window");
  // Skip runtime scripts before cloning; copying multi-megabyte bundles would spike memory.
  const omitted = /^(SCRIPT|IFRAME|OBJECT|EMBED|LINK|STYLE|META|BASE)$/;
  const clone = doc.documentElement.cloneNode(false) as HTMLElement;
  const parents = new WeakMap<Node, Node>([[doc.documentElement, clone]]);
  const originals: Element[] = [doc.documentElement];
  const copies: Element[] = [clone];
  const walker = doc.createTreeWalker(
    doc.documentElement,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) =>
        node.nodeType === Node.ELEMENT_NODE &&
        omitted.test((node as Element).tagName)
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT,
    },
  );
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const copy = node.cloneNode(false);
    ensure(
      parents.get(ensure(node.parentNode, "Snapshot parent")),
      "Snapshot parent clone",
    ).appendChild(copy);
    parents.set(node, copy);
    if (node.nodeType === Node.ELEMENT_NODE) {
      originals.push(node as Element);
      copies.push(copy as Element);
    }
  }
  const stats = {
    nodes: originals.length,
    canvases: 0,
    svgs: 0,
    assetErrors: [] as string[],
  };
  const assets = new Map<string, Promise<string>>();
  const inline = (url: string) => {
    if (url.startsWith("data:") || url.startsWith("#")) {
      return Promise.resolve(url);
    }
    const abs = new URL(url, doc.baseURI).href;
    if (!assets.has(abs)) {
      assets.set(
        abs,
        fetch(abs)
          .then((r) => {
            if (!r.ok) {
              throw new Error(`Asset ${r.status}: ${abs}`);
            }
            return r.blob();
          })
          .then(asDataUrl),
      );
    }
    return ensure(assets.get(abs), "Asset");
  };
  const inlineUrls = async (value: string) => {
    for (const m of [...value.matchAll(/url\(["']?([^"')]+)["']?\)/g)]) {
      try {
        value = value.replace(m[0], `url("${await inline(m[1])}")`);
      } catch (e) {
        stats.assetErrors.push(String(e));
      }
    }
    return value;
  };
  for (let i = 0; i < originals.length; i++) {
    const el = originals[i],
      copy = copies[i] as HTMLElement;
    if (!copy.style) {
      continue;
    }
    // Preserve inherited font metrics; other properties stay in the original CSSOM.
    const computed = win.getComputedStyle(el);
    for (const property of [
      "font-family",
      "font-size",
      "font-weight",
      "font-style",
      "line-height",
      "letter-spacing",
      "color",
      "text-align",
      "white-space",
      "visibility",
      "opacity",
    ]) {
      copy.style.setProperty(property, computed.getPropertyValue(property));
    }
    copy.style.cssText = await inlineUrls(copy.style.cssText);
    if (el.tagName === "CANVAS") {
      stats.canvases++;
      // cloneNode does not preserve the backing store. Fail visibly on tainted canvases.
      const img = doc.createElement("img");
      img.src = (el as HTMLCanvasElement).toDataURL("image/png");
      img.setAttribute("style", copy.getAttribute("style") ?? "");
      img.width = (el as HTMLCanvasElement).width;
      img.height = (el as HTMLCanvasElement).height;
      copy.replaceWith(img);
    } else if (el.tagName === "IMG") {
      copy.setAttribute(
        "src",
        await inline(
          (el as HTMLImageElement).currentSrc || (el as HTMLImageElement).src,
        ),
      );
      copy.removeAttribute("srcset");
    } else if (el.tagName === "INPUT") {
      copy.setAttribute("value", (el as HTMLInputElement).value);
      copy.toggleAttribute("checked", (el as HTMLInputElement).checked);
    } else if (el.tagName === "TEXTAREA") {
      copy.textContent = (el as HTMLTextAreaElement).value;
    }
    if (el.tagName.toLowerCase() === "svg") {
      stats.svgs++;
    }
  }
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;
  // Include rules inserted with CSSOM as well as normal styles, with embedded fonts/assets.
  let sheetCss = "";
  async function rules(ruleset: CSSRuleList, base: string): Promise<string> {
    let result = "";
    for (const rule of [...ruleset]) {
      if (rule.type === CSSRule.MEDIA_RULE) {
        const media = rule as CSSMediaRule;
        if (win.matchMedia(media.conditionText).matches) {
          result += await rules(media.cssRules, base);
        }
      } else if (rule.type === CSSRule.IMPORT_RULE) {
        const imported = rule as CSSImportRule;
        if (
          imported.media.mediaText &&
          !win.matchMedia(imported.media.mediaText).matches
        ) {
          continue;
        }
        const response = await fetch(new URL(imported.href, base));
        if (!response.ok) {
          throw new Error(`Stylesheet ${response.status}: ${imported.href}`);
        }
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(await response.text());
        result += await rules(sheet.cssRules, imported.href);
      } else {
        if (rule.type === CSSRule.FONT_FACE_RULE) {
          const face = (rule as CSSFontFaceRule).style;
          const used = [...doc.fonts].some(
            (font) =>
              font.status === "loaded" &&
              font.family.replace(/["']/g, "") ===
                face.getPropertyValue("font-family").replace(/["']/g, "") &&
              font.weight ===
                (face.getPropertyValue("font-weight") || "normal") &&
              font.style ===
                (face.getPropertyValue("font-style") || "normal") &&
              font.unicodeRange.replace(/\s/g, "").toUpperCase() ===
                (face.getPropertyValue("unicode-range") || "U+0-10FFFF")
                  .replace(/\s/g, "")
                  .toUpperCase(),
          );
          if (!used) {
            continue;
          }
        }
        const css = rule.cssText.replace(
          /url\(["']?([^"')]+)["']?\)/g,
          (whole, url) =>
            url.startsWith("data:") || url.startsWith("#")
              ? whole
              : `url("${new URL(url, base).href}")`,
        );
        result += await inlineUrls(css);
      }
    }
    return result;
  }
  for (const sheet of [...doc.styleSheets, ...doc.adoptedStyleSheets]) {
    try {
      sheetCss += await rules(sheet.cssRules, sheet.href || doc.baseURI);
    } catch (e) {
      stats.assetErrors.push(String(e));
    }
  }
  clone
    .querySelectorAll("script,iframe,object,embed,link,style,meta,base")
    .forEach((e) => e.remove());
  clone.querySelectorAll("*").forEach((el) =>
    [...el.attributes].forEach((a) => {
      if (
        /^on/i.test(a.name) ||
        /^(javascript|vbscript):/i.test(a.value.trim())
      ) {
        el.removeAttribute(a.name);
      }
    }),
  );
  const wrapper = doc.createElement("div");
  wrapper.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  wrapper.style.cssText = `width:${width}px;height:${height}px;overflow:hidden`;
  const css = doc.createElement("style");
  css.textContent = sheetCss;
  wrapper.append(css, clone);
  const html = new XMLSerializer().serializeToString(wrapper);
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject width="100%" height="100%">${html}</foreignObject></svg>`,
    stats,
  };
}
export async function rasterize(svg: string, width: number, height: number) {
  const image = new Image();
  // Embed the document so SVG-as-image has no external dependencies.
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  const canvas = document.createElement("canvas");
  try {
    await image.decode();
    canvas.width = width;
    canvas.height = height;
    ensure(canvas.getContext("2d"), "Raster context").drawImage(
      image,
      0,
      0,
      width,
      height,
    );
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("PNG encoding failed"))),
        "image/png",
      ),
    );
  } finally {
    canvas.width = canvas.height = 0;
    image.src = "";
  }
}
