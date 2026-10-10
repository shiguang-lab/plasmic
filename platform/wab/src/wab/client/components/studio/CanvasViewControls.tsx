import { ZoomButton } from "@/wab/client/components/top-bar/ZoomButton";
import { useI18n } from "@/wab/client/i18n";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { getArenaFrames, isMixedArena } from "@/wab/shared/Arenas";
import { Button, Space } from "antd";
import { createStyles } from "antd-style";
import { observer } from "mobx-react";
import * as React from "react";

const useStyles = createStyles(({ token }) => ({
  root: {
    position: "absolute",
    right: 16,
    bottom: 20,
    zIndex: 30,
    maxWidth: "calc(100% - 100px)",
    padding: 6,
    borderRadius: token.borderRadiusLG,
    background: token.colorBgContainer,
    border: `1px solid ${token.colorBorder}`,
    boxShadow: token.boxShadowSecondary,
    color: token.colorText,
    "& .ant-btn": { height: 36, fontSize: 12, boxShadow: "none" },
    "& button[aria-expanded=true]": {
      background: token.colorPrimaryBg,
      color: token.colorPrimaryText,
      border: `1px solid ${token.colorPrimary}`,
      borderRadius: token.borderRadius,
    },
    "& button:focus-visible": {
      outline: `2px solid ${token.colorPrimary}`,
      outlineOffset: 2,
    },
    "& svg": {
      width: 18,
      height: 18,
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.6,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    },
  },
}));
export const CanvasViewControls = observer(function CanvasViewControls({
  studioCtx,
}: {
  studioCtx: StudioCtx;
}) {
  const { t } = useI18n();
  const { styles } = useStyles();
  const focused = studioCtx.canvasFocusActive || studioCtx.focusedMode;
  const frame =
    studioCtx.focusedOrFirstViewCtx()?.arenaFrame() ??
    getArenaFrames(studioCtx.currentArena)[0];
  return (
    <Space
      size={4}
      className={styles.root}
      role="toolbar"
      data-test-id="canvas-view-controls"
      aria-label={t("Canvas view")}
    >
      <Button
        disabled={studioCtx.currentArenaEmpty || !frame}
        icon={
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 3 7 21 M17 3 15 21 M3 9h18 M3 15h18" />
          </svg>
        }
        onClick={() => {
          if (isMixedArena(studioCtx.currentArena)) {
            if (focused) {
              studioCtx.returnToCanvasOverview();
            } else if (frame) {
              studioCtx.focusCanvasFrame(frame);
            }
          } else {
            studioCtx.toggleFocusedMode();
          }
        }}
      >
        {t(focused ? "Return to overview" : "Focus canvas")}
      </Button>
      <ZoomButton />
      <Button
        disabled={studioCtx.currentArenaEmpty}
        onClick={() => {
          studioCtx.returnToCanvasOverview();
          if (studioCtx.focusedMode) {
            studioCtx.turnFocusedModeOff();
          }
          studioCtx.tryZoomToFitArena();
        }}
      >
        {t("Zoom to fit all")}
      </Button>
    </Space>
  );
});
