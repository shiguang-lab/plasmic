import styles from "@/wab/client/components/dashboard/dashboard.module.scss";
import { useAppCtx } from "@/wab/client/contexts/AppContexts";
import { useI18n } from "@/wab/client/i18n";
import { useHistory } from "@/wab/client/route/HistoryProvider";
import { ApiTeam, ApiWorkspace } from "@/wab/shared/ApiSchema";
import { APP_ROUTES } from "@/wab/shared/route/app-routes";
import { FolderOutlined, TeamOutlined } from "@ant-design/icons";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import type { TreeDataNode } from "antd";
import { Tree, Typography } from "antd";
import { sortBy, uniq } from "lodash";
import { observer } from "mobx-react";
import * as React from "react";

export const SpacesNavigation = observer(function SpacesNavigation({
  team,
  workspace,
}: {
  team?: ApiTeam;
  workspace?: ApiWorkspace;
}) {
  const appCtx = useAppCtx();
  const { t } = useI18n();
  const history = useHistory();
  const teamKey = team ? APP_ROUTES.org.fill({ teamId: team.id }) : undefined;
  const workspaceKey = workspace
    ? APP_ROUTES.workspace.fill({ workspaceId: workspace.id })
    : undefined;
  const [expandedKeys, setExpandedKeys] = React.useState<React.Key[]>([]);
  React.useEffect(() => {
    setExpandedKeys((current) =>
      uniq([
        ...current,
        ...(teamKey ? [teamKey] : []),
        ...(workspaceKey ? [workspaceKey] : []),
      ]),
    );
  }, [teamKey, workspaceKey]);

  const treeData: TreeDataNode[] = appCtx.getAllTeams().map((item) => ({
    key: APP_ROUTES.org.fill({ teamId: item.id }),
    title: <strong title={item.name}>{item.name}</strong>,
    icon: <TeamOutlined aria-hidden />,
    children: sortBy(
      appCtx.workspaces.filter((space) => space.team.id === item.id),
      (space) => space.name,
    ).map((space) => ({
      key: APP_ROUTES.workspace.fill({ workspaceId: space.id }),
      title: <span title={space.name}>{space.name}</span>,
      icon: <FolderOutlined aria-hidden />,
      isLeaf: true,
    })),
  }));

  return (
    <Scrollbar
      role="complementary"
      scrollX={false}
      className={styles.spacesNavigation}
      aria-label={t("Spaces")}
    >
      <Typography.Text type="secondary">{t("Organizations")}</Typography.Text>
      <Tree
        aria-label={t("Spaces")}
        blockNode
        showIcon
        treeData={treeData}
        expandedKeys={expandedKeys}
        onExpand={setExpandedKeys}
        selectedKeys={workspaceKey ? [workspaceKey] : teamKey ? [teamKey] : []}
        onSelect={(keys) => {
          if (keys.length) {
            history.push(String(keys[0]));
          }
        }}
      />
    </Scrollbar>
  );
});
