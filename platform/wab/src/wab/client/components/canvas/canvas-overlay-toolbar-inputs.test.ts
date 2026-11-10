import { ViewSelection } from "@/wab/client/studio-ctx/view-selection";
import { ViewVariantState } from "@/wab/client/studio-ctx/view-variant-state";
import { createStore } from "zustand/vanilla";
import { CanvasOverlayToolbarInputs } from "@/wab/client/components/canvas/canvas-overlay-toolbar-inputs";
import { CanvasRegistrations } from "@/wab/client/components/canvas/canvas-registrations";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame } from "@/wab/shared/Arenas";
import { RootComponentVariantFrame } from "@/wab/shared/component-frame";
import { mkCodeComponent, CodeComponentsRegistry } from "@/wab/shared/code-components/code-components";
import { mkBaseVariant } from "@/wab/shared/Variants";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { mkTplComponent, mkTplTagX } from "@/wab/shared/core/tpls";
import { createSite } from "@/wab/shared/core/sites";
import { CustomCode } from "@/wab/shared/model/classes";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { mock } from "vitest-mock-extended";

it("tracks event analysis expressions and registration contracts, not unrelated project labels", () => {
  const base = mkBaseVariant();
  const button = mkTplTagX("button", { baseVariant: base, attrs: {} });
  const handler = new CustomCode({ code: "() => { $state.open = true; }", fallback: null });
  button.vsettings[0].attrs.onClick = handler;
  const code = mkCodeComponent("Overlay", { name: "Overlay", importPath: "test", props: {} }, {});
  const overlay = mkTplComponent(code, base);
  const component = mkComponent({ name: "Owner", type: ComponentType.Plain, variants: [base], tplTree: mkTplTagX("div", { baseVariant: base }, [button, overlay]) });
  const unrelated = mkComponent({ name: "Other", type: ComponentType.Plain, tplTree: mkTplTagX("div") });
  const site = createSite(); site.components.push(component, code, unrelated);
  const frame = mkArenaFrame({ site, component, name: "Owner", width: 100, height: 100 });
  const models = new ModelSnapshots(), signal = new AbortController();
  const studio = mock<StudioCtx>();
  Object.defineProperties(studio, { modelSnapshots: { value: models }, site: { value: site } });
  const registrations = new CanvasRegistrations(), registry = mock<CodeComponentsRegistry>();
  registry.getRegisteredComponentsAndContextsMap.mockReturnValue(new Map());
  registry.getRegisteredFunctionsMap.mockReturnValue(new Map());
  registry.getRegisteredLibrariesMap.mockReturnValue(new Map());
  registrations.install(registry);
  const view = mock<ViewCtx>();
  const selection = new ViewSelection(() => models);
  const variants = new ViewVariantState(() => models, () => frame, () => site, () => false, () => false);
  Object.defineProperties(view, {
    selectionStore: {value: selection.store}, variantStore: {value: variants.store},
    csEvaluator: {value: {renderStatusStore: createStore(() => ({renderCount: 0, isFirstRenderComplete: false}))}},
  });
  Object.defineProperties(view, { studioCtx: { value: studio }, canvasCtx: { value: { registrations } } });
  view.currentComponent.mockReturnValue(component);
  view.componentStackFrames.mockReturnValue([new RootComponentVariantFrame(frame)]);
  view.focusedTplAncestorsThroughComponents.mockReturnValue([{ node: button, layer: 0 }]);
  const recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil });
  const source = new CanvasOverlayToolbarInputs({ view, models, site, signal: signal.signal });
  const publish = vi.fn(), stop = source.subscribe(publish); publish.mockClear();
  const commit = (command: () => void) => models.sync(recorder.withRecording(command).changes);
  try {
    const initial = source.getSnapshot();
    commit(() => { unrelated.name = "Not used by this toolbar"; });
    expect(source.getSnapshot()).toBe(initial);
    expect(publish).not.toHaveBeenCalled();
    commit(() => { handler.code = "() => { $state.open = false; }"; });
    expect(publish).toHaveBeenCalledOnce(); publish.mockClear();
    registry.getRegisteredComponentsAndContextsMap.mockReturnValue(new Map([["Overlay", { impl: () => null, meta: { name: "Overlay", importPath: "test", props: {}, canvasOverlay: { triggerSlot: "children" } } }]]));
    registrations.refresh();
    expect(publish).toHaveBeenCalledOnce(); publish.mockClear();
    stop();
    commit(() => { handler.code = "() => { $state.open = true; }"; });
    expect(publish).not.toHaveBeenCalled();
  } finally { stop(); signal.abort(); registrations.dispose(); selection.dispose(); variants.dispose(); models.dispose(); recorder.dispose(); }
});

it("keeps selection work on the ancestor path and releases the previous component's inputs", () => {
  const base = mkBaseVariant();
  const nodes = Array.from({ length: 1000 }, () => mkTplTagX("button", { baseVariant: base, attrs: { onClick: new CustomCode({ code: "() => 0", fallback: null }) } }));
  const first = mkComponent({ name: "First", type: ComponentType.Plain, variants: [base], tplTree: mkTplTagX("div", { baseVariant: base }, nodes) });
  const secondBase = mkBaseVariant();
  const nextHandler = new CustomCode({ code: "() => 0", fallback: null });
  const nextNode = mkTplTagX("button", { baseVariant: secondBase, attrs: { onClick: nextHandler } });
  const second = mkComponent({ name: "Second", type: ComponentType.Plain, variants: [secondBase], tplTree: nextNode });
  const site = createSite(); site.components.push(first, second);
  const models = new ModelSnapshots(), lifetime = new AbortController();
  const studio = { modelSnapshots: models, site } as unknown as StudioCtx;
  const selection = new ViewSelection(() => models), view = mock<ViewCtx>();
  Object.defineProperties(view, {
    studioCtx: { value: studio }, selectionStore: { value: selection.store },
    variantStore: { value: createStore(() => ({})) }, csEvaluator: { value: { renderStatusStore: createStore(() => ({})) } },
  });
  view.currentComponent.mockReturnValue(first); view.componentStackFrames.mockReturnValue([]);
  view.focusedTplAncestorsThroughComponents.mockReturnValue([{ node: nodes[0], layer: 0 }]);
  const recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil });
  const source = new CanvasOverlayToolbarInputs({ view, models, site, signal: lifetime.signal });
  const publish = vi.fn(), stop = source.subscribe(publish);
  const original = models.declaredField.bind(models);
  let reads = 0;
  models.declaredField = (model, key) => { reads++; return original(model, key); };
  const commit = (run: () => void) => models.sync(recorder.withRecording(run).changes);
  try {
    const before = source.getSnapshot();
    view.focusedTplAncestorsThroughComponents.mockReturnValue([{ node: nodes[1], layer: 0 }]);
    selection.setTpls([nodes[1]]);
    expect(source.getSnapshot()).not.toBe(before);
    expect(reads).toBeLessThan(80);
    expect(publish).toHaveBeenCalledOnce();
    view.currentComponent.mockReturnValue(second);
    view.focusedTplAncestorsThroughComponents.mockReturnValue([{ node: nextNode, layer: 0 }]);
    selection.setTpls([nextNode]); publish.mockClear();
    commit(() => { nodes[0].vsettings[0].attrs.onClick = new CustomCode({ code: "() => 1", fallback: null }); });
    expect(publish).not.toHaveBeenCalled();
    commit(() => { nextHandler.code = "() => 2"; });
    expect(publish).toHaveBeenCalledOnce();
  } finally { stop(); lifetime.abort(); selection.dispose(); models.dispose(); recorder.dispose(); }
});
