import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import type { PkgVersionInfoMeta } from "@/wab/shared/SharedApi";
import { FrameHeights, useFrameHeight, useFrameHeights } from "@/wab/client/studio-ctx/frame-heights";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { StudioArenaState } from "@/wab/client/studio-ctx/studio-arena-state";
import type { ModelCommit, StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { FrameViewMode, getAutoDerivedFrameHeightStore, getFrameHeight, getArenaFrames, mkArenaFrame, mkMixedArena, peekAutoDerivedFrameHeight, updateAutoDerivedFrameHeight } from "@/wab/shared/Arenas";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensure } from "@/wab/shared/common";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplComponent, mkTplTagX } from "@/wab/shared/core/tpls";
import { instUtil } from "@/wab/shared/model/InstUtil";
import type { ArenaFrame } from "@/wab/shared/model/classes";
import type { ChangeSummary } from "@/wab/shared/model/model-change-util";
import { syncPageArenaFrameSize } from "@/wab/shared/page-arenas";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function fixture() {
  let site = createSite(), models = new ModelSnapshots();
  const page = mkComponent({ name: "Page", type: ComponentType.Page, tplTree: mkTplTagX("div") });
  const plain = mkComponent({ name: "Plain", type: ComponentType.Plain, tplTree: mkTplTagX("div") });
  site.components.push(page, plain);
  const frame = mkArenaFrame({ site, component: page, name: "Measured", width: 200, height: 100 });
  const sibling = mkArenaFrame({ site, component: plain, name: "Authored", viewMode: FrameViewMode.Centered, width: 200, height: 80 });
  site.arenas.push(mkMixedArena("Height", [frame, sibling]));
  let recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil });
  const arena = new StudioArenaState({ get site() { return site; }, get modelSnapshots() { return models; } });
  const studio = mock<StudioCtx>();
  Object.defineProperties(studio, { modelSnapshots: { get: () => models }, arenaState: { value: arena } });
  const listeners = new Set<(event: ModelCommit) => void>();
  let pending = false;
  studio.hasPendingModelChanges.mockImplementation(() => pending);
  studio.subscribeModelChanges.mockImplementation((listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; });
  const heights = new FrameHeights(studio);
  Object.defineProperty(studio, "frameHeights", { value: heights });
  return { studio, heights, arena, frame, sibling, page, plain, listeners,
    get models() { return models; }, get site() { return site; },
    commit(command: () => void) {
      pending = true;
      const changes = recorder.withRecording(command).changes;
      const summary = mock<ChangeSummary>(); summary.changes = changes;
      arena.deferPublication(() => models.deferPublication(() => {
        models.sync(changes, () => {
          arena.prepareModelCommit(changes);
          heights.prepareCommit();
          pending = false;
          listeners.forEach((listener) => listener({ type: "commit", summary }));
        });
      }));
    },
    replace() {
      arena.reset(); heights.resetModelOwner(); models.dispose(); recorder.dispose();
      site = createSite(); models = new ModelSnapshots();
      const component = new TplMgr({ site }).addComponent({ name: "New world", type: ComponentType.Plain });
      const next = mkArenaFrame({ site, component, name: "New world", width: 200, height: 73 });
      site.arenas.push(mkMixedArena("New", [next]));
      recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil }); arena.attachSite();
      return next;
    },
    dispose() { heights.dispose(); arena.dispose(); models.dispose(); recorder.dispose(); },
  };
}

function Height({ studio, frame }: { studio: StudioCtx; frame: ArenaFrame }) {
  return <span data-testid="height">{useFrameHeight(studio, frame)}</span>;
}

it("preserves first-getter presence, latched authored height and page clamp at write time", () => {
  const f = fixture();
  try {
    expect(getAutoDerivedFrameHeightStore(f.frame).getState()).toBeUndefined();
    expect(peekAutoDerivedFrameHeight(f.frame)).toBeUndefined();
    expect(getFrameHeight(f.sibling)).toBe(80);
    expect(peekAutoDerivedFrameHeight(f.sibling)).toBeUndefined();
    expect(getFrameHeight(f.frame)).toBe(100);
    f.frame.height = 140;
    expect(getFrameHeight(f.frame)).toBe(100);
    updateAutoDerivedFrameHeight(f.frame, 10);
    expect(getFrameHeight(f.frame)).toBe(140);
    f.frame.height = 180;
    expect(getFrameHeight(f.frame)).toBe(140);
    f.sibling.viewMode = FrameViewMode.Stretch;
    expect(getFrameHeight(f.sibling)).toBe(80);
    updateAutoDerivedFrameHeight(f.sibling, 20);
    expect(getFrameHeight(f.sibling)).toBe(20);
    expect(f.sibling.height).toBe(80);
  } finally { f.dispose(); }
});

