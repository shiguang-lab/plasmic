import { CanvasFunctionInputs } from "@/wab/client/components/canvas/canvas-function-inputs";
import { CanvasRegistrations } from "@/wab/client/components/canvas/canvas-registrations";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { CodeComponentsRegistry } from "@/wab/shared/code-components/code-components";
import { createSite } from "@/wab/shared/core/sites";
import { customFunctionId } from "@/wab/shared/core/query-ids";
import { CustomFunction } from "@/wab/shared/model/classes";
import { mock } from "vitest-mock-extended";

afterEach(() => vi.unstubAllGlobals());

function fixture() {
  const site = createSite(), models = new ModelSnapshots();
  const command = vi.fn(), other = vi.fn(), library = { command: vi.fn() };
  const fn = new CustomFunction({ namespace: "group", importName: "read", importPath: "test", displayName: null,
    defaultExport: false, params: [], isQuery: false, isMutation: false });
  site.customFunctions.push(fn);
  const functions = [{ function: command, meta: { name: "read", namespace: "group", importPath: "test" } }];
  const libraries = [{ lib: library, meta: { name: "library", jsIdentifier: "library", importPath: "test", importType: "namespace", files: [] } }];
  vi.stubGlobal("__PlasmicComponentRegistry", []); vi.stubGlobal("__PlasmicContextRegistry", []);
  vi.stubGlobal("__PlasmicFunctionsRegistry", functions); vi.stubGlobal("__PlasmicLibraryRegistry", libraries);
  const source = new CodeComponentsRegistry(globalThis, {}), registry = new CanvasRegistrations(); registry.install(source);
  const studio = Object.assign(mock<StudioCtx>(), { modelSnapshots: models });
  const view = Object.assign(mock<ViewCtx>(), { site, studioCtx: studio });
  const owner = new CanvasFunctionInputs(view, registry);
  return { site, models, command, other, library, fn, functions, libraries, owner, registry,
    refresh: () => { source.clear(); registry.refresh(); },
    dispose: () => { owner.dispose(); registry.dispose(); models.dispose(); } };
}

it("preserves function/library handles and namespace identity on no-op refreshes", () => {
  const f = fixture(), before = f.owner.store.getState(), changed = vi.fn(); f.owner.store.subscribe(changed);
  expect(before.group).toEqual({ read: f.command });
  expect(before.library).toBe(f.library);
  f.refresh();
  expect(f.owner.store.getState()).toBe(before);
  f.functions[0].function = f.other; f.refresh();
  expect(f.owner.store.getState().group).toEqual({ read: f.other });
  expect(f.owner.store.getState().library).toBe(f.library);
  expect(changed).toHaveBeenCalledTimes(1);
  f.dispose();
});

it("installs committed namespace and registry changes together and detaches on disposal", () => {
  const f = fixture(), changed = vi.fn(); f.owner.store.subscribe(changed);
  f.fn.namespace = "renamed"; f.functions[0].meta.namespace = "renamed";
  f.models.sync([{ type: "update", oldValue: "group", newValue: "renamed", changeNode: { inst: f.fn, field: "namespace" } }]);
  const observed: unknown[] = [];
  f.registry.function(customFunctionId({ namespace: "renamed", importName: "read" })).subscribe(() => observed.push(f.owner.store.getState()));
  f.refresh();
  expect(f.owner.store.getState()).toEqual({ renamed: { read: f.command }, library: f.library });
  expect(observed).toEqual([f.owner.store.getState()]);
  expect(changed).toHaveBeenCalledTimes(1);
  f.owner.dispose();
  f.functions.length = 0; f.refresh();
  expect(changed).toHaveBeenCalledTimes(1);
  expect(f.owner.store.getState()).toEqual({});
  f.dispose();
});
