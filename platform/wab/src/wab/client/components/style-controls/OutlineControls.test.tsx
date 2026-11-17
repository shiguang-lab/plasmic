import { AppContext } from "@/wab/client/components/top-view";
import "@/wab/client/components/sidebar/MixinControls";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { OutlinePanelSection } from "@/wab/client/components/style-controls/OutlineControls";
import { ExpsProvider, SingleRsExpsProvider, TplExpsProvider, StyleTargetContext, createStyleTarget } from "@/wab/client/components/style-controls/StyleComponent";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { RuleSetHelpers } from "@/wab/shared/RuleSetHelpers";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensureBaseVariantSetting } from "@/wab/shared/Variants";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { ensureKnownTplTag } from "@/wab/shared/model/classes";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";

const studios = new Set<StudioCtx>();
beforeEach(() => vi.stubGlobal("IntersectionObserver", class {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}));
afterEach(async () => {
  cleanup();
  for (const studio of studios) { await studio.awaitEval(); studio.dispose(); }
  studios.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});

async function setup() {
  vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined);
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  const site = createSite(), manager = new TplMgr({ site });
  const component = manager.addComponent({ name: "Outline", type: ComponentType.Plain });
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
  return { studio, rsh, provider, view, root, manager, component };
}
function section(f: Awaited<ReturnType<typeof setup>>, provider: ExpsProvider = f.provider) {
  return <AppContext.Provider value={f.studio.app}><StudioCtxContext.Provider value={f.studio}><StyleTargetContext.Provider value={createStyleTarget({ expsProvider: provider })}>
    <OutlinePanelSection />
  </StyleTargetContext.Provider></StudioCtxContext.Provider></AppContext.Provider>;
}

