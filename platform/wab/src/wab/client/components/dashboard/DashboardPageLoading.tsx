import ProjectsFilter from "@/wab/client/components/dashboard/ProjectsFilter";
import { CmsDatabasesSkeleton, TeamMembersSkeleton, WorkspaceDataSourcesSkeleton } from "@/wab/client/components/dashboard/DashboardSkeletons";
import { useMembersStyles } from "@/wab/client/components/dashboard/TeamMemberList.styles";
import { useProjectsFilter } from "@/wab/client/hooks/useProjectsFilter";
import { Redirect } from "@/wab/client/route/Redirect";
import { NewProjectButton } from "@/wab/client/components/dashboard/NewProjectButton";
import { WorkspaceTabs } from "@/wab/client/components/dashboard/WorkspaceTabs";
import dashboard from "@/wab/client/components/dashboard/dashboard.module.scss";
import SettingsContainer from "@/wab/client/components/pages/plasmic/SettingsContainer";
import { useProjectBrowserStyles } from "@/wab/client/components/ui/layout-styles";
import {
  PillSkeleton,
  ProjectCardsSkeleton,
  ProjectGroupsSkeleton,
} from "@/wab/client/components/widgets/ContentSkeletons";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import { SELF_HOSTED } from "@/wab/client/env";
import { useI18n } from "@/wab/client/i18n";
import { PlasmicEditableResourceName } from "@/wab/client/plasmic/plasmic_kit_dashboard/PlasmicEditableResourceName";
import { PlasmicTeamPage } from "@/wab/client/plasmic/plasmic_kit_dashboard/PlasmicTeamPage";
import { PlasmicTeamPageHeader } from "@/wab/client/plasmic/plasmic_kit_dashboard/PlasmicTeamPageHeader";
import { PlasmicTeamSettings } from "@/wab/client/plasmic/plasmic_kit_dashboard/PlasmicTeamSettings";
import { PlasmicWorkspaceSection } from "@/wab/client/plasmic/plasmic_kit_dashboard/PlasmicWorkspaceSection";
import { useHistory, useLocation } from "@/wab/client/route/HistoryProvider";
import { APP_ROUTES } from "@/wab/shared/route/app-routes";
import { AppstoreOutlined, BarsOutlined, MoreOutlined, PlusOutlined, SettingOutlined } from "@ant-design/icons";
import {
  Button,
  Card,
  Descriptions,
  Flex,
  Empty,
  Input,
  Segmented,
  Select,
  Skeleton,
  Typography,
} from "antd";
import * as React from "react";

const countSkeletonStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  fontSize: "inherit",
  lineHeight: "inherit",
};

function LoadingProjectFilters({
  allWorkspaces = false,
  showView = true,
}: {
  allWorkspaces?: boolean;
  showView?: boolean;
}) {
  const { t } = useI18n();
  const { props: filterProps } = useProjectsFilter(undefined, undefined);
  return (
    <Flex align="center" wrap justify="space-between" gap={12}>
      <Flex align="center" wrap gap={12}>
        <ProjectsFilter {...filterProps} disabled />
        {allWorkspaces && (
          <Select
            disabled
            value="all"
            style={{ minWidth: 160 }}
            options={[{ value: "all", label: t("All workspaces") }]}
          />
        )}
      </Flex>
      {showView && (
        <Flex align="center" wrap gap={12}>
          {allWorkspaces && <NewProjectButton disabled />}
          <Segmented
            disabled
            options={[
              { value: "grid", label: t("Grid"), icon: <AppstoreOutlined /> },
              { value: "list", label: t("List"), icon: <BarsOutlined /> },
            ]}
          />
        </Flex>
      )}
    </Flex>
  );
}

