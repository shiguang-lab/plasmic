import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { SingleRsExpsProvider } from "@/wab/client/components/style-controls/StyleComponent";
import { GridCssInputs } from "@/wab/client/studio-ctx/grid-css-inputs";
import { createImageAssetDictionaryInputs } from "@/wab/client/studio-ctx/image-asset-inputs";
import { mkMixinPropRef, mkStyleToken, mkTokenRef } from "@/wab/commons/StyleToken";
import { RuleSetHelpers } from "@/wab/shared/RuleSetHelpers";
import type { PkgVersionInfoMeta } from "@/wab/shared/SharedApi";
import { ensure } from "@/wab/shared/common";
import { ImageAssetType } from "@/wab/shared/core/image-asset-type";
import { mkImageAssetRef } from "@/wab/shared/core/image-assets";
import { walkDependencyInputs, walkDependencyTree } from "@/wab/shared/core/project-deps";
import { siteFinalStyleTokensAllDeps } from "@/wab/shared/core/site-style-tokens";
import { allImageAssets, allMixins, createSite } from "@/wab/shared/core/sites";
import { CssVarResolver, mkRuleSet } from "@/wab/shared/core/styles";
import { ImageAsset, Mixin, ProjectDependency, StyleToken } from "@/wab/shared/model/classes";
import { waitFor } from "@testing-library/react";
import { mock } from "vitest-mock-extended";

afterEach(() => { vi.restoreAllMocks(); });
function mixin(name: string, value: string, uuid = name) {
  const rs = mkRuleSet({ values: {} }); new RuleSetHelpers(rs, "div").set("grid-template-columns", value);
  return new Mixin({ name, uuid, rs, forTheme: false, variantedRs: [], preview: undefined });
}
function asset(name: string, dataUri: string, uuid = name) { return new ImageAsset({ name, uuid, dataUri, type: ImageAssetType.Picture, width: null, height: null, aspectRatio: null }); }
function dependency(name: string, site: ReturnType<typeof createSite>, projectId = name) { return new ProjectDependency({ name, uuid: name, site, pkgId: name, projectId, version: "1.0.0" }); }
async function setup(site = createSite()) {
  const rs = ensure(site.activeTheme, "Actual theme").defaultStyle.rs, exp = new RuleSetHelpers(rs, "div"); exp.set("display", "grid");
  // These Grid lifecycle cases do not exercise registration synchronization.
  const f = fakeStudioCtx({ site, devFlagOverrides: { ccStubs: true } });
  await waitFor(() => expect(f.studioCtx.initialRouteReady).toBe(true));
  const studio = f.studioCtx, provider = new SingleRsExpsProvider(rs, exp, studio, [], { kind: "ruleSet", rs, forTag: "div" });
  const input = (value: string, display = "grid") => new GridCssInputs(provider, { display, hasTemplate: true, template: value }, studio.arenaState.lifetime());
  const legacy = () => new CssVarResolver(siteFinalStyleTokensAllDeps(site), allMixins(site, { includeDeps: "all" }), allImageAssets(site, { includeDeps: "all" }), site.activeTheme);
  return { ...f, studio, provider, site, exp, input, legacy };
}

