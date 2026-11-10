import { CanvasHostlessInputs } from "@/wab/client/components/canvas/canvas-hostless-inputs";
import { ReferenceInputs } from "@/wab/client/components/sidebar/find-reference-inputs";
import { SuperComponentVariantSource } from "@/wab/client/studio-ctx/variant-group-inputs";
import type { VariantsController } from "@/wab/client/components/variants/VariantsController";
import { DimTokenSpinner } from "@/wab/client/components/widgets/DimTokenSelector";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { ModelCommit, StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { TplMgr } from "@/wab/shared/TplMgr";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { mkVariant } from "@/wab/shared/Variants";
import { mkStyleToken } from "@/wab/commons/StyleToken";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { createSite } from "@/wab/shared/core/sites";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { createStore } from "zustand/vanilla";
import { act, render } from "@testing-library/react";
import { writeFileSync } from "fs";
import * as React from "react";

const results: unknown[] = [];
afterAll(() => {
  if (process.env.REMAINING_INPUTS_PERF_OUTPUT) { writeFileSync(process.env.REMAINING_INPUTS_PERF_OUTPUT, JSON.stringify(results, null, 2)); }
});
function fixture() {
  const site = createSite(), models = new ModelSnapshots(), lifetime = new AbortController();
  const commits = new Set<(event: ModelCommit) => void>();
  const studio = {
    site, modelSnapshots: models, singleRsStyleInputs: { isDisposed: false }, currentArena: null,
    arenaState: { lifetime: () => lifetime.signal, store: createStore(() => ({ current: null, focusedMode: false })), viewRegistry: { store: createStore(() => []) } },
    selectionStore: createStore(() => ({ view: undefined, frames: [] })),
    uiEnvironment: { store: createStore(() => ({ canCreateTokens: true, canOverrideImportedTokens: true, canOverrideRegisteredTokens: true })) },
    subscribeModelChanges: (listener: (event: ModelCommit) => void) => { commits.add(listener); return () => { commits.delete(listener); }; },
  } as unknown as StudioCtx;
  let fields = 0, bindings = 0;
  const declared = models.declaredField.bind(models), prepared = models.subscribePreparedField.bind(models);
  models.declaredField = (model, key) => { fields++; return declared(model, key); };
  models.subscribePreparedField = (store, listener) => { bindings++; return prepared(store, listener); };
  const measure = (phase: string, run: () => void) => {
    fields = 0; bindings = 0;
    const start = performance.now(); run();
    return { phase, fields, bindings, ms: performance.now() - start };
  };
  return { site, models, studio, lifetime, commits, measure };
}

it.each([100, 1000])("bounds inherited variant work at %i variants", (count) => {
  const f = fixture(), manager = new TplMgr({ site: f.site });
  const component = manager.addComponent({ name: "Parent", type: ComponentType.Plain });
  const group = manager.createVariantGroup({ component, name: "Mode" });
  group.variants = Array.from({ length: count }, (_, i) => mkVariant({ name: `Variant${i}`, parent: group }));
  const recorder = new ChangeRecorder({ inst: f.site, _instUtil: instUtil });
  let pinReads = 0;
  const controller = { readSources: () => ({}), canChangeActiveVariants: () => true, canToggleTargeting: () => true, getSnapshot: (variants: Parameters<VariantsController["getSnapshot"]>[0]) => ({ activeVariants: [], targetedVariants: [], canChangeVariants: true, variants: variants.map(variant => { pinReads++; return { variant, pinState: undefined, active: undefined, targeted: false, canToggle: true }; }) }) } as unknown as VariantsController;
  const source = new SuperComponentVariantSource(f.studio, component, controller);
  let notices = 0;
  const stop = source.subscribe(() => { notices++; }); notices = 0; pinReads = 0;
  try {
    const rename = f.measure("batch rename all variants", () => f.models.sync(recorder.withRecording(() => group.variants.forEach((variant) => { variant.name += "X"; })).changes));
    results.push({ subject: "inherited variants", count, ...rename, pinReads, notices });
    expect(pinReads).toBe(count);
    expect(rename.fields).toBeLessThan(count * 10);
    expect(notices).toBe(0);
  } finally { stop(); f.lifetime.abort(); recorder.dispose(); f.models.dispose(); }
});

it.each([1, 6])("ignores unrelated commits for %i frames with 1000 nodes", (frameCount) => {
  const f = fixture();
  const root = mkTplTagX("div", {}, Array.from({ length: 1000 }, () => mkTplTagX("div")));
  const component = mkComponent({ name: "Owner", type: ComponentType.Plain, tplTree: root });
  const unrelated = mkComponent({ name: "Unrelated", type: ComponentType.Plain, tplTree: mkTplTagX("div") });
  f.site.components.push(component, unrelated);
  const frames = Array.from({ length: frameCount }, (_, i) => mkArenaFrame({ site: f.site, component, name: `Frame${i}`, width: 800, height: 600 }));
  f.site.arenas.push(mkMixedArena("Audit", frames));
  const recorder = new ChangeRecorder({ inst: f.site, _instUtil: instUtil });
  let walks = 0, notifications = 0;
  const original = instUtil.allInstFields;
  instUtil.allInstFields = (model) => { walks++; return original.call(instUtil, model); };
  const owners = frames.map((frame) => new CanvasHostlessInputs(f.studio, () => { notifications++; }, frame));
  try {
    const changes = recorder.withRecording(() => { unrelated.name += "X"; }).changes;
    f.models.sync(changes);
    walks = 0; notifications = 0;
    const commit = f.measure("unrelated component rename commit", () => f.commits.forEach((listener) => listener({ type: "commit", summary: { changes } } as ModelCommit)));
    results.push({ subject: "hostless reference graph", count: 1000, frameCount, ...commit, walks, notifications });
    expect(notifications).toBe(0);
    expect(walks).toBe(0);
    expect(commit.fields).toBe(0);
  } finally { owners.forEach((owner) => owner.dispose()); instUtil.allInstFields = original; f.lifetime.abort(); recorder.dispose(); f.models.dispose(); }
});

it.each([100, 1000])("bounds reference result work for %i components", (count) => {
  const f = fixture(), manager = new TplMgr({ site: f.site });
  const components = Array.from({ length: count }, (_, i) => manager.addComponent({ name: `Comp${i}`, type: ComponentType.Plain }));
  const recorder = new ChangeRecorder({ inst: f.site, _instUtil: instUtil });
  const source = new ReferenceInputs({ site: f.site, models: f.models, lifetime: f.lifetime.signal, isCurrent: () => !f.lifetime.signal.aborted }, { components, frames: [] }, false);
  let notices = 0;
  const stop = source.subscribe(() => { notices++; }); source.getSnapshot();
  try {
    const reads = f.measure("10 unchanged reads", () => { for (let i = 0; i < 10; i++) { source.getSnapshot(); } });
    const rename = f.measure("batch rename all reference results", () => f.models.sync(recorder.withRecording(() => components.forEach((component) => { component.name += "X"; })).changes));
    results.push({ subject: "find references", count, readings: [reads, rename], notices });
    expect(notices).toBe(1);
    expect(reads.fields).toBe(0);
    expect(rename.fields).toBeLessThan(count * 6);
  } finally { stop(); f.lifetime.abort(); recorder.dispose(); f.models.dispose(); }
});

it.each([[100, 1], [1000, 1], [1000, 8]])("keeps %i unused tokens disconnected across %i closed controls", (tokenCount, controlCount) => {
  const f = fixture();
  f.site.styleTokens.push(...Array.from({ length: tokenCount }, (_, i) => mkStyleToken({ name: `Space ${i}`, type: "Spacing", value: `${i + 1}px` })));
  const recorder = new ChangeRecorder({ inst: f.site, _instUtil: instUtil });
  const changed = vi.fn();
  let mounted: ReturnType<typeof render> | undefined;
  try {
    const mount = f.measure("mount closed real dimension controls", () => {
      mounted = render(<StudioCtxContext.Provider value={f.studio}>{Array.from({ length: controlCount }, (_, i) => <DimTokenSpinner key={i} studioCtx={f.studio} tokenType="Spacing" allowFunctions={false} value="10px" onChange={changed} allowedUnits={["px"]} />)}</StudioCtxContext.Provider>);
    });
    expect(mounted?.getAllByRole("textbox")).toHaveLength(controlCount);
    expect(document.querySelectorAll('[data-overlayscrollbars]')).toHaveLength(0);
    const update = f.measure("change 1 unused token while all menus stay closed", () => act(() => f.models.sync(recorder.withRecording(() => { f.site.styleTokens[0].value = "9876px"; }).changes)));
    results.push({ subject: "closed dimension token controls", tokenCount, controlCount, readings: [mount, update] });
    expect(mount.fields).toBe(0);
    expect(mount.bindings).toBe(0);
    expect(update.fields).toBe(0);
    expect(changed).not.toHaveBeenCalled();
  } finally { mounted?.unmount(); f.lifetime.abort(); recorder.dispose(); f.models.dispose(); }
});
