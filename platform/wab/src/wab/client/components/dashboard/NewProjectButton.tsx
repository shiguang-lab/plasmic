import { useI18n } from "@/wab/client/i18n";
import { PlusOutlined } from "@ant-design/icons";
import { Button } from "antd";
import * as React from "react";

export function NewProjectButton(props: {
  className?: string;
  disabled?: boolean;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
}) {
  const { t } = useI18n();
  return (
    <Button {...props} type="primary" icon={<PlusOutlined aria-hidden />}>
      {t("New project")}
    </Button>
  );
}
