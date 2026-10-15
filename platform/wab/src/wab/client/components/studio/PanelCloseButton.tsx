import { useI18n } from "@/wab/client/i18n";
import { Button } from "antd";
import React from "react";
import { FiSidebar } from "react-icons/fi";

export function PanelCloseButton({ onClick }: { onClick: () => void }) {
  const { t } = useI18n();
  return (
    <Button
      type="text"
      size="small"
      aria-label={t("Close")}
      icon={<FiSidebar size={16} />}
      style={{ width: 28, minWidth: 28, height: 28, padding: 0, flexShrink: 0 }}
      onClick={onClick}
    />
  );
}
