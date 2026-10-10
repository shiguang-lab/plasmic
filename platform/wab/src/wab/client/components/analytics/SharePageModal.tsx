import { useI18n } from "@/wab/client/i18n";
import { DefaultSharePageModalProps } from "@/wab/client/plasmic/plasmic_kit_analytics/PlasmicSharePageModal";
import { Alert, Button, Flex, Input, Typography } from "antd";
import * as React from "react";

export type SharePageModalProps = DefaultSharePageModalProps;
const SharePageModal = React.forwardRef<HTMLDivElement, SharePageModalProps>(
  function SharePageModal(props, ref) {
    const { t } = useI18n();
    const [state, setState] = React.useState<"ready" | "copied" | "failed">(
      "ready",
    );
    React.useEffect(() => {
      if (state !== "copied") {
        return;
      }
      const timer = setTimeout(() => setState("ready"), 3300);
      return () => clearTimeout(timer);
    }, [state]);
    const copy = async () => {
      try {
        await navigator.clipboard.writeText(window.location.href);
        setState("copied");
      } catch {
        setState("failed");
      }
    };
    return (
      <Flex ref={ref} vertical gap={16} className={props.className}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {t("Share")}
        </Typography.Title>
        <Input
          aria-label={t("Copy link")}
          readOnly
          value={window.location.href}
        />
        <Button
          type="primary"
          disabled={state === "copied"}
          onClick={() => {
            void copy();
          }}
        >
          {t(state === "copied" ? "Copied" : "Copy link")}
        </Button>
        {state === "failed" && (
          <Alert type="error" showIcon title={t("Failed to copy link")} />
        )}
      </Flex>
    );
  },
);
export default SharePageModal;
