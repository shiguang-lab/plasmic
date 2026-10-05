(() => {
  if (window.top !== window || !window.desktopUpdates) return;
  const style = document.createElement("style");
  style.textContent = `
    #plasmic-desktop-update { margin: 8px 0; padding: 12px; border: 1px solid #e4e4e7; border-radius: 12px; background: #fafafa; color: #27272a; font: 12px/1.5 -apple-system, BlinkMacSystemFont, sans-serif; -webkit-app-region: no-drag; }
    #plasmic-desktop-update[data-floating=true] { position: fixed; left: 12px; bottom: 12px; width: 208px; z-index: 20000; box-shadow: 0 4px 18px #00000012; }
    #plasmic-desktop-update[data-collapsed=true] { width: auto; padding: 8px 10px; }
    #plasmic-desktop-update[data-collapsed=true] .update-body { display: none; }
    #plasmic-desktop-update .update-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-weight: 600; }
    #plasmic-desktop-update button { cursor: pointer; font: inherit; border: 0; border-radius: 7px; background: #27272a; color: white; padding: 7px 10px; }
    #plasmic-desktop-update button:disabled { cursor: default; opacity: .55; }
    #plasmic-desktop-update .update-toggle { background: none; color: inherit; padding: 0; font-weight: 600; }
    #plasmic-desktop-update .update-description { margin: 7px 0; color: #71717a; overflow-wrap: anywhere; }
    #plasmic-desktop-update .update-action { width: 100%; }
    #plasmic-desktop-update progress { width: 100%; height: 5px; accent-color: #27272a; }
    #plasmic-desktop-update .update-notes { max-height: 100px; overflow: auto; white-space: pre-wrap; color: #71717a; margin-top: 8px; }
    #plasmic-desktop-update summary { cursor: pointer; color: #71717a; margin-top: 8px; }
  `;
  document.head.append(style);
  const card = document.createElement("section");
  card.id = "plasmic-desktop-update";
  card.setAttribute("aria-label", "应用更新");
  const heading = document.createElement("div");
  heading.className = "update-heading";
  const toggle = document.createElement("button");
  toggle.className = "update-toggle";
  toggle.type = "button";
  toggle.onclick = () => { card.dataset.collapsed = String(card.dataset.collapsed !== "true"); };
  heading.append(toggle);
  const body = document.createElement("div");
  body.className = "update-body";
  const description = document.createElement("p");
  description.className = "update-description";
  description.setAttribute("role", "status");
  const progress = document.createElement("progress");
  progress.max = 100;
  const button = document.createElement("button");
  button.className = "update-action";
  button.type = "button";
  const details = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = "更新说明";
  const notes = document.createElement("div");
  notes.className = "update-notes";
  details.append(summary, notes);
  body.append(description, progress, button, details);
  card.append(heading, body);
  let command = "check";
  const render = (status) => {
    const { phase, version, currentVersion, percent = 0, error } = status;
    card.dataset.phase = phase;
    toggle.textContent = ["available", "downloading", "downloaded"].includes(phase) ? "↑ Plasmic 更新" : "Plasmic 更新";
    const states = {
      idle: [`当前版本 ${currentVersion}`, "检查更新", "check"],
      checking: ["正在检查新版本…", "正在检查…", "check"],
      current: [`已是最新版本 ${currentVersion}`, "检查更新", "check"],
      available: [`新版本 ${version} 可用`, "下载更新", "download"],
      downloading: [`正在下载 ${version} · ${percent}%`, "正在下载…", "download"],
      downloaded: [`${version} 已下载，安装时将保存当前设计`, "重启并安装", "install"],
      installing: ["正在保存设计并准备安装…", "正在安装…", "install"],
      error: [error || "更新失败，请重试", "重试", status.retry || "check"],
      disabled: ["开发环境不安装更新", "检查更新", "check"],
    };
    const state = states[phase] || states.idle;
    description.textContent = state[0];
    button.textContent = state[1];
    command = state[2];
    button.disabled = ["checking", "downloading", "installing", "disabled"].includes(phase);
    progress.hidden = phase !== "downloading";
    progress.value = percent;
    const releaseNotes = status.releaseNotes;
    notes.textContent = Array.isArray(releaseNotes) ? releaseNotes.map((note) => note.note).join("\n") : typeof releaseNotes === "string" ? releaseNotes : "";
    details.hidden = !notes.textContent;
  };
  button.onclick = async () => {
    button.disabled = true;
    try { render(await window.desktopUpdates.command(command)); }
    catch (error) { render({ phase: "error", error: error.message, retry: command }); }
  };
  function place() {
    const footer = document.querySelector("aside > footer");
    const parent = footer || document.body;
    if (card.parentElement === parent) return;
    card.dataset.floating = String(!footer);
    card.dataset.collapsed = String(!footer);
    if (footer) footer.prepend(card);
    else parent.append(card);
  }
  place();
  new MutationObserver(place).observe(document.body, { childList: true, subtree: true });
  window.desktopUpdates.onStatus(render);
  window.desktopUpdates.command("status").then(render).catch(() => {});
})();
