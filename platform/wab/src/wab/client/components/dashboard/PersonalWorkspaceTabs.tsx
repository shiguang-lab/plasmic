import { useProjectBrowserStyles } from "@/wab/client/components/ui/layout-styles";
import { useI18n } from "@/wab/client/i18n";
import { Tabs } from "antd";
import * as React from "react";

export function PersonalWorkspaceTabs({
  activeKey,
  onChange,
  toolbar,
  children,
}: {
  activeKey: "projects" | "dataSources";
  onChange: (key: string) => void;
  toolbar: React.ReactNode;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const { styles } = useProjectBrowserStyles();
  return (
    <Tabs
      className={styles.workspaceTabs}
      activeKey={activeKey}
      onChange={onChange}
      tabBarExtraContent={{ right: toolbar }}
      items={[
        {
          key: "projects",
          label: t("Projects"),
          children: activeKey === "projects" ? children : undefined,
        },
        {
          key: "dataSources",
          label: t("Data sources"),
          children: activeKey === "dataSources" ? children : undefined,
        },
      ]}
    />
  );
}
