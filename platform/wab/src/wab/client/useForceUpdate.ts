import React from "react";

export function useForceUpdate(react = React) {
  const [, setTick] = react.useState(0);
  const update = react.useCallback(() => {
    setTick((tick) => tick + 1);
  }, []);
  return update;
}

/** Coalesce DOM observer notifications into one geometry refresh per frame. */
export function useFrameForceUpdate(lifetime?: AbortSignal) {
  const update = useForceUpdate();
  const pending = React.useMemo<{ frame: number | undefined; active: boolean }>(
    () => ({ frame: undefined, active: !lifetime?.aborted }), [lifetime],
  );
  React.useEffect(() => {
    pending.active = !lifetime?.aborted;
    const cancel = () => {
      pending.active = false;
      if (pending.frame !== undefined) {
        cancelAnimationFrame(pending.frame);
        pending.frame = undefined;
      }
    };
    lifetime?.addEventListener("abort", cancel, { once: true });
    return () => { lifetime?.removeEventListener("abort", cancel); cancel(); };
  }, [lifetime, pending]);
  return React.useCallback(() => {
    if (!pending.active || lifetime?.aborted) { return; }
    if (pending.frame === undefined) {
      const frame = requestAnimationFrame(() => {
        if (pending.frame !== frame) { return; }
        pending.frame = undefined;
        if (pending.active && !lifetime?.aborted) { update(); }
      });
      pending.frame = frame;
    }
  }, [update, lifetime, pending]);
}
