import type { PkgVersionInfoMeta } from "@/wab/shared/SharedApi";
import { act } from "@testing-library/react";
import { message, notification } from "antd";
import { clearDarkMask } from "@/wab/client/components/darkMask";
import type { GetProjectResponse } from "@/wab/shared/ApiSchema";
import { mock } from "vitest-mock-extended";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { Pt } from "@/wab/shared/geom";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { AlertSpec } from "@/wab/client/components/widgets/plasmic/AlertBanner";
import { StudioSaveState } from "@/wab/client/studio-ctx/save-state";
import { err } from "neverthrow";
import { waitFor } from "@testing-library/react";

async function ready() {
  const fixture = fakeStudioCtx();
  await waitFor(() => expect(fixture.studioCtx.initialRouteReady).toBe(true));
  const studio = fixture.studioCtx;
  const arena = await studio.changeUnsafe(() => studio.addArena("Save inputs"));
  studio["clearUndoLog"]();
  studio.createViewStateUndoRecord();
  const bundle = studio.bundleSite().site;
  studio.bundler().unbundleAndRecomputeParents(bundle, studio.siteInfo.id);
  return { ...fixture, arena };
}

test("preserves status priority, exact alert identity and quiet equal UI inputs", () => {
  const owner = new StudioSaveState();
  const changed = vi.fn(); owner.store.subscribe(changed);
  const initial = owner.store.getState();
  owner.deferPublication(() => { owner.counter = 1; owner.counter = 0; });
  expect(owner.store.getState()).toBe(initial);
  expect(changed).not.toHaveBeenCalled();
  const effects = vi.fn(() => {
    expect(owner.store.getState().isAtTip).toBe(false);
    expect(owner.store.getState().blockChanges).toBe(true);
  }); owner.bindTipEffects(effects);
  owner.counter = 1;
  expect(owner.store.getState().saveStatus).toBe("pending");
  owner.syncAccess(false, true, true);
  expect(owner.store.getState().saveStatus).toBe("blocked");
  owner.saveErrorState = "error";
  expect(owner.store.getState().saveStatus).toBe("error");
  owner.isSaving = true;
  expect(owner.store.getState().saveStatus).toBe("saving");
  owner.isUnlogged = true;
  expect(owner.store.getState().saveStatus).toBe("unlogged");
  owner.isAtTip = false;
  owner.setAlert(AlertSpec.Watch);
  expect(effects).toHaveBeenCalledTimes(2);
  owner.setAlert(AlertSpec.Watch);
  expect(effects).toHaveBeenCalledTimes(2);
  owner.setAlert(AlertSpec.ConcurrentEdit);
  expect(owner.store.getState().banner?.isConcurrentEdit).toBe(true);
  owner.setAlert({ ...AlertSpec.ConcurrentEdit });
  expect(owner.store.getState().banner?.isConcurrentEdit).toBe(false);
  const snapshot = owner.store.getState(); const calls = changed.mock.calls.length;
  owner.setAlert({ ...AlertSpec.ConcurrentEdit });
  expect(owner.store.getState()).toBe(snapshot);
  expect(changed).toHaveBeenCalledTimes(calls);
  expect(effects).toHaveBeenCalledTimes(5);
  owner.dispose();
  const late = vi.fn(); const stopLate = owner.store.subscribe(late);
  owner.counter++;
  expect(owner.store.getState()).toBe(snapshot);
  expect(changed).toHaveBeenCalledTimes(calls);
  expect(late).not.toHaveBeenCalled();
  stopLate();
});

test("installs persistent dirty and history inputs before field/undo/native subscribers, leaving view-only and rejected changes quiet", async () => {
  const { studioCtx: studio, arena } = await ready();
  const field = studio.modelSnapshots.field(arena, "name");
  const counter = studio._changeCounter;
  const committed = vi.fn(() => {
    expect(field.getState()).toBe("Committed save inputs");
    expect(studio._changeCounter).toBe(counter + 1);
    expect(studio.saveState.store.getState().saveStatus).toBe("pending");
    expect(studio.undoLog.store.getState().canUndo).toBe(true);
  });
  const stops = [field.subscribe(committed), studio.undoLog.store.subscribe(committed), studio.saveState.store.subscribe(committed)];
  try {
    await studio.changeUnsafe(() => { arena.name = "Committed save inputs"; });
    expect(committed).toHaveBeenCalledTimes(3);
    committed.mockClear();
    await studio.changeUnsafe(() => undefined);
    expect(committed).not.toHaveBeenCalled();
    const snapshot = studio.saveState.store.getState();
    const result = await studio.change(() => { arena.name = "Rejected"; return err("rejected"); });
    expect(result.isErr()).toBe(true);
    expect(field.getState()).toBe("Committed save inputs");
    expect(studio.saveState.store.getState()).toBe(snapshot);
    expect(committed).not.toHaveBeenCalled();
  } finally { stops.forEach((stop) => stop()); await studio.awaitEval(); studio.dispose(); }
});

