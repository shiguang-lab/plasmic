import { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import "@/wab/client/components/sidebar/MixinControls";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { ColorTokenPopup } from "@/wab/client/components/sidebar/ColorTokenPopup";
import { SidebarModalProvider } from "@/wab/client/components/sidebar/SidebarModal";
import * as clientResolver from "@/wab/client/components/widgets/ColorPicker/client-token-resolver";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { StyleColorTokenInputs, useStyleColorTokens } from "@/wab/client/studio-ctx/style-color-token-inputs";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { mkStyleToken, mkTokenRef } from "@/wab/commons/StyleToken";
import type { PkgVersionInfoMeta } from "@/wab/shared/SharedApi";
import { ensure } from "@/wab/shared/common";
import { createSite } from "@/wab/shared/core/sites";
import { MutableToken, OverrideableToken } from "@/wab/shared/core/tokens";
import { ProjectDependency, StyleToken } from "@/wab/shared/model/classes";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { mock } from "vitest-mock-extended";

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
  cleanup();
  for (const studio of studios) { await studio.awaitEval(); studio.dispose(); }
  studios.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});
async function setup() {
  const site = createSite(), dependencySite = createSite(), transitiveSite = createSite();
  const self = mkStyleToken({ name: "Edited", type: "Color", value: "#112233" });
  const other = mkStyleToken({ name: "Other", type: "Color", value: "#445566" });
  const spacing = mkStyleToken({ name: "Space", type: "Spacing", value: "12px" });
  const imported = mkStyleToken({ name: "Imported", type: "Color", value: "#778899" });
  const transitive = mkStyleToken({ name: "Transitive", type: "Color", value: "#AABBCC" });
  site.styleTokens.push(self, other, spacing); dependencySite.styleTokens.push(imported); transitiveSite.styleTokens.push(transitive);
  const nested = new ProjectDependency({ uuid: "nested-color", pkgId: "nested-color-pkg", projectId: "nested-color-project", name: "Nested colors", version: "1.0.0", site: transitiveSite });
  dependencySite.projectDependencies.push(nested);
  const dependency = new ProjectDependency({ uuid: "direct-color", pkgId: "direct-color-pkg", projectId: "direct-color-project", name: "Direct colors", version: "1.0.0", site: dependencySite });
  const f = fakeStudioCtx({ site }), studio = f.studioCtx; studios.add(studio);
  f.appCtx.bundler.bundle(nested, "nested-color-project", f.appCtx.lastBundleVersion);
  f.appCtx.bundler.bundle(dependency, "direct-color-project", f.appCtx.lastBundleVersion);
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  await studio.changeUnsafe(() => { site.projectDependencies.push(dependency); });
  return { ...f, studio, site, self, other, spacing, imported, dependency, dependencySite, transitive, token: new MutableToken(self) };
}

it("preserves root/direct order, excludes only matching UUIDs, and keeps opaque wrappers on their original models", async () => {
  const f = await setup(), source = new StyleColorTokenInputs(f.studio, f.token), changed = vi.fn(), stop = source.store.subscribe(changed);
  const initial = source.store.getState(), handles = source.commandTokens(initial);
  expect(initial.tokens.map((row) => row.uuid)).toEqual([f.other.uuid, f.imported.uuid]);
  expect(initial.tokens.map((row) => row.token)).toEqual([f.studio.modelSnapshots.ref(f.other), f.studio.modelSnapshots.ref(f.imported)]);
  expect(handles[0]).toBeInstanceOf(MutableToken); expect(handles[1]).toBeInstanceOf(OverrideableToken);
  expect(handles.map((token) => token.base)).toEqual([f.other, f.imported]);
  expect(Object.isFrozen(initial)).toBe(true); expect(Object.isFrozen(initial.tokens)).toBe(true); expect(initial.tokens.every(Object.isFrozen)).toBe(true);
  await f.studio.changeUnsafe(() => { f.other.name = "Renamed"; f.other.value = "#000000"; });
  expect(source.store.getState()).toBe(initial); expect(source.commandTokens(initial)).toBe(handles); expect(changed).not.toHaveBeenCalled();
  // Duplicate direct entries keep the original helper's duplicate semantics.
  await f.studio.changeUnsafe(() => { f.site.projectDependencies.push(f.dependency); });
  expect(source.store.getState().tokens.map((row) => row.uuid)).toEqual([f.other.uuid, f.imported.uuid, f.imported.uuid]);
  stop();
});

