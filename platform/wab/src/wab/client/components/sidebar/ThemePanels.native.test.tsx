import { AppContext } from "@/wab/client/components/top-view";
import "@/wab/client/components/sidebar/MixinControls";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import ThemeLayoutPanel from "@/wab/client/components/sidebar/ThemeLayoutPanel";
import ThemeInitialStylesPanel from "@/wab/client/components/sidebar/ThemeInitialStylesPanel";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { RuleSetHelpers } from "@/wab/shared/RuleSetHelpers";
import type { PkgVersionInfoMeta } from "@/wab/shared/SharedApi";
import { AddItemKey } from "@/wab/shared/add-item-keys";
import { ensure } from "@/wab/shared/common";
import { createSite } from "@/wab/shared/core/sites";
import { cloneTheme } from "@/wab/shared/core/styles";
import { CONTENT_LAYOUT_STANDARD_WIDTH_PROP } from "@/wab/shared/core/style-props";
import { RuleSet, ThemeLayoutSettings } from "@/wab/shared/model/classes";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import * as React from "react";
import { mock } from "vitest-mock-extended";

const studios = new Set<StudioCtx>();
afterEach(async () => { cleanup(); for (const studio of studios) { await studio.awaitEval(); studio.dispose(); } studios.clear(); vi.restoreAllMocks(); });
async function setup() {
  const site = createSite(), theme = ensure(site.activeTheme, "Theme"), rs = new RuleSet({ values: { [CONTENT_LAYOUT_STANDARD_WIDTH_PROP]: "901px" }, mixins: [], animations: null });
  theme.layout = new ThemeLayoutSettings({ rs }); theme.addItemPrefs[AddItemKey.box] = new RuleSet({ values: { width: "123px" }, mixins: [], animations: null });
  const second = cloneTheme(theme); ensure(second.layout, "Second layout").rs.values[CONTENT_LAYOUT_STANDARD_WIDTH_PROP] = "1101px"; ensure(second.addItemPrefs[AddItemKey.box], "Second box").values.width = "456px"; site.themes.push(second);
  const f = fakeStudioCtx({ site }); studios.add(f.studioCtx); await waitFor(() => expect(f.studioCtx.initialRouteReady).toBe(true));
  return { ...f, studio: f.studioCtx, site, theme, second, rs, wrap: (children: React.ReactNode) => <AppContext.Provider value={f.studioCtx.app}><StudioCtxContext.Provider value={f.studioCtx}>{children}</StudioCtxContext.Provider></AppContext.Provider> };
}
function dimension(container: HTMLElement, value: string) { return ensure([...container.querySelectorAll<HTMLInputElement>("input")].find((input) => input.value === value), `Real dimension ${value}`); }

it("updates actual document-layout fields, replaces layout/RS and keeps the real edit command", async () => {
  const f = await setup(), mounted = render(f.wrap(<ThemeLayoutPanel />));
  expect(dimension(mounted.container, "901px")).toBeTruthy();
  await act(async () => { await f.studio.changeUnsafe(() => { f.rs.values[CONTENT_LAYOUT_STANDARD_WIDTH_PROP] = "902px"; }); }); expect(dimension(mounted.container, "902px")).toBeTruthy();
  const replacement = new RuleSet({ values: { [CONTENT_LAYOUT_STANDARD_WIDTH_PROP]: "903px" }, mixins: [], animations: null });
  await act(async () => { await f.studio.changeUnsafe(() => { ensure(f.theme.layout, "Layout").rs = replacement; }); });
  const input = dimension(mounted.container, "903px");
  await act(async () => { fireEvent.change(input, { target: { value: "904px" } }); fireEvent.blur(input); }); await waitFor(() => expect(new RuleSetHelpers(replacement, "div").get(CONTENT_LAYOUT_STANDARD_WIDTH_PROP)).toBe("904px"));
  await act(async () => { await f.studio.changeUnsafe(() => { f.site.activeTheme = f.second; }); }); expect(dimension(mounted.container, "1101px")).toBeTruthy(); mounted.unmount();
});

it("keeps selected initial element across theme changes and rebinds real model fields on world replacement", async () => {
  const f = await setup(), mounted = render(f.wrap(<ThemeInitialStylesPanel />));
  fireEvent.change(ensure(mounted.container.querySelector("select"), "Original native select input"), { target: { value: AddItemKey.box } });
  expect(dimension(mounted.container, "123px")).toBeTruthy();
  await act(async () => { await f.studio.changeUnsafe(() => { ensure(f.theme.addItemPrefs[AddItemKey.box], "Box prefs").values.width = "124px"; }); }); expect(dimension(mounted.container, "124px")).toBeTruthy();
  await act(async () => { await f.studio.changeUnsafe(() => { f.site.activeTheme = f.second; }); }); expect(dimension(mounted.container, "456px")).toBeTruthy();
  const release = mock<PkgVersionInfoMeta>({ id: "theme-panels-world", pkgId: "theme-panels-pkg", version: "1.0.0", branchId: null });
  f.api.getPkgVersion.mockResolvedValueOnce({ pkg: { ...release, model: f.studio.bundleSite().site }, depPkgs: [], etag: "theme-panels-etag" });
  await act(async () => { await f.studio["loadVersion"](release, true); }); expect(dimension(mounted.container, "456px")).toBeTruthy();
  const fields = vi.spyOn(f.studio.modelSnapshots, "declaredField"); mounted.rerender(f.wrap(<ThemeInitialStylesPanel />)); expect(fields.mock.calls.some(([model]) => model === f.theme || model === f.second)).toBe(false);
  await act(async () => { await f.studio.awaitEval(); f.studio.dispose(); });
  fields.mockClear(); mounted.rerender(f.wrap(<ThemeInitialStylesPanel />)); expect(dimension(mounted.container, "456px")).toBeTruthy(); expect(fields).not.toHaveBeenCalled(); mounted.unmount();
});