it("uses frozen metadata with the original BFS/project-id ordering and last mixin UUID before the first completed field subscriber", async () => {
  const site = createSite(), a = createSite(), b = createSite(), chosen = createSite(), ignored = createSite();
  const first = mixin("Root", "repeat(2, minmax(0, 1fr))", "shared-mixin"), last = mixin("Chosen", "repeat(4, minmax(0, 1fr))", first.uuid);
  const excluded = mixin("Ignored", "repeat(9, minmax(0, 1fr))", first.uuid);
  site.mixins.push(first); chosen.mixins.push(last); ignored.mixins.push(excluded);
  const toA = dependency("A", a), toB = dependency("B", b), sharedA = dependency("Chosen", chosen, "shared-project"), sharedB = dependency("Ignored", ignored, "shared-project");
  a.projectDependencies.push(sharedA); b.projectDependencies.push(sharedB);
  const f = await setup(site), raw = mkMixinPropRef(first, "grid-template-columns", false);
  f.appCtx.bundler.bundle(chosen, "chosen", f.appCtx.lastBundleVersion); f.appCtx.bundler.bundle(ignored, "ignored", f.appCtx.lastBundleVersion);
  f.appCtx.bundler.bundle(toA, "a", f.appCtx.lastBundleVersion); f.appCtx.bundler.bundle(toB, "b", f.appCtx.lastBundleVersion);
  await f.studio.changeUnsafe(() => { site.projectDependencies.push(toA, toB); });
  expect(walkDependencyTree(site, "all")).toEqual([toA, toB, sharedA]);
  const source = f.input(raw);
  const changed = vi.fn(), before = source.getSnapshot(), early: string[] = [];
  const stopField = f.studio.modelSnapshots.field(site, "projectDependencies").subscribe(() => early.push(ensure(source.getSnapshot().value, "Installed CSS")));
  const stop = source.subscribe(changed);
  try {
    expect(before.value).toBe("repeat(4, minmax(0, 1fr))"); expect(before.value).toBe(f.legacy().tryResolveTokenOrMixinRef(raw));
    await f.studio.changeUnsafe(() => {
      site.projectDependencies = [toB, toA];
      expect(source.getSnapshot()).toBe(before);
    });
    expect(walkDependencyTree(site, "all")).toEqual([toB, toA, sharedB]);
    expect(early).toEqual(["repeat(9, minmax(0, 1fr))"]);
    expect(source.getSnapshot().value).toBe(f.legacy().tryResolveTokenOrMixinRef(raw)); expect(changed).toHaveBeenCalled();
    const same = source.getSnapshot(); changed.mockClear();
    await f.studio.changeUnsafe(() => { excluded.name = "Renamed only"; });
    expect(source.getSnapshot()).toBe(same); expect(changed).not.toHaveBeenCalled();
    // The shared traversal also preserves duplicate direct inputs; this pure
    // corner does not install an invalid duplicate package into Studio's graph.
    expect(walkDependencyInputs([toA, toA], "all", (dep) => dep.site.projectDependencies, (dep) => dep.projectId)).toEqual([toA, toA, sharedA]);
  } finally { stop(); stopField(); await f.studio.awaitEval(); f.studio.dispose(); }
});

it("preserves original double asset/token phases, dictionary aliases, cycles, missing errors and registered CSS variables without DOM resolution", async () => {
  const site = createSite(), firstAsset = asset("First", "first.png", "shared-image"), lastAsset = asset("Last", "last.png", firstAsset.uuid);
  const head = mkStyleToken({ name: "Asset alias", type: "Spacing", value: mkImageAssetRef(firstAsset) });
  const original = mixin("Asset mixin", mkTokenRef(head));
  const duplicateHead = new StyleToken({ uuid: head.uuid, name: "Later head", type: "Spacing", value: mkImageAssetRef(lastAsset), variantedValues: [], isRegistered: false, regKey: undefined });
  const registered = new StyleToken({ uuid: "registered-grid", name: "Registered", type: "Spacing", value: "var(--registered-grid)", variantedValues: [], isRegistered: true, regKey: "registered-grid" });
  const cycleA = mkStyleToken({ name: "Cycle A", type: "Spacing", value: "1px" }), cycleB = mkStyleToken({ name: "Cycle B", type: "Spacing", value: mkTokenRef(cycleA) }); cycleA.value = mkTokenRef(cycleB);
  const broken = mkStyleToken({ name: "Broken alias", type: "Spacing", value: "1px" });
  site.imageAssets.push(firstAsset, lastAsset); site.styleTokens.push(head, duplicateHead, registered, cycleA, cycleB, broken); site.mixins.push(original);
  const f = await setup(site), dom = vi.spyOn(window, "getComputedStyle");
  const read = (value: string) => { const source = f.input(value); const actual = source.getSnapshot().value; expect(actual).toBe(f.legacy().tryResolveTokenOrMixinRef(value)); return actual; };
  try {
    expect(read(mkMixinPropRef(original, "grid-template-columns", false))).toBe('url("last.png")');
    expect(read(mkTokenRef(head))).toBe(mkImageAssetRef(lastAsset));
    expect(read("repeat(3, minmax(0, 1fr))")).toBe("repeat(3, minmax(0, 1fr))");
    expect(read(mkTokenRef(cycleA))).toBe(mkTokenRef(cycleB));
    expect(read("var(--token-missing-head)")).toBe("var(--token-missing-head)");
    expect(read(mkTokenRef(registered))).toBe("var(--registered-grid)");
    expect(dom).not.toHaveBeenCalled();
    const brokenChange = f.studio.dbCtx().recorder.withRecording(() => { broken.value = "var(--token-missing-alias)"; });
    f.studio.modelSnapshots.sync(brokenChange.changes);
    const errorOf = (run: () => unknown) => { try { run(); } catch (error) { return error; } throw new Error("Original resolver must throw"); };
    for (const value of [mkTokenRef(broken), "var(--mixin-missing_grid-template-columns)", "var(--mixin-malformed"]) {
      const expected = errorOf(() => f.legacy().tryResolveTokenOrMixinRef(value));
      expect(() => f.input(value).getSnapshot()).toThrow(expected instanceof Error ? expected.message : String(expected));
    }
    // Original parseGridCssPropsToSpec uses ensure(boolean), which evaluates
    // the display check but does not reject false. Keep that exact behavior.
    expect(f.input("repeat(2, minmax(0, 1fr))", "block").getSnapshot().value).toBe("repeat(2, minmax(0, 1fr))");
    expect(() => f.input("var(--mixin-missing_grid-template-columns)", "block").getSnapshot()).toThrow("No mixin");
  } finally {
    const repaired = f.studio.dbCtx().recorder.withRecording(() => { broken.value = "1px"; }); f.studio.modelSnapshots.sync(repaired.changes);
    await f.studio.awaitEval(); f.studio.dispose();
  }
});