it("shares unaffected rows through add/remove/reorder and respects legal model replacements for immutable type/UUID fields", async () => {
  const f = await setup(), source = new StyleColorTokenInputs(f.studio, f.token), stop = source.store.subscribe(() => undefined);
  const before = source.store.getState(), originalOther = ensure(before.tokens[0], "Other row"), originalImport = ensure(before.tokens[1], "Imported row");
  const added = mkStyleToken({ name: "Added", type: "Color", value: "#FFFFFF" });
  await f.studio.changeUnsafe(() => { f.site.styleTokens.unshift(added); });
  expect(source.store.getState().tokens.map((row) => row.uuid)).toEqual([added.uuid, f.other.uuid, f.imported.uuid]);
  expect(source.store.getState().tokens[1]).toBe(originalOther); expect(source.store.getState().tokens[2]).toBe(originalImport);
  const replacement = new StyleToken({ uuid: f.other.uuid, name: f.other.name, type: "Spacing", value: "20px", variantedValues: [], isRegistered: false, regKey: undefined });
  await f.studio.changeUnsafe(() => { f.site.styleTokens.splice(f.site.styleTokens.indexOf(f.other), 1, replacement); });
  expect(source.store.getState().tokens.map((row) => row.uuid)).toEqual([added.uuid, f.imported.uuid]);
  const color = mkStyleToken({ name: "Restored color", type: "Color", value: "#123456" });
  await f.studio.changeUnsafe(() => { f.site.styleTokens.splice(f.site.styleTokens.indexOf(replacement), 1, color); f.site.styleTokens.splice(f.site.styleTokens.indexOf(added), 1); });
  expect(source.commandTokens(source.store.getState()).map((token) => token.base)).toEqual([color, f.imported]);
  expect(source.store.getState().tokens[1]).toBe(originalImport); stop();
});

it("follows the actual root dependency replacement producer and rebinds wrapper models", async () => {
  const f = await setup(), source = new StyleColorTokenInputs(f.studio, f.token), stop = source.store.subscribe(() => undefined);
  const old = source.store.getState(), oldLocal = ensure(old.tokens[0], "Local row");
  const nextSite = createSite(), nextColor = mkStyleToken({ name: "Upgraded dependency", type: "Color", value: "#010203" }); nextSite.styleTokens.push(nextColor);
  const replacement = new ProjectDependency({ uuid: "direct-color-upgraded", pkgId: f.dependency.pkgId, projectId: f.dependency.projectId, name: f.dependency.name, version: "2.0.0", site: nextSite });
  f.appCtx.bundler.bundle(replacement, "direct-color-version-2", f.appCtx.lastBundleVersion);
  await f.studio.changeUnsafe(() => { f.site.projectDependencies.splice(0, 1, replacement); });
  const current = source.store.getState(), handles = source.commandTokens(current);
  expect(current.tokens.map((row) => row.uuid)).toEqual([f.other.uuid, nextColor.uuid]);
  expect(current.tokens[0]).toBe(oldLocal); expect(handles[1]).toBeInstanceOf(OverrideableToken); expect(handles[1]?.base).toBe(nextColor);
  expect(handles.some((token) => token.base === f.imported || token.base === f.transitive)).toBe(false); stop();
});

it("connects collection leases only after commit and releases all fields on unmount", async () => {
  const f = await setup(), prepared = f.studio.modelSnapshots.subscribePreparedField.bind(f.studio.modelSnapshots);
  let leases = 0;
  vi.spyOn(f.studio.modelSnapshots, "subscribePreparedField").mockImplementation((field, listener) => {
    leases++; const stop = prepared(field, listener); let stopped = false;
    return () => { if (!stopped) { stopped = true; leases--; stop(); } };
  });
  const pending = new Promise<void>(() => undefined);
  function Abandoned(): React.ReactNode { useStyleColorTokens(f.studio, f.token); throw pending; }
  const abandoned = render(<React.Suspense fallback={<span>Pending</span>}><Abandoned /></React.Suspense>);
  expect(leases).toBe(0); abandoned.unmount();
  function Committed() { const colors = useStyleColorTokens(f.studio, f.token); return <output>{colors.snapshot.tokens.length}</output>; }
  const mounted = render(<Committed />); expect(leases).toBeGreaterThan(0); mounted.unmount(); expect(leases).toBe(0);
});

