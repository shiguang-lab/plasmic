import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { StudioViewRegistry } from "@/wab/client/studio-ctx/studio-view-registry";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ComponentType } from "@/wab/shared/core/components";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { createSite } from "@/wab/shared/core/sites";
import { ArenaFrame } from "@/wab/shared/model/classes";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { mock } from "vitest-mock-extended";
import { createStore } from "zustand/vanilla";

function setup() {
  const site = createSite();
  let models = new ModelSnapshots();
  let lifetime = new AbortController();
  const component = new TplMgr({ site }).addComponent({ name: "First", type: ComponentType.Plain });
  const other = new TplMgr({ site }).addComponent({ name: "Second", type: ComponentType.Plain });
  const frame = mkArenaFrame({ site, component, width: 100, height: 100, name: "First" });
  const sibling = mkArenaFrame({ site, component, width: 100, height: 100, name: "Second" });
  site.arenas.push(mkMixedArena("Views", [frame, sibling]));
  const ownedViews = new WeakSet<ViewCtx>();
  const registry = new StudioViewRegistry({ get modelSnapshots() { return models; }, lifetime: () => lifetime.signal, ownsView: (view) => ownedViews.has(view) });
  const recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil });
  const view = (target: ArenaFrame) => {
    const result = mock<ViewCtx>();
    const ready = createStore<boolean>(() => false);
    result.arenaFrame.mockReturnValue(target);
    Object.defineProperties(result, {
      component: { get: () => target.container.component },
      modelLifetime: { value: lifetime.signal },
      isDisposed: { value: false },
      initialRenderReadyStore: { value: ready },
      initialRenderReady: { get: () => ready.getState() },
    });
    ownedViews.add(result);
    return { view: result, ready };
  };
  return { site, component, other, frame, sibling, registry, view, get models() { return models; },
    commit(command: () => void) {
      const { changes } = recorder.withRecording(command);
      registry.deferPublication(() => models.deferPublication(() => {
        models.sync(changes, () => registry.prepareCommit());
      }));
    },
    replace() {
      registry.reset(); lifetime.abort(); models.dispose(); models = new ModelSnapshots(); lifetime = new AbortController(); registry.attachSite();
    },
    dispose() { registry.dispose(); models.dispose(); recorder.dispose(); },
  };
}

it("preserves first-match order and shares the original per-view readiness source without roster notifications", () => {
  const f = setup(); const first = f.view(f.frame); const second = f.view(f.sibling);
  try {
    const entry = f.registry.register(first.view);
    const views = f.registry.commandViews(); const state = f.registry.store.getState();
    expect(f.registry.register(first.view)).toBe(entry);
    expect(f.registry.store.getState()).toBe(state); expect(f.registry.commandViews()).toBe(views);
    expect(entry.ready).toBe(first.view.initialRenderReadyStore);
    expect(Object.isFrozen(entry)).toBe(true); expect(Object.isFrozen(state)).toBe(true);
    const changed = vi.fn(); const off = f.registry.store.subscribe(changed);
    first.ready.setState(true, true);
    expect(entry.ready.getState()).toBe(true); expect(first.view.initialRenderReady).toBe(true);
    expect(changed).not.toHaveBeenCalled();
    const next = f.registry.register(second.view);
    expect(f.registry.forComponent(f.component)).toBe(entry);
    expect(f.registry.selectComponent(state, f.component)).toBe(entry);
    expect(f.registry.selectFrame(state, f.sibling)).toBeUndefined();
    expect(f.registry.store.getState()).toEqual([entry, next]);
    expect(f.registry.forFrame(f.sibling)).toBe(next);
    f.registry.remove(first.view);
    expect(f.registry.forComponent(f.component)).toBe(next);
    const current = f.registry.store.getState(); f.registry.remove(first.view);
    expect(f.registry.store.getState()).toBe(current);
    off();
  } finally { f.dispose(); }
});

it("prepares exact component replacements before delayed model-field subscribers and preserves siblings", () => {
  const f = setup(); const first = f.view(f.frame); const second = f.view(f.sibling);
  const entry = f.registry.register(first.view); const sibling = f.registry.register(second.view);
  const componentField = f.models.field(f.frame.container, "component");
  const changed = vi.fn(); const offRegistry = f.registry.store.subscribe(changed);
  const read = vi.fn(() => {
    const current = f.registry.forFrame(f.frame);
    expect(current?.component).toBe(f.models.ref(f.other));
    expect(current?.ready).toBe(entry.ready); expect(current?.view).toBe(first.view);
    expect(f.registry.forComponent(f.component)).toBe(sibling);
    expect(f.registry.forComponent(f.other)).toBe(current);
    expect(f.registry.forFrame(f.sibling)).toBe(sibling);
  });
  const offField = componentField.subscribe(read);
  try {
    f.commit(() => { f.component.name = "Unrelated label"; });
    expect(changed).not.toHaveBeenCalled();
    f.commit(() => { f.frame.container.component = f.other; });
    expect(read).toHaveBeenCalledOnce(); expect(changed).toHaveBeenCalledOnce();
    expect(entry.component).toBe(f.models.ref(f.component));
    const before = f.registry.forFrame(f.frame);
    const replacementContainer = mkArenaFrame({ site: f.site, component: f.other, width: 100, height: 100, name: "Replacement" }).container;
    f.commit(() => { f.frame.container = replacementContainer; });
    expect(f.registry.forFrame(f.frame)).toBe(before);
    f.commit(() => { replacementContainer.component = f.component; });
    expect(f.registry.forFrame(f.frame)?.component).toBe(f.models.ref(f.component));
    expect(f.registry.forFrame(f.sibling)).toBe(sibling);
  } finally { offField(); offRegistry(); f.dispose(); }
});

