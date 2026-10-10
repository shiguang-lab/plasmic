const { t, subscribe } = window.desktopUiI18n;
let latestItems = [];
let loadState = "loading";
let noticeKey = "";
let noticeFailed = false;
const clients = document.getElementById("clients");
const notice = document.getElementById("notice");
document.getElementById("title").focus();
function render(items) {
  loadState = "ready";
  clients.setAttribute("aria-busy", "false");
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
    toggle.dataset.clientId = item.id;
    toggle.type = "button";
    toggle.setAttribute("role", "switch");
    toggle.setAttribute("aria-label", item.label);
    toggle.setAttribute("aria-checked", String(item.enabled));
    toggle.addEventListener("click", async () => {
      for (const button of clients.querySelectorAll("button")) {
        button.disabled = true;
      }
      showNotice("");
      try {
        const result = await window.mcpSettings.set(item.id, !item.enabled);
        render(
          result.clients.map((client) =>
            result.error && client.id === item.id
              ? { ...client, error: result.error }
              : client,
          ),
        );
        showNotice(
          result.error ||
            "Configuration updated. Restart the client or refresh its MCP configuration.",
          !!result.error,
        );
      } catch {
        showNotice(
          "Unable to update the MCP configuration. Close this dialog and try again.",
          true,
        );
        render(items);
      }
      for (const button of clients.querySelectorAll("button")) {
        if (button.dataset.clientId === item.id) {
          button.focus();
        }
      }
    });
    row.append(text, toggle);
    clients.append(row);
  }
}
document.getElementById("close").onclick = () => window.mcpSettings.close();
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    window.mcpSettings.close();
  }
});
document.getElementById("copy").onclick = async () => {
  try {
    await window.mcpSettings.copy();
    showNotice("MCP configuration copied.");
  } catch {
    showNotice("Copy failed. Please try again.", true);
  }
};
function showNotice(key, failed = false) {
  noticeKey = key;
  noticeFailed = failed;
  notice.textContent = t(key);
  notice.classList.toggle("error", failed);
  notice.setAttribute("role", failed ? "alert" : "status");
}
function renderLoadState() {
  clients.replaceChildren();
  clients.setAttribute("aria-busy", String(loadState === "loading"));
  const message = document.createElement("p");
  message.setAttribute("role", loadState === "failed" ? "alert" : "status");
  message.textContent = t(
    loadState === "failed"
      ? "Unable to read the MCP configuration."
      : "Loading configuration…",
  );
  if (loadState === "failed") {
    message.className = "error";
    const retry = document.createElement("button");
    retry.className = "copy";
    retry.type = "button";
    retry.textContent = t("Retry");
    retry.onclick = load;
    clients.append(message, retry);
  } else {
    clients.append(message);
  }
}
async function load() {
  loadState = "loading";
  renderLoadState();
  try {
    render((await window.mcpSettings.get()).clients);
  } catch {
    loadState = "failed";
    renderLoadState();
  }
}
void load();
subscribe(() => {
  if (loadState === "ready") {
    render(latestItems);
  } else {
    renderLoadState();
  }
  showNotice(noticeKey, noticeFailed);
});
