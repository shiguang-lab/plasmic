import { SidebarModalProvider } from "@/wab/client/components/sidebar/SidebarModal";
import "@/wab/client/components/sidebar/MixinControls";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { ImageAssetOrUrlPicker, ImageAssetPreviewAndPicker } from "@/wab/client/components/style-controls/ImageSelector";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { createImageAssetListInputs, createSelectedImageAssetInputs } from "@/wab/client/studio-ctx/image-asset-inputs";
import { ImageAssetType } from "@/wab/shared/core/image-asset-type";
import { mkImageAsset } from "@/wab/shared/core/image-assets";
import { createSite } from "@/wab/shared/core/sites";
import { ensure } from "@/wab/shared/common";
import { ImageAsset, ProjectDependency } from "@/wab/shared/model/classes";
import type { PkgVersionInfoMeta } from "@/wab/shared/SharedApi";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";

beforeEach(() => vi.stubGlobal("IntersectionObserver", class {
  observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn();
}));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function asset(name: string, uri = `${name}.png`) { return mkImageAsset({ name, type: ImageAssetType.Picture, dataUri: uri }); }
function dependency(name: string, site: ReturnType<typeof createSite>) { return new ProjectDependency({ uuid: name, name, site, pkgId: name, projectId: name, version: "1.0.0" }); }
async function setup() {
  const site = createSite(), first = asset("First"), other = asset("Other"); site.imageAssets.push(first, other);
  const fixture = fakeStudioCtx({ site });
  await waitFor(() => expect(fixture.studioCtx.initialRouteReady).toBe(true));
  const wrap = (content: React.ReactNode) => <AppCtxContext.Provider value={fixture.appCtx}><StudioCtxContext.Provider value={fixture.studioCtx}><SidebarModalProvider containerSelector="#asset-test-sidebar"><div id="asset-test-sidebar" />{content}</SidebarModalProvider></StudioCtxContext.Provider></AppCtxContext.Provider>;
  return { ...fixture, site, first, other, wrap };
}

it("updates actual selected preview fields and edit membership, and preserves picker selection and URL commands", async () => {
  const f = await setup(), picked = vi.fn();
  const mounted = render(f.wrap(<ImageAssetPreviewAndPicker studioCtx={f.studioCtx} value={f.first} type={ImageAssetType.Picture} onPicked={picked} />));
  try {
    expect(screen.getByText("First").closest("a,button")).not.toBeNull();
    expect(ensure(mounted.container.querySelector(".img-thumb"), "Preview thumbnail").getAttribute("style")).toContain("First.png");
    await act(async () => { await f.studioCtx.changeUnsafe(() => { f.first.name = "Renamed"; f.first.dataUri = "updated.png"; }); });
    expect(screen.getByText("Renamed")).toBeTruthy();
    expect(ensure(mounted.container.querySelector(".img-thumb"), "Updated thumbnail").getAttribute("style")).toContain("updated.png");
    await act(async () => { await f.studioCtx.changeUnsafe(() => { f.site.imageAssets.splice(f.site.imageAssets.indexOf(f.first), 1); }); });
    expect(screen.getByText("Renamed").closest("a,button")).toBeNull();
    await act(async () => { await f.studioCtx.changeUnsafe(() => { f.site.imageAssets.push(f.first); }); });
    expect(screen.getByText("Renamed").closest("a,button")).not.toBeNull();
    fireEvent.click(screen.getByText("Replace image..."));
    fireEvent.mouseDown(screen.getByRole("combobox"));
    const option = ensure((await screen.findByText("Other")).closest(".ant-select-item-option"), "Existing image option");
    fireEvent.click(option);
    expect(picked).toHaveBeenLastCalledWith(f.other);
    mounted.rerender(f.wrap(<ImageAssetOrUrlPicker studioCtx={f.studioCtx} type={ImageAssetType.Picture} onPicked={picked} />));
    const url = screen.getByPlaceholderText("Enter a URL");
    fireEvent.change(url, { target: { value: "https://example.com/new.png" } });
    fireEvent.submit(ensure(url.closest("form"), "Image URL form"));
    expect(picked).toHaveBeenLastCalledWith("https://example.com/new.png");
  } finally { mounted.unmount(); await f.studioCtx.awaitEval(); f.studioCtx.dispose(); }
});