it("retains closed rows while disabling command materialization after the actual Studio owner disposes", async () => {
  const f = await setup(), source = new StyleColorTokenInputs(f.studio, f.token), stop = source.store.subscribe(() => undefined), before = source.store.getState();
  await f.studio.awaitEval(); f.studio.dispose();
  const fields = vi.spyOn(f.studio.modelSnapshots, "declaredField"), closed = source.store.getState();
  expect(closed.active).toBe(false); expect(closed.tokens).toBe(before.tokens); expect(source.commandTokens(before)).toEqual([]); expect(source.commandTokens(closed)).toEqual([]);
  const late = source.store.subscribe(() => undefined); expect(fields).not.toHaveBeenCalled(); late(); stop();
});

function popup(f: Awaited<ReturnType<typeof setup>>, token: MutableToken<StyleToken> | OverrideableToken<StyleToken> = f.token, onClose = () => undefined, vsh?: VariantedStylesHelper) {
  return <StudioCtxContext.Provider value={f.studio}><div className="app-container"><SidebarModalProvider>
    <ColorTokenPopup token={token} studioCtx={f.studio} show={true} autoFocusName={false} onClose={onClose} vsh={vsh} />
  </SidebarModalProvider></div></StudioCtxContext.Provider>;
}
it("updates the actual picker collection and preserves real rename and alias-selection commands", async () => {
  const f = await setup(), close = vi.fn(); const mounted = render(popup(f, f.token, close));
  await waitFor(() => expect(document.querySelectorAll(".SwatchButton")).toHaveLength(2));
  const name = screen.getByPlaceholderText("(unnamed token)");
  await act(async () => { fireEvent.change(name, { target: { value: "Renamed edited" } }); fireEvent.blur(name); });
  await waitFor(() => expect(f.self.name).toBe("Renamed edited"));
  const added = mkStyleToken({ name: "Added swatch", type: "Color", value: "#998877" });
  await act(async () => { await f.studio.changeUnsafe(() => { f.site.styleTokens.push(added); }); });
  await waitFor(() => expect(document.querySelectorAll(".SwatchButton")).toHaveLength(3));
  await act(async () => { fireEvent.mouseDown(ensure(document.querySelectorAll(".SwatchButton")[0], "Original model swatch")); });
  await waitFor(() => expect(f.self.value).toBe(mkTokenRef(f.other)));
  expect(close).not.toHaveBeenCalled(); mounted.unmount();
});

it("keeps the imported edited model immutable while actual swatch selection writes its root override", async () => {
  const f = await setup(), token = new OverrideableToken(f.imported, f.site);
  const mounted = render(popup(f, token));
  await waitFor(() => expect(document.querySelectorAll(".SwatchButton")).toHaveLength(2));
  expect(screen.getByPlaceholderText("(unnamed token)")).toHaveProperty("readOnly", true);
  await act(async () => { fireEvent.mouseDown(ensure(document.querySelectorAll(".SwatchButton")[0], "Local selected model")); });
  await waitFor(() => expect(token.override?.value).toBe(mkTokenRef(f.self)));
  expect(f.imported.value).toBe("#778899"); mounted.unmount();
});

it("tears down an open actual picker on world replacement before any old wrapper reaches a new-world resolver", async () => {
  const f = await setup(); const mounted = render(popup(f));
  await waitFor(() => expect(document.querySelectorAll(".SwatchButton")).toHaveLength(2));
  const nextSite = createSite(); nextSite.styleTokens.push(mkStyleToken({ name: "New world", type: "Color", value: "#ABCDEF" }));
  const bundle = f.appCtx.bundler.bundle(nextSite, f.studio.siteInfo.id, f.appCtx.lastBundleVersion);
  const release = mock<PkgVersionInfoMeta>({ id: "color-world", pkgId: "color-world-pkg", version: "1.0.0", branchId: null });
  f.api.getPkgVersion.mockResolvedValueOnce({ pkg: { ...release, model: bundle }, depPkgs: [], etag: "color-world-etag" });
  const resolver = vi.spyOn(clientResolver, "useClientTokenResolver");
  await act(async () => { await f.studio["loadVersion"](release, true); });
  expect(document.querySelectorAll(".SwatchButton")).toHaveLength(0);
  expect(resolver).not.toHaveBeenCalled();
  const fields = vi.spyOn(f.studio.modelSnapshots, "declaredField");
  mounted.rerender(popup(f, f.token, () => undefined, new VariantedStylesHelper(f.studio.site)));
  expect(document.querySelectorAll(".SwatchButton")).toHaveLength(0); expect(fields).not.toHaveBeenCalled(); mounted.unmount();
});
