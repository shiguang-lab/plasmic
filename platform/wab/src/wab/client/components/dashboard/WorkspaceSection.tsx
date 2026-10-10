import {
  promptNewDatabase,
  WorkspaceMenu,
} from "@/wab/client/components/dashboard/dashboard-actions";
import DatabaseListItem from "@/wab/client/components/dashboard/DatabaseListItem";
import ProjectsFilter, {
  ProjectsFilterProps,
} from "@/wab/client/components/dashboard/ProjectsFilter";
import WorkspaceDataSources from "@/wab/client/components/dashboard/WorkspaceDataSources";
import EditableResourceName from "@/wab/client/components/EditableResourceName";
import { maybeShowPaywall } from "@/wab/client/components/modals/PricingModal";
import NewProjectModal from "@/wab/client/components/NewProjectModal";
import ProjectListItem from "@/wab/client/components/ProjectListItem";
import { useProjectBrowserStyles } from "@/wab/client/components/ui/layout-styles";
import { Matcher } from "@/wab/client/components/view-common";
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
import { useHistory } from "@/wab/client/route/HistoryProvider";
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
import { AppstoreOutlined, BarsOutlined } from "@ant-design/icons";
import { HTMLElementRefOf } from "@plasmicapp/react-web";
import { Alert, Button, Flex, Segmented, Skeleton } from "antd";
import * as _ from "lodash";
import { trimStart } from "lodash";
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

  const [showNewProjectModal, setShowNewProjectModal] = React.useState(false);
  const hashParams = new URLSearchParams(
    trimStart(history.location.hash ?? "", "#"),
  );
  const tabFromHash = hashParams.get("tab") ?? "";
  const openTab = ["projects", "dataSources"].includes(tabFromHash)
    ? (tabFromHash as "projects" | "dataSources")
    : "projects";

  const updateTab = (tab: "projects" | "dataSources") => {
    const params = new URLSearchParams();
    params.set("tab", tab);
    appCtx.router.history.push(`#${params.toString()}`);
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

  return (
    <>
      <PlasmicWorkspaceSection
        {...rest}
        root={{ ref }}
        h3={{ children: t("Content Management Systems (CMS)") }}
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
          children: t("New project"),
          onClick: () => setShowNewProjectModal(true),
        }}
        newCmsButton={{
          children: t("New CMS"),
          onClick: () =>
            spawn(promptNewDatabase(appCtx, history, workspace.id)),
        }}
        newCmsButton2={{
          children: t("New CMS"),
          onClick: () =>
            spawn(promptNewDatabase(appCtx, history, workspace.id)),
        }}
        shareButton={{
          resource: { type: "workspace", resource: workspace },
          perms,
          reloadPerms: onUpdate,
        }}
        moreButton={{
          props: {
            menu: (
              <WorkspaceMenu
                appCtx={appCtx}
                workspace={workspace}
                perms={perms}
                onUpdate={onUpdate}
                redirectOnDelete={!rest.inTeamPage}
                projectCount={projects.length}
              />
            ),
          },
        }}
        projectsFilter={{
          render: () => (
            <Flex align="center" wrap gap={12}>
              {filterProps && <ProjectsFilter {...filterProps} />}
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
            </Flex>
          ),
        }}
        noProjects={!projects.length && (!showTabs || openTab === "projects")}
        noProjectsText={
          matcher.hasQuery()
            ? t("No projects matching query.")
            : t("This workspace has no projects.")
        }
        canUseCms={
          !showTabs && (appCtx.appConfig.content || databases.length > 0)
        }
        canUseCmsAndDataSources={showTabs ? openTab : undefined}
        projectsTab={{
          children: t("Projects"),
          onClick: () => updateTab("projects"),
        }}
        dataSourcesTab={{
          children: t("Data sources"),
          onClick: () => updateTab("dataSources"),
        }}
        // If empty, just show default contents (No CMSes indicator)
        databases={databasesList.length > 0 ? databasesList : undefined}
        overrides={{
          databases: {
            render: () => databasesList,
          },
        }}
        dataSources={{
          render: () =>
            asyncData.value ? (
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
                  <Button
                    size="small"
                    onClick={() => {
                      void fetchAsyncData();
                    }}
                  >
                    {t("Retry")}
                  </Button>
                }
              />
            ) : (
              <Skeleton active paragraph={{ rows: 3 }} />
            ),
        }}
      >
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
      </PlasmicWorkspaceSection>
      {showNewProjectModal && (
        <NewProjectModal
          onCancel={() => setShowNewProjectModal(false)}
          workspaceId={workspace.id}
        />
      )}
    </>
  );
}

const WorkspaceSection = React.forwardRef(WorkspaceSection_);
export default WorkspaceSection;
