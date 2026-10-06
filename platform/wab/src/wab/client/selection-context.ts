import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { SlotSelection } from "@/wab/shared/core/slots";
import {
  ancestorsUpWithSlotSelections,
  isTplCodeComponent,
  summarizeTpl,
} from "@/wab/shared/core/tpls";
import { isKnownTplComponent, type TplNode } from "@/wab/shared/model/classes";

/** One editing path for the property panel and public editor context. */
export function selectionPath(viewCtx: ViewCtx, tpl: TplNode | SlotSelection) {
  return ancestorsUpWithSlotSelections(tpl)
    .reverse()
    .map((node) => {
      if (node instanceof SlotSelection) {
        const owner = node.getTpl();
        const prop = isTplCodeComponent(owner)
          ? viewCtx.getTplCodeComponentMeta(owner)?.props[
              node.slotParam.variable.name
            ]
          : undefined;
        const shared =
          typeof prop === "object" &&
          prop.type === "slot" &&
          !!prop.renderPropParams?.length;
        const label =
          typeof prop === "object" && "displayName" in prop
            ? prop.displayName
            : undefined;
        return {
          node,
          elementUuid: owner.uuid,
          label: label || node.slotParam.variable.name,
          repeated: false,
          slotName: node.slotParam.variable.name,
          scope: shared ? ("shared-template" as const) : ("slot" as const),
        };
      }
      return {
        node,
        elementUuid: node.uuid,
        label: ("name" in node && node.name) || summarizeTpl(node),
        repeated: !!viewCtx.effectiveCurrentVariantSetting(node).dataRep,
        slotName: null,
        scope:
          isKnownTplComponent(node) && !node.component.codeComponentMeta
            ? ("component-instance" as const)
            : ("element" as const),
      };
    });
}
