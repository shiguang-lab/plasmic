import "@/wab/client/components/sidebar/MixinControls";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { SpacingControl } from "@/wab/client/components/style-controls/SpacingControl";
import { SingleRsExpsProvider, StyleComponent, StyleComponentContext } from "@/wab/client/components/style-controls/StyleComponent";
import { SidebarModalProvider } from "@/wab/client/components/sidebar/SidebarModal";
import { AppContext } from "@/wab/client/components/top-view";
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
import { standardSides } from "@/wab/shared/geom";
import { VariantedValue } from "@/wab/shared/model/classes";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";

const studios = new Set<StudioCtx>();
beforeEach(() => vi.stubGlobal("IntersectionObserver", class { observe() { return undefined; } unobserve() { return undefined; } disconnect() { return undefined; } }));
afterEach(async () => { cleanup(); for (const studio of studios) { await studio.awaitEval(); studio.dispose(); } studios.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function setup() {
  const site = createSite(), manager = new TplMgr({ site }), group = manager.createGlobalVariantGroup("Spacing theme"), dark = manager.createGlobalVariant(group, "Dark");
  const activeValue = new VariantedValue({ variants: [dark], value: "16px" });
  const end = mkStyleToken({ name: "Gap end", type: "Spacing", value: "8px" }), head = mkStyleToken({ name: "Gap", type: "Spacing", value: mkTokenRef(end) });
  end.variantedValues.push(activeValue); site.styleTokens.push(head, end);
  const rs = ensure(site.activeTheme, "Spacing theme").defaultStyle.rs, exp = new RuleSetHelpers(rs, "div");
  for (const side of standardSides) { exp.set(`padding-${side}`, mkTokenRef(head)); exp.set(`margin-${side}`, "auto"); }
  const f = fakeStudioCtx({ site }); studios.add(f.studioCtx); await waitFor(() => expect(f.studioCtx.initialRouteReady).toBe(true));
  const studio = f.studioCtx, helper = new VariantedStylesHelper(site, [dark]);
  const provider = new SingleRsExpsProvider(rs, exp, studio, [], { kind: "ruleSet", rs, forTag: "div" }), sc = new StyleComponent({ expsProvider: provider });
  const wrap = (children: React.ReactNode) => <AppContext.Provider value={studio.app}><AppCtxContext.Provider value={f.appCtx}><StudioCtxContext.Provider value={studio}><StyleComponentContext.Provider value={sc}><SidebarModalProvider>{children}</SidebarModalProvider></StyleComponentContext.Provider></StudioCtxContext.Provider></AppCtxContext.Provider></AppContext.Provider>;
  return { ...f, studio, site, exp, provider, helper, head, end, activeValue, dark, group, wrap };
}
function spacingInput(container: HTMLElement) { return ensure(container.querySelector<HTMLInputElement>('[data-test-id="Spacing-input"]'), "Original spacing input"); }

it("renders native alias changes and base measurements while preserving the control ref and selected-side commands", async () => {
  const f = await setup(), control = React.createRef<React.ComponentRef<typeof SpacingControl>>();
  const mounted = render(f.wrap(<SpacingControl ref={control} expsProvider={f.provider} spacingStyleProp="padding" vsh={f.helper} />));
  const input = spacingInput(mounted.container); fireEvent.focus(input);
  await waitFor(() => expect(document.querySelectorAll(".spacing-control__num")).toHaveLength(4));
  expect([...document.querySelectorAll(".spacing-control__num")].map((element) => element.textContent)).toEqual(["8px", "8px", "8px", "8px"]);
  await act(async () => { await f.studio.changeUnsafe(() => { f.end.value = "12px"; f.activeValue.value = "24px"; }); });
  expect([...document.querySelectorAll(".spacing-control__num")].map((element) => element.textContent)).toEqual(["12px", "12px", "12px", "12px"]);
  const retained = ensure(control.current, "Original class ref");
  const top = ensure(document.querySelector(".spacing-control__handle.ns-resize"), "Native draggable top side");
  fireEvent.click(top, { detail: 1 });
  await act(async () => { retained.setAllSelected("31px"); });
  await waitFor(() => expect(f.exp.get("padding-top")).toBe("31px"));
  expect(f.exp.get("padding-right")).toBe(mkTokenRef(f.head)); expect(control.current).toBe(retained);
  await act(async () => { retained.clearAllSelected(); });
  await waitFor(() => expect(f.exp.has("padding-top")).toBe(false));
  mounted.unmount(); expect(control.current).toBeNull();
});

it("drags from the active variant token value and preserves auto margin display", async () => {
  const f = await setup();
  const mounted = render(f.wrap(<><section data-testid="padding"><SpacingControl expsProvider={f.provider} spacingStyleProp="padding" vsh={f.helper} /></section><section data-testid="margin"><SpacingControl expsProvider={f.provider} spacingStyleProp="margin" allowAuto vsh={f.helper} /></section></>));
  expect(spacingInput(screen.getByTestId("margin")).value).toBe("auto");
  fireEvent.focus(spacingInput(screen.getByTestId("padding")));
  await waitFor(() => expect(document.querySelector(".spacing-control__handle.ns-resize")).not.toBeNull());
  await act(async () => { await f.studio.changeUnsafe(() => { f.activeValue.value = "24px"; }); });
  const top = ensure(document.querySelector(".spacing-control__handle.ns-resize"), "Top drag handle");
  fireEvent.mouseDown(top, { button: 0, clientX: 0, clientY: 0 });
  fireEvent.mouseMove(document, { buttons: 1, clientX: 0, clientY: 5 });
  fireEvent.mouseMove(document, { buttons: 1, clientX: 0, clientY: 10 });
  fireEvent.mouseUp(document, { button: 0, clientX: 0, clientY: 10 });
  await waitFor(() => expect(f.exp.get("padding-top")).toBe("34px"));
  expect(f.exp.get("padding-bottom")).toBe(mkTokenRef(f.head));
  expect(f.exp.get("margin-top")).toBe("auto");
  mounted.unmount();
});

it("releases the real open popover on model-world replacement without declaring old token or variant fields", async () => {
  const f = await setup(), control = React.createRef<React.ComponentRef<typeof SpacingControl>>();
  const content = () => f.wrap(<SpacingControl ref={control} expsProvider={f.provider} spacingStyleProp="padding" vsh={f.helper} />);
  const mounted = render(content()); fireEvent.focus(spacingInput(mounted.container));
  await waitFor(() => expect(document.querySelector(".spacing-control__svg")).not.toBeNull());
  const release = mock<PkgVersionInfoMeta>({ id: "spacing-world", pkgId: "spacing-pkg", version: "1.0.0", branchId: null });
  f.api.getPkgVersion.mockResolvedValueOnce({ pkg: { ...release, model: f.studio.bundleSite().site }, depPkgs: [], etag: "spacing-etag" });
  await act(async () => { await f.studio["loadVersion"](release, true); });
  expect(control.current).toBeNull(); expect(document.querySelector(".spacing-control__svg")).toBeNull();
  const declared = vi.spyOn(f.studio.modelSnapshots, "declaredField"); mounted.rerender(content());
  expect(declared.mock.calls.some(([model]) => model === f.head || model === f.end || model === f.dark || model === f.group)).toBe(false);
  mounted.unmount();
  const remounted = render(content());
  expect(control.current).toBeNull();
  expect(declared.mock.calls.some(([model]) => model === f.head || model === f.end || model === f.dark || model === f.group)).toBe(false);
  remounted.unmount();
});
