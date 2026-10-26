(() => {
  const api = window.desktopIsland;
  const $ = (id) => document.getElementById(id);
  const shell = $("shell"), card = $("card"), mirror = $("mirror");
  const t = (key, values) => window.desktopUiI18n.t(key, values);
  let state, opened = false, expandedWidth = 440;
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
    const target = { width, height: opened ? 144 : 40, radius: opened ? 23 : 20 };
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
  function renderInfo() {
    const context = state.context, account = context.account || {status:"loading"};
    const {task:reportedTask, operation, queued = 0, running = 0} = activity();
    const task = reportedTask?.status === "completed" && operation && Date.parse(operation.startedAt) >= reportedTask.finishedAt ? null : reportedTask;
    const taskStage = task?.status === "running" ? task.stage : null;
    const hasActivity = !!task || !!operation;
    // A task failure must survive the completion of an individual tool call.
    const status = task?.status === "failed" ? "failed"
      : task?.status === "blocked" || operation?.blocked ? "blocked"
      : operation?.phase === "failed" ? "failed"
      : task?.status === "running" ? "running" : operation?.phase || task?.status;
    const failed = status === "failed", blocked = status === "blocked";
    const saveIssue = context.allowed && !context.loading && ["error","blocked","unlogged"].includes(context.saveStatus);
    const signIn = context.allowed ? context.saveStatus === "unlogged" : account.status === "signed-out";
    const issue = failed || blocked || saveIssue || !context.allowed && account.status === "error";
    const working = !issue && status === "running";
    const tone = failed || saveIssue && context.saveStatus === "error" ? "error" : issue ? "warning" : status === "completed" ? "success" : "neutral";
    const info = document.querySelector(".info");
    info.dataset.activity = String(hasActivity);
    info.dataset.issue = String(!!issue);
    const accountIdle = !context.allowed && !hasActivity;
    const heroIssue = issue && !accountIdle;
    info.dataset.tone = tone;
    info.dataset.viewLoading = String(context.allowed && context.loading && !hasActivity);
    document.body.dataset.busy = String(working || blocked || status === "queued");
    document.body.dataset.working = String(working);
    document.body.dataset.error = String(issue);
    document.body.dataset.tone = tone;
    const workspace = account.workspaces?.find(item => item.id === context.workspaceId);
    const team = account.teams?.find(item => item.id === (context.orgId || workspace?.teamId));
    const location = [team?.name, workspace?.name].filter(Boolean).join(" · ");
    const mode = context.allowed ? context.mode === "preview" ? "Preview" : "Canvas" : "Account";
    $("context").textContent = $("context").title = t(accountIdle && signIn ? "Signed out" : mode);
    $("context").hidden = accountIdle && !!account.user;
    $("page").textContent = context.allowed ? context.projectName || "Plasmic" : "Plasmic";
    $("page").hidden = false;
    document.querySelector(".identity").hidden = false;
    $("page").title = $("page").textContent;
    $("account-presence").hidden = !accountIdle || !account.user;
    $("account-presence").querySelector("span").textContent = t("Signed in");
    $("account-avatar").hidden = !accountIdle || !account.user && account.status !== "signed-out";
    $("account-avatar").textContent = account.user?.name?.trim().slice(0,1) || "◈";
    $("account-presence").setAttribute("aria-label", t("Signed in"));
    const languages = {en:"English", "zh-CN":"简体中文", "zh-TW":"繁體中文", ja:"日本語", ko:"한국어"};
    const projectSummary = context.loading ? null : context.projectSummary;
    $("drag-handle").title = [context.projectName || "Plasmic", context.viewName, location, projectSummary ? `${projectSummary.pages} ${t("Pages")} · ${projectSummary.components} ${t("Components")}` : "", `${t("Theme")}: ${t(state.appearance === "light" ? "Light" : "Dark")}`, `${t("Language")}: ${languages[window.desktopUiI18n.snapshot().locale]}`].filter(Boolean).join(" · ");
    const operationLabel = operation?.label ? t(operation.label) : "";
    const title = hasActivity ? task?.title || operation?.subject || (context.allowed ? context.viewName || context.pageName || context.projectName : operationLabel) || t("Current operation")
      : context.allowed ? context.viewName || t(context.loading ? "Opening canvas…" : "No canvas open")
      : account.user?.name || t(signIn ? "Sign in to Plasmic" : "Account overview");
    const identityLoading = !context.allowed && account.status === "loading" && !account.user && !hasActivity;
    $("mission").hidden = identityLoading;
    document.querySelector(".heading").hidden = identityLoading;
    $("account-loading").hidden = !identityLoading;
    $("account-loading-label").textContent = t("Loading account information…");
    const stages = {read:"Reading",write:"Applying changes",view:"Navigating",save:"Saving",preview:"Interacting with preview"};
    const previewActions = {click:"Clicking in preview",fill:"Entering text in preview",press:"Pressing a key in preview",scroll:"Scrolling preview",open:"Opening preview",close:"Closing preview"};
    const completed = {resource:"Operation complete",read:"Read complete",write:"Changes applied",view:"View updated",save:"Saved",preview:"Interaction complete"};
    let phase = "", icon = "idle";
    if (failed || blocked) { phase = t(failed ? task?.status === "failed" ? "Task failed" : "Operation failed" : "Needs attention"); icon = failed ? "failed" : "blocked"; }
    else if (saveIssue) { phase = t(saveStates[context.saveStatus]); icon = context.saveStatus === "error" ? "failed" : "blocked"; }
    else if (hasActivity) {
      icon = status || "running";
      phase = status === "queued" ? t("Queued") : status === "completed" ? t(task?.status === "completed" ? "Task complete" : completed[operation?.kind] || "Operation complete")
        : taskStage || (operation?.subject ? operationLabel : "") || (operation?.kind === "resource" ? operationLabel : "") || t(operation?.kind === "preview" ? previewActions[operation.operation] || stages.preview : stages[operation?.kind] || "In progress");
      // An action used as the title does not need a second generic status sentence.
      if (phase === title && !taskStage) phase = operation?.startedAt ? t("Elapsed {seconds}s", {seconds:Math.max(0,Math.floor((Date.now()-Date.parse(operation.startedAt))/1000))}) : t("In progress");
    } else if (context.allowed && context.loading) { phase = t("Preparing preview image…"); icon = "running";
    } else if (context.allowed && context.mode === "preview") { phase = ""; icon = "idle";
    } else if (context.allowed && context.viewName) {
      phase = t(saveStates[context.saveStatus] || "");
      icon = context.saveStatus === "saving" ? "running" : context.saveStatus === "saved" ? "completed" : "idle";
    } else if (!context.allowed && account.status === "error") { phase = t("Statistics unavailable"); icon = "blocked"; }
    const displayTitle = heroIssue ? phase : accountIdle && signIn ? t("Sign in to continue designing") : title;
    if ($("mission").textContent !== displayTitle) $("mission").textContent = displayTitle;
    $("mission").title = title;
    if (heroIssue) $("page").textContent = title;
    $("phase").hidden = !phase || heroIssue;
    $("phase").dataset.status = icon;
    if ($("phase-text").textContent !== phase) $("phase-text").textContent = phase;
    $("phase-text").title = phase;
    if ($("phase-icon").dataset.icon !== icon) { $("phase-icon").dataset.icon = icon; $("phase-icon").innerHTML = icons[icon] || icons.idle; }
    $("account-detail").hidden = context.allowed || hasActivity || !account.user?.email;
    $("account-email").textContent = $("account-email").title = account.user?.email || "";
    $("account-location").hidden = !accountIdle || issue || !account.user;
    $("account-location").textContent = $("account-location").title = (account.status === "error" ? account.user?.email : location) || (account.status === "ready" && account.counts?.projects === 0 ? t("No projects yet") : "");
    $("account-sign-in").hidden = !signIn;
    $("account-sign-in").textContent = t("Sign in");
    $("show-main").hidden = signIn || !(issue || context.allowed && !context.loading && !context.viewName);
    $("show-main").textContent = t("Show main window");
    document.querySelector(".info-actions").hidden = $("account-sign-in").hidden && $("show-main").hidden;
    $("sign-in-description").hidden = !accountIdle || !signIn;
    $("sign-in-description").textContent = t("Access your projects and workspaces");
    $("show-main").title = t("Show main window");
    const error = task?.error || operation?.error || "";
    $("issue").hidden = !heroIssue;
    const issueText = signIn ? t("Sign in to continue.") : task?.error || (saveIssue ? t("Your changes are not saved.") : operation?.code === "CONTEXT_MISMATCH" ? t("The editor context has changed.") : t("The operation could not be completed."));
    if ($("issue-text").textContent !== issueText) $("issue-text").textContent = issueText;
    $("issue").title = error;
    $("phase").title = error || phase;
    const preview = context.previewContext;
    const dimensions = context.mode === "preview" && preview?.width > 0 && preview?.height > 0;
    $("view-metric").hidden = hasActivity || issue || !context.allowed || !dimensions;
    $("view-metric").textContent = dimensions ? `${Math.round(preview.width)} × ${Math.round(preview.height)}` : "";
    $("view-metric").title = t("Viewport");
    $("activity-meta").hidden = !hasActivity || issue;
    const metadata = [
      ["stage-count", task?.stageIndex && task?.stageCount ? t("Step {current} of {total}", {current:task.stageIndex,total:task.stageCount}) : ""],
      ["queued-count", queued ? t("{count} queued", {count:queued}) : ""],
      ["running-count", running > 1 ? t("{count} running", {count:running}) : ""],
      ["unsaved", hasActivity && context.allowed && context.saveStatus === "pending" ? t("Unsaved") : ""],
    ];
    const visibleMetadata = metadata.filter(([,text]) => text).slice(0,2).map(([id]) => id);
    for (const [id,text] of metadata) { $(id).textContent = text; $(id).hidden = !visibleMetadata.includes(id); }
    $("activity-meta").title = metadata.map(([,text]) => text).filter(Boolean).join(" · ");
    $("activity-meta").hidden ||= !visibleMetadata.length;
    const ready = account.status === "ready";
    $("account-overview").hidden = !accountIdle || signIn || account.status === "error" || identityLoading;
    document.querySelector(".body").dataset.view = context.allowed ? "canvas" : signIn ? "signed-out" : "account";
    $("account-overview").setAttribute("aria-label", t("Accessible resources"));
    $("account-overview").setAttribute("aria-busy", String(account.status === "loading"));
    $("account-statistics").hidden = !ready;
    $("account-stats-loading").hidden = !accountIdle || account.status !== "loading" || !account.user;
    document.querySelector(".info-footer").hidden = $("account-location").hidden && $("account-overview").hidden;
    for (const [id,key,label] of [["organization","organizations","Organizations"],["workspace","workspaces","Workspaces"],["project","projects","Projects"]]) {
      $(`${id}-count`).textContent = ready ? account.counts[key] : "";
      $(`${key}-label`).textContent = t(label);
    }
    let compactTitle = title, compactPhase = phase;
    if (!hasActivity && !context.allowed) {
      compactTitle = account.user?.name || t(signIn ? "Sign in" : "Account overview");
      compactPhase = ready ? t("{count} projects", {count:account.counts.projects}) : signIn ? "" : t(account.status === "error" ? "Statistics unavailable" : "Loading…");
    } else if (!hasActivity && context.allowed) compactPhase = context.loading ? t("Loading…") : issue ? phase : context.mode === "preview" ? t("Preview") : phase;
    $("project").textContent = compactTitle;
    $("pill-context").textContent = compactPhase;
    $("queue").hidden = !queued;
    $("queue").textContent = queued ? `+${queued}` : "";
    $("queue").title = t("{count} queued", {count:queued});
    $("queue").setAttribute("aria-label", $("queue").title);
    $("capsule-handle").title = [...new Set([compactTitle,compactPhase,context.projectName,location,error,queued ? $("queue").title : "",running > 1 ? t("{count} running",{count:running}) : ""].filter(Boolean))].join(" · ");
    $("capsule-handle").setAttribute("aria-label", $("capsule-handle").title);
    document.querySelector(".dot").hidden = !working && !issue;
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
    const accountIdle = !value.context.allowed && !value.activity?.task && !value.activity?.operation;
    expandedWidth = value.updateOpen || hasVisual || accountIdle && value.context.account?.user ? 440
      : accountIdle && value.context.account?.status === "signed-out" ? 400 : 320;
    shell.style.setProperty("--card-width", `${expandedWidth - 2}px`);
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
  $("account-sign-in").onclick = () => void send("sign-in");
  $("show-main").onclick = () => void send("show-main");
  $("update-retry").onclick = () => void send("update-check");
  shell.addEventListener("contextmenu", (event) => { event.preventDefault(); void send("menu"); });
  shell.addEventListener("keydown", (event) => {
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
