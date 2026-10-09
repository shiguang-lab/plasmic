import NewProjectModal from "@/wab/client/components/NewProjectModal";
import ProjectListItem from "@/wab/client/components/ProjectListItem";
import styles from "@/wab/client/components/dashboard/dashboard.module.scss";
import { documentTitle } from "@/wab/client/components/dashboard/page-utils";
import { Spinner } from "@/wab/client/components/widgets";
import {
  useAllProjectsData,
  useAppCtx,
} from "@/wab/client/contexts/AppContexts";
import { useProjectsFilter } from "@/wab/client/hooks/useProjectsFilter";
import { useI18n } from "@/wab/client/i18n";
import {
  DefaultAllProjectsPageProps,
  PlasmicAllProjectsPage,
} from "@/wab/client/plasmic/plasmic_kit_dashboard/PlasmicAllProjectsPage";
import { HTMLElementRefOf } from "@plasmicapp/react-web";
import * as React from "react";

type AllProjectsPageProps = DefaultAllProjectsPageProps;

function AllProjectsPage_(
  props: AllProjectsPageProps,
  ref: HTMLElementRefOf<"div">,
) {
  const { t } = useI18n();
  const appCtx = useAppCtx();
  const [showNewProjectModal, setShowNewProjectModal] = React.useState(false);

  const { data: projectsData, mutate: updateProjectsData } =
    useAllProjectsData();
  const {
    projects,
    matcher,
    props: filterProps,
  } = useProjectsFilter(projectsData?.projects ?? [], []);

  if (!projectsData) {
    return (
      <>
        {documentTitle(t("All projects"))}
        <Spinner />
      </>
    );
  }

  return (
    <>
      {documentTitle(t("All projects"))}
      <PlasmicAllProjectsPage
        root={{ ref, className: styles.dashboardContent }}
        {...props}
        projects={{ className: styles.projects }}
        defaultLayout={{ render: ({ children }) => <>{children}</> }}
        newProjectButton={{
          children: t("New project"),
          onClick: () => setShowNewProjectModal(true),
        }}
        filter={{ props: filterProps }}
        mainList={{
          children: projects.map((project) => (
            <ProjectListItem
              key={project.id}
              project={project}
              perms={projectsData.perms}
              onUpdate={updateProjectsData as () => Promise<void>}
              workspaces={true}
              matcher={matcher}
              showWorkspace={true}
            />
          )),
        }}
        noProjectsText={
          projects.length > 0
            ? { render: () => null }
            : {
                style: { display: "flex" },
                children: matcher.hasQuery()
                  ? t("No projects matching query.")
                  : t(
                      'You have no projects. Create a new one by hitting "New project".',
                    ),
              }
        }
      />
      {showNewProjectModal && (
        <NewProjectModal
          workspaceId={appCtx.personalWorkspace?.id}
          onCancel={() => setShowNewProjectModal(false)}
        />
      )}
    </>
  );
}

const AllProjectsPage = React.forwardRef(AllProjectsPage_);
export default AllProjectsPage;
