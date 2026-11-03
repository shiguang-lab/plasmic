// Explicit StudioWindow fixture: native-window operations and renderer IPC are
// separate, so tests can replace the renderer without replacing the window.
function studioFixture(window) {
  if (!window) return undefined;
  if (window.webContents && !window.webContents.isDestroyed) window.webContents.isDestroyed = () => false;
  return {
    window,
    get webContents() { return window.webContents; },
    owns: contents => contents === window.webContents,
    loadURL: (...args) => window.loadURL(...args),
  };
}
module.exports = { studioFixture };
