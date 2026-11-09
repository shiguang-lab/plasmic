import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { useTopBarInputs } from "@/wab/client/components/top-bar/top-bar-inputs";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { ensureKnownTplTag } from "@/wab/shared/model/classes";
import { act, renderHook, waitFor } from "@testing-library/react";

it("updates live preview choices, localization and account policy while ignoring unrelated tree labels", async () => {
  const site = createSite(), manager = new TplMgr({ site });
  const component = manager.addComponent({ type: ComponentType.Plain, name: "Original choice" });
  const { studioCtx: studio } = fakeStudioCtx({ site });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  studio.dbCtx().maybeObserveComponents([component]);
  let renders = 0;
  const originalConfig = studio.appCtx.appConfig;
  const hook = renderHook(() => {
    renders++; useTopBarInputs(studio, true);
    return { names: studio.site.components.map((item) => item.name), translation: !!studio.site.flags.usePlasmicTranslation, debug: studio.appCtx.appConfig.debug };
  });
  try {
    expect(hook.result.current.names).toContain("Original choice");
    await act(async () => { await studio.changeUnsafe(() => { component.name = "Renamed choice"; site.flags.usePlasmicTranslation = true; }); });
    expect(hook.result.current.names).toContain("Renamed choice");
    expect(hook.result.current.translation).toBe(true);
    const before = renders;
    await act(async () => { await studio.changeUnsafe(() => { ensureKnownTplTag(component.tplTree).name = "Unrelated node label"; }); });
    expect(renders).toBe(before);
    await act(async () => { await studio.changeUnsafe(() => { site.flags.unrelatedTopBarFlag = true; }); });
    expect(renders).toBe(before);
    act(() => { studio.appCtx.appConfig = { ...originalConfig, usePlasmicImg: !originalConfig.usePlasmicImg }; studio.appCtx.publishUiEnvironmentInputs(); });
    expect(renders).toBe(before);
    act(() => { studio.appCtx.appConfig = { ...originalConfig, debug: !originalConfig.debug }; studio.appCtx.publishUiEnvironmentInputs(); });
    expect(hook.result.current.debug).toBe(!originalConfig.debug);
  } finally { hook.unmount(); studio.appCtx.appConfig = originalConfig; studio.dispose(); }
});
