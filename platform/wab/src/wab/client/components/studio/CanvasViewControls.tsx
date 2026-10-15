import { ZoomButton } from "@/wab/client/components/top-bar/ZoomButton";
import { editorCanvasControlsLayout } from "@/wab/client/components/ui/layout-styles";
import { useI18n } from "@/wab/client/i18n";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { getArenaFrames } from "@/wab/shared/Arenas";
import { Button, Tooltip } from "antd";
import { createStyles } from "antd-style";
import { observer } from "mobx-react";
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
    borderRadius: 9,
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
      border: 0,
      borderRadius: 5,
      boxShadow: "none",
      "&.ant-btn-icon-only": { width: 28 },
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
  const { t } = useI18n();
  const { styles } = useStyles();
  const frame =
    studioCtx?.focusedContentFrame() ??
    getArenaFrames(studioCtx?.currentArena)[0];
  return (
    <div
      className={styles.root}
      role="toolbar"
      data-test-id="canvas-view-controls"
      aria-label={t("Canvas view")}
    >
      <Tooltip title={t("Locate current canvas")}>
        <Button
          type="text"
          className={styles.action}
          aria-label={t("Locate current canvas")}
          disabled={!studioCtx || studioCtx.currentArenaEmpty || !frame}
          icon={
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 3H5a2 2 0 0 0-2 2v3 M16 3h3a2 2 0 0 1 2 2v3 M21 16v3a2 2 0 0 1-2 2h-3 M8 21H5a2 2 0 0 1-2-2v-3" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          }
          onClick={() => {
            if (studioCtx && frame) {
              studioCtx.tryZoomToFitFrame(frame, 1);
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
          disabled={!studioCtx || studioCtx.currentArenaEmpty}
          icon={
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 3H5a2 2 0 0 0-2 2v3 M16 3h3a2 2 0 0 1 2 2v3 M21 16v3a2 2 0 0 1-2 2h-3 M8 21H5a2 2 0 0 1-2-2v-3" />
            </svg>
          }
          onClick={() => {
            if (!studioCtx) {
              return;
            }
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
