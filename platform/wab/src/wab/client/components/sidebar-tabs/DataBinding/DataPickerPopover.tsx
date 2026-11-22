import { zIndex } from "@/wab/client/z-index";
import { cx } from "@/wab/shared/common";
import { Popover, PopoverProps } from "antd";
import * as React from "react";

const POPOVER_HOST_ATTR = "data-data-picker-popover-host";

/**
 * Mounts DataPicker overlays inside a fixed viewport-locked layer so transient
 * off-screen layout or editor autofocus cannot scroll the root document.
 */
function getDefaultPopoverHost(triggerNode: HTMLElement): HTMLElement {
  const doc = triggerNode.ownerDocument ?? document;
  const body = doc.body;
  if (!body) {
    return triggerNode;
  }
  let host = body.querySelector<HTMLElement>(`[${POPOVER_HOST_ATTR}]`);
  if (!host) {
    host = doc.createElement("div");
    host.setAttribute(POPOVER_HOST_ATTR, "");
    host.className = "data-picker-popover-host";
    body.appendChild(host);
  }
  return host;
}

/** Shared Popover wrapper for DataPicker overlays anchored cleanly inside the viewport. */
export function DataPickerPopover({
  placement = "left",
  arrow = false,
  trigger = "click",
  destroyOnHidden = true,
  zIndex: popupZIndex = zIndex.dataPicker,
  getPopupContainer = getDefaultPopoverHost,
  overlayClassName,
  ...rest
}: PopoverProps) {
  return (
    <Popover
      {...rest}
      placement={placement}
      arrow={arrow}
      trigger={trigger}
      destroyOnHidden={destroyOnHidden}
      zIndex={popupZIndex}
      getPopupContainer={getPopupContainer}
      overlayClassName={cx("data-picker-popover-overlay", overlayClassName)}
    />
  );
}
