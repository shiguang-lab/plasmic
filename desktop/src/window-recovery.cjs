function attachWindowRecovery(studio, { controller, dialog, homeUrl, t }, contents = studio.webContents) {
  const win = studio.window;
  let prompting = false;
  let failedLoadUrl;
  const recover = async (kind) => {
    if (prompting || win.isDestroyed() || studio.webContents !== contents) return;
    prompting = true;
    const unresponsive = kind === "unresponsive";
    const url = contents.getURL();
    try {
      const { response } = await dialog.showMessageBox(win, {
        type: "warning",
        title: t("Plasmic window recovery"),
        message: t(
          unresponsive
            ? "The editor is not responding."
            : kind === "load"
              ? "The editor failed to load."
              : "The editor renderer has exited.",
        ),
        detail: t(
          "Designs saved on the server are preserved. Reloading may discard unsaved changes.",
        ),
        buttons: (unresponsive
          ? ["Keep Waiting", "Reload", "Open Dashboard"]
          : ["Reload", "Open Dashboard", "Cancel"]
        ).map((label) => t(label)),
        // Reopening the same saved canvas can repeat a deterministic crash.
        // Keep reload explicit; the default escape route uses a fresh renderer.
        defaultId: kind === "crash" ? 1 : 0,
        cancelId: unresponsive ? 0 : 2,
      });
      if (win.isDestroyed() || studio.webContents !== contents) return;
      if (
        (!unresponsive && response === 0) ||
        (unresponsive && response === 1)
      ) {
        await studio.loadURL(url || homeUrl);
      } else if (
        (!unresponsive && response === 1) ||
        (unresponsive && response === 2)
      ) {
        await studio.loadURL(homeUrl);
      }
    } catch (error) {
      console.error("Window recovery failed", error);
      dialog.showErrorBox(t("Recovery Failed"), t("Please try again"));
    } finally {
      prompting = false;
    }
  };
  contents.on("render-process-gone", (_event, details) => {
    if (["clean-exit", "still-running"].includes(details.reason)) return;
    controller.cancelPending(contents, "Editor renderer exited: " + details.reason);
    void recover("crash");
  });
  contents.on("unresponsive", () => void recover("unresponsive"));
  contents.on("did-navigate", () => { failedLoadUrl = undefined; });
  contents.on(
    "did-fail-load",
    (_event, code, _description, url, isMainFrame) => {
      // Authentication/navigation retries must not turn one failure into a dialog loop.
      if (!isMainFrame || code === -3 || failedLoadUrl === url) return;
      failedLoadUrl = url;
      void recover("load");
    },
  );
  const closed = () => controller.cancelPending(contents, "Editor window closed");
  contents.once("destroyed", closed);
}
module.exports = { attachWindowRecovery };
