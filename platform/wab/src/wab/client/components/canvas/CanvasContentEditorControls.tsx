import { getVisibleFrameRect } from "@/wab/client/components/canvas/HoverBox/visible-bounds";
import { placeContentEditorToolbar } from "@/wab/client/components/canvas/content-editor-toolbar-placement";
import { frameToClientRect } from "@/wab/client/coords";
import { useI18n } from "@/wab/client/i18n";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import {
  getContentEditorTarget,
  type ContentEditorTarget,
} from "@/wab/client/studio-ctx/canvas-content-editor";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { Button } from "antd";
import { createStyles } from "antd-style";
import { observer } from "mobx-react";
import * as React from "react";
import { FiArrowLeft, FiArrowUpRight } from "react-icons/fi";

const useStyles = createStyles(({ token }) => ({
  preparing: {
    position: "absolute",
    inset: 0,
    zIndex: 31,
    background: token.colorBgLayout,
    display: "grid",
    placeItems: "center",
    pointerEvents: "auto",
  },
  root: {
    position: "absolute",
    zIndex: 30,
    display: "flex",
    flexWrap: "nowrap",
    alignItems: "center",
    gap: 6,
    height: 28,
    padding: "2px 4px 2px 8px",
    width: "max-content",
    boxSizing: "border-box",
    borderRadius: token.borderRadiusSM,
    background: token.colorBgContainer,
    border: `1px solid ${token.colorBorder}`,
    boxShadow: token.boxShadowTertiary,
    color: token.colorText,
    fontSize: 12,
    pointerEvents: "auto",
    "& button": { fontSize: 12, height: 22, padding: "0 6px", flexShrink: 0 },
    "& svg": { width: 12, height: 12 },
  },
  name: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: 160,
    color: token.colorTextSecondary,
  },
  caption: { color: token.colorTextSecondary, whiteSpace: "nowrap" },
  shortcut: {
    color: token.colorTextTertiary,
    fontSize: 11,
    fontFamily: "inherit",
  },
}));

export const CanvasContentEditorControls = observer(
  function CanvasContentEditorControls({
    studioCtx,
  }: {
    studioCtx: StudioCtx;
  }) {
    const active = studioCtx.viewCtxs.find((vc) => vc.contentEditor.target);
    const vc = active ?? studioCtx.focusedViewCtx();
    const [, refreshGeometry] = React.useReducer(
      (value: number) => value + 1,
      0,
    );
    const focused = vc?.focusedDomElts();
    React.useEffect(() => {
      const doc = vc?.canvasCtx.viewport().contentDocument;
      const win = doc?.defaultView;
      if (!doc?.body || !win) {
        return;
      }
      let pending = 0;
      const refresh = () => {
        if (!pending) {
          pending = win.requestAnimationFrame(() => {
            pending = 0;
            refreshGeometry();
          });
        }
      };
      const mutations = new MutationObserver(refresh);
      mutations.observe(doc.body, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: ["class", "style", "hidden"],
      });
      const resize = new ResizeObserver(refresh);
      resize.observe(doc.documentElement);
      resize.observe(doc.body);
      focused?.forEach((nodes) =>
        nodes?.toArray().forEach((node) => resize.observe(node)),
      );
      refresh();
      return () => {
        mutations.disconnect();
        resize.disconnect();
        win.cancelAnimationFrame(pending);
      };
    }, [vc, focused]);
    const current = active?.contentEditor.target;
    const { styles } = useStyles();
    const { t } = useI18n();
    const candidate = vc && getContentEditorTarget(vc);
    const entry =
      candidate &&
      (!current ||
        ((candidate.tpl !== current.tpl ||
          candidate.fullKey !== current.fullKey) &&
          candidate.element !== current.element &&
          vc.contentEditor.containsElement(candidate.element)))
        ? candidate
        : undefined;
    if (!vc || studioCtx.isInteractiveMode || studioCtx.isLiveMode) {
      return null;
    }
    return (
      <>
        {current && !active?.contentEditor.ready.get() && (
          <div
            className={styles.preparing}
            role="status"
            aria-label={t("Content editing")}
            aria-busy="true"
          />
        )}
        {current && (
          <ContentEditorToolbar
            key="mode"
            studioCtx={studioCtx}
            vc={vc}
            target={current}
            editing
          />
        )}
        {entry && (
          <ContentEditorToolbar
            key="entry"
            studioCtx={studioCtx}
            vc={vc}
            target={entry}
            editing={false}
          />
        )}
      </>
    );
  },
);

