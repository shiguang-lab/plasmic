import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { StudioArenaState } from "@/wab/client/studio-ctx/studio-arena-state";
import { getArenaFrames, mkArenaFrame, mkMixedArena, setFocusedFrame } from "@/wab/shared/Arenas";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensure } from "@/wab/shared/common";
import { mkComponentArena } from "@/wab/shared/component-arenas";
import { ComponentType } from "@/wab/shared/core/components";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { createSite } from "@/wab/shared/core/sites";
import { instUtil } from "@/wab/shared/model/InstUtil";

function setup() {
  let site = createSite();
  let models = new ModelSnapshots();
  const component = new TplMgr({ site }).addComponent({ name: "Native", type: ComponentType.Plain });
  const arenas = Array.from({ length: 7 }, (_, index) => mkMixedArena(`Arena ${index}`, [mkArenaFrame({ site, component, name: `Frame ${index}`, width: 100, height: 100 })]));
  site.arenas.push(...arenas);
  const dedicated = mkComponentArena({ site, component });
  site.componentArenas.push(dedicated);
  const recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil });
  const owner = new StudioArenaState({ get site() { return site; }, get modelSnapshots() { return models; } });
  return { owner, arenas, component, dedicated, recorder, get site() { return site; }, get models() { return models; },
    commit(command: () => void) {
      const changes = recorder.withRecording(command).changes;
      owner.deferPublication(() => { models.sync(changes, () => owner.prepareModelCommit(changes)); });
    },
    replace() { recorder.dispose(); owner.reset(); models.dispose(); site = createSite(); models = new ModelSnapshots(); owner.attachSite(); },
    dispose() { owner.dispose(); models.dispose(); recorder.dispose(); },
  };
}

it("installs current, history, frames and demanded statuses before any publication", () => {
  const f = setup();
  const [first, second] = f.arenas;
  const firstStatus = f.owner.statusStore(first);
  const secondStatus = f.owner.statusStore(second);
  const observe = vi.fn(() => {
    const state = f.owner.store.getState();
    expect(state.current).toBe(f.models.ref(second));
    expect(state.frames).toEqual(getArenaFrames(second).map((frame) => f.models.ref(frame)));
    expect(firstStatus.getState()).toBe("cached");
    expect(secondStatus.getState()).toBe("visible");
  });
  const off: (() => void)[] = [];
  try {
    f.owner.transaction(() => { f.owner.setCurrent(first); f.owner.activate(first, 1); });
    off.push(f.owner.store.subscribe(observe), firstStatus.subscribe(observe), secondStatus.subscribe(observe));
    f.owner.deferPublication(() => f.owner.transaction(() => {
      f.owner.setCurrent(second); f.owner.activate(second, 2);
      expect(f.owner.currentArena()).toBe(second);
    }));
    expect(observe).toHaveBeenCalledTimes(3);
    const previous = f.owner.store.getState();
    f.owner.transaction(() => { f.owner.setCurrent(second); f.owner.activate(second, 2); });
    expect(f.owner.store.getState()).toBe(previous);
    expect(observe).toHaveBeenCalledTimes(3);
  } finally { off.forEach((stop) => stop()); f.dispose(); }
});

it("restores nested failed commands and prepared snapshots without publishing partial history or status", () => {
  const f = setup(); const [first, second, third] = f.arenas;
  const firstStatus = f.owner.statusStore(first); const secondStatus = f.owner.statusStore(second);
  f.owner.transaction(() => { f.owner.setCurrent(first); f.owner.activate(first, 1); });
  const snapshot = f.owner.store.getState(); const changed = vi.fn();
  const off = [f.owner.store.subscribe(changed), firstStatus.subscribe(changed), secondStatus.subscribe(changed)];
  try {
    expect(() => f.owner.deferPublication(() => f.owner.transaction(() => {
      f.owner.setCurrent(second); f.owner.activate(second, 2); f.owner.prepareCommit();
      try { f.owner.transaction(() => { f.owner.setCurrent(third); f.owner.activate(third, 3); throw new Error("nested"); }); } catch (error) { expect(error).toEqual(new Error("nested")); }
      expect(f.owner.currentArena()).toBe(second);
      throw new Error("outer");
    }))).toThrow("outer");
    expect(f.owner.store.getState()).toBe(snapshot);
    expect(f.owner.currentArena()).toBe(first);
    expect(f.owner.recentArenas()).toEqual([first]);
    expect(firstStatus.getState()).toBe("visible"); expect(secondStatus.getState()).toBe("dead");
    expect(changed).not.toHaveBeenCalled();
  } finally { off.forEach((stop) => stop()); f.dispose(); }
});

it("prepares model-field cross-source reads and ignores unrelated names while pruning deleted arenas", () => {
  const f = setup(); const [first, second] = f.arenas;
  f.owner.transaction(() => { f.owner.setCurrent(first); f.owner.activate(first, 1); });
  const status = f.owner.statusStore(first); const changed = vi.fn(); f.owner.store.subscribe(changed);
  const field = f.models.field(first, "name");
  const stop = field.subscribe(() => expect(f.owner.store.getState().name).toBe("Renamed arena"));
  try {
    f.commit(() => { second.name = "A sorting change"; });
    expect(changed).not.toHaveBeenCalled();
    f.commit(() => { first.name = "Renamed arena"; });
    expect(changed).toHaveBeenCalledOnce();
    f.commit(() => { f.site.arenas.splice(f.site.arenas.indexOf(first), 1); });
    expect(f.owner.store.getState().current).toBeNull();
    expect(f.owner.store.getState().recent).toEqual([]);
    expect(status.getState()).toBe("dead");
    f.commit(() => { f.site.arenas.push(first); });
    f.owner.transaction(() => { f.owner.setCurrent(first); f.owner.activate(first, 3); });
    expect(status.getState()).toBe("visible");
  } finally { stop(); f.dispose(); }
});

