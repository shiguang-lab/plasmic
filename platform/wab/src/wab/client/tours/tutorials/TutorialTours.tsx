import { useStudioLiveMode } from "@/wab/client/studio-ctx/studio-mode-state";
import { reportError } from "@/wab/client/ErrorNotifications";
import { tourSeenForProjectKey } from "@/wab/client/LocalStorageKey";
import { AppCtx } from "@/wab/client/app-ctx";
import { topFrameTourSignals } from "@/wab/client/components/TopFrame/TopFrameChrome";
import { reactConfirm } from "@/wab/client/components/quick-modals";
import Button from "@/wab/client/components/widgets/Button";
import IconButton from "@/wab/client/components/widgets/IconButton";
import { useApi, useTopFrameApi } from "@/wab/client/contexts/AppContexts";
import { TopFrameApi } from "@/wab/client/frame-ctx/top-frame-api";
import { useI18n } from "@/wab/client/i18n";

import CloseIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Close";
import HelpIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Help";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { selectOnboardingTourState } from "@/wab/client/studio-ctx/left-panel-state";
import { useTourStepTargetVisibility } from "@/wab/client/tours/useTourStepTargetVisibility";
import { TutorialHighlightEffect } from "@/wab/client/tours/tutorials/TutorialHighlightEffect";
import { TutorialEvent } from "@/wab/client/tours/tutorials/tutorials-events";
import { waitElementToBeVisible } from "@/wab/client/tours/tutorials/tutorials-helpers";
import {
  STUDIO_ONBOARDING_TUTORIALS,
  TOPFRAME_ONBOARDING_TUTORIALS,
} from "@/wab/client/tours/tutorials/tutorials-meta";
import { TutorialStateFlags, StudioTutorialStep, TopFrameTutorialStep } from "@/wab/client/tours/tutorials/tutorials-types";
import { trackEvent } from "@/wab/client/tracking";
import { StandardMarkdown } from "@/wab/client/utils/StandardMarkdown";
import { zIndex } from "@/wab/client/z-index";
import { useSignalListener } from "@/wab/commons/components/use-signal-listener";
import { ProjectId } from "@/wab/shared/ApiSchema";
import { mkShortId, spawn, waitUntil } from "@/wab/shared/common";
import * as Sentry from "@sentry/browser";
import { notification } from "antd";
import { useTutorialAccountInputs } from "@/wab/client/tours/tutorials/tutorial-account-inputs";
import React from "react";
import { ErrorBoundary } from "react-error-boundary";
import { useStore } from "zustand";
import type { Step } from "react-joyride";
import { useMountedState } from "react-use";

const LazyJoyRide = React.lazy(() => import("react-joyride").then(({ Joyride }) => ({ default: Joyride })));

interface StepContentPopupProps {
  /** Identifier of current step */
  name: string;
  content: string;
  /** Text of button to proceed to next step. If not set, no button is displayed. */
  nextButtonText?: string;

  /** Text of secondary button. */
  secondaryButtonText?: string;
  /** Called when the user clicks the next button. */
  onNext?: () => Promise<void>;
  /** Called when the user clicks the secondary button. */
  onSecondary?: () => Promise<void>;
  /** Called when the user wants to quit the tutorial. */
  onQuit: () => Promise<void>;
  tourInfo: {
    userFirstName: string;
    storeName: string;
    domain?: string;
  };
}

