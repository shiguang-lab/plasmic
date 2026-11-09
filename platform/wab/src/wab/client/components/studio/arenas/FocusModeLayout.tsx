import { CanvasFrame } from "@/wab/client/components/canvas/CanvasFrame";
import { CanvasCtx } from "@/wab/client/components/canvas/canvas-ctx";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { AnyArena, FocusedDedicatedArena, isMixedArena } from "@/wab/shared/Arenas";
import { getSiteArenas } from "@/wab/shared/core/sites";
import type { ModelFieldStore } from "@/wab/client/studio-ctx/model-snapshots";
import { ArenaFrame } from "@/wab/shared/model/classes";
import React from "react";
import { useStore } from "zustand";

export const FocusModeLayout = function FocusModeLayout(props: {
  studioCtx: StudioCtx;
  arena: FocusedDedicatedArena;
  onFrameLoad: (frame: ArenaFrame, canvasCtx: CanvasCtx) => void;
}) {
  const { studioCtx, onFrameLoad, arena } = props;
  const focusedFrame = useArenaFocusedFrame(studioCtx, arena);
  if (!focusedFrame) { return null; }
  return (
    <CanvasFrame
      studioCtx={studioCtx}
      arena={arena}
      key={focusedFrame.uid}
      onFrameLoad={onFrameLoad}
      arenaFrame={focusedFrame}
      isFree={false}
    />
  );
};


const noFocusedFrame: ModelFieldStore<ArenaFrame | undefined> = {
  getState: () => undefined,
  getInitialState: () => undefined,
  subscribe: () => () => undefined,
};

/** Resolve this finite field only within the captured model lifetime. The
 * imperative frame handle remains cached; foreign and closed owners demand no fields. */
export function useArenaFocusedFrame(studio: StudioCtx, arena: AnyArena) {
  const [binding, setBinding] = React.useState(() => ({ studio, arena, source: createArenaFocusedFrameSource(studio, arena) }));
  if (binding.studio !== studio || binding.arena !== arena) { setBinding({ studio, arena, source: createArenaFocusedFrameSource(studio, arena) }); }
  return useStore(binding.source);
}
function createArenaFocusedFrameSource(studio: StudioCtx, arena: AnyArena): ModelFieldStore<ArenaFrame | undefined> {
    if (isMixedArena(arena)) { return noFocusedFrame; }
    const owner = studio.arenaState;
    const lifetime = owner.lifetime();
    if (lifetime.aborted || !owner.isCurrentLifetime(lifetime) || !getSiteArenas(studio.site, { noSorting: true }).includes(arena)) { return noFocusedFrame; }
    const models = studio.modelSnapshots;
    const field = models.field(arena, "_focusedFrame");
    let ref = field.getState();
    let current = ref ? models.resolve(ref) : undefined;
    const initial = current;
    const active = () => !lifetime.aborted && owner.isCurrentLifetime(lifetime);
    const read = () => {
      if (!active()) { return current; }
      const next = field.getState();
      if (next !== ref) { ref = next; current = ref ? models.resolve(ref) : undefined; }
      return current;
    };
    return {
      getState: read,
      getInitialState: () => initial,
      subscribe: (listener) => {
        if (!active()) { return () => undefined; }
        let previous = read();
        const off = field.subscribe(() => {
          const next = read();
          if (next !== previous) { const before = previous; previous = next; listener(next, before); }
        });
        let closed = false;
        const stop = () => { if (!closed) { closed = true; off(); lifetime.removeEventListener("abort", stop); } };
        lifetime.addEventListener("abort", stop, { once: true });
        return stop;
      },
    };

}
