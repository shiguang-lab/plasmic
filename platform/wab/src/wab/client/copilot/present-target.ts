import { getCanvasElementVisibility, revealCanvasElement } from "@/wab/client/components/canvas/canvas-scroll";
import { getVisibleFrameRect } from "@/wab/client/components/canvas/HoverBox/visible-bounds";
import { frameToClientRect } from "@/wab/client/coords";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ensureOk } from "@/wab/commons/neverthrow-utils";
import { getArenaFrames } from "@/wab/shared/Arenas";
import { assert, withTimeout } from "@/wab/shared/common";
import { flattenTpls } from "@/wab/shared/core/tpls";
import type { ToolPresentation } from "@/wab/shared/copilot/presentation";
import { isValNode } from "@/wab/shared/core/val-nodes";
import { Box } from "@/wab/shared/geom";
import type { Component, TplNode } from "@/wab/shared/model/classes";
import { ok } from "neverthrow";

const pendingPresentations = new WeakMap<StudioCtx, AbortController>();

/** Presentation is optional UI work, never a prerequisite for a model operation. */
export function requestToolTarget(studio: StudioCtx, component: Component, tpl: TplNode, signal?: AbortSignal): ToolPresentation {
  pendingPresentations.get(studio)?.abort();
  const controller = new AbortController();
  pendingPresentations.set(studio, controller);
  const presentationSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
  void withTimeout(presentToolTarget(studio, component, tpl, presentationSignal), "Automatic presentation expired", 10000)
    .catch(() => undefined)
    .finally(() => {
      controller.abort();
      if (pendingPresentations.get(studio) === controller) pendingPresentations.delete(studio);
    });
  return { componentUuid: component.uuid, elementUuid: tpl.uuid, visible: null, reason: "pending",
    message: "Automatic target presentation was requested in the background. Model execution does not wait for it; this is not a visibility verdict or a reason to retry the model operation." };
}

/** Use Studio selection/session reveals while preserving the current canvas mode. */
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
    const frames = getArenaFrames(studio.currentArena);
    const candidates = studio.viewCtxs.filter(vc => !vc.isDisposed && frames.includes(vc.arenaFrame()) &&
      (vc.component === component || vc.currentComponent() === component));
    const focused = studio.focusedViewCtx();
    if (candidates.length > 1 && (!focused || !candidates.includes(focused))) {
      return { ...identity, visible: false, reason: "ambiguous-artboard", message: "Several artboards contain the target. Use selectElement with frameUuid before retrying the targeted operation." };
    }
    const vc = candidates.find(view => view === focused) ?? candidates[0] ??
      await withTimeout(studio.getViewCtxForComponent(component, undefined, { signal }), "Timed out locating the target canvas", 10000);
    signal?.throwIfAborted();
    const target = { ...identity, frameUuid: vc.arenaFrame().uuid };
    if (vc.renderState.tpl2fullKeys(tpl).length > 1 && vc.focusedTpl() !== tpl) {
      return { ...target, visible: false, reason: "ambiguous-instance", message: "The target has repeated instances. Use selectElement with instanceIndex to choose the instance to show." };
    }
    ensureOk(await studio.change(() => {
      signal?.throwIfAborted();
      assert(!vc.isDisposed && !studio.isLiveMode && studio.site.components.includes(component) && flattenTpls(component.tplTree).includes(tpl), "Presentation target is no longer available");
      return ok(vc.setStudioFocusByTpl(tpl));
    }, { noUndoRecord: true, noErrorNotification: true }));
    signal?.throwIfAborted();
    await withTimeout(vc.awaitSync(), "Timed out revealing the selected target", 10000);
    signal?.throwIfAborted();
    assert(!vc.isDisposed && !studio.isLiveMode && studio.site.components.includes(component) && flattenTpls(component.tplTree).includes(tpl), "Presentation target is no longer available");
    const keys = vc.renderState.tpl2fullKeys(tpl);
    const selected = vc.focusedSelectable();
    const val = isValNode(selected) && selected.tpl === tpl ? selected : keys.length === 1 ? vc.renderState.fullKey2val(keys[0]) : undefined;
    const node = val ? vc.renderState.val2dom(val, vc.canvasCtx)?.find(dom => dom.isConnected) : undefined;
    if (!node) {
      return { ...target, visible: false, reason: "not-rendered", message: "The model target has no connected rendered instance. Inspect its condition, data/repetition and current canvas state; do not infer that it was never created." };
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
      visible: "The target is selected and visible through Studio's temporary reveal and scrolling contracts, preserving the current canvas mode.",
      "scroll-clipped": "Nested scrolling was applied; the target remains partially clipped by a scroll viewport. Inspect its layout or scroll further; do not toggle business state.",
      "layout-clipped": "The selected target is clipped by non-scrollable overflow/sizing. Inspect the clipping ancestor; interaction is not a scroll fix.",
      "outside-viewport": "The target lies outside its artboard viewport. Inspect the artboard position/size; it is not evidence of an inactive Tab or closed overlay.",
      hidden: "The target is hidden in the current canvas state. Inspect the owning condition/styles and reveal contract; use the actual trigger when a display-state transition is confirmed. Model edits can remain in interactive mode.",
      "no-layout": "The selected model target has no layout box. Check render readiness, conditions and registered reveal support before choosing an interaction.",
      "not-rendered": "The selected target is no longer connected; reread the model and wait for rendering before visual inspection.",
    };
    return { ...target, ...visibility, message: messages[visibility.reason] };
  } catch (error) {
    return { ...identity, visible: false, reason: "presentation-failed", message: `Model operation completed, but automatic presentation failed: ${error instanceof Error ? error.message : String(error)}. Do not repeat a successful mutation; inspect the current context and retry only presentation.` };
  }
}
