import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ModelFieldStore } from "@/wab/client/studio-ctx/model-snapshots";
import type { ArenaFrame } from "@/wab/shared/model/classes";
import { assert } from "@/wab/shared/common";
import { useMemo } from "react";
import { useStore } from "zustand";

// A known frame keeps its captured primitive source across final renders and
// remounts. New demands must belong to this Studio's current model lifetime.
const frameWidths = new WeakMap<StudioCtx, WeakMap<ArenaFrame, ModelFieldStore<number>>>();
function frameWidthSource(studio: StudioCtx, frame: ArenaFrame): ModelFieldStore<number> {
  let frames = frameWidths.get(studio);
  const cached = frames?.get(frame);
  if (cached) { return cached; }
  const arena = studio.arenaState, lifetime = arena.lifetime();
  assert(!lifetime.aborted && arena.isCurrentLifetime(lifetime), "Cannot demand frame width from a departed arena lifetime");
  const models = studio.modelSnapshots;
  const member = arena.frameMembershipStore.getState().find((ref) => ref.uid === frame.uid);
  assert(member && models.resolve(member) === frame, "Cannot attach a foreign frame to the current width source");
  const field = models.field(frame, "width");
  const source: ModelFieldStore<number> = {
    getState: field.getState,
    getInitialState: field.getInitialState,
    subscribe: (listener) => {
      if (lifetime.aborted || !arena.isCurrentLifetime(lifetime)) { return () => undefined; }
      const off = field.subscribe(listener);
      let closed = false;
      const stop = () => {
        if (closed) { return; }
        closed = true; off(); lifetime.removeEventListener("abort", stop);
      };
      lifetime.addEventListener("abort", stop, { once: true });
      return stop;
    },
  };
  if (!frames) { frames = new WeakMap(); frameWidths.set(studio, frames); }
  frames.set(frame, source);
  return source;
}

// No frame was requested; no authored width or model field is read.
const noFrameWidth: ModelFieldStore<number> = {
  getState: () => 0,
  getInitialState: () => 0,
  subscribe: () => () => undefined,
};

export function useFrameWidth(studio: StudioCtx, frame: ArenaFrame | undefined): number {
  const source = useMemo(() => frame ? frameWidthSource(studio, frame) : noFrameWidth, [studio, frame]);
  return useStore(source);
}