it("does not consume asset publication on an early read and releases child resources before actual model replacement", async () => {
  const site = createSite(), image = asset("Image", "first.png"), m = mixin("Image ref", mkImageAssetRef(image)); site.imageAssets.push(image); site.mixins.push(m);
  const f = await setup(site), raw = mkMixinPropRef(m, "grid-template-columns", false), source = f.input(raw);
  const prepared = vi.spyOn(f.studio.modelSnapshots, "subscribePreparedField"); source.getSnapshot(); expect(prepared).not.toHaveBeenCalled();
  const early: string[] = [], stopField = f.studio.modelSnapshots.field(image, "dataUri").subscribe(() => early.push(ensure(source.getSnapshot().value, "CSS value")));
  const changed = vi.fn(), stop = source.subscribe(changed); expect(prepared).toHaveBeenCalled();
  const assets = createImageAssetDictionaryInputs(f.studio, [image.uuid]), child = vi.fn(), reentrant = vi.fn(); let inner: (() => void) | undefined;
  const stopAssets = assets.subscribe(() => { child(); assets.getSnapshot(); inner ??= assets.subscribe(reentrant); });
  try {
    await f.studio.changeUnsafe(() => { image.dataUri = "second.png"; });
    expect(early).toEqual(['url("second.png")']); expect(source.getSnapshot().value).toBe('url("second.png")'); expect(changed).toHaveBeenCalledOnce();
    expect(child).toHaveBeenCalledOnce(); expect(reentrant).toHaveBeenCalledOnce();
    changed.mockClear(); child.mockClear(); reentrant.mockClear();
    await f.studio.changeUnsafe(() => { image.dataUri = "second.png"; });
    expect(changed).not.toHaveBeenCalled(); expect(child).not.toHaveBeenCalled(); expect(reentrant).not.toHaveBeenCalled();
    const release = mock<PkgVersionInfoMeta>({ id: "grid-input-world", pkgId: "grid-input-pkg", version: "1.0.0", branchId: null });
    f.api.getPkgVersion.mockResolvedValueOnce({ pkg: { ...release, model: f.studio.bundleSite().site }, depPkgs: [], etag: "grid-input-etag" });
    await f.studio["loadVersion"](release, true);
    expect(source.getSnapshot()).toEqual({ active: false, value: 'url("second.png")' }); expect(assets.getSnapshot()).toEqual([]);
    expect(child).toHaveBeenCalledOnce(); expect(reentrant).toHaveBeenCalledOnce();
    const fields = vi.spyOn(f.studio.modelSnapshots, "declaredField"), late = vi.fn(), off = source.subscribe(late);
    source.getSnapshot(); expect(fields).not.toHaveBeenCalled(); expect(late).not.toHaveBeenCalled(); off();
  } finally { inner?.(); stopAssets(); stop(); stopField(); await f.studio.awaitEval(); f.studio.dispose(); }
});
