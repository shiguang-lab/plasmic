function attachWindowRecovery(win, { controller, dialog, homeUrl }) {
  let prompting = false;
  const recover = async (kind) => {
    if (prompting || win.isDestroyed()) return;
    prompting = true;
    const unresponsive = kind === "unresponsive";
    const url = win.webContents.getURL();
    try {
      const { response } = await dialog.showMessageBox(win, {
        type: "warning", title: "Plasmic 工作窗口需要恢复",
        message: unresponsive ? "编辑器暂时没有响应。" : kind === "load" ? "编辑器页面加载失败。" : "编辑器渲染进程已退出。",
        detail: "服务器上已保存的设计会保留。重新加载可能丢失尚未保存的修改。",
        buttons: unresponsive ? ["继续等待", "重新加载", "打开项目列表"] : ["重新加载", "打开项目列表", "取消"],
        defaultId: 0, cancelId: unresponsive ? 0 : 2,
      });
      if (win.isDestroyed()) return;
      if ((!unresponsive && response === 0) || (unresponsive && response === 1)) {
        await win.loadURL(url || homeUrl);
      } else if ((!unresponsive && response === 1) || (unresponsive && response === 2)) {
        await win.loadURL(homeUrl);
      }
    } catch (error) {
      dialog.showErrorBox("恢复未完成", error.message);
    } finally { prompting = false; }
  };
  win.webContents.on("render-process-gone", (_event, details) => {
    if (["clean-exit", "still-running"].includes(details.reason)) return;
    controller.cancelPending(win, "Editor renderer exited: " + details.reason);
    void recover("crash");
  });
  win.on("unresponsive", () => void recover("unresponsive"));
  win.webContents.on("did-fail-load", (_event, code, _description, _url, isMainFrame) => {
    if (isMainFrame && code !== -3) void recover("load");
  });
  win.on("closed", () => controller.cancelPending(win, "Editor window closed"));
}
module.exports = { attachWindowRecovery };
