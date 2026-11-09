import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { useServerQueryOp } from "@/wab/client/components/sidebar-tabs/ServerQuery/useServerQueryOp";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { createCustomFunctionFromRegistration, CodeComponentsRegistry } from "@/wab/shared/code-components/code-components";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { cloneType } from "@/wab/shared/core/tpls";
import { ImageAssetType } from "@/wab/shared/core/image-asset-type";
import { mkImageAsset } from "@/wab/shared/core/image-assets";
import { ComponentServerQuery, CustomFunctionExpr, ImageAssetRef, StrongFunctionArg } from "@/wab/shared/model/classes";
import type { QueryComponentNode } from "@plasmicapp/data-sources";
import { registerFunction, type CustomFunctionMeta } from "@plasmicapp/host";
import { ensure, mkShortId } from "@/wab/shared/common";
import { act, renderHook, waitFor } from "@testing-library/react";
import * as React from "react";

const runtime = vi.hoisted(() => ({ observe: vi.fn<(tree: QueryComponentNode) => void>(), mutate: vi.fn() }));
vi.mock("@plasmicapp/data-sources", async (original) => ({ ...await original<typeof import("@plasmicapp/data-sources")>(), usePlasmicQueries: (tree: QueryComponentNode) => { runtime.observe(tree); return {}; } }));
vi.mock("@plasmicapp/query", async (original) => ({ ...await original<typeof import("@plasmicapp/query")>(), usePlasmicDataConfig: () => ({ mutate: runtime.mutate }) }));

it("revalidates same-object registration metadata and rebuilds query execution while unrelated clears stay quiet", async () => {
  const input: NonNullable<CustomFunctionMeta<(value: string) => string>["params"]>[0] = { name: "input", type: "string", required: false };
  const previous = window.__PlasmicFunctionsRegistry, previousGlobal = Reflect.get(globalThis, "__PlasmicFunctionsRegistry");
  Reflect.set(globalThis, "__PlasmicFunctionsRegistry", []);
  const lookup = (value: string) => value;
  registerFunction(lookup, { name: "lookupNative", importPath: "./lookup", params: [input] });
  const registration = ensure(new CodeComponentsRegistry(globalThis, {}).getRegisteredFunctions().find((entry) => entry.function === lookup), "SDK registered lookup");
  window.__PlasmicFunctionsRegistry = [registration];
  const site = createSite(), func = createCustomFunctionFromRegistration(registration); site.customFunctions.push(func);
  const expr = new CustomFunctionExpr({ func, args: [] });
  const component = new TplMgr({ site }).addComponent({ name: "Query owner", type: ComponentType.Plain });
  component.serverQueries.push(new ComponentServerQuery({ uuid: "native-registration-query", name: "Lookup", op: expr }));
  const { studioCtx: studio } = fakeStudioCtx({ site });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  const exprCtx = { component, projectFlags: studio.projectFlags(), inStudio: true }, env = {};
  const mounted = renderHook(() => useServerQueryOp({ expr, exprCtx, env }), { wrapper: ({ children }) => <StudioCtxContext.Provider value={studio}>{children}</StudioCtxContext.Provider> });
  try {
    expect(mounted.result.current.invalidArgs).toBeUndefined(); const firstTree = runtime.observe.mock.lastCall?.[0], before = runtime.observe.mock.calls.length;
    act(() => studio.codeComponentsRegistry.clear());
    expect(runtime.observe.mock.calls.length).toBe(before);
    input.required = true;
    act(() => studio.codeComponentsRegistry.clear());
    expect(mounted.result.current.invalidArgs).toBeTruthy(); expect(runtime.observe.mock.lastCall?.[0]).not.toBe(firstTree);
    const invalidTree = runtime.observe.mock.lastCall?.[0]; input.required = false;
    act(() => studio.codeComponentsRegistry.clear());
    expect(mounted.result.current.invalidArgs).toBeUndefined(); expect(runtime.observe.mock.lastCall?.[0]).not.toBe(invalidTree);
    const stable = runtime.observe.mock.calls.length;
    window.__PlasmicFunctionsRegistry = [registration, { function: () => "other", meta: { name: "unrelated", importPath: "./other" } }];
    act(() => studio.codeComponentsRegistry.clear());
    expect(runtime.observe.mock.calls.length).toBe(stable);
  } finally { mounted.unmount(); studio.dispose(); Reflect.set(globalThis, "__PlasmicFunctionsRegistry", previousGlobal); window.__PlasmicFunctionsRegistry = previous; runtime.observe.mockClear(); }
});

