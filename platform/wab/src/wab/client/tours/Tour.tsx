import { LocalStorageKey } from "@/wab/client/LocalStorageKey";
import Button from "@/wab/client/components/widgets/Button";
import { useApi } from "@/wab/client/contexts/AppContexts";
import { UiText } from "@/wab/client/i18n/UiText";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { useTourStepTargetVisibility } from "@/wab/client/tours/useTourStepTargetVisibility";
import { zIndex } from "@/wab/client/z-index";
import { spawn } from "@/wab/shared/common";
import React from "react";
import type { EventData } from "react-joyride";
import { useMountedState } from "react-use";
import { Signal } from "signals";

const LazyJoyRide = React.lazy(() => import("react-joyride").then(({ Joyride }) => ({ default: Joyride })));

interface TourProps<T> {
  seenStateKey: LocalStorageKey;
  onlyUsersCreatedBefore: string;
  didActionSignal?: Signal<T>;
  targetSelector: string;
  content: React.JSX.Element;
}

export function Tour<T>({
  seenStateKey,
  onlyUsersCreatedBefore,
  didActionSignal,
  targetSelector,
  content,
}: TourProps<T>) {
  const studioCtx = useStudioCtx();
  const api = useApi();
  const statusRef = React.useRef<EventData["status"]>("idle");

  const [tourState, setTourState] = React.useState({
    run: false,
    stepIndex: 0,
  });

  const isMounted = useMountedState();
  const { isTargetVisible } = useTourStepTargetVisibility(tourState.run, targetSelector);

  React.useEffect(() => {
    spawn(
      (async () => {
        const seen = await api.getStorageItem(seenStateKey);
        const shouldRender = !seen && !!studioCtx.appCtx.selfInfo;
        if (shouldRender && isMounted()) {
          setTourState((x) => ({ ...x, run: true }));
        }
      })(),
    );
  }, [studioCtx, isMounted]);

  React.useEffect(() => {
    if (tourState.run && didActionSignal) {
      const listener = () => {
        // We use a showNavigationPanelRequested listener in case the user opened
        // the panel via "p" or clicking the button
        if (statusRef.current === "running") {
          spawn(closeTour());
        }
      };
      didActionSignal.add(listener);
      return () => {
        didActionSignal.remove(listener);
      };
    } else {
      return undefined;
    }
  }, [studioCtx, tourState.run, didActionSignal]);

  const closeTour = async () => {
    setTourState({ ...tourState, run: false });
    await api.addStorageItem(seenStateKey, "true");
  };

  if (!tourState.run || !isTargetVisible) {
    return null;
  }

  return (
    <LazyJoyRide
      continuous
      {...tourState}
      options={{ zIndex: zIndex.tour, buttons: [], overlayClickAction: false, targetWaitTimeout: 0 }}
      styles={{
        tooltip: {
          color: undefined,
          fontSize: undefined,
        },
        tooltipContent: {
          padding: 0,
        },
      }}
      steps={[
        {
          target: targetSelector,
          content: (
            <>
              <div className="text-align-left">
                {content}
                <p className="text-align-right" style={{ marginBottom: 0 }}>
                  <Button
                    type="secondary"
                    onClick={async () => {
                      studioCtx.showProjectPanel();
                      await closeTour();
                    }}
                  >
                    {" "}
                    <UiText message={"Got it"} />{" "}
                  </Button>
                </p>
              </div>
            </>
          ),
          blockTargetInteraction: false,
          skipBeacon: true,
          buttons: [],
        },
      ]}
      onEvent={async (data) => {
        statusRef.current = data.status;
        if (data.action === "close") {
          await closeTour();
        }
      }}
    />
  );
}
