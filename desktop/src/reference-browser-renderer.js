(() => {
  const api = window.referenceBrowser;
  const { t, setSnapshot } = window.desktopUiI18n;
  const paths = {
    pick: "M3 3h14v6 M3 3v14h6 M11 11l9 4-4 1-1 4z",
    back: "m14 6-6 6 6 6 M8 12h13",
    forward: "m10 6 6 6-6 6 M3 12h13",
    reload: "M20 7v5h-5 M20 12a8 8 0 1 0-2 6",
    globe:
      "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20 M2 12h20 M12 2c6 5 6 15 0 20-6-5-6-15 0-20",
    history: "M5 8h14v13H5z M7 4h10 M8 1h8",
    close: "m6 6 12 12 M6 18 18 6",
    chevron: "m6 9 6 6 6-6",
    device: "M3 3h18v13H3z M8 21h8 M12 16v5",
    phone: "M7 2h10v20H7z M11 18h2",
    tablet: "M4 3h16v18H4z M11 18h2",
    camera: "M3 7h4l2-3h6l2 3h4v14H3z M16 13a4 4 0 1 0-8 0 4 4 0 0 0 8 0",
    collapse: "M3 10h7V3 M10 10 3 3 M21 14h-7v7 M14 14l7 7",
    check: "m5 12 4 4L19 6",
    warning: "M12 3 2 21h20z M12 9v5 M12 17h.01",
    expand: "M14 3h7v7 M21 3l-7 7 M10 21H3v-7 M3 21l7-7",
    more: "M5 12h.01 M12 12h.01 M19 12h.01",
    hide: "M3 3h18v18H3z M15 3v18 M6 9l3 3-3 3",
    code: "m8 6-6 6 6 6 M16 6l6 6-6 6 M14 3l-4 18",
  };
  for (const node of document.querySelectorAll("[data-icon]")) {
    node.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[node.dataset.icon]}"></path></svg>`;
  }
  let state;
  let inspectorKey, breadcrumbsKey, recentKey;
  let pendingImport = false;
  let heightResize;
  const popover = document.getElementById("popover");
  const menu = document.getElementById("menu");
  const tooltip = document.getElementById("tooltip");
  let menuAnchor, activeMenu, tooltipTimer, tooltipAnchor;
  let popoverGeneration = 0;
  for (const [id, horizontal] of [
    ["start-scroll", false],
    ["inspector-scroll", true],
    ["menu-scroll", false],
  ])
    window.referenceBrowserUi.mountScrollArea(
      document.getElementById(id),
      horizontal,
    );
  const icon = (name) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]}"></path></svg>`;
  function hideTooltip() {
    clearTimeout(tooltipTimer);
    tooltip.hidden = true;
    tooltipAnchor?.removeAttribute("aria-describedby");
    tooltipAnchor = undefined;
    if (popover.hidden && !heightResize)
      void api.command({ action: "overlay", visible: false });
  }
  function closePopover(restoreFocus = false) {
    popoverGeneration++;
    popover.hidden = true;
    menuAnchor?.setAttribute("aria-expanded", "false");
    if (restoreFocus) menuAnchor?.focus();
    menuAnchor = undefined;
    activeMenu = undefined;
    hideTooltip();
  }
  function positionPopover() {
    if (!menuAnchor || popover.hidden) return;
    const rect = menuAnchor.getBoundingClientRect();
    const below = innerHeight - rect.bottom - 14;
    const above = rect.top - 14;
    const opensAbove =
      below < Math.min(menu.scrollHeight + 12, 180) && above > below;
    const height = Math.min(
      menu.scrollHeight + 4,
      Math.max(40, (opensAbove ? above : below) - 10),
      360,
    );
    document.getElementById("menu-scroll").style.height = `${height}px`;
    popover.style.left = `${Math.max(8, Math.min(rect.right - popover.offsetWidth, innerWidth - popover.offsetWidth - 8))}px`;
    popover.style.top = `${opensAbove ? rect.top - popover.offsetHeight - 6 : rect.bottom + 6}px`;
  }
  async function openPopover(name, anchor) {
    if (!popover.hidden && activeMenu === name) {
      closePopover();
      return;
    }
    closePopover();
    const generation = popoverGeneration;
    const items =
      name === "warnings"
        ? null
        : await command({ action: "menu", menu: name });
    if (generation !== popoverGeneration || (!items && name !== "warnings"))
      return;
    hideTooltip();
    activeMenu = name;
    menuAnchor = anchor;
    anchor.setAttribute("aria-expanded", "true");
    anchor.setAttribute("aria-controls", "popover");
    anchor.setAttribute(
      "aria-haspopup",
      name === "warnings" ? "dialog" : "menu",
    );
    menu.replaceChildren();
    menu.setAttribute("role", name === "warnings" ? "document" : "menu");
    if (name === "warnings") {
      const heading = document.createElement("p");
      heading.textContent = t("Import details");
      menu.append(heading);
      for (const warning of state.result?.warnings || []) {
        const paragraph = document.createElement("p");
        paragraph.textContent = warning;
        menu.append(paragraph);
      }
      popover.setAttribute("role", "dialog");
      popover.setAttribute("aria-label", t("Import details"));
      popover.tabIndex = -1;
    } else {
      popover.removeAttribute("role");
      popover.removeAttribute("aria-label");
      for (const item of items) {
        if (item.type === "separator") {
          menu.append(document.createElement("hr"));
          continue;
        }
        const node = document.createElement("button");
        node.type = "button";
        node.textContent = item.label;
        node.setAttribute("role", "menuitem");
        node.disabled = item.enabled === false;
        node.addEventListener("click", () => {
          closePopover(true);
          void command({
            action: "menu_action",
            menu: name,
            index: item.index,
          });
        });
        menu.append(node);
      }
    }
    popover.style.width = `${{ history: 360, more: 250, screenshot: 200, warnings: 400 }[name]}px`;
    popover.hidden = false;
    positionPopover();
    await api.command({ action: "overlay", visible: true });
    if (generation === popoverGeneration)
      (menu.querySelector("button:not(:disabled)") || popover).focus();
  }
  window.addEventListener("resize", positionPopover);
  const input = document.getElementById("url");
  const button = (action) =>
    document.querySelector(`[data-action="${action}"]`);
  async function command(value) {
    try {
      return await api.command(value);
    } catch (error) {
      document.getElementById("message").textContent = error.message;
      document.getElementById("notice").hidden = false;
      document.getElementById("notice").dataset.error = "true";
      return null;
    }
  }
  function render(snapshot) {
    const previous = state;
    state = snapshot;
    if (
      !snapshot.visible ||
      (previous &&
        (previous.url !== snapshot.url ||
          previous.locale.locale !== snapshot.locale.locale ||
          previous.busy !== snapshot.busy))
    )
      closePopover();
    document.documentElement.dataset.uiAppearance = snapshot.appearance;
    document.documentElement.dataset.expanded = !!snapshot.expanded;
    document.documentElement.dataset.platform = snapshot.platform;
    document.documentElement.dataset.nativeFullscreen =
      !!snapshot.nativeFullscreen;
    document.getElementById("app-header").hidden = !snapshot.expanded;
    document.getElementById("resize-handle").hidden = !!snapshot.expanded;
    setSnapshot(snapshot.locale);
    document.title = t("Web browser");
    for (const node of document.querySelectorAll("[data-label]")) {
      node.setAttribute("aria-label", t(node.dataset.label));
      node.dataset.tooltip = t(node.dataset.label);
    }
    input.setAttribute("aria-label", t("Page URL"));
    if (document.activeElement !== input)
      input.value = snapshot.url.replace(/^https?:\/\//, "").replace(/\/$/, "");
    input.disabled = !!snapshot.busy;
    const clipped = snapshot.importHeight !== null;
    document.getElementById("viewport").style.flex = clipped
      ? `0 0 ${snapshot.viewportHeight}px`
      : "1";
    document.getElementById("clip-space").hidden = !clipped;
    const heightHandle = document.getElementById("height-handle");
    heightHandle.dataset.clipped = clipped;
    heightHandle.dataset.tooltip = t(
      "Drag to clip import height, double-click to import the full page",
    );
    heightHandle.setAttribute("aria-disabled", !!snapshot.busy);
    heightHandle.setAttribute(
      "aria-valuemin",
      Math.min(240, snapshot.maxImportHeight),
    );
    heightHandle.setAttribute("aria-valuemax", snapshot.maxImportHeight);
    heightHandle.setAttribute("aria-valuenow", snapshot.viewportHeight);
    heightHandle.setAttribute(
      "aria-valuetext",
      clipped
        ? t("Import height: {height}px", { height: snapshot.viewportHeight })
        : t("Full page"),
    );
    const loaded = /^https?:/.test(snapshot.url);
    document.getElementById("start").hidden = loaded;
    document.getElementById("page-space").hidden = !loaded;
    document.getElementById("loading").hidden = !snapshot.loading;
    for (const action of [
      "select_element",
      "reload",
      "import_to_canvas",
      "clear_page",
      "screenshot",
    ])
      button(action).disabled = !loaded || snapshot.loading || !!snapshot.busy;
    for (const menu of ["history", "more"])
      document.querySelector(`[data-menu="${menu}"]`).disabled =
        !!snapshot.busy;
    button("cycle_device").disabled = !!snapshot.busy;
    const deviceLabel = t("Viewport: {device}. Switch to {next}", {
      device: t(snapshot.device),
      next: t(
        {
          Desktop: "Phone",
          Phone: "Tablet",
          Tablet: "Desktop",
          Custom: "Desktop",
        }[snapshot.device],
      ),
    });
    button("cycle_device").setAttribute("aria-label", deviceLabel);
    button("cycle_device").dataset.tooltip = deviceLabel;
    button("cycle_device")
      .querySelector("path")
      .setAttribute(
        "d",
        paths[
          { Phone: "phone", Tablet: "tablet" }[snapshot.device] || "device"
        ],
      );
    button("select_element").setAttribute("aria-pressed", snapshot.picking);
    for (const [action, label] of [
      [
        "select_element",
        snapshot.picking ? "Stop selecting an element" : "Select an element",
      ],
      [
        "import_to_canvas",
        snapshot.selection
          ? "Import the selection as nodes (Enter)"
          : "Reproduce on canvas",
      ],
      [
        "screenshot",
        snapshot.selection
          ? "Screenshot the selection onto the canvas (Cmd/Ctrl+Enter)"
          : "Screenshot",
      ],
      ["expand", snapshot.expanded ? "Exit Coding Mode" : "Coding Mode"],
    ]) {
      button(action).setAttribute("aria-label", t(label));
      button(action).dataset.tooltip = t(label);
    }
    button("expand").setAttribute("aria-pressed", snapshot.expanded);
    button("expand")
      .querySelector("path")
      .setAttribute("d", paths[snapshot.expanded ? "collapse" : "expand"]);
    for (const [action, changed] of [
      ["cycle_device", previous && previous.device !== snapshot.device],
      ["expand", previous && previous.expanded !== snapshot.expanded],
    ]) {
      if (changed) {
        const node = button(action);
        node.classList.remove("switching");
        void node.offsetWidth;
        node.classList.add("switching");
      }
    }
    button("import_to_canvas").disabled ||= pendingImport;
    button("screenshot").disabled ||= pendingImport;
    button("back").disabled = !snapshot.canGoBack || !!snapshot.busy;
    button("forward").disabled = !snapshot.canGoForward || !!snapshot.busy;
    button("clear_page").hidden = !loaded;
    const breadcrumbs = document.getElementById("breadcrumbs");
    breadcrumbs.hidden = !snapshot.selection;
    const nextBreadcrumbsKey = JSON.stringify(snapshot.selection?.ancestors);
    if (nextBreadcrumbsKey !== breadcrumbsKey) {
      breadcrumbsKey = nextBreadcrumbsKey;
      breadcrumbs.replaceChildren();
      for (const [index, ancestor] of (
        snapshot.selection?.ancestors || []
      ).entries()) {
        if (index) {
          const separator = document.createElement("span");
          separator.textContent = "›";
          breadcrumbs.append(separator);
        }
        const node = document.createElement("button");
        node.textContent = ancestor.tag;
        node.dataset.tooltip = `${ancestor.tag} · ${ancestor.width} × ${ancestor.height}`;
        node.addEventListener("click", () =>
          command({ action: "select_element", selector: ancestor.selector }),
        );
        breadcrumbs.append(node);
      }
    }
    renderInspector(snapshot.selection?.details);
    const notice = document.getElementById("notice");
    notice.hidden = !(snapshot.error || snapshot.notice || snapshot.busy);
    notice.dataset.error = !!snapshot.error;
    document.getElementById("notice-icon").innerHTML = snapshot.busy
      ? '<span class="spinner"></span>'
      : icon(snapshot.error ? "warning" : "check");
    document.getElementById("message").textContent = snapshot.busy
      ? t(
          snapshot.busy === "preparing"
            ? "Preparing editable layers…"
            : "Creating layers…",
        )
      : snapshot.error || snapshot.notice || "";
    button("cancel").hidden = snapshot.busy !== "preparing";
    for (const action of ["locate", "undo_import"])
      button(action).hidden = !snapshot.result || !!snapshot.busy;
    button("show_warnings").hidden =
      !snapshot.result?.warnings.length || !!snapshot.busy;
    document.getElementById("import").textContent = t(
      snapshot.busy ? "Importing…" : "Import",
    );
    const recent = document.getElementById("recent");
    recent.parentElement.hidden = !snapshot.recent.length;
    const nextRecentKey = JSON.stringify(snapshot.recent);
    if (nextRecentKey === recentKey) return;
    recentKey = nextRecentKey;
    recent.replaceChildren();
    for (const url of snapshot.recent) {
      const node = document.createElement("button");
      node.textContent = url.replace(/^https?:\/\//, "");
      node.title = url;
      node.addEventListener("click", () =>
        command({ action: "load_page", url }),
      );
      recent.append(node);
    }
  }
  function renderInspector(details) {
    document.getElementById("inspector").hidden = !details;
    const inspector = document.getElementById("inspector-content");
    const key = JSON.stringify([details, state.locale.locale]);
    if (key === inspectorKey) return;
    inspectorKey = key;
    inspector.replaceChildren();
    if (!details) return;
    const copyButton = (label, group, property, title) => {
      const node = document.createElement("button");
      node.textContent = label;
      node.dataset.tooltip = title;
      node.setAttribute("aria-label", title);
      node.disabled = !details[group];
      node.addEventListener("click", async () => {
        try {
          await api.command({ action: "copy_selection", group, property });
          node.dataset.copied = "true";
          node.dataset.tooltip = t("Copied");
          document.getElementById("copy-status").textContent = t("Copied");
          if (tooltipAnchor === node) tooltip.textContent = t("Copied");
          clearTimeout(node.copyTimer);
          node.copyTimer = setTimeout(() => {
            delete node.dataset.copied;
            node.dataset.tooltip = title;
            document.getElementById("copy-status").textContent = "";
            if (tooltipAnchor === node) tooltip.textContent = title;
          }, 1400);
        } catch (error) {
          delete node.dataset.copied;
          document.getElementById("copy-status").textContent = error.message;
          node.dataset.tooltip = error.message;
          if (tooltipAnchor === node) tooltip.textContent = error.message;
        }
      });
      return node;
    };
    inspector.append(
      copyButton(t("Style"), "style", undefined, t("Copy all styles")),
      copyButton(
        t("CSS class"),
        "classes",
        undefined,
        t(details.classes ? "Copy class names" : "No class on this element"),
      ),
    );
    for (const [group, name] of [
      ["layout", "Layout"],
      ["position", "Position"],
      ["padding", "Padding"],
      ["margin", "Margin"],
      ["typography", "Typography"],
    ]) {
      const values = details[group];
      if (
        !values ||
        (["padding", "margin"].includes(group) &&
          Object.values(values).every((value) => parseFloat(value) === 0))
      )
        continue;
      const section = document.createElement("span");
      section.className = "property-group";
      section.append(
        copyButton(
          t(name),
          group,
          undefined,
          t("Copy {name}", { name: t(name) }),
        ),
      );
      for (const [property, value] of Object.entries(values)) {
        const short =
          {
            x: "X ",
            y: "Y ",
            "padding-top": "T ",
            "padding-right": "R ",
            "padding-bottom": "B ",
            "padding-left": "L ",
            "margin-top": "T ",
            "margin-right": "R ",
            "margin-bottom": "B ",
            "margin-left": "L ",
          }[property] || "";
        const caption = {
          width: "Width",
          height: "Height",
          x: "X",
          y: "Y",
          "padding-top": "Padding top",
          "padding-right": "Padding right",
          "padding-bottom": "Padding bottom",
          "padding-left": "Padding left",
          "margin-top": "Margin top",
          "margin-right": "Margin right",
          "margin-bottom": "Margin bottom",
          "margin-left": "Margin left",
          "font-family": "Font family",
          color: "Color",
          "font-size": "Font size",
          "line-height": "Line height",
        }[property];
        section.append(
          copyButton(
            short + value,
            group,
            property,
            t("Copy {name}", { name: t(caption) }),
          ),
        );
      }
      inspector.append(section);
    }
  }
  new ResizeObserver(
    ([entry]) =>
      void command({
        action: "inspector_height",
        height: entry.borderBoxSize[0].blockSize,
      }),
  ).observe(document.getElementById("inspector"));
  api.onFocusUrl(() => {
    input.focus();
    input.select();
  });
  document.getElementById("toolbar").addEventListener("submit", (event) => {
    event.preventDefault();
    let url = input.value.trim();
    if (!url.includes("://"))
      url = /^localhost\b|^127\.0\.0\.1\b/.test(url)
        ? `http://${url}`
        : `https://${url}`;
    input.blur();
    void command({ action: "load_page", url });
  });
  document
    .getElementById("enter-url")
    .addEventListener("click", () => input.focus());
  document.addEventListener("click", (event) => {
    const node = event.target.closest("[data-action],[data-menu]");
    if (!node || node.disabled) return;
    if (node.dataset.menu) void openPopover(node.dataset.menu, node);
    else if (node.dataset.action === "screenshot" && !state.selection)
      void openPopover("screenshot", node);
    else if (node.dataset.action === "show_warnings")
      void openPopover("warnings", node);
    else {
      closePopover();
      if (["import_to_canvas", "screenshot"].includes(node.dataset.action)) {
        if (pendingImport) return;
        pendingImport = true;
        render(state);
        void command({ action: node.dataset.action }).finally(() => {
          pendingImport = false;
          render(state);
        });
      } else void command({ action: node.dataset.action });
    }
  });
  document.addEventListener("pointerdown", (event) => {
    if (
      !popover.hidden &&
      !popover.contains(event.target) &&
      !event.target.closest(
        "[data-menu],[data-action='screenshot'],[data-action='show_warnings']",
      )
    )
      closePopover();
  });
  function showTooltip(node) {
    hideTooltip();
    if (!popover.hidden || !node?.dataset.tooltip || node.disabled) return;
    tooltipTimer = setTimeout(() => {
      if (!node.isConnected || !popover.hidden) return;
      tooltipAnchor = node;
      node.setAttribute("aria-describedby", "tooltip");
      tooltip.textContent = node.dataset.tooltip;
      tooltip.hidden = false;
      const rect = node.getBoundingClientRect();
      tooltip.style.left = `${Math.max(8, Math.min(rect.left + (rect.width - tooltip.offsetWidth) / 2, innerWidth - tooltip.offsetWidth - 8))}px`;
      tooltip.style.top = `${rect.bottom + tooltip.offsetHeight + 8 > innerHeight ? rect.top - tooltip.offsetHeight - 6 : rect.bottom + 6}px`;
      void api.command({ action: "overlay", visible: true });
    }, 450);
  }
  document.addEventListener("pointerover", (event) => {
    const node = event.target.closest("[data-tooltip]");
    if (node && !node.contains(event.relatedTarget)) showTooltip(node);
  });
  document.addEventListener("pointerout", (event) => {
    const node = event.target.closest("[data-tooltip]");
    if (node && !node.contains(event.relatedTarget)) hideTooltip();
  });
  document.addEventListener("focusin", (event) =>
    showTooltip(event.target.closest("[data-tooltip]")),
  );
  document.addEventListener("focusout", hideTooltip);
  window.addEventListener("blur", () => closePopover());
  document.addEventListener("keydown", (event) => {
    if (!popover.hidden) {
      if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        const nodes = [...menu.querySelectorAll("button:not(:disabled)")];
        const index = nodes.indexOf(document.activeElement);
        const next =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? nodes.length - 1
              : (index + (event.key === "ArrowUp" ? -1 : 1) + nodes.length) %
                nodes.length;
        nodes[next]?.focus();
      }
      if (event.key === "Escape" || event.key === "Tab") {
        event.preventDefault();
        closePopover(true);
      }
      return;
    }
    hideTooltip();
    if (event.key === "Escape" && (state?.picking || state?.selection))
      void command({ action: "clear_selection" });
    if ((event.metaKey || event.ctrlKey) && event.key === "l") {
      event.preventDefault();
      input.focus();
      input.select();
    }
    if (
      event.key === "Enter" &&
      state?.selection &&
      event.target !== input &&
      event.target.tagName !== "BUTTON"
    )
      void command({
        action:
          event.metaKey || event.ctrlKey
            ? "screenshot_to_canvas"
            : "import_to_canvas",
        target: "selection",
      });
  });
  const heightHandle = document.getElementById("height-handle");
  heightHandle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || state?.busy) return;
    closePopover();
    heightResize = {
      y: event.clientY,
      height: state.viewportHeight,
      active: state.importHeight !== null,
    };
    heightHandle.setPointerCapture(event.pointerId);
    heightHandle.dataset.resizing = "true";
    document.body.dataset.heightResizing = "true";
    void api.command({ action: "overlay", visible: true });
    event.preventDefault();
  });
  heightHandle.addEventListener("pointermove", (event) => {
    if (!heightResize) return;
    const delta = event.clientY - heightResize.y;
    if (!heightResize.active && Math.abs(delta) < 16) return;
    heightResize.active = true;
    void command({
      action: "set_import_height",
      height: Math.max(
        240,
        Math.min(
          state.maxImportHeight,
          Math.round(heightResize.height + delta),
        ),
      ),
    });
  });
  const stopHeightResize = () => {
    if (!heightResize) return;
    heightResize = undefined;
    delete heightHandle.dataset.resizing;
    delete document.body.dataset.heightResizing;
    hideTooltip();
  };
  heightHandle.addEventListener("pointerup", stopHeightResize);
  heightHandle.addEventListener("pointercancel", stopHeightResize);
  heightHandle.addEventListener("lostpointercapture", stopHeightResize);
  heightHandle.addEventListener("dblclick", () => {
    if (!state.busy) void command({ action: "set_import_height" });
  });
  heightHandle.addEventListener("keydown", (event) => {
    if (
      state.busy ||
      !["ArrowUp", "ArrowDown", "Home", "End", "Enter"].includes(event.key)
    )
      return;
    event.preventDefault();
    event.stopPropagation();
    const height =
      event.key === "Home"
        ? 240
        : ["End", "Enter"].includes(event.key)
          ? undefined
          : Math.max(
              240,
              Math.min(
                state.maxImportHeight,
                state.viewportHeight + (event.key === "ArrowUp" ? -24 : 24),
              ),
            );
    void command({
      action: "set_import_height",
      ...(height === undefined ? {} : { height }),
    });
  });
  const resizeHandle = document.getElementById("resize-handle");
  let resize;
  const stopResize = async (event) => {
    if (
      !resize ||
      (event?.pointerId !== undefined && event.pointerId !== resize.pointerId)
    )
      return;
    const { pointerId } = resize;
    resize = undefined;
    if (resizeHandle.hasPointerCapture(pointerId))
      resizeHandle.releasePointerCapture(pointerId);
    const snapshot = await command({ action: "initialize" });
    if (snapshot) render(snapshot);
  };
  resizeHandle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || state?.expanded) return;
    resize = {
      pointerId: event.pointerId,
      x: event.screenX,
      width: state.bounds.width,
    };
    resizeHandle.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  resizeHandle.addEventListener("pointermove", (event) => {
    if (!resize || event.pointerId !== resize.pointerId) return;
    if (!(event.buttons & 1)) {
      void stopResize(event);
      return;
    }
    void command({
      action: "panel_width",
      width: resize.width + resize.x - event.screenX,
    });
  });
  resizeHandle.addEventListener("pointerup", stopResize);
  resizeHandle.addEventListener("pointercancel", stopResize);
  resizeHandle.addEventListener("lostpointercapture", stopResize);
  window.addEventListener("blur", stopResize);
  api.onState(render);
  void api.command({ action: "initialize" }).then(render);
})();
