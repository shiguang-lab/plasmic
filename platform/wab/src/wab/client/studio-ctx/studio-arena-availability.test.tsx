import { StudioArenaState } from "@/wab/client/studio-ctx/studio-arena-state";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { createDocsModelFixture } from "@/wab/client/components/docs/__testonly__/model-fixture";
import { StudioUiEnvironment } from "@/wab/client/studio-ctx/studio-ui-environment";
import { getArenaFrames, type AnyArena } from "@/wab/shared/Arenas";
import { TplMgr } from "@/wab/shared/TplMgr";
import { Bundler } from "@/wab/shared/bundler";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite, getDedicatedArena } from "@/wab/shared/core/sites";
import { Pt } from "@/wab/shared/geom";
import { ensureKnownSite } from "@/wab/shared/model/classes";
import { waitFor } from "@testing-library/react";

function siteFixture() {
  const site = createSite(), mgr = new TplMgr({ site });
  const component = mgr.addComponent({ name: "Preview", type: ComponentType.Plain });
  const dedicated = ensure(getDedicatedArena(site, component), "Dedicated arena");
  const mixed = mgr.addArena("Mixed"), other = mgr.addArena("Other");
  return { site, mgr, component, dedicated, mixed, other };
}

it("publishes actual current-arena changes, completed frame edits and undo/redo only at empty boundaries", async () => {
  const { site, mgr, component, mixed, other, dedicated } = siteFixture();
  const { studioCtx: studio } = fakeStudioCtx({ site });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  studio.currentArena = mixed;
  expect(studio.uiEnvironment.store.getState().currentArenaEmpty).toBe(true);
  let frame: ReturnType<TplMgr["addNewMixedArenaFrame"]> | undefined;
  await studio.changeUnsafe(() => { frame = mgr.addNewMixedArenaFrame(mixed, "First", component, { insertPt: Pt.zero() }); });
  expect(studio.uiEnvironment.store.getState().currentArenaEmpty).toBe(false);
  const settled = studio.uiEnvironment.store.getState();
  const publish = vi.fn(); const stop = studio.uiEnvironment.store.subscribe(publish);
  await studio.changeUnsafe(() => { component.name = "Renamed"; });
  await studio.changeUnsafe(() => { mgr.addNewMixedArenaFrame(other, "Other", component, { insertPt: Pt.zero() }); });
  expect(studio.uiEnvironment.store.getState()).toBe(settled);
  expect(publish).not.toHaveBeenCalled();
  await studio.changeUnsafe(() => { mgr.removeExistingArenaFrame(mixed, ensure(frame, "Mixed frame")); });
  expect(studio.uiEnvironment.store.getState().currentArenaEmpty).toBe(true);
  await studio.undo();
  expect(studio.uiEnvironment.store.getState().currentArenaEmpty).toBe(false);
  await studio.redo();
  expect(studio.uiEnvironment.store.getState().currentArenaEmpty).toBe(true);
  studio.currentArena = dedicated;
  expect(studio.uiEnvironment.store.getState().currentArenaEmpty).toBe(false);
  studio.currentArena = null;
  expect(studio.uiEnvironment.store.getState().currentArenaEmpty).toBe(true);
  stop(); studio.dispose();
});

function projectionFixture() {
  const source = siteFixture();
  const fixture = createDocsModelFixture(source.site);
  let arenaState = new StudioArenaState(fixture.studio);
  arenaState.setCurrent(source.dedicated);
  Object.defineProperties(fixture.studio, {
    arenaState: { get: () => arenaState },
    currentArena: { get: () => arenaState.currentArena() },
    currentArenaEmpty: { get: () => arenaState.store.getState().frames.length === 0 },
  });
  Object.assign(fixture.studio.appCtx, { selfInfo: null, appConfig: {} });
  fixture.studio.getCurrentUiConfig.mockReturnValue({});
  fixture.studio.getHostUrl.mockReturnValue("http://localhost/host");
  fixture.studio.branchInfo.mockReturnValue(undefined);
  fixture.studio.showBranching.mockReturnValue(false);
  fixture.studio.canEditProject.mockReturnValue(true);
  fixture.studio.getLeftTabPermission.mockReturnValue("writable");
  const accountListeners = new Set<() => void>();
  fixture.studio.appCtx.subscribeUiEnvironmentInputs.mockImplementation((listener) => { accountListeners.add(listener); return () => { accountListeners.delete(listener); }; });
  const owner = new StudioUiEnvironment(fixture.studio);
  const stopCommits = fixture.studio.subscribeModelChanges((event) => {
    if (event.type === "commit") {
      arenaState.prepareModelCommit(event.summary.changes);
      owner.syncArena();
      arenaState.publishCommit();
    }
  });
  const setArena = (arena: AnyArena | null) => { arenaState.setCurrent(arena); owner.syncArena(); };
  const replaceSite = (site: typeof source.site) => {
    const sameSite = site === fixture.studio.site;
    const current = arenaState.currentArena();
    // Recreate the arena command owner with the replaced ModelSnapshots. The
    // previous owner's retired model handles intentionally cannot reactivate.
    arenaState.dispose();
    fixture.replaceSite(site);
    arenaState = new StudioArenaState(fixture.studio);
    if (sameSite) { arenaState.setCurrent(current); }
    owner.syncArena();
  };
  const dispose = () => { stopCommits(); owner.dispose(); arenaState.dispose(); };
  return { ...source, ...fixture, owner, setArena, replaceSite, dispose, accountListeners };
}

