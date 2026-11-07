import { setElementStyles } from "@/wab/client/dom-utils";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { subscribeViewport } from "@/wab/client/studio-ctx/viewport-state";
import * as React from "react";
import { RefObject, useCallback } from "react";

export function useZoomStyledRef<T extends HTMLElement>(
  fn: (zoom: number) => Partial<CSSStyleDeclaration>,
  ref?: RefObject<T | null>,
) {
  const studioCtx = useStudioCtx();
  const ownRef = React.useRef<T>(null);
  const _ref = ref ?? ownRef;

  React.useEffect(() => {
    const update = (zoom: number) => {
      if (_ref.current) {
        setElementStyles(_ref.current, fn(zoom));
      }
    };
    const stopZoom = subscribeViewport(studioCtx, (state) => state.scale, update);
    update(studioCtx.viewportCtx?.store.getState().scale ?? 1);
    return stopZoom;
  }, [fn, studioCtx, _ref]);

  return _ref;
}

export function useScaledElementRef<T extends HTMLElement>({
  minZoom = 0,
  extraTransformation = "",
  disableScaling,
}: {
  extraTransformation?: string;
  minZoom?: number;
  disableScaling?: boolean;
} = {}) {
  const callback = useCallback(
    (zoom) =>
      disableScaling
        ? {}
        : {
            transform: `scale(${Math.min(
              1 / minZoom,
              1 / zoom,
            )}) ${extraTransformation}`,
          },
    [minZoom, extraTransformation, disableScaling],
  );
  return useZoomStyledRef<T>(callback);
}
