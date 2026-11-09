import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { getSlotSelectionContainingTpl } from "@/wab/shared/SlotUtils";
import type { SlotSelection } from "@/wab/shared/core/slots";
import type { TplNode } from "@/wab/shared/model/classes";
import { isCodeComponent } from "@/wab/shared/core/components";

export function isFixedRootSlot(view: ViewCtx, slot: SlotSelection) {
  const component = slot.getTpl().component;
  if (!isCodeComponent(component)) return false;
  const prop = view.getCodeComponentMeta(component)?.props[slot.slotParam.variable.name];
  return !!prop && typeof prop === "object" && prop.type === "slot" && !!prop.fixedRoot;
}

export function isFixedSlotRoot(view: ViewCtx, node: TplNode | null | undefined) {
  const slot = node && getSlotSelectionContainingTpl(node);
  return !!slot && isFixedRootSlot(view, slot);
}
