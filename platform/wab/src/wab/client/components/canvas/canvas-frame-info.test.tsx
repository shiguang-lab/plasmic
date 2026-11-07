import { StudioRenderPolicy } from "@/wab/client/studio-ctx/studio-render-policy";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensure } from "@/wab/shared/common";
import { ValComponent } from "@/wab/shared/core/val-nodes";
import { CanvasFrameInfoOwner } from "@/wab/client/components/canvas/canvas-frame-info";
import { mkCanvas } from "@/wab/client/components/canvas/canvas-rendering";
import { SubDeps } from "@/wab/client/components/canvas/subdeps";
import { ModelCommit } from "@/wab/client/studio-ctx/StudioCtx";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkStyleToken, mkTokenRef } from "@/wab/commons/StyleToken";
import { mkArenaFrame } from "@/wab/shared/Arenas";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { ModelChange } from "@/wab/shared/core/observable-model";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplComponent, mkTplTagX } from "@/wab/shared/core/tpls";
import { ChangeSummary, ChangesType } from "@/wab/shared/model/model-change-util";
import { ObjInst, ProjectDependency, StyleTokenOverride } from "@/wab/shared/model/classes";
import { act, render, waitFor } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";
import { createStore } from "zustand/vanilla";

function fixture(configure?: (site: ReturnType<typeof createSite>, frame: ReturnType<typeof mkArenaFrame>) => void) {
  const site = createSite();
  const component = mkComponent({ name: "Page", type: ComponentType.Page, tplTree: mkTplTagX("div") });
  const frame = mkArenaFrame({ site, component, width: 800, height: 600, name: "Page" });
  configure?.(site, frame);
  const snapshots = new ModelSnapshots();
  const listeners = new Set<(event: ModelCommit) => void>();
  const renderPolicy = new StudioRenderPolicy({ isLive: () => false, isDragging: () => false });
  renderPolicy.installStoredFullPageHeight(true); renderPolicy.prepareInputs(); renderPolicy.publishCommit();
  const mode = {
    get full() { return renderPolicy.fullPageHeight; },
    set full(value: boolean) { renderPolicy.installStoredFullPageHeight(value); renderPolicy.prepareInputs(); },
    get interactive() { return renderPolicy.interactive; },
    set interactive(value: boolean) { renderPolicy.interactive = value; renderPolicy.prepareInputs(); },
    exporting: false, pending: false,
  };
  const studio = {
    modelSnapshots: snapshots, renderPolicy,
    get fullPageHeight() { return mode.full; },
    get isInteractiveMode() { return mode.interactive; },
    hasPendingModelChanges: () => mode.pending,
    currentAppUserStore: createStore(() => ({ appUser: {} })),
    subscribeModelChanges: (listener: (event: ModelCommit) => void) => {
      listeners.add(listener); return () => { listeners.delete(listener); };
    },
  };
  const view = { studioCtx: studio, site, arenaFrame: () => frame,
    get canvasExporting() { return mode.exporting; }, canvasCtx: { doc: () => document }, isDisposed: false,
  } as unknown as ViewCtx;
  const owner = new CanvasFrameInfoOwner(view);
  const change = (inst: ObjInst, field: string): ModelChange => ({
    type: "update", oldValue: undefined, newValue: Reflect.get(inst, field), changeNode: { inst, field },
  });
  const commit = (changes: ModelChange[] = [], cssOnly = false) => {
    snapshots.sync(changes);
    const summary = mock<ChangeSummary>({ changes, changesType: cssOnly ? ChangesType.CssOnly : ChangesType.OtherChanges });
    listeners.forEach((listener) => listener({ type: "commit", summary }));
  };
  return { site, frame, component, snapshots, listeners, mode, view, owner, change, commit,
    dispose: () => { owner.dispose(); renderPolicy.dispose(); snapshots.dispose(); } };
}

