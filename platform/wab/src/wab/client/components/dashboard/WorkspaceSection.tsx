import {
  promptNewDatabase,
  WorkspaceMenu,
} from "@/wab/client/components/dashboard/dashboard-actions";
import { WorkspaceDataSourcesSkeleton } from "@/wab/client/components/dashboard/DashboardSkeletons";
import DatabaseListItem from "@/wab/client/components/dashboard/DatabaseListItem";
import { NewProjectButton } from "@/wab/client/components/dashboard/NewProjectButton";
import ProjectsFilter, {
  ProjectsFilterProps,
} from "@/wab/client/components/dashboard/ProjectsFilter";
import WorkspaceDataSources from "@/wab/client/components/dashboard/WorkspaceDataSources";
import { WorkspaceTabs } from "@/wab/client/components/dashboard/WorkspaceTabs";
import EditableResourceName from "@/wab/client/components/EditableResourceName";
import { DataSourceModal } from "@/wab/client/components/modals/DataSourceModal";
import { maybeShowPaywall } from "@/wab/client/components/modals/PricingModal";
import NewProjectModal from "@/wab/client/components/NewProjectModal";
import ProjectListItem from "@/wab/client/components/ProjectListItem";
import { useProjectBrowserStyles } from "@/wab/client/components/ui/layout-styles";
import { Matcher } from "@/wab/client/components/view-common";
import MenuButton from "@/wab/client/components/widgets/MenuButton";
import ShareDialog from "@/wab/client/components/widgets/ShareDialog";
import Textbox from "@/wab/client/components/widgets/Textbox";
import { useAppCtx } from "@/wab/client/contexts/AppContexts";
import {
  useAsyncFnStrict,
  useAsyncStrict,
} from "@/wab/client/hooks/useAsyncStrict";
import { useI18n } from "@/wab/client/i18n";
import {
  DefaultWorkspaceSectionProps,
  PlasmicWorkspaceSection,
} from "@/wab/client/plasmic/plasmic_kit_dashboard/PlasmicWorkspaceSection";
import { useHistory, useLocation } from "@/wab/client/route/HistoryProvider";
import { InlineEdit } from "@/wab/commons/components/InlineEdit";
import { OnClickAway } from "@/wab/commons/components/OnClickAway";
import { Stated } from "@/wab/commons/components/Stated";
import {
  ApiCmsDatabase,
  ApiPermission,
  ApiProject,
  ApiWorkspace,
} from "@/wab/shared/ApiSchema";
import { asOne, ensure, filterMapTruthy, spawn } from "@/wab/shared/common";
import { accessLevelRank } from "@/wab/shared/EntUtil";
import { DATA_SOURCE_PLURAL_LOWER } from "@/wab/shared/Labels";
import {
  filterDirectResourcePerms,
  getAccessLevelToResource,
} from "@/wab/shared/perms";
import {
  AppstoreOutlined,
  BarsOutlined,
  DownOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { HTMLElementRefOf } from "@plasmicapp/react-web";
import { Alert, Button, Dropdown, Flex, Segmented } from "antd";
import * as _ from "lodash";
import * as React from "react";

interface WorkspaceSectionProps extends Omit<
  DefaultWorkspaceSectionProps,
  "databases"
> {
  workspace: ApiWorkspace;
  projects: ApiProject[];
  databases: ApiCmsDatabase[];
  perms: ApiPermission[];
  onUpdate: () => Promise<void>;
  matcher: Matcher;
  filterProps?: ProjectsFilterProps;
}

function WorkspaceSection_(
  {
    workspace,
    projects,
    databases,
    perms,
    onUpdate,
    matcher,
    filterProps,
    ...rest
  }: WorkspaceSectionProps,
  ref: HTMLElementRefOf<"div">,
) {
  const { t } = useI18n();
  const { styles, cx } = useProjectBrowserStyles();
  const [projectView, setProjectView] = React.useState("grid");
  const appCtx = useAppCtx();

  const workspaceAccessLevel = getAccessLevelToResource(
    { type: "workspace", resource: workspace },
    appCtx.selfInfo,
    perms,
  );

  const teamPerms = filterDirectResourcePerms(perms, {
    type: "team",
    id: workspace.team.id,
  });
  const workspacePerms = filterDirectResourcePerms(perms, {
    type: "workspace",
    id: workspace.id,
  });

  const numMembers = _.uniq(
    filterMapTruthy([...teamPerms, ...workspacePerms], (p) =>
      p.user ? p.user.id : p.email,
    ),
  ).length;

  const history = useHistory();
  const { hash } = useLocation();

  const [showNewProjectModal, setShowNewProjectModal] = React.useState(false);
  const [showShareModal, setShowShareModal] = React.useState(false);
  const [showNewDataSourceModal, setShowNewDataSourceModal] =
    React.useState(false);
  const hashParams = new URLSearchParams(hash.slice(1));
  const tabFromHash = hashParams.get("tab") ?? "";
  const openTab = ["projects", "dataSources"].includes(tabFromHash)
    ? (tabFromHash as "projects" | "dataSources")
    : "projects";

  const updateTab = (tab: string) => {
    const params = new URLSearchParams();
    params.set("tab", tab);
    history.push(`#${params.toString()}`);
  };

  const [asyncData, fetchAsyncData] = useAsyncFnStrict(async () => {
    const dataSources = ensure(
      asOne(await appCtx.api.listDataSources(workspace.id)),
      `Should have found a single team (possibly with an empty list of ${DATA_SOURCE_PLURAL_LOWER})`,
    ).dataSources;

    const readOnly =
      accessLevelRank(
        getAccessLevelToResource(
          { type: "workspace", resource: workspace },
          appCtx.selfInfo,
          perms,
        ),
      ) < accessLevelRank("editor");

    return {
      dataSources,
      readOnly,
    };
  }, [appCtx, workspace]);
  useAsyncStrict(fetchAsyncData, [workspace]);

  const databasesList = databases.map((database) => (
    <DatabaseListItem
      key={database.id}
      workspace={workspace}
      database={database}
      matcher={matcher}
      perms={perms}
      onUpdate={onUpdate}
    />
  ));

  const showTabs = !rest.inTeamPage;
  const canCreate =
    accessLevelRank(workspaceAccessLevel) >= accessLevelRank("editor");
  const newCms = () => spawn(promptNewDatabase(appCtx, history, workspace.id));
  const newDataSourceButton =
    canCreate &&
    (appCtx.appConfig.enableDataQueries ? (
      <Dropdown
        trigger={["click"]}
        menu={{
          items: [
            { key: "cms", label: t("New CMS"), onClick: newCms },
            {
              key: "integration",
              label: t("Integrations"),
              onClick: () => setShowNewDataSourceModal(true),
            },
          ],
        }}
      >
        <Button
          color="primary"
          variant="text"
          icon={<PlusOutlined aria-hidden />}
        >
          {t("New data source")} <DownOutlined aria-hidden />
        </Button>
      </Dropdown>
    ) : (
      <Button
        color="primary"
        variant="text"
        icon={<PlusOutlined aria-hidden />}
        onClick={newCms}
      >
        {t("New CMS")}
      </Button>
    ));

  const projectFilters = (
    <Flex align="center" wrap gap={12}>
      {filterProps && <ProjectsFilter {...filterProps} />}
      {openTab === "projects" && (
        <Segmented
          aria-label={t("View")}
          value={projectView}
          onChange={setProjectView}
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
      )}
    </Flex>
  );
  const projectList = (
    <div className={cx(styles.grid, projectView === "list" && styles.list)}>
      {projects.map((project) => (
        <ProjectListItem
          key={project.id}
          project={project}
          perms={perms}
          onUpdate={onUpdate}
          workspaces={true}
          matcher={matcher}
        />
      ))}
    </div>
  );
  const noProjectsText = matcher.hasQuery()
    ? t("No projects matching query.")
    : t("This workspace has no projects.");
  const dataSourcesContent = asyncData.value ? (
    <WorkspaceDataSources
      workspaceId={workspace.id}
      appCtx={appCtx}
      dataSources={asyncData.value.dataSources}
      readOnly={asyncData.value.readOnly}
      workspaceAccessLevel={workspaceAccessLevel}
      matcher={matcher}
      onUpdate={async () => {
        await fetchAsyncData();
      }}
    />
  ) : asyncData.error ? (
    <Alert
      type="error"
      showIcon
      title={t("Failed to load data sources")}
      action={
        <Button size="small" onClick={() => void fetchAsyncData()}>
          {t("Retry")}
        </Button>
      }
    />
  ) : (
    <WorkspaceDataSourcesSkeleton />
  );
  const dataSourcesList = (
    <Flex vertical gap={16} className={styles.workspaceContent}>
      {asyncData.value &&
        !databases.length &&
        !asyncData.value.dataSources.length && (
          <div className={styles.workspaceEmpty}>
            {t(
              matcher.hasQuery()
                ? "No matching resources found"
                : "No entries have been created yet.",
            )}
          </div>
        )}
      {databasesList}
      {dataSourcesContent}
    </Flex>
  );
  const workspaceTabs = (
    <WorkspaceTabs
      activeKey={openTab}
      onChange={updateTab}
      toolbar={
        <Flex align="center" wrap gap={12}>
          {canCreate && openTab === "projects" && (
            <NewProjectButton onClick={() => setShowNewProjectModal(true)} />
          )}
          {openTab === "dataSources" && newDataSourceButton}
          {projectFilters}
        </Flex>
      }
    >
      {openTab === "projects" ? (
        <div className={styles.workspaceContent}>
          {projects.length ? (
            projectList
          ) : (
            <div className={styles.workspaceEmpty}>{noProjectsText}</div>
          )}
        </div>
      ) : (
        dataSourcesList
      )}
    </WorkspaceTabs>
  );

  return (
    <>
      {rest.personalWorkspace ? (
        <div ref={ref} className={rest.className}>
          {workspaceTabs}
        </div>
      ) : (
        <PlasmicWorkspaceSection
          {...rest}
          root={{ ref }}
          editableName={{
            render: (props) => (
              <InlineEdit
                render={({ editing, onStart, onDone }) =>
                  editing ? (
                    <div className={props.className} style={{ width: 300 }}>
                      <Stated defaultValue={false}>
                        {(submitting, setSubmitting) => (
                          <OnClickAway onDone={onDone}>
                            <Textbox
                              autoFocus
                              selectAllOnFocus
                              defaultValue={workspace.name}
                              onEdit={async (name) => {
                                if (name) {
                                  setSubmitting(true);
                                  await maybeShowPaywall(
                                    appCtx,
                                    async () =>
                                      await appCtx.api.updateWorkspace(
                                        workspace.id,
                                        {
                                          name,
                                        },
                                      ),
                                  );
                                  await onUpdate();
                                  await appCtx.reloadAppCtx();
                                  setSubmitting(false);
                                }
                                onDone();
                              }}
                              onEscape={onDone}
                              onBlur={onDone}
                              disabled={submitting}
                            />
                          </OnClickAway>
                        )}
                      </Stated>
                    </div>
                  ) : (
                    <EditableResourceName
                      {...props}
                      {...{
                        name: matcher.boldSnippets(
                          workspace.name,
                          "yellow-snippet",
                        ),
                        onEdit: onStart,
                      }}
                    />
                  )
                }
              />
            ),
          }}
          numMembers={numMembers}
          accessLevel={
            accessLevelRank(workspaceAccessLevel) < accessLevelRank("editor")
              ? "cantEdit"
              : undefined
          }
          newProjectButton={{
            render: (props) =>
              showTabs ? null : (
                <NewProjectButton
                  className={props.className}
                  onClick={() => setShowNewProjectModal(true)}
                />
              ),
          }}
          newCmsButton={{
            children: t("New CMS"),
            onClick: () =>
              spawn(promptNewDatabase(appCtx, history, workspace.id)),
          }}
          shareButton={{
            render: () => null,
          }}
          moreButton={{
            render: () => (
              <MenuButton
                aria-label={t("More")}
                menu={
                  <WorkspaceMenu
                    appCtx={appCtx}
                    workspace={workspace}
                    perms={perms}
                    onUpdate={onUpdate}
                    redirectOnDelete={!rest.inTeamPage}
                    projectCount={projects.length}
                    onShare={() => setShowShareModal(true)}
                  />
                }
              />
            ),
          }}
          projectsFilter={{
            render: () => null,
          }}
          noProjects={!projects.length && (!showTabs || openTab === "projects")}
          noProjectsText={noProjectsText}
          canUseCms={
            !showTabs && (appCtx.appConfig.content || databases.length > 0)
          }
          canUseCmsAndDataSources={showTabs ? openTab : undefined}
          // If empty, just show default contents (No CMSes indicator)
          databases={databasesList.length > 0 ? databasesList : undefined}
          overrides={{
            projectsSection: showTabs
              ? { render: () => workspaceTabs }
              : undefined,
            databases: {
              render: () => databasesList,
            },
          }}
          dataSources={{
            render: () => dataSourcesContent,
          }}
        >
          {projectList}
        </PlasmicWorkspaceSection>
      )}
      <ShareDialog
        open={showShareModal}
        resource={{ type: "workspace", resource: workspace }}
        perms={perms}
        reloadPerms={onUpdate}
        closeDialog={() => setShowShareModal(false)}
      />
      {showNewProjectModal && (
        <NewProjectModal
          onCancel={() => setShowNewProjectModal(false)}
          workspaceId={workspace.id}
        />
      )}
      {showNewDataSourceModal && (
        <DataSourceModal
          appCtx={appCtx}
          workspaceId={workspace.id}
          editingDataSource="new"
          canEdit
          onDone={() => setShowNewDataSourceModal(false)}
          onUpdate={async () => {
            await fetchAsyncData();
          }}
        />
      )}
    </>
  );
}

const WorkspaceSection = React.forwardRef(WorkspaceSection_);
export default WorkspaceSection;
