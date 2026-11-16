import { TransformPanelSection } from "@/wab/client/components/sidebar-tabs/TransformPanelSection";
import "@/wab/client/components/sidebar/MixinControls";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { FilterEffectSection, BackdropFilterEffectSection } from "@/wab/client/components/sidebar-tabs/FilterEffectSection";
import { ShadowsPanelSection } from "@/wab/client/components/sidebar-tabs/ShadowsSection";
import { SidebarModalProvider } from "@/wab/client/components/sidebar/SidebarModal";
import { SingleRsExpsProvider, StyleTarget, StyleTargetContext } from "@/wab/client/components/style-controls/StyleComponent";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { mkStyleToken, mkTokenRef } from "@/wab/commons/StyleToken";
import { RuleSetHelpers } from "@/wab/shared/RuleSetHelpers";
import type { PkgVersionInfoMeta } from "@/wab/shared/SharedApi";
import { TplMgr } from "@/wab/shared/TplMgr";
import { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import { ensure } from "@/wab/shared/common";
import { createSite } from "@/wab/shared/core/sites";
import { parseCss } from "@/wab/shared/css";
import { StyleToken } from "@/wab/shared/model/classes";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";

const studios = new Set<StudioCtx>();
beforeEach(() => vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} }));
afterEach(async () => { cleanup(); for (const studio of studios) { await studio.awaitEval(); studio.dispose(); } studios.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function setup(nonbase = false) {
  const site = createSite(), end = mkStyleToken({ name: "End", type: "Color", value: "#123456" }), head = mkStyleToken({ name: "Shadow paint", type: "Color", value: mkTokenRef(end) });
  site.styleTokens.push(head, end);
  const manager = new TplMgr({ site });
  const group = nonbase ? manager.createGlobalVariantGroup("Shadow context") : undefined;
  const active = group ? manager.createGlobalVariant(group, "Dark") : undefined;
  const rs = ensure(site.activeTheme, "Active theme").defaultStyle.rs, exp = new RuleSetHelpers(rs, "div");
  exp.set("filter", `drop-shadow(0px 1px 2px ${mkTokenRef(head)})`);
  exp.set("backdrop-filter", `drop-shadow(0px 2px 3px ${mkTokenRef(head)})`);
  exp.set("box-shadow", `0px 4px 16px 0px ${mkTokenRef(head)}`);
  const f = fakeStudioCtx({ site }); studios.add(f.studioCtx);
  await waitFor(() => expect(f.studioCtx.initialRouteReady).toBe(true));
  const studio = f.studioCtx, helper = new VariantedStylesHelper(site, active ? [active] : undefined);
  const provider = new SingleRsExpsProvider(rs, exp, studio, [], { kind: "ruleSet", rs, forTag: "div" });
  const sc = new StyleTarget({ expsProvider: provider });
  const wrap = (content: React.ReactNode) => <AppCtxContext.Provider value={f.appCtx}><StudioCtxContext.Provider value={studio}><StyleTargetContext.Provider value={sc}><SidebarModalProvider containerSelector="#filter-shadow-sidebar"><div id="filter-shadow-sidebar" />{content}</SidebarModalProvider></StyleTargetContext.Provider></StudioCtxContext.Provider></AppCtxContext.Provider>;
  return { ...f, studio, site, head, end, exp, provider, helper, active, group, wrap };
}

it("updates both real filter instances from native CSS/token fields and keeps hide/add/remove commands", async () => {
  const f = await setup(), mounted = render(f.wrap(<><section data-testid="filter"><FilterEffectSection expsProvider={f.provider} /></section><section data-testid="backdrop"><BackdropFilterEffectSection expsProvider={f.provider} /></section></>));
  expect(screen.getAllByText("Shadow paint")).toHaveLength(2);
  await act(async () => { await f.studio.changeUnsafe(() => { f.head.name = "Renamed paint"; f.end.value = "#ABCDEF"; }); });
  expect(screen.getAllByText("Renamed paint")).toHaveLength(2);
  expect(mounted.container.querySelectorAll('[style*="rgb(171, 205, 239)"]').length).toBe(2);
  const filter = screen.getByTestId("filter"), row = ensure(filter.querySelector(".list-box-item"), "Filter row");
  const hide = ensure([...row.querySelectorAll("button")].find((button) => !button.closest(".list-box-item__actions")), "Original hide command");
  fireEvent.click(hide); await waitFor(() => expect(f.exp.getRaw("filter")).toContain("hidden#drop-shadow"));
  expect(f.exp.getRaw("backdrop-filter")).not.toContain("hidden#");
  fireEvent.click(within(filter).getByRole("button", { name: "Remove" }));
  await waitFor(() => expect(f.exp.getRaw("filter")).toBe("none"));
  fireEvent.click(ensure(filter.querySelector(".icon-link-btn"), "Original add command"));
  await waitFor(() => expect(f.exp.getRaw("filter")).toBe("blur(0px)"));
  expect(screen.getByText("Filter", { selector: ".panel-popup-title *" })).toBeTruthy();
  mounted.unmount();
});

it("keeps the resolved shadow swatch current and adds, edits and removes shadows in place", async () => {
  const f = await setup();
  const duplicate = new StyleToken({ uuid: f.end.uuid, name: "Last terminal", type: "Color", value: "#FEDCBA", variantedValues: [], isRegistered: false, regKey: null });
  await f.studio.changeUnsafe(() => { f.site.styleTokens.push(duplicate); });
  render(f.wrap(<ShadowsPanelSection expsProvider={f.provider} vsh={f.helper} />));

  expect(screen.queryByRole("button", { name: "More actions" })).toBeNull();
  const initial = screen.getByRole("button", { name: /^Shadow: Outset, Shadow paint/ });
  const swatch = ensure(initial.querySelector<HTMLElement>("[style]"), "Shadow preview");
  expect(swatch.style.backgroundColor).toBe("rgb(18, 52, 86)");
  expect(swatch.style.boxShadow).toContain("#FEDCBA");
  await act(async () => {
    await f.studio.changeUnsafe(() => {
      f.head.name = "Renamed shadow";
      f.end.value = "#223344";
      duplicate.value = "#AABBCC";
      f.exp.set("box-shadow", `1px 6px 18px 2px ${mkTokenRef(f.head)}`);
    });
  });
  const original = screen.getByRole("button", { name: /^Shadow: Outset, Renamed shadow/ });
  expect(original.textContent).toContain("1px · 6px · 18px · 2px");
  expect(swatch.style.backgroundColor).toBe("rgb(34, 51, 68)");
  expect(swatch.style.boxShadow).toBe("1px 6px 18px 2px #AABBCC");

  fireEvent.click(original);
  const editor = await screen.findByRole("dialog", { name: "Shadow" });
  expect(editor.closest(".ant-popover")).toBeTruthy();
  expect(document.querySelector("#sidebar-modal")).toBeNull();
  fireEvent.click(within(editor).getByRole("button", { name: "Inset" }));
  const updated = await screen.findByRole("button", { name: /^Shadow: Inset, Renamed shadow/ });
  expect(f.exp.get("box-shadow")).toContain(`inset 1px 6px 18px 2px ${mkTokenRef(f.head)}`);
  expect(screen.getByRole("dialog", { name: "Shadow" })).toBe(editor);
  fireEvent.keyDown(editor, { key: "Escape" });
  expect(document.activeElement).toBe(updated);
  fireEvent.contextMenu(screen.getByText("Shadows"));
  const clear = await screen.findByRole("menuitem", { name: "Remove all Shadows styles" });
  fireEvent.keyDown(clear, { key: "Escape" });

  fireEvent.click(screen.getByRole("button", { name: "Add shadow" }));
  const added = await screen.findByRole("button", { name: /^Shadow: Outset,/ });
  expect(added.getAttribute("aria-expanded")).toBe("true");
  expect(await screen.findByRole("dialog", { name: "Shadow" })).toBeTruthy();
  expect(document.querySelector("#sidebar-modal")).toBeNull();
  expect(parseCss(f.exp.get("box-shadow"), { startRule: "boxShadows" }).shadows).toHaveLength(2);

  const [removeOriginal, removeAdded] = screen.getAllByRole("button", { name: "Remove" });
  fireEvent.click(removeAdded);
  await waitFor(() => expect(parseCss(f.exp.get("box-shadow"), { startRule: "boxShadows" }).shadows).toHaveLength(1));
  expect(f.exp.get("box-shadow")).toContain(mkTokenRef(f.head));
  fireEvent.click(removeOriginal);
  await waitFor(() => expect(f.exp.get("box-shadow")).toBe("none"));
  fireEvent.click(screen.getByText("Shadows"));
  await act(async () => { await f.studio.awaitEval(); });
  expect(f.exp.get("box-shadow")).toBe("none");
  expect(screen.queryByRole("dialog", { name: "Shadow" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Add shadow" }));
  expect(await screen.findByRole("dialog", { name: "Shadow" })).toBeTruthy();
});
it("unmounts actual open edit scopes before model-world replacement and allows a fresh provider", async () => {
  const f = await setup(true);
  const content = () => f.wrap(<><FilterEffectSection expsProvider={f.provider} /><ShadowsPanelSection expsProvider={f.provider} vsh={f.helper} /></>);
  const mounted = render(content());
  fireEvent.click(screen.getAllByText("Shadow paint")[0]);
  await waitFor(() => expect(document.querySelector(".panel-content")).not.toBeNull());
  fireEvent.click(screen.getByRole("button", { name: /^Shadow: Outset, Shadow paint/ }));
  expect(await screen.findByRole("button", { name: "Inset" })).toBeTruthy();
  const release = mock<PkgVersionInfoMeta>({ id: "shadow-world", pkgId: "shadow-pkg", version: "1.0.0", branchId: null });
  f.api.getPkgVersion.mockResolvedValueOnce({ pkg: { ...release, model: f.studio.bundleSite().site }, depPkgs: [], etag: "shadow-etag" });
  await act(async () => { await f.studio["loadVersion"](release, true); });
  expect(screen.queryByText("Shadow paint")).toBeNull();
  const declared = vi.spyOn(f.studio.modelSnapshots, "declaredField");
  mounted.rerender(content());
  expect(declared.mock.calls.some(([model]) => model === f.head || model === f.end || model === f.active || model === f.group)).toBe(false);
  expect(document.querySelector(".panel-content")).toBeNull();
  expect(screen.queryByRole("button", { name: "Inset" })).toBeNull();
  const rs = ensure(f.studio.site.activeTheme, "New theme").defaultStyle.rs, exp = new RuleSetHelpers(rs, "div");
  const provider = new SingleRsExpsProvider(rs, exp, f.studio, [], { kind: "ruleSet", rs, forTag: "div" });
  mounted.rerender(f.wrap(<FilterEffectSection expsProvider={provider} />));
  expect(screen.getByText("Shadow paint")).toBeTruthy();
  mounted.unmount();
});

it.each([
  ["Shadows", "box-shadow", ShadowsPanelSection],
  ["Filter Effect", "filter", FilterEffectSection],
  ["Backdrop Effect", "backdrop-filter", BackdropFilterEffectSection],
  ["Transform", "transform", TransformPanelSection],
] as const)("distinguishes none from default for %s and preserves unrelated styles", async (label, prop, Section) => {
  const f = await setup();
  await f.studio.changeUnsafe(() => {
    f.exp.set("opacity", "0.5");
    if (prop === "transform") { f.exp.set("transform", "translateX(10px)"); }
  });
  render(f.wrap(<Section expsProvider={f.provider} />));
  fireEvent.click(screen.getByRole("button", { name: `${label}: Custom` }));
  fireEvent.click(await screen.findByRole("menuitem", { name: "None" }));
  await screen.findByRole("button", { name: `${label}: None` });
  expect(f.exp.getRaw(prop)).toBe("none");
  expect(f.exp.getRaw("opacity")).toBe("0.5");
  fireEvent.click(screen.getByRole("button", { name: `${label}: None` }));
  fireEvent.click(await screen.findByRole("menuitem", { name: "Restore default" }));
  await screen.findByRole("button", { name: `${label}: Default` });
  expect(f.exp.has(prop)).toBe(false);
  expect(f.exp.getRaw("opacity")).toBe("0.5");
});
