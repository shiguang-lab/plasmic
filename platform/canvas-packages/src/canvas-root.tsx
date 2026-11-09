import * as React from "react";
import type { CanvasSnapshotStore } from "./canvas-frame";

export interface CanvasRootProps<GlobalPins> {
  readonly globals: CanvasSnapshotStore<GlobalPins>;
  readonly owner: { releaseRenderListener(listener: () => void): void };
  readonly onRenderInvalidated: () => void;
  readonly render: (globals: GlobalPins) => React.ReactElement;
}

/** Frame-wide subscriptions belong to a real iframe fiber. The model renderer
 * receives the immutable global-pin input and does not call Hooks. */
export function CanvasRoot<GlobalPins>({ globals, owner, onRenderInvalidated, render }: CanvasRootProps<GlobalPins>) {
  const pins = React.useSyncExternalStore(globals.subscribe, globals.getState, globals.getInitialState);
  React.useEffect(() => () => owner.releaseRenderListener(onRenderInvalidated), [owner, onRenderInvalidated]);
  return render(pins);
}
