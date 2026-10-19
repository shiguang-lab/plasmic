import React from "react";

export function useForceUpdate(react = React) {
  const [, setTick] = react.useState(0);
  const update = react.useCallback(() => {
    setTick((tick) => tick + 1);
  }, []);
  return update;
}

/** Coalesce DOM observer notifications into one geometry refresh per frame. */
export function useFrameForceUpdate() {
  const update = useForceUpdate();
  const frame = React.useRef<number>();
  React.useEffect(() => () => {
    if (frame.current !== undefined) {
      cancelAnimationFrame(frame.current);
    }
  }, []);
  return React.useCallback(() => {
    if (frame.current === undefined) {
      frame.current = requestAnimationFrame(() => {
        frame.current = undefined;
        update();
      });
    }
  }, [update]);
}