it("keeps hidden dedicated grid membership and swaps the focused frame roster precisely", () => {
  const f = setup();
  try {
    f.owner.transaction(() => { f.owner.setCurrent(f.dedicated); f.owner.activate(f.dedicated, 1); });
    const originalFrames = f.owner.store.getState().frames;
    const originalMembership = f.owner.frameMembershipStore.getState();
    f.commit(() => { setFocusedFrame(f.site, f.dedicated); });
    const focused = ensure(f.dedicated._focusedFrame, "Focused frame");
    expect(f.owner.store.getState().focusedMode).toBe(true);
    expect(f.owner.store.getState().frames).toEqual([f.models.ref(focused)]);
    for (const frame of originalFrames) { expect(f.owner.frameMembershipStore.getState()).toContain(frame); }
    expect(f.owner.frameMembershipStore.getState().length).toBe(originalMembership.length + 1);
    f.commit(() => { f.dedicated._focusedFrame = undefined; });
    expect(f.owner.store.getState().focusedMode).toBe(false);
    expect(f.owner.store.getState().frames).toEqual(originalFrames);
    f.commit(() => { focused.width += 1; });
    expect(f.owner.store.getState().frames).toEqual(originalFrames);
  } finally { f.dispose(); }
});

it("preserves max-five recents, background-first LRU and pin exclusion after slicing", () => {
  const f = setup(); const [first, background, current] = f.arenas;
  try {
    for (const arena of f.arenas) { f.owner.setCurrent(arena); }
    expect(f.owner.recentArenas()).toEqual(f.arenas.slice(2));
    f.owner.setCurrent(f.arenas[3]);
    expect(f.owner.recentArenas()).toEqual([f.arenas[2], f.arenas[4], f.arenas[5], f.arenas[6], f.arenas[3]]);
    f.owner.transaction(() => { f.owner.setCurrent(first); f.owner.activate(first, 1); f.owner.ensureBackground(background, 2); f.owner.setCurrent(current); f.owner.activate(current, 3); });
    const unpin = f.owner.pinBackground(background);
    expect(f.owner.collect(2)).toBe(true);
    expect(f.owner.getStatus(first)).toBe("cached"); expect(f.owner.getStatus(background)).toBe("background");
    unpin(); f.owner.collect(2);
    expect(f.owner.getStatus(first)).toBe("cached"); expect(f.owner.getStatus(background)).toBe("dead");
    expect(f.owner.getStatus(current)).toBe("visible");
  } finally { f.dispose(); }
});

it("leaves retained old status resources terminal and rejects stale leases across Site replacement and disposal", () => {
  const f = setup(); const [first, second] = f.arenas;
  f.owner.transaction(() => { f.owner.setCurrent(first); f.owner.activate(first, 1); f.owner.ensureBackground(second, 2); });
  const status = f.owner.statusStore(first); const oldRelease = f.owner.pinBackground(second); const lifetime = f.owner.lifetime();
  const terminal = vi.fn(() => { expect(status.getState()).toBe("dead"); expect(f.owner.store.getState().current).toBeNull(); }); status.subscribe(terminal);
  try {
    f.owner.deferPublication(() => f.replace());
    expect(terminal).toHaveBeenCalledOnce(); expect(f.owner.isCurrentLifetime(lifetime)).toBe(false);
    expect(f.owner.statusStore(first)).toBe(status); expect(status.getState()).toBe("dead");
    expect(f.owner.statusStore(second).getState()).toBe("dead");
    expect(() => status.subscribe(vi.fn())()).not.toThrow();
    oldRelease(); expect(f.owner.store.getState().current).toBeNull();
    expect(() => f.owner.setCurrent(first)).toThrow("another model owner");
    f.owner.dispose(); expect(f.owner.store.getState().frames).toEqual([]); expect(status.getState()).toBe("dead");
    oldRelease(); expect(terminal).toHaveBeenCalledOnce();
  } finally { f.dispose(); }
});

it("publishes reset UI before cancelling old resources while retaining an immediately stale lifetime identity", () => {
  const f = setup(); const first = f.arenas[0];
  f.owner.setCurrent(first);
  const lifetime = f.owner.lifetime(); const order: string[] = [];
  const stop = f.owner.store.subscribe(() => order.push("ui-reset"));
  lifetime.addEventListener("abort", () => { expect(f.owner.store.getState().current).toBeNull(); order.push("resource-dispose"); }, { once: true });
  try {
    f.owner.deferResourceDisposal(() => f.owner.deferPublication(() => {
      f.owner.reset();
      expect(f.owner.isCurrentLifetime(lifetime)).toBe(false);
      expect(lifetime.aborted).toBe(false);
      expect(order).toEqual([]);
    }));
    expect(order).toEqual(["ui-reset", "resource-dispose"]);
    expect(lifetime.aborted).toBe(true);
    expect(f.owner.readinessStore.getState()).toBe(false);
  } finally { stop(); f.dispose(); }
});
