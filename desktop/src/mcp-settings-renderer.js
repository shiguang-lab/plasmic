const clients = document.getElementById("clients");
const notice = document.getElementById("notice");
function render(items) {
  clients.replaceChildren();
  for (const item of items) {
    const row = document.createElement("div");
    row.className = "client";
    const text = document.createElement("div");
    const name = document.createElement("div");
    name.className = "name";
    name.textContent = item.label;
    const detail = document.createElement("div");
    detail.className = "detail" + (item.error ? " error" : "");
    detail.textContent =
      item.error ||
      (item.enabled
        ? "已配置"
        : item.selected
          ? "已选择，配置缺失；重新启用以恢复"
          : "未启用");
    text.title = item.path;
    text.append(name, detail);
    const toggle = document.createElement("button");
    toggle.className = "switch";
    toggle.type = "button";
    toggle.setAttribute("role", "switch");
    toggle.setAttribute("aria-label", item.label);
    toggle.setAttribute("aria-checked", String(item.enabled));
    toggle.addEventListener("click", async () => {
      for (const button of clients.querySelectorAll("button"))
        button.disabled = true;
      notice.textContent = "";
      try {
        const result = await window.mcpSettings.set(item.id, !item.enabled);
        render(
          result.clients.map((client) =>
            result.error && client.id === item.id
              ? { ...client, error: result.error }
              : client,
          ),
        );
        notice.textContent =
          result.error || "配置已更新，请在对应客户端刷新 MCP 配置。";
      } catch {
        notice.textContent = "无法更新 MCP 配置，请关闭弹窗后重试。";
        render(items);
      }
    });
    row.append(text, toggle);
    clients.append(row);
  }
}
document.getElementById("close").onclick = () => window.mcpSettings.close();
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") window.mcpSettings.close();
});
document.getElementById("copy").onclick = async () => {
  try {
    await window.mcpSettings.copy();
    notice.textContent = "MCP 配置已复制。";
  } catch {
    notice.textContent = "复制失败，请重试。";
  }
};
window.mcpSettings
  .get()
  .then((result) => {
    render(result.clients);
    document.getElementById("config").textContent = result.config;
    const service = result.imageService;
    document.getElementById("image-base-url").value = service?.baseUrl || "";
    document.getElementById("image-model").value = service?.model || "";
    document.getElementById("image-status").textContent = service?.configured
      ? "已配置"
      : "未配置";
  })
  .catch(() => {
    clients.textContent = "无法读取 MCP 配置。";
  });

document
  .getElementById("image-service-form")
  .addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = document.getElementById("image-save");
    button.disabled = true;
    const status = document.getElementById("image-status");
    try {
      const result = await window.mcpSettings.setImageService({
        baseUrl: document.getElementById("image-base-url").value.trim(),
        model: document.getElementById("image-model").value.trim(),
        apiKey: document.getElementById("image-api-key").value.trim(),
      });
      status.textContent = result.error || "已保存";
      if (!result.error) document.getElementById("image-api-key").value = "";
    } catch {
      status.textContent = "保存失败，请重试。";
    } finally {
      button.disabled = false;
    }
  });
