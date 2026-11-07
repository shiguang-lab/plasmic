import "@/wab/client/components/sidebar/MixinControls";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { AnimationControls } from "@/wab/client/components/style-controls/AnimationControls";
import { SidebarModalProvider } from "@/wab/client/components/sidebar/SidebarModal";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import { AnimationControlInputs } from "@/wab/client/studio-ctx/animation-control-inputs";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { PkgVersionInfoMeta } from "@/wab/shared/SharedApi";
import { TplMgr } from "@/wab/shared/TplMgr";
import { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import { ensure } from "@/wab/shared/common";
import { createSite } from "@/wab/shared/core/sites";
import { cloneAnimation } from "@/wab/shared/core/styles";
import { ProjectDependency } from "@/wab/shared/model/classes";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";

const studios = new Set<StudioCtx>();
afterEach(async () => { cleanup(); for (const studio of studios) { await studio.awaitEval(); studio.dispose(); } studios.clear(); vi.restoreAllMocks(); });
async function setup() {
  const site = createSite(), manager = new TplMgr({ site });
  const selected = manager.addAnimationSequence("Selected motion"), other = manager.addAnimationSequence("Other motion");
  const animation = manager.addAnimation(selected);
  ensure(site.activeTheme, "Animation theme").defaultStyle.rs.animations = [animation];
  const f = fakeStudioCtx({ site }); studios.add(f.studioCtx);
  await waitFor(() => expect(f.studioCtx.initialRouteReady).toBe(true));
  const studio = f.studioCtx, updated = vi.fn(), helper = new VariantedStylesHelper(site);
  const wrap = (children: React.ReactNode) => <AppCtxContext.Provider value={f.appCtx}><StudioCtxContext.Provider value={studio}><SidebarModalProvider>{children}</SidebarModalProvider></StudioCtxContext.Provider></AppCtxContext.Provider>;
  return { ...f, studio, site, selected, other, animation, manager, helper, updated, wrap };
}

it("publishes the complete finite edit snapshot before earlier field subscribers and shares unrelated rows", async () => {
  const f = await setup(), input = new AnimationControlInputs(f.studio, f.animation);
  const earlier = vi.fn(() => {
    const state = ensure(input.getSnapshot(), "Prepared animation snapshot");
    expect(state.duration).toBe("2s"); expect(state.sequenceId).toBe(f.other.uuid);
    expect(state.groups[0]?.sequences.some((row) => row.name === "Renamed selected")).toBe(true);
  });
  const stopEarlier = f.studio.modelSnapshots.field(f.animation, "duration").subscribe(earlier);
  const stop = input.subscribe(() => undefined);
  const before = ensure(input.getSnapshot(), "Original snapshot"), retainedOther = before.groups[0]?.sequences.find((row) => row.ref === f.studio.modelSnapshots.ref(f.other));
  await f.studio.changeUnsafe(() => { f.animation.duration = "2s"; f.animation.sequence = f.other; f.selected.name = "Renamed selected"; });
  expect(earlier).toHaveBeenCalledOnce();
  const after = ensure(input.getSnapshot(), "Edited snapshot");
  expect(after.groups[0]?.sequences.find((row) => row.ref === f.studio.modelSnapshots.ref(f.other))).toBe(retainedOther);
  const changed = vi.fn(), stopChanged = input.subscribe(changed);
  await f.studio.changeUnsafe(() => { f.animation.playState = "paused"; });
  expect(input.getSnapshot()).toBe(after); expect(changed).not.toHaveBeenCalled();
  stopChanged(); stop(); stopEarlier();
});

it("updates real choices, hostless group names and timing inputs while preserving original sequence/edit commands", async () => {
  const f = await setup(), depSite = createSite(), depManager = new TplMgr({ site: depSite });
  const imported = depManager.addAnimationSequence("Imported motion");
  const dep = new ProjectDependency({ uuid: "animation-dep", pkgId: "animation-pkg", projectId: "animation-library", name: "Original library", version: "1.0.0", site: depSite });
  f.appCtx.bundler.bundle(dep, "animation-version", f.appCtx.lastBundleVersion);
  await f.studio.changeUnsafe(() => f.site.projectDependencies.push(dep));
  const mounted = render(f.wrap(<AnimationControls studioCtx={f.studio} animation={f.animation} vsh={f.helper} onUpdated={f.updated} />));
  expect(screen.getByDisplayValue("1s")).toBeTruthy();
  await act(async () => { await f.studio.changeUnsafe(() => { f.animation.duration = "3s"; f.other.name = "Current other"; }); });
  expect(screen.getByDisplayValue("3s")).toBeTruthy();
  fireEvent.mouseDown(ensure(screen.getAllByRole("combobox")[0], "Sequence selector"));
  expect(await screen.findByText("Original library")).toBeTruthy();
  await act(async () => {
    f.appCtx.appConfig = { ...f.appCtx.appConfig, hostLessComponents: [{ type: "hostless-package", projectId: ["animation-library"], name: "Catalog motion library", sectionLabel: "Motion", items: [] }] };
    f.appCtx.publishUiEnvironmentInputs();
  });
  expect(await screen.findByText("Catalog motion library")).toBeTruthy();
  fireEvent.click(ensure(screen.getByText("Imported motion").closest(".ant-select-item-option"), "Original imported sequence choice"));
  await waitFor(() => expect(f.animation.sequence).toBe(imported));
  const duration = screen.getByDisplayValue("3s");
  fireEvent.change(duration, { target: { value: "2.5s" } });
  fireEvent.keyDown(duration, { key: "Enter" });
  await waitFor(() => expect(f.animation.duration).toBe("2.5s"));
  expect(f.updated).toHaveBeenCalled();
  await act(async () => { await f.studio.changeUnsafe(() => { f.manager.addAnimationSequence("Added live motion"); }); });
  fireEvent.mouseDown(ensure(screen.getAllByRole("combobox")[0], "Reopened sequence selector"));
  expect(await screen.findByText("Added live motion")).toBeTruthy();
  await act(async () => { await f.studio.changeUnsafe(() => f.manager.removeAnimationSequence(f.other)); });
  expect(screen.queryByText("Current other")).toBeNull();
  expect(screen.getByText("Added live motion")).toBeTruthy();
  mounted.unmount();
});

it("connects only committed subscriptions, catches intervening changes and seals command inputs across actual model replacement", async () => {
  const f = await setup(), prepared = vi.spyOn(f.studio.modelSnapshots, "subscribePreparedField"), appSubscribe = vi.spyOn(f.appCtx, "subscribeUiEnvironmentInputs");
  const input = new AnimationControlInputs(f.studio, f.animation), initial = input.getSnapshot();
  const abandoned = new AnimationControlInputs(f.studio, f.animation), abandonedSnapshot = abandoned.getSnapshot();
  expect(prepared).not.toHaveBeenCalled(); expect(appSubscribe).not.toHaveBeenCalled();
  await f.studio.changeUnsafe(() => { f.animation.delay = "0.5s"; });
  const stop = input.subscribe(() => undefined);
  expect(input.getSnapshot()?.delay).toBe("0.5s"); expect(input.getSnapshot()).not.toBe(initial);
  const content = () => f.wrap(<AnimationControls studioCtx={f.studio} animation={f.animation} vsh={f.helper} onUpdated={f.updated} />);
  const mounted = render(content());
  expect(screen.getByDisplayValue("0.5s")).toBeTruthy();
  const old = ensure(input.getSnapshot(), "Old animation snapshot"), release = mock<PkgVersionInfoMeta>({ id: "animation-world", pkgId: "animation-pkg", version: "1.0.0", branchId: null });
  f.api.getPkgVersion.mockResolvedValueOnce({ pkg: { ...release, model: f.studio.bundleSite().site }, depPkgs: [], etag: "animation-etag" });
  await act(async () => { await f.studio["loadVersion"](release, true); });
  expect(input.getSnapshot()?.active).toBe(false); expect(input.getSnapshot()?.groups).toBe(old.groups);
  expect(abandoned.getSnapshot()?.active).toBe(false); expect(abandoned.getSnapshot()?.groups).toBe(abandonedSnapshot?.groups);
  expect(screen.queryByDisplayValue("0.5s")).toBeNull();
  const declared = vi.spyOn(f.studio.modelSnapshots, "declaredField"); mounted.rerender(content());
  expect(declared).not.toHaveBeenCalled();
  expect(() => input.sequence(f.selected.uuid)).toThrow("closed animation owner");
  const foreign = f.manager.addAnimation(f.selected);
  expect(() => new AnimationControlInputs(f.studio, foreign)).toThrow("another model world");
  expect(declared).not.toHaveBeenCalled();
  const next = ensure(ensure(f.studio.site.activeTheme, "Next animation theme").defaultStyle.rs.animations?.[0], "New command animation");
  mounted.rerender(f.wrap(<AnimationControls studioCtx={f.studio} animation={next} vsh={f.helper} onUpdated={f.updated} />));
  expect(screen.getByDisplayValue("0.5s")).toBeTruthy();
  mounted.unmount(); stop();
});

it("admits a real cloned transitive animation reference while keeping the original direct-only choices", async () => {
  const site = createSite(), library = createSite(), transitive = createSite();
  const leafManager = new TplMgr({ site: transitive }), sequence = leafManager.addAnimationSequence("Transitive motion");
  const indirect = new ProjectDependency({ uuid: "animation-leaf", pkgId: "animation-leaf-pkg", projectId: "animation-leaf-project", name: "Leaf", version: "1.0.0", site: transitive });
  library.projectDependencies.push(indirect);
  const direct = new ProjectDependency({ uuid: "animation-top", pkgId: "animation-top-pkg", projectId: "animation-top-project", name: "Top", version: "1.0.0", site: library });
  site.projectDependencies.push(direct);
  const animation = cloneAnimation(leafManager.addAnimation(sequence));
  ensure(site.activeTheme, "Clone target theme").defaultStyle.rs.animations = [animation];
  const { studioCtx: studio } = fakeStudioCtx({ site }); studios.add(studio);
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  const input = new AnimationControlInputs(studio, animation), snapshot = ensure(input.getSnapshot(), "Cloned animation snapshot");
  expect(snapshot.active).toBe(true); expect(snapshot.sequenceId).toBe(sequence.uuid);
  expect(snapshot.groups).toEqual([]);
});