it("installs all committed frame fields before publishing and also handles styles-only changes", () => {
  const f = fixture();
  const before = f.owner.store.getState();
  const observed: ReturnType<typeof f.owner.store.getState>[] = [];
  f.owner.store.subscribe((value) => observed.push(value));
  f.mode.pending = true;
  f.mode.full = false;
  f.frame.height = 720; f.frame.bgColor = "#000";
  f.owner.sync();
  f.snapshots.sync([f.change(f.frame, "height"), f.change(f.frame, "bgColor")]);
  expect(f.owner.store.getState()).toBe(before);
  f.commit([], true);
  expect(observed).toEqual([{ ...before, height: 720, bgColor: "#000", fullPageHeight: false }]);
  f.mode.pending = false;
  f.frame.height = 800;
  f.commit([f.change(f.frame, "height")], true);
  expect(f.owner.store.getState().height).toBe(800);
  expect(observed).toHaveLength(2);
  f.dispose();
});

it("retains no-op and unrelated-field snapshots and rebinds a replaced component", () => {
  const f = fixture();
  const notify = vi.fn(); f.owner.store.subscribe(notify);
  const before = f.owner.store.getState();
  f.frame.width = 960;
  f.commit([f.change(f.frame, "width")]);
  f.commit([f.change(f.frame, "height")]);
  f.owner.sync();
  expect(f.owner.store.getState()).toBe(before);
  expect(notify).not.toHaveBeenCalled();
  const replacement = mkComponent({ name: "Card", type: ComponentType.Plain, tplTree: mkTplTagX("section") });
  f.frame.container = mkTplComponent(replacement, replacement.variants[0]);
  f.frame.viewMode = "centered";
  f.commit([f.change(f.frame, "container"), f.change(f.frame, "viewMode")]);
  expect(f.owner.store.getState().isHeightAutoDerived).toBe(false);
  const replaced = f.owner.store.getState();
  f.component.type = "code";
  f.commit([f.change(f.component, "type")]);
  expect(f.owner.store.getState()).toBe(replaced);
  f.frame.viewMode = "stretch";
  f.commit([f.change(f.frame, "viewMode")]);
  expect(f.owner.store.getState().isHeightAutoDerived).toBe(true);
  f.dispose();
});

it("follows only used token values and imported overrides through styles-only commits", () => {
  const library = createSite();
  const used = mkStyleToken({ name: "Used", type: "Color", value: "#111" });
  const other = mkStyleToken({ name: "Other", type: "Color", value: "#222" });
  library.styleTokens.push(used, other);
  const local = mkStyleToken({ name: "Page", type: "Color", value: mkTokenRef(used) });
  const override = new StyleTokenOverride({ token: used, value: "#123", variantedValues: [] });
  const f = fixture((site, frame) => {
    site.projectDependencies.push(new ProjectDependency({ uuid: "library", pkgId: "pkg", projectId: "project", version: "1", name: "Library", site: library }));
    site.styleTokens.push(local); site.styleTokenOverrides.push(override);
    frame.bgColor = mkTokenRef(local);
  });
  expect(f.owner.store.getState().bgColor).toBe("#123");
  const notify = vi.fn(); f.owner.store.subscribe(notify);
  other.value = "#333";
  f.commit([f.change(other, "value")], true);
  expect(notify).not.toHaveBeenCalled();
  override.value = "#456";
  f.commit([f.change(override, "value")], true);
  expect(f.owner.store.getState().bgColor).toBe("#456");
  local.value = mkTokenRef(other);
  f.commit([f.change(local, "value")], true);
  expect(f.owner.store.getState().bgColor).toBe("#333");
  const before = f.owner.store.getState();
  override.value = "#789";
  f.commit([f.change(override, "value")], true);
  expect(f.owner.store.getState()).toBe(before);
  f.frame.bgColor = "#abcdef";
  f.commit([f.change(f.frame, "bgColor")], true);
  const literal = f.owner.store.getState();
  other.value = "#defdef";
  f.commit([f.change(other, "value")], true);
  expect(f.owner.store.getState()).toBe(literal);
  f.frame.bgColor = null;
  f.commit([f.change(f.frame, "bgColor")], true);
  expect(f.owner.store.getState().bgColor).toBeUndefined();
  f.dispose();
});

