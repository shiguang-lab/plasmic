import { ensureBaseVariantSetting } from "@/wab/shared/VariantTplMgr";
import { mkBaseVariant } from "@/wab/shared/Variants";
import { CanvasViewInputs } from "@/wab/client/components/canvas/canvas-view-inputs";
import { hoverBoxModelFields } from "@/wab/client/components/canvas/HoverBox/hover-box-inputs";
import { computeHoverBoxTargets } from "@/wab/client/components/canvas/HoverBox/computeHoverBoxViewStates";
import type { CanvasCtx } from "@/wab/client/components/canvas/canvas-ctx";
import { ViewSelection } from "@/wab/client/studio-ctx/view-selection";
import $ from "jquery";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { createSite } from "@/wab/shared/core/sites";
import { ValTag } from "@/wab/shared/core/val-nodes";
import { mkTplInlinedText, mkTplTagX } from "@/wab/shared/core/tpls";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { mock } from "vitest-mock-extended";

it("keeps hover labels, ancestor lock/layout and frame inputs finite and seals retired runtime reads", () => {
  const base = mkBaseVariant();
  const target = mkTplTagX("div", { baseVariant: base }), sibling = mkTplTagX("div", { baseVariant: base });
  const root = mkTplTagX("div", { baseVariant: base }, [target, sibling]);
  const component = mkComponent({ name: "Hover", type: ComponentType.Plain, variants: [base], tplTree: root });
  [root, target, sibling].forEach((node) => ensureBaseVariantSetting(component, node));
  const site = createSite(); site.components.push(component);
  const frame = mkArenaFrame({ site, component, name: "Hover", width: 800, height: 600 });
  site.arenas.push(mkMixedArena("Hover", [frame]));
  const models = new ModelSnapshots(), next = new ModelSnapshots(), lifetime = new AbortController();
  const studio = mock<StudioCtx>(); Object.defineProperty(studio, "modelSnapshots", { value: models, writable: true });
  const view = mock<ViewCtx>(); Object.defineProperties(view, { studioCtx: { value: studio }, site: { value: site } });
  view.currentComponent.mockReturnValue(component); view.arenaFrame.mockReturnValue(frame);
  const selected = mock<ValTag>(); Object.defineProperty(selected, "tpl", { value: target });
  const runtime = mock<ReturnType<ViewCtx["valState"]>>(); view.valState.mockReturnValue(runtime);
  const recipe = vi.fn((field: Parameters<typeof hoverBoxModelFields>[2]) => {
    hoverBoxModelFields(view, frame, field); hoverBoxModelFields(view, { node: null, focusObj: selected }, field);
  });
  const source = new CanvasViewInputs({ studio, models, signal: lifetime.signal }, recipe);
  const recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil });
  const notify = vi.fn(), stop = source.subscribe(notify); notify.mockClear();
  try {
    models.sync(recorder.withRecording(() => { frame.name = "Renamed"; frame.width = 390; }).changes);
    expect(notify).toHaveBeenCalled(); notify.mockClear();
    models.sync(recorder.withRecording(() => { sibling.name = "Unrelated"; }).changes);
    expect(notify).not.toHaveBeenCalled();
    models.sync(recorder.withRecording(() => { root.locked = true; }).changes);
    expect(notify).toHaveBeenCalledOnce(); notify.mockClear();
    models.sync(recorder.withRecording(() => { root.vsettings[0].rs.values.display = "flex"; }).changes);
    expect(notify).toHaveBeenCalledOnce();
    Object.defineProperty(studio, "modelSnapshots", { value: next }); recipe.mockClear(); view.valState.mockClear();
    expect(source.getSnapshot().alive).toBe(false);
    expect(recipe).not.toHaveBeenCalled(); expect(view.valState).not.toHaveBeenCalled();
  } finally { stop(); lifetime.abort(); models.dispose(); next.dispose(); recorder.dispose(); }
});


