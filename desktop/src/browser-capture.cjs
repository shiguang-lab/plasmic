const { BrowserWindow } = require("electron");

function checkedUrl(value) {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error("Use an HTTP(S) page URL without credentials");
  return url;
}
function createReferenceWindow(input) {
  const width = input.width || 1366;
  const height = input.height || 900;
  // Reference pages never receive the Studio preload, login cookies or local APIs.
  const window = new BrowserWindow({
    show: false,
    width,
    height,
    useContentSize: true,
    webPreferences: {
      partition: "plasmic-reference-browser",
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      offscreen: true,
      backgroundThrottling: false,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, destination) => {
    if (!["http:", "https:"].includes(new URL(destination).protocol))
      event.preventDefault();
  });
  return window;
}
async function captureReference(window, input) {
  const result = await window.webContents.executeJavaScript(`(async () => {
      await Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 3000))]);
      const selector = ${JSON.stringify(input.selector || "body")};
      const root = document.querySelector(selector);
      if (!root) throw new Error("Page selector was not found");
      root.scrollIntoView({block: "start"});
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const clone = root.cloneNode(true);
      const source = [root, ...root.querySelectorAll("*")];
      const copies = [clone, ...clone.querySelectorAll("*")];
      source.forEach((element, index) => {
        const style = getComputedStyle(element);
        const properties = ["display", "position", "box-sizing", "width", "height", "padding", "margin", "background-color", "color", "border", "border-radius", "font-family", "font-size", "font-weight", "line-height", "text-align"];
      if (style.display.includes("flex")) properties.push("gap", "flex-direction", "align-items", "justify-content");
      if (style.display.includes("grid")) properties.push("gap", "grid-template-columns", "align-items", "justify-content");
      if (["IMG", "VIDEO"].includes(element.tagName)) properties.push("object-fit");
      for (const property of properties) copies[index].style.setProperty(property, style.getPropertyValue(property));
        for (const attr of ["src", "href", "poster"]) if (element.hasAttribute(attr)) copies[index].setAttribute(attr, new URL(element.getAttribute(attr), location.href).href);
        if (element instanceof HTMLImageElement) copies[index].src = element.currentSrc || element.src;
      });
      clone.querySelectorAll("script, iframe, object, embed, link, style").forEach(el => el.remove());
      [clone, ...clone.querySelectorAll("*")].forEach(el => [...el.attributes].forEach(attr => {
        if (/^on/i.test(attr.name) || /^(javascript|vbscript):/i.test(attr.value.trim()) || attr.name === "srcdoc") el.removeAttribute(attr.name);
      }));
      const rect = root.getBoundingClientRect();
      return {url: location.href, title: document.title, html: clone.outerHTML, rect: {x: Math.max(0, Math.floor(rect.x)), y: Math.max(0, Math.floor(rect.y)), width: Math.max(1, Math.min(innerWidth - Math.max(0, Math.floor(rect.x)), Math.ceil(rect.right) - Math.max(0, Math.floor(rect.x)))), height: Math.max(1, Math.min(innerHeight - Math.max(0, Math.floor(rect.y)), Math.ceil(rect.bottom) - Math.max(0, Math.floor(rect.y))))}};
    })()`);
  if (Buffer.byteLength(result.html) > 200000)
    throw new Error(
      "Captured HTML exceeds 200 kB; select a smaller page section",
    );
  const image = await window.webContents.capturePage(
    input.selector ? result.rect : undefined,
  );
  return {
    ...result,
    width: image.getSize().width,
    height: image.getSize().height,
    data: image.toPNG().toString("base64"),
  };
}
async function captureBrowser(input) {
  const url = checkedUrl(input.url);
  const window = createReferenceWindow(input);
  const timer = setTimeout(() => {
    if (!window.isDestroyed()) window.destroy();
  }, 30000);
  try {
    await window.loadURL(url.href);
    return await captureReference(window, input);
  } finally {
    clearTimeout(timer);
    if (!window.isDestroyed()) window.destroy();
  }
}
let reference;
async function browserCommand(input) {
  if (input.action === "load_page") {
    const url = checkedUrl(input.url);
    if (!reference || reference.isDestroyed())
      reference = createReferenceWindow(input);
    else reference.setContentSize(input.width || 1366, input.height || 900);
    await reference.loadURL(url.href);
    return {
      loaded: true,
      url: reference.webContents.getURL(),
      title: reference.webContents.getTitle(),
    };
  }
  if (!reference || reference.isDestroyed())
    throw new Error("Call browser load_page first");
  if (input.action === "close") {
    reference.destroy();
    reference = null;
    return { closed: true };
  }
  if (input.action === "cdp") {
    if (
      !/^(DOM|Input|Page|Runtime|Emulation|CSS|Accessibility)\.[A-Za-z]+$/.test(
        input.method || "",
      )
    )
      throw new Error("Unsupported browser CDP domain");
    if (input.method === "Page.navigate") checkedUrl(input.params?.url);
    const debuggerApi = reference.webContents.debugger;
    if (!debuggerApi.isAttached()) debuggerApi.attach("1.3");
    const result = await debuggerApi.sendCommand(
      input.method,
      input.params || {},
    );
    if (input.method === "Page.captureScreenshot")
      return { data: result.data, url: reference.webContents.getURL() };
    return { result };
  }
  return captureReference(reference, input);
}
module.exports = { captureBrowser, browserCommand };