export function WorkspacePageLoading({
  name,
  inTeamPage = false,
  personalWorkspace = false,
}: {
  name?: string;
  inTeamPage?: boolean;
  personalWorkspace?: boolean;
}) {
  const { hash } = useLocation();
  const history = useHistory();
  const { styles } = useProjectBrowserStyles();
  const { t } = useI18n();
  const appCtx = React.useContext(AppCtxContext);
  const tab =
    new URLSearchParams(hash.slice(1)).get("tab") === "dataSources"
      ? "dataSources"
      : "projects";
  const workspaceTabs = (
      <WorkspaceTabs
        activeKey={tab}
        onChange={(key) => history.push(`#tab=${key}`)}
        toolbar={
          <Flex align="center" wrap gap={12}>
            {tab === "projects" ? <NewProjectButton disabled /> : (
              <Button disabled color="primary" variant="text" icon={<PlusOutlined aria-hidden />}>
                {t(appCtx?.appConfig.enableDataQueries ? "New data source" : "New CMS")}
              </Button>
            )}
            <LoadingProjectFilters showView={tab === "projects"} />
          </Flex>
        }
      >
        <div className={styles.workspaceContent}>
          {tab === "projects" ? <ProjectCardsSkeleton /> : <WorkspaceDataSourcesSkeleton />}
        </div>
      </WorkspaceTabs>
  );
  if (personalWorkspace) {
    return workspaceTabs;
  }
  return (
    <PlasmicWorkspaceSection
      personalWorkspace={personalWorkspace}
      inTeamPage={inTeamPage}
      canUseCmsAndDataSources={inTeamPage ? undefined : tab}
      editableName={{
        render: (props) => (
          <PlasmicEditableResourceName
            className={props.className}
            name={name ?? <Skeleton.Input active size="small" style={{ width: 180, minWidth: 0, height: 16 }} />}
            editButton={{ render: () => null }}
          />
        ),
      }}
      newProjectButton={{ render: () => inTeamPage ? <NewProjectButton disabled /> : null }}
      shareButton={{
        render: () => null,
      }}
      projectsFilter={{ render: () => null }}
      numMembers={
        <Skeleton.Input
          active
          size="small"
          styles={{ root: countSkeletonStyle }}
          style={{ width: 24, minWidth: 24, height: 14 }}
        />
      }
      moreButton={{
        render: () => <Button type="text" disabled aria-label={t("More")} icon={<MoreOutlined aria-hidden />} />,
      }}
      overrides={{
        projectsSection:
          !inTeamPage
            ? {
                render: () => workspaceTabs,
              }
            : undefined,
        databases: { render: () => <CmsDatabasesSkeleton /> },
        dataSources: { render: () => <WorkspaceDataSourcesSkeleton /> },
      }}
      cmsSection={{ render: () => null }}
    >
      <ProjectCardsSkeleton />
    </PlasmicWorkspaceSection>
  );
}

export function TeamSettingsLoading({ name }: { name?: string }) {
  const { t } = useI18n();
  const { styles: members, cx } = useMembersStyles();
  return (
    <PlasmicTeamSettings
      teamName={name ?? <Skeleton.Input active size="small" style={{ width: 180, minWidth: 0, height: 16 }} />}
      teamMenuButton={{ render: () => <Button disabled type="text" aria-label={t("More")} icon={<MoreOutlined aria-hidden />} /> }}
      navSeparator={SELF_HOSTED ? { render: () => null } : undefined}
      memberList={{
        render: ({ className }) => (
          <section className={cx(members.root, className)}>
            <Flex vertical gap={16}>
              <Flex align="center" justify="space-between" wrap gap={12}>
                <Typography.Title level={4} style={{ margin: 0 }}>
                  {t("Members")}
                </Typography.Title>
                <Button disabled type="primary">
                  {t("Invite")}
                </Button>
              </Flex>
              <Flex gap={12} wrap>
                <Input.Search
                  disabled
                  aria-label={t("Search members")}
                  placeholder={t("Search members")}
                  className={members.search}
                />
                <Select
                  disabled
                  value="all"
                  aria-label={t("Filter by role")}
                  className={members.filter}
                  options={[{ value: "all", label: t("All Roles") }]}
                />
              </Flex>
            </Flex>
            <div role="status" aria-label={t("Loading team settings…")}>
              <TeamMembersSkeleton />
            </div>
          </section>
        ),
      }}
      teamBilling={{
        render: ({ className }) => SELF_HOSTED ? null : (
          <Flex className={className} vertical gap={24} style={{ padding: 24 }}>
            <Typography.Title level={4} style={{ margin: 0 }}>
              {t("Billing")}
            </Typography.Title>
            <Card>
              <Descriptions
                title={t("Current plan")}
                column={{ xs: 1, sm: 2, lg: 3 }}
                items={[
                  {
                    key: "plan",
                    label: t("Plan"),
                    children: <Skeleton.Input active size="small" />,
                  },
                  {
                    key: "usage",
                    label: t("Current usage"),
                    children: <Skeleton.Input active size="small" />,
                  },
                ]}
              />
            </Card>
            <Flex align="center" gap={12}>
              <Typography.Text>{t("Billing frequency")}</Typography.Text>
              <PillSkeleton width={160} height={32} />
              <Button
                type="link"
                href="https://www.plasmic.app/pricing"
                target="_blank"
              >
                {t("Learn more.")}
              </Button>
            </Flex>
            <Flex gap={16} wrap>
              {[0, 1, 2].map((key) => (
                <Card key={key} style={{ flex: 1, minWidth: 180 }}>
                  <Flex vertical gap={16}>
                    <Skeleton.Input active size="small" />
                    <Skeleton.Input active />
                    <PillSkeleton />
                  </Flex>
                </Card>
              ))}
            </Flex>
          </Flex>
        ),
      }}
    />
  );
}