it("keeps direct-dependency order and first UUID identity, updates demanded rows only and replaces membership", async () => {
  const f = await setup(), directSite = createSite(), transitive = createSite();
  const imported = asset("Imported"), excluded = asset("Transitive"); directSite.imageAssets.push(imported); transitive.imageAssets.push(excluded);
  directSite.projectDependencies.push(dependency("transitive", transitive));
  const dep = dependency("direct", directSite);
  f.appCtx.bundler.bundle(transitive, "transitive", f.appCtx.lastBundleVersion);
  f.appCtx.bundler.bundle(dep, "direct", f.appCtx.lastBundleVersion);
  await f.studioCtx.changeUnsafe(() => { f.site.projectDependencies.push(dep); });
  const list = createImageAssetListInputs(f.studioCtx, "direct"), changed = vi.fn(), stop = list.subscribe(changed);
  try {
    const rows = list.getSnapshot();
    expect(rows.map((row) => row.name)).toEqual(["First", "Other", "Imported"]);
    expect(list.resolve(ensure(rows.find((row) => row.uuid === imported.uuid), "Imported row").ref)).toBe(imported);
    await f.studioCtx.changeUnsafe(() => { f.other.width = 500; });
    expect(list.getSnapshot()).toBe(rows); expect(changed).not.toHaveBeenCalled();
    await f.studioCtx.changeUnsafe(() => { f.first.name = "After"; });
    expect(list.getSnapshot()[0].name).toBe("After"); expect(list.getSnapshot()[1]).toBe(rows[1]); expect(list.getSnapshot()[2]).toBe(rows[2]);
    const replacement = createSite();
    const duplicate = new ImageAsset({ uuid: f.first.uuid, name: "Duplicate imported", type: ImageAssetType.Picture, dataUri: "duplicate.png", width: null, height: null, aspectRatio: null });
    replacement.imageAssets.push(duplicate);
    const nextDependency = dependency("direct-v2", replacement);
    f.appCtx.bundler.bundle(nextDependency, "direct-v2", f.appCtx.lastBundleVersion);
    await f.studioCtx.changeUnsafe(() => { f.site.projectDependencies.splice(0, 1, nextDependency); });
    const final = list.getSnapshot();
    expect(final.map((row) => row.name)).toEqual(["After", "Other", "Duplicate imported"]);
    expect(list.resolve(ensure(final.find((row) => row.uuid === f.first.uuid), "First UUID match").ref)).toBe(f.first);
  } finally { stop(); f.studioCtx.dispose(); }
});

it("creates no abandoned subscriptions and keeps old selected props cached through actual model replacement", async () => {
  const f = await setup();
  const prepared = vi.spyOn(f.studioCtx.modelSnapshots, "subscribePreparedField");
  const abandoned = createSelectedImageAssetInputs(f.studioCtx, f.first);
  expect(abandoned.getSnapshot()?.name).toBe("First"); expect(prepared).not.toHaveBeenCalled();
  const mounted = render(f.wrap(<ImageAssetPreviewAndPicker studioCtx={f.studioCtx} value={f.first} type={ImageAssetType.Picture} onPicked={vi.fn()} />));
  const bundle = f.studioCtx.bundleSite().site;
  const release = mock<PkgVersionInfoMeta>({ id: "asset-world", pkgId: "asset-pkg", version: "1.0.0", branchId: null });
  f.api.getPkgVersion.mockResolvedValueOnce({ pkg: { ...release, model: bundle }, depPkgs: [], etag: "asset-world-etag" });
  const oldModels = f.studioCtx.modelSnapshots;
  // The model-backed popup must leave before its owner is replaced.
  fireEvent.click(screen.getByText("First"));
  await waitFor(() => expect(screen.getByPlaceholderText("(unnamed asset)")).toBeTruthy());
  try {
    await act(async () => { await f.studioCtx["loadVersion"](release, true); });
    expect(f.studioCtx.modelSnapshots).not.toBe(oldModels);
    expect(screen.queryByPlaceholderText("(unnamed asset)")).toBeNull();
    const field = vi.spyOn(f.studioCtx.modelSnapshots, "declaredField");
    mounted.rerender(f.wrap(<ImageAssetPreviewAndPicker studioCtx={f.studioCtx} value={f.first} type={ImageAssetType.Picture} onPicked={vi.fn()} />));
    expect(screen.getByText("First")).toBeTruthy();
    expect(field).not.toHaveBeenCalled();
    expect(abandoned.getSnapshot()?.name).toBe("First");
    const late = abandoned.subscribe(vi.fn());
    expect(field).not.toHaveBeenCalled(); late();
  } finally { mounted.unmount(); await f.studioCtx.awaitEval(); f.studioCtx.dispose(); }
});
