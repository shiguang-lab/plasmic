import {
  usePlasmicCanvasComponentInfo,
  usePlasmicCanvasContext,
} from "@plasmicapp/host";
import { ReactElement, useEffect } from "react";

/** Child selection uses the same SDK contract as editing-only overlays. */
export function getSelectedCanvasItemKey(items: ReactElement[]) {
  return items.find((item) => item.props.__plasmic_selection_prop__?.isSelected)?.key;
}

export interface CanvasOverlayProps {
  previewOpen?: boolean;
  plasmicNotifyAutoOpenedContent?: () => void;
  __plasmic_selection_prop__?: unknown;
}

export const previewOpenProp = {
  type: "boolean" as const,
  displayName: "编辑时展开",
  editOnly: true,
  description:
    "仅在编辑画布中展开或关闭浮层。未设置时跟随选择，不改变运行时的 open 状态。",
};

/** Selection controls only the design canvas; preview keeps the native open state. */
export function useCanvasOverlay<
  P extends CanvasOverlayProps & { open?: boolean },
>(props: P, triggerSlotName?: string) {
  const canvas = usePlasmicCanvasContext();
  const selection = usePlasmicCanvasComponentInfo(props);
  const isEditing = !!canvas && !canvas.interactive;
  const {
    open,
    previewOpen,
    plasmicNotifyAutoOpenedContent,
    __plasmic_selection_prop__: _selection,
    ...rest
  } = props;
  const autoOpen =
    isEditing &&
    !!selection?.isSelected &&
    (!triggerSlotName || selection.selectedSlotName !== triggerSlotName);
  const autoOpened = autoOpen && previewOpen === undefined && !open;

  useEffect(() => {
    if (autoOpened) {
      plasmicNotifyAutoOpenedContent?.();
    }
  }, [autoOpened, plasmicNotifyAutoOpenedContent]);

  return {
    props: rest,
    isEditing,
    open: isEditing ? (previewOpen ?? (autoOpen || !!open)) : open,
  };
}
