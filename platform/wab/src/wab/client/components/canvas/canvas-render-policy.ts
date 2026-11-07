import type { RenderingCtx } from "@/wab/client/components/canvas/canvas-rendering";
import type { SubDeps } from "@/wab/client/components/canvas/subdeps";
import type { StudioRenderPolicySnapshot } from "@/wab/client/studio-ctx/studio-render-policy";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
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
    autoOpen: selection.isSelected && policy.autoOpen && !policy.interactive && !ctx.viewCtx.canvasCtx.frameInfo(ctx.viewCtx).getState().exporting,
    editable: isTplTextBlock(node) ? policy.devMode : undefined,
    slotPlaceholder: component || slot ? policy.showSlotPlaceholder : undefined,
    containerPlaceholder: emptyContainer || slot ? policy.showContainerPlaceholder : undefined,
    fullContentView: component ? ctx.viewCtx.canvasCtx.frameInfo(ctx.viewCtx).getState().fullPageHeight : undefined,
  };
}

/** Use the iframe's React instance and subscribe to a single scalar decision. */
export function useCanvasRenderPolicy<Key extends keyof StudioRenderPolicySnapshot>(sub: SubDeps, view: ViewCtx, key: Key): StudioRenderPolicySnapshot[Key] {
  const store = view.studioCtx.renderPolicy.store;
  return sub.React.useSyncExternalStore(store.subscribe, () => store.getState()[key], () => store.getInitialState()[key]);
}