test("flushes unlogged changes once and lets both model and history readers observe the committed save sequence", async () => {
  const { studioCtx: studio, arena } = await ready();
  const counter = studio._changeCounter;
  const field = studio.modelSnapshots.field(arena, "name");
  const during = vi.fn(() => {
    expect(studio.saveState.store.getState().isUnlogged).toBe(true);
    expect(studio._changeCounter).toBe(counter);
  });
  const stopField = field.subscribe(during);
  const history = vi.fn(() => {
    expect(studio.saveState.store.getState().isUnlogged).toBe(false);
    expect(studio._changeCounter).toBe(counter + 1);
    expect(studio.saveState.store.getState().saveStatus).toBe("pending");
  });
  const stopHistory = studio.undoLog.store.subscribe(history);
  try {
    studio.startUnlogged();
    await studio.changeUnsafe(() => { arena.name = "Unlogged edit"; });
    expect(during).toHaveBeenCalledOnce();
    expect(history).not.toHaveBeenCalled();
    studio.stopUnlogged();
    expect(history).toHaveBeenCalledOnce();
    expect(studio._changeCounter).toBe(counter + 1);
  } finally { stopField(); stopHistory(); await studio.awaitEval(); studio.dispose(); }
});

test("a successful in-flight save publishes its captured counter before revision listeners and preserves a later edit", async () => {
  const { studioCtx: studio, api, arena } = await ready();
  let finish: (() => void) | undefined;
  api.saveProjectRevChanges.mockImplementationOnce(() => new Promise((resolve) => { finish = () => resolve({}); }));
  await studio.changeUnsafe(() => { arena.name = "Request edit"; });
  const captured = studio._changeCounter;
  const saving = studio.save();
  await waitFor(() => expect(api.saveProjectRevChanges).toHaveBeenCalledOnce());
  await studio.changeUnsafe(() => { arena.name = "Later edit"; });
  const revision = vi.fn(() => {
    expect(studio._savedChangeCounter).toBe(captured);
    expect(studio._changeCounter).toBe(captured + 1);
    expect(studio.saveState.store.getState().hasUnsavedChanges).toBe(true);
    expect(studio.saveState.store.getState().saveStatus).toBe("saving");
  });
  const stop = studio.dbCtx().subscribeVersionInputs(revision);
  try {
    if (!finish) { throw new Error("Save request has not started"); }
    finish(); await saving;
    expect(revision).toHaveBeenCalledOnce();
    expect(studio.saveStatus).toBe("pending");
  } finally { stop(); await studio.awaitEval(); studio.dispose(); clearDarkMask(); }
});


test("undo publishes restored fields and dirty state before waiting for a recreated canvas", async () => {
  // This test owns the iframe's unavailable/mounted state, not physical geometry.
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  const { studioCtx: studio, api, arena } = await ready();
  let release: (() => void) | undefined;
  const originalGetView = studio.tryGetViewCtxForFrame.bind(studio);
  let waiting = false;
  const disposals: (() => void)[] = [];
  try {
    const frame = await studio.changeUnsafe(() => {
      const component = studio.addComponent("Undo target", { type: ComponentType.Plain, noSwitchArena: true });
      return studio.tplMgr().addNewMixedArenaFrame(arena, "Undo frame", component, { width: 100, height: 100, insertPt: Pt.zero() });
    });
    const view = ensure(originalGetView(frame), "Mounted undo view");
    vi.spyOn(view, "scheduleSync").mockImplementation(() => undefined);
    vi.spyOn(view, "awaitSync").mockResolvedValue(undefined);
    vi.spyOn(view, "updateCtxPostChange").mockImplementation(() => undefined);
    studio.setStudioFocusOnFrame({ frame, autoZoom: false });
    studio["clearUndoLog"](); studio.createViewStateUndoRecord();
    const originalName = arena.name;
    await studio.changeUnsafe(() => { arena.name = "Undo changed"; });
    const bundled = studio.bundleSite().site;
    studio.bundler().unbundleAndRecomputeParents(bundled, studio.siteInfo.id);
    api.saveProjectRevChanges.mockResolvedValue({});
    await studio.save();
    const counter = studio._changeCounter;
    const field = studio.modelSnapshots.field(arena, "name");
    vi.spyOn(studio, "tryGetViewCtxForFrame").mockImplementation((target) => target === frame && waiting ? undefined : originalGetView(target));
    vi.spyOn(studio, "awaitViewCtxForFrame").mockImplementation(() => new Promise((resolve) => { release = () => { waiting = false; resolve(view); }; }));
    const readCompleted = vi.fn(() => {
      expect(studio._changeCounter).toBe(counter + 1);
      expect(studio.saveStatus).toBe("pending");
      expect(field.getState()).toBe(originalName);
    });
    disposals.push(field.subscribe(readCompleted));
    waiting = true;
    const undoing = studio.undo();
    await waitFor(() => expect(release).toBeTypeOf("function"));
    expect(readCompleted).toHaveBeenCalledOnce();
    expect(studio._changeCounter).toBe(counter + 1);
    expect(studio.hasUnsavedChanges()).toBe(true);
    await studio.save();
    expect(api.saveProjectRevChanges).toHaveBeenCalledTimes(2);
    expect(studio.hasUnsavedChanges()).toBe(false);
    ensure(release, "Undo canvas wait")();
    await undoing;
    expect(studio.hasUnsavedChanges()).toBe(false);
    expect(readCompleted).toHaveBeenCalledOnce();
    expect(studio._changeCounter).toBe(counter + 1);
  } finally { if (release) { release(); } disposals.forEach((stop) => stop()); await studio.awaitEval(); studio.dispose(); vi.restoreAllMocks(); }
});