it("updates the existing React frame through native inputs without canvas observers or wrapper nodes", () => {
  const f = fixture();
  const Frame = mkCanvas({ React } as SubDeps, f.view);
  const child = <span data-testid="content">Content</span>;
  const view = render(<React.StrictMode><Frame frameInfo={f.owner.store}>{child}</Frame></React.StrictMode>);
  const root = view.container.firstElementChild;
  expect(root?.classList.contains("__wab_root--full-height")).toBe(true);
  expect(root?.children).toHaveLength(1);
  expect(root?.firstElementChild).toBe(view.getByTestId("content"));
  act(() => { f.mode.interactive = true; f.owner.sync(); });
  expect(root?.classList.contains("__wab_root--full-height")).toBe(false);
  act(() => { f.mode.interactive = false; f.mode.exporting = true; f.owner.sync(); });
  expect(root?.classList.contains("__wab_root--full-height")).toBe(false);
  act(() => { f.mode.exporting = false; f.owner.sync(); });
  expect(root?.classList.contains("__wab_root--full-height")).toBe(true);
  act(() => { f.mode.full = false; f.owner.sync(); });
  expect(root?.classList.contains("__wab_root--full-height")).toBe(false);
  act(() => { f.frame.bgColor = "#123456"; f.commit([f.change(f.frame, "bgColor")], true); });
  expect(document.body.style.backgroundColor).toBe("rgb(18, 52, 86)");
  view.unmount(); f.dispose();
  expect(f.listeners.size).toBe(0);
  const stopped = vi.fn(); f.owner.store.subscribe(stopped);
  f.frame.height = 900; f.commit([f.change(f.frame, "height")]); f.owner.sync();
  expect(stopped).not.toHaveBeenCalled();
  document.body.style.backgroundColor = "";
});


it.each(["height", "background", "used-token"] as const)(
  "publishes %s in the committed event while demanded field notifications are deferred",
  (kind) => {
    const token = mkStyleToken({ name: "Frame background", type: "Color", value: "#111" });
    const f = fixture((site, frame) => { site.styleTokens.push(token); frame.bgColor = mkTokenRef(token); });
    const field = kind === "used-token" ? f.snapshots.field(token, "value") : kind === "height" ? f.snapshots.field(f.frame, "height") : f.snapshots.field(f.frame, "bgColor");
    const fieldNotify = vi.fn(); const stop = field.subscribe(fieldNotify);
    const notify = vi.fn(); f.owner.store.subscribe(notify);
    const before = f.owner.store.getState();
    f.mode.pending = true;
    const changes: ModelChange[] = [];
    if (kind === "height") { f.frame.height = 720; changes.push(f.change(f.frame, "height")); }
    else if (kind === "background") { f.frame.bgColor = "#abcdef"; changes.push(f.change(f.frame, "bgColor")); }
    else { token.value = "#222"; changes.push(f.change(token, "value")); }
    try {
      f.snapshots.deferPublication(() => {
        f.snapshots.sync(changes);
        expect(field.getState()).toBe(kind === "height" ? 720 : kind === "background" ? "#abcdef" : "#222");
        expect(fieldNotify).not.toHaveBeenCalled();
        expect(f.owner.store.getState()).toBe(before);
        f.commit([], true);
        expect(f.owner.store.getState()).toEqual({ ...before, ...(kind === "height" ? { height: 720 } : { bgColor: kind === "background" ? "#abcdef" : "#222" }) });
        expect(notify).toHaveBeenCalledOnce();
      });
      expect(fieldNotify).toHaveBeenCalledOnce();
      const committed = f.owner.store.getState();
      f.commit([], true);
      expect(f.owner.store.getState()).toBe(committed);
      expect(notify).toHaveBeenCalledOnce();
    } finally { stop(); f.dispose(); }
  },
);