const ContentEditorToolbar = observer(function ContentEditorToolbar({
  studioCtx,
  vc,
  target,
  editing,
}: {
  studioCtx: StudioCtx;
  vc: ViewCtx;
  target: ContentEditorTarget;
  editing: boolean;
}) {
  const { t } = useI18n();
  const { styles } = useStyles();
  const root = React.useRef<HTMLDivElement>(null);
  const [position, setPosition] = React.useState({
    left: 0,
    top: 60,
    maxWidth: 400,
  });
  // Subscribe to camera movement as well as element and viewport resizing.
  const zoom = studioCtx.zoom;
  const scroll = studioCtx.viewportCtx?.scroll();
  React.useLayoutEffect(() => {
    if (!target || !vc || !root.current) {
      return;
    }
    const node = root.current;
    const parent = node.parentElement;
    if (!parent) {
      return;
    }
    const measure = () => {
      const area = parent.getBoundingClientRect();
      const padding = studioCtx.canvasZoomPadding();
      const left = padding.left;
      const right = Math.max(left + 120, area.width - padding.right);
      // Anchor on the part of the target that is visible (like its selection
      // outline), not on edges clipped by scroll containers or the artboard.
      const bounds = frameToClientRect(
        getVisibleFrameRect(target.element).rect(),
        vc,
      );
      // The mode toolbar owns its anchor; nested entries yield to it.
      const obstacles = editing ? [] : Array.from(
        parent.querySelectorAll<HTMLElement>(
          "[role='toolbar']",
        ),
      )
        .filter((element) => element !== node && !node.contains(element))
        .filter((element) => {
          const css =
            element.ownerDocument.defaultView?.getComputedStyle(element);
          return css?.visibility !== "hidden" && css?.display !== "none";
        })
        .map((element) => element.getBoundingClientRect())
        .filter((rect) => rect.width > 0 && rect.height > 0)
        .map((rect) => ({
          left: rect.left - area.left,
          top: rect.top - area.top,
          width: rect.width,
          height: rect.height,
        }));
      const next = placeContentEditorToolbar(
        {
          left: bounds.left - area.left,
          top: bounds.top - area.top,
          width: bounds.width,
          height: bounds.height,
        },
        {
          left,
          top: 60,
          width: right - left,
          height: Math.max(28, area.height - padding.bottom - 60),
        },
        { width: node.offsetWidth, height: node.offsetHeight },
        obstacles,
      );
      setPosition((prev) =>
        prev.left === next.left &&
        prev.top === next.top &&
        prev.maxWidth === next.maxWidth
          ? prev
          : next,
      );
    };
    measure();
    // Scrolling inside the artboard moves the target and changes which part
    // of it is visible.
    const targetDoc = target.element.ownerDocument;
    targetDoc.addEventListener("scroll", measure, true);
    const overlays = new MutationObserver(measure);
    overlays.observe(parent, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["style"],
    });
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(parent);
    resizeObserver.observe(node);
    resizeObserver.observe(target.element);
    const panels = parent.ownerDocument.querySelectorAll<HTMLElement>(
      ".canvas-editor__left-pane, .canvas-editor__left-pane-container, .canvas-editor__right-pane",
    );
    const panelState = new MutationObserver(measure);
    panels.forEach((panel) => {
      resizeObserver.observe(panel);
      panelState.observe(panel, {
        attributes: true,
        attributeFilter: ["data-open"],
      });
      // Panel transforms change the usable area without changing element sizes.
      panel.addEventListener("transitionend", measure);
    });
    const modeBar = parent.querySelector<HTMLElement>(
      "[data-content-editor-mode]",
    );
    if (!editing && modeBar) {
      resizeObserver.observe(modeBar);
    }
    return () => {
      targetDoc.removeEventListener("scroll", measure, true);
      resizeObserver.disconnect();
      overlays.disconnect();
      panelState.disconnect();
      panels.forEach((panel) =>
        panel.removeEventListener("transitionend", measure),
      );
    };
  }, [target.element, vc, editing, zoom, scroll, studioCtx]);
  const name =
    target.tpl.name ||
    ("component" in target.tpl ? target.tpl.component.name : target.tpl.tag);
  return (
    <div
      ref={root}
      className={styles.root}
      style={position}
      role="toolbar"
      data-content-editor-mode={editing || undefined}
      data-content-editor-entry={!editing || undefined}
      aria-label={t(editing ? "Content editing" : "Edit content")}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {editing && (
        <span className={styles.caption}>{t("Content editing")} ·</span>
      )}
      <span className={styles.name} title={name}>
        {name}
      </span>
      <Button
        size="small"
        type="text"
        aria-label={
          t(editing ? "Exit content editing" : "Edit content") +
          (editing ? " Esc" : "")
        }
        title={t(editing ? "Exit content editing" : "Edit content")}
        icon={editing ? <FiArrowLeft /> : undefined}
        onClick={() =>
          editing
            ? vc.contentEditor.exit()
            : void vc.contentEditor.enter(target)
        }
      >
        {t(editing ? "Exit" : "Edit content")}
        {editing ? (
          <kbd className={styles.shortcut}>Esc</kbd>
        ) : (
          <FiArrowUpRight />
        )}
      </Button>
    </div>
  );
});
