(() => {
  const { studioOrigin, canvasOrigin } = document.currentScript?.dataset || {};
  const isMain = window.top === window;
  if (
    isMain
      ? !window.desktopUpdates
      : window.parent !== window.top || location.origin !== canvasOrigin
  ) {
    return;
  }

  const { t, setSnapshot, snapshot, subscribe } = window.desktopUiI18n;
  let latestStatus;
  const editorFrame = () => document.querySelector("iframe.studio-frame");
  const sendStatus = (status) => {
    latestStatus = status;
    editorFrame()?.contentWindow?.postMessage(
      { channel: "plasmic-desktop-update-status", status },
      canvasOrigin,
    );
    render(status);
  };
  const sendLocale = () =>
    editorFrame()?.contentWindow?.postMessage(
      { channel: "plasmic-desktop-ui-locale", localization: snapshot() },
      canvasOrigin,
    );
  if (isMain) {
    // Only the bundled editor's direct frame may invoke the main-frame bridge.
    window.addEventListener("message", async (event) => {
      if (
        event.origin !== canvasOrigin ||
        event.source !== editorFrame()?.contentWindow ||
        event.data?.channel !== "plasmic-desktop-update-command"
      ) {
        return;
      }
      const command = event.data.command;
      if (!["status", "open"].includes(command)) {
        return;
      }
      if (command === "status") {
        sendLocale();
      }
      if (command === "status" && latestStatus) {
        sendStatus(latestStatus);
        return;
      }
      await runCommand(command);
    });
  } else {
    window.addEventListener("message", (event) => {
      if (event.origin !== studioOrigin || event.source !== window.parent) {
        return;
      }
      if (event.data?.channel === "plasmic-desktop-update-status") {
        render(event.data.status);
      }
      if (event.data?.channel === "plasmic-desktop-ui-locale") {
        setSnapshot(event.data.localization);
      }
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
    #plasmic-desktop-update[data-placement=footer] { width: 100%; }
    #plasmic-desktop-update .update-action:is(:hover,:focus-visible,:popover-open), #plasmic-desktop-update[data-placement=footer][data-phase=downloading] .update-action { grid-template-columns: 1fr; }
    #plasmic-desktop-update .update-action:is(:hover,:focus-visible,:popover-open) .update-icon, #plasmic-desktop-update[data-placement=footer][data-phase=downloading] .update-icon { opacity: 0; transform: scale(.9); }
    #plasmic-desktop-update .update-action:is(:hover,:focus-visible,:popover-open) .update-label, #plasmic-desktop-update[data-placement=footer][data-phase=downloading] .update-label { opacity: 1; }
    #plasmic-desktop-update .update-spinner { animation: plasmic-update-spin 1s linear infinite; }
    #plasmic-desktop-update .update-tooltip { position: fixed; inset: auto; margin: 0; transform: translateY(-50%); width: max-content; max-width: 280px; padding: 6px 10px; border: 0; border-radius: 8px; overflow: visible; background: #27272a; color: white; pointer-events: none; font: 12px/1.5 -apple-system, BlinkMacSystemFont, sans-serif; }
    [data-desktop-update-slot=header] { display: inline-flex; align-items: center; -webkit-app-region: no-drag; }
    [data-desktop-update-slot=header]:empty, [data-desktop-update-slot=header]:has(> [hidden]) { display: none; }
    #plasmic-desktop-update[data-placement=header] { width: auto; height: 32px; margin: 0; color: inherit; }
    #plasmic-desktop-update[data-placement=header] .update-action { display: flex; gap: 6px; height: 32px; min-width: 32px; max-width: 112px; padding: 0 8px; border-radius: 8px; background: transparent; color: inherit; }
    #plasmic-desktop-update[data-placement=header] .update-action:hover { background: color-mix(in srgb, currentColor 8%, transparent); }
    #plasmic-desktop-update[data-placement=header] .update-icon { position: static; width: 16px; height: 16px; opacity: .65; transform: none; }
    #plasmic-desktop-update[data-placement=header] .update-action:is(:hover,:focus-visible) .update-icon { opacity: 1; transform: none; }
    #plasmic-desktop-update[data-placement=header] svg { width: 16px; height: 16px; }
    #plasmic-desktop-update[data-placement=header] .update-label { display: none; font-size: 12px; font-weight: 500; opacity: 1; }
    #plasmic-desktop-update[data-placement=header][data-phase=downloading] .update-label { display: block; }
    #plasmic-desktop-update[data-placement=header][data-compact=true] .update-label { display: none; }
    #plasmic-desktop-update[data-placement=header]:is([data-phase=downloading],[data-phase=downloaded]) .update-icon { opacity: 1; }
    #plasmic-desktop-update[data-placement=header][data-phase=downloaded] .update-action { color: #0285ff; background: color-mix(in srgb, #0285ff 10%, transparent); }
    #plasmic-desktop-update[data-placement=header] .update-tooltip { box-sizing: border-box; max-width: min(280px, calc(100vw - 16px)); transform: none; }
    #plasmic-desktop-update[data-placement=header] .update-tooltip::before { content: ""; position: absolute; top: -4px; left: var(--update-tooltip-arrow-x); width: 8px; height: 8px; background: inherit; transform: translateX(-50%) rotate(45deg); }
    #plasmic-desktop-update[data-tooltip-side=above] .update-tooltip::before { top: auto; bottom: -4px; }
    @media (max-width: 1200px) { #plasmic-desktop-update[data-placement=header] .update-label { display: none !important; } }
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
    const header = control.dataset.placement === "header";
    tooltip.style.left = `${header ? rect.left : rect.left + Math.min(144, Math.max(rect.width, label.scrollWidth + 20)) + 8}px`;
    tooltip.style.top = `${header ? rect.bottom + 8 : rect.top + rect.height / 2}px`;
    tooltip.showPopover();
    if (header) {
      const width = tooltip.getBoundingClientRect().width;
      const left = Math.max(
        8,
        Math.min(
          rect.left + (rect.width - width) / 2,
          window.innerWidth - width - 8,
        ),
      );
      tooltip.style.left = `${left}px`;
      if (control.dataset.tooltipSide === "above") {
        tooltip.style.top = `${rect.top - tooltip.getBoundingClientRect().height - 8}px`;
      }
      tooltip.style.setProperty(
        "--update-tooltip-arrow-x",
        `${rect.left + rect.width / 2 - left}px`,
      );
    }
  };
  const hideTooltip = () => {
    tooltip.hidePopover();
  };
  control.addEventListener("mouseenter", showTooltip);
  control.addEventListener("mouseleave", hideTooltip);
  control.addEventListener("focusin", showTooltip);
  control.addEventListener("focusout", hideTooltip);
  window.addEventListener("resize", () => {
    if (
      control.dataset.placement === "header" &&
      tooltip.matches(":popover-open")
    ) {
      showTooltip();
    }
  });
  button.append(icon, label);
  control.append(button, tooltip);
  const render = (status) => {
    latestStatus = status;
    const { phase, version, percent = 0 } = status;
    const progress = Math.min(100, Math.max(0, Math.round(percent)));
    control.dataset.phase = phase;
    control.hidden = ![
      "available",
      "downloading",
      "downloaded",
      "installing",
    ].includes(phase);
    if (control.hidden) {
      hideTooltip();
    }
    const states = {
      available: ["Preparing…", t("Preparing update {version}", { version })],
      downloading: [
        `${progress}%`,
        t("Downloading {version} · {progress}%", { version, progress }),
      ],
      downloaded: [
        "Update",
        t("Update {version} is ready. Restart Plasmic to install.", {
          version,
        }),
      ],
      installing: [
        "Installing",
        "Saving your design and preparing to install…",
      ],
    };
    const state = states[phase] || ["Check for Updates", "Check for Updates"];
    label.textContent = t(state[0]);
    tooltip.textContent = t(state[1]);
    button.setAttribute("aria-label", t(state[1]));
    const busy = ["available", "downloading", "installing"].includes(phase);
    button.disabled = busy;
    button.setAttribute("aria-busy", String(busy));
    icon.innerHTML = ["downloading", "installing"].includes(phase)
      ? `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${phase === "downloading" ? `<circle cx="8" cy="8" r="6" opacity=".3"/><circle cx="8" cy="8" r="6" stroke-dasharray="${(progress * 37.7) / 100} 37.7" transform="rotate(-90 8 8)"/>` : `<path class="update-spinner" style="transform-origin:8px 8px" d="M8 2a6 6 0 1 1-6 6"/>`}</svg>`
      : `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" data-icon="download"><path d="M8 2v8m-3-3 3 3 3-3M3 11v3h10v-3"/></svg>`;
    if (phase === "downloading") {
      control.setAttribute("role", "progressbar");
      control.setAttribute("tabindex", "0");
      control.setAttribute("aria-label", t(state[1]));
      control.setAttribute("aria-valuemin", "0");
      control.setAttribute("aria-valuemax", "100");
      control.setAttribute("aria-valuenow", String(progress));
    } else {
      for (const attr of [
        "role",
        "tabindex",
        "aria-label",
        "aria-valuemin",
        "aria-valuemax",
        "aria-valuenow",
      ]) {
        control.removeAttribute(attr);
      }
    }
  };
  async function runCommand(action) {
    if (!isMain) {
      window.parent.postMessage(
        { channel: "plasmic-desktop-update-command", command: action },
        studioOrigin,
      );
      return;
    }
    try {
      sendStatus(await window.desktopUpdates.command(action));
    } catch {
      sendStatus({
        phase: "current",
        currentVersion: latestStatus?.currentVersion,
      });
    }
  }
  button.onclick = () => {
    hideTooltip();
    button.disabled = true;
    void runCommand("open");
  };
  let observedDocument;
  function place() {
    const uiDocument = isMain
      ? document
      : document.querySelector("iframe.__wab_studio-frame")?.contentDocument ||
        document;
    if (uiDocument !== observedDocument) {
      observer.disconnect();
      observer.observe(document, { childList: true, subtree: true });
      if (uiDocument !== document) {
        observer.observe(uiDocument, { childList: true, subtree: true });
      }
      observedDocument = uiDocument;
    }
    if (uiDocument.head && style.parentElement !== uiDocument.head) {
      uiDocument.head.append(style);
    }
    const header = [
      ...uiDocument.querySelectorAll('[data-desktop-update-slot="header"]'),
    ].find((slot) =>
      slot.parentElement?.checkVisibility({ checkVisibilityCSS: true }),
    );
    const footer = uiDocument.querySelector("aside > footer");
    const parent = header || footer;
    if (!parent) {
      hideTooltip();
      control.remove();
      return;
    }
    if (control.parentElement === parent) {
      return;
    }
    hideTooltip();
    control.dataset.placement = header ? "header" : "footer";
    control.dataset.tooltipSide =
      header?.dataset.desktopUpdatePosition || "below";
    control.dataset.compact =
      header?.dataset.desktopUpdateCompact === "true" ? "true" : "false";
    parent.append(control);
    if (latestStatus) {
      render(latestStatus);
    }
  }
  const observer = new MutationObserver(place);
  document.addEventListener("load", place, true);
  place();
  if (isMain) {
    subscribe(() => {
      sendLocale();
      if (latestStatus) {
        render(latestStatus);
      }
    });
    window.desktopUpdates.onStatus(sendStatus);
  }
  if (!isMain) {
    subscribe(() => {
      if (latestStatus) {
        render(latestStatus);
      }
    });
  }
  void runCommand("status");
})();
