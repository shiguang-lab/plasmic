import React from "react";

export function useForceUpdate() {
  const [, setTick] = React.useState(0);
  const update = React.useCallback(() => {
    setTick((tick) => tick + 1);
  }, [setTick]);
  return update;
}

/** Coalesce DOM observer notifications into one geometry refresh per frame. */
export function useFrameForceUpdate(lifetime?: AbortSignal) {
  const update = useForceUpdate();
  const pending = React.useMemo(() => new FrameRefresh(update, lifetime), [update, lifetime]);
  React.useEffect(() => pending.connect(), [pending]);
  return React.useCallback(() => pending.refresh(), [pending]);
}

class FrameRefresh {
  private frame: number | undefined;
  private active: boolean;
  constructor(private readonly update: () => void, private readonly lifetime?: AbortSignal) {
    this.active = !lifetime?.aborted;
  }
  private cancel = () => {
    this.active = false;
    if (this.frame !== undefined) { cancelAnimationFrame(this.frame); this.frame = undefined; }
  };
  connect() {
    this.active = !this.lifetime?.aborted;
    this.lifetime?.addEventListener("abort", this.cancel, { once: true });
    return () => { this.lifetime?.removeEventListener("abort", this.cancel); this.cancel(); };
  }
  refresh() {
    if (!this.active || this.lifetime?.aborted || this.frame !== undefined) { return; }
    const frame = requestAnimationFrame(() => {
      if (this.frame !== frame) { return; }
      this.frame = undefined;
      if (this.active && !this.lifetime?.aborted) { this.update(); }
    });
    this.frame = frame;
  }
}
