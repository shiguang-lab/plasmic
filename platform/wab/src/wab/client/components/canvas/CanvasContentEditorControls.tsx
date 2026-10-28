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
import { FiArrowLeft, FiMaximize2 } from "react-icons/fi";

const useStyles = createStyles(({ token }) => ({
  root: {
    position: "absolute",
    zIndex: 30,
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    padding: "7px 10px",
    borderRadius: token.borderRadiusLG,
    background: token.colorBgContainer,
    border: `1px solid ${token.colorBorder}`,
    boxShadow: token.boxShadowSecondary,
    color: token.colorText,
    fontSize: 12,
    pointerEvents: "auto",
    "& button": { fontSize: 12 },
  },
  name: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    flex: 1,
  },
  caption: { fontSize: 11, color: token.colorPrimary },
}));

export const CanvasContentEditorControls = observer(
  function CanvasContentEditorControls({
    studioCtx,
  }: {
    studioCtx: StudioCtx;
  }) {
    const active = studioCtx.viewCtxs.find((vc) => vc.contentEditor.target);
    const vc = active ?? studioCtx.focusedViewCtx();
    const current = active?.contentEditor.target;
    const candidate = vc && getContentEditorTarget(vc);
    const entry =
      candidate &&
      (!current ||
        ((candidate.tpl !== current.tpl ||
          candidate.fullKey !== current.fullKey) &&
          candidate.element !== current.element &&
          current.element.contains(candidate.element)))
        ? candidate
        : undefined;
    if (!vc || studioCtx.isInteractiveMode || studioCtx.isLiveMode) {
      return null;
    }
    return (
      <>
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
      const modeBar = parent.querySelector<HTMLElement>(
        "[data-content-editor-mode]",
      );
      const minTop =
        !editing && modeBar
          ? Math.max(60, modeBar.offsetTop + modeBar.offsetHeight + 8)
          : 60;
      const bounds = frameToClientRect(
        target.element.getBoundingClientRect(),
        vc,
      );
      const next = {
        left: editing
          ? left
          : Math.max(
              left,
              Math.min(bounds.left - area.left, right - node.offsetWidth),
            ),
        top: editing
          ? 60
          : Math.max(
              minTop,
              Math.min(
                bounds.top - area.top - node.offsetHeight - 8,
                area.height - node.offsetHeight - 60,
              ),
            ),
        maxWidth: Math.max(120, right - left),
      };
      setPosition((prev) =>
        prev.left === next.left &&
        prev.top === next.top &&
        prev.maxWidth === next.maxWidth
          ? prev
          : next,
      );
    };
    measure();
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(parent);
    resizeObserver.observe(node);
    resizeObserver.observe(target.element);
    const modeBar = parent.querySelector<HTMLElement>(
      "[data-content-editor-mode]",
    );
    if (!editing && modeBar) {
      resizeObserver.observe(modeBar);
    }
    return () => resizeObserver.disconnect();
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
      aria-label={t(editing ? "Content editing" : "Edit content")}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className={styles.name}>
        {editing && (
          <div className={styles.caption}>{t("Content editing")}</div>
        )}
        <span>{name}</span>
      </div>
      <Button
        size="small"
        type={editing ? "default" : "primary"}
        icon={editing ? <FiArrowLeft /> : <FiMaximize2 />}
        onClick={() =>
          editing
            ? vc.contentEditor.exit()
            : void vc.contentEditor.enter(target)
        }
      >
        {t(editing ? "Exit content editing" : "Edit content")}
        {editing && <span> Esc</span>}
      </Button>
    </div>
  );
});
