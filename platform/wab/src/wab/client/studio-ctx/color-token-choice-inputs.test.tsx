import "@/wab/client/components/sidebar/MixinControls";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { SidebarModalProvider } from "@/wab/client/components/sidebar/SidebarModal";
import { ColorPicker } from "@/wab/client/components/widgets/ColorPicker/ColorPicker";
import { useClientTokenValues } from "@/wab/client/components/widgets/ColorPicker/client-token-resolver";
import { ColorTokenSelector } from "@/wab/client/components/widgets/ColorTokenSelector";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { ColorTokenChoiceInputs, useColorTokenChoiceInputs } from "@/wab/client/studio-ctx/color-token-choice-inputs";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { mkStyleToken, mkTokenRef, resolveToken } from "@/wab/commons/StyleToken";
import type { PkgVersionInfoMeta } from "@/wab/shared/SharedApi";
import { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import { ensure } from "@/wab/shared/common";
import { createSite } from "@/wab/shared/core/sites";
import { siteFinalStyleTokensAllDeps } from "@/wab/shared/core/site-style-tokens";
import { MutableToken, OverrideableToken } from "@/wab/shared/core/tokens";
import { ProjectDependency, StyleToken } from "@/wab/shared/model/classes";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import * as React from "react";
import { mock } from "vitest-mock-extended";

const studios = new Set<StudioCtx>();
beforeEach(() => vi.stubGlobal("IntersectionObserver", class { observe() { return undefined; } unobserve() { return undefined; } disconnect() { return undefined; } }));
afterEach(async () => { cleanup(); document.documentElement.style.removeProperty("--palette-native"); for (const studio of studios) { await studio.awaitEval(); studio.dispose(); } studios.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function setup() {
  const site = createSite(), first = mkStyleToken({ name: "First color", type: "Color", value: "#112233" }), second = mkStyleToken({ name: "Second color", type: "Color", value: "#445566" }), space = mkStyleToken({ name: "Space", type: "Spacing", value: "12px" });
  site.styleTokens.push(first, second, space);
  const f = fakeStudioCtx({ site }); studios.add(f.studioCtx);
  await waitFor(() => expect(f.studioCtx.initialRouteReady).toBe(true));
  const studio = f.studioCtx, helper = new VariantedStylesHelper(site);
  const wrap = (children: React.ReactNode) => <StudioCtxContext.Provider value={studio}><div className="app-container"><SidebarModalProvider>{children}</SidebarModalProvider></div></StudioCtxContext.Provider>;
  return { ...f, studio, site, first, second, space, helper, wrap };
}

it("preserves actual duplicate-UUID starts and first all-style aliases, including original cycles", async () => {
  const f = await setup(), duplicate = new StyleToken({ uuid: f.first.uuid, name: "Duplicate start", type: "Color", value: "#778899", variantedValues: [], isRegistered: false, regKey: undefined });
  await f.studio.changeUnsafe(() => f.site.styleTokens.push(duplicate));
  const starts = [new MutableToken(f.first), new MutableToken(duplicate)], source = new ColorTokenChoiceInputs(f.studio, starts, f.helper), stop = source.subscribe(() => undefined);
  expect(source.getSnapshot().choices.map((row) => row.resolved.value)).toEqual(["#112233", "#778899"]);
  const initial = source.getSnapshot().choices;
  expect(initial[0]?.id).not.toBe(initial[1]?.id); expect(source.command(ensure(initial[1], "Duplicate row"))).toBe(starts[1]);
  await f.studio.changeUnsafe(() => { duplicate.value = mkTokenRef(f.second); f.second.value = mkTokenRef(f.first); f.first.value = mkTokenRef(f.second); });
  expect(source.getSnapshot().choices.map((row) => row.resolved.value)).toEqual(starts.map((start) => resolveToken(siteFinalStyleTokensAllDeps(f.site), start, f.helper).value)); stop();
});

it("catches pre-subscribe changes and publishes final finite aliases before public fields without unrelated notifications", async () => {
  const f = await setup(); await f.studio.changeUnsafe(() => { f.first.value = mkTokenRef(f.second); });
  const source = new ColorTokenChoiceInputs(f.studio, [new MutableToken(f.first)], f.helper), prepared = vi.spyOn(f.studio.modelSnapshots, "subscribePreparedField");
  source.getSnapshot(); expect(prepared).not.toHaveBeenCalled();
  await f.studio.changeUnsafe(() => { f.second.value = "#ABCDEF"; });
  const publicListener = vi.fn(() => expect(source.getSnapshot().choices[0]?.resolved.value).toBe("#FEDCBA")), first = f.studio.modelSnapshots.field(f.second, "value").subscribe(publicListener), stop = source.subscribe(() => undefined);
  expect(source.getSnapshot().choices[0]?.resolved.value).toBe("#ABCDEF");
  await f.studio.changeUnsafe(() => { f.second.value = "#FEDCBA"; f.first.name = "Renamed first"; });
  expect(publicListener).toHaveBeenCalledOnce(); expect(source.getSnapshot().choices[0]?.name).toBe("Renamed first");
  const snapshot = source.getSnapshot(), changed = vi.fn(), stopChanged = source.subscribe(changed);
  await f.studio.changeUnsafe(() => { f.space.value = "24px"; }); expect(source.getSnapshot()).toBe(snapshot); expect(changed).not.toHaveBeenCalled();
  stopChanged(); stop(); first();
});

it("keeps imported command identity and actual override writes while removed rows cannot run late commands", async () => {
  const f = await setup(), site = createSite(), imported = mkStyleToken({ name: "Imported color", type: "Color", value: "#123456" }); site.styleTokens.push(imported);
  const dep = new ProjectDependency({ uuid: "palette-dep", pkgId: "palette-pkg", projectId: "palette-project", name: "Palette", version: "1.0.0", site });
  f.appCtx.bundler.bundle(dep, "palette-version", f.appCtx.lastBundleVersion); await f.studio.changeUnsafe(() => f.site.projectDependencies.push(dep));
  const token = new OverrideableToken(imported, f.site), source = new ColorTokenChoiceInputs(f.studio, [token], f.helper), stop = source.subscribe(() => undefined), row = ensure(source.getSnapshot().choices[0], "Imported row");
  expect(source.command(row)).toBe(token); await f.studio.changeUnsafe(() => f.helper.updateToken(ensure(source.command(row), "Original wrapper"), "#998877"));
  expect(source.getSnapshot().choices[0]?.resolved.value).toBe("#998877"); expect(imported.value).toBe("#123456");
  await f.studio.changeUnsafe(() => { f.site.projectDependencies.splice(0, 1); expect(source.command(row)).toBeUndefined(); });
  expect(source.command(row)).toBeUndefined(); stop();
});

it("leaves abandoned leases disconnected and retains terminal rows across real world replacement", async () => {
  const f = await setup(), starts = [new MutableToken(f.first)], prepared = vi.spyOn(f.studio.modelSnapshots, "subscribePreparedField"), pending = new Promise<void>(() => undefined);
  function Suspend(): React.ReactNode { useColorTokenChoiceInputs(f.studio, starts, f.helper); throw pending; }
  const abandoned = render(<React.Suspense fallback={<span>Waiting palette</span>}><Suspend /></React.Suspense>); expect(prepared).not.toHaveBeenCalled(); abandoned.unmount();
  const source = new ColorTokenChoiceInputs(f.studio, starts, f.helper), stop = source.subscribe(() => undefined), before = source.getSnapshot();
  const release = mock<PkgVersionInfoMeta>({ id: "palette-world", pkgId: "palette-world-pkg", version: "1.0.0", branchId: null });
  f.api.getPkgVersion.mockResolvedValueOnce({ pkg: { ...release, model: f.studio.bundleSite().site }, depPkgs: [], etag: "palette-world-etag" });
  await act(async () => { await f.studio["loadVersion"](release, true); });
  const fields = vi.spyOn(f.studio.modelSnapshots, "declaredField"); expect(source.getSnapshot().active).toBe(false); expect(source.getSnapshot().choices).toBe(before.choices); expect(source.command(ensure(before.choices[0], "Old row"))).toBeUndefined();
  const remount = new ColorTokenChoiceInputs(f.studio, starts, new VariantedStylesHelper(f.studio.site)); expect(remount.getSnapshot().active).toBe(false); const late = remount.subscribe(() => undefined); expect(fields).not.toHaveBeenCalled(); late(); stop();
});

it("uses the original registered DOM path and readonly selected rows without losing committed callbacks", async () => {
  vi.stubGlobal("__PlasmicTokenRegistry", [{ name: "palette-native", type: "color", value: "var(--palette-native)" }]);
  const f = await setup(), registered = new StyleToken({ uuid: "palette-registered", name: "Registered color", type: "Color", value: "var(--palette-native)", variantedValues: [], isRegistered: true, regKey: "palette-native" });
  await f.studio.changeUnsafe(() => f.site.styleTokens.push(registered)); document.documentElement.style.setProperty("--palette-native", "#ABCDEF");
  const starts = [new MutableToken(registered)], selected = vi.fn(), next = vi.fn();
  function Selector({ onSelect }: { onSelect: () => void }) { const state = useColorTokenChoiceInputs(f.studio, starts, f.helper), colors = useClientTokenValues(state.snapshot.choices.map((row) => row.resolved), state.lifetime); return <ColorTokenSelector rows={state.snapshot.choices.map((row, index) => ({ id: row.id, name: row.name, color: ensure(colors[index], "DOM color"), selected: true, onSelect }))} onAddToken={() => undefined} />; }
  const mounted = render(f.wrap(<Selector onSelect={selected} />));
  const swatch = ensure(mounted.container.querySelector<HTMLElement>(".SwatchButton"), "Real selected swatch"); expect(swatch.querySelector('[class*="rootisSelected"]')).toBeTruthy();
  expect([...swatch.querySelectorAll<HTMLElement>("[style]")].some((element) => element.style.backgroundColor === "rgb(171, 205, 239)")).toBe(true);
  fireEvent.mouseDown(swatch); expect(selected).toHaveBeenCalledOnce(); mounted.rerender(f.wrap(<Selector onSelect={next} />)); fireEvent.mouseDown(ensure(mounted.container.querySelector(".SwatchButton"), "Current swatch")); expect(next).toHaveBeenCalledOnce(); expect(selected).toHaveBeenCalledOnce(); mounted.unmount();
});

it("keeps the actual picker's select and add commands on original models", async () => {
  const f = await setup(), changed = vi.fn();
  function Picker() { const [color, setColor] = React.useState(mkTokenRef(f.first)); return <ColorPicker color={color} onChange={(next) => { changed(next); setColor(next); }} vsh={f.helper} />; }
  const mounted = render(f.wrap(<Picker />));
  await waitFor(() => expect(mounted.container.querySelectorAll(".SwatchButton")).toHaveLength(1));
  await act(async () => { fireEvent.mouseDown(ensure(mounted.container.querySelector(".SwatchButton"), "Second original token")); }); expect(changed).toHaveBeenLastCalledWith(mkTokenRef(f.second));
  const add = ensure(mounted.container.querySelector(".SwatchItemList")?.previousElementSibling?.querySelector("button"), "Original add token button");
  await act(async () => { fireEvent.click(add); });
  await waitFor(() => expect(f.site.styleTokens.filter((token) => token.type === "Color")).toHaveLength(3));
  const created = ensure(f.site.styleTokens.find((token) => token !== f.first && token !== f.second && token.type === "Color"), "Created color"); expect(created.value).toBe("#445566"); expect(changed).toHaveBeenLastCalledWith(mkTokenRef(created)); mounted.unmount();
});
