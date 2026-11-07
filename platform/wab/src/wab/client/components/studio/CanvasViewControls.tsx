import { useActiveContentEditor } from "@/wab/client/studio-ctx/canvas-content-editor";
import { useStudioRenderPolicy } from "@/wab/client/studio-ctx/studio-render-policy";
import { useStudioSelection } from "@/wab/client/studio-ctx/selection-state";
import { useShallow } from "zustand/react/shallow";
import { ZoomButton } from "@/wab/client/components/top-bar/ZoomButton";
import { editorCanvasControlsLayout } from "@/wab/client/components/ui/layout-styles";
import { useI18n } from "@/wab/client/i18n";
import { useStudioArena } from "@/wab/client/studio-ctx/arena-state";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { Button, Tooltip } from "antd";
import { createStyles } from "antd-style";
import { observer } from "mobx-react";
import { ok } from "neverthrow";
import * as React from "react";

const useStyles = createStyles(({ token }) => ({
  root: {
    position: "absolute",
    right: editorCanvasControlsLayout.edgeInset,
    bottom: editorCanvasControlsLayout.edgeInset,
    zIndex: 30,
    maxWidth: "calc(100% - 100px)",
    display: "flex",
    alignItems: "center",
    gap: 2,
    height: editorCanvasControlsLayout.height,
    boxSizing: "border-box",
    padding: 3,
    borderRadius: token.borderRadius,
    background: token.colorBgContainer,
    border: `1px solid ${token.colorBorder}`,
    boxShadow: token.boxShadowSecondary,
    color: token.colorText,
    "& button[aria-expanded=true]": {
      background: token.colorFillSecondary,
    },
    "& button:focus-visible": {
      outline: `2px solid ${token.colorPrimary}`,
      outlineOffset: 2,
    },
    "& svg": {
      width: 16,
      height: 16,
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.6,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    },
  },
  action: {
    "&.ant-btn": {
      minWidth: 28,
      height: 28,
      padding: 0,
      // Match Antd's hover border so its transition cannot flash currentColor.
      border: "1px solid transparent",
      borderRadius: 5,
      boxShadow: "none",
      "&.ant-btn-icon-only": { width: 28 },
    },
  },
  pressed: {
    // Outrank Antd's text-button hover rule so the pressed state stays visible.
    "&.ant-btn.ant-btn, &.ant-btn.ant-btn:not(:disabled):hover": {
      color: token.colorPrimary,
      background: token.colorPrimaryBg,
    },
  },
  separator: {
    width: 1,
    height: 14,
    marginInline: 3,
    background: token.colorBorder,
  },
}));
export const CanvasViewControls = observer(function CanvasViewControls({
  studioCtx,
}: {
  studioCtx?: StudioCtx;
}) {
  useStudioSelection(
    studioCtx,
    useShallow((state) => [state.frames, state.view]),
  );
  const current = useStudioArena(studioCtx, (state) => state.current);
  const firstFrame = useStudioArena(studioCtx, (state) => state.frames[0]);
  const arenaEmpty = useStudioArena(
    studioCtx,
    (state) => state.frames.length === 0,
  );
  const { t } = useI18n();
  const { styles, cx } = useStyles();
  const [interactive, fullPageHeight] = useStudioRenderPolicy(
    studioCtx,
    useShallow((state) => [state.interactive, state.fullPageHeight] as const),
  );
  const contentView = useActiveContentEditor(studioCtx)?.viewCtx;
  const focusedFrame = studioCtx?.focusedContentFrame();
  const hasFrame = !!focusedFrame || (current !== null && !!firstFrame);
  return (
    <div
      className={styles.root}
      role="toolbar"
      data-test-id="canvas-view-controls"
      aria-label={t("Canvas view")}
    >
      <Tooltip title={`${t(interactive ? "Turn off interactive mode" : "Turn on interactive mode")} (Shift + I)`}>
        <Button
          type="text"
          id="interactive-canvas-switch"
          className={cx(styles.action, interactive && styles.pressed)}
          aria-label={t("Interactive")}
          aria-pressed={!!interactive}
          disabled={!studioCtx || arenaEmpty}
          data-test-id="interactive-switch"
          icon={
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m9 9 5 12 2-5 5-2-12-5Z M4 4l2 2 M9 2v3 M2 9h3 M14 4l-2 2 M4 14l2-2" />
            </svg>
          }
          onClick={() => {
            if (!studioCtx) {
              return;
            }
            void studioCtx.change(() => {
              studioCtx.toggleInteractiveMode();
              return ok();
            });
          }}
        />
      </Tooltip>
      <span className={styles.separator} aria-hidden="true" />
      <Tooltip
        title={t(
          fullPageHeight ? "Fit to viewport height" : "Show full page height",
        )}
      >
        <Button
          type="text"
          className={cx(styles.action, fullPageHeight && styles.pressed)}
          aria-label={t("Full page height")}
          aria-pressed={fullPageHeight}
          data-test-id="toggle-full-page-height"
          disabled={!studioCtx}
          icon={
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3v18 M8 7l4-4 4 4 M8 17l4 4 4-4 M4 3h3 M17 3h3 M4 21h3 M17 21h3" />
            </svg>
          }
          onClick={() => studioCtx?.toggleFullPageHeight()}
        />
      </Tooltip>
      <span className={styles.separator} aria-hidden="true" />
      <Tooltip title={t("Locate current canvas")}>
        <Button
          type="text"
          className={styles.action}
          aria-label={t("Locate current canvas")}
          disabled={!studioCtx || arenaEmpty || !hasFrame}
          icon={
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 3H5a2 2 0 0 0-2 2v3 M16 3h3a2 2 0 0 1 2 2v3 M21 16v3a2 2 0 0 1-2 2h-3 M8 21H5a2 2 0 0 1-2-2v-3" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          }
          onClick={() => {
            if (studioCtx) {
              const first = studioCtx.arenaState.store.getState().frames[0];
              const frame = studioCtx.focusedContentFrame() ??
                (first ? studioCtx.modelSnapshots.resolve(first) : undefined);
              if (frame) {
                if (contentView) { contentView.contentEditor.locate(); }
                else { studioCtx.tryZoomToFitFrame(frame, 1); }
              }
            }
          }}
        />
      </Tooltip>
      <span className={styles.separator} aria-hidden="true" />
      {studioCtx ? (
        <ZoomButton />
      ) : (
        <Button
          type="text"
          disabled
          aria-label={t("Zoom")}
          style={{ width: 68, height: 28, padding: "0 7px", fontSize: 12 }}
        >
          —
        </Button>
      )}
      <span className={styles.separator} aria-hidden="true" />
      <Tooltip title={t("Zoom to fit all")}>
        <Button
          type="text"
          className={styles.action}
          aria-label={t("Zoom to fit all")}
          disabled={!studioCtx || arenaEmpty}
          icon={
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 3H5a2 2 0 0 0-2 2v3 M16 3h3a2 2 0 0 1 2 2v3 M21 16v3a2 2 0 0 1-2 2h-3 M8 21H5a2 2 0 0 1-2-2v-3" />
            </svg>
          }
          onClick={() => {
            if (!studioCtx) {
              return;
            }
            if (contentView) { contentView.contentEditor.locate(true); return; }
            studioCtx.returnToCanvasOverview();
            if (studioCtx.focusedMode) {
              studioCtx.turnFocusedModeOff();
            }
            studioCtx.tryZoomToFitArena();
          }}
        />
      </Tooltip>
    </div>
  );
});