it("propagates only an initialized page anchor measurement across its actual column", () => {
  const site = createSite(), manager = new TplMgr({ site });
  manager.addComponent({ name: "First", type: ComponentType.Page });
  manager.addComponent({ name: "Second", type: ComponentType.Page });
  const first = ensure(site.pageArenas[0], "First page arena"), second = ensure(site.pageArenas[1], "Second page arena");
  const anchor = ensure(getArenaFrames(first)[0], "Anchor"), target = ensure(getArenaFrames(second)[0], "Target");
  anchor.height = 300;
  syncPageArenaFrameSize(site, first, anchor);
  expect(target.height).toBe(300); expect(peekAutoDerivedFrameHeight(target)).toBeUndefined();
  updateAutoDerivedFrameHeight(anchor, 900);
  syncPageArenaFrameSize(site, first, anchor);
  expect(getFrameHeight(target)).toBe(900); expect(target.height).toBe(300);
});

it("keeps abandoned candidates unregistered and releases all committed leases after StrictMode unmount", () => {
  const f = fixture();
  const subscribe = f.models.subscribePreparedField.bind(f.models);
  let active = 0;
  vi.spyOn(f.models, "subscribePreparedField").mockImplementation((field, callback) => {
    const stop = subscribe(field, callback); active++;
    let stopped = false;
    return () => { if (!stopped) { stopped = true; active--; stop(); } };
  });
  const pending = new Promise<void>(() => undefined);
  function Abandoned(): React.ReactNode { useFrameHeight(f.studio, f.frame); throw pending; }
  try {
    const abandoned = render(<React.Suspense fallback={<span>Pending</span>}><Abandoned /></React.Suspense>);
    expect(active).toBe(0); expect(f.listeners.size).toBe(0); expect(f.heights["records"].size).toBe(0);
    abandoned.unmount();
    const mounted = render(<React.StrictMode><Height studio={f.studio} frame={f.frame} /></React.StrictMode>);
    expect(active).toBe(5); expect(f.listeners.size).toBe(1);
    act(() => updateAutoDerivedFrameHeight(f.frame, 450));
    expect(screen.getByTestId("height").textContent).toBe("450");
    mounted.unmount();
    expect(active).toBe(0); expect(f.listeners.size).toBe(0); expect(f.heights["records"].size).toBe(0);
    updateAutoDerivedFrameHeight(f.frame, 500);
    const remounted = render(<Height studio={f.studio} frame={f.frame} />);
    expect(screen.getByTestId("height").textContent).toBe("500");
    remounted.unmount(); expect(active).toBe(0);
  } finally { f.dispose(); }
});

it("installs every same-frame lease before notifying, skips noops and leaves siblings cached", () => {
  const f = fixture();
  const first = f.heights.frameStore(f.frame), second = f.heights.frameStore(f.frame), sibling = f.heights.frameStore(f.sibling);
  expect(second).not.toBe(first);
  const changed = vi.fn(() => { expect(first.getState()).toBe(420); expect(second.getState()).toBe(420); expect(sibling.getState()).toBe(80); });
  const unchanged = vi.fn();
  const stops = [first.subscribe(changed), second.subscribe(changed), sibling.subscribe(unchanged)];
  try {
    updateAutoDerivedFrameHeight(f.frame, 420); expect(changed).toHaveBeenCalledTimes(2);
    updateAutoDerivedFrameHeight(f.frame, 420); expect(changed).toHaveBeenCalledTimes(2); expect(unchanged).not.toHaveBeenCalled();
    stops.forEach((stop) => stop()); stops.forEach((stop) => stop());
    expect(f.listeners.size).toBe(0);
  } finally { stops.forEach((stop) => stop()); f.dispose(); }
});

it("prepares final type, container and authored fields before any deferred model subscriber", () => {
  const f = fixture();
  const page = f.heights.frameStore(f.frame), plain = f.heights.frameStore(f.sibling);
  const off = [page.subscribe(vi.fn()), plain.subscribe(vi.fn())];
  const field = f.models.field(f.frame, "container");
  const inspect = vi.fn(() => { expect(page.getState()).toBe(350); expect(plain.getState()).toBe(210); });
  off.push(field.subscribe(inspect));
  try {
    f.commit(() => { f.frame.container = mkTplComponent(f.plain, f.site.globalVariant); f.frame.viewMode = FrameViewMode.Centered; f.frame.height = 350; f.sibling.height = 210; });
    expect(inspect).toHaveBeenCalledOnce();
    const changed = vi.fn(); off.push(page.subscribe(changed));
    f.commit(() => { f.page.type = ComponentType.Plain; });
    expect(changed).not.toHaveBeenCalled();
    expect(page.getState()).toBe(350);
    const type = f.models.field(f.plain, "type");
    const inspectType = vi.fn(() => { expect(page.getState()).toBe(100); expect(plain.getState()).toBe(210); });
    off.push(type.subscribe(inspectType));
    f.commit(() => { f.plain.type = ComponentType.Page; f.frame.viewMode = FrameViewMode.Stretch; f.frame.height = 400; });
    expect(inspectType).toHaveBeenCalledOnce();
  } finally { off.forEach((stop) => stop()); f.dispose(); }
});

