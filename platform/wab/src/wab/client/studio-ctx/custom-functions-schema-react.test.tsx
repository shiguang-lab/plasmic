import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { useCustomFunctionsSchema } from "@/wab/client/studio-ctx/custom-functions-schema-react";
import { createCustomFunctionFromRegistration } from "@/wab/shared/code-components/code-components";
import { createSite } from "@/wab/shared/core/sites";
import type { CustomFunctionRegistration } from "@plasmicapp/host";
import { act, renderHook, waitFor } from "@testing-library/react";

it("refreshes native function declarations on host registration changes while keeping equal schemas stable", async () => {
  const first: CustomFunctionRegistration = {function: () => "first", meta: {name: "lookup", importPath: "./lookup", typescriptDeclaration: "(input: string): string"}};
  const previous = window.__PlasmicFunctionsRegistry;
  window.__PlasmicFunctionsRegistry = [first];
  const site = createSite(); site.customFunctions.push(createCustomFunctionFromRegistration(first));
  const {studioCtx: studio} = fakeStudioCtx({site});
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  const mounted = renderHook(() => useCustomFunctionsSchema(studio));
  try {
    expect(mounted.result.current.$$).toContain("input: string");
    const before = mounted.result.current;
    act(() => studio.codeComponentsRegistry.clear()); expect(mounted.result.current).toBe(before);
    window.__PlasmicFunctionsRegistry = [{function: () => 1, meta: {...first.meta, typescriptDeclaration: "(input: number): number"}}];
    act(() => studio.codeComponentsRegistry.clear());
    expect(mounted.result.current.$$).toContain("input: number"); expect(mounted.result.current).not.toBe(before);
    const current = mounted.result.current;
    const compute = vi.spyOn(studio, "customFunctionsSchema");
    compute.mockClear();
    await act(async () => {await studio.changeUnsafe(() => {site.flags.unrelatedSchemaFlag = true;});});
    expect(mounted.result.current).toBe(current);
    expect(compute).not.toHaveBeenCalled();
    await act(async () => { await studio.changeUnsafe(() => { site.customFunctions[0].importName = "renamedLookup"; }); });
    expect(mounted.result.current.$$).toContain("renamedLookup");
  } finally {mounted.unmount(); studio.dispose(); window.__PlasmicFunctionsRegistry = previous;}
});
