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
      if (!["status", "open"].includes(command)) return;
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
    #plasmic-desktop-update .update-action { box-sizing: border-box; display: grid; grid-template-columns: 0fr; position: relative; align-items: center; justify-content: center; flex-shrink: 0; width: auto; min-width: 20px; max-width: 144px; height: 20px; padding: 0 10px; overflow: hidden; border: 0; border-radius: 999px; background: #0285ff; color: white; cursor: pointer; font: inherit; transition: grid-template-columns 220ms cubic-bezier(.25,.46,.45,.94), background-color 220ms; }
    #plasmic-desktop-update .update-action:hover { background: #027aeb; }
    #plasmic-desktop-update .update-action:focus-visible { outline: 2px solid #0285ff; outline-offset: 2px; }
    #plasmic-desktop-update .update-action:disabled { cursor: default; }
    #plasmic-desktop-update .update-icon { display: inline-flex; position: absolute; inset: 0; align-items: center; justify-content: center; width: 100%; height: 100%; transition: opacity 80ms, transform 80ms; }
    #plasmic-desktop-update svg { width: 12px; height: 12px; }
    #plasmic-desktop-update .update-label { display: block; min-width: 0; overflow: hidden; white-space: nowrap; text-align: center; opacity: 0; transition: opacity 80ms 140ms; font-size: 10px; font-weight: 600; font-variant-numeric: tabular-nums; }
    #plasmic-desktop-update[data-placement=rail] .update-action { position: absolute; left: 8px; z-index: 1; }
    #plasmic-desktop-update[data-placement=rail] .update-action:popover-open { position: fixed; inset: auto; margin: 0; }
    aside > footer:has(> #plasmic-desktop-update:not([hidden])) { display: grid; grid-template-columns: minmax(0, 1fr) auto; column-gap: 8px; align-items: center; }
    aside > footer:has(> #plasmic-desktop-update:not([hidden])) > :not(#plasmic-desktop-update):not([data-test-id=btn-dashboard-user]) { grid-column: 1 / -1; }
    aside > footer:has(> #plasmic-desktop-update:not([hidden])) > [data-test-id=btn-dashboard-user] { grid-column: 1; min-width: 0; }
    #plasmic-desktop-update[data-placement=footer] { grid-column: 2; width: auto; height: 28px; margin: 0 8px 0 0; justify-self: end; justify-content: flex-start; }
    #plasmic-desktop-update .update-action:is(:hover,:focus-visible,:popover-open), #plasmic-desktop-update[data-placement=footer][data-phase=downloading] .update-action { grid-template-columns: 1fr; }
    #plasmic-desktop-update .update-action:is(:hover,:focus-visible,:popover-open) .update-icon, #plasmic-desktop-update[data-placement=footer][data-phase=downloading] .update-icon { opacity: 0; transform: scale(.9); }
    #plasmic-desktop-update .update-action:is(:hover,:focus-visible,:popover-open) .update-label, #plasmic-desktop-update[data-placement=footer][data-phase=downloading] .update-label { opacity: 1; }
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
    if (control.dataset.placement === "rail" && !button.disabled && !button.hasAttribute("popover")) {
      // The expanded button must escape the toolbar's scrolling container.
      const anchor = button.getBoundingClientRect();
      button.setAttribute("popover", "manual");
      button.style.left = `${anchor.left}px`;
      button.style.top = `${anchor.top}px`;
      button.showPopover();
    }
    const rect = button.getBoundingClientRect();
    tooltip.style.left = `${rect.left + Math.min(144, Math.max(rect.width, label.scrollWidth + 20)) + 8}px`;
    tooltip.style.top = `${rect.top + rect.height / 2}px`;
    tooltip.showPopover();
  };
  const hideTooltip = () => {
    tooltip.hidePopover();
    if (button.hasAttribute("popover")) {
      button.hidePopover();
      button.removeAttribute("popover");
      button.style.removeProperty("left");
      button.style.removeProperty("top");
    }
  };
  control.addEventListener("mouseenter", showTooltip);
  control.addEventListener("mouseleave", hideTooltip);
  control.addEventListener("focusin", showTooltip);
  control.addEventListener("focusout", hideTooltip);
  button.append(icon, label);
  control.append(button, tooltip);
  const render = (status) => {
    const { phase, version, percent = 0, error } = status;
    const progress = Math.min(100, Math.max(0, Math.round(percent)));
    control.dataset.phase = phase;
    control.hidden = !["available", "downloading", "downloaded", "installing", "error"].includes(phase);
    if (control.hidden) hideTooltip();
    const states = {
      available: ["Preparing…", `Preparing update ${version}`],
      downloading: [`${progress}%`, `Downloading ${version} · ${progress}%`],
      downloaded: ["Update", `Update ${version} is ready. Restart Plasmic to install.`],
      installing: ["Installing", "Saving your design and preparing to install…"],
      error: ["Retry", error || "Update failed. Open updates to retry."],
    };
    const state = states[phase] || ["Check for Updates", "Check for Updates"];
    label.textContent = state[0];
    tooltip.textContent = state[1];
    button.setAttribute("aria-label", state[1]);
    const busy = ["available", "downloading", "installing"].includes(phase);
    button.disabled = busy;
    button.setAttribute("aria-busy", String(busy));
    icon.innerHTML = ["downloading", "installing"].includes(phase)
      ? `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${phase === "downloading" ? `<circle cx="8" cy="8" r="6" opacity=".3"/><circle cx="8" cy="8" r="6" stroke-dasharray="${progress * 37.7 / 100} 37.7" transform="rotate(-90 8 8)"/>` : `<path class="update-spinner" style="transform-origin:8px 8px" d="M8 2a6 6 0 1 1-6 6"/>`}</svg>`
      : phase === "downloaded"
        ? `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" data-icon="restart"><path d="M13 6a5 5 0 1 0 .2 3.5M13 2v4H9"/></svg>`
        : `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" data-icon="${phase === "error" ? "error" : "download"}">${phase === "error" ? `<path d="M8 3v6M8 12v.1"/>` : `<path d="M8 2v8m-3-3 3 3 3-3M3 11v3h10v-3"/>`}</svg>`;
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
    hideTooltip();
    button.disabled = true;
    void runCommand("open");
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
      hideTooltip();
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
