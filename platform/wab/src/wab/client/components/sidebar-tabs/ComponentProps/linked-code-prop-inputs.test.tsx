import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { useLinkedCodePropInputs } from "@/wab/client/components/sidebar-tabs/ComponentProps/linked-code-prop-inputs";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { TplMgr } from "@/wab/shared/TplMgr";
import { mkCodeComponent } from "@/wab/shared/code-components/code-components";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { mkParam } from "@/wab/shared/core/lang";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplComponent } from "@/wab/shared/core/tpls";
import { ensureBaseVariantSetting } from "@/wab/shared/Variants";
import { Arg, VarRef } from "@/wab/shared/model/classes";
import { typeFactory } from "@/wab/shared/model/model-util";
import { act, renderHook, waitFor } from "@testing-library/react";

it("publishes changed forwarded bindings and keeps its snapshot for unrelated tree edits", async () => {
  vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined); vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  const site = createSite(), manager = new TplMgr({ site });
  const component = manager.addComponent({ name: "Forwarder", type: ComponentType.Plain });
  const param = mkParam({ name: "forwarded", type: typeFactory.text(), paramType: "prop" }); component.params.push(param);
  const code = mkCodeComponent("Endpoint", { name: "Endpoint", importPath: "./endpoint", props: {} }, {});
  const endpoint = mkParam({ name: "value", type: typeFactory.text(), paramType: "prop" }); code.params.push(endpoint); site.components.push(code);
  const tpl = mkTplComponent(code, component.variants[0]); component.tplTree = tpl;
  const setting = ensureBaseVariantSetting(tpl); setting.args.push(new Arg({ param: endpoint, expr: new VarRef({ variable: param.variable }) }));
  const frame = mkArenaFrame({ site, component, name: "Forwarder", width: 400, height: 300 }); site.arenas.push(mkMixedArena("Forwarder", [frame]));
  const { studioCtx: studio } = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Forwarder" });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true)); const view = ensure(studio.tryGetViewCtxForFrame(frame), "Forwarding view");
  const hook = renderHook(({ owner }) => useLinkedCodePropInputs(owner, component), { initialProps: { owner: view } });
  try {
    const first = hook.result.current; expect(first).toContain("forwarded");
    await act(async () => { await studio.changeUnsafe(() => { tpl.name = "Unrelated element label"; }); });
    expect(hook.result.current).toBe(first);
    await act(async () => { await studio.changeUnsafe(() => { param.variable.name = "renamed"; }); });
    expect(hook.result.current).toContain("renamed"); expect(hook.result.current).not.toBe(first);
    await act(async () => { await studio.changeUnsafe(() => { setting.args = []; }); });
    expect(hook.result.current).toEqual([]);
    const nextModels = new ModelSnapshots(), nextLifetime = new AbortController();
    const nextStudio = { site: createSite(), modelSnapshots: nextModels, arenaState: { lifetime: () => nextLifetime.signal } } as unknown as StudioCtx;
    const nextView = { studioCtx: nextStudio, modelLifetime: nextLifetime.signal, disposeSignal: new AbortController().signal, isDisposed: false } as unknown as ViewCtx;
    const admitted = vi.spyOn(nextModels, "ref"), fields = vi.spyOn(nextModels, "declaredField");
    hook.rerender({ owner: nextView });
    expect(admitted).not.toHaveBeenCalled(); expect(fields).not.toHaveBeenCalled();
    nextModels.dispose();
  } finally { hook.unmount(); studio.dispose(); vi.restoreAllMocks(); }
});
