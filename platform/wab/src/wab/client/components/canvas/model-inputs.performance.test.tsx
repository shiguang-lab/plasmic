import { CanvasOverlayToolbarInputs } from "@/wab/client/components/canvas/canvas-overlay-toolbar-inputs";
import { NavigationCatalogInputs } from "@/wab/client/components/sidebar-tabs/ProjectPanel/navigation-catalog-inputs";
import { ComponentLibraryInputs } from "@/wab/client/components/sidebar/library-inputs";
import { usePropExpressionInputs } from "@/wab/client/components/sidebar-tabs/ComponentProps/prop-expression-inputs";
import { useDataPickerSourceInputs } from "@/wab/client/components/sidebar-tabs/DataBinding/data-picker-source-inputs";
import { useInsertPanelCatalogInputs } from "@/wab/client/components/insert-panel/insert-panel-inputs";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { TplMgr } from "@/wab/shared/TplMgr";
import { mkBaseVariant } from "@/wab/shared/Variants";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import { mkParam } from "@/wab/shared/core/lang";
import { typeFactory } from "@/wab/shared/model/model-util";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { createSite } from "@/wab/shared/core/sites";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { ComponentDataQuery, CustomCode, ProjectDependency } from "@/wab/shared/model/classes";
import { act, render, renderHook } from "@testing-library/react";
import { createStore } from "zustand/vanilla";
import { writeFileSync } from "fs";
import * as React from "react";

const results: unknown[] = [];
afterAll(() => {
  if (process.env.MODEL_INPUTS_PERF_OUTPUT) { writeFileSync(process.env.MODEL_INPUTS_PERF_OUTPUT, JSON.stringify(results, null, 2)); }
});
function fixture() {
  const site = createSite(), models = new ModelSnapshots(), lifetime = new AbortController();
  const studio = { site, modelSnapshots: models, arenaState: { lifetime: () => lifetime.signal } } as unknown as StudioCtx;
  let fields = 0;
  const original = models.declaredField.bind(models);
  models.declaredField = (model, key) => { fields++; return original(model, key); };
  const measure = (phase: string, run: () => void) => {
    fields = 0;
    const start = performance.now(); run();
    return { phase, fields, ms: performance.now() - start };
  };
  return { site, models, lifetime, studio, measure };
}

it.each([100, 1000])("bounds toolbar work for a completed command at %i nodes", (count) => {
  const f = fixture(), base = mkBaseVariant();
  const handlers = Array.from({ length: count }, () => new CustomCode({ code: "() => 0", fallback: null }));
  const nodes = handlers.map((handler) => mkTplTagX("button", { baseVariant: base, attrs: { onClick: handler } }));
  const component = mkComponent({ name: "Owner", type: ComponentType.Plain, variants: [base], tplTree: mkTplTagX("div", { baseVariant: base }, nodes) });
  f.site.components.push(component);
  const selection = createStore(() => ({ revision: 0 }));
  const view = {
    studioCtx: f.studio, selectionStore: selection, variantStore: createStore(() => ({})),
    csEvaluator: { renderStatusStore: createStore(() => ({})) },
    currentComponent: () => component, componentStackFrames: () => [], focusedTplAncestorsThroughComponents: () => [],
  } as unknown as ViewCtx;
  const recorder = new ChangeRecorder({ inst: f.site, _instUtil: instUtil });
  const source = new CanvasOverlayToolbarInputs({ view, models: f.models, site: f.site, signal: f.lifetime.signal });
  let notices = 0;
  const stop = source.subscribe(() => { notices++; });
  try {
    source.getSnapshot();
    const readings = [
      f.measure("10 unchanged snapshot reads", () => { const before = source.getSnapshot(); for (let i = 0; i < 9; i++) { expect(source.getSnapshot()).toBe(before); } }),
      f.measure("1 selection publication", () => selection.setState({ revision: 1 })),
      f.measure("batch edit all event handlers", () => f.models.sync(recorder.withRecording(() => handlers.forEach((handler) => { handler.code = "() => 1"; })).changes)),
    ];
    expect(readings[0].fields).toBe(0);
    expect(readings[1].fields).toBe(0);
    expect(readings[2].fields).toBeLessThan(count * 20);
    expect(notices).toBe(2);
    results.push({ subject: "canvas overlay toolbar", count, readings });
  } finally { stop(); f.lifetime.abort(); f.models.dispose(); recorder.dispose(); }
});

