import { useI18n } from "@/wab/client/i18n";
import { MessageKey } from "@/wab/client/i18n/locales";
import { ExclamationCircleOutlined } from "@ant-design/icons";
import { Button, Flex, Typography, theme as AntdTheme } from "antd";
import * as React from "react";

export function LoadingError({
  onRetry,
  loading = false,
  detail,
  title = "Unable to load this page",
}: {
  onRetry: () => void;
  loading?: boolean;
  detail?: string;
  title?: MessageKey;
}) {
  const { t } = useI18n();
  const { token } = AntdTheme.useToken();
  return (
    <Flex
      role="alert"
      vertical
      align="center"
      justify="center"
      gap={12}
      style={{
        width: "100%",
        padding: "48px 24px",
        textAlign: "center",
        boxSizing: "border-box",
      }}
    >
      <ExclamationCircleOutlined
        aria-hidden
        style={{ fontSize: 32, color: token.colorTextTertiary }}
      />
      <Typography.Title level={5} style={{ margin: 0 }}>
        {t(title)}
      </Typography.Title>
      <Typography.Text type="secondary" style={{ maxWidth: 400 }}>
        {t("Please try again. If the problem persists, try again later.")}
      </Typography.Text>
      {detail && <Typography.Text style={{ maxWidth: 600, overflowWrap: "anywhere" }}>{detail}</Typography.Text>}
      <Button type="primary" loading={loading} onClick={onRetry}>
        {t("Retry")}
      </Button>
    </Flex>
  );
}