test("protection-only metadata installs access before DB listeners and keeps permission overwrites independent of tip", async () => {
  const { studioCtx: studio, api } = await ready();
  const response = (protectedMain: boolean) => Object.assign(mock<GetProjectResponse>(), {
    project: { ...studio.siteInfo }, perms: [], owner: undefined,
    latestRevisionSynced: 0, hasAppAuth: false, appAuthProvider: undefined,
    isMainBranchProtected: protectedMain,
  });
  const version = vi.fn(() => {
    expect(studio.siteInfo.isMainBranchProtected).toBe(true);
    expect(studio.saveState.store.getState().canEditBranch).toBe(false);
    expect(studio.canSave()).toBe(false);
    expect(studio.blockChanges).toBe(true);
    expect(studio.uiEnvironment.store.getState().canEditProject).toBe(true);
  });
  const stop = studio.dbCtx().subscribeVersionInputs(version);
  try {
    api.getSiteInfo.mockResolvedValueOnce(response(true));
    await studio.refreshSiteInfo();
    expect(version).toHaveBeenCalledOnce(); stop();
    studio.setBlockChanges(false);
    studio.appCtx.publishUiEnvironmentInputs();
    expect(studio.blockChanges).toBe(false);
    studio.editMode = false;
    expect(studio.blockChanges).toBe(true);
    studio.setBlockChanges(false);
    api.getSiteInfo.mockResolvedValueOnce(response(false));
    await studio.refreshSiteInfo();
    expect(studio.blockChanges).toBe(false);
    studio.editMode = true;
    expect(studio.canSave()).toBe(true);
    studio.isAtTip = false;
    expect(studio.blockChanges).toBe(true);
    studio.setBlockChanges(false);
    // A new real permission input reruns its existing overwrite policy even
    // while tip remains false; canSave and block are deliberately distinct.
    api.getSiteInfo.mockResolvedValueOnce(response(false));
    await studio.refreshSiteInfo();
    expect(studio.canSave()).toBe(false);
    expect(studio.blockChanges).toBe(false);
  } finally { stop(); await studio.awaitEval(); studio.dispose(); clearDarkMask(); }
});


test("an in-flight save keeps its original failure after dispose while the UI owner stays sealed", async () => {
  const { studioCtx: studio, api, arena } = await ready();
  await studio.changeUnsafe(() => { arena.name = "Pending shutdown save"; });
  let fail: ((error: Error) => void) | undefined;
  api.saveProjectRevChanges.mockImplementationOnce(() => new Promise((_resolve, reject) => { fail = reject; }));
  const saving = studio.save({ noErrorNotification: true });
  const failed = expect(saving).rejects;
  await waitFor(() => expect(api.saveProjectRevChanges).toHaveBeenCalledOnce());
  const snapshot = studio.saveState.store.getState();
  const listener = vi.fn(); studio.saveState.store.subscribe(listener);
  studio.dispose();
  const error = new Error("Original shutdown save failure");
  ensure(fail, "Save request is in flight")(error);
  await failed.toBe(error);
  expect(studio.saveStatus).toBe("error");
  expect(studio.hasUnsavedChanges()).toBe(false); // dispose retains its existing clearUndoLog command.
  expect(studio.saveState.store.getState()).toBe(snapshot);
  expect(listener).not.toHaveBeenCalled();
});


test("editable version install publishes history and site-replaced only after final persistent save metadata", async () => {
  const { studioCtx: studio, api } = await ready();
  const before = studio._changeCounter;
  const bundle = studio.bundleSite().site;
  const release = mock<PkgVersionInfoMeta>({ id: "restored-release", pkgId: "restored-pkg", version: "1.0.0", branchId: null });
  api.getPkgVersion.mockResolvedValueOnce({ pkg: { ...release, model: bundle }, depPkgs: [], etag: "restored-etag" });
  const observeFinal = vi.fn(() => {
    expect(studio.editMode).toBe(true);
    expect(studio._changeCounter).toBe(before + 1);
    expect(studio.hasUnsavedChanges()).toBe(true);
    expect(studio.saveState.store.getState().saveStatus).toBe("pending");
  });
  const stopHistory = studio.versionHistory.store.subscribe((state) => { if (state.selectedReleaseId === release.id) { observeFinal(); } });
  const stopModel = studio.subscribeModelChanges((event) => { if (event.type === "site-replaced") { observeFinal(); } });
  try {
    await act(async () => { await studio["loadVersion"](release, true); });
    expect(observeFinal).toHaveBeenCalledTimes(2);
  } finally { stopHistory(); stopModel(); await studio.awaitEval(); studio.dispose(); await act(async () => { message.destroy(); notification.destroy(); }); }
});
