function attachWindowRecovery(win, { controller, dialog, homeUrl, t }) {
  let prompting = false;
  const recover = async (kind) => {
    if (prompting || win.isDestroyed()) return;
    prompting = true;
    const unresponsive = kind === "unresponsive";
    const url = win.webContents.getURL();
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
        defaultId: 0,
        cancelId: unresponsive ? 0 : 2,
      });
      if (win.isDestroyed()) return;
      if (
        (!unresponsive && response === 0) ||
        (unresponsive && response === 1)
      ) {
        await win.loadURL(url || homeUrl);
      } else if (
        (!unresponsive && response === 1) ||
        (unresponsive && response === 2)
      ) {
        await win.loadURL(homeUrl);
      }
    } catch (error) {
      dialog.showErrorBox(t("Recovery Failed"), t(error.message));
    } finally {
      prompting = false;
    }
  };
  win.webContents.on("render-process-gone", (_event, details) => {
    if (["clean-exit", "still-running"].includes(details.reason)) return;
    controller.cancelPending(win, "Editor renderer exited: " + details.reason);
    void recover("crash");
  });
  win.on("unresponsive", () => void recover("unresponsive"));
  win.webContents.on(
    "did-fail-load",
    (_event, code, _description, _url, isMainFrame) => {
      if (isMainFrame && code !== -3) void recover("load");
    },
  );
  win.on("closed", () => controller.cancelPending(win, "Editor window closed"));
}
module.exports = { attachWindowRecovery };
