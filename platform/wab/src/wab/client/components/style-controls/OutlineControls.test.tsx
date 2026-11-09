import { AppContext } from "@/wab/client/components/top-view";
import "@/wab/client/components/sidebar/MixinControls";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { OutlinePanelSection } from "@/wab/client/components/style-controls/OutlineControls";
import { SingleRsExpsProvider, StyleTargetContext, createStyleTarget } from "@/wab/client/components/style-controls/StyleComponent";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { RuleSetHelpers } from "@/wab/shared/RuleSetHelpers";
import { TplMgr } from "@/wab/shared/TplMgr";
import { VariantTplMgr } from "@/wab/shared/VariantTplMgr";
import { ensureBaseVariantSetting } from "@/wab/shared/Variants";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { ensureKnownTplTag } from "@/wab/shared/model/classes";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";

const studios = new Set<StudioCtx>();
afterEach(async () => {
  cleanup();
  for (const studio of studios) { await studio.awaitEval(); studio.dispose(); }
  studios.clear(); vi.restoreAllMocks();
});

async function setup() {
  vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined);
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  const site = createSite(), manager = new TplMgr({ site });
  const component = manager.addComponent({ name: "Outline", type: ComponentType.Plain });
  const [variant] = manager.createStyleVariant(component, [":focus"]);
  const root = ensureKnownTplTag(component.tplTree), rs = ensureBaseVariantSetting(root).rs;
  const rsh = new RuleSetHelpers(rs, "div");
  const frame = mkArenaFrame({ site, component, name: "Outline", width: 200, height: 100 });
  site.arenas.push(mkMixedArena("Outline", [frame]));
  const { studioCtx: studio } = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Outline" });
  studios.add(studio);
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  studio.observeComponents([component]); studio.createViewStateUndoRecord();
  const view = ensure(studio.tryGetViewCtxForFrame(frame), "Actual outline view");
  vi.spyOn(view, "awaitSync").mockResolvedValue(undefined);
  studio.setStudioFocusOnFrame({ frame, autoZoom: false });
  const provider = new SingleRsExpsProvider(rs, rsh, studio, [], { kind: "ruleSet", rs, forTag: "div" });
  return { studio, view, variant, rsh, provider };
}
function section(f: Awaited<ReturnType<typeof setup>>, tail?: React.ReactNode) {
  return <AppContext.Provider value={f.studio.app}><StudioCtxContext.Provider value={f.studio}><StyleTargetContext.Provider value={createStyleTarget({ expsProvider: f.provider })}>
    <OutlinePanelSection />{tail}
  </StyleTargetContext.Provider></StudioCtxContext.Provider></AppContext.Provider>;
}
function warning() { return screen.queryByText(/are typically used for styling the focused state/); }

it("uses actual target CSS and variant fields while retaining the original add/clear commands", async () => {
  const f = await setup();
  const mounted = render(section(f));
  expect(screen.queryByText("Offset")).not.toBeInTheDocument();
  await act(async () => { await f.studio.changeUnsafe(() => f.rsh.set("outline-width", "2px")); });
  expect(screen.getByText("Offset")).toBeInTheDocument(); expect(warning()).toBeInTheDocument();
  await act(async () => { f.view.currentComponentStackFrame().setTargetVariants([f.variant]); });
  expect(warning()).not.toBeInTheDocument();
  await act(async () => { await f.studio.changeUnsafe(() => { f.variant.selectors = undefined; }); });
  expect(warning()).toBeInTheDocument();
  await act(async () => { await f.studio.changeUnsafe(() => { f.variant.codeComponentName = "Outline"; f.variant.codeComponentVariantKeys = ["focused"]; }); });
  expect(warning()).not.toBeInTheDocument();
  await act(async () => { await f.studio.changeUnsafe(() => { f.variant.codeComponentVariantKeys = undefined; }); });
  expect(warning()).toBeInTheDocument();
  const combo = vi.spyOn(VariantTplMgr.prototype, "getCurrentVariantCombo");
  await act(async () => { await f.studio.changeUnsafe(() => f.rsh.set("opacity", "0.45")); });
  expect(combo).not.toHaveBeenCalled();
  await act(async () => { fireEvent.click(ensure(mounted.container.querySelector(".icon-link-btn"), "Outline clear command")); });
  await waitFor(() => expect(f.rsh.has("outline-width")).toBe(false));
  expect(screen.queryByText("Offset")).not.toBeInTheDocument();
});

it("captures a target change between render and subscription and seals inputs on actual View disposal", async () => {
  const f = await setup();
  await f.studio.changeUnsafe(() => f.rsh.set("outline-width", "2px"));
  const selectors = f.studio.modelSnapshots.field(f.variant, "selectors");
  const subscribe = selectors.subscribe.bind(selectors);
  const lateCallbacks: Array<() => void> = [];
  let active = 0;
  vi.spyOn(selectors, "subscribe").mockImplementation((listener) => {
    active++;
    lateCallbacks.push(() => listener(selectors.getState(), selectors.getState()));
    const stop = subscribe(listener);
    let stopped = false;
    return () => { if (!stopped) { stopped = true; active--; stop(); } };
  });
  function RetargetBeforeSubscription() {
    React.useLayoutEffect(() => { f.view.currentComponentStackFrame().setTargetVariants([f.variant]); }, []);
    return null;
  }
  const mounted = render(section(f, <RetargetBeforeSubscription />));
  expect(warning()).not.toBeInTheDocument();
  expect(active).toBeGreaterThan(0);
  const combo = vi.spyOn(VariantTplMgr.prototype, "getCurrentVariantCombo");
  await act(async () => { f.view.dispose(); });
  expect(active).toBe(0);
  combo.mockClear();
  const fields = vi.spyOn(f.studio.modelSnapshots, "field");
  lateCallbacks.forEach((callback) => callback());
  mounted.rerender(section(f));
  expect(combo).not.toHaveBeenCalled(); expect(fields).not.toHaveBeenCalled(); expect(warning()).not.toBeInTheDocument();
  mounted.unmount();
});
