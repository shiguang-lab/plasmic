import { ComponentType } from "@/wab/shared/core/components";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { RightTabKey } from "@/wab/client/studio-ctx/StudioCtx";
import { clearInstalledHostlessPkgs } from "@/wab/client/studio-ctx/hostless-pkgs-state";
import { createSite } from "@/wab/shared/core/sites";
import { TplMgr } from "@/wab/shared/TplMgr";
import { setContentEditorMode } from "@/wab/client/studio-ctx/content-editor-mode-state";
import type { CodeComponent, PageComponent } from "@/wab/shared/core/components";

it("does not publish unchanged UI inputs during repeated Studio commands", () => {
  const { studioCtx: studio } = fakeStudioCtx();
  studio.switchRightTab(RightTabKey.style);
  studio.reportCanvasLoadError(new Error("Same error"));
  const changed = vi.fn();
  const stops = [studio.rightPanelStore, studio.presetsStore, studio.pageSettingsStore,
    studio.findReferencesStore, studio.canvasLoadStore, studio.hostlessPkgsStore]
    .map((store) => store.subscribe(changed));
  try {
    for (let index = 0; index < 100; index++) {
      studio.switchRightTab(RightTabKey.style);
      studio.hidePresetsModal();
      studio.pageSettingsPage = undefined;
      studio.pageSettingsOpen = false;
      studio.setFindReferencesComponent(undefined);
      studio.findReferencesStyleToken = undefined;
      studio.findReferencesDataToken = undefined;
      studio.reportCanvasLoadError("Same error");
      clearInstalledHostlessPkgs(studio);
    }
    expect(changed).not.toHaveBeenCalled();
  } finally { stops.forEach((stop) => stop()); studio.dispose(); }
});

it("clears model-backed dialog references when the real Studio exits its owner", () => {
  const site = createSite(), mgr = new TplMgr({ site });
  const component = mgr.addComponent({ type: ComponentType.Plain, name: "Card" });
  const page = mgr.addComponent({ type: ComponentType.Page, name: "Customers" }) as PageComponent;
  const { studioCtx: studio } = fakeStudioCtx({ site });
  studio.showPresetsModal(component as CodeComponent);
  studio.pageSettingsPage = page; studio.pageSettingsOpen = true;
  studio.setFindReferencesComponent(component);
  studio.dispose();
  expect(studio.presetsStore.getState().modalComponent).toBeUndefined();
  expect(studio.pageSettingsStore.getState()).toEqual({ page: undefined, open: false });
  expect(studio.findReferencesStore.getState()).toEqual({ component: undefined, styleToken: undefined, dataToken: undefined });
});

it("sorts current command values before revision publication and immediately applies mode filters", async () => {
  const site = createSite(), mgr = new TplMgr({ site });
  const first = mgr.addComponent({ type: ComponentType.Plain, name: "A" }), last = mgr.addComponent({ type: ComponentType.Plain, name: "Z" });
  const { studioCtx: studio } = fakeStudioCtx({ site });
  studio.observeComponents([first, last]);
  try {
    expect(studio.getSortedComponentArenas()[0].component).toBe(first);
    await studio.changeUnsafe(() => {
      last.name = "0";
      expect(studio.getSortedComponentArenas()[0].component).toBe(last);
    });
    setContentEditorMode(studio, true);
    expect(studio.getSortedComponentArenas()).toEqual([]);
    setContentEditorMode(studio, false);
    expect(studio.getSortedComponentArenas()[0].component).toBe(last);
  } finally { await studio.awaitEval(); studio.dispose(); }
});
