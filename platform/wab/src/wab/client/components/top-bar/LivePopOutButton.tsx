import {
  getUrlsForLiveMode,
  isLiveMode,
  usePreviewCtx,
} from "@/wab/client/components/live/PreviewCtx";
import {
  useFrameBgColor,
  useLivePreview,
} from "@/wab/client/components/live/PreviewFrame";
import { TextAndShortcut } from "@/wab/client/components/menu-builder";
import { EditorIconAction } from "@/wab/client/components/top-bar/EditorActions";
import { useTopFrameApi } from "@/wab/client/contexts/AppContexts";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { untilClosed } from "@/wab/client/dom-utils";
import { useI18n } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import {
  DefaultLivePopOutButtonProps,
  PlasmicLivePopOutButton,
} from "@/wab/client/plasmic/plasmic_kit_top_bar/PlasmicLivePopOutButton";
import { PLATFORM } from "@/wab/client/platform";
import { useHistory } from "@/wab/client/route/HistoryProvider";
import { bindShortcutHandlers } from "@/wab/client/shortcuts/shortcut-handler";
import { shouldHandleStudioShortcut } from "@/wab/client/shortcuts/studio/studio-shortcut-handlers";
import {
  STUDIO_SHORTCUTS,
  getComboForAction,
} from "@/wab/client/shortcuts/studio/studio-shortcuts";
import { useForceUpdate } from "@/wab/client/useForceUpdate";
import { getFrameHeight } from "@/wab/shared/Arenas";
import { spawn } from "@/wab/shared/common";
import { getPublicUrl, getStaticBaseUrl } from "@/wab/shared/urls";
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
  const history = useHistory();
  const studioCtx = useStudioCtx();
  const topFrameApi = useTopFrameApi();
  const previewCtx = usePreviewCtx();
  const isDesktop = navigator.userAgent.includes("PlasmicDesktop/");
  const curPopup = previewCtx.popup;
  const forceUpdate = useForceUpdate();
  const { frameRef, onLoad, reset } = useLivePreview(previewCtx);
  const [opening, setOpening] = React.useState(false);
  const openingRef = React.useRef(false);

  React.useEffect(() => {
    const listener = (event: MessageEvent) => {
      if (event.data.source !== "plasmic-popup" || !previewCtx.popup) {
        return;
      }

      switch (event.data.type) {
        case "load":
          spawn(
            (async () => {
              const location = await getUrlsForLiveMode(studioCtx, true);

              previewCtx.popup?.postMessage(
                {
                  source: "plasmic-studio",
                  type: "replaceHistory",
                  url:
                    (location.pathname ?? "") +
                    (location.search ?? "") +
                    (location.hash ?? ""),
                },
                "*",
              );

              reset();
              const frame = previewCtx.popup?.frames[0];
              frameRef.current = frame || null;
              await onLoad();
            })(),
          );
          break;
        case "popstate":
          spawn(previewCtx.parseRoute());
          break;
        case "unload":
          previewCtx.popup = undefined;
          break;
      }
    };

    window.addEventListener("message", listener);
    return () => {
      window.removeEventListener("message", listener);
    };
  }, [curPopup]);

  const openLivePopup = () => {
    if (openingRef.current) {
      return;
    }
    if (!isDesktop && curPopup) {
      curPopup.focus();
      return;
    }
    openingRef.current = true;
    setOpening(true);
    spawn(
      (async () => {
        try {
          if (isDesktop) {
            await studioCtx.save();
            if (studioCtx.hasUnsavedChanges()) {
              notification.error({
                message: (
                  <UiText message="Save changes before opening browser preview." />
                ),
              });
              return;
            }
            const location = previewCtx.isLive
              ? {
                  ...history.location,
                  pathname: history.location.pathname.replace(
                    "/preview",
                    "/preview-full",
                  ),
                }
              : await getUrlsForLiveMode(studioCtx, true);
            const studioUrl = await studioCtx.appCtx.api.getStudioUrl();
            await topFrameApi.openDesktopPreview(
              new URL(createPath(location), studioUrl).href,
            );
            return;
          }

          let windowOptions = "resizable";
          const vc = studioCtx.focusedViewCtx();
          if (vc && !isLiveMode(history.location.pathname)) {
            windowOptions += `,width=${vc.arenaFrame().width},height=${getFrameHeight(
              vc.arenaFrame(),
            )}`;
          }

          const hostUrl =
            studioCtx.getHostUrl() +
            "#live=true" +
            `&origin=${encodeURIComponent(getPublicUrl())}` +
            `&staticBaseUrl=${encodeURIComponent(getStaticBaseUrl())}`;

          const studioUrl = await studioCtx.appCtx.api.getStudioUrl();
          const popup = window.open(
            `${studioUrl}/static/popup.html#${hostUrl}`,
            "_blank",
            windowOptions,
          );
          if (popup) {
            spawn(
              (async () => {
                await previewCtx.setPopup(popup);
                await untilClosed(popup);
                await previewCtx.setPopup(undefined);
                reset();
                forceUpdate();
              })(),
            );
          }
        } finally {
          openingRef.current = false;
          setOpening(false);
        }
      })(),
    );
  };

  React.useEffect(() => {
    return () => {
      if (curPopup) {
        curPopup.close();
      }
    };
  }, [curPopup]);

  const setFrameColor = React.useCallback(
    (
      frame: React.MutableRefObject<Window | null>,
      color: string | null | undefined,
    ) => {
      if (frame?.current?.document?.body?.style) {
        frame.current.document.body.style.backgroundColor = color ?? "";
      }
    },
    [],
  );

  useFrameBgColor(frameRef, previewCtx, setFrameColor);

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
      disabled={opening || (studioCtx.currentArenaEmpty && !previewCtx)}
      onClick={() => openLivePopup()}
    />
  );
});

export default LivePopOutButton;
