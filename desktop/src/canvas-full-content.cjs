// Runs only in the isolated static capture document, never the live canvas.
async function expandFullContent() {
  const style = document.createElement("style");
  style.textContent = "*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important;caret-color:transparent!important}";
  document.head.append(style);
  const regions = [...document.querySelectorAll("*")].flatMap((element) => {
    const rect = element.getBoundingClientRect();
    const css = getComputedStyle(element);
    if (!rect.width || !rect.height || element.closest("[hidden]") || css.visibility === "hidden" || css.visibility === "collapse") return [];
    for (let node = element; node; node = node.parentElement) {
      if (getComputedStyle(node).opacity === "0") return [];
    }
    const axes = [];
    if (/^(auto|scroll|overlay)$/.test(css.overflowX) && element.scrollWidth > element.clientWidth + 1) axes.push("x");
    if (/^(auto|scroll|overlay)$/.test(css.overflowY) && element.scrollHeight > element.clientHeight + 1) axes.push("y");
    return axes.length ? [{
      element,
      axes,
      elementUuid: element.getAttribute("data-plasmic-valkey")?.split(".").at(-1) || null,
      viewport: { width: element.clientWidth, height: element.clientHeight },
      content: { width: element.scrollWidth, height: element.scrollHeight },
    }] : [];
  });
  // Inner content must grow before measuring the space its ancestors need.
  for (const { element, axes } of [...regions].reverse()) {
    for (const axis of axes) {
      for (let node = element; node; node = node.parentElement) {
        const css = getComputedStyle(node);
        const vertical = axis === "y";
        const dimension = vertical ? "height" : "width";
        const border = vertical
          ? (parseFloat(css.borderTopWidth) || 0) + (parseFloat(css.borderBottomWidth) || 0)
          : (parseFloat(css.borderLeftWidth) || 0) + (parseFloat(css.borderRightWidth) || 0);
        const size = Math.ceil((vertical ? node.scrollHeight : node.scrollWidth) + border);
        node.style.setProperty("box-sizing", "border-box", "important");
        node.style.setProperty(dimension, "auto", "important");
        node.style.setProperty(`min-${dimension}`, `${size}px`, "important");
        node.style.setProperty(`max-${dimension}`, "none", "important");
        node.style.setProperty("flex-shrink", "0", "important");
        node.style.setProperty(`overflow-${axis}`, "visible", "important");
        node.removeAttribute("data-plasmic-export-scroll-left");
        node.removeAttribute("data-plasmic-export-scroll-top");
        if (vertical) node.scrollTop = 0;
        else node.scrollLeft = 0;
      }
    }
  }
  window.scrollTo(0, 0);
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  return {
    method: "expanded-scroll-regions",
    coverage: "rendered-dom",
    limitations: ["Unmounted virtualized items and content not yet loaded are not included."],
    scrollRegions: regions.map(({ element, ...region }) => region),
    width: Math.ceil(Math.max(innerWidth, document.documentElement.scrollWidth, document.body.scrollWidth)),
    height: Math.ceil(Math.max(innerHeight, document.documentElement.scrollHeight, document.body.scrollHeight)),
  };
}

module.exports = { expandFullContent };
