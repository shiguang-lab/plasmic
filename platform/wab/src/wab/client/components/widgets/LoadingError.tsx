import { useI18n } from "@/wab/client/i18n";
import { MessageKey } from "@/wab/client/i18n/locales";
import { Alert, Button } from "antd";
import * as React from "react";

export function LoadingError({
  onRetry,
  loading = false,
  title = "Unable to load this page",
}: {
  onRetry: () => void;
  loading?: boolean;
  title?: MessageKey;
}) {
  const { t } = useI18n();
  return (
    <Alert
      type="error"
      showIcon
      title={t(title)}
      description={t(
        "Please try again. If the problem persists, try again later.",
      )}
      action={
        <Button loading={loading} onClick={onRetry}>
          {t("Retry")}
        </Button>
      }
    />
  );
}
