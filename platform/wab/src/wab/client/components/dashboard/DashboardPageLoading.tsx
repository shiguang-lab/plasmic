import { NewProjectButton } from "@/wab/client/components/dashboard/NewProjectButton";
import { PersonalWorkspaceTabs } from "@/wab/client/components/dashboard/PersonalWorkspaceTabs";
import dashboard from "@/wab/client/components/dashboard/dashboard.module.scss";
import SettingsContainer from "@/wab/client/components/pages/plasmic/SettingsContainer";
import { useProjectBrowserStyles } from "@/wab/client/components/ui/layout-styles";
import {
  PillSkeleton,
  ProjectCardsSkeleton,
  RowsSkeleton,
} from "@/wab/client/components/widgets/ContentSkeletons";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import { useI18n } from "@/wab/client/i18n";
import { PlasmicEditableResourceName } from "@/wab/client/plasmic/plasmic_kit_dashboard/PlasmicEditableResourceName";
import { PlasmicTeamPage } from "@/wab/client/plasmic/plasmic_kit_dashboard/PlasmicTeamPage";
import { PlasmicTeamPageHeader } from "@/wab/client/plasmic/plasmic_kit_dashboard/PlasmicTeamPageHeader";
import { PlasmicTeamSettings } from "@/wab/client/plasmic/plasmic_kit_dashboard/PlasmicTeamSettings";
import { PlasmicWorkspaceSection } from "@/wab/client/plasmic/plasmic_kit_dashboard/PlasmicWorkspaceSection";
import { useHistory, useLocation } from "@/wab/client/route/HistoryProvider";
import { APP_ROUTES } from "@/wab/shared/route/app-routes";
import { AppstoreOutlined, BarsOutlined } from "@ant-design/icons";
import {
  Button,
  Card,
  Descriptions,
  Flex,
  Input,
  Segmented,
  Select,
  Skeleton,
  Typography,
} from "antd";
import * as React from "react";

function LoadingProjectFilters({
  allWorkspaces = false,
}: {
  allWorkspaces?: boolean;
}) {
  const { t } = useI18n();
  return (
    <Flex align="center" wrap justify="space-between" gap={12}>
      <Flex align="center" wrap gap={12}>
        <Input.Search
          disabled
          placeholder={t("Search…")}
          style={{ width: 240 }}
        />
        <Select
          disabled
          value="updatedAt"
          style={{ minWidth: 150 }}
          options={[{ value: "updatedAt", label: t("Last modified") }]}
        />
        {allWorkspaces && (
          <Select
            disabled
            value="all"
            style={{ minWidth: 160 }}
            options={[{ value: "all", label: t("All workspaces") }]}
          />
        )}
      </Flex>
      <Segmented
        disabled
        options={[
          { value: "grid", label: t("Grid"), icon: <AppstoreOutlined /> },
          { value: "list", label: t("List"), icon: <BarsOutlined /> },
        ]}
      />
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
  const { t } = useI18n();
  const { hash } = useLocation();
  const history = useHistory();
  const { styles } = useProjectBrowserStyles();
  const tab =
    new URLSearchParams(hash.slice(1)).get("tab") === "dataSources"
      ? "dataSources"
      : "projects";
  if (personalWorkspace) {
    return (
      <PersonalWorkspaceTabs
        activeKey={tab}
        onChange={(key) => history.push(`#tab=${key}`)}
        toolbar={
          <Flex align="center" wrap gap={12}>
            {tab === "projects" && <PillSkeleton />}
            <LoadingProjectFilters />
          </Flex>
        }
      >
        <div className={styles.workspaceContent}>
          {tab === "projects" ? <ProjectCardsSkeleton /> : <RowsSkeleton />}
        </div>
      </PersonalWorkspaceTabs>
    );
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
            name={name ?? <Skeleton.Input active style={{ width: 240 }} />}
            editButton={{ render: () => null }}
          />
        ),
      }}
      newProjectButton={{ render: () => <PillSkeleton /> }}
      shareButton={{
        render: () => (personalWorkspace ? null : <PillSkeleton width={80} />),
      }}
      projectsFilter={{ render: () => <LoadingProjectFilters /> }}
      projectsTab={{ children: t("Projects") }}
      dataSourcesTab={{ children: t("Data sources") }}
      numMembers={
        <Skeleton.Input
          active
          size="small"
          style={{ width: 24, minWidth: 24, height: 14 }}
        />
      }
      moreButton={{
        render: () => (personalWorkspace ? null : <PillSkeleton width={36} />),
      }}
      overrides={{
        databases: { render: () => <RowsSkeleton /> },
        dataSources: { render: () => <RowsSkeleton /> },
      }}
      newCmsButton2={{ render: () => <PillSkeleton /> }}
      cmsSection={{ render: () => null }}
    >
      <ProjectCardsSkeleton />
    </PlasmicWorkspaceSection>
  );
}

export function TeamSettingsLoading({ name }: { name?: string }) {
  const { t } = useI18n();
  return (
    <PlasmicTeamSettings
      teamName={name ?? <Skeleton.Input active style={{ width: 220 }} />}
      teamMenuButton={{ render: () => <PillSkeleton width={36} /> }}
      memberList={{
        render: ({ className }) => (
          <section className={className} style={{ padding: 24 }}>
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
                  placeholder={t("Search members")}
                  style={{ width: 280, maxWidth: "100%" }}
                />
                <Select
                  disabled
                  value="all"
                  style={{ minWidth: 180 }}
                  options={[{ value: "all", label: t("All Roles") }]}
                />
              </Flex>
            </Flex>
            <div role="status" aria-label={t("Loading team settings…")}>
              <RowsSkeleton avatar />
            </div>
          </section>
        ),
      }}
      teamBilling={{
        render: ({ className }) => (
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
    return (
      <section className={styles.root}>
        <RowsSkeleton />
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
                        <Skeleton.Input active style={{ width: 240 }} />
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
                  style={{ width: 24, minWidth: 24, height: 14 }}
                />
              }
              numProjects={
                <Skeleton.Input
                  active
                  size="small"
                  style={{ width: 24, minWidth: 24, height: 14 }}
                />
              }
              newWorkspaceButton={{
                render: () => <PillSkeleton width={140} />,
              }}
              settingsButton={{ render: () => <PillSkeleton width={36} /> }}
              filter={{ render: () => <LoadingProjectFilters /> }}
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
        personalWorkspace={!!APP_ROUTES.playground.parse(pathname)}
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
      <Flex align="center" justify="space-between" gap={16}>
        <Typography.Title level={2} style={{ margin: 0 }}>
          {t("All projects")}
        </Typography.Title>
        <NewProjectButton disabled />
      </Flex>
      <div className={styles.toolbar}>
        <LoadingProjectFilters allWorkspaces />
      </div>
      <ProjectCardsSkeleton />
    </section>
  );
}
