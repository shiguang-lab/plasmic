(() => {
  if (window.top !== window || !window.desktopUpdates) return;
  const host = document.createElement("div");
  host.id = "plasmic-desktop-update-dialog";
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<style>
dialog { color-scheme: light; font: 13px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #242428; background: #fff; --muted: #73737b; --surface: #f6f6f8; --border: #e5e5e9; }
* { box-sizing: border-box; }
dialog { border: 1px solid var(--border); border-radius: 12px; padding: 0; width: 480px; max-width: calc(100vw - 32px); max-height: calc(100vh - 32px); overflow: hidden; box-shadow: 0 12px 40px #0002; }
dialog[open] { display: flex; flex-direction: column; }
dialog::backdrop { background: #18233b4d; }
[hidden] { display: none !important; }
header { position: relative; padding: 20px 56px 12px 24px; flex: none; }
h1 { font-size: 18px; line-height: 1.4; font-weight: 600; margin: 0; letter-spacing: -.2px; }
#description { margin: 0; color: var(--muted); }
main { min-height: 0; flex: 0 1 auto; overflow-y: auto; padding: 0 24px 20px; display: flex; flex-direction: column; gap: 16px; overflow-wrap: anywhere; }
main > * { flex: none; }
.versions { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 10px 12px; border-radius: 6px; background: var(--surface); }
.versions > div { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; }
dt { flex: none; font-size: 12px; color: var(--muted); }
dd { min-width: 0; margin: 0; font-size: 13px; font-weight: 600; text-align: right; }
#latest-version { color: #0285ff; }
h2 { font-size: 12px; font-weight: 600; margin: 0 0 8px; }
#notes { color: var(--muted); }
#notes h3 { font-size: 12px; color: inherit; margin: 0 0 8px; }
#notes p { margin: 0 0 8px; }
#notes ul { margin: 0 0 8px; padding-left: 18px; }
#notes li { margin: 0 0 6px; }
#notes > :last-child { margin-bottom: 0; }
.progress-heading { display: flex; justify-content: space-between; margin-bottom: 6px; color: var(--muted); font-size: 12px; }
progress { display: block; width: 100%; height: 6px; border: 0; border-radius: 6px; overflow: hidden; accent-color: #0285ff; background: var(--surface); }
progress::-webkit-progress-bar { background: var(--surface); }
progress::-webkit-progress-value { background: #0285ff; border-radius: 6px; }
footer { flex: none; display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; padding: 12px 24px; }
button { min-height: 32px; min-width: 72px; border: 1px solid var(--border); border-radius: 6px; padding: 5px 12px; color: inherit; background: #fff; font: inherit; font-weight: 500; cursor: pointer; }
button:hover:enabled { background: var(--surface); }
button:focus-visible { outline: 2px solid #0285ff; outline-offset: 3px; }
#primary[data-emphasis=primary] { background: #0285ff; color: #fff; border-color: #0285ff; }
#primary[data-emphasis=primary]:hover:enabled { background: #0076e6; }
#dismiss { position: absolute; top: 16px; right: 16px; display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; min-width: 0; min-height: 0; padding: 0; border: 0; color: var(--muted); background: transparent; }
#dismiss:hover:enabled { color: #242428; background: var(--surface); }
#dismiss svg { width: 16px; height: 16px; }
button:disabled { opacity: .55; cursor: default; }
</style><dialog aria-label="Software Update">
<header><h1 id="status" role="status" aria-live="polite">Checking for updates…</h1><button id="dismiss" type="button" aria-label="Close software update"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header>
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
  byId("primary").dataset.emphasis = ["downloaded", "error"].includes(phase) ? "primary" : "neutral";
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
