import { CanvasRegistrations } from "@/wab/client/components/canvas/canvas-registrations";
import { CodeComponentsRegistry, registeredFunctionId } from "@/wab/shared/code-components/code-components";
import { ensure } from "@/wab/shared/common";

afterEach(() => vi.unstubAllGlobals());

function fixture() {
  const first = { component: () => null, meta: { name: "First", importPath: "test", props: { label: { type: "choice" as const, options: ["one"] } } } };
  const second = { component: () => null, meta: { name: "Second", importPath: "test", props: {} } };
  const fn = { function: vi.fn(), meta: { name: "read", importPath: "test" } };
  const lib = { lib: { command: vi.fn() }, meta: { name: "library", jsIdentifier: "library", importPath: "test", importType: "namespace" as const, files: [] } };
  const components = [first, second], functions = [fn], libraries = [lib];
  vi.stubGlobal("__PlasmicComponentRegistry", components);
  vi.stubGlobal("__PlasmicContextRegistry", []);
  vi.stubGlobal("__PlasmicFunctionsRegistry", functions);
  vi.stubGlobal("__PlasmicLibraryRegistry", libraries);
  const registry = new CodeComponentsRegistry(globalThis, {});
  const owner = new CanvasRegistrations(); owner.install(registry);
  return { first, second, fn, lib, components, functions, libraries, registry, owner,
    refresh: () => { registry.clear(); owner.refresh(); } };
}

it("publishes only changed demanded keys and retains real implementation/metadata handles", () => {
  const f = fixture(), first = f.owner.component("First"), second = f.owner.component("Second");
  const changed = vi.fn(), other = vi.fn(); first.subscribe(changed); second.subscribe(other);
  const before = ensure(first.getState(), "First must be installed");
  expect(before.runtime.impl).toBe(f.first.component);
  expect(before.runtime.meta).toBe(f.first.meta);
  f.refresh();
  expect(first.getState()).toBe(before);
  expect(changed).not.toHaveBeenCalled();
  f.first.meta.props.label.options.push("two"); f.refresh();
  expect(first.getState()).not.toBe(before);
  expect(before.contract).toMatchObject({ props: { label: { options: ["one"] } } });
  expect(first.getState()?.contract).toMatchObject({ props: { label: { options: ["one", "two"] } } });
  expect(changed).toHaveBeenCalledTimes(1);
  expect(other).not.toHaveBeenCalled();
  f.owner.dispose();
});

it("installs function/library replacement and removals before any key notification", () => {
  const f = fixture(), fn = f.owner.function(registeredFunctionId(f.fn)), lib = f.owner.library("library");
  const observed: unknown[] = [];
  fn.subscribe(() => observed.push([fn.getState()?.runtime.function, lib.getState()?.runtime.lib, f.owner.libraryNamesStore.getState()]));
  const replacementFunction = vi.fn(), replacementLibrary = { command: vi.fn() };
  f.fn.function = replacementFunction; f.lib.lib = replacementLibrary;
  f.refresh();
  expect(observed).toEqual([[replacementFunction, replacementLibrary, ["library"]]]);
  expect(lib.getState()?.runtime.lib).toBe(replacementLibrary);
  f.functions.length = 0; f.libraries.length = 0; f.refresh();
  expect(observed[1]).toEqual([undefined, undefined, []]);
  expect(f.owner.libraryNamesStore.getState()).toEqual([]);
  f.owner.dispose();
});

it("publishes boolean loading transitions and releases listeners and handles on disposal", () => {
  const f = fixture(), component = f.owner.component("First"), loading = f.owner.loadingStore;
  const notify = vi.fn(), changed = vi.fn(); loading.subscribe(notify); component.subscribe(changed);
  f.owner.begin(); f.owner.begin(); f.owner.end();
  expect(loading.getState()).toBe(true);
  expect(notify).toHaveBeenCalledTimes(1);
  f.owner.end();
  expect(loading.getState()).toBe(false);
  expect(notify).toHaveBeenCalledTimes(2);
  f.owner.begin();
  f.owner.dispose(); f.owner.end(); f.refresh();
  expect(component.getState()).toBeUndefined();
  expect(loading.getState()).toBe(false);
  expect(notify).toHaveBeenCalledTimes(3);
  expect(changed).not.toHaveBeenCalled();
});