it("declares dedicated grid fields, narrows focused-frame inputs and rebinds replaced grids", () => {
  const { owner, dedicated, commit, studio, dispose } = projectionFixture();
  const grid = dedicated.matrix, rows = grid.rows.slice(), row = ensure(rows[0], "Arena row"), cols = row.cols.slice();
  const frame = ensure(getArenaFrames(dedicated)[0], "Dedicated frame");
  expect(owner.store.getState().currentArenaEmpty).toBe(false);
  row.cols = [];
  commit(row, "cols");
  expect(owner.store.getState().currentArenaEmpty).toBe(true);
  dedicated._focusedFrame = frame;
  commit(dedicated, "_focusedFrame");
  expect(owner.store.getState().currentArenaEmpty).toBe(false);
  const focused = owner.store.getState();
  const notify = vi.fn(); const stop = owner.store.subscribe(notify);
  grid.rows = []; commit(grid, "rows");
  expect(owner.store.getState()).toBe(focused);
  expect(notify).not.toHaveBeenCalled();
  dedicated._focusedFrame = null; commit(dedicated, "_focusedFrame");
  expect(owner.store.getState().currentArenaEmpty).toBe(true);
  grid.rows = rows; commit(grid, "rows");
  row.cols = cols; commit(row, "cols");
  expect(owner.store.getState().currentArenaEmpty).toBe(false);
  const emptyGrid = sourceEmptyGrid(studio.site);
  dedicated.matrix = emptyGrid; commit(dedicated, "matrix");
  expect(owner.store.getState().currentArenaEmpty).toBe(true);
  const settled = owner.store.getState(); notify.mockClear();
  row.cols = []; commit(row, "cols");
  expect(owner.store.getState()).toBe(settled);
  expect(notify).not.toHaveBeenCalled();
  stop(); dispose();
});

function sourceEmptyGrid(site: ReturnType<typeof createSite>) {
  const extra = new TplMgr({ site }).addComponent({ name: "Empty grid source", type: ComponentType.Plain });
  const arena = ensure(getDedicatedArena(site, extra), "Extra dedicated arena");
  arena.matrix.rows = [];
  return arena.matrix;
}

it("rebinds new snapshot owners even with the same model identities, and releases all inputs", () => {
  const { owner, site, dedicated, replaceSite, commit, listeners, accountListeners, dispose } = projectionFixture();
  const row = ensure(dedicated.matrix.rows[0], "Arena row");
  const settled = owner.store.getState();
  replaceSite(site);
  expect(owner.store.getState()).toBe(settled);
  row.cols = []; commit(row, "cols");
  expect(owner.store.getState().currentArenaEmpty).toBe(true);
  const disposed = owner.store.getState();
  dispose();
  expect(listeners.size).toBe(0); expect(accountListeners.size).toBe(0);
  dedicated.matrix.rows = []; commit(dedicated.matrix, "rows");
  owner.syncArena();
  expect(owner.store.getState()).toBe(disposed);
});

it("installs field subscriptions for a deserialized replacement arena and ignores the previous owner", () => {
  const { owner, site, dedicated, setArena, replaceSite, commit, dispose } = projectionFixture();
  const oldRow = ensure(dedicated.matrix.rows[0], "Old arena row");
  const bundle = new Bundler().bundle(site, "arena-test", "test");
  const next = ensureKnownSite(new Bundler().unbundle(bundle, "arena-test"));
  const component = ensure(next.components.find((item) => item.uuid === dedicated.component.uuid), "Replacement component");
  const arena = ensure(getDedicatedArena(next, component), "Replacement arena");
  setArena(null);
  replaceSite(next);
  setArena(arena);
  expect(owner.store.getState().currentArenaEmpty).toBe(false);
  const settled = owner.store.getState();
  oldRow.cols = []; commit(oldRow, "cols");
  expect(owner.store.getState()).toBe(settled);
  const nextRow = ensure(arena.matrix.rows[0], "Replacement row");
  nextRow.cols = []; commit(nextRow, "cols");
  expect(owner.store.getState().currentArenaEmpty).toBe(true);
  dispose();
});
