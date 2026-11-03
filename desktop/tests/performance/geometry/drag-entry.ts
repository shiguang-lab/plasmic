// Real drag construction and targeting against the saved-project DOM. Offline only.
import { DragMoveManager } from "@/wab/client/Dnd";
import { getSelectableLayers } from "@/wab/client/components/canvas/marquee-selection";
import { ValComponent, ValTag } from "@/wab/shared/core/val-nodes";
import { Box, Pt } from "@/wab/shared/geom";
import { assertSiteInvariants } from "@/wab/shared/site-invariants";

const raf = () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
Object.assign((window as any).__geometry, {
  async dragQueries(mode: "baseline" | "cached-js") {
    try {
    const editor = (window as any).studioCtx;
    const vc = editor.focusedViewCtx();
    const serialize = () => JSON.stringify(editor.bundler().bundle(editor.site, editor.siteInfo.id, editor.appCtx.lastBundleVersion));
    const before = serialize();
    const frame = vc.canvasCtx.viewport().getBoundingClientRect();
    const query = new Box(frame.top + 25, frame.left - 12, Math.min(frame.width * .7, 550) + 12, Math.min(frame.height * .65, 340));
    const available = getSelectableLayers(vc, query).filter((value) => value instanceof ValTag || value instanceof ValComponent);
    if (available.length < 6) throw Error("Drag fixture needs six independent selectable objects");
    const Manager = mode === "baseline" ? (window as any).__dragBaseline : DragMoveManager;
    const results = [];
    for (const count of [1, 3, 6]) {
      // Isolate construction from property-panel selection/ResizeObserver work.
      // Supply the same ghost elements the editor creates for the selection.
      const objects = available.slice(0, count);
      const ghosts = objects.map((_, i) => {
        const element = document.createElement("div");
        element.className = `dnd__drag-ghost dnd__drag-ghost-${i}`;
        document.body.append(element);
        return element;
      });
      await raf();
      const samples = [], targets = [];
      for (let i = 0; i < 8; i++) {
        (window as any).__geometryStage = `drag-construct-${count}-${i}`;
        const at = performance.now();
        const manager = new Manager(vc, objects, new Pt(frame.left + 100, frame.top + 100));
        const ms = performance.now() - at;
        if (manager.aborted()) throw Error("Fixture drag was aborted");
        const targeter = Reflect.get(manager, "targeter");
        const boxes = Reflect.get(targeter, "boxes");
        const probes = {
          nodes: boxes.nodeBoxes.map((box: any) => ({
            node: box.selectable.fullKey, box: box.box.rect(), padding: box.paddingBox.rect(),
            scaler: box.boxInScaler.rect(), flow: box.flowDir, container: box.containerType,
            children: box.acceptsChildren === true ? true : box.acceptsChildren.type,
            neighbors: box.acceptsNeighbors, flex: box.isInFlex, reverse: box.isInFlexReverse,
          })),
          insertions: boxes.insertionBoxes.map((box: any) => ({
            node: box.valNode.fullKey, box: box.box.rect(), loc: box.loc, flow: box.flowDir,
          })),
          offset: Reflect.get(targeter, "cursorOffset"),
          frame: boxes.frameRect,
        };
        manager.endDrag(true);
        (window as any).__geometryStage = `drag-settle-${count}-${i}`;
        await editor.awaitEval(); await raf();
        if (i >= 2) { samples.push(ms); targets.push(probes); }
      }
      if (serialize() !== before) throw Error("Drag construction/cancellation changed the saved model");
      ghosts.forEach((ghost) => ghost.remove());
      results.push({count, samples, targets});
    }
    assertSiteInvariants(editor.site);
    return {scope: "Real drag construction, complete target geometry and cancellation; no pointer-move/commit latency claim", results, modelUnchanged: true};
    } catch (error) {
      throw new Error(`${(window as any).__geometryStage}: ${String(error)}`);
    }
  },
});