it("rebuilds a server query after replacing a referenced image and through undo and redo", async () => {
  const previous = window.__PlasmicFunctionsRegistry, previousGlobal = Reflect.get(globalThis, "__PlasmicFunctionsRegistry");
  Reflect.set(globalThis, "__PlasmicFunctionsRegistry", []);
  const lookup = async (url: string) => url;
  registerFunction(lookup, { name: "lookupImageNative", importPath: "./lookup-image", isQuery: true, params: [{ name: "url", type: "string", required: true }] });
  const registration = ensure(new CodeComponentsRegistry(globalThis, {}).getRegisteredFunctions().find((entry) => entry.function === lookup), "SDK registered image lookup");
  window.__PlasmicFunctionsRegistry = [registration];
  const site = createSite(), func = createCustomFunctionFromRegistration(registration);
  site.customFunctions.push(func);
  const asset = mkImageAsset({ name: "Reference", type: ImageAssetType.Picture, dataUri: "https://example.test/first.png" });
  site.imageAssets.push(asset);
  const expr = new CustomFunctionExpr({ func, args: [new StrongFunctionArg({ uuid: mkShortId(), argType: cloneType(ensure(func.params[0], "Registered URL parameter")), expr: new ImageAssetRef({ asset }) })] });
  const component = new TplMgr({ site }).addComponent({ name: "Image query owner", type: ComponentType.Plain });
  component.serverQueries.push(new ComponentServerQuery({ uuid: mkShortId(), name: "Image lookup", op: expr }));
  const { studioCtx: studio } = fakeStudioCtx({ site });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  studio["clearUndoLog"](); studio.createViewStateUndoRecord();
  const exprCtx = { component, projectFlags: studio.projectFlags(), inStudio: true }, env = {};
  const mounted = renderHook(() => useServerQueryOp({ expr, exprCtx, env }), { wrapper: ({ children }) => <StudioCtxContext.Provider value={studio}>{children}</StudioCtxContext.Provider> });
  const currentTree = () => ensure(runtime.observe.mock.lastCall?.[0], "Query tree sent to the SDK");
  const evaluatedArgs = () => ensure(Object.values(currentTree().queries)[0], "Registered query").args({ $q: {}, $props: {}, $ctx: {}, $state: {} });
  try {
    expect(mounted.result.current.invalidArgs).toBeUndefined();
    expect(evaluatedArgs()).toEqual(["https://example.test/first.png"]);
    const initialTree = currentTree();
    await act(async () => { await studio.changeUnsafe(() => { asset.dataUri = "https://example.test/second.png"; }); });
    expect(currentTree()).not.toBe(initialTree);
    expect(evaluatedArgs()).toEqual(["https://example.test/second.png"]);
    const editedTree = currentTree();
    await act(async () => { await studio.undo(); });
    expect(currentTree()).not.toBe(editedTree);
    expect(evaluatedArgs()).toEqual(["https://example.test/first.png"]);
    const undoneTree = currentTree();
    await act(async () => { await studio.redo(); });
    expect(currentTree()).not.toBe(undoneTree);
    expect(evaluatedArgs()).toEqual(["https://example.test/second.png"]);
  } finally {
    mounted.unmount(); studio.dispose();
    Reflect.set(globalThis, "__PlasmicFunctionsRegistry", previousGlobal); window.__PlasmicFunctionsRegistry = previous;
    runtime.observe.mockClear();
  }
});
