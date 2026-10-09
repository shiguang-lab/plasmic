const { t, subscribe } = window.desktopUiI18n;
let latestItems = [];
const clients = document.getElementById("clients");
const notice = document.getElementById("notice");
document.getElementById("title").focus();
function render(items) {
  latestItems = items;
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
    detail.textContent = t(
      item.error ||
        (item.enabled
          ? "Configured"
          : item.selected
            ? "Configuration missing. Enable again to restore it."
            : "Not configured"),
    );
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
        notice.textContent = t(
          result.error ||
            "Configuration updated. Restart the client or refresh its MCP configuration.",
        );
      } catch {
        notice.textContent = t(
          "Unable to update the MCP configuration. Close this dialog and try again.",
        );
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
    notice.textContent = t("MCP configuration copied.");
  } catch {
    notice.textContent = t("Copy failed. Please try again.");
  }
};
window.mcpSettings
  .get()
  .then((result) => {
    render(result.clients);
  })
  .catch(() => {
    clients.textContent = t("Unable to read the MCP configuration.");
  });

subscribe(() => render(latestItems));
