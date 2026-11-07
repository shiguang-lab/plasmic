import type { PkgVersionInfoMeta } from "@/wab/shared/SharedApi";
import { mock } from "vitest-mock-extended";
import { ensure } from "@/wab/shared/common";
import "@/wab/client/components/sidebar/MixinControls";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { FontFamilyTokenEditModal } from "@/wab/client/components/sidebar/FontFamilyTokenEditModal";
import { GeneralTokenEditModal } from "@/wab/client/components/sidebar/GeneralTokenEditModal";
import { SidebarModalProvider } from "@/wab/client/components/sidebar/SidebarModal";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { StyleTokenInputs, useStyleTokenInputs } from "@/wab/client/studio-ctx/style-token-inputs";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { mkStyleToken, mkTokenRef } from "@/wab/commons/StyleToken";
import { TplMgr } from "@/wab/shared/TplMgr";
import { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import { createSite } from "@/wab/shared/core/sites";
import { MutableToken, OverrideableToken } from "@/wab/shared/core/tokens";
import { ProjectDependency, StyleToken, VariantedValue } from "@/wab/shared/model/classes";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import * as React from "react";

class VisibleIntersectionObserver {
  readonly root = null;
  readonly rootMargin = "0px";
  readonly scrollMargin = "0px";
  readonly thresholds = [0];
  readonly delay = 0;
  readonly trackVisibility = false;
  constructor(private readonly callback: IntersectionObserverCallback) {}
  observe(target: Element) {
    const entry = mock<IntersectionObserverEntry>({ isIntersecting: true });
    Object.defineProperty(entry, "target", { value: target });
    this.callback([entry], this);
  }
  disconnect() { return undefined; }
  unobserve() { return undefined; }
  takeRecords(): IntersectionObserverEntry[] { return []; }
}
beforeEach(() => vi.stubGlobal("IntersectionObserver", VisibleIntersectionObserver));
const studios = new Set<StudioCtx>();
afterEach(async () => {
  cleanup(); document.documentElement.style.removeProperty("--native-size");
  for (const studio of studios) { await studio.awaitEval(); studio.dispose(); }
  studios.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});
async function setup(value = "12px") {
  const site = createSite();
  const base = mkStyleToken({ name: "Space", type: "Spacing", value });
  const alias = mkStyleToken({ name: "Alias", type: "Spacing", value: mkTokenRef(base) });
  site.styleTokens.push(base, alias);
  const fixture = fakeStudioCtx({ site }); studios.add(fixture.studioCtx);
  await waitFor(() => expect(fixture.studioCtx.initialRouteReady).toBe(true));
  return { ...fixture, studio: fixture.studioCtx, site, base, alias, token: new MutableToken(base) };
}

it("captures only the demanded active value, preserves alias strings, and shares unchanged snapshots", async () => {
  const f = await setup();
  const source = new StyleTokenInputs(f.studio, f.token, new VariantedStylesHelper(f.site));
  const aliases = new StyleTokenInputs(f.studio, new MutableToken(f.alias), new VariantedStylesHelper(f.site));
  const changed = vi.fn(), aliasChanged = vi.fn();
  const stop = source.store.subscribe(changed), stopAlias = aliases.store.subscribe(aliasChanged);
  const before = aliases.store.getState();
  await f.studio.changeUnsafe(() => { f.base.value = "24px"; });
  expect(source.store.getState()?.activeValue).toBe("24px"); expect(changed).toHaveBeenCalledOnce();
  expect(aliases.store.getState()).toBe(before); expect(aliasChanged).not.toHaveBeenCalled();
  expect(before?.activeValue).toBe(mkTokenRef(f.base));
  changed.mockClear();
  const same = source.store.getState();
  await f.studio.changeUnsafe(() => { f.alias.name = "Renamed alias"; });
  expect(source.store.getState()).toBe(same); expect(changed).not.toHaveBeenCalled();
  stop(); stopAlias();
});

it("uses existing VSH imported-name fallback and override commands with native field invalidation", async () => {
  const site = createSite(), manager = new TplMgr({ site });
  const localGroup = manager.createGlobalVariantGroup("Theme"), localDark = manager.createGlobalVariant(localGroup, "Dark");
  const dependencySite = createSite(), depManager = new TplMgr({ site: dependencySite });
  const depGroup = depManager.createGlobalVariantGroup("Theme"), depDark = depManager.createGlobalVariant(depGroup, "Dark");
  const base = mkStyleToken({ name: "Imported", type: "Spacing", value: "10px" });
  const value = new VariantedValue({ variants: [depDark], value: "20px" }); base.variantedValues.push(value); site.styleTokens.push(base);
  const imported = mkStyleToken({ name: "Dependency token", type: "Spacing", value: "10px" }); dependencySite.styleTokens.push(imported);
  site.projectDependencies.push(new ProjectDependency({ uuid: "token-dep", pkgId: "token-pkg", projectId: "token-project", version: "1.0.0", name: "Tokens", site: dependencySite }));
  const f = fakeStudioCtx({ site }); const studio = f.studioCtx; studios.add(studio);
  f.appCtx.bundler.bundle(dependencySite, "token-project", f.appCtx.lastBundleVersion);
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  const token = new MutableToken(base), helper = new VariantedStylesHelper(site, [localDark], [localDark]);
  const source = new StyleTokenInputs(studio, token, helper), changed = vi.fn(), stop = source.store.subscribe(changed);
  expect(source.store.getState()?.activeValue).toBe("20px");
  await studio.changeUnsafe(() => { value.value = "22px"; });
  expect(source.store.getState()?.activeValue).toBe("22px");
  await studio.changeUnsafe(() => { localGroup.param.variable.name = "DifferentTheme"; });
  expect(source.store.getState()?.activeValue).toBe("10px");
  const override = new OverrideableToken(imported, site);
  const overrideSource = new StyleTokenInputs(studio, override, helper), stopOverride = overrideSource.store.subscribe(() => undefined);
  await studio.changeUnsafe(() => { helper.updateToken(override, "30px"); });
  expect(overrideSource.store.getState()?.activeValue).toBe("30px");
  await studio.changeUnsafe(() => { helper.removeVariantedValue(override); });
  expect(overrideSource.store.getState()?.activeValue).toBe("10px");
  stopOverride(); stop();
});

it("connects after commit, captures intervening changes, and disconnects abandoned/unmounted readers", async () => {
  const f = await setup(), helper = new VariantedStylesHelper(f.site);
  const prepared = f.studio.modelSnapshots.subscribePreparedField.bind(f.studio.modelSnapshots);
  let leases = 0;
  vi.spyOn(f.studio.modelSnapshots, "subscribePreparedField").mockImplementation((field, listener) => {
    leases++; const stop = prepared(field, listener); let stopped = false;
    return () => { if (!stopped) { stopped = true; leases--; stop(); } };
  });
  const pending = new Promise<void>(() => undefined);
  function Abandoned(): React.ReactNode { useStyleTokenInputs(f.studio, f.token, helper, (state) => state?.activeValue); throw pending; }
  const abandoned = render(<React.Suspense fallback={<span>Pending</span>}><Abandoned /></React.Suspense>);
  expect(leases).toBe(0); abandoned.unmount();
  const source = new StyleTokenInputs(f.studio, f.token, helper);
  await f.studio.changeUnsafe(() => { f.base.value = "28px"; });
  const stop = source.store.subscribe(() => undefined);
  expect(source.store.getState()?.activeValue).toBe("28px"); expect(leases).toBeGreaterThan(0);
  stop(); expect(leases).toBe(0);
});

it("keeps terminal snapshots and rejects late subscriptions when the actual world owner closes", async () => {
  const f = await setup(), source = new StyleTokenInputs(f.studio, f.token, new VariantedStylesHelper(f.site));
  const stop = source.store.subscribe(() => undefined), current = source.store.getState();
  await f.studio.awaitEval(); f.studio.dispose();
  const fields = vi.spyOn(f.studio.modelSnapshots, "declaredField");
  const late = source.store.subscribe(() => undefined);
  expect(source.store.getState()).toBe(current); expect(fields).not.toHaveBeenCalled(); late(); stop();
});

it("replaces actual Studio worlds without resolving a stale token through new model snapshots", async () => {
  const f = await setup(), helper = new VariantedStylesHelper(f.site);
  const source = new StyleTokenInputs(f.studio, f.token, helper), stop = source.store.subscribe(() => undefined);
  const current = source.store.getState(), oldModels = f.studio.modelSnapshots;
  const release = mock<PkgVersionInfoMeta>({ id: "token-world", pkgId: "token-world-pkg", version: "1.0.0", branchId: null });
  f.api.getPkgVersion.mockResolvedValueOnce({ pkg: { ...release, model: f.studio.bundleSite().site }, depPkgs: [], etag: "token-world-etag" });
  await act(async () => { await f.studio["loadVersion"](release, true); });
  expect(f.studio.modelSnapshots).not.toBe(oldModels);
  const fields = vi.spyOn(f.studio.modelSnapshots, "declaredField");
  expect(source.store.getState()).toBe(current);
  const late = source.store.subscribe(() => undefined); late();
  expect(fields).not.toHaveBeenCalled();
  const token = new MutableToken(ensure(f.studio.site.styleTokens.find((item) => item.name === "Space"), "Replaced token"));
  const next = new StyleTokenInputs(f.studio, token, new VariantedStylesHelper(f.studio.site)), stopNext = next.store.subscribe(() => undefined);
  await f.studio.changeUnsafe(() => { token.setValue("44px"); });
  expect(next.store.getState()?.activeValue).toBe("44px"); expect(source.store.getState()).toBe(current);
  stopNext(); stop();
});

function modal(studio: StudioCtx, children: React.ReactNode) {
  return <StudioCtxContext.Provider value={studio}><div className="app-container"><SidebarModalProvider>{children}</SidebarModalProvider></div></StudioCtxContext.Provider>;
}
it("updates the real General modal through native values while preserving its DOM CSS variable path", async () => {
  const f = await setup();
  const mounted = render(modal(f.studio, <GeneralTokenEditModal token={f.token} studioCtx={f.studio} onClose={() => undefined} />));
  await waitFor(() => expect(document.querySelector('input[value="12px"]')).toBeInTheDocument());
  document.documentElement.style.setProperty("--native-size", "32px");
  await act(async () => { await f.studio.changeUnsafe(() => { f.base.value = "var(--native-size)"; }); });
  await waitFor(() => expect(document.querySelector('input[value="32px"]')).toBeInTheDocument());
  mounted.unmount();
});

it("updates the real Font modal from recorded font-token changes", async () => {
  const f = await setup();
  const base = mkStyleToken({ name: "Typeface", type: "FontFamily", value: "Arial" });
  await f.studio.changeUnsafe(() => f.site.styleTokens.push(base));
  const token = new MutableToken(base);
  const mounted = render(modal(f.studio, <FontFamilyTokenEditModal token={token} studioCtx={f.studio} onClose={() => undefined} />));
  await waitFor(() => expect(ensure(screen.getByRole("combobox").parentElement, "Font selector content")).toHaveTextContent("Arial"));
  await act(async () => { await f.studio.changeUnsafe(() => { base.value = "Georgia"; }); });
  await waitFor(() => expect(ensure(screen.getByRole("combobox").parentElement, "Font selector content")).toHaveTextContent("Georgia"));
  mounted.unmount();
});

it.each(["loadVersion", "dispose"] as const)("keeps the actual General modal's displayed CSS value after %s closes its true owner", async (method) => {
  const f = await setup("var(--native-size)");
  document.documentElement.style.setProperty("--native-size", "32px");
  let suppliedVsh: VariantedStylesHelper | undefined = undefined;
  const contents = () => modal(f.studio, <GeneralTokenEditModal token={f.token} studioCtx={f.studio} vsh={suppliedVsh} onClose={() => undefined} />);
  const mounted = render(contents());
  await waitFor(() => expect(document.querySelector('input[value="32px"]')).toBeInTheDocument());
  if (method === "loadVersion") {
    const release = mock<PkgVersionInfoMeta>({ id: "modal-world", pkgId: "modal-world-pkg", version: "1.0.0", branchId: null });
    f.api.getPkgVersion.mockResolvedValueOnce({ pkg: { ...release, model: f.studio.bundleSite().site }, depPkgs: [], etag: "modal-world-etag" });
    await act(async () => { await f.studio["loadVersion"](release, true); });
  } else {
    await act(async () => { await f.studio.awaitEval(); f.studio.dispose(); });
  }
  document.documentElement.style.setProperty("--native-size", "80px");
  const fields = vi.spyOn(f.studio.modelSnapshots, "declaredField");
  mounted.rerender(contents());
  expect(document.querySelector('input[value="32px"]')).toBeInTheDocument();
  expect(document.querySelector('input[value="80px"]')).not.toBeInTheDocument();
  expect(fields).not.toHaveBeenCalled();
  suppliedVsh = new VariantedStylesHelper(f.studio.site);
  mounted.rerender(contents());
  expect(document.querySelector('input[value="32px"]')).toBeInTheDocument();
  expect(document.querySelector('input[value="80px"]')).not.toBeInTheDocument();
  expect(fields).not.toHaveBeenCalled(); mounted.unmount();
});

it("preserves registered-token selector precedence and native regKey changes in the actual General modal", async () => {
  vi.stubGlobal("__PlasmicTokenRegistry", [{ name: "native-size", type: "spacing", value: "var(--native-size)", selector: "#native-token-scope" }]);
  const site = createSite(), base = new StyleToken({ uuid: "registered-native-size", name: "Native size", type: "Spacing", value: "var(--native-size)", variantedValues: [], isRegistered: true, regKey: "native-size" });
  site.styleTokens.push(base);
  const { studioCtx: studio } = fakeStudioCtx({ site }); studios.add(studio);
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  document.documentElement.style.setProperty("--native-size", "32px");
  const scope = document.createElement("div"); scope.id = "native-token-scope"; scope.style.setProperty("--native-size", "72px"); document.body.appendChild(scope);
  try {
    const token = new OverrideableToken(base, site);
    const mounted = render(modal(studio, <GeneralTokenEditModal token={token} studioCtx={studio} onClose={() => undefined} />));
    await waitFor(() => expect(document.querySelector('input[value="72px"]')).toBeInTheDocument());
    await act(async () => { await studio.changeUnsafe(() => { base.regKey = "missing-native-key"; }); });
    await waitFor(() => expect(document.querySelector('input[value="32px"]')).toBeInTheDocument());
    mounted.unmount();
  } finally { scope.remove(); }
});

it("updates an active reader when its real VSH input changes and binds new token handles to a new world", async () => {
  const f = await setup(), manager = new TplMgr({ site: f.site });
  const group = manager.createGlobalVariantGroup("Reader Theme"), dark = manager.createGlobalVariant(group, "Dark");
  await f.studio.changeUnsafe(() => { f.base.variantedValues.push(new VariantedValue({ variants: [dark], value: "24px" })); });
  function Value({ helper, token = f.token }: { helper: VariantedStylesHelper; token?: MutableToken<StyleToken> }) {
    const value = useStyleTokenInputs(f.studio, token, helper, (state) => state?.activeValue);
    return <output data-testid="active-vsh-value">{value}</output>;
  }
  const mounted = render(<Value helper={new VariantedStylesHelper(f.site)} />);
  expect(screen.getByTestId("active-vsh-value")).toHaveTextContent("12px");
  mounted.rerender(<Value helper={new VariantedStylesHelper(f.site, [dark])} />);
  expect(screen.getByTestId("active-vsh-value")).toHaveTextContent("24px");
  mounted.rerender(<Value helper={new VariantedStylesHelper(f.site)} />);
  expect(screen.getByTestId("active-vsh-value")).toHaveTextContent("12px");
  const release = mock<PkgVersionInfoMeta>({ id: "new-token-handle-world", pkgId: "new-token-handle-pkg", version: "1.0.0", branchId: null });
  f.api.getPkgVersion.mockResolvedValueOnce({ pkg: { ...release, model: f.studio.bundleSite().site }, depPkgs: [], etag: "new-token-handle-etag" });
  await act(async () => { await f.studio["loadVersion"](release, true); });
  const token = new MutableToken(ensure(f.studio.site.styleTokens.find((item) => item.name === "Space"), "New-world token"));
  await act(async () => { await f.studio.changeUnsafe(() => token.setValue("48px")); });
  mounted.rerender(<Value helper={new VariantedStylesHelper(f.studio.site)} token={token} />);
  expect(screen.getByTestId("active-vsh-value")).toHaveTextContent("48px"); mounted.unmount();
});

it("rejects a new active foreign command handle before it can declare model fields", async () => {
  const f = await setup(), foreign = mkStyleToken({ name: "Foreign", type: "Spacing", value: "9px" });
  const fields = vi.spyOn(f.studio.modelSnapshots, "declaredField");
  expect(() => new StyleTokenInputs(f.studio, new MutableToken(foreign), new VariantedStylesHelper(f.site))).toThrow("another model world");
  expect(fields).not.toHaveBeenCalled();
});