function StepContentPopup(props: StepContentPopupProps) {
  const { t: studioUiT, label } = useI18n();

  const {
    name,
    content,
    onNext,
    onQuit,
    tourInfo,
    nextButtonText,
    secondaryButtonText,
    onSecondary,
  } = props;

  return (
    <div id={`tour-popup-${name}`} className="flex-col pb-m gap-lg">
      <div className="flex fill-width flex-align-start">
        <div className="text-align-left fill-width pt-m tutorial-content">
          <StandardMarkdown>
            {label(content.trim())
              .replaceAll("{FIRST_NAME}", tourInfo.userFirstName)
              .replaceAll("{STORE_NAME}", tourInfo.storeName)
              .replaceAll("{APP_DOMAIN}", tourInfo.domain || "")
              .trim()}
          </StandardMarkdown>
        </div>
        <IconButton
          href="https://forum.plasmic.app/"
          target="_blank"
          hoverText={studioUiT("Visit our community forum for help")}
          size="large"
        >
          <HelpIcon />
        </IconButton>
        <IconButton
          hoverText={studioUiT("Exit tutorial")}
          size="large"
          onClick={async () => {
            if (
              await reactConfirm({
                title: studioUiT("Exit tutorial?"),
                message: studioUiT(
                  "If you want to start the tutorial again, you'll need to start over in a new project.",
                ),
                confirmLabel: studioUiT("Exit"),
                cancelLabel: studioUiT("Back"),
              })
            ) {
              await onQuit();
            }
          }}
        >
          <CloseIcon />
        </IconButton>
      </div>
      {(nextButtonText || secondaryButtonText) && (
        <div className="pt-sm flex-push-right flex gap-sm">
          {secondaryButtonText && (
            <Button id="tour-secondary-btn" onClick={onSecondary}>
              <span className="tutorial-content">
                {secondaryButtonText && label(secondaryButtonText)}
              </span>
            </Button>
          )}
          {nextButtonText && (
            <Button id="tour-primary-btn" type="primary" onClick={onNext}>
              <span className="tutorial-content">
                {nextButtonText && label(nextButtonText)}
              </span>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

const STEP_SETTINGS: Partial<Step> = {
  blockTargetInteraction: false,
  skipBeacon: true,
  buttons: [],
};

interface TourStepMeta {
  projectId: string;
  tour: string;
  stepIndex: number;
  stepName: string;
  prevStepName: string;
  status:
    | "completed"
    | "quit"
    | "inactivity"
    | "finish"
    | "started"
    | "error"
    | "paused";
}

function trackTourEvent(meta: TourStepMeta) {
  trackEvent("studio-tour", meta);
}

const USER_CHANGE_CHECK_INTERVAL = 250; // 0.25 seconds
const USER_CHANGE_MAX_WAIT = 1000 * 60 * 45; // 45 minutes

export const StudioTutorialTours = React.memo(function StudioTutorialTours() {
  const studioCtx = useStudioCtx();
  const account = useTutorialAccountInputs(studioCtx.appCtx);
  const api = useApi();
  const topFrameApi = useTopFrameApi();
  const tourState = useStore(studioCtx.leftPanelState.store, selectOnboardingTourState);
  const currentTutorial = STUDIO_ONBOARDING_TUTORIALS[tourState.tour];
  const currentStep = currentTutorial?.[tourState.stepIndex];

  const isMounted = useMountedState();

  React.useEffect(() => {
    let current = true;
    spawn(
      (async function checkIfShouldStartTour() {
        const templateTours = account.templateTours;
        const { clonedFromProjectId, id: projectId } = studioCtx.siteInfo;

        if (!clonedFromProjectId || !templateTours) {
          return;
        }

        const templateTour = templateTours[clonedFromProjectId];

        if (!templateTour) {
          return;
        }

        const hasSeenTour = await api.getStorageItem(
          tourSeenForProjectKey(projectId),
        );

        if (!hasSeenTour && isMounted() && current) {
          trackTourEvent({
            projectId,
            tour: templateTour,
            stepIndex: 0,
            stepName: "",
            prevStepName: "",
            status: "started",
          });

          studioCtx.setOnboardingTourState({
            run: true,
            stepIndex: 0,
            tour: templateTour,
            flags: {},
            triggers: [],
          });
        }
      })(),
    );
    return () => {current = false;};
  }, [studioCtx, isMounted, account.templateTours]);

  return currentTutorial && currentStep ? (
    <StudioTutorialStepTour key={tourState.tour} studioCtx={studioCtx} account={account}
      api={api} topFrameApi={topFrameApi} tourState={tourState}
      currentTutorial={currentTutorial} currentStep={currentStep} />
  ) : null;
});

function StudioTutorialStepTour({ studioCtx, account, api, topFrameApi, tourState, currentTutorial, currentStep }: {
  studioCtx: ReturnType<typeof useStudioCtx>;
  account: ReturnType<typeof useTutorialAccountInputs>;
  api: ReturnType<typeof useApi>;
  topFrameApi: ReturnType<typeof useTopFrameApi>;
  tourState: ReturnType<typeof selectOnboardingTourState>;
  currentTutorial: readonly StudioTutorialStep[];
  currentStep: StudioTutorialStep;
}) {
  const { t: studioUiT } = useI18n();
  const liveMode = useStudioLiveMode(studioCtx);
  const isMounted = useMountedState();
  function trackCurrentStepTourEvent(status: TourStepMeta["status"]) {
    trackTourEvent({
      projectId: studioCtx.siteInfo.id,
      tour: tourState.tour,
      stepIndex: tourState.stepIndex,
      stepName: currentStep.name,
      prevStepName: currentTutorial[tourState.stepIndex - 1]?.name || "",
      status,
    });
  }

  const clearFlagsOnVisibilityChange = React.useCallback(
    (isVisible: boolean) => {
      // We only care about the visibility of the target when the tour is running
      // during `advanceToNextStep` we temporarily disable the tour to avoid the
      // user to interact with the tour while the next step is being prepared,
      // during this time the target may become invisible, but we don't want to
      // pause the tour in this case.
      const isRunning = tourState.run;
      if (!isVisible && isRunning) {
        // In case the visibility of the current target changes, we clear the flags
        // this is to avoid that flags that force components state to be active when
        // the user goes out of the tour route and somehow it becomes inconsistent.
        // If the user finds the path back to the tour step, the tour will resume.
        studioCtx.setOnboardingTourState({
          ...studioCtx.onboardingTourState,
          flags: {},
        });

        notification.warning({
          message: studioUiT(
            "Since you navigated away from the tour, it was paused. By navigating back to the previous state, you can resume the tour.",
          ),
        });

        trackCurrentStepTourEvent("paused");
      }
    },
    [tourState.run, studioUiT, studioCtx, trackCurrentStepTourEvent],
  );

  const { isTargetVisible } = useTourStepTargetVisibility(
    tourState.run,
    currentStep?.target,
    clearFlagsOnVisibilityChange,
  );

  const closeTour = () => {
    studioCtx.setOnboardingTourState({
      run: false,
      stepIndex: 0,
      tour: "",
      flags: {},
      triggers: [],
    });
  };

  const markTourAsSeen = async () => {
    await api.addStorageItem(
      tourSeenForProjectKey(studioCtx.siteInfo.id),
      true,
    );
  };

  const quitTour = async () => {
    trackCurrentStepTourEvent("quit");
    await markTourAsSeen();
    if (isMounted()) { closeTour(); }
  };

  const finishTour = () => {
    trackCurrentStepTourEvent("finish");
    closeTour();
  };

  const endTourByInactivity = () => {
    trackCurrentStepTourEvent("inactivity");
    closeTour();
  };

  const captureTourError = (e: Error) => {
    Sentry.captureException(e, {
      extra: {
        projectId: studioCtx.siteInfo.id,
        tour: tourState.tour,
        stepIndex: tourState.stepIndex,
        stepName: currentStep.name,
        prevStepName: currentTutorial[tourState.stepIndex - 1]?.name || "",
      },
    });
  };

  const advanceToNextStep = async (flags: Partial<TutorialStateFlags> = {}) => {
    if (!isMounted()) { return; }
    studioCtx.setOnboardingTourState({
      ...studioCtx.onboardingTourState,
      run: false, // sneakily disable the tour so that the tutorial is hidden while waiting
    });

    if (currentStep?.onNext) {
      await currentStep.onNext(stepCtx);
    }
    if (!isMounted()) { return; }

    trackCurrentStepTourEvent("completed");
    if (tourState.stepIndex + 1 === currentTutorial.length) {
      finishTour();
      return;
    }
    if (tourState.stepIndex === 0) {
      // After the user interacts with the first step, we mark the tour as seen
      // Either by the user advancing to the next step or by the user quitting the tour
      // this way if the user reloads the page the tour won't show up again if it had
      // some kind of interaction before
      await markTourAsSeen();
      if (!isMounted()) { return; }
    }
    const nextStep = currentTutorial[tourState.stepIndex + 1];
    const currentFlags = {
      ...flags,
      ...(currentStep.postStepFlags || {}),
    };

    if (nextStep.waitFor) {
      try {
        await nextStep.waitFor(stepCtx);
      } catch (e) {
        if (!isMounted()) { return; }
        // The nature of waitFor should be simple operation to wait for something to be visible
        // or wait for some animation to finish, small fixes at the studio zoom...
        //
        // It shouldn't be used to perform complex operations, we assume errors here are triggered
        // by timeouts in which case we gonna continue the tour, but the user will probably have
        // to manually go to the state of the next step. That would be through `useTourStepTargetVisibility`
        captureTourError(e);
      }
    }

    if (!isMounted()) { return; }
    try {
      await waitElementToBeVisible(nextStep.target);
    } catch (e) {
      if (!isMounted()) { return; }
      // We won't stop the tour here, we will attempt to continue and let `clearFlagsOnVisibilityChange`
      // to pause the tour if the target is not visible
      trackCurrentStepTourEvent("error");
      captureTourError(e);
    }

    if (!isMounted()) { return; }
    studioCtx.setOnboardingTourState({
      run: true,
      stepIndex: tourState.stepIndex + 1,
      tour: tourState.tour,
      flags: currentFlags,
      triggers: nextStep.triggers || [],
    });
  };

  const stepCtx = {
    studioCtx,
    topFrameApi,
  };

  useSignalListener<TutorialEvent>(
    studioCtx.tourActionEvents,
    (event: TutorialEvent) => {
      if (!tourState.run) {
        return;
      }
      const advance = currentStep.shouldAdvance
        ? currentStep.shouldAdvance(event)
        : false;
      console.log(`Studio tour event (advance=${advance})`, event);
      if (advance) {
        spawn(advanceToNextStep());
      }
    },
    [tourState.tour, tourState.run, tourState.stepIndex],
  );

  React.useEffect(() => {
    if (!tourState.run) {
      return;
    }

    let current = true;
    const advanceOnUserChanges = currentStep.advanceOnUserChanges;
    if (advanceOnUserChanges) {
      const nonNullAdvanceOnUserChanges = advanceOnUserChanges;
      async function advanceToNextStepAfterUserChanges() {
        try {
          await waitUntil(() => current ? nonNullAdvanceOnUserChanges(stepCtx) : true, {
            timeout: USER_CHANGE_CHECK_INTERVAL,
            maxTimeout: USER_CHANGE_MAX_WAIT,
          });
        } catch (e) {
          if (!current || !isMounted()) { return; }
          console.log("Studio tour timed out", e);
          endTourByInactivity();
          captureTourError(e);
          return;
        }

        if (current && isMounted()) { await advanceToNextStep(); }
      }
      spawn(advanceToNextStepAfterUserChanges());
    }
    return () => { current = false; };
  }, [tourState.run, tourState.stepIndex]);


  if (
    !tourState.run ||
    !currentTutorial ||
    !isTargetVisible ||
    liveMode
  ) {
    return null;
  }

  const steps: Step[] = currentTutorial.map((step) => {
    return {
      target: step.target,
      content: (
        <StepContentPopup
          name={step.name}
          content={step.content}
          nextButtonText={step.nextButtonText}
          onNext={advanceToNextStep}
          secondaryButtonText={step.secondaryButtonText}
          onSecondary={async () => step.onSecondary?.(stepCtx)}
          onQuit={quitTour}
          tourInfo={{
            userFirstName: account.displayName,
            storeName: "Your Store",
          }}
        />
      ),
      ...STEP_SETTINGS,
      placement: step.placement,
      hideOverlay: !step.overlay,
    };
  });

  return (
    <ErrorBoundary
      fallback={<UnexpectedTourError />}
      onError={(err, info) => {
        console.error(err, info);
        reportError(err, "studio-tour");
        trackTourEvent({
          projectId: studioCtx.siteInfo.id,
          tour: tourState.tour,
          stepIndex: tourState.stepIndex,
          stepName: currentStep.name,
          prevStepName: currentTutorial[tourState.stepIndex - 1]?.name || "",
          status: "error",
        });
        // Not necessary to close the tour, it may be a recoverable error
        // if not the tour will be closed by inactivity
      }}
    >
      {currentStep?.highlightTarget && (
        <TutorialHighlightEffect
          target={currentStep.highlightTarget}
          targetContainer={currentStep.target}
          zIndex={currentStep.highlightZIndex || zIndex.tourHighlight}
        />
      )}
      <React.Suspense fallback={null}>
        {!currentStep?.hidden && (
          <LazyJoyRide
            continuous
                              {...tourState}
            options={{ zIndex: zIndex.tour, buttons: [], overlayClickAction: false, skipScroll: true, targetWaitTimeout: 0 }}
            styles={{
              tooltip: {
                color: undefined,
                fontSize: undefined,
                padding: "20px",
                background: `
linear-gradient(rgba(255,255,255,0.5), rgba(255,255,255,0.5)), url(/static/img/grid-pattern-bg.png)

          `,
                backgroundPosition: "bottom left",
                // Scale tooltip a bit so that the arrow feels more seamless
                transform: "scale(1.01)",
              },
              tooltipContent: {
                padding: 0,
              },
            }}
            steps={steps}
          />
        )}
      </React.Suspense>
    </ErrorBoundary>
  );
}

function UnexpectedTourError() {
  const { t: studioUiT } = useI18n();

  React.useEffect(() => {
    notification.error({
      message: studioUiT("Unexpected tour error"),
    });
    // TODO: allow studio to recover from this error
  }, []);
  return null;
}

export interface TopFrameTourState {
  tour: string;
  run: boolean;
  stepIndex: number;
}

function generateCustomDomain(appCtx: AppCtx, tour: string) {
  const uniqueId = mkShortId().toLowerCase();
  const tourPrefix = "portfolio-";
  return `${tourPrefix}${uniqueId}.${appCtx.appConfig.plasmicHostingSubdomainSuffix}`;
}

interface TopFrameToursProps {
  appCtx: AppCtx;
  tourState: TopFrameTourState;
  topFrameApi: TopFrameApi;
  changeTourState: (state: TopFrameTourState) => Promise<void>;
  projectId: ProjectId;
}

export function TopFrameTours(props: TopFrameToursProps) {
  const currentTutorial = TOPFRAME_ONBOARDING_TUTORIALS[props.tourState.tour];
  const currentStep = currentTutorial?.[props.tourState.stepIndex];
  return currentTutorial && currentStep ? (
    <TopFrameTutorialStepTour key={props.tourState.tour} {...props}
      currentTutorial={currentTutorial} currentStep={currentStep} />
  ) : null;
}

function TopFrameTutorialStepTour(props: TopFrameToursProps & {
  currentTutorial: readonly TopFrameTutorialStep[];
  currentStep: TopFrameTutorialStep;
}) {
  const { appCtx, tourState, topFrameApi, changeTourState, projectId, currentTutorial, currentStep } = props;
  const isMounted = useMountedState();
  const { isTargetVisible } = useTourStepTargetVisibility(
    tourState.run,
    currentStep?.target,
  );

  const domain = React.useMemo(
    () => generateCustomDomain(appCtx, tourState.tour),
    [appCtx, tourState.tour],
  );

  function trackCurrentStepTourEvent(status: TourStepMeta["status"]) {
    trackTourEvent({
      projectId,
      tour: tourState.tour,
      stepIndex: tourState.stepIndex,
      stepName: currentStep.name,
      prevStepName: currentTutorial[tourState.stepIndex - 1]?.name || "",
      status,
    });
  }

  const closeTour = async () => {
    await changeTourState({
      run: false,
      stepIndex: 0,
      tour: "",
    });
  };

  const quitTour = async () => {
    trackCurrentStepTourEvent("quit");
    await topFrameApi.setKeepPublishModalOpen(false);
    if (isMounted()) { await closeTour(); }
  };

  const onNextCtx = {
    appCtx,
    topFrameApi,
    projectId,
    domain,
  };

  const advanceToNextStep = async () => {
    if (!isMounted()) { return; }
    // If we have both onNext and onSecondary, we assume that we shouldn't trigger onNext/onSecondary
    // as it's expected that the user will trigger it manually.
    if (currentStep?.onNext && !currentStep?.onSecondary) {
      await currentStep.onNext(onNextCtx);
    }
    if (!isMounted()) { return; }

    // Track user completing a step
    trackCurrentStepTourEvent("completed");
    if (tourState.stepIndex + 1 === currentTutorial.length) {
      trackCurrentStepTourEvent("finish");
      await closeTour();
      return;
    }
    const nextStep = currentTutorial[tourState.stepIndex + 1];

    await changeTourState({
      run: false, // sneakily disable the tour so that the tutorial is hidden while waiting
      stepIndex: tourState.stepIndex + 1,
      tour: tourState.tour,
    });
    if (!isMounted()) { return; }

    if (nextStep.waitFor) {
      await nextStep.waitFor(onNextCtx);
    }
    if (!isMounted()) { return; }
    await waitElementToBeVisible(nextStep.target);
    if (!isMounted()) { return; }

    await changeTourState({
      run: true,
      stepIndex: tourState.stepIndex + 1,
      tour: tourState.tour,
    });
  };

  useSignalListener<TutorialEvent>(
    topFrameTourSignals,
    (event) => {
      if (!tourState.run) {
        return;
      }
      const advance = currentStep.shouldAdvance
        ? currentStep.shouldAdvance(event)
        : false;
      console.log(`TopFrame tour event (advance=${advance})`, event);
      if (advance) {
        spawn(advanceToNextStep());
      }
    },
    [tourState.tour, tourState.run, tourState.stepIndex],
  );

  if (!tourState.run || !currentTutorial || !isTargetVisible) {
    return null;
  }

  const steps: Step[] = currentTutorial.map((step) => {
    return {
      target: step.target,
      content: (
        <StepContentPopup
          name={step.name}
          content={step.content}
          nextButtonText={step.nextButtonText}
          onNext={advanceToNextStep}
          secondaryButtonText={step.secondaryButtonText}
          onSecondary={async () => step.onSecondary?.(onNextCtx)}
          onQuit={quitTour}
          tourInfo={{
            userFirstName: appCtx.selfInfo?.displayName || "",
            storeName: "Your Store",
            domain,
          }}
        />
      ),
      ...STEP_SETTINGS,
      placement: step.placement,
      hideOverlay: !step.overlay,
    };
  });

  return (
    <>
      {currentStep?.highlightTarget && (
        <TutorialHighlightEffect
          target={currentStep.highlightTarget}
          targetContainer={currentStep.target}
          zIndex={currentStep.highlightZIndex || zIndex.tourHighlight}
        />
      )}
      <LazyJoyRide
        continuous
          {...tourState}
        options={{ zIndex: zIndex.tour, buttons: [], overlayClickAction: false, skipScroll: true, targetWaitTimeout: 0 }}
        styles={{
          tooltip: {
            color: undefined,
            fontSize: undefined,
            padding: "20px",
            background: `
          linear-gradient(rgba(255,255,255,0.5), rgba(255,255,255,0.5)), url(/static/img/grid-pattern-bg.png)

          `,
            backgroundPosition: "bottom left",
          },
          tooltipContent: {
            padding: 0,
          },
        }}
        steps={steps}
      />
    </>
  );
}
