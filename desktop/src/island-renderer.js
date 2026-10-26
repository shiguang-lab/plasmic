(() => {
  const api = window.desktopIsland;
  const $ = (id) => document.getElementById(id);
  const shell = $("shell"), card = $("card"), mirror = $("mirror");
  const t = (key, values) => window.desktopUiI18n.t(key, values);
  let state, opened = false, expandedWidth = 360;
  let received = false, frameSource, frameImage, loadingSource, imageVersion = 0;
  let animation, lastTime, lastHit = 0;
  let feedbackKey, feedbackId;
  const spring = { width: 130, height: 40, radius: 20, vw: 0, vh: 0, vr: 0 };
  const send = (command, value) => api.command(command, value).catch(console.error);
  const activity = () => state?.activity || {};
  function reportHit() {
    const r = shell.getBoundingClientRect();
    void send("hit", { x: r.x, y: r.y, width: r.width, height: r.height, radius: Math.max(0, spring.radius) });
  }
  function animate(now) {
    const dt = Math.min((now - (lastTime || now - 16)) / 1000, .025);
    lastTime = now;
    const width = opened ? expandedWidth : Math.min(280, $("capsule").scrollWidth + 2);
    const target = { width, height: opened ? 144 : 40, radius: opened ? 12 : 20 };
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let settled = true;
    for (const [key, velocity, stiffness, damping] of [["width", "vw", 520, 39], ["height", "vh", 430, 34], ["radius", "vr", 470, 38]]) {
      spring[velocity] += ((target[key] - spring[key]) * stiffness - spring[velocity] * damping) * dt;
      spring[key] += spring[velocity] * dt;
      if (reduced || Math.abs(spring[key] - target[key]) < .08 && Math.abs(spring[velocity]) < .1) {
        spring[key] = target[key]; spring[velocity] = 0;
      } else settled = false;
    }
    shell.style.width = `${spring.width}px`;
    shell.style.height = `${spring.height}px`;
    shell.style.borderRadius = `${spring.radius}px`;
    if (now - lastHit >= 40 || settled) { lastHit = now; reportHit(); }
    animation = settled ? undefined : requestAnimationFrame(animate);
    if (settled) lastTime = undefined;
  }
  function motion() { if (!animation) animation = requestAnimationFrame(animate); }
  function open(value) {
    if (opened === value) return;
    opened = value;
    shell.dataset.expanded = String(value);
    card.inert = !value;
    card.setAttribute("aria-hidden", String(!value));
    $("capsule").inert = value;
    motion();
  }
  function renderUpdate() {
    const update = state.update || {phase:"disabled"};
    const {phase, version, currentVersion} = update;
    const percent = Number.isFinite(update.percent) ? Math.min(100, Math.max(0, Math.floor(update.percent))) : 0;
    const visible = ["available", "downloading", "downloaded", "installing"].includes(phase);
    const description = phase === "downloading" ? t("Downloading {version} · {progress}%", {version, progress:percent})
      : phase === "downloaded" ? t("Update {version} is ready. Restart Plasmic to install.", {version})
      : phase === "installing" ? t("Saving your design and preparing to install…")
      : phase === "available" ? t("Preparing update {version}", {version}) : t("Checking for updates…");
    const icon = phase === "installing" ? '<path d="M8 2a6 6 0 1 1-6 6"/>'
      : phase === "downloading" ? `<circle cx="8" cy="8" r="6" opacity=".3"/><circle cx="8" cy="8" r="6" stroke-dasharray="${percent*37.7/100} 37.7" transform="rotate(-90 8 8)"/>`
      : '<path d="M8 2v8m-3-3 3 3 3-3M3 11v3h10v-3"/>';
    for (const button of [$("capsule-update"), $("card-update")]) {
      button.hidden = !visible;
      button.dataset.phase = phase;
      button.title = description;
      button.setAttribute("aria-label", description);
      button.setAttribute("aria-busy", String(["checking","available","downloading","installing"].includes(phase)));
      const glyph = `${phase}:${percent}`;
      if (button.dataset.glyph !== glyph) {
        button.dataset.glyph = glyph;
        button.innerHTML = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon}</svg>`;
      }
    }
    const panelOpen = state.updateOpen === true;
    $("card").querySelector(".body").hidden = panelOpen;
    $("update-panel").hidden = !panelOpen;
    const labels = {
      idle:["Checking for updates…", ""],
      checking:["Checking for updates…", ""],
      available:["Preparing update…", "The update will download automatically in the background."],
      downloading:["Downloading update…", "You can close this dialog and keep working while the download continues."],
      downloaded:["Ready to install", "Your current design will be saved before Plasmic restarts."],
      installing:["Installing update…", state.updateWaiting ? "Your current operations will finish before Plasmic restarts." : "Saving your design and preparing to restart Plasmic."],
      current:["You're up to date", ""],
      error:["Update could not be completed", "Try again when your connection and design are ready."],
      disabled:["Updates unavailable", "Open the installed Plasmic app to check for updates."],
    };
    const [title, detail] = labels[phase] || labels.idle;
    const text = (id, value) => { if ($(id).textContent !== value) $(id).textContent = value; };
    text("update-heading", t("Software Update"));
    text("update-title", t(phase === "installing" && state.updateWaiting ? "Waiting for current operations" : title));
    text("update-versions", version ? `${currentVersion || "—"} → ${version}` : currentVersion || "—");
    text("update-description", t(detail));
    $("update-description").hidden = !detail;
    $("update-panel").dataset.phase = phase;
    $("update-retry").hidden = phase !== "error";
    $("update-retry").textContent = t("Retry");
    text("update-install", t(phase === "installing" ? state.updateWaiting ? "Waiting…" : "Installing…" : "Restart and Install"));
    text("update-later", t(["available", "downloaded"].includes(phase) ? "Later" : "Close"));
    $("update-progress").hidden = phase !== "downloading";
    $("update-progress").value = percent;
    $("update-progress").setAttribute("aria-label", description);
    if (phase === "downloading") text("update-title", `${t(title)} ${percent}%`);
    $("update-install").hidden = !["downloaded", "installing"].includes(phase);
    $("update-install").disabled = phase !== "downloaded";
    $("update-later").disabled = $("update-dismiss").disabled = phase === "installing";
    $("update-dismiss").setAttribute("aria-label", t("Close software update"));
  }
  const icons = {
    running: '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M6 1a5 5 0 1 1-5 5"/></svg>',
    completed: '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><path d="m2 6 3 3 5-6"/></svg>',
    failed: '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="6" cy="6" r="4.5"/><path d="m4.5 4.5 3 3m0-3-3 3"/></svg>',
    blocked: '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><path d="m6 1 5 9H1Z"/><path d="M6 4v2.5m0 1v1"/></svg>',
    queued: '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="6" cy="6" r="4.5"/><path d="M6 3v3l2 1"/></svg>',
    idle: '<svg viewBox="0 0 12 12" fill="currentColor"><circle cx="6" cy="6" r="2"/></svg>',
  };
  const saveStates = {saved:"Saved",pending:"Unsaved",saving:"Saving",error:"Save failed",blocked:"Saving blocked",unlogged:"Sign in to save"};
  function text(id, value) { if ($(id).textContent !== value) $(id).textContent = value; }
  function statistics(id, values, loading = false) {
    const element = $(id), signature = JSON.stringify([values, loading, window.desktopUiI18n.snapshot().locale]);
    element.hidden = !values.length;
    element.setAttribute("aria-busy", String(loading));
    if (element.dataset.signature === signature) return;
    element.dataset.signature = signature;
    element.replaceChildren(...values.map(([label, value]) => {
      const cell = document.createElement("div"), number = document.createElement("b"), caption = document.createElement("span");
      cell.className = "statistic";
      number.textContent = Number.isFinite(value) ? value.toLocaleString(window.desktopUiI18n.snapshot().locale) : "—";
      caption.textContent = t(label); cell.title = `${caption.textContent}: ${number.textContent}`;
      cell.append(number, caption); return cell;
    }));
  }
  function renderInfo() {
    const context = state.context, account = context.account || {status:"loading"};
    const {task:reportedTask, operation, queued = 0, running = 0} = activity();
    const task = reportedTask?.status === "completed" && operation && Date.parse(operation.startedAt) >= reportedTask.finishedAt ? null : reportedTask;
    const hasActivity = !!task || !!operation;
    const status = task?.status === "failed" ? "failed" : task?.status === "blocked" || operation?.blocked ? "blocked"
      : operation?.phase === "failed" ? "failed" : task?.status === "running" ? "running" : operation?.phase || task?.status;
    const failed = status === "failed", blocked = status === "blocked";
    const saveIssue = context.allowed && !context.loading && ["error","blocked","unlogged"].includes(context.saveStatus);
    const signIn = context.allowed ? context.saveStatus === "unlogged" : account.status === "signed-out";
    const signedOut = !context.allowed && signIn;
    $("capsule-sign-in").hidden = !signedOut; text("capsule-sign-in",t("Sign in"));
    const issue = failed || blocked || saveIssue || !context.allowed && account.status === "error";
    const working = !issue && status === "running";
    document.body.dataset.working = String(working);
    document.body.dataset.tone = failed || saveIssue && context.saveStatus === "error" ? "error" : issue ? "warning" : "neutral";
    const workspace = account.workspaces?.find(item => item.id === context.workspaceId);
    const team = account.teams?.find(item => item.id === (context.orgId || workspace?.teamId));
    const location = [team?.name, workspace?.name].filter(Boolean).join(" · ");
    const heading = context.allowed ? [...new Set([context.projectName || "Plasmic", context.viewName].filter(Boolean))].join(" · ") : location || "Plasmic";
    text("page", heading); $("page").title = heading;
    text("user-name", account.user?.name || t(signIn ? "Signed out" : account.status === "loading" ? "Loading…" : "Account"));
    $("user-name").title = $("user-name").textContent;
    const languages = {en:"English", "zh-CN":"简体中文", "zh-TW":"繁體中文", ja:"日本語", ko:"한국어"};
    text("theme-label", t(state.appearance === "light" ? "Light" : "Dark"));
    text("language-label", languages[window.desktopUiI18n.snapshot().locale] || "English");
    $("language-label").title = $("language-label").textContent;
    const theme = state.appearance === "light" ? '<circle cx="6" cy="6" r="2.5"/><path d="M6 0v1m0 10v1M0 6h1m10 0h1M2 2l1 1m6 6 1 1M2 10l1-1m6-6 1-1"/>' : '<path d="M10.8 7.2A5 5 0 0 1 4.8 1.2a5 5 0 1 0 6 6Z"/>';
    if ($("theme-icon").dataset.appearance !== state.appearance) { $("theme-icon").dataset.appearance = state.appearance; $("theme-icon").innerHTML = `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.2">${theme}</svg>`; }
    const summary = context.loading ? null : context.projectSummary;
    const hasVisual = context.allowed && !!(context.loading || context.viewName || state.image);
    let left = [], right = [], empty = "";
    if (context.allowed) {
      if (hasVisual) {
        left = context.mode === "preview" ? [["Width",context.previewContext?.width],["Height",context.previewContext?.height]]
          : [["Pages",summary?.pages],["Components",summary?.components],["Artboards",summary?.artboards]];
      } else {
        left = [["Custom canvases",summary?.canvases],["Image assets",summary?.images],["Libraries",summary?.libraries]];
        right = [["Pages",summary?.pages],["Components",summary?.components]];
      }
    } else if (!signIn) {
      left = [["Organizations",account.counts?.organizations],["Workspaces",account.counts?.workspaces],["Projects",account.counts?.projects]];
      if (workspace) right = [["Workspace projects",workspace.projects],["Users with access",workspace.members]];
      else empty = t(account.status === "loading" ? "Loading account information…" : "No workspace selected");
    }
    statistics("left-statistics", left, context.allowed ? !!context.loading : account.status === "loading");
    statistics("right-statistics", right);
    $("account-empty").hidden = !empty; text("account-empty", empty);
    document.querySelector(".right").dataset.statistics = String(!hasVisual);
    $("account-sign-in").hidden = !signIn || signedOut;
    text("account-sign-in",t("Sign in"));
    if (signIn) { $("account-empty").hidden = true; document.querySelector(".visual").hidden = true; }
    const stages = {read:"Reading",write:"Applying changes",view:"Navigating",save:"Saving",preview:"Interacting with preview"};
    const previewActions = {click:"Clicking in preview",fill:"Entering text in preview",press:"Pressing a key in preview",scroll:"Scrolling preview",open:"Opening preview",close:"Closing preview"};
    const completed = {resource:"Operation complete",read:"Read complete",write:"Changes applied",view:"View updated",save:"Saved",preview:"Interaction complete"};
    let phase = "", icon = "idle";
    if (failed || blocked) { phase = t(failed ? task?.status === "failed" ? "Task failed" : "Operation failed" : "Needs attention"); icon = failed ? "failed" : "blocked"; }
    else if (saveIssue) { phase = t(saveStates[context.saveStatus]); icon = context.saveStatus === "error" ? "failed" : "blocked"; }
    else if (hasActivity) {
      icon = status || "running";
      phase = status === "queued" ? t("Queued") : status === "completed" ? t(task?.status === "completed" ? "Task complete" : completed[operation?.kind] || "Operation complete")
        : task?.stage || (operation?.label ? t(operation.label) : "") || t(operation?.kind === "preview" ? previewActions[operation.operation] || stages.preview : stages[operation?.kind] || "In progress");
    } else if (context.allowed && context.loading) { phase = t("Opening canvas…"); icon = "running"; }
    else if (context.allowed && !hasVisual) phase = t("No canvas open");
    else if (context.allowed && context.mode !== "preview") { phase = t(saveStates[context.saveStatus] || ""); icon = context.saveStatus === "saving" ? "running" : context.saveStatus === "saved" ? "completed" : "idle"; }
    else if (!context.allowed && account.status === "error") { phase = t("Statistics unavailable"); icon = "blocked"; }
    else if (!context.allowed && account.status === "loading") { phase = t("Loading…"); icon = "running"; }
    const step = !issue && task?.stageIndex && task?.stageCount ? t("Step {current}/{total}", {current:task.stageIndex,total:task.stageCount}) : "";
    const error = task?.error || operation?.error || (saveIssue ? t("Your changes are not saved.") : issue ? t("Statistics unavailable") : "");
    const details = [phase, task?.title || operation?.subject, error, step, queued ? t("{count} queued",{count:queued}) : "", running > 1 ? t("{count} running",{count:running}) : "", context.saveStatus === "pending" ? t("Unsaved") : ""].filter(Boolean).join(" · ");
    $("phase").hidden = !phase; $("phase").dataset.status = icon;
    text("phase-text",phase); $("phase-text").title = details;
    text("stage-count",step); $("stage-count").hidden = !step;
    $("phase-icon").hidden = !!issue;
    if ($("phase-icon").dataset.icon !== icon) { $("phase-icon").dataset.icon = icon; $("phase-icon").innerHTML = icons[icon] || icons.idle; }
    $("issue-detail").hidden = !issue;
    $("issue-detail").setAttribute("aria-label",details);
    text("issue-tooltip",details);
    if (!issue) $("issue-tooltip").hidden = true;
    text("app-version",state.update?.currentVersion ? `v${state.update.currentVersion}` : "");
    $("app-version").hidden = !!phase || context.allowed || !state.update?.currentVersion;
    let compactTitle = task?.title || operation?.subject || (context.allowed ? context.viewName || context.projectName : account.user?.name) || t(signIn ? "Sign in" : "Account overview");
    let compactPhase = phase;
    if (!hasActivity && !context.allowed) compactPhase = account.status === "ready" ? t("{count} projects",{count:account.counts.projects}) : signIn ? "" : t(account.status === "error" ? "Statistics unavailable" : "Loading…");
    else if (!hasActivity && context.mode === "preview" && !issue) compactPhase = t("Preview");
    if (signedOut) { compactTitle = "Plasmic"; compactPhase = ""; }
    text("project",compactTitle);text("pill-context",compactPhase);
    $("queue").hidden = signedOut || !queued; text("queue",queued ? `+${queued}` : "");
    $("queue").title = t("{count} queued",{count:queued});$("queue").setAttribute("aria-label",$("queue").title);
    $("capsule-handle").title = [compactTitle,compactPhase,details].filter(Boolean).join(" · ");$("capsule-handle").setAttribute("aria-label",$("capsule-handle").title);
    document.querySelector(".dot").hidden = signedOut || !working && !issue;
  }
  function renderImage() {
    const image = state.image, valid = state.context.allowed && !!image && image.identity === state.context.identity;
    if (!valid) {
      imageVersion++; loadingSource = frameSource = undefined;
      frameImage = undefined;
      mirror.hidden = true; mirror.removeAttribute("src");
    } else if (image.src !== frameSource && image.src !== loadingSource) {
      const version = ++imageVersion, loader = new Image();
      loadingSource = image.src;
      loader.onload = () => {
        if (version !== imageVersion) return;
        frameSource = image.src; loadingSource = undefined;
        frameImage = image;
        mirror.src = image.src; mirror.hidden = false;
        $("unavailable").hidden = true;
        $("stale").hidden = !state.stale;
        renderFeedback();
      };
      loader.onerror = () => { if (version === imageVersion) loadingSource = undefined; };
      loader.src = image.src;
    }
    if (valid && image.src === frameSource) frameImage = image;
    $("view-loading").hidden = !state.context.allowed || !state.context.loading;
    $("unavailable").hidden = !state.context.allowed || state.context.loading || !!frameSource;
    $("unavailable").textContent = t(!state.context.allowed ? "No canvas open" : state.context.loading ? "Loading current view…" : "Preparing preview image…");
    $("stale").hidden = !state.stale || !frameSource;
    $("stale").textContent = t("Preview not refreshed");
    document.body.dataset.stale = String(state.stale);
    document.body.dataset.loading = String(state.context.allowed && !frameSource);
  }
  function renderFeedback() {
    const layer = $("feedback"), image = frameImage, feedback = image?.feedback, operation = activity().operation;
    const visible = opened && state.context.allowed && !state.stale && !mirror.hidden && image?.identity === state.context.identity
      && feedback && feedback.id === operation?.id && ["running", "completed"].includes(operation.phase)
      && !["blocked", "failed"].includes(activity().task?.status);
    layer.hidden = !visible;
    if (!visible) { layer.replaceChildren(); feedbackKey = feedbackId = undefined; return; }
    const scale = Math.min(mirror.clientWidth / image.width, mirror.clientHeight / image.height);
    Object.assign(layer.style, { left:`${(mirror.clientWidth-image.width*scale)/2}px`, top:`${(mirror.clientHeight-image.height*scale)/2}px`, width:`${image.width*scale}px`, height:`${image.height*scale}px` });
    layer.dataset.kind = feedback.kind;
    layer.dataset.phase = operation.phase;
    const key = JSON.stringify([feedback.id, operation.phase, feedback.regions]);
    if (key === feedbackKey) return;
    // Keep animation nodes across captures of the same geometry.
    // A completed call gets one finite acknowledgement, never an idle loop.
    if (feedbackId !== feedback.id) { layer.replaceChildren(); feedbackId = feedback.id; }
    while (layer.children.length > feedback.regions.length) layer.lastElementChild.remove();
    feedback.regions.forEach((region, index) => {
      let node = layer.children[index];
      if (!node) {
        node = document.createElement("div"); node.className = "feedback-region";
        node.append(Object.assign(document.createElement("i"), { className:"feedback-sweep" }));
        layer.append(node);
      }
      Object.assign(node.style, { left:`${region.x*100}%`, top:`${region.y*100}%`, width:`${region.width*100}%`, height:`${region.height*100}%` });
    });
    feedbackKey = key;
  }
  function render(value) {
    state = value;
    if (value.localization) window.desktopUiI18n.setSnapshot(value.localization);
    document.documentElement.dataset.uiAppearance = value.appearance;
    shell.dataset.allowed = String(value.context.allowed);
    const hasVisual = value.context.allowed && !!(value.context.loading || value.context.viewName || value.image);
    $("card").querySelector(".visual").hidden = !hasVisual;
    open(value.expanded === true);
    renderImage(); renderInfo(); renderFeedback(); renderUpdate(); motion();
  }
  api.onState((value) => { received = true; render(value); });
  void api.command("state").then((value) => { if (!received) render(value); }).catch(console.error);
  $("capsule-handle").onclick = () => { if (!dragged) void send("menu"); };
  for (const button of [$("capsule-update"), $("card-update")]) {
    button.addEventListener("pointerdown", event => event.stopPropagation());
    button.onclick = () => void send("update-open");
  }
  $("update-install").onclick = () => { $("update-install").disabled = true; void send("update-install"); };
  $("update-later").onclick = $("update-dismiss").onclick = () => void send("update-close");
  for (const button of [$("capsule-sign-in"), $("account-sign-in")]) {
    button.onclick = () => void send("sign-in");
  }

  $("update-retry").onclick = () => void send("update-check");
  const detail = $("issue-detail"), tooltip = $("issue-tooltip");
  detail.addEventListener("mouseenter", () => { tooltip.hidden = false; });
  detail.addEventListener("mouseleave", () => { tooltip.hidden = true; });
  detail.addEventListener("focus", () => { tooltip.hidden = false; });
  detail.addEventListener("blur", () => { tooltip.hidden = true; });
  detail.onclick = () => { tooltip.hidden = !tooltip.hidden; };
  shell.addEventListener("contextmenu", (event) => { event.preventDefault(); void send("menu"); });
  shell.addEventListener("keydown", (event) => {
    if (event.key === "Escape") tooltip.hidden = true;
    if (event.key === "Escape" && state?.updateOpen) { event.preventDefault(); void send("update-close"); }
    if (event.key === "ContextMenu" || event.shiftKey && event.key === "F10") { event.preventDefault(); void send("menu"); }
  });
  let dragging = false, dragged = false, start;
  for (const handle of [$("capsule-handle"), $("drag-handle"), $("update-heading")]) {
    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || event.target.closest("button") && event.target.closest("button") !== handle) return;
      dragging = false; dragged = false; start = { x: event.screenX, y: event.screenY };
      handle.setPointerCapture(event.pointerId);
    });
    handle.addEventListener("pointermove", (event) => {
      if (!handle.hasPointerCapture(event.pointerId) || !start) return;
      if (!dragging && Math.hypot(event.screenX - start.x, event.screenY - start.y) > 4) {
        dragging = true; dragged = true; void send("drag-start");
      }
      if (dragging) void send("drag-move");
    });
    const end = () => {
      if (dragging) void send("drag-end");
      dragging = false; start = undefined;
    };
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
    handle.addEventListener("lostpointercapture", end);
  }
  motion();
})();
