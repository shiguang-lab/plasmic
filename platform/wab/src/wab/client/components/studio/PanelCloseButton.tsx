import { useI18n } from "@/wab/client/i18n";
import { CloseOutlined } from "@ant-design/icons";
import { Button } from "antd";
import React from "react";

export function PanelCloseButton({ onClick }: { onClick: () => void }) {
  const { t } = useI18n();
  return (
    <Button
      type="text"
      size="small"
      aria-label={t("Close")}
      icon={<CloseOutlined style={{ fontSize: 14 }} />}
      style={{ width: 24, minWidth: 24, height: 24, padding: 0, flexShrink: 0 }}
      onClick={onClick}
    />
  );
}