it("adds only one outline, edits None in its popover and deletes the current override", async () => {
  const f = await setup();
  const { unmount } = render(section(f));
  expect(screen.queryByLabelText("Offset", { selector: "input" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Add outline" })).toBeEnabled();
  expect(screen.queryByRole("button", { name: "Outline: Default" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Remove outline" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Add outline" }));
  await screen.findByLabelText("Width", { selector: "input" });
  expect(f.rsh.get("outline-style")).toBe("solid");
  expect(screen.getByRole("button", { name: "Add outline" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Add outline" }));
  expect(document.querySelectorAll('[data-test-id="outline-row"]')).toHaveLength(1);
  expect(document.querySelector('[data-test-id="drag-handle"]')).toBeNull();
  const color = screen.getByRole("button", { name: "Outline color" });
  fireEvent.click(color);
  const picker = await screen.findByRole("dialog", { name: "Outline color" });
  const hex = ensure(picker.querySelector('[data-test-id="Color-input"]'), "Outline color Hex input");
  fireEvent.change(hex, { target: { value: "263a70" } });
  fireEvent.blur(hex);
  await waitFor(() => expect(f.rsh.get("outline-color").toLowerCase()).toBe("#263a70"));
  fireEvent.keyDown(picker, { key: "Escape" });
  await waitFor(() => expect(color).toHaveAttribute("aria-expanded", "false"));
  const width = screen.getByLabelText("Width", { selector: "input" });
  fireEvent.change(width, { target: { value: "4px" } });
  fireEvent.keyDown(width, { key: "Enter" });
  await waitFor(() => expect(f.rsh.get("outline-width")).toBe("4px"));
  const offset = screen.getByLabelText("Offset", { selector: "input" });
  fireEvent.change(offset, { target: { value: "-2px" } });
  fireEvent.keyDown(offset, { key: "Enter" });
  await waitFor(() => expect(f.rsh.get("outline-offset")).toBe("-2px"));
  const settings = screen.getByRole("button", { name: "Outline settings" });
  fireEvent.click(settings);
  const popup = await screen.findByRole("group", { name: "Outline settings" });
  for (const [label, value] of [["Dashed", "dashed"], ["Dotted", "dotted"], ["Double", "double"], ["Auto", "auto"], ["Groove", "groove"], ["Ridge", "ridge"], ["Inset", "inset"], ["Outset", "outset"], ["Solid line", "solid"]]) {
    fireEvent.click(screen.getByRole("button", { name: label }));
    await waitFor(() => expect(f.rsh.get("outline-style")).toBe(value));
  }
  expect(within(popup).getByRole("button", { name: "None" })).toBeInTheDocument();
  fireEvent.keyDown(popup, { key: "Escape" });
  await waitFor(() => expect(settings).toHaveAttribute("aria-expanded", "false"));
  await waitFor(() => expect(document.activeElement).toBe(settings));
  unmount();
  render(section(f));
  expect(screen.getByRole("button", { name: "Add outline" })).toBeDisabled();
  expect(screen.getByLabelText("Width", { selector: "input" })).toHaveValue("4px");
  fireEvent.click(screen.getByRole("button", { name: "Outline settings" }));
  fireEvent.click(within(await screen.findByRole("group", { name: "Outline settings" })).getByRole("button", { name: "None" }));
  await waitFor(() => expect(f.rsh.getRaw("outline-style")).toBe("none"));
  expect(f.rsh.getRaw("outline-width")).toBeUndefined();
  expect(f.rsh.getRaw("outline-offset")).toBeUndefined();
  expect(f.rsh.getRaw("outline-color")).toBeUndefined();
  expect(screen.queryByLabelText("Width", { selector: "input" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Outline settings" })).toHaveTextContent("None");
  expect(screen.queryByRole("button", { name: "Outline color" })).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Offset", { selector: "input" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Add outline" })).toBeDisabled();
  fireEvent.click(within(screen.getByRole("group", { name: "Outline settings" })).getByRole("button", { name: "Dashed" }));
  await screen.findByLabelText("Width", { selector: "input" });
  expect(f.rsh.get("outline-style")).toBe("dashed");
  fireEvent.keyDown(screen.getByRole("group", { name: "Outline settings" }), { key: "Escape" });
  fireEvent.click(screen.getByRole("button", { name: "Remove outline" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Add outline" })).toBeEnabled());
  expect(screen.queryByLabelText("Width", { selector: "input" })).not.toBeInTheDocument();
  for (const prop of ["outline-style", "outline-color", "outline-width", "outline-offset"]) {
    expect(f.rsh.getRaw(prop)).toBeUndefined();
  }
  await act(async () => { await f.studio.undo(); });
  await screen.findByRole("button", { name: "Outline settings" });
  expect(screen.getByLabelText("Width", { selector: "input" })).toBeInTheDocument();
});

it("shows inherited outline, clears it with None and restores it by removing the override", async () => {
  const f = await setup();
  await f.studio.changeUnsafe(() => {
    f.rsh.set("outline-style", "dotted");
    f.rsh.set("outline-width", "3px");
    f.rsh.set("outline-offset", "2px");
    f.rsh.set("outline-color", "#123456");
    f.rsh.set("border-top-style", "dashed");
  });
  const [variant] = await f.studio.changeUnsafe(() => f.manager.createStyleVariant(f.component, [":hover"]));
  await act(async () => {
    f.studio.setStudioFocusOnViewCtxContent(f.view);
    f.view.setStudioFocusByTpl(f.root);
    await f.studio.changeUnsafe(() => f.view.currentComponentStackFrame().setTargetVariants([variant]));
  });
  await waitFor(() => expect(f.studio.isSelectionPending).toBe(false));
  const provider = new TplExpsProvider(f.view, f.root);
  expect(provider.canEdit()).toBe(true);
  const mounted = render(section(f, provider));
  expect(screen.getByLabelText("Width", { selector: "input" })).toHaveValue("3px");
  expect(screen.getByRole("button", { name: "Add outline" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Outline settings" }));
  fireEvent.click(within(await screen.findByRole("group", { name: "Outline settings" })).getByRole("button", { name: "None" }));
  await waitFor(() => expect(provider.targetExp().getRaw("outline-style")).toBe("none"));
  expect(f.rsh.getRaw("outline-style")).toBe("dotted");
  mounted.unmount();
  render(section(f, provider));
  expect(screen.getByRole("button", { name: "Outline settings" })).toHaveTextContent("None");
  expect(screen.getByRole("button", { name: "Add outline" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Remove outline" }));
  await waitFor(() => expect(provider.maybeTargetExp()?.has("outline-style") ?? false).toBe(false));
  expect(screen.getByLabelText("Width", { selector: "input" })).toHaveValue("3px");
  expect(screen.getByLabelText("Offset", { selector: "input" })).toHaveValue("2px");
  expect(f.rsh.getRaw("outline-color")).toBe("#123456");
  expect(f.rsh.getRaw("border-top-style")).toBe("dashed");
});
