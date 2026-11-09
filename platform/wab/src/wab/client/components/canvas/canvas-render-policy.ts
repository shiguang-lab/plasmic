import type { RenderingCtx } from "@/wab/client/components/canvas/canvas-rendering";
import type { StudioRenderPolicySnapshot } from "@/wab/client/studio-ctx/studio-render-policy";
import { isCodeComponent } from "@/wab/shared/core/components";
import { isTplTextBlock } from "@/wab/shared/core/tpls";
import { TplNode, isKnownTplComponent, isKnownTplSlot, isKnownTplTag } from "@/wab/shared/model/classes";
import { canAddChildren } from "@/wab/shared/parenting";

/** Decisions consumed by this node kind. Unused policy fields are absent. */
export interface CanvasNodePolicy {
  readonly interactive: boolean;
  readonly autoOpen: boolean;
  readonly editable: boolean | undefined;
  readonly slotPlaceholder: boolean | undefined;
  readonly containerPlaceholder: boolean | undefined;
  readonly fullContentView: boolean | undefined;
}

export function canvasNodePolicy(node: TplNode, ctx: RenderingCtx, policy: StudioRenderPolicySnapshot): CanvasNodePolicy {
  const component = isKnownTplComponent(node) && isCodeComponent(node.component);
  const slot = isKnownTplSlot(node);
  const emptyContainer = isKnownTplTag(node) && node.children.length === 0 && canAddChildren(node);
  const selection = ctx.viewCtx.canvasRenderOwner.selectionInput(ctx.viewCtx, node, ctx.valKey).getState();
  return {
    interactive: policy.interactive,
    autoOpen: selection.isSelected && policy.autoOpen && !ctx.viewCtx.canvasCtx.frameInfo(ctx.viewCtx).getState().exporting,
    editable: isTplTextBlock(node) ? policy.devMode : undefined,
    slotPlaceholder: component || slot ? policy.showSlotPlaceholder : undefined,
    containerPlaceholder: emptyContainer || slot ? policy.showContainerPlaceholder : undefined,
    fullContentView: component ? ctx.viewCtx.canvasCtx.frameInfo(ctx.viewCtx).getState().fullPageHeight : undefined,
  };
}
