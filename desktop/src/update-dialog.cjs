function createUpdateDialog(manager, window) {
  const webContents = window.webContents;
  let pending = false;
  let ready = false;
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
  window.once("closed", () => {
    webContents.removeListener("did-finish-load", onLoad);
  });
  return open;
}
module.exports = { createUpdateDialog };