it.each([100, 1000])("bounds directory and library work at %i components", (count) => {
  const f = fixture(), manager = new TplMgr({ site: f.site });
  const components = Array.from({ length: count }, (_, i) => manager.addComponent({ name: `Comp${i}`, type: ComponentType.Plain }));
  const recorder = new ChangeRecorder({ inst: f.site, _instUtil: instUtil });
  try {
    for (const [subject, source] of [
      ["navigation catalog", new NavigationCatalogInputs(f.studio, false)],
      ["component library catalog", new ComponentLibraryInputs(f.studio)],
    ] as const) {
      let notices = 0;
      const stop = source.subscribe(() => { notices++; });
      try {
        source.getSnapshot();
        const readings = [
          f.measure("10 unchanged snapshot reads", () => { const before = source.getSnapshot(); for (let i = 0; i < 9; i++) { expect(source.getSnapshot()).toBe(before); } }),
          f.measure("batch rename all components", () => f.models.sync(recorder.withRecording(() => components.forEach((component) => { component.name += "X"; })).changes)),
        ];
        expect(readings[0].fields).toBe(0);
        expect(readings[1].fields).toBeLessThan(count * 10);
        expect(notices).toBe(1);
        results.push({ subject, count, readings });
      } finally { stop(); }
    }
  } finally { f.lifetime.abort(); f.models.dispose(); recorder.dispose(); }
});

it.each([20, 100])("shares whole-roster expression inputs across %i query rows", (count) => {
  const f = fixture();
  const component = mkComponent({ name: "Owner", type: ComponentType.Plain, tplTree: mkTplTagX("div") });
  component.dataQueries.push(...Array.from({ length: count }, (_, i) => new ComponentDataQuery({ uuid: `query${i}`, name: `Query${i}`, op: undefined })));
  f.site.components.push(component);
  const recorder = new ChangeRecorder({ inst: f.site, _instUtil: instUtil });
  function Row({ index }: { index: number }) {
    const query = component.dataQueries[index];
    // The same two subscriptions consumed by DataQueryRowContent.
    usePropExpressionInputs(f.studio, query, query, component);
    usePropExpressionInputs(f.studio, component, component.dataQueries, component);
    return null;
  }
  let unmount: (() => void) | undefined;
  const mount = f.measure("mount query row hooks", () => { ({ unmount } = render(<>{component.dataQueries.map((query, index) => <Row key={query.uuid} index={index} />)}</>)); });
  try {
    const edit = f.measure("rename 1 query", () => act(() => f.models.sync(recorder.withRecording(() => { component.dataQueries[0].name += "X"; }).changes)));
    expect(mount.fields).toBeLessThan(count * 40);
    expect(edit.fields).toBeLessThan(count * 20);
    results.push({ subject: "data query row expression hooks", count, readings: [mount, edit] });
  } finally { unmount?.(); f.lifetime.abort(); f.models.dispose(); recorder.dispose(); }
});

