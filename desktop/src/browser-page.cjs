// Runs in an isolated world in the reference page. It has no desktop APIs.
function installPicker() {
  if (globalThis.__plasmicWebPicker) return;
  let selected,
    hovered,
    picking = false,
    revision = 0,
    suspended = false;
  let readFeedback;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  function clearRead() {
    if (!readFeedback) return;
    const current = readFeedback;
    readFeedback = undefined;
    clearTimeout(current.timer);
    cancelAnimationFrame(current.frame);
    for (const animation of current.animations) animation.cancel();
    current.root.remove();
  }
  function flashRead(input) {
    clearRead();
    if (suspended) return;
    const element = globalThis.__plasmicWebPicker.root(
      input.target,
      input.selector,
    );
    const viewport = !element || ["BODY", "HTML"].includes(element.tagName);
    const measure = () =>
      viewport
        ? { x: 0, y: 0, width: innerWidth, height: innerHeight }
        : element.getBoundingClientRect();
    const rect = measure();
    if (!rect.width || !rect.height) return;
    const root = document.createElement("div");
    root.setAttribute("data-plasmic-browser-overlay", "");
    root.setAttribute("data-plasmic-browser-feedback", "read");
    root.setAttribute("aria-hidden", "true");
    root.style.cssText = `position:fixed;left:0;top:0;pointer-events:none;z-index:2147483647;box-sizing:border-box;overflow:hidden;border:${2 / (input.zoom || 1)}px solid #438ff0;`;
    const animations = [];
    if (!reducedMotion.matches) {
      const band = document.createElement("div");
      band.style.cssText =
        "position:absolute;inset:0;pointer-events:none;background:linear-gradient(to bottom,transparent,#438ff0);opacity:0.4;transform:translateY(-100%);";
      root.append(band);
      animations.push(
        root.animate(
          [
            { opacity: 0 },
            { opacity: 1, offset: 0.1 },
            { opacity: 1, offset: 0.85 },
            { opacity: 0 },
          ],
          { duration: 2000 },
        ),
        band.animate(
          [
            { transform: "translateY(-100%)" },
            { transform: "translateY(100%)" },
          ],
          {
            duration: Math.min(1960, Math.max(300, (rect.height / 350) * 1000)),
            delay: 40,
          },
        ),
      );
    }
    document.documentElement.append(root);
    readFeedback = { root, animations, frame: 0, timer: 0 };
    const track = () => {
      if (readFeedback?.root !== root) return;
      if (!root.isConnected || (!viewport && !element.isConnected)) {
        clearRead();
        return;
      }
      const bounds = measure();
      root.style.transform = `translate3d(${bounds.x}px,${bounds.y}px,0)`;
      root.style.width = `${bounds.width}px`;
      root.style.height = `${bounds.height}px`;
      readFeedback.frame = requestAnimationFrame(track);
    };
    readFeedback.timer = setTimeout(clearRead, 2000);
    track();
  }
  window.addEventListener("pagehide", clearRead);
  reducedMotion.addEventListener("change", clearRead);
  const overlay = document.createElement("div");
  overlay.setAttribute("data-plasmic-browser-overlay", "");
  overlay.style.cssText =
    "position:fixed;pointer-events:none;z-index:2147483647;border:2px solid #438ff0;background:#438ff00a;display:none;box-sizing:border-box";
  const label = document.createElement("span");
  label.style.cssText =
    "position:absolute;bottom:100%;left:-2px;background:#438ff0;color:white;padding:2px 6px;border-radius:4px 4px 0 0;font:12px/1.5 system-ui;white-space:nowrap";
  overlay.append(label);
  document.documentElement.append(overlay);
  function selector(node) {
    const parts = [];
    while (node && node !== document.documentElement) {
      const tag = node.localName;
      const siblings = node.parentElement
        ? [...node.parentElement.children].filter((el) => el.localName === tag)
        : [];
      parts.unshift(
        tag +
          (siblings.length > 1
            ? `:nth-of-type(${siblings.indexOf(node) + 1})`
            : ""),
      );
      node = node.parentElement;
    }
    return parts.join(" > ");
  }
  function draw(node) {
    if (suspended || !node?.isConnected) {
      overlay.style.display = "none";
      return;
    }
    const rect = node.getBoundingClientRect();
    Object.assign(overlay.style, {
      display: "block",
      top: `${rect.top}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
    label.textContent = node.localName + (node.id ? `#${node.id}` : "");
    label.style.bottom = rect.top < 22 ? "auto" : "100%";
    label.style.top = rect.top < 22 ? "0" : "auto";
  }
  function setSelected(node) {
    selected = node;
    hovered = undefined;
    revision++;
    draw(node);
  }
  document.addEventListener(
    "pointermove",
    (event) => {
      if (!picking) return;
      hovered = event.target instanceof Element ? event.target : undefined;
      draw(hovered);
    },
    true,
  );
  document.addEventListener(
    "click",
    (event) => {
      if (!picking) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setSelected(event.target instanceof Element ? event.target : undefined);
    },
    true,
  );
  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape") {
        picking = false;
        selected = undefined;
        hovered = undefined;
        draw(selected);
        revision++;
      }
    },
    true,
  );
  for (const name of ["scroll", "resize"])
    window.addEventListener(name, () => draw(hovered || selected), true);
  globalThis.__plasmicWebPicker = {
    select(query) {
      if (query) {
        const node = document.querySelector(query);
        if (!node) throw new Error("Page selector was not found");
        setSelected(node);
        picking = false;
      } else {
        picking = !picking;
        hovered = undefined;
        draw(selected);
        revision++;
      }
      return this.snapshot();
    },
    clear() {
      clearRead();
      picking = false;
      selected = undefined;
      hovered = undefined;
      draw();
      revision++;
      return this.snapshot();
    },
    snapshot() {
      if (selected && !selected.isConnected) {
        selected = undefined;
        revision++;
        draw();
      }
      const ancestors = [];
      for (
        let node = selected;
        node && node !== document.documentElement;
        node = node.parentElement
      ) {
        const rect = node.getBoundingClientRect();
        ancestors.unshift({
          tag: node.localName,
          selector: selector(node),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
      }
      let details = null;
      if (selected) {
        const style = getComputedStyle(selected);
        const rect = selected.getBoundingClientRect();
        const entries = (names) =>
          Object.fromEntries(
            names.map((name) => [name, style.getPropertyValue(name)]),
          );
        details = {
          classes: selected.getAttribute("class") || "",
          style: Array.from(style)
            .map((name) => `${name}: ${style.getPropertyValue(name)};`)
            .join("\n"),
          layout: {
            width: `${Math.round(rect.width)}px`,
            height: `${Math.round(rect.height)}px`,
          },
          position: {
            x: `${Math.round(rect.x + scrollX)}px`,
            y: `${Math.round(rect.y + scrollY)}px`,
          },
          padding: entries([
            "padding-top",
            "padding-right",
            "padding-bottom",
            "padding-left",
          ]),
          margin: entries([
            "margin-top",
            "margin-right",
            "margin-bottom",
            "margin-left",
          ]),
          typography: Array.from(selected.childNodes).some(
            (node) =>
              node.nodeType === Node.TEXT_NODE && node.textContent.trim(),
          )
            ? entries(["font-family", "color", "font-size", "line-height"])
            : null,
        };
      }
      return {
        revision,
        picking,
        ancestors,
        selector: selected ? selector(selected) : null,
        details,
      };
    },
    root(target, query) {
      if (query) {
        const node = document.querySelector(query);
        if (!node) throw new Error("Page selector was not found");
        return node;
      }
      if (target === "selection") {
        if (!selected?.isConnected)
          throw new Error("Select an element in the browser first");
        return selected;
      }
      return document.body;
    },
    hide() {
      clearRead();
      suspended = true;
      overlay.style.display = "none";
      // Let Chromium composite the clean page before reading its pixels.
      return new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    },
    restore() {
      suspended = false;
      draw(selected);
    },
    flashRead,
    clearRead,
  };
}

async function capturePage(input) {
  await Promise.race([
    document.fonts.ready,
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
  const root = globalThis.__plasmicWebPicker
    ? globalThis.__plasmicWebPicker.root(input.target, input.selector)
    : document.querySelector(input.selector || "body");
  if (!root) throw new Error("Page selector was not found");
  const clone = root.cloneNode(true);
  const source = [root, ...root.querySelectorAll("*")];
  const copies = [clone, ...clone.querySelectorAll("*")];
  const warnings = new Set();
  const clipHeight =
    Number.isFinite(input.clipHeight) && input.clipHeight > 0
      ? input.clipHeight
      : undefined;
  const properties = [
    "display",
    "position",
    "width",
    "height",
    "min-width",
    "min-height",
    "max-width",
    "max-height",
    "padding",
    "margin",
    "background-color",
    "background-image",
    "background-size",
    "background-position",
    "background-repeat",
    "color",
    "border",
    "border-radius",
    "box-shadow",
    "opacity",
    "font-family",
    "font-size",
    "font-weight",
    "line-height",
    "letter-spacing",
    "text-align",
    "text-decoration-line",
    "text-transform",
    "flex-direction",
    "flex-grow",
    "flex-shrink",
    "flex-basis",
    "flex-wrap",
    "gap",
    "align-items",
    "align-self",
    "justify-content",
    "object-fit",
    "z-index",
    "transform",
    "transform-origin",
  ];
  source.forEach((element, index) => {
    const copy = copies[index];
    if (element.hasAttribute("data-plasmic-browser-overlay")) {
      copy.remove();
      return;
    }
    if (clipHeight && element !== root) {
      const rect = element.getBoundingClientRect();
      if (rect.top + scrollY >= clipHeight || rect.bottom + scrollY <= 0) {
        copy.remove();
        return;
      }
    }
    const style = getComputedStyle(element);
    copy.removeAttribute("style");
    for (const property of properties) {
      let value = style.getPropertyValue(property);
      if (
        ["width", "height"].includes(property) &&
        style.boxSizing === "content-box" &&
        value.endsWith("px")
      ) {
        const sides =
          property === "width" ? ["Left", "Right"] : ["Top", "Bottom"];
        value = `${parseFloat(value) + sides.reduce((sum, side) => sum + (parseFloat(style["padding" + side]) || 0) + (parseFloat(style["border" + side + "Width"]) || 0), 0)}px`;
      }
      if (value) copy.style.setProperty(property, value);
    }
    if (style.display === "grid" || style.display === "inline-grid")
      warnings.add("Grid layouts may need adjustment after import.");
    if (["fixed", "sticky", "absolute"].includes(style.position)) {
      for (const property of ["top", "left", "right", "bottom"])
        copy.style.setProperty(property, style.getPropertyValue(property));
    }
    if (style.display === "none" || style.visibility === "hidden") {
      copy.remove();
      return;
    }
    for (const property of ["src", "href", "poster"]) {
      if (element.hasAttribute(property)) {
        try {
          copy.setAttribute(
            property,
            new URL(element.getAttribute(property), location.href).href,
          );
        } catch {
          copy.removeAttribute(property);
        }
      }
    }
    copy.removeAttribute("srcset");
    if (element instanceof HTMLImageElement) {
      copy.src = element.currentSrc || element.src;
      if (!element.complete || !element.naturalWidth)
        warnings.add("Some source images have not loaded.");
    }
    if (["CANVAS", "IFRAME", "VIDEO"].includes(element.tagName))
      warnings.add(
        "Canvas, embedded pages and video are not imported as editable content.",
      );
    for (const pseudo of ["::before", "::after"]) {
      const content = getComputedStyle(element, pseudo).content;
      if (
        content &&
        content !== "none" &&
        content !== "normal" &&
        content !== '""'
      )
        warnings.add("Generated pseudo-element content may need adjustment.");
    }
  });
  clone
    .querySelectorAll(
      "script,iframe,object,embed,link,style,meta,base,[data-plasmic-browser-overlay]",
    )
    .forEach((node) => node.remove());
  for (const node of [clone, ...clone.querySelectorAll("*")]) {
    for (const attr of [...node.attributes]) {
      if (
        /^on/i.test(attr.name) ||
        attr.name.startsWith("data-") ||
        attr.name === "srcdoc" ||
        /^(javascript|vbscript):/i.test(attr.value.trim())
      )
        node.removeAttribute(attr.name);
    }
  }
  let output = clone;
  if (["BODY", "HTML"].includes(clone.tagName)) {
    output = document.createElement("div");
    output.setAttribute("style", clone.getAttribute("style") || "");
    output.append(...clone.childNodes);
  }
  // A picked section must retain its own layout, independent of source offsets.
  output.style.position = "relative";
  for (const property of [
    "top",
    "left",
    "right",
    "bottom",
    "margin",
    "transform",
  ])
    output.style.removeProperty(property);
  const rect = root.getBoundingClientRect();
  if (clipHeight) {
    output.style.height = `${clipHeight}px`;
    output.style.minHeight = "0px";
    output.style.maxHeight = `${clipHeight}px`;
    output.style.overflow = "hidden";
  }
  return {
    url: location.href,
    title: document.title,
    html: output.outerHTML,
    warnings: [...warnings],
    bounds: {
      x: Math.max(0, rect.x + scrollX),
      y: Math.max(0, rect.y + scrollY),
      width: Math.max(1, Math.ceil(rect.width)),
      height: Math.max(
        1,
        Math.ceil(clipHeight ? Math.min(rect.height, clipHeight) : rect.height),
      ),
    },
    rect: {
      x: Math.max(0, Math.floor(rect.x)),
      y: Math.max(0, Math.floor(rect.y)),
      width: Math.max(1, Math.min(innerWidth, Math.ceil(rect.width))),
      height: Math.max(1, Math.min(innerHeight, Math.ceil(rect.height))),
    },
  };
}

const PICKER_WORLD = 1001;
async function inPage(contents, fn, input) {
  return contents.executeJavaScriptInIsolatedWorld(PICKER_WORLD, [
    { code: `(${fn.toString()})(${JSON.stringify(input)})` },
  ]);
}
module.exports = { installPicker, capturePage, inPage };
