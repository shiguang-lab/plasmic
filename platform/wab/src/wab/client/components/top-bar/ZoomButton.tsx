import styles from "./ZoomButton.module.less";
import popupStyles from "../ui/EditorPopup.module.less";
import { useCanvasZoom } from "@/wab/client/studio-ctx/viewport-state";
import { MenuItemContent } from "@/wab/client/components/menu-builder";
import {
  ClickStopper,
  IFrameAwareDropdownMenu,
} from "@/wab/client/components/widgets";
import { useFocusOnDisplayed } from "@/wab/client/dom-utils";
import { useI18n } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import { getComboForAction } from "@/wab/client/shortcuts/studio/studio-shortcuts";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { spawn } from "@/wab/shared/common";
import { Button, InputNumber, Menu } from "antd";
import { useStore } from "zustand";
import * as React from "react";
import { FiChevronDown } from "react-icons/fi";
function ZoomSpinner() {
  const studioCtx = useStudioCtx();
  const viewportZoom = useCanvasZoom(studioCtx);
  const { t } = useI18n();

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
        value={+(viewportZoom * 100).toFixed(0)}
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

export function ZoomButton() {
  const { t: uiT } = useI18n();
  const studioCtx = useStudioCtx();
  const currentArenaEmpty = useStore(studioCtx.uiEnvironment.store, (state) => state.currentArenaEmpty);
  const viewportZoom = useCanvasZoom(studioCtx);
  const [open, setOpen] = React.useState(false);

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
        disabled={currentArenaEmpty}
        onClick={() => {
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
      overlayStyle={{ maxHeight: "calc(100vh - 120px)", overflow: "hidden" }}
    >
      <Button
        type="text"
        className={styles.trigger}
        aria-label={uiT("Zoom")}
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={currentArenaEmpty}
      >
        {Math.round(viewportZoom * 100)}%
        <FiChevronDown aria-hidden="true" />
      </Button>
    </IFrameAwareDropdownMenu>
  );
}

export default ZoomButton;
