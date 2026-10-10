import { MenuItemContent } from "@/wab/client/components/menu-builder";
import { useEditorPopupStyles } from "@/wab/client/components/ui/layout-styles";
import {
  ClickStopper,
  IFrameAwareDropdownMenu,
} from "@/wab/client/components/widgets";
import { useFocusOnDisplayed } from "@/wab/client/dom-utils";
import { useI18n } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import PlasmicZoomButton from "@/wab/client/plasmic/plasmic_kit_top_bar/PlasmicZoomButton";
import { getComboForAction } from "@/wab/client/shortcuts/studio/studio-shortcuts";
import { useStudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { spawn } from "@/wab/shared/common";
import { InputNumber, Menu } from "antd";
import { createStyles } from "antd-style";
import { observer } from "mobx-react";
import * as React from "react";

const ZoomSpinner = observer(ZoomSpinner_);
const useStyles = createStyles(({ token }) => ({
  menu: {
    width: 248,
    maxWidth: "calc(100vw - 32px)",
    padding: "4px !important",
    background: `${token.colorBgElevated} !important`,
    color: `${token.colorText} !important`,
    border: `1px solid ${token.colorBorder} !important`,
    borderRadius: `${token.borderRadiusLG}px !important`,
    boxShadow: `${token.boxShadowSecondary} !important`,
    "&.ant-menu": {
      background: token.colorBgElevated,
      border: "none",
      boxShadow: "none",
    },
    // The input container item - completely transparent to avoid white outline on focus/active
    "& .ant-menu-item.ant-dropdown-menu-item--not-selectable, & .ant-dropdown-menu-item--not-selectable":
      {
        height: "auto !important",
        minHeight: "unset !important",
        lineHeight: "normal !important",
        background: "transparent !important",
        padding: "2px 2px 4px 2px !important",
        margin: "0 0 2px 0 !important",
        cursor: "default !important",
        boxShadow: "none !important",
        "&:hover, &:focus, &:active, &.ant-menu-item-active, &.ant-menu-item-selected":
          {
            background: "transparent !important",
            color: "inherit !important",
          },
      },
    "& .ant-menu-item-divider, & .ant-menu-divider": {
      margin: "4px 0 !important",
      borderColor: `${token.colorBorderSecondary} !important`,
    },
    // Normal actionable menu items
    "& .ant-menu-item:not(.ant-dropdown-menu-item--not-selectable), & .ant-dropdown-menu-item:not(.ant-dropdown-menu-item--not-selectable)":
      {
        height: "36px !important",
        minHeight: "36px !important",
        lineHeight: "24px !important",
        margin: "2px 0 !important",
        padding: "6px 10px !important",
        width: "100% !important",
        borderRadius: `${token.borderRadius}px !important`,
        color: `${token.colorText} !important`,
        fontSize: "13px !important",
        display: "flex !important",
        alignItems: "center !important",
        cursor: "pointer !important",
        transition: "background 0.15s ease, color 0.15s ease !important",
        background: "transparent",
        "&:hover, &.ant-menu-item-active": {
          background: `${token.colorFillSecondary} !important`,
          color: `${token.colorText} !important`,
        },
        "&.ant-menu-item-disabled, &[aria-disabled=true]": {
          opacity: "0.4 !important",
          cursor: "not-allowed !important",
          "&:hover, &.ant-menu-item-active": {
            background: "transparent !important",
          },
        },
        "&[aria-checked=true], &.ant-menu-item-selected": {
          background: `${token.colorPrimaryBg} !important`,
          color: `${token.colorPrimaryText} !important`,
        },
        "&:focus-visible": {
          outline: `2px solid ${token.colorPrimary} !important`,
          outlineOffset: "-2px !important",
        },
      },
    "& .ant-menu-item .flex, & .ant-dropdown-menu-item .flex": {
      width: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
    },
    "& .shortcut-combo": {
      background: `${token.colorFillTertiary} !important`,
      color: `${token.colorTextSecondary} !important`,
      border: `1px solid ${token.colorBorderSecondary} !important`,
      borderRadius: "4px !important",
      padding: "1px 6px !important",
      fontSize: "11px !important",
      lineHeight: "16px !important",
      minWidth: "18px !important",
      textAlign: "center",
      fontFamily: "inherit !important",
      boxShadow: "none !important",
    },
    "& .ant-menu-item:hover .shortcut-combo, & .ant-dropdown-menu-item:hover .shortcut-combo":
      {
        color: `${token.colorText} !important`,
        borderColor: `${token.colorBorder} !important`,
      },
  },
  input: {
    width: "100%",
    height: 36,
    background: token.colorBgContainer,
    color: token.colorText,
    borderRadius: token.borderRadius,
    border: `1px solid ${token.colorBorder}`,
    boxShadow: "none",
    "&:hover": {
      borderColor: token.colorPrimaryHover,
    },
    "&:focus, &-focused": {
      borderColor: token.colorPrimary,
      background: token.colorBgContainer,
      boxShadow: `0 0 0 2px ${token.controlOutline}`,
    },
    "& input": {
      color: token.colorText,
      height: 34,
      background: "transparent",
    },
    "& input::selection": {
      background: token.colorPrimary,
      color: token.colorTextLightSolid,
    },
    "& .ant-input-number-handler-wrap": {
      background: token.colorFillQuaternary,
      borderLeft: `1px solid ${token.colorBorderSecondary}`,
      borderRadius: `0 ${token.borderRadius}px ${token.borderRadius}px 0`,
    },
    "& .ant-input-number-handler": {
      borderColor: token.colorBorderSecondary,
      color: token.colorTextSecondary,
      "&:hover": {
        color: token.colorPrimary,
      },
    },
  },
}));
function ZoomSpinner_() {
  const studioCtx = useStudioCtx();
  const { t } = useI18n();
  const { styles } = useStyles();
  const ref = React.useRef<React.ElementRef<typeof InputNumber>>(null);
  // The dropdown mounts the dropdown content while it is still display:none, so
  // autoFocus alone never fires here.
  useFocusOnDisplayed(() => ref.current?.nativeElement.querySelector("input"), {
    autoFocus: true,
    selectAll: true,
  });
  return (
    <ClickStopper>
      <InputNumber
        ref={ref}
        value={+(studioCtx.zoom * 100).toFixed(0)}
        className={styles.input}
        aria-label={t("Zoom")}
        formatter={(v) => `${v}%`}
        parser={(v) => +`${v}`.replace("%", "")}
        autoFocus
        precision={0}
        onChange={(pct) => {
          if (typeof pct === "number" && Number.isFinite(pct) && pct > 0) {
            studioCtx.tryZoomWithScale(pct / 100);
          }
        }}
      />
    </ClickStopper>
  );
}

export const ZoomButton = observer(function ZoomButton() {
  const { t: uiT } = useI18n();
  const studioCtx = useStudioCtx();
  const [open, setOpen] = React.useState(false);
  const { styles } = useStyles();
  const { styles: popupStyles } = useEditorPopupStyles();
  const menu = () => (
    <Menu className={`${styles.menu} ${popupStyles.root}`} selectedKeys={[]}>
      <Menu.Item className="ant-dropdown-menu-item--not-selectable">
        <ZoomSpinner />
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item onClick={() => studioCtx.tryZoomWithDirection(1)}>
        <MenuItemContent shortcut={getComboForAction("ZOOM_IN")}>
          <UiText message={"Zoom in"} />
        </MenuItemContent>
      </Menu.Item>
      <Menu.Item onClick={() => studioCtx.tryZoomWithDirection(-1)}>
        <MenuItemContent shortcut={getComboForAction("ZOOM_OUT")}>
          <UiText message={"Zoom out"} />
        </MenuItemContent>
      </Menu.Item>
      <Menu.Item
        disabled={studioCtx.currentArenaEmpty}
        onClick={() => {
          studioCtx.returnToCanvasOverview();
          studioCtx.tryZoomToFitArena();
        }}
      >
        <MenuItemContent shortcut={getComboForAction("ZOOM_TO_FIT")}>
          <UiText message={"Zoom to fit all"} />
        </MenuItemContent>
      </Menu.Item>
      <Menu.Item onClick={() => spawn(studioCtx.tryZoomToFitSelection())}>
        <MenuItemContent shortcut={getComboForAction("ZOOM_TO_SELECTION")}>
          <UiText message={"Zoom to fit selection"} />
        </MenuItemContent>
      </Menu.Item>
      <Menu.Item onClick={() => studioCtx.tryZoomWithScale(1)}>
        <MenuItemContent shortcut={getComboForAction("ZOOM_RESET")}>
          <UiText message={"Zoom to 100%"} />
        </MenuItemContent>
      </Menu.Item>
    </Menu>
  );

  return (
    <IFrameAwareDropdownMenu
      menu={menu}
      placement="top"
      onVisibleChange={setOpen}
      overlayStyle={{ maxHeight: "calc(100vh - 120px)", overflowY: "auto" }}
    >
      <PlasmicZoomButton
        root={{
          props: {
            "aria-label": uiT("Zoom"),
            "aria-expanded": open,
            "aria-haspopup": "menu",
            style: { height: 36 },
          },
        }}
        children={`${Math.round(studioCtx.zoom * 100)}%`}
        disabled={studioCtx.currentArenaEmpty}
      />
    </IFrameAwareDropdownMenu>
  );
});

export default ZoomButton;
