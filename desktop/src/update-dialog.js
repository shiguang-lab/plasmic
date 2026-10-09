(() => {
  if (window.top !== window || !window.desktopUpdates) return;
  const host = document.createElement("div");
  host.id = "plasmic-desktop-update-dialog";
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<style>
dialog { color-scheme: light; font: 13px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #242428; background: #fff; --muted: #73737b; --surface: #f6f6f8; --border: #e5e5e9; }
* { box-sizing: border-box; }
dialog { border: 1px solid var(--border); border-radius: 16px; padding: 28px; width: 560px; max-width: calc(100vw - 48px); max-height: calc(100vh - 48px); box-shadow: 0 24px 80px #0003; }
dialog[open] { display: flex; flex-direction: column; gap: 20px; }
dialog::backdrop { background: #18233b4d; }
header > div { flex: 1; }
#dismiss { font-size: 20px; line-height: 1; padding: 4px 8px; }
[hidden] { display: none !important; }
header { display: flex; align-items: center; gap: 16px; flex: none; }
.eyebrow { color: var(--muted); font-size: 11px; font-weight: 600; margin-bottom: 3px; }
h1 { font-size: 20px; line-height: 1.3; font-weight: 600; margin: 0; letter-spacing: -.3px; }
#description { margin: 8px 0 0; color: var(--muted); }
main { min-height: 0; flex: 1; display: flex; flex-direction: column; gap: 18px; }
.versions { display: flex; gap: 24px; margin: 0; padding: 12px 16px; border-radius: 10px; background: var(--surface); }
dt { font-size: 11px; color: var(--muted); }
dd { margin: 2px 0 0; font-size: 14px; font-weight: 600; }
#latest-version { color: #0285ff; }
#notes-section { min-height: 0; flex: 1; display: flex; flex-direction: column; }
h2 { font-size: 12px; font-weight: 600; margin: 0 0 8px; }
#notes { min-height: 0; max-height: 240px; overflow-y: auto; padding-right: 8px; color: var(--muted); }
#notes h3 { font-size: 12px; color: inherit; margin: 0 0 8px; }
#notes p { margin: 0 0 8px; }
#notes ul { margin: 0 0 8px; padding-left: 18px; }
#notes li { margin: 0 0 6px; }
.progress-heading { display: flex; justify-content: space-between; margin-bottom: 6px; color: var(--muted); font-size: 12px; }
progress { display: block; width: 100%; height: 6px; border: 0; border-radius: 6px; overflow: hidden; accent-color: #0285ff; background: var(--surface); }
progress::-webkit-progress-bar { background: var(--surface); }
progress::-webkit-progress-value { background: #0285ff; border-radius: 6px; }
footer { flex: none; display: flex; gap: 8px; justify-content: flex-end; border-top: 1px solid var(--border); padding-top: 16px; }
button { border: 1px solid var(--border); border-radius: 7px; padding: 7px 14px; color: inherit; background: transparent; font: inherit; font-weight: 500; cursor: pointer; }
button:hover { background: var(--surface); }
button:focus-visible { outline: 2px solid #0285ff; outline-offset: 3px; }
#primary { background: #0285ff; color: #fff; border-color: #0285ff; }
#primary:hover { background: #0076e6; }
button:disabled { opacity: .55; cursor: default; }
</style><dialog aria-label="Software Update">
<header><div><div class="eyebrow">PLASMIC</div><h1 id="status" role="status" aria-live="polite">Checking for updates…</h1></div><button id="dismiss" type="button" aria-label="Close software update">×</button></header>
<main>
<p id="description">Looking for the latest version of Plasmic.</p>
<dl class="versions"><div><dt>Installed version</dt><dd id="current-version">—</dd></div><div id="latest" hidden><dt>New version</dt><dd id="latest-version"></dd></div></dl>
<section id="notes-section" hidden aria-labelledby="notes-heading"><h2 id="notes-heading">What's new</h2><div id="notes"></div></section>
<section id="download" hidden><div class="progress-heading"><span>Downloading update</span><span id="percent">0%</span></div><progress id="progress" max="100" value="0" aria-label="Download progress"></progress></section>
</main>
<footer><button id="secondary">Close</button><button id="primary" disabled>Checking…</button></footer>
</dialog>`;
  document.body.append(host);
  const dialog = root.querySelector("dialog");
const byId = (id) => root.getElementById(id);
let state = {};
let action = "check";
let previousNotes;
function renderNotes(value) {
  if (value === previousNotes) return;
  previousNotes = value;
  const notes = byId("notes");
  notes.replaceChildren();
  const text = Array.isArray(value) ? value.map((entry) => entry.note || "").join("\n\n") : value || "";
  let list;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) { list = undefined; continue; }
    if (/^[-*]\s+/.test(line)) {
      if (!list) { list = document.createElement("ul"); notes.append(list); }
      const item = document.createElement("li");
      item.textContent = line.replace(/^[-*]\s+/, "");
      list.append(item);
    } else {
      list = undefined;
      const heading = /^#{1,6}\s+/.test(line);
      const element = document.createElement(heading ? "h3" : "p");
      element.textContent = heading ? line.replace(/^#{1,6}\s+/, "") : line;
      notes.append(element);
    }
  }
  byId("notes-section").hidden = !text.trim();
}
function render(status) {
  state = status;
  const { phase, version, currentVersion, error, retry } = status;
  const states = {
    idle: ["Checking for updates…", "Looking for the latest version of Plasmic.", "Checking…", "check"],
    checking: ["Checking for updates…", "Looking for the latest version of Plasmic.", "Checking…", "check"],
    available: ["Preparing update…", "The update will download automatically in the background.", "Preparing…", "check"],
    downloading: ["Downloading update…", "You can close this dialog and keep working while the download continues.", "Downloading…", "download"],
    downloaded: ["Ready to install", "Your current design will be saved before Plasmic restarts.", "Restart and Install", "install"],
    installing: ["Installing update…", "Saving your design and preparing to restart Plasmic.", "Installing…", "install"],
    current: ["You're up to date", "You're running the latest version of Plasmic.", "Done", "close"],
    disabled: ["Updates unavailable", "Open the installed Plasmic app to check for updates.", "Done", "close"],
    error: ["Update couldn't complete", error || "Please try again.", "Retry", retry || "check"],
  };
  const [title, description, label, command] = states[phase] || states.idle;
  byId("dismiss").disabled = phase === "installing";
  byId("status").textContent = title;
  byId("description").textContent = description;
  byId("current-version").textContent = currentVersion || "—";
  byId("latest-version").textContent = version || "";
  byId("latest").hidden = !version;
  renderNotes(status.releaseNotes);
  byId("download").hidden = phase !== "downloading";
  const percent = Math.min(100, Math.max(0, Math.floor(status.percent || 0)));
  byId("progress").value = percent;
  byId("percent").textContent = `${percent}%`;
  byId("primary").textContent = label;
  byId("primary").disabled = ["idle", "checking", "available", "downloading", "installing"].includes(phase);
  byId("secondary").hidden = ["current", "disabled", "installing"].includes(phase);
  byId("secondary").textContent = ["available", "downloaded"].includes(phase) ? "Later" : "Close";
  action = command;
}
async function run(command) {
  if (command === "close") {
    if (state.phase !== "installing") dialog.close();
    return;
  }
  byId("primary").disabled = true;
  try {
    const result = await window.desktopUpdates.command(command);
    if (command !== "close") render(result);
  } catch (error) { render({ ...state, phase: "error", error: error.message, retry: command }); }
}
byId("primary").onclick = () => run(action);
byId("secondary").onclick = () => run("close");
byId("dismiss").onclick = () => run("close");
dialog.addEventListener("cancel", (event) => {
  if (state.phase === "installing") event.preventDefault();
});
window.desktopUpdates.onStatus(render);
window.desktopUpdates.onOpen((status) => {
  render(status);
  if (!dialog.open) dialog.showModal();
});
void run("status");

})();
