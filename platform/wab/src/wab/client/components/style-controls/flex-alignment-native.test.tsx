import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import "@/wab/client/components/sidebar/MixinControls";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { AlignContentControls } from "@/wab/client/components/style-controls/align-content-controls";
import { JustifyControls } from "@/wab/client/components/style-controls/justify-content-controls";
import { SingleRsExpsProvider, StyleTargetContext, createStyleTarget } from "@/wab/client/components/style-controls/StyleComponent";
import type { SvgIcon } from "@/wab/client/components/widgets/Icon";
import RowJustifyStartIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__RowJustifyStart";
import RowJustifyEndIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__RowJustifyEnd";
import ColumnJustifyEndIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__ColumnJustifyEnd";
import RowWrapStartIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__RowWrapStart";
import RowWrapReverseStartIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__RowWrapReverseStart";
import ColumnWrapReverseStartIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__ColumnWrapReverseStart";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { TplMgr } from "@/wab/shared/TplMgr";
import { RuleSetHelpers } from "@/wab/shared/RuleSetHelpers";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { ensureBaseVariantSetting } from "@/wab/shared/Variants";
import { ensureKnownTplTag } from "@/wab/shared/model/classes";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const studios = new Set<StudioCtx>();
afterEach(async () => {
  cleanup();
  for (const studio of studios) { await studio.awaitEval(); studio.dispose(); }
  studios.clear(); vi.restoreAllMocks();
});
async function setup(direction = "row", wrap = "wrap") {
  vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined);
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  const site = createSite(), mgr = new TplMgr({ site });
  const component = mgr.addComponent({ name: "Flex controls", type: ComponentType.Plain });
  const tpl = ensureKnownTplTag(component.tplTree), rs = ensureBaseVariantSetting(tpl).rs;
  const rsh = new RuleSetHelpers(rs, "div");
  rsh.set("display", "flex"); rsh.set("flex-direction", direction); rsh.set("flex-wrap", wrap);
  rsh.set("justify-content", "flex-start"); rsh.set("align-content", "stretch");
  const { studioCtx: studio } = fakeStudioCtx({ site, devFlagOverrides: { ccStubs: true } }); studios.add(studio);
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  studio.observeComponents([component]); studio.createViewStateUndoRecord();
  const provider = new SingleRsExpsProvider(rs, rsh, studio, [], { kind: "ruleSet", rs, forTag: "div" });
  const sc = createStyleTarget({ expsProvider: provider });
  return { studio, provider, sc, rsh };
}
function controls(f: Awaited<ReturnType<typeof setup>>) {
  return <StudioCtxContext.Provider value={f.studio}><StyleTargetContext.Provider value={f.sc}>
    <div data-test-flex="justify"><JustifyControls expsProvider={f.provider} /></div>
    <div data-test-flex="align"><AlignContentControls expsProvider={f.provider} /></div>
  </StyleTargetContext.Provider></StudioCtxContext.Provider>;
}
function buttons(container: HTMLElement, kind: "justify" | "align") {
  return ensure(container.querySelector(`[data-test-flex="${kind}"]`), "Flex group").querySelectorAll<HTMLButtonElement>("button.flex-fill");
}
function firstIcon(container: HTMLElement, kind: "justify" | "align") {
  return ensure(ensure(buttons(container, kind)[0], "First flex option").querySelector("svg"), "Real flex icon");
}
function expectIcon(actual: SVGElement, Glyph: SvgIcon) {
  const expected = document.createElement("div"); expected.innerHTML = renderToStaticMarkup(<Glyph />);
  expect(actual.innerHTML).toBe(ensure(expected.querySelector("svg"), "Expected real icon").innerHTML);
}
async function change(f: Awaited<ReturnType<typeof setup>>, values: Record<string, string>) {
  await act(async () => { await f.studio.changeUnsafe(() => { for (const [key, value] of Object.entries(values)) { f.rsh.set(key, value); } }); });
}

it("updates native direction and wrap icon scalars", async () => {
  const f = await setup(); const mounted = render(controls(f));
  expect(buttons(mounted.container, "justify")).toHaveLength(5); expect(buttons(mounted.container, "align")).toHaveLength(6);
  expectIcon(firstIcon(mounted.container, "justify"), RowJustifyStartIcon);
  expectIcon(firstIcon(mounted.container, "align"), RowWrapStartIcon);
  await change(f, { "flex-direction": "row-reverse" });
  expectIcon(firstIcon(mounted.container, "justify"), RowJustifyEndIcon);
  expect(firstIcon(mounted.container, "align")).toHaveClass("flip-horiz");
  await change(f, { "flex-wrap": "wrap-reverse" });
  expectIcon(firstIcon(mounted.container, "align"), RowWrapReverseStartIcon);
  await change(f, { "flex-direction": "column-reverse" });
  expectIcon(firstIcon(mounted.container, "justify"), ColumnJustifyEndIcon);
  expectIcon(firstIcon(mounted.container, "align"), ColumnWrapReverseStartIcon);
  expect(firstIcon(mounted.container, "align")).toHaveClass("flip-vert");
  expect(firstIcon(mounted.container, "align")).not.toHaveClass("flip-horiz");
});

it("retains the real toggle write path across unrelated CSS updates", async () => {
  const f = await setup(); const mounted = render(controls(f));
  const justifyIcon = firstIcon(mounted.container, "justify"), alignIcon = firstIcon(mounted.container, "align");
  await change(f, { opacity: "0.45" });
  expect(firstIcon(mounted.container, "justify")).toBe(justifyIcon);
  expect(firstIcon(mounted.container, "align")).toBe(alignIcon);
  await act(async () => { fireEvent.click(ensure(buttons(mounted.container, "justify")[1], "Justify center option")); });
  await waitFor(() => expect(f.rsh.get("justify-content")).toBe("center"));
  await act(async () => { fireEvent.click(ensure(buttons(mounted.container, "align")[1], "Align center option")); });
  await waitFor(() => expect(f.rsh.get("align-content")).toBe("center"));
});

it("rebinds actual provider owners and releases native fields without inventing closed-owner defaults", async () => {
  const first = await setup(), second = await setup("column-reverse", "wrap-reverse");
  const mounted = render(controls(first));
  expect(first.studio.singleRsStyleInputs["entries"].size).toBeGreaterThan(0);
  mounted.rerender(controls(second));
  expect(first.studio.singleRsStyleInputs["entries"].size).toBe(0);
  expect(second.studio.singleRsStyleInputs["entries"].size).toBeGreaterThan(0);
  await change(first, { "flex-direction": "row-reverse" });
  expectIcon(firstIcon(mounted.container, "justify"), ColumnJustifyEndIcon);
  mounted.unmount();
  expect(second.studio.singleRsStyleInputs["entries"].size).toBe(0);
  await second.studio.awaitEval(); second.studio.dispose();
  const fields = vi.spyOn(second.studio.modelSnapshots, "field");
  const closed = render(controls(second));
  expect(closed.container.querySelector("button")).toBeNull();
  expect(fields).not.toHaveBeenCalled();
});
