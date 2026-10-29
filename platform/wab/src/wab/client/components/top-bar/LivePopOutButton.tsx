import { getUrlsForLiveMode } from "@/wab/client/components/live/PreviewCtx";
import { TextAndShortcut } from "@/wab/client/components/menu-builder";
import { EditorIconAction } from "@/wab/client/components/top-bar/EditorActions";
import { useTopFrameApi } from "@/wab/client/contexts/AppContexts";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { useI18n } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import {
  DefaultLivePopOutButtonProps,
  PlasmicLivePopOutButton,
} from "@/wab/client/plasmic/plasmic_kit_top_bar/PlasmicLivePopOutButton";
import { PLATFORM } from "@/wab/client/platform";
import { bindShortcutHandlers } from "@/wab/client/shortcuts/shortcut-handler";
import { shouldHandleStudioShortcut } from "@/wab/client/shortcuts/studio/studio-shortcut-handlers";
import {
  STUDIO_SHORTCUTS,
  getComboForAction,
} from "@/wab/client/shortcuts/studio/studio-shortcuts";
import { spawn } from "@/wab/shared/common";
import { Button, Tooltip, notification } from "antd";
import { createPath } from "history";
import { observer } from "mobx-react";
import * as React from "react";

type LivePopOutButtonProps = DefaultLivePopOutButtonProps & {
  showLabel?: boolean;
  iconOnly?: boolean;
};

const LivePopOutButton = observer(function LivePopOutButton(
  props: LivePopOutButtonProps,
) {
  const { t: uiT } = useI18n();
  const { showLabel, iconOnly, ...plasmicProps } = props;
  const studioCtx = useStudioCtx();
  const topFrameApi = useTopFrameApi();
  const isDesktop = navigator.userAgent.includes("PlasmicDesktop/");
  const [opening, setOpening] = React.useState(false);
  const openingRef = React.useRef(false);

  const openLivePopup = () => {
    if (openingRef.current) {
      return;
    }
    // Reserve a browser window during the user gesture, before save/code allocation.
    const browserWindow = isDesktop
      ? undefined
      : window.open("about:blank", "_blank");
    if (!isDesktop && !browserWindow) {
      return;
    }
    if (browserWindow) {
      browserWindow.opener = null;
    }
    openingRef.current = true;
    setOpening(true);
    spawn(
      (async () => {
        let launched = false;
        try {
          await studioCtx.save();
          if (studioCtx.hasUnsavedChanges()) {
            notification.error({
              message: (
                <UiText message="Save changes before opening browser preview." />
              ),
            });
            return;
          }
          const location = await getUrlsForLiveMode(studioCtx, true);
          const studioUrl = await studioCtx.appCtx.api.getStudioUrl();
          const url = new URL(createPath(location), studioUrl).href;
          if (isDesktop) {
            await topFrameApi.openDesktopPreview(url);
          } else {
            browserWindow?.location.replace(url);
          }
          launched = true;
        } finally {
          if (!launched) {
            browserWindow?.close();
          }
          openingRef.current = false;
          setOpening(false);
        }
      })(),
    );
  };

  const label = isDesktop
    ? uiT("Open preview in browser")
    : uiT("Open preview in new tab");
  const disabled = !studioCtx.currentArena || studioCtx.currentArenaEmpty;

  React.useEffect(() => {
    if (!iconOnly) {
      return;
    }
    return bindShortcutHandlers(
      document.body,
      STUDIO_SHORTCUTS,
      {
        PRESENT: () => {
          if (disabled) {
            return false;
          }
          openLivePopup();
          return true;
        },
      },
      shouldHandleStudioShortcut(studioCtx),
    );
  });

  if (iconOnly) {
    return (
      <Tooltip
        trigger={["hover", "focus"]}
        title={
          <TextAndShortcut
            variant="tooltip"
            shortcut={getComboForAction("PRESENT")}
          >
            {uiT("Present")}
          </TextAndShortcut>
        }
      >
        <EditorIconAction
          action="Present"
          type="text"
          className="editor-icon-action"
          aria-keyshortcuts={
            PLATFORM === "osx" ? "Meta+Enter" : "Control+Enter"
          }
          aria-busy={opening}
          loading={opening}
          disabled={disabled || opening}
          onClick={openLivePopup}
        />
      </Tooltip>
    );
  }

  if (showLabel) {
    return (
      <Button
        type="text"
        onClick={openLivePopup}
        aria-label={label}
        loading={opening}
        aria-busy={opening}
      >
        {label}
      </Button>
    );
  }

  return (
    <PlasmicLivePopOutButton
      {...plasmicProps}
      root={{
        props: {
          "aria-label": label,
          "aria-busy": opening,
        },
      }}
      tooltip={
        isDesktop
          ? uiT("Preview in default browser")
          : uiT("Preview the artboard in new window")
      }
      disabled={opening || disabled}
      onClick={() => openLivePopup()}
    />
  );
});

export default LivePopOutButton;
