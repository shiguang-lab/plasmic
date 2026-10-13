import { useI18n } from "@/wab/client/i18n";
import { notification } from "antd";
import { useEffect } from "react";

export function useBrowserNotification() {
  const { t: studioUiT } = useI18n();

  const isChrome = navigator.userAgent.indexOf("Chrome") >= 0;
  useEffect(() => {
    if (!isChrome) {
      notification.warning({
        message: studioUiT(
          "Right now, Plasmic Studio only works well with Chrome. We're working on it!",
        ),
        // Don't close automatically
        duration: 0,
      });
    }
  }, [isChrome]);
}
