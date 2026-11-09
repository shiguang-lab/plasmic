import { ensureBaseVariantSetting } from "@/wab/shared/VariantTplMgr";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { ensure } from "@/wab/shared/common";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import { RuleSetHelpers } from "@/wab/shared/RuleSetHelpers";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { buildAddItemGroups } from "@/wab/client/components/insert-panel/InsertPanel";
import { useInsertPanelCatalogInputs, useInsertPanelTargetInputs } from "@/wab/client/components/insert-panel/insert-panel-inputs";
import { Matcher } from "@/wab/client/components/view-common";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import type { HostLessPackageInfo } from "@/wab/shared/devflags";
import { ensureKnownTplTag } from "@/wab/shared/model/classes";
import { act, renderHook, waitFor } from "@testing-library/react";

it("refreshes actual resource catalogs on model and in-place app metadata changes while unrelated edits stay quiet", async () => {
  const site = createSite(), component = new TplMgr({ site }).addComponent({ name: "Original card", type: ComponentType.Plain });
  const pkg: HostLessPackageInfo = { type: "hostless-package", name: "Native library", sectionLabel: "Native library", projectId: "native-library", items: [{ type: "hostless-component", componentName: "NativeWidget", displayName: "Original widget" }] };
  const { studioCtx: studio, appCtx } = fakeStudioCtx({ site, devFlagOverrides: { hostLessComponents: [pkg] } });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  studio.observeComponents([component]);
  const dependencies = site.projectDependencies.slice();
  const mounted = renderHook(() => {
    const inputs = useInsertPanelCatalogInputs(studio, dependencies);
    const groups = buildAddItemGroups({ uiLocale: "en", studioCtx: studio, matcher: new Matcher(""), includeFrames: false, recentItems: [], filterToTarget: false, projectDependencies: dependencies, canSave: true, showSyntheticSections: { plume: true, unstyled: true } });
    return { inputs, labels: groups.flatMap((group) => group.items.map((item) => item.label)) };
  });
  try {
    expect(mounted.result.current.labels).toContain("Original card"); expect(mounted.result.current.labels).toContain("Original widget");
    const before = mounted.result.current;
    await act(async () => { await studio.changeUnsafe(() => { ensureKnownTplTag(component.tplTree).name = "Unrelated canvas label"; }); });
    expect(mounted.result.current).toBe(before);
    act(() => { studio.codeComponentsRegistry.clear(); }); expect(mounted.result.current).toBe(before);
    act(() => { appCtx.appConfig.previewSteps = !appCtx.appConfig.previewSteps; appCtx.publishUiEnvironmentInputs(); }); expect(mounted.result.current).toBe(before);
    await act(async () => { await studio.changeUnsafe(() => { component.name = "Updated card"; }); });
    expect(mounted.result.current.labels).toContain("Updated card"); expect(mounted.result.current.labels).not.toContain("Original card");
    act(() => { pkg.items[0].displayName = "Updated widget"; appCtx.publishUiEnvironmentInputs(); });
    expect(mounted.result.current.labels).toContain("Updated widget"); expect(mounted.result.current.labels).not.toContain("Original widget");
  } finally { mounted.unmount(); await studio.awaitEval(); studio.dispose(); }
});

it("tracks the selected insertion target and ancestor rules without subscribing to sibling labels", async () => {
  vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined); vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  const site = createSite(), component = new TplMgr({ site }).addComponent({ name: "Insertion owner", type: ComponentType.Plain });
  const root = ensureKnownTplTag(component.tplTree), first = mkTplTagX("div", { baseVariant: component.variants[0] }), second = mkTplTagX("div", { baseVariant: component.variants[0] }); first.parent = second.parent = root; root.children.push(first, second);
  ensureBaseVariantSetting(component, first); ensureBaseVariantSetting(component, second);
  const frame = mkArenaFrame({ site, component, name: "Insertion", width: 400, height: 300 }); site.arenas.push(mkMixedArena("Insertion", [frame]));
  const { studioCtx: studio } = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Insertion" });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true)); const view = ensure(studio.tryGetViewCtxForFrame(frame), "Insertion view");
  studio.observeComponents([component]);
  view.selection.setTpls([first]);
  const mounted = renderHook(() => ({ inputs: useInsertPanelTargetInputs(studio, view), selected: view.focusedTplOrSlotSelection() }));
  try {
    expect(mounted.result.current.selected).toBe(first); const initial = mounted.result.current;
    await act(async () => { await studio.changeUnsafe(() => { second.name = "Unrelated sibling"; }); });
    expect(mounted.result.current).toBe(initial);
    await act(async () => { await studio.changeUnsafe(() => { first.tag = "button"; }); });
    expect(mounted.result.current).not.toBe(initial);
    const beforeSelection = mounted.result.current;
    act(() => view.selection.setTpls([second])); expect(mounted.result.current.selected).toBe(second); expect(mounted.result.current).not.toBe(beforeSelection);
    const beforeStyle = mounted.result.current;
    await act(async () => { await studio.changeUnsafe(() => { new RuleSetHelpers(root.vsettings[0].rs, "div").set("display", "grid"); }); });
    expect(mounted.result.current).not.toBe(beforeStyle);
  } finally { mounted.unmount(); await studio.awaitEval(); studio.dispose(); vi.restoreAllMocks(); }
});