it("restores nested prepared membership and original entries without publishing or retaining abandoned subscriptions", () => {
  const f = setup(); const first = f.view(f.frame); const second = f.view(f.sibling);
  const entry = f.registry.register(first.view); const state = f.registry.store.getState(); const views = f.registry.commandViews();
  const changed = vi.fn(); const off = f.registry.store.subscribe(changed);
  try {
    expect(() => f.registry.deferPublication(() => f.registry.transaction(() => {
      f.registry.remove(first.view); f.registry.register(second.view);
      try {
        f.registry.transaction(() => { f.registry.remove(second.view); f.registry.register(first.view); throw new Error("nested"); });
      } catch (error) { expect(error).toEqual(new Error("nested")); }
      expect(f.registry.forFrame(f.sibling)?.view).toBe(second.view);
      expect(f.registry.forFrame(f.frame)).toBeUndefined();
      throw new Error("outer");
    }))).toThrow("outer");
    expect(f.registry.store.getState()).toBe(state); expect(f.registry.commandViews()).toBe(views);
    expect(f.registry.forFrame(f.frame)).toBe(entry); expect(f.registry.forFrame(f.sibling)).toBeUndefined();
    expect(changed).not.toHaveBeenCalled();
    f.commit(() => { f.frame.container.component = f.other; });
    expect(f.registry.forFrame(f.frame)?.component).toBe(f.models.ref(f.other));
    expect(changed).toHaveBeenCalledOnce();
  } finally { off(); f.dispose(); }
});

it("admits current background resources and rejects retired registrations before touching new model fields", () => {
  const f = setup();
  const backgroundFrame = mkArenaFrame({ site: f.site, component: f.component, width: 100, height: 100, name: "Not an arena member" });
  const background = f.view(backgroundFrame); const old = f.registry.register(background.view);
  try {
    expect(f.registry.forFrame(backgroundFrame)).toBe(old);
    f.replace();
    const fields = vi.spyOn(f.models, "field"); const refs = vi.spyOn(f.models, "ref");
    const container = backgroundFrame.container;
    const readContainer = vi.fn(() => container);
    Object.defineProperty(backgroundFrame, "container", { get: readContainer, configurable: true });
    expect(f.registry.store.getState()).toEqual([]);
    expect(f.registry.forFrame(backgroundFrame)).toBeUndefined();
    expect(() => f.registry.register(background.view)).toThrow("another canvas lifetime");
    expect(fields).not.toHaveBeenCalled(); expect(refs).not.toHaveBeenCalled();
    expect(readContainer).not.toHaveBeenCalled();
    const fresh = f.view(f.frame); f.registry.register(fresh.view);
    f.registry.dispose(); fields.mockClear(); refs.mockClear();
    expect(() => f.registry.register(fresh.view)).toThrow("inactive registry");
    expect(fields).not.toHaveBeenCalled(); expect(refs).not.toHaveBeenCalled();
    expect(old.ready).toBe(background.view.initialRenderReadyStore);
  } finally { f.dispose(); }
});


it("publishes terminal empty state during a deferred failed command and cannot restore its old world", () => {
  const f = setup(); const first = f.view(f.frame); f.registry.register(first.view);
  const changed = vi.fn(() => expect(f.registry.store.getState()).toEqual([]));
  const off = f.registry.store.subscribe(changed);
  try {
    expect(() => f.registry.deferPublication(() => f.registry.transaction(() => {
      f.registry.dispose();
      expect(changed).toHaveBeenCalledOnce();
      throw new Error("closed command");
    }))).toThrow("closed command");
    expect(f.registry.forFrame(f.frame)).toBeUndefined();
    expect(f.registry.commandViews()).toEqual([]);
    expect(changed).toHaveBeenCalledOnce();
    const afterClose = vi.fn(); const stop = f.registry.store.subscribe(afterClose);
    expect(() => f.registry.register(first.view)).toThrow("inactive registry");
    expect(afterClose).not.toHaveBeenCalled(); stop();
  } finally { off(); f.dispose(); }
});