it.each(["text", "stack"] as const)("waits for an inserted %s runtime value before collecting hover fields", (kind) => {
  const base = mkBaseVariant();
  const root = mkTplTagX("div", { baseVariant: base });
  const inserted = kind === "text" ? mkTplInlinedText("Text", [base]) : mkTplTagX("div", { baseVariant: base });
  const component = mkComponent({ name: "Inserted selection", type: ComponentType.Plain, variants: [base], tplTree: root });
  const site = createSite(); site.components.push(component);
  const frame = mkArenaFrame({ site, component, name: "Page", width: 800, height: 600 });
  site.arenas.push(mkMixedArena("Overview", [frame]));
  const models = new ModelSnapshots(), lifetime = new AbortController(), selection = new ViewSelection(() => models);
  const studio = mock<StudioCtx>(), view = mock<ViewCtx>(), canvas = mock<CanvasCtx>();
  Object.defineProperties(studio, { modelSnapshots: { value: models }, canvasContentEditor: { value: undefined } });
  Object.defineProperties(view, { studioCtx: { value: studio }, site: { value: site }, canvasCtx: { value: canvas }, selection: { value: selection }, isDisposed: { value: false } });
  view.getViewOps.mockReturnValue({ isRootNodeOfStretchFrame: () => false } as any);
  view.currentComponent.mockReturnValue(component); view.arenaFrame.mockReturnValue(frame);
  canvas.$viewport.mockReturnValue($(document.createElement("iframe")));
  const recipe = (field: Parameters<typeof hoverBoxModelFields>[2]) => {
    computeHoverBoxTargets(studio, { view, frames: [] }, selection.store.getState()).forEach((target) => hoverBoxModelFields(view, target, field));
  };
  let source = new CanvasViewInputs({ studio, models, signal: lifetime.signal }, recipe);
  const recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil });
  const notify = vi.fn(); let stop: (() => void) | undefined;
  try {
    recorder.withRecording(() => { root.children.push(inserted); inserted.parent = root; });
    selection.transaction(() => { selection.setTpls([inserted]); selection.setTargets([null]); selection.setDoms([null]); });
    expect(computeHoverBoxTargets(studio, { view, frames: [] }, selection.store.getState())).toEqual([]);
    stop = source.subscribe(notify);
    expect(source.getSnapshot().alive).toBe(true);

    const value = new ValTag({ tpl: inserted, children: [], className: "", key: "inserted", fullKey: "inserted[0]", frameUid: frame.uid, fibers: [], parent: undefined, valOwner: undefined, slotInfo: undefined });
    const element = document.createElement(kind === "text" ? "span" : "div");
    selection.transaction(() => { selection.setTargets([value]); selection.setDoms([$(element)]); });
    expect(computeHoverBoxTargets(studio, { view, frames: [] }, selection.store.getState())).toEqual([{ node: selection.doms()[0], focusObj: value }]);
    // HoverBox recreates its field recipe when the native runtime target changes.
    // Reproduce that subscription switch rather than expecting a model-only
    // source to observe an undeclared external selection store.
    stop?.();
    source = new CanvasViewInputs({ studio, models, signal: lifetime.signal }, recipe);
    stop = source.subscribe(notify);
    source.getSnapshot(); notify.mockClear();
    models.sync(recorder.withRecording(() => { inserted.name = "Resolved selection"; }).changes);
    expect(notify).toHaveBeenCalledOnce();
    expect(source.getSnapshot().fields).toContain("Resolved selection");

    // Pending values retain their original index in the parallel DOM list.
    selection.transaction(() => { selection.setTpls([root, inserted]); selection.setTargets([null, value]); selection.setDoms([null, $(element)]); });
    expect(computeHoverBoxTargets(studio, { view, frames: [] }, selection.store.getState())).toEqual([{ node: selection.doms()[1], focusObj: value }]);

    selection.transaction(() => { selection.setTpls([inserted]); selection.setTargets([null]); selection.setDoms([null]); });
    stop?.();
    source = new CanvasViewInputs({ studio, models, signal: lifetime.signal }, recipe);
    stop = source.subscribe(notify);
    expect(source.getSnapshot().fields).toEqual([]); notify.mockClear();
    models.sync(recorder.withRecording(() => { inserted.name = "Pending again"; }).changes);
    expect(notify).not.toHaveBeenCalled();
  } finally { stop?.(); lifetime.abort(); selection.dispose(); models.dispose(); recorder.dispose(); }
});
