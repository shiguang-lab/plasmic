(() => {
  const { studioOrigin, canvasOrigin } = document.currentScript?.dataset || {};
  const isMain = window.top === window;
  if (isMain ? !window.desktopUpdates : window.parent !== window.top || location.origin !== canvasOrigin) return;

  let latestStatus;
  const editorFrame = () => document.querySelector("iframe.studio-frame");
  const sendStatus = (status) => {
    latestStatus = status;
    editorFrame()?.contentWindow?.postMessage({ channel: "plasmic-desktop-update-status", status }, canvasOrigin);
    render(status);
  };
  if (isMain) {
    // Only the bundled editor's direct frame may invoke the main-frame bridge.
    window.addEventListener("message", async (event) => {
      if (event.origin !== canvasOrigin || event.source !== editorFrame()?.contentWindow || event.data?.channel !== "plasmic-desktop-update-command") return;
      const command = event.data.command;
      if (!["status", "download", "install", "check"].includes(command)) return;
      if (command === "status" && latestStatus) {
        sendStatus(latestStatus);
        return;
      }
      await runCommand(command);
    });
  } else {
    window.addEventListener("message", (event) => {
      if (event.origin === studioOrigin && event.source === window.parent && event.data?.channel === "plasmic-desktop-update-status") render(event.data.status);
    });
  }

  const style = document.createElement("style");
  style.textContent = `
    #plasmic-desktop-update { display: inline-flex; position: relative; flex-shrink: 0; align-items: center; justify-content: center; width: 36px; height: 36px; margin: 4px 0; -webkit-app-region: no-drag; font: 12px/1.5 -apple-system, BlinkMacSystemFont, sans-serif; }
    #plasmic-desktop-update[hidden] { display: none; }
    #plasmic-desktop-update .update-action { box-sizing: border-box; display: inline-flex; position: relative; align-items: center; justify-content: center; flex-shrink: 0; width: 36px; height: 36px; padding: 0; border: 0; border-radius: 8px; background: transparent; cursor: pointer; font: inherit; }
    #plasmic-desktop-update .update-action:hover { background: #0000000a; }
    #plasmic-desktop-update .update-action:focus-visible { outline: 2px solid #0285ff; outline-offset: 2px; }
    #plasmic-desktop-update .update-action:disabled { cursor: default; }
    #plasmic-desktop-update .update-icon { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%; background: #0285ff; color: white; }
    #plasmic-desktop-update svg { width: 16px; height: 16px; }
    #plasmic-desktop-update .update-label { display: none; }
    aside > footer:has(> #plasmic-desktop-update:not([hidden])) { display: grid; grid-template-columns: minmax(0, 1fr) auto; column-gap: 8px; align-items: center; }
    aside > footer:has(> #plasmic-desktop-update:not([hidden])) > :not(#plasmic-desktop-update):not([data-test-id=btn-dashboard-user]) { grid-column: 1 / -1; }
    aside > footer:has(> #plasmic-desktop-update:not([hidden])) > [data-test-id=btn-dashboard-user] { grid-column: 1; min-width: 0; }
    #plasmic-desktop-update[data-placement=footer] { grid-column: 2; width: auto; height: 28px; margin: 0 8px 0 0; justify-self: end; justify-content: flex-start; }
    #plasmic-desktop-update[data-placement=footer] .update-action { display: grid; grid-template-columns: 0fr; width: auto; min-width: 20px; max-width: 144px; height: 20px; padding: 0 10px; overflow: hidden; border-radius: 999px; background: #0285ff; color: white; transition: grid-template-columns 220ms cubic-bezier(.25,.46,.45,.94), background-color 220ms; }
    #plasmic-desktop-update[data-placement=footer] .update-action:hover { background: #027aeb; }
    #plasmic-desktop-update[data-placement=footer] .update-icon { position: absolute; inset: 0; width: 100%; height: 100%; background: transparent; transition: opacity 80ms, transform 80ms; }
    #plasmic-desktop-update[data-placement=footer] svg { width: 12px; height: 12px; }
    #plasmic-desktop-update[data-placement=footer] .update-label { display: block; min-width: 0; overflow: hidden; white-space: nowrap; text-align: center; opacity: 0; transition: opacity 80ms 140ms; font-size: 10px; font-weight: 600; font-variant-numeric: tabular-nums; }
    #plasmic-desktop-update[data-placement=footer] .update-action:is(:hover,:focus-visible), #plasmic-desktop-update[data-placement=footer][data-phase=downloading] .update-action { grid-template-columns: 1fr; }
    #plasmic-desktop-update[data-placement=footer] .update-action:is(:hover,:focus-visible) .update-icon, #plasmic-desktop-update[data-placement=footer][data-phase=downloading] .update-icon { opacity: 0; transform: scale(.9); }
    #plasmic-desktop-update[data-placement=footer] .update-action:is(:hover,:focus-visible) .update-label, #plasmic-desktop-update[data-placement=footer][data-phase=downloading] .update-label { opacity: 1; }
    #plasmic-desktop-update .update-spinner { animation: plasmic-update-spin 1s linear infinite; }
    #plasmic-desktop-update .update-tooltip { position: fixed; inset: auto; margin: 0; transform: translateY(-50%); width: max-content; max-width: 280px; padding: 6px 10px; border: 0; border-radius: 8px; background: #27272a; color: white; pointer-events: none; font: 12px/1.5 -apple-system, BlinkMacSystemFont, sans-serif; }
    @keyframes plasmic-update-spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { #plasmic-desktop-update * { transition: none !important; animation: none !important; } }
  `;
  document.head.append(style);
  const control = document.createElement("span");
  control.id = "plasmic-desktop-update";
  control.hidden = true;
  const button = document.createElement("button");
  button.className = "update-action";
  button.type = "button";
  const icon = document.createElement("span");
  icon.className = "update-icon";
  icon.setAttribute("aria-hidden", "true");
  const label = document.createElement("span");
  label.className = "update-label";
  label.setAttribute("aria-hidden", "true");
  const tooltip = document.createElement("span");
  tooltip.className = "update-tooltip";
  tooltip.setAttribute("role", "tooltip");
  tooltip.setAttribute("popover", "manual");
  const showTooltip = () => {
    const rect = button.getBoundingClientRect();
    tooltip.style.left = `${rect.right + 8}px`;
    tooltip.style.top = `${rect.top + rect.height / 2}px`;
    tooltip.showPopover();
  };
  control.addEventListener("mouseenter", showTooltip);
  control.addEventListener("mouseleave", () => tooltip.hidePopover());
  control.addEventListener("focusin", showTooltip);
  control.addEventListener("focusout", () => tooltip.hidePopover());
  button.append(icon, label);
  control.append(button, tooltip);
  let command = "check";
  const render = (status) => {
    const { phase, version, percent = 0, error } = status;
    const progress = Math.min(100, Math.max(0, Math.round(percent)));
    control.dataset.phase = phase;
    control.hidden = !["available", "downloading", "downloaded", "installing", "error"].includes(phase);
    if (control.hidden) tooltip.hidePopover();
    const states = {
      available: ["Download Update", `Version ${version} is available. Click to download.`, "download"],
      downloading: [`${progress}%`, `Downloading ${version} · ${progress}%`, "download"],
      downloaded: ["Update", `Update available · ${version}. Click to save your design and restart to install.`, "install"],
      installing: ["Installing", "Saving your design and preparing to install…", "install"],
      error: ["Retry", error || "Update failed. Click to retry.", status.retry || "check"],
    };
    const state = states[phase] || ["Check for Updates", "Check for Updates", "check"];
    label.textContent = state[0];
    tooltip.textContent = state[1];
    button.setAttribute("aria-label", state[1]);
    command = state[2];
    const busy = ["downloading", "installing"].includes(phase);
    button.disabled = busy;
    button.setAttribute("aria-busy", String(busy));
    icon.innerHTML = busy
      ? `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${phase === "downloading" ? `<circle cx="8" cy="8" r="6" opacity=".3"/><circle cx="8" cy="8" r="6" stroke-dasharray="${progress * 37.7 / 100} 37.7" transform="rotate(-90 8 8)"/>` : `<path class="update-spinner" style="transform-origin:8px 8px" d="M8 2a6 6 0 1 1-6 6"/>`}</svg>`
      : `<svg viewBox="64 64 896 896" fill="currentColor" focusable="false" data-icon="download"><path d="M505.7 661a8 8 0 0012.6 0l112-141.7c4.1-5.2.4-12.9-6.3-12.9h-74.1V168c0-4.4-3.6-8-8-8h-60c-4.4 0-8 3.6-8 8v338.3H400c-6.7 0-10.4 7.7-6.3 12.9l112 141.8zM878 626h-60c-4.4 0-8 3.6-8 8v154H214V634c0-4.4-3.6-8-8-8h-60c-4.4 0-8 3.6-8 8v198c0 17.7 14.3 32 32 32h684c17.7 0 32-14.3 32-32V634c0-4.4-3.6-8-8-8z"/></svg>`;
    if (phase === "downloading") {
      control.setAttribute("role", "progressbar");
      control.setAttribute("tabindex", "0");
      control.setAttribute("aria-label", state[1]);
      control.setAttribute("aria-valuemin", "0");
      control.setAttribute("aria-valuemax", "100");
      control.setAttribute("aria-valuenow", String(progress));
    } else {
      for (const attr of ["role", "tabindex", "aria-label", "aria-valuemin", "aria-valuemax", "aria-valuenow"]) control.removeAttribute(attr);
    }
  };
  async function runCommand(action) {
    if (!isMain) {
      window.parent.postMessage({ channel: "plasmic-desktop-update-command", command: action }, studioOrigin);
      return;
    }
    try { sendStatus(await window.desktopUpdates.command(action)); }
    catch (error) { sendStatus({ phase: "error", error: error.message, retry: action }); }
  }
  button.onclick = () => {
    button.disabled = true;
    void runCommand(command);
  };
  let observedDocument;
  function place() {
    const uiDocument = isMain ? document : document.querySelector("iframe.__wab_studio-frame")?.contentDocument || document;
    if (uiDocument !== observedDocument) {
      observer.disconnect();
      observer.observe(document, { childList: true, subtree: true });
      if (uiDocument !== document) observer.observe(uiDocument, { childList: true, subtree: true });
      observedDocument = uiDocument;
    }
    if (uiDocument.head && style.parentElement !== uiDocument.head) uiDocument.head.append(style);
    const strip = uiDocument.getElementById("left-tab-strip");
    const footer = uiDocument.querySelector("aside > footer");
    const parent = strip?.lastElementChild || footer;
    if (!parent) {
      tooltip.hidePopover();
      control.remove();
      return;
    }
    if (control.parentElement === parent) return;
    control.dataset.placement = strip ? "rail" : "footer";
    if (strip) parent.insertBefore(control, parent.lastElementChild);
    else parent.append(control);
  }
  const observer = new MutationObserver(place);
  document.addEventListener("load", place, true);
  place();
  if (isMain) window.desktopUpdates.onStatus(sendStatus);
  void runCommand("status");
})();
