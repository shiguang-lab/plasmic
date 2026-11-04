import { getCanvasElementVisibility, revealCanvasElement } from "@/wab/client/components/canvas/canvas-scroll";
import { getVisibleFrameRect } from "@/wab/client/components/canvas/HoverBox/visible-bounds";
import { frameToClientRect } from "@/wab/client/coords";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ensureOk } from "@/wab/commons/neverthrow-utils";
import { getArenaFrames } from "@/wab/shared/Arenas";
import { assert, withTimeout } from "@/wab/shared/common";
import type { ToolPresentation } from "@/wab/shared/copilot/presentation";
import { isValNode } from "@/wab/shared/core/val-nodes";
import { Box } from "@/wab/shared/geom";
import type { Component, TplNode } from "@/wab/shared/model/classes";
import { ok } from "neverthrow";

/** Use Studio selection/session reveals, never authored click handlers or saved props. */
export async function presentToolTarget(studio: StudioCtx, component: Component, tpl: TplNode, signal?: AbortSignal): Promise<ToolPresentation> {
  const identity = { componentUuid: component.uuid, elementUuid: tpl.uuid };
  if (studio.isLiveMode) {
    return { ...identity, visible: false, reason: "preview-active", message: "Model operation completed. Close native Preview to show its target in the editing canvas." };
  }
  if (!studio.initialViewportReady) {
    return { ...identity, visible: false, reason: "canvas-unavailable", message: "The target exists in the model, but the editor canvas is not ready. Wait for rendering before visual inspection; do not recreate it." };
  }
  try {
    signal?.throwIfAborted();
    if (studio.isInteractiveMode) {
      await studio.changeUnsafe(() => { studio.isInteractiveMode = false; });
      assert(!studio.isInteractiveMode, "Canvas interaction did not close before target selection");
    }
    const frames = getArenaFrames(studio.currentArena);
    const candidates = studio.viewCtxs.filter(vc => !vc.isDisposed && frames.includes(vc.arenaFrame()) &&
      (vc.component === component || vc.currentComponent() === component));
    const focused = studio.focusedViewCtx();
    if (candidates.length > 1 && (!focused || !candidates.includes(focused))) {
      return { ...identity, visible: false, reason: "ambiguous-artboard", message: "Several artboards contain the target. Use selectElement with frameUuid before retrying the targeted operation." };
    }
    const vc = candidates.find(view => view === focused) ?? candidates[0] ??
      await withTimeout(studio.getViewCtxForComponent(component), "Timed out locating the target canvas", 10000);
    signal?.throwIfAborted();
    const target = { ...identity, frameUuid: vc.arenaFrame().uuid };
    if (vc.renderState.tpl2fullKeys(tpl).length > 1 && vc.focusedTpl() !== tpl) {
      return { ...target, visible: false, reason: "ambiguous-instance", message: "The target has repeated instances. Use selectElement with instanceIndex to choose the instance to show." };
    }
    ensureOk(await studio.change(() => ok(vc.setStudioFocusByTpl(tpl)), { noUndoRecord: true, noErrorNotification: true }));
    await withTimeout(vc.awaitSync(), "Timed out revealing the selected target", 10000);
    signal?.throwIfAborted();
    const keys = vc.renderState.tpl2fullKeys(tpl);
    const selected = vc.focusedSelectable();
    const val = isValNode(selected) && selected.tpl === tpl ? selected : keys.length === 1 ? vc.renderState.fullKey2val(keys[0]) : undefined;
    const node = val ? vc.renderState.val2dom(val, vc.canvasCtx)?.find(dom => dom.isConnected) : undefined;
    if (!node) {
      return { ...target, visible: false, reason: "not-rendered", message: "The model target was selected, but it has no connected rendered instance. Inspect its condition, data/repetition and registered reveal contract; do not infer that it was never created." };
    }
    revealCanvasElement(node);
    const visibility = getCanvasElementVisibility(node);
    if (visibility.visible && studio.viewportCtx) {
      const bounds = Box.fromRect(frameToClientRect(getVisibleFrameRect(node).rect(), vc));
      if (!studio.viewportCtx.clipperBox().containsBox(bounds)) {
        studio.tryZoomToFitDomElement(node);
      }
    }
    const messages = {
      visible: "The target is selected and visible through Studio's temporary reveal and scrolling contracts.",
      "scroll-clipped": "Nested scrolling was applied; the target remains partially clipped by a scroll viewport. Inspect its layout or scroll further; do not toggle business state.",
      "layout-clipped": "The selected target is clipped by non-scrollable overflow/sizing. Inspect the clipping ancestor; interaction is not a scroll fix.",
      "outside-viewport": "The target lies outside its artboard viewport. Inspect the artboard position/size; it is not evidence of an inactive Tab or closed overlay.",
      hidden: "Selection reveal did not expose the target. Inspect the owning condition/styles and reveal contract; use setInteractiveMode and the actual trigger only when a display-state transition is confirmed, then disable before editing.",
      "no-layout": "The selected model target has no layout box. Check render readiness, conditions and registered reveal support before choosing an interaction.",
      "not-rendered": "The selected target is no longer connected; reread the model and wait for rendering before visual inspection.",
    };
    return { ...target, ...visibility, message: messages[visibility.reason] };
  } catch (error) {
    return { ...identity, visible: false, reason: "presentation-failed", message: `Model operation completed, but automatic presentation failed: ${error instanceof Error ? error.message : String(error)}. Do not repeat a successful mutation; inspect the current context and retry only presentation.` };
  }
}
