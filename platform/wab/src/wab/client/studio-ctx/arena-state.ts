import type { ViewRegistryEntry, ViewRegistrySnapshot } from "@/wab/client/studio-ctx/studio-view-registry";
import type { ArenaFrame, Component } from "@/wab/shared/model/classes";
import type { StudioArenaSnapshot, StudioArenaState } from "@/wab/client/studio-ctx/studio-arena-state";
import type { AnyArena } from "@/wab/shared/Arenas";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

type ArenaSource = { readonly arenaState: Pick<StudioArenaState, "store" | "statusStore"> };

const emptyStudioArena = createStore<StudioArenaSnapshot>(() => Object.freeze({
  current: null,
  kind: null,
  name: "",
  focusedMode: false,
  frames: Object.freeze([]),
  recent: Object.freeze([]),
}));

/** Arena identity and UI projections; mutable models remain command handles. */
export function useStudioArena<Selected>(studio: ArenaSource | undefined, selector: (state: StudioArenaSnapshot) => Selected): Selected {
  return useStore(studio ? studio.arenaState.store : emptyStudioArena, selector);
}

export function subscribeStudioArena<Selected>(studio: ArenaSource, selector: (state: StudioArenaSnapshot) => Selected, listener: (next: Selected, previous: Selected) => void) {
  let current = selector(studio.arenaState.store.getState());
  return studio.arenaState.store.subscribe((state) => {
    const next = selector(state);
    if (!Object.is(current, next)) {
      const previous = current;
      current = next;
      listener(next, previous);
    }
  });
}

/** Status is demanded per arena, so unrelated cached arenas do not rerender. */
export function useArenaStatus(studio: ArenaSource, arena: AnyArena) {
  return useStore(studio.arenaState.statusStore(arena));
}

const emptyViewRegistry = createStore<ViewRegistrySnapshot>(() => Object.freeze([]));
const notReady = createStore<boolean>(() => false);
type ViewSource = { readonly arenaState: Pick<StudioArenaState, "viewRegistry"> };

export function useViewRegistry<Selected>(studio: ViewSource | undefined, selector: (entries: ViewRegistrySnapshot) => Selected): Selected {
  return useStore(studio ? studio.arenaState.viewRegistry.store : emptyViewRegistry, selector);
}

export function subscribeViewRegistry<Selected>(studio: ViewSource, selector: (entries: ViewRegistrySnapshot) => Selected, listener: (next: Selected, previous: Selected) => void) {
  let current = selector(studio.arenaState.viewRegistry.store.getState());
  return studio.arenaState.viewRegistry.store.subscribe((entries) => {
    const next = selector(entries);
    if (!Object.is(current, next)) {
      const previous = current; current = next; listener(next, previous);
    }
  });
}

export function useViewEntryForFrame(studio: ViewSource | undefined, frame: ArenaFrame | undefined): ViewRegistryEntry | undefined {
  const registry = studio?.arenaState.viewRegistry;
  return useViewRegistry(studio, (entries) => registry?.selectFrame(entries, frame));
}

export function useViewEntryForComponent(studio: ViewSource | undefined, component: Component | undefined): ViewRegistryEntry | undefined {
  const registry = studio?.arenaState.viewRegistry;
  return useViewRegistry(studio, (entries) => registry?.selectComponent(entries, component));
}

export function useViewReady(entry: ViewRegistryEntry | undefined): boolean {
  return useStore(entry ? entry.ready : notReady);
}