// Route fallbacks use the same generated content layouts as loaded pages.
// Only values/permissions that depend on the pending resource are placeholders.
export function DashboardPageLoading() {
  const { pathname } = useLocation();
  const appCtx = React.useContext(AppCtxContext);
  const { t } = useI18n();
  const { styles } = useProjectBrowserStyles();
  const workspaceId = APP_ROUTES.workspace.parse(pathname)?.workspaceId;
  const teamId =
    APP_ROUTES.orgSettings.parse(pathname)?.teamId ??
    APP_ROUTES.org.parse(pathname)?.teamId;
  const team = appCtx?.getAllTeams().find((item) => item.id === teamId);
  if (APP_ROUTES.organizations.parse(pathname)) {
    const firstTeam = appCtx?.getAllTeams()[0];
    if (firstTeam) {
      return <Redirect to={APP_ROUTES.org.fill({ teamId: firstTeam.id })} />;
    }
    return (
      <section className={dashboard.spacesEmpty}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={appCtx ? t("No organizations yet.") : <Skeleton.Input active size="small" style={{ width: 180, height: 22 }} />}
        >
          <Button disabled type="primary" icon={<PlusOutlined aria-hidden />}>{t("New organization")}</Button>
        </Empty>
      </section>
    );
  }
  if (APP_ROUTES.settings.parse(pathname)) {
    return (
      <SettingsContainer
        name={appCtx?.selfInfo?.displayName}
        email={appCtx?.selfInfo?.email}
      />
    );
  }
  if (APP_ROUTES.orgSettings.parse(pathname)) {
    return <TeamSettingsLoading name={team?.name} />;
  }
  if (APP_ROUTES.org.parse(pathname)) {
    return (
      <PlasmicTeamPage
        root={{ className: dashboard.dashboardContent }}
        defaultLayout={{ render: ({ children }) => <>{children}</> }}
        header={{
          render: () => (
            <PlasmicTeamPageHeader
              editableName={{
                render: (props) => (
                  <PlasmicEditableResourceName
                    className={props.className}
                    name={
                      team?.name ?? (
                        <Skeleton.Input active size="small" style={{ width: 180, minWidth: 0, height: 16 }} />
                      )
                    }
                    editButton={{ render: () => null }}
                  />
                ),
              }}
              numMembers={
                <Skeleton.Input
                  active
                  size="small"
                  styles={{ root: countSkeletonStyle }}
                  style={{ width: 24, minWidth: 24, height: 14 }}
                />
              }
              numProjects={
                <Skeleton.Input
                  active
                  size="small"
                  styles={{ root: countSkeletonStyle }}
                  style={{ width: 24, minWidth: 24, height: 14 }}
                />
              }
              newWorkspaceButton={{
                render: () => <Button disabled type="text" icon={<PlusOutlined aria-hidden />}>{t("New workspace")}</Button>,
              }}
              settingsButton={{ render: () => <Button disabled type="text" icon={<SettingOutlined aria-hidden />}>{t("Manage organization")}</Button> }}
              filter={{ render: () => <LoadingProjectFilters showView={false} /> }}
            />
          ),
        }}
      >
        {(
          appCtx?.workspaces.filter((item) => item.team.id === teamId) ?? [
            undefined,
          ]
        ).map((workspace, key) => (
          <WorkspacePageLoading
            key={workspace?.id ?? key}
            name={workspace?.name}
            inTeamPage
          />
        ))}
      </PlasmicTeamPage>
    );
  }
  if (workspaceId || APP_ROUTES.playground.parse(pathname)) {
    return (
      <WorkspacePageLoading
        personalWorkspace={
          !!APP_ROUTES.playground.parse(pathname) ||
          (!!workspaceId && workspaceId === appCtx?.personalWorkspace?.id)
        }
        name={
          workspaceId
            ? appCtx?.workspaces.find((item) => item.id === workspaceId)?.name
            : t("My Playground")
        }
      />
    );
  }
  return (
    <section className={styles.root}>
      <div className={styles.toolbar}>
        <LoadingProjectFilters allWorkspaces />
      </div>
      <div className={styles.workspaceContent}>
        <ProjectGroupsSkeleton />
      </div>
    </section>
  );
}