it("rerenders only the edited ordinary query row while its parent follows the roster", () => {
  const f = fixture(), count = 100;
  const component = mkComponent({ name: "Owner", type: ComponentType.Plain, tplTree: mkTplTagX("div") });
  component.dataQueries.push(...Array.from({ length: count }, (_, i) => new ComponentDataQuery({ uuid: `query${i}`, name: `Query${i}`, op: undefined })));
  f.site.components.push(component);
  const recorder = new ChangeRecorder({ inst: f.site, _instUtil: instUtil });
  const renders = Array.from({ length: count }, () => 0);
  const Row = React.memo(function Row({ query, index }: { query: ComponentDataQuery; index: number }) {
    usePropExpressionInputs(f.studio, query, query, component);
    usePropExpressionInputs(f.studio, component, undefined, component);
    renders[index]++;
    return <span>{query.name}</span>;
  });
  function List() {
    usePropExpressionInputs(f.studio, component, component.dataQueries, component);
    return <>{component.dataQueries.map((query, index) => <Row key={query.uuid} query={query} index={index} />)}</>;
  }
  const mounted = render(<List />);
  try {
    const before = renders.slice();
    act(() => f.models.sync(recorder.withRecording(() => { component.dataQueries[0].name = "Updated"; }).changes));
    expect(mounted.getByText("Updated")).toBeTruthy();
    expect(renders[0]).toBeGreaterThan(before[0]);
    expect(renders.slice(1)).toEqual(before.slice(1));
  } finally { mounted.unmount(); f.lifetime.abort(); f.models.dispose(); recorder.dispose(); }
});

it.each([100, 1000])("bounds data picker updates at %i props", (count) => {
  const f = fixture();
  const component = mkComponent({ name: "Owner", type: ComponentType.Plain, tplTree: mkTplTagX("div") });
  component.params.push(...Array.from({ length: count }, (_, i) => mkParam({ name: `prop${i}`, type: typeFactory.text(), paramType: "prop" })));
  f.site.components.push(component);
  const recorder = new ChangeRecorder({ inst: f.site, _instUtil: instUtil });
  const hook = renderHook(() => useDataPickerSourceInputs(f.studio, component, [["$props"]], () => component.params.map((param) => param.variable.name)));
  try {
    const readings = [
      f.measure("rerender unchanged picker hook", () => hook.rerender()),
      f.measure("batch rename all props", () => act(() => f.models.sync(recorder.withRecording(() => component.params.forEach((param) => { param.variable.name += "X"; })).changes))),
    ];
    expect(readings[0].fields).toBe(0);
    expect(readings[1].fields).toBeLessThan(count * 5);
    expect(hook.result.current).toHaveLength(count);
    expect(hook.result.current?.[count - 1]).toBe(`prop${count - 1}X`);
    results.push({ subject: "data picker prop catalog", count, readings });
  } finally { hook.unmount(); f.lifetime.abort(); f.models.dispose(); recorder.dispose(); }
});

it.each([100, 1000])("bounds insert catalog updates at %i components", (count) => {
  const f = fixture(), manager = new TplMgr({ site: f.site });
  const components = Array.from({ length: count }, (_, i) => manager.addComponent({ name: `Comp${i}`, type: ComponentType.Plain }));
  Object.assign(f.studio, {
    appCtx: { appConfig: {}, subscribeUiEnvironmentInputs: () => () => undefined },
    projectDependencyManager: { dependencyStateStore: createStore(() => ({ plumeSite: undefined })) },
    getCodeComponentMeta: () => undefined, subscribeCodeRegistrations: () => () => undefined,
    subscribeModelChanges: () => () => undefined,
    arenaState: { lifetime: () => f.lifetime.signal, store: createStore(() => ({})) },
  });
  const dependencies: ProjectDependency[] = [];
  const recorder = new ChangeRecorder({ inst: f.site, _instUtil: instUtil });
  const hook = renderHook(() => useInsertPanelCatalogInputs(f.studio, dependencies));
  try {
    const readings = [
      f.measure("rerender unchanged insert catalog hook", () => hook.rerender()),
      f.measure("rename 1 component", () => act(() => f.models.sync(recorder.withRecording(() => { components[0].name += "X"; }).changes))),
      f.measure("batch rename all components", () => act(() => f.models.sync(recorder.withRecording(() => components.forEach((component) => { component.name += "X"; })).changes))),
    ];
    expect(readings[0].fields).toBe(0);
    expect(readings[1].fields).toBeLessThan(count * 20);
    expect(readings[2].fields).toBeLessThan(count * 20);
    results.push({ subject: "insert catalog hooks", count, readings });
  } finally { hook.unmount(); f.lifetime.abort(); f.models.dispose(); recorder.dispose(); }
});
