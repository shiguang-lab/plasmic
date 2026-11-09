import { maybeConvertToHostLessProject } from "@/wab/client/code-components/code-components";
import { BottomModalsProvider } from "@/wab/client/components/BottomModal";
import { showPlasmicImgModal } from "@/wab/client/components/modals/PlasmicImgModal";
import { ShortcutsModal } from "@/wab/client/components/studio/Shortcuts";
import { StudioLayout } from "@/wab/client/components/studio/StudioLayout";
import { getLiveFrameClientJs } from "@/wab/client/components/studio/studio-bundles";
import { fixStudioIframePositionAndOverflow } from "@/wab/client/dom-utils";
import { getUiLocale } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import { translate } from "@/wab/client/i18n/locales";
import { analytics } from "@/wab/client/observability";
import RocketsvgIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__RocketSvg";
import { bindStudioShortcutHandlers } from "@/wab/client/shortcuts/studio/studio-shortcut-handlers";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { StudioTutorialTours } from "@/wab/client/tours/tutorials/TutorialTours";
import { mkShortId, spawn } from "@/wab/shared/common";
import { PlasmicQueryDataProvider } from "@plasmicapp/query";
import { notification } from "antd";
import * as React from "react";

interface StudioProps {
  studioCtx: StudioCtx;
  children?: React.ReactNode;
}

export function Studio({studioCtx, children}: StudioProps) {
  React.useLayoutEffect(() => {
    studioCtx.setStudioVisible(true);
    const appConfig = studioCtx.appCtx.appConfig;
    fixStudioIframePositionAndOverflow();

    analytics().appendBaseEventProperties({
      ProjectId: studioCtx.siteInfo.id,
      ProjectName: studioCtx.siteInfo.name,
    });

    spawn(getLiveFrameClientJs());
    spawn(maybeConvertToHostLessProject(studioCtx));
    if (!appConfig.usePlasmicImg && studioCtx.canEditProject()) {
      const id = mkShortId();
      notification.info({
        key: id,
        message: translate(
          getUiLocale(),
          "Enable image optimization for this project?",
        ),
        description: (
          <p>
            <UiText
              message={
                "{part1} to read more about the new image optimization feature and enable it for this project"
              }
              values={{
                part1: (
                  <a
                    onClick={() => {
                      notification.destroy(id);
                      return showPlasmicImgModal(studioCtx);
                    }}
                  >
                    <UiText message={"Click here"} />
                  </a>
                ),
              }}
            />
          </p>
        ),
        duration: 20,
        icon: <RocketsvgIcon />,
      });
    }

    const unbindShortcutHandlers = bindStudioShortcutHandlers(studioCtx);
    return () => {
      unbindShortcutHandlers();
      studioCtx.setStudioVisible(false);
      document.body.style.overflow = "";
    };
  }, [studioCtx]);
    return (
      <ShortcutsModal>
        <PlasmicQueryDataProvider
          provider={() => studioCtx.hostQuerySwrCache}
        >
          <BottomModalsProvider>
            <StudioLayout>{children}</StudioLayout>
            <React.Suspense fallback={null}>
              <StudioTutorialTours />
            </React.Suspense>
          </BottomModalsProvider>
        </PlasmicQueryDataProvider>
      </ShortcutsModal>
    );
}
