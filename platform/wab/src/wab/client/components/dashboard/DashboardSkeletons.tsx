import dashboard from "@/wab/client/components/dashboard/dashboard.module.scss";
import { useMemberStyles } from "@/wab/client/components/dashboard/TeamMemberList.styles";
import { useI18n } from "@/wab/client/i18n";
import { PlasmicDataSource } from "@/wab/client/plasmic/plasmic_kit_dashboard/PlasmicDataSource";
import { PlasmicDatabaseListItem } from "@/wab/client/plasmic/plasmic_kit_dashboard/PlasmicDatabaseListItem";
import { FolderOutlined, MoreOutlined, TeamOutlined } from "@ant-design/icons";
import { Button, Flex, Skeleton, Tag, Tree } from "antd";
import * as React from "react";

export function SpacesNavigationSkeleton() {
  const { t } = useI18n();
  return (
    <aside className={dashboard.spacesNavigation} aria-hidden="true">
      <Tree
        disabled
        blockNode
        showIcon
        showLine={{ showLeafIcon: false }}
        switcherIcon={null}
        expandedKeys={["organization"]}
        treeData={[
          {
            key: "organization",
            className: dashboard.spaceOrganizationNode,
            icon: <TeamOutlined />,
            title: <span className={dashboard.spaceOrganization}><Skeleton.Input active size="small" style={{ width: 88, minWidth: 0, height: 14 }} /><Tag>{t("Organization")}</Tag></span>,
            children: [{ key: "workspace", isLeaf: true, icon: <FolderOutlined />, title: <Skeleton.Input active size="small" style={{ width: 100, minWidth: 0, height: 14 }} /> }],
          },
        ]}
      />
    </aside>
  );
}

export function WorkspaceDataSourcesSkeleton() {
  const { t } = useI18n();
  return (
    <Flex vertical gap={12} role="status" aria-label={t("Loading workspace…")}>
      {[0, 1, 2].map((key) => (
        <PlasmicDataSource
          key={key}
          root={{ "aria-hidden": true }}
          readOnly
          menuButton={null}
        >
          <Skeleton.Input active size="small" style={{ width: 180, minWidth: 0, height: 14 }} />
        </PlasmicDataSource>
      ))}
    </Flex>
  );
}

export function CmsDatabasesSkeleton() {
  return (
    <Flex vertical gap={12} aria-hidden="true">
      {[0, 1].map((key) => (
        <PlasmicDatabaseListItem
          key={key}
          root={{ as: "div" }}
          editableName={{ render: () => <Skeleton.Input active size="small" style={{ width: 180, minWidth: 0, height: 18 }} /> }}
          timestamp={<Skeleton.Input active size="small" style={{ width: 140, minWidth: 0, height: 14 }} />}
          shared={{ render: () => null }}
          menuButton={{ render: () => null }}
        />
      ))}
    </Flex>
  );
}

export function TeamMembersSkeleton() {
  const { styles } = useMemberStyles();
  return (
    <div aria-hidden="true">
      {[0, 1, 2].map((key) => (
        <div key={key} className={styles.root}>
          <Flex align="center" wrap gap={16}>
            <Flex align="center" gap={12} className={styles.identity}>
              <Skeleton.Avatar active size={32} />
              <Flex vertical>
                <Skeleton.Input active size="small" style={{ width: 120, minWidth: 0, height: 22 }} />
                <Skeleton.Input active size="small" style={{ width: 180, minWidth: 0, height: 22 }} />
              </Flex>
            </Flex>
            <Flex vertical className={styles.detail}>
              <Skeleton.Input active size="small" style={{ width: 130, minWidth: 0, height: 22 }} />
              <Skeleton.Input active size="small" style={{ width: 80, minWidth: 80, height: 22 }} />
            </Flex>
            <Skeleton.Input active style={{ width: 150, minWidth: 0, height: 32 }} />
            <Button disabled icon={<MoreOutlined />} />
          </Flex>
        </div>
      ))}
    </div>
  );
}
