function createUpdateDialog(manager, window) {
  const webContents = window.webContents;
  let phase = manager.state.phase;
  let pending = phase === "downloaded";
  let ready = false;
  const send = () => {
    if (!pending || !ready || window.isDestroyed() || webContents.isLoadingMainFrame()) return;
    pending = false;
    webContents.send("desktop:update-open", manager.state);
  };
  function open() {
    pending = true;
    send();
    window.show();
    window.focus();
    if (["idle", "current"].includes(manager.state.phase)) void manager.command("check");
  }
  const onStatus = (status) => {
    const completed = status.phase === "downloaded" && phase !== "downloaded";
    phase = status.phase;
    if (completed) { pending = true; send(); }
  };
  manager.on("status", onStatus);
  const onLoad = () => { ready = true; send(); };
  webContents.on("did-finish-load", onLoad);
  window.once("closed", () => {
    manager.removeListener("status", onStatus);
    webContents.removeListener("did-finish-load", onLoad);
  });
  return open;
}
module.exports = { createUpdateDialog };