it("seals demanded old-world stores during replacement and disposal without declaring new fields", () => {
  const f = fixture();
  const mounted = render(<Height studio={f.studio} frame={f.frame} />);
  act(() => updateAutoDerivedFrameHeight(f.frame, 380));
  try {
    const next = f.replace();
    const declare = vi.spyOn(f.models, "field"), subscribe = vi.spyOn(f.models, "subscribePreparedField");
    mounted.rerender(<Height studio={f.studio} frame={f.frame} />);
    expect(screen.getByTestId("height").textContent).toBe("380");
    expect(f.heights.frameStore(f.frame).getState()).toBe(380);
    expect(declare).not.toHaveBeenCalled(); expect(subscribe).not.toHaveBeenCalled();
    const foreign = mkArenaFrame({ site: f.site, component: ensure(f.site.components[0], "Component"), name: "Foreign", width: 10, height: 10 });
    expect(() => f.heights.frameStore(foreign)).toThrow("foreign frame"); expect(declare).not.toHaveBeenCalled();
    mounted.rerender(<Height studio={f.studio} frame={next} />);
    expect(screen.getByTestId("height").textContent).toBe("73");
    act(() => f.dispose()); declare.mockClear(); subscribe.mockClear();
    mounted.rerender(<Height studio={f.studio} frame={next} />);
    expect(screen.getByTestId("height").textContent).toBe("73");
    expect(f.heights.frameStore(next).getState()).toBe(73);
    expect(declare).not.toHaveBeenCalled(); expect(subscribe).not.toHaveBeenCalled();
  } finally { mounted.unmount(); f.dispose(); }
});

it("releases a suspended zero-lease candidate without reconnecting to a replaced world", () => {
  const f = fixture(), source = f.heights.frameStore(f.frame);
  f.replace();
  const declare = vi.spyOn(f.models, "field"), subscribe = vi.spyOn(f.models, "subscribePreparedField");
  try {
    expect(f.heights.frameStore(f.frame)).toBe(source);
    source.subscribe(vi.fn())();
    expect(source.getState()).toBe(100); expect(declare).not.toHaveBeenCalled(); expect(subscribe).not.toHaveBeenCalled(); expect(f.listeners.size).toBe(0);
  } finally { f.dispose(); }
});

it("updates a fixed-identity React frame roster from measurement without any authored model write", () => {
  const f = fixture(), frames = [f.frame, f.sibling];
  function Sizes() { return <span data-testid="sizes">{useFrameHeights(f.studio, frames).join(",")}</span>; }
  const mounted = render(<Sizes />);
  try {
    expect(screen.getByTestId("sizes").textContent).toBe("100,80");
    act(() => updateAutoDerivedFrameHeight(f.frame, 680));
    expect(screen.getByTestId("sizes").textContent).toBe("680,80");
    expect(f.frame.height).toBe(100); expect(f.sibling.height).toBe(80);
  } finally { mounted.unmount(); f.dispose(); }
});


it("keeps the demanded old-frame prop terminal across actual Studio loadVersion and close", async () => {
  const site = createSite(), manager = new TplMgr({ site });
  const component = manager.addComponent({ name: "World", type: ComponentType.Plain });
  const frame = mkArenaFrame({ site, component, name: "World", width: 200, height: 150 });
  site.arenas.push(mkMixedArena("World", [frame]));
  const { studioCtx: studio, api } = fakeStudioCtx({ site });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  const mounted = render(<Height studio={studio} frame={frame} />);
  const release = mock<PkgVersionInfoMeta>({ id: "height-world", pkgId: "height-pkg", version: "1.0.0", branchId: null });
  api.getPkgVersion.mockResolvedValueOnce({ pkg: { ...release, model: studio.bundleSite().site }, depPkgs: [], etag: "height-etag" });
  try {
    const oldModels = studio.modelSnapshots;
    await act(async () => { await studio["loadVersion"](release, true); });
    expect(studio.modelSnapshots).not.toBe(oldModels);
    const declare = vi.spyOn(studio.modelSnapshots, "field"), subscribe = vi.spyOn(studio.modelSnapshots, "subscribePreparedField");
    mounted.rerender(<Height studio={studio} frame={frame} />);
    expect(screen.getByTestId("height").textContent).toBe("150");
    expect(studio.frameHeights.frameStore(frame).getState()).toBe(150);
    expect(declare).not.toHaveBeenCalled(); expect(subscribe).not.toHaveBeenCalled();
    act(() => studio.dispose());
    mounted.rerender(<Height studio={studio} frame={frame} />);
    expect(screen.getByTestId("height").textContent).toBe("150");
  } finally { mounted.unmount(); studio.dispose(); }
});
