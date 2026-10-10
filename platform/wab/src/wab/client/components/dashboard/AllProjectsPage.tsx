import NewProjectModal from "@/wab/client/components/NewProjectModal";
import ProjectListItem from "@/wab/client/components/ProjectListItem";
import ProjectsFilter from "@/wab/client/components/dashboard/ProjectsFilter";
import { documentTitle } from "@/wab/client/components/dashboard/page-utils";
import { useProjectBrowserStyles } from "@/wab/client/components/ui/layout-styles";
import {
  useAllProjectsData,
  useAppCtx,
} from "@/wab/client/contexts/AppContexts";
import { useProjectsFilter } from "@/wab/client/hooks/useProjectsFilter";
import { useI18n } from "@/wab/client/i18n";
import {
  AppstoreOutlined,
  BarsOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Empty,
  Flex,
  Segmented,
  Select,
  Skeleton,
  Typography,
} from "antd";
import * as React from "react";

const AllProjectsPage = React.forwardRef<HTMLDivElement>(
  function AllProjectsPage(_props, ref) {
    const { t } = useI18n();
    const appCtx = useAppCtx();
    const { styles, cx } = useProjectBrowserStyles();
    const [showNewProjectModal, setShowNewProjectModal] = React.useState(false);
    const [workspace, setWorkspace] = React.useState<string>("all");
    const [view, setView] = React.useState("grid");
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
          <div
            className={styles.grid}
            role="status"
            aria-label={t("Loading projects…")}
          >
            {[0, 1, 2].map((key) => (
              <div className={styles.loadingCard} key={key}>
                <Skeleton active paragraph={{ rows: 3 }} />
              </div>
            ))}
          </div>
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
          <div className={cx(styles.grid, view === "list" && styles.list)}>
            {projects.map((project) => (
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
              />
            ))}
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