it("updates actual Studio CSS-only token commits without evaluating the frame or running its view-input sync", async () => {
  const schedule = vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined);
  const site = createSite();
  const component = new TplMgr({ site }).addComponent({ name: "Frame info", type: ComponentType.Page });
  const token = mkStyleToken({ name: "Frame background", type: "Color", value: "#123456" });
  site.styleTokens.push(token);
  const { studioCtx: studio } = fakeStudioCtx({ site });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  const arena = ensure(site.pageArenas.find((candidate) => candidate.component === component), "Dedicated page arena");
  vi.spyOn(studio, "tryZoomToFitArena").mockImplementation(() => undefined);
  studio.switchToArena(arena);
  const frame = ensure(arena.matrix.rows[0]?.cols[0]?.frame, "Dedicated page frame");
  const view = ensure(studio.tryGetViewCtxForFrame(frame), "Actual frame view");
  vi.spyOn(view, "awaitSync").mockResolvedValue(undefined);
  const root = new ValComponent({ tpl: frame.container, frameUid: frame.uid, key: "FrameInfoRoot", fullKey: "FrameInfoRoot", valOwner: undefined, parent: undefined, fibers: [], className: "", slotInfo: undefined, slotArgs: new Map(), slotCanvasEnvs: new Map() });
  view.frameState.valRootStore.setState(root, true);
  await studio.awaitEval();
  await studio.changeUnsafe(() => { frame.bgColor = mkTokenRef(token); });
  const owner = new CanvasFrameInfoOwner(view);
  const notify = vi.fn(); owner.store.subscribe(notify);
  const read = vi.fn((event: ModelCommit) => {
    if (event.type === "commit") {
      expect(event.summary.changesType).toBe(ChangesType.CssOnly);
      expect(owner.store.getState().bgColor).toBe("#abcdef");
    }
  });
  const stop = studio.subscribeModelChanges(read);
  const syncFrame = vi.fn<ViewCtx["canvasCtx"]["syncFrameInfo"]>();
  view.canvasCtx.syncFrameInfo = syncFrame;
  schedule.mockClear(); syncFrame.mockClear();
  try {
    await studio.changeUnsafe(() => { token.value = "#abcdef"; });
    expect(view.isDisposed).toBe(false);
    expect(studio.viewCtxs).toContain(view);
    expect(read).toHaveBeenCalledOnce();
    expect(notify).toHaveBeenCalledOnce();
    expect(syncFrame).not.toHaveBeenCalled();
    expect(schedule).toHaveBeenCalledWith(expect.objectContaining({ eval: false }));
  } finally { stop(); owner.dispose(); studio.dispose(); vi.restoreAllMocks(); }
});


it("keeps completed frame publication silent when prepared mode changes restore the published output", () => {
  const f = fixture();
  const before = f.owner.store.getState(), notified = vi.fn();
  const stop = f.owner.store.subscribe(notified);
  try {
    f.mode.interactive = true;
    const first = f.owner.prepare();
    expect(f.owner.store.getState().fullPageHeight).toBe(false);
    expect(notified).not.toHaveBeenCalled();
    f.mode.interactive = false;
    const final = f.owner.prepare();
    expect(f.owner.store.getState()).toBe(before);
    first(); final();
    expect(notified).not.toHaveBeenCalled();
    f.owner.dispose(); first(); final();
    expect(notified).not.toHaveBeenCalled();
  } finally { stop(); f.dispose(); }
});


it("publishes exact export mode even when full-content geometry is already unchanged", () => {
  const f = fixture();
  f.mode.full = false; f.owner.sync();
  const initial = f.owner.store.getState(), changed = vi.fn();
  f.owner.store.subscribe(changed);
  expect(initial.exporting).toBe(false); expect(initial.fullPageHeight).toBe(false);
  f.mode.exporting = true;
  const publish = f.owner.prepare();
  expect(f.owner.store.getState().exporting).toBe(true);
  expect(f.owner.store.getState().fullPageHeight).toBe(false);
  expect(changed).not.toHaveBeenCalled();
  publish(); expect(changed).toHaveBeenCalledOnce();
  const exported = f.owner.store.getState(); f.owner.sync();
  expect(f.owner.store.getState()).toBe(exported); expect(changed).toHaveBeenCalledOnce();
  f.dispose();
  expect(f.owner.store.getState()).toBe(exported);
});
