const byId = (id) => document.getElementById(id);
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
    downloading: ["Downloading update…", "You can close this window and keep working while the download continues.", "Downloading…", "download"],
    downloaded: ["Ready to install", "Your current design will be saved before Plasmic restarts.", "Restart and Install", "install"],
    installing: ["Installing update…", "Saving your design and preparing to restart Plasmic.", "Installing…", "install"],
    current: ["You're up to date", "You're running the latest version of Plasmic.", "Done", "close"],
    disabled: ["Updates unavailable", "Open the installed Plasmic app to check for updates.", "Done", "close"],
    error: ["Update couldn't complete", error || "Please try again.", "Retry", retry || "check"],
  };
  const [title, description, label, command] = states[phase] || states.idle;
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
  byId("primary").disabled = true;
  try {
    const result = await window.updateWindow.command(command);
    if (command !== "close") render(result);
  } catch (error) { render({ ...state, phase: "error", error: error.message, retry: command }); }
}
byId("primary").onclick = () => run(action);
byId("secondary").onclick = () => run("close");
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.phase !== "installing") void run("close");
});
window.updateWindow.onStatus(render);
void run("status");
