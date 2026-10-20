import { useCanvasForceUpdate } from "@/wab/client/components/canvas/canvas-hooks";
import { SubDeps } from "@/wab/client/components/canvas/subdeps";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { Reaction } from "mobx";
import { computedFn } from "mobx-utils";
import type React from "react";

export const mkCanvasObserver = computedFn(
  (sub, vc) => (props: { children: () => React.ReactElement | null }) =>
    mkUseCanvasObserver(sub, vc)(props.children),
);

export const mkUseCanvasObserver = computedFn(
  (sub: SubDeps, vc: ViewCtx) =>
    /**
     * Observes mobx changes using sub.React for canvas elements.
     *
     * By default, after detecting a change, it calls `vc.addRerenderObserver`
     * with `forceUpdate` so the component will re-render in the next observer
     * flush or evaluation pass, but it takes an optional param `onUpdateCallback` to allow
     * custom behaviors to run on each change (e.g., call `forceUpdate`
     * immediately).
     */
    function useObserver<T>(
      fn: () => T,
      baseComponentName: string = "observed",
      onUpdateCallback?: () => void,
    ): T {
      const forceUpdate = useCanvasForceUpdate(sub);

      const rerenderOnEval = sub.React.useCallback(
        () => vc.addRerenderObserver(forceUpdate),
        [forceUpdate],
      );
      const onUpdate = onUpdateCallback ?? rerenderOnEval;

      const reactionTrackingRef = sub.React.useRef<IReactionTracking | null>(null);
      const createTracking = (): IReactionTracking => {
        const tracking: IReactionTracking = {
          reaction: new Reaction(observerComponentNameFor(baseComponentName), () => {
            if (tracking.mounted) {
              onUpdate();
            } else {
              tracking.changedBeforeMount = true;
            }
          }),
          mounted: false,
          changedBeforeMount: false,
        };
        vc.trackCanvasObserver(tracking.reaction);
        return tracking;
      };

      if (!reactionTrackingRef.current || reactionTrackingRef.current.reaction.isDisposed) {
        reactionTrackingRef.current = createTracking();
      }
      const { reaction } = reactionTrackingRef.current;

      sub.React.useEffect(() => {
        let tracking = reactionTrackingRef.current;
        if (!tracking || tracking.reaction.isDisposed) {
          // StrictMode cleanup or a delayed commit may have disposed it.
          tracking = createTracking();
          reactionTrackingRef.current = tracking;
          forceUpdate();
        }
        vc.commitCanvasObserver(tracking.reaction);
        tracking.mounted = true;
        if (tracking.changedBeforeMount) {
          tracking.changedBeforeMount = false;
          onUpdate();
        }
        const committed = tracking;
        return () => {
          committed.mounted = false;
          vc.disposeCanvasObserver(committed.reaction);
          if (reactionTrackingRef.current === committed) {
            reactionTrackingRef.current = null;
          }
        };
      }, [onUpdate]);

      if (vc.isDisposed) {
        return null as any;
      }

      let rendering!: T;
      let exception;
      reaction.track(() => {
        try {
          rendering = fn();
        } catch (e) {
          exception = e;
        }
      });

      if (exception) {
        throw exception; // re-throw any exceptions caught during rendering
      }

      return rendering;
    },
);

function observerComponentNameFor(baseComponentName: string) {
  return `observer${baseComponentName}`;
}

interface IReactionTracking {
  reaction: Reaction;
  mounted: boolean;
  changedBeforeMount: boolean;
}
