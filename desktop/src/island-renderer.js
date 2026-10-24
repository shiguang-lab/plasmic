(() => {
  const api = window.desktopIsland;
  const $ = (id) => document.getElementById(id);
  const shell = $("shell"), card = $("card"), mirror = $("mirror");
  const t = (key, values) => window.desktopUiI18n.t(key, values);
  let state, opened = false;
  let received = false, frameSource, frameImage, loadingSource, imageVersion = 0;
  let animation, lastTime, lastHit = 0;
  let feedbackKey, feedbackId;
  const spring = { width: 130, height: 40, radius: 20, vw: 0, vh: 0, vr: 0 };
  const send = (command, value) => api.command(command, value).catch(console.error);
  const activity = () => state?.activity || {};
  const busy = () => {
    const { task, operation } = activity();
    return ["running", "blocked"].includes(task?.status) || ["queued", "running"].includes(operation?.phase) || operation?.blocked;
  };
  function reportHit() {
    const r = shell.getBoundingClientRect();
    void send("hit", { x: r.x, y: r.y, width: r.width, height: r.height, radius: Math.max(0, spring.radius) });
  }
  function animate(now) {
    const dt = Math.min((now - (lastTime || now - 16)) / 1000, .025);
    lastTime = now;
    const width = opened ? 420 : Math.min(280, $("capsule").scrollWidth + 2);
    const target = { width, height: opened ? 136 : 40, radius: opened ? 22 : 20 };
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
  const icons = {
    running: '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M6 1a5 5 0 1 1-5 5"/></svg>',
    completed: '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><path d="m2 6 3 3 5-6"/></svg>',
    failed: "!", blocked: "!", queued: "·",
  };
  function renderActivity() {
    const { task, operation } = activity();
    const kind = operation?.kind;
    const status = task?.status === "blocked" ? "blocked" : operation?.blocked ? "blocked" : operation?.phase || task?.status;
    const titles = { resource: "Running MCP operation", read: "Reading current design", write: "Updating current design", view: "Updating editor view", save: "Saving current design", preview: "Testing current preview" };
    const stages = { read: "Reading", write: "Applying changes", view: "Navigating", save: "Saving", preview: "Interacting with preview" };
    const completed = { resource: "Operation complete", read: "Read complete", write: "Changes applied", view: "View updated", save: "Saved", preview: "Interaction complete" };
    const taskStage = task?.status === "running" ? task.stage : null;
    const title = task?.title || (operation ? t(operation.label || titles[kind] || "Running MCP operation") : state.context.projectName || "Plasmic");
    const error = task?.error || operation?.error;
    const active = busy();
    document.body.dataset.busy = String(!!active);
    document.body.dataset.working = String(!!active && !["blocked", "failed", "completed"].includes(status));
    document.body.dataset.blocked = String(status === "blocked");
    document.body.dataset.error = String(!!error || ["blocked", "failed"].includes(status));
    $("mission").textContent = $("mission").title = title;
    $("phase").hidden = !task && !operation;
    $("phase-text").textContent = t(status === "blocked" ? "Blocked" : status === "failed" ? "Operation failed"
      : status === "queued" ? "Queued" : status === "completed" ? completed[kind] || "Task complete"
      : taskStage || stages[kind] || "In progress");
    // Task and stage names are caller-provided content, not language-pack keys.
    if (taskStage && !["failed", "blocked", "completed", "queued"].includes(status)) $("phase-text").textContent = taskStage;
    $("phase-icon").innerHTML = icons[status] || icons.running;
    const planned = task?.stageIndex && task?.stageCount;
    $("stage-count").textContent = planned ? `${task.stageIndex}/${task.stageCount}` : "";
    $("progress").hidden = !planned;
    if (planned) $("progress").firstElementChild.style.width = `${100 * task.stageIndex / task.stageCount}%`;
    $("issue").hidden = !error;
    $("issue-text").textContent = error || "";
    $("issue").title = error || "";
    const hasActivity = !!task || !!operation;
    $("summary").hidden = hasActivity;
    if (!hasActivity) renderSummary();
    $("project").textContent = hasActivity ? title : state.context.projectName || "Plasmic";
    $("pill-context").textContent = hasActivity ? $("phase-text").textContent : "";
    $("queue").hidden = !activity().queued;
    $("queue").textContent = activity().queued || "";
    $("queue").title = t("{count} queued", {count: activity().queued});
    $("capsule-handle").title = (hasActivity ? [title, operation?.label ? t(operation.label) : operation?.operation, operation?.subject, taskStage, $("phase-text").textContent, error,
      activity().queued ? $("queue").title : null] : [state.context.projectName || "Plasmic"]).filter(Boolean).join(" · ");
    $("capsule-handle").setAttribute("aria-label", $("capsule-handle").title);
  }
  function renderSummary() {
    const context = state.context, summary = context.projectSummary;
    $("page").textContent = context.projectName || "Plasmic";
    $("page").title = context.projectName || "Plasmic";
    $("mission").textContent = context.loading ? t("Loading current view…") : context.viewName || t("No canvas open");
    $("mission").title = [context.viewName, context.previewContext?.path].filter(Boolean).join(" · ");
    $("summary").querySelector(".counts").hidden = !summary;
    $("page-count").textContent = summary?.pages ?? "";
    $("component-count").textContent = summary?.components ?? "";
    $("pages-label").textContent = $("pages-label").title = t("Pages");
    $("components-label").textContent = $("components-label").title = t("Components");
    const states = {saved:"Saved",pending:"Unsaved changes",saving:"Saving",error:"Save failed",blocked:"Saving blocked",unlogged:"Sign in to save"};
    $("save-state").hidden = !context.saveStatus;
    $("save-state").dataset.status = context.saveStatus || "";
    $("save-text").textContent = states[context.saveStatus] ? t(states[context.saveStatus]) : "";
    $("save-state").title = $("save-text").textContent;
    const preview = context.previewContext;
    const dimensions = context.mode === "preview" && preview?.width > 0 && preview?.height > 0;
    $("view-metric").textContent = dimensions ? `${Math.round(preview.width)} × ${Math.round(preview.height)}`
      : context.scale > 0 ? `${Math.round(context.scale * 100)}%` : "";
    $("view-metric").title = t(dimensions ? "Viewport" : "Zoom");
  }
  function renderImage() {
    const image = state.image, valid = !!image && image.identity === state.context.identity;
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
        renderFeedback();
      };
      loader.onerror = () => { if (version === imageVersion) loadingSource = undefined; };
      loader.src = image.src;
    }
    if (valid && image.src === frameSource) frameImage = image;
    $("unavailable").hidden = !!frameSource;
    $("unavailable").textContent = t(!state.context.allowed ? "No canvas open" : state.context.loading ? "Loading current view…" : "Waiting for current view…");
    $("stale").hidden = !state.stale || !frameSource;
    $("stale").textContent = t("Previous frame");
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
    const context = value.context.mode === "preview" ? "Preview" : value.context.allowed ? "Edit mode" : "";
    $("context").textContent = t(context);
    $("page").textContent = value.context.pageName || value.context.projectName || "Plasmic";
    $("page").title = value.context.pageName || value.context.projectName || "Plasmic";
    open(value.expanded === true);
    renderImage(); renderActivity(); renderFeedback(); motion();
  }
  api.onState((value) => { received = true; render(value); });
  void api.command("state").then((value) => { if (!received) render(value); }).catch(console.error);
  $("capsule-handle").onclick = () => { if (!dragged) void send("menu"); };
  shell.addEventListener("contextmenu", (event) => { event.preventDefault(); void send("menu"); });
  shell.addEventListener("keydown", (event) => {
    if (event.key === "ContextMenu" || event.shiftKey && event.key === "F10") { event.preventDefault(); void send("menu"); }
  });
  let dragging = false, dragged = false, start;
  for (const handle of [$("capsule-handle"), $("drag-handle")]) {
    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
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
