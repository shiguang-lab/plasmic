import "@/wab/client/components/sidebar/MixinControls";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { FontFamilySelector } from "@/wab/client/components/widgets/FontFamilySelector";
import { FontFamilyTokenEditModal } from "@/wab/client/components/sidebar/FontFamilyTokenEditModal";
import { LabeledFontFamilySelector } from "@/wab/client/components/sidebar/sidebar-helpers";
import { SidebarModalProvider } from "@/wab/client/components/sidebar/SidebarModal";
import { SingleRsExpsProvider, StyleTarget, StyleTargetContext } from "@/wab/client/components/style-controls/StyleComponent";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { FontFamilyTokenInputs } from "@/wab/client/studio-ctx/font-family-token-inputs";
import { derefToken, mkStyleToken, mkTokenRef } from "@/wab/commons/StyleToken";
import { RuleSetHelpers } from "@/wab/shared/RuleSetHelpers";
import type { PkgVersionInfoMeta } from "@/wab/shared/SharedApi";
import { TplMgr } from "@/wab/shared/TplMgr";
import { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import { ensure, spawn } from "@/wab/shared/common";
import { siteFinalStyleTokensOfType } from "@/wab/shared/core/site-style-tokens";
import { createSite } from "@/wab/shared/core/sites";
import { MutableToken, OverrideableToken } from "@/wab/shared/core/tokens";
import { ProjectDependency, StyleToken, VariantedValue } from "@/wab/shared/model/classes";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import * as React from "react";
import { mock } from "vitest-mock-extended";

const studios = new Set<StudioCtx>();
beforeEach(() => vi.stubGlobal("IntersectionObserver", class { observe() { return undefined; } unobserve() { return undefined; } disconnect() { return undefined; } }));
afterEach(async () => { cleanup(); for (const studio of studios) { await studio.awaitEval(); studio.dispose(); } studios.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function setup(nonbase = false) {
  const site = createSite(), first = mkStyleToken({ name: "First family", type: "FontFamily", value: "Inter" }), second = mkStyleToken({ name: "Second family", type: "FontFamily", value: "Roboto" });
  const unrelated = mkStyleToken({ name: "Unrelated spacing", type: "Spacing", value: "8px" });
  site.styleTokens.push(first, second, unrelated);
  const manager = new TplMgr({ site }), group = nonbase ? manager.createGlobalVariantGroup("FontTheme") : undefined;
  const dark = group ? manager.createGlobalVariant(group, "Dark") : undefined;
  const rs = ensure(site.activeTheme, "Font theme").defaultStyle.rs, exp = new RuleSetHelpers(rs, "div"); exp.set("font-family", mkTokenRef(first));
  const f = fakeStudioCtx({ site }); studios.add(f.studioCtx);
  await waitFor(() => expect(f.studioCtx.initialRouteReady).toBe(true));
  const studio = f.studioCtx, helper = new VariantedStylesHelper(site, dark ? [dark] : undefined, dark ? [dark] : undefined);
  const provider = new SingleRsExpsProvider(rs, exp, studio, [], { kind: "ruleSet", rs, forTag: "div" }), sc = new StyleTarget({ expsProvider: provider });
  const wrap = (children: React.ReactNode) => <AppCtxContext.Provider value={f.appCtx}><StudioCtxContext.Provider value={studio}><StyleTargetContext.Provider value={sc}><SidebarModalProvider containerSelector="#font-test-sidebar"><div id="font-test-sidebar" />{children}</SidebarModalProvider></StyleTargetContext.Provider></StudioCtxContext.Provider></AppCtxContext.Provider>;
  return { ...f, studio, site, first, second, unrelated, group, dark, helper, exp, provider, wrap };
}
function original(f: Awaited<ReturnType<typeof setup>>) {
  const tokens = siteFinalStyleTokensOfType(f.site, "FontFamily", { includeDeps: "direct" });
  return tokens.map((token) => derefToken(tokens, token, f.helper));
}

it("retains each actual FinalToken start for duplicate UUIDs and original cycle results", async () => {
  const f = await setup();
  const duplicate = new StyleToken({ uuid: f.first.uuid, name: "Duplicate family", type: "FontFamily", value: "Helvetica", variantedValues: [], isRegistered: false, regKey: null });
  await f.studio.changeUnsafe(() => f.site.styleTokens.push(duplicate));
  const source = new FontFamilyTokenInputs(f.studio, f.helper), stop = source.subscribe(() => undefined);
  expect(source.getSnapshot().choices.map((row) => row.resolvedValue)).toEqual(["Inter", "Roboto", "Helvetica"]);
  expect(source.getSnapshot().choices[0]?.ref).not.toBe(source.getSnapshot().choices[2]?.ref);
  await f.studio.changeUnsafe(() => { f.first.value = mkTokenRef(f.second); f.second.value = mkTokenRef(f.first); });
  expect(source.getSnapshot().choices.map((row) => row.resolvedValue)).toEqual(original(f));
  await f.studio.changeUnsafe(() => { f.first.value = "var(--token-font-unavailable)"; });
  expect(() => source.getSnapshot()).toThrow("Expected to be a token ref");
  await f.studio.changeUnsafe(() => { f.first.value = "Inter"; f.second.value = "Roboto"; });
  expect(source.getSnapshot().choices.map((row) => row.resolvedValue)).toEqual(original(f));
  stop();
});

it("installs the complete alias result before public fields, catches render-to-commit edits and ignores other token values", async () => {
  const f = await setup(); await f.studio.changeUnsafe(() => { f.first.value = mkTokenRef(f.second); });
  const source = new FontFamilyTokenInputs(f.studio, f.helper), prepared = vi.spyOn(f.studio.modelSnapshots, "subscribePreparedField");
  source.getSnapshot(); expect(prepared).not.toHaveBeenCalled();
  await f.studio.changeUnsafe(() => { f.second.value = "Georgia"; });
  const first = vi.fn(() => expect(source.getSnapshot().choices.map((row) => row.resolvedValue)).toEqual(["Verdana", "Verdana"]));
  const stopFirst = f.studio.modelSnapshots.field(f.second, "value").subscribe(first), stop = source.subscribe(() => undefined);
  expect(source.getSnapshot().choices[0]?.resolvedValue).toBe("Georgia");
  await f.studio.changeUnsafe(() => { f.second.value = "Verdana"; f.first.name = "Renamed alias"; });
  expect(first).toHaveBeenCalledOnce(); expect(source.getSnapshot().choices[0]?.name).toBe("Renamed alias");
  const snapshot = source.getSnapshot(), changed = vi.fn(), stopChanged = source.subscribe(changed);
  await f.studio.changeUnsafe(() => { f.unrelated.value = "24px"; f.unrelated.name = "Still unrelated"; });
  expect(source.getSnapshot()).toBe(snapshot); expect(changed).not.toHaveBeenCalled();
  stopChanged(); stop(); stopFirst();
});

it("keeps root/direct membership, original order, immutable type replacement and registered CSS variables", async () => {
  const f = await setup(), dependencySite = createSite(), nestedSite = createSite();
  const imported = mkStyleToken({ name: "Direct family", type: "FontFamily", value: "Georgia" }), nested = mkStyleToken({ name: "Nested family", type: "FontFamily", value: "Verdana" });
  dependencySite.styleTokens.push(imported); nestedSite.styleTokens.push(nested);
  const nestedDep = new ProjectDependency({ uuid: "font-nested", pkgId: "font-nested-pkg", projectId: "font-nested-project", version: "1.0.0", name: "Nested", site: nestedSite }); dependencySite.projectDependencies.push(nestedDep);
  const dep = new ProjectDependency({ uuid: "font-direct", pkgId: "font-direct-pkg", projectId: "font-direct-project", version: "1.0.0", name: "Direct", site: dependencySite });
  f.appCtx.bundler.bundle(dep, "font-dependency-version", f.appCtx.lastBundleVersion);
  const registered = new StyleToken({ uuid: "registered-font", name: "Registered family", type: "FontFamily", value: "var(--RegisteredFontFamily)", variantedValues: [], isRegistered: true, regKey: "registered-family" });
  await f.studio.changeUnsafe(() => { f.site.projectDependencies.push(dep); f.site.styleTokens.push(registered); });
  const source = new FontFamilyTokenInputs(f.studio, f.helper), stop = source.subscribe(() => undefined);
  expect(source.getSnapshot().choices.map((row) => row.name)).toEqual(["First family", "Second family", "Registered family", "Direct family"]);
  expect(source.getSnapshot().choices[2]?.resolvedValue).toBe("var(--RegisteredFontFamily)");
  const retained = source.getSnapshot().choices.find((row) => row.uuid === f.second.uuid);
  const replacement = new StyleToken({ uuid: f.first.uuid, name: "No longer a family", type: "Spacing", value: "18px", variantedValues: [], isRegistered: false, regKey: null });
  await f.studio.changeUnsafe(() => { f.site.styleTokens.splice(f.site.styleTokens.indexOf(f.first), 1, replacement); f.site.styleTokens.reverse(); });
  expect(source.getSnapshot().choices.map((row) => row.name)).toEqual(["Registered family", "Second family", "Direct family"]);
  expect(source.getSnapshot().choices.find((row) => row.uuid === f.second.uuid)).toBe(retained);
  stop();
});

it("reuses imported VSH name fallback and real root override commands", async () => {
  const f = await setup(true), dependencySite = createSite(), manager = new TplMgr({ site: dependencySite });
  const group = manager.createGlobalVariantGroup("FontTheme"), dark = manager.createGlobalVariant(group, "Dark");
  const imported = mkStyleToken({ name: "Variant family", type: "FontFamily", value: "Inter" }); imported.variantedValues.push(new VariantedValue({ variants: [dark], value: "Roboto" })); dependencySite.styleTokens.push(imported);
  const dep = new ProjectDependency({ uuid: "font-variant-dep", pkgId: "font-variant-pkg", projectId: "font-variant-project", version: "1.0.0", name: "Variant fonts", site: dependencySite });
  f.appCtx.bundler.bundle(dep, "font-variant-version", f.appCtx.lastBundleVersion);
  await f.studio.changeUnsafe(() => { f.site.projectDependencies.push(dep); f.first.value = mkTokenRef(imported); });
  const source = new FontFamilyTokenInputs(f.studio, f.helper), stop = source.subscribe(() => undefined);
  expect(source.getSnapshot().choices[0]?.resolvedValue).toBe("Roboto");
  await f.studio.changeUnsafe(() => { ensure(f.group, "Local font group").param.variable.name = "DifferentFontTheme"; });
  expect(source.getSnapshot().choices.map((row) => row.resolvedValue)).toEqual(original(f));
  expect(source.getSnapshot().choices[0]?.resolvedValue).toBe("Inter");
  const override = new OverrideableToken(imported, f.site);
  await f.studio.changeUnsafe(() => { f.helper.updateToken(override, "Georgia"); });
  expect(source.getSnapshot().choices[0]?.resolvedValue).toBe("Georgia"); expect(imported.value).toBe("Inter");
  stop();
});

it("uses real native CSS, font-registry updates and original select commands in the labeled control", async () => {
  const f = await setup();
  const change = vi.fn((value: string) => spawn(f.studio.changeUnsafe(() => f.exp.set("font-family", value))));
  const mounted = render(f.wrap(<LabeledFontFamilySelector label="Font" styleName="font-family" selectOpts={{ onChange: change, vsh: f.helper }} data-test-id="native-family" />));
  const root = ensure(mounted.container.querySelector<HTMLElement>('[data-test-id="native-family"]'), "Original font selector");
  expect(root.textContent).toContain("First family");
  await act(async () => { await f.studio.changeUnsafe(() => { f.exp.set("font-family", mkTokenRef(f.second)); f.second.name = "Renamed family"; f.site.userManagedFonts.push("var(--NativePickerFont)"); }); });
  expect(root.textContent).toContain("Renamed family");
  fireEvent.mouseDown(within(root).getByRole("combobox"));
  expect(await screen.findByText("NativePickerFont")).toBeTruthy();
  fireEvent.click(ensure(screen.getAllByText("First family").find((element) => element.closest(".ant-select-item-option"))?.closest(".ant-select-item-option"), "Original family option"));
  await waitFor(() => expect(f.exp.get("font-family")).toBe(mkTokenRef(f.first)));
  expect(change).toHaveBeenCalledWith(mkTokenRef(f.first));
  mounted.unmount();
});

it("keeps the actual font-token modal's value and loadFont commands", async () => {
  const f = await setup(); await f.studio.changeUnsafe(() => f.site.userManagedFonts.push("var(--ModalFontFamily)"));
  const loadFont = vi.spyOn(f.studio.fontManager, "loadFont").mockImplementation(() => undefined);
  const mounted = render(f.wrap(<FontFamilyTokenEditModal studioCtx={f.studio} token={new MutableToken(f.first)} vsh={f.helper} onClose={() => undefined} />));
  fireEvent.mouseDown(screen.getByRole("combobox"));
  fireEvent.click(ensure((await screen.findByText("ModalFontFamily")).closest(".ant-select-item-option"), "Original custom font option"));
  await waitFor(() => expect(f.first.value).toBe("var(--ModalFontFamily)"));
  expect(loadFont).toHaveBeenCalledWith(f.studio, "var(--ModalFontFamily)");
  mounted.unmount();
});

it("does not connect model or commit leases from an abandoned suspended font selector", async () => {
  const f = await setup(), fields = vi.spyOn(f.studio.modelSnapshots, "subscribePreparedField"), commits = vi.spyOn(f.studio, "subscribeModelChanges");
  const promise = new Promise<never>(() => undefined);
  function Suspend(): React.ReactNode { throw promise; }
  const mounted = render(f.wrap(<React.Suspense fallback={<span>Waiting fonts</span>}><FontFamilySelector studioCtx={f.studio} selectOpts={{ value: "Inter", onChange: () => undefined }} /><Suspend /></React.Suspense>));
  expect(screen.getByText("Waiting fonts")).toBeTruthy(); expect(fields).not.toHaveBeenCalled(); expect(commits).not.toHaveBeenCalled();
  mounted.unmount(); expect(fields).not.toHaveBeenCalled(); expect(commits).not.toHaveBeenCalled();
});

it("seals known active helpers on real world replacement, admits new helpers and rejects foreign variants before fields", async () => {
  const f = await setup(true), source = new FontFamilyTokenInputs(f.studio, f.helper), before = source.getSnapshot(), stop = source.subscribe(() => undefined);
  const content = () => f.wrap(<FontFamilySelector studioCtx={f.studio} selectOpts={{ value: mkTokenRef(f.first), onChange: () => undefined, vsh: f.helper }} />);
  const mounted = render(content()), release = mock<PkgVersionInfoMeta>({ id: "font-world", pkgId: "font-pkg", version: "1.0.0", branchId: null });
  f.api.getPkgVersion.mockResolvedValueOnce({ pkg: { ...release, model: f.studio.bundleSite().site }, depPkgs: [], etag: "font-etag" });
  await act(async () => { await f.studio["loadVersion"](release, true); });
  expect(source.getSnapshot().active).toBe(false); expect(source.getSnapshot().choices).toBe(before.choices);
  const fields = vi.spyOn(f.studio.modelSnapshots, "declaredField"); mounted.rerender(content());
  expect(fields).not.toHaveBeenCalled(); expect(screen.queryByRole("combobox")).toBeNull();
  const foreign = new VariantedStylesHelper(f.studio.site, [ensure(f.dark, "Old dark")]);
  expect(() => new FontFamilyTokenInputs(f.studio, foreign)).toThrow("another model world"); expect(fields).not.toHaveBeenCalled();
  const currentGroup = ensure(f.studio.site.globalVariantGroups.find((group) => group.uuid === f.group?.uuid), "Current font group"), currentDark = ensure(currentGroup.variants[0], "Current dark");
  const current = new VariantedStylesHelper(f.studio.site, [currentDark]);
  mounted.rerender(f.wrap(<FontFamilySelector studioCtx={f.studio} selectOpts={{ value: "Inter", onChange: () => undefined, vsh: current }} />));
  expect(screen.getByRole("combobox")).toBeTruthy();
  expect(fields.mock.calls.some(([model]) => model === f.first || model === f.second || model === f.dark || model === f.group)).toBe(false);
  mounted.unmount(); stop();
});

it("releases every real lease if a valid render becomes a missing alias before subscription", async () => {
  const f = await setup(), source = new FontFamilyTokenInputs(f.studio, f.helper);
  source.getSnapshot();
  await f.studio.changeUnsafe(() => { f.first.value = "var(--token-missing-before-commit)"; });
  const active = new Set<() => void>(), originalSubscribe = f.studio.modelSnapshots.subscribePreparedField.bind(f.studio.modelSnapshots);
  vi.spyOn(f.studio.modelSnapshots, "subscribePreparedField").mockImplementation((field, listener) => {
    const stop = originalSubscribe(field, listener);
    const release = () => { stop(); active.delete(release); };
    active.add(release); return release;
  });
  expect(() => source.subscribe(() => undefined)).toThrow("Expected to be a token ref");
  expect(active.size).toBe(0);
});

it("publishes a closed selector's current alias after an earlier subscriber reads the prepared value", async () => {
  const f = await setup();
  await f.studio.changeUnsafe(() => { f.first.value = mkTokenRef(f.second); });
  const source = new FontFamilyTokenInputs(f.studio, f.helper, false, mkTokenRef(f.first));
  const early = f.studio.modelSnapshots.field(f.second, "value").subscribe(() => {
    expect(source.getSnapshot().choices[0]?.resolvedValue).toBe("Georgia");
  });
  const changed = vi.fn(), stop = source.subscribe(changed); changed.mockClear();
  try {
    expect(source.getSnapshot().choices).toHaveLength(1);
    await f.studio.changeUnsafe(() => { f.second.value = "Georgia"; });
    expect(changed).toHaveBeenCalled();
    expect(source.getSnapshot().choices[0]).toMatchObject({ name: "First family", resolvedValue: "Georgia" });
  } finally { stop(); early(); }
});
