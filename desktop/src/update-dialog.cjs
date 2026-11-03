const { ipcMain } = require("electron");
function createUpdateDialog(manager, window, webContents) {
  let pending = false;
  let ready = false;
  let showing = false;
  let focusedFrame;
  const send = () => {
    if (
      !pending ||
      !ready ||
      window.isDestroyed() ||
      webContents.isLoadingMainFrame()
    ) {
      return;
    }
    pending = false;
    if (!showing) focusedFrame = webContents.focusedFrame;
    showing = true;
    webContents.send("desktop:update-open", manager.state);
  };
  function open() {
    pending = true;
    send();
    window.show();
    window.focus();
    if (["idle", "current"].includes(manager.state.phase)) {
      void manager.command("check");
    }
  }
  const onLoad = () => {
    ready = true;
    send();
  };
  webContents.on("did-finish-load", onLoad);
  const restoreFocus = (event) => {
    if (!showing || event.sender !== webContents || event.senderFrame !== webContents.mainFrame) return;
    const frame = focusedFrame;
    showing = false;
    focusedFrame = undefined;
    if (window.isDestroyed() || !window.isFocused() || !webContents.isFocused() || !frame || frame.detached || !webContents.mainFrame.framesInSubtree.includes(frame)) return;
    // HTMLDialogElement restores only the outer iframe. Studio's keyboard
    // handlers live in the nested editor frame, which must regain focus too.
    void frame.executeJavaScript("window.focus()").catch(error => console.warn("Cannot restore update dialog focus:", error.message));
  };
  ipcMain.on("desktop:update-dialog-closed", restoreFocus);
  const cleanup = () => {
    webContents.removeListener("did-finish-load", onLoad);
    ipcMain.removeListener("desktop:update-dialog-closed", restoreFocus);
    focusedFrame = undefined;
  };
  webContents.once("destroyed", cleanup);
  return open;
}
module.exports = { createUpdateDialog };
