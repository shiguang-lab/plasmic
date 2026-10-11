import NewProjectModal from "@/wab/client/components/NewProjectModal";
import ProjectListItem from "@/wab/client/components/ProjectListItem";
import { PublicLink } from "@/wab/client/components/PublicLink";
import ProjectsFilter from "@/wab/client/components/dashboard/ProjectsFilter";
import dashboard from "@/wab/client/components/dashboard/dashboard.module.scss";
import { documentTitle } from "@/wab/client/components/dashboard/page-utils";
import { useProjectBrowserStyles } from "@/wab/client/components/ui/layout-styles";
import { ProjectCardsSkeleton } from "@/wab/client/components/widgets/ContentSkeletons";
import {
  useAllProjectsData,
  useAppCtx,
} from "@/wab/client/contexts/AppContexts";
import { useProjectsFilter } from "@/wab/client/hooks/useProjectsFilter";
import { useI18n } from "@/wab/client/i18n";
import { APP_ROUTES } from "@/wab/shared/route/app-routes";
import {
  AppstoreOutlined,
  BarsOutlined,
  CloseOutlined,
  FolderOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Empty,
  Flex,
  Segmented,
  Select,
  Typography,
} from "antd";
import { groupBy } from "lodash";
import * as React from "react";

const AllProjectsPage = React.forwardRef<HTMLDivElement>(
  function AllProjectsPage(_props, ref) {
    const { t } = useI18n();
    const appCtx = useAppCtx();
    const { styles, cx } = useProjectBrowserStyles();
    const [showNewProjectModal, setShowNewProjectModal] = React.useState(false);
    const [workspace, setWorkspace] = React.useState<string>("all");
    const [view, setView] = React.useState("grid");
    const [selectedProjectId, setSelectedProjectId] = React.useState<
      string | null
    >();
    const {
      data: projectsData,
      error: loadError,
      mutate: updateProjectsData,
    } = useAllProjectsData();
    const {
      projects,
      matcher,
      props: filterProps,
    } = useProjectsFilter(
      (projectsData?.projects ?? []).filter(
        (project) => workspace === "all" || project.workspaceId === workspace,
      ),
      [],
    );

    const selectedProject =
      selectedProjectId === undefined
        ? projects[0]
        : projects.find((project) => project.id === selectedProjectId);
    const groups = groupBy(
      projects,
      (project) => project.workspaceId ?? "shared",
    );

    return (
      <section ref={ref} className={styles.root}>
        {documentTitle(t("All projects"))}
        <Flex justify="space-between" align="center" wrap gap={16}>
          <Typography.Title level={2} style={{ margin: 0 }}>
            {t("All projects")}
          </Typography.Title>
          <Button
            type="primary"
            icon={<PlusOutlined aria-hidden />}
            onClick={() => setShowNewProjectModal(true)}
          >
            {t("New project")}
          </Button>
        </Flex>
        <Flex
          align="center"
          justify="space-between"
          wrap
          gap={12}
          className={styles.toolbar}
        >
          <Flex align="center" wrap gap={12}>
            <ProjectsFilter {...filterProps} />
            <Select
              aria-label={t("Workspace")}
              value={workspace}
              onChange={setWorkspace}
              style={{ minWidth: 160 }}
              options={[
                { value: "all", label: t("All workspaces") },
                ...appCtx.workspaces.map((item) => ({
                  value: item.id,
                  label: item.name,
                })),
              ]}
            />
          </Flex>
          <Segmented
            aria-label={t("View")}
            value={view}
            onChange={setView}
            options={[
              {
                value: "grid",
                label: t("Grid"),
                icon: <AppstoreOutlined aria-hidden />,
              },
              {
                value: "list",
                label: t("List"),
                icon: <BarsOutlined aria-hidden />,
              },
            ]}
          />
        </Flex>
        {loadError && (
          <Alert
            type="error"
            showIcon
            title={t("Failed to load projects")}
            action={
              <Button
                size="small"
                onClick={() => {
                  void updateProjectsData();
                }}
              >
                {t("Retry")}
              </Button>
            }
          />
        )}
        {!projectsData && !loadError ? (
          <ProjectCardsSkeleton view={view} />
        ) : !projectsData ? null : projects.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              matcher.hasQuery()
                ? t("No projects matching query.")
                : t(
                    'You have no projects. Create a new one by hitting "New project".',
                  )
            }
          >
            {!matcher.hasQuery() && (
              <Button onClick={() => setShowNewProjectModal(true)}>
                {t("New project")}
              </Button>
            )}
          </Empty>
        ) : (
          <div
            className={cx(
              dashboard.projectBrowser,
              selectedProject && dashboard.withDetails,
            )}
          >
            <div className={dashboard.projectLibrary}>
              {Object.entries(groups).map(
                ([workspaceId, workspaceProjects]) => {
                  const groupWorkspace = appCtx.workspaces.find(
                    (item) => item.id === workspaceId,
                  );
                  const label =
                    workspaceId === appCtx.personalWorkspace?.id
                      ? t("My Playground")
                      : (groupWorkspace?.name ?? t("Shared projects"));
                  return (
                    <section
                      className={dashboard.projectGroup}
                      key={workspaceId}
                    >
                      <div className={dashboard.groupHeading}>
                        {groupWorkspace ? (
                          <PublicLink
                            href={
                              workspaceId === appCtx.personalWorkspace?.id
                                ? APP_ROUTES.playground.fill({})
                                : APP_ROUTES.workspace.fill({
                                    workspaceId: groupWorkspace.id,
                                  })
                            }
                          >
                            <FolderOutlined aria-hidden />
                            {label}
                          </PublicLink>
                        ) : (
                          <span>{label}</span>
                        )}
                        <span>{workspaceProjects.length}</span>
                      </div>
                      <div
                        className={cx(
                          styles.grid,
                          view === "list" && styles.list,
                        )}
                      >
                        {workspaceProjects.map((project) => (
                          <ProjectListItem
                            key={project.id}
                            project={project}
                            perms={projectsData.perms}
                            onUpdate={async () => {
                              await updateProjectsData();
                            }}
                            workspaces
                            matcher={matcher}
                            showWorkspace
                            selected={project.id === selectedProject?.id}
                            onSelect={() => setSelectedProjectId(project.id)}
                          />
                        ))}
                      </div>
                    </section>
                  );
                },
              )}
              {workspace === "all" &&
                !matcher.hasQuery() &&
                appCtx.personalWorkspace &&
                !projectsData.projects.some(
                  (project) =>
                    project.workspaceId === appCtx.personalWorkspace?.id,
                ) && (
                  <section className={dashboard.projectGroup}>
                    <div className={dashboard.groupHeading}>
                      <PublicLink href={APP_ROUTES.playground.fill({})}>
                        <FolderOutlined aria-hidden />
                        {t("My Playground")}
                      </PublicLink>
                    </div>
                    <Button
                      icon={<PlusOutlined aria-hidden />}
                      onClick={() => setShowNewProjectModal(true)}
                    >
                      {t("New project")}
                    </Button>
                  </section>
                )}
            </div>
            {selectedProject && (
              <aside
                className={dashboard.detailPanel}
                aria-label={t("Project details")}
              >
                <Flex align="center" justify="space-between">
                  <Typography.Text type="secondary">
                    {t("Project details")}
                  </Typography.Text>
                  <Button
                    type="text"
                    icon={<CloseOutlined aria-hidden />}
                    aria-label={t("Close")}
                    onClick={() => setSelectedProjectId(null)}
                  />
                </Flex>
                <ProjectListItem
                  key={selectedProject.id}
                  project={selectedProject}
                  perms={projectsData.perms}
                  onUpdate={async () => {
                    await updateProjectsData();
                  }}
                  workspaces
                  showWorkspace
                  presentation="details"
                />
              </aside>
            )}
          </div>
        )}
        {showNewProjectModal && (
          <NewProjectModal
            workspaceId={appCtx.personalWorkspace?.id}
            onCancel={() => setShowNewProjectModal(false)}
          />
        )}
      </section>
    );
  },
);
export default AllProjectsPage;
