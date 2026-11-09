import * as React from "react";

export interface CanvasObservedInput {
  getState(): React.ReactNode;
  getInitialState(): React.ReactNode;
  subscribe(listener: () => void): () => void;
  commit(): void;
  dispose(): void;
}

/** Model projection and resource commands are outside React. Every child Hook
 * belongs to the native component element returned by that projection. */
export function CanvasObserver({ source }: { source: CanvasObservedInput }) {
  const node = React.useSyncExternalStore(source.subscribe, source.getState, source.getInitialState);
  React.useLayoutEffect(() => { source.commit(); }, [source, node]);
  React.useEffect(() => () => source.dispose(), [source]);
  return node;
}
