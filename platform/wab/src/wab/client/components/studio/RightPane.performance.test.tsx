import { writeFileSync } from "node:fs";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { RightPane } from "@/wab/client/components/studio/RightPane";
import { AppContext } from "@/wab/client/components/top-view";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { RightTabKey } from "@/wab/client/studio-ctx/StudioCtx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { getTargetedStylePanelInputs } from "@/wab/client/studio-ctx/targeted-style-panel-inputs";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { RuleSetHelpers } from "@/wab/shared/RuleSetHelpers";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensureVariantSetting } from "@/wab/shared/Variants";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import { ensureKnownTplTag } from "@/wab/shared/model/classes";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import React from "react";

class VisibleIntersectionObserver {
  constructor(private readonly callback: IntersectionObserverCallback) {}
  observe(target: Element) { this.callback([{ target, isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver); }
  disconnect() { return undefined; } unobserve() { return undefined; } takeRecords() { return []; }
}
beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", VisibleIntersectionObserver);
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined);
  vi.spyOn(ViewCtx.prototype, "awaitSync").mockResolvedValue(undefined);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function fixture(count: number) {
  const site = createSite();
  const component = new TplMgr({ site }).addComponent({ name: "Performance", type: ComponentType.Plain });
  const root = ensureKnownTplTag(component.tplTree);
  const children = Array.from({ length: count }, (_, index) => mkTplTagX("div", { name: `Node${index}` }));
  for (const child of children) {
    ensureVariantSetting(child, [component.variants[0]]);
    child.parent = root; root.children.push(child);
  }
  new RuleSetHelpers(children[0].vsettings[0].rs, "div").set("width", "120px");
  new RuleSetHelpers(children[1].vsettings[0].rs, "div").set("width", "240px");
  const frame = mkArenaFrame({ site, component, name: "Performance", width: 1000, height: 800 });
  site.arenas.push(mkMixedArena("Performance", [frame]));
  const f = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Performance" });
  const studio = f.studioCtx;
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  const view = ensure(studio.tryGetViewCtxForFrame(frame), "Performance view");
  studio.setStudioFocusOnFrameContents(frame);
  view.setStudioFocusByTpl(children[0]);
  studio.switchRightTab(RightTabKey.style);
  await waitFor(() => expect(studio.isSelectionPending).toBe(false));
  return { ...f, studio, view, children };
}

it.each([100, 1000])("bounds inspector input work with %i nodes and preserves edits across hide/reopen and selection", async (count) => {
  const { studio, view, app, appCtx, children } = await fixture(count);
  const models = studio.modelSnapshots;
  let reads = 0, binds = 0, releases = 0;
  const originalField = models.declaredField, originalSubscribe = models.subscribePreparedField;
  models.declaredField = function(...args) { reads++; return originalField.apply(this, args); };
  models.subscribePreparedField = function(...args) {
    binds++; const stop = originalSubscribe.apply(this, args);
    return () => { releases++; stop(); };
  };
  const records: Record<string, { reads: number; binds: number; releases: number; elapsed: number }> = {};
  const reset = () => { reads = binds = releases = 0; };
  const save = (stage: string, start: number) => { records[stage] = { reads, binds, releases, elapsed: performance.now() - start }; };
  let mounted: ReturnType<typeof render> | undefined;
  try {
    const source = getTargetedStylePanelInputs(studio, { kind: "visibility", view, tpl: children[0] });
    source.getRenderInputs(); source.getRenderInputs();
    const stop = source.subscribe(() => undefined);
    expect(reads).toBeLessThan(500);
    expect(binds).toBeLessThan(200);
    stop(); reset();
    const mount = performance.now();
    mounted = render(<AppContext.Provider value={app}><AppCtxContext.Provider value={appCtx}><StudioCtxContext.Provider value={studio}>
      <RightPane studioCtx={studio} canvasLoading={false} />
    </StudioCtxContext.Provider></AppCtxContext.Provider></AppContext.Provider>);
    save("mount", mount);
    expect(mounted.getByRole("textbox", { name: "Width" })).toHaveProperty("value", "120px");
    // Budget dependency work independently of machine speed and sibling count.
    expect(binds).toBeLessThan(20000);
    expect(reads).toBeLessThan(40000);
    const widthInput = mounted.getByRole("textbox", { name: "Width" });
    reset();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const selection = studio.selectionStore.getState();
    const close = performance.now();
    act(() => studio.collapseRightPanel()); save("close", close); reset();
    expect(studio.selectionStore.getState()).toBe(selection);
    const teardown = performance.now();
    await act(async () => { vi.advanceTimersByTime(180); });
    save("teardown", teardown);
    expect(mounted.queryByRole("textbox", { name: "Width" })).toBeNull();
    reset();
    const reopen = performance.now();
    act(() => studio.switchRightTab(RightTabKey.style));
    save("reopen", reopen);
    expect(mounted.getByRole("textbox", { name: "Width" })).toBe(widthInput);
    expect(mounted.getByRole("textbox", { name: "Width" })).toHaveProperty("value", "120px");
    expect(binds).toBeLessThan(20000);
    expect(reads).toBeLessThan(20000);
    const output = process.env.INSPECTOR_PERF_OUTPUT;
    if (output) { writeFileSync(`${output}-${count}.json`, JSON.stringify(records, null, 2)); }
    vi.useRealTimers();

    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    act(() => studio.collapseRightPanel());
    await act(async () => { vi.advanceTimersByTime(180); });
    expect(mounted.queryByRole("textbox", { name: "Width" })).toBeNull();
    vi.useRealTimers();
    await act(async () => { await studio.changeUnsafe(() => new RuleSetHelpers(children[0].vsettings[0].rs, "div").set("width", "160px")); });
    act(() => studio.switchRightTab(RightTabKey.style));
    expect(mounted.getByRole("textbox", { name: "Width" })).toHaveProperty("value", "160px");
    const editWidth = async (value: string) => {
      const control = ensure(mounted, "Mounted inspector").getByRole("textbox", { name: "Width" });
      fireEvent.focus(control); fireEvent.change(control, { target: { value } });
      await act(async () => { fireEvent.keyDown(control, { key: "Enter", code: "Enter" }); });
    };
    await editWidth("180px");
    await waitFor(() => expect(children[0].vsettings[0].rs.values.width).toBe("180px"));
    act(() => view.setStudioFocusByTpl(children[1]));
    await waitFor(() => expect(studio.isSelectionPending).toBe(false));
    expect(mounted.getByRole("textbox", { name: "Width" })).toHaveProperty("value", "240px");
    await editWidth("320px");
    await waitFor(() => expect(children[1].vsettings[0].rs.values.width).toBe("320px"));
    expect(children[0].vsettings[0].rs.values.width).toBe("180px");
  } finally {
    mounted?.unmount(); models.declaredField = originalField; models.subscribePreparedField = originalSubscribe;
    studio.dispose();
  }
});
