const { BrowserWindow } = require("electron");
const { capturePage, inPage } = require("./browser-page.cjs");

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
  window.webContents.on("will-navigate", (event) => {
    try {
      checkedUrl(event.url);
    } catch {
      event.preventDefault();
    }
  });
  return window;
}
async function captureReference(window, input) {
  const result = await inPage(window.webContents, capturePage, input);
  if (Buffer.byteLength(result.html) > 200000)
    throw new Error(
      "Captured HTML exceeds 200 kB; select a smaller page section",
    );
  if (input.htmlOnly) return result;
  const image = await window.webContents.capturePage(
    input.selector || input.target === "selection" ? result.rect : undefined,
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
module.exports = { captureBrowser, captureReference, checkedUrl };
