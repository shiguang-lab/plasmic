import { HostConfig } from "@/wab/client/components/HostConfig";
import { showTemporaryPrompt } from "@/wab/client/components/quick-modals";
import { useAppCtx } from "@/wab/client/contexts/AppContexts";
import { useTopFrameCtx } from "@/wab/client/frame-ctx/top-frame-ctx";
import { getUiLocale } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import { translate } from "@/wab/client/i18n/locales";
import { ApiProject } from "@/wab/shared/ApiSchema";
import { mkUuid, spawn } from "@/wab/shared/common";
import { Button, notification } from "antd";
import * as React from "react";

/** This component displays a prompt if the host isn't loading. */
export function HostLoadTimeoutPrompt({
  project,
  editorPerm,
  refreshStudio,
}: {
  project: ApiProject;
  editorPerm: boolean;
  refreshStudio: () => Promise<void>;
}) {
  const { hostConnected } = useTopFrameCtx();
  const appCtx = useAppCtx();
  React.useEffect(() => {
    if (!!project && !hostConnected) {
      const key = mkUuid();
      const showWarning = () => {
        notification.warning({
          key,
          title: translate(
            getUiLocale(),
            "Looks like the host app is taking a while to load.",
          ),
          duration: 0,
          actions: (
            <Button
              onClick={() => {
                notification.destroy(key);
                spawn(refreshStudio());
              }}
            >
              <UiText message={"Reload"} />
            </Button>
          ),
          ...(editorPerm
            ? {
                description: (
                  <p>
                    <UiText
                      message={"Would you like to {part1} the host app URL?"}
                      values={{
                        part1: (
                          <a
                            onClick={() => {
                              spawn(
                                showTemporaryPrompt(() => (
                                  <HostConfig
                                    appCtx={appCtx}
                                    project={project}
                                    onCancel={() => {}}
                                    onUpdate={async (canSkipRefresh) => {
                                      if (!canSkipRefresh) {
                                        window.location.reload();
                                      }
                                    }}
                                  />
                                )),
                              );
                              notification.destroy(key);
                            }}
                          >
                            <UiText message={"update"} />
                          </a>
                        ),
                      }}
                    />
                  </p>
                ),
              }
            : {}),
        });
      };
      // Browsers may pause nested host frames in a background tab. Give the
      // host a full foreground loading interval before reporting a timeout.
      let id: ReturnType<typeof setTimeout> | undefined;
      const scheduleWarning = () => {
        clearTimeout(id);
        if (document.visibilityState === "hidden") {
          notification.destroy(key);
          return;
        }
        id = setTimeout(showWarning, 10000);
      };
      document.addEventListener("visibilitychange", scheduleWarning);
      scheduleWarning();
      return () => {
        clearTimeout(id);
        document.removeEventListener("visibilitychange", scheduleWarning);
        notification.destroy(key);
      };
    }
    return () => {};
  }, [project, editorPerm, hostConnected, refreshStudio]);
  return null;
}
