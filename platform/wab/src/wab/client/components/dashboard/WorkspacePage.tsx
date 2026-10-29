import { reportError } from "@/wab/client/ErrorNotifications";
import { DashboardPageLoading } from "@/wab/client/components/dashboard/DashboardPageLoading";
import styles from "@/wab/client/components/dashboard/dashboard.module.scss";
import { documentTitle } from "@/wab/client/components/dashboard/page-utils";
import { LoadingError } from "@/wab/client/components/widgets/LoadingError";
import { useAppCtx } from "@/wab/client/contexts/AppContexts";
import { useProjectsFilter } from "@/wab/client/hooks/useProjectsFilter";
import { useI18n } from "@/wab/client/i18n";
import {
  DefaultWorkspacePageProps,
  PlasmicWorkspacePage,
} from "@/wab/client/plasmic/plasmic_kit_dashboard/PlasmicWorkspacePage";
import { Redirect } from "@/wab/client/route/Redirect";
import { ForbiddenError, NotFoundError } from "@/wab/shared/ApiErrors/errors";
import { WorkspaceId } from "@/wab/shared/ApiSchema";
import { APP_ROUTES } from "@/wab/shared/route/app-routes";
import { HTMLElementRefOf } from "@plasmicapp/react-web";
import { uniqBy } from "lodash";
import * as React from "react";
import useSWR from "swr";

interface WorkspacePageProps extends Omit<
  DefaultWorkspacePageProps,
  "children" | "title"
> {
  workspaceId: WorkspaceId;
}

function WorkspacePage_(
  props: WorkspacePageProps,
  ref: HTMLElementRefOf<"div">,
) {
  const appCtx = useAppCtx();
  const { t } = useI18n();
  const { workspaceId, ...rest } = props;

  const { data, error, isValidating, mutate } = useSWR(
    ["workspace", workspaceId],
    async () => {
      const { workspace, perms: workspacePerms } =
        await appCtx.api.getWorkspace(workspaceId);
      const { projects, perms: projectsPerms } = await appCtx.api.getProjects({
        query: "byWorkspace",
        workspaceId,
      });
      const databases =
        await appCtx.api.listCmsDatabasesForWorkspace(workspaceId);
      const perms = uniqBy([...workspacePerms, ...projectsPerms], (p) => p.id);
      return { workspace, projects, databases, perms };
    },
    { onError: (loadError) => reportError(loadError) },
  );
  const fetchAsyncData = () =>
    mutate((current) => current, { revalidate: true, throwOnError: false });
  // Stable so memoized project cards skip re-rendering on unrelated changes.
  const onUpdate = React.useCallback(async () => {
    await mutate((current) => current, {
      revalidate: true,
      throwOnError: false,
    });
  }, [mutate]);

  const {
    projects,
    databases,
    matcher,
    props: filterProps,
  } = useProjectsFilter(data?.projects, data?.databases, false);

  if (error instanceof ForbiddenError || error instanceof NotFoundError) {
    // Deleted workspace, or one the user can't access.
    return <Redirect to={APP_ROUTES.dashboard.fill({})} />;
  }

  if (!data) {
    return (
      <>
        {documentTitle(
          appCtx.workspaces.find((workspace) => workspace.id === workspaceId)
            ?.name ?? t("Workspace"),
        )}
        <div
          className={styles.dashboardContent}
          role={error ? undefined : "status"}
          aria-label={error ? undefined : t("Loading workspace…")}
        >
          {error ? (
            <LoadingError
              title="Failed to load workspace"
              loading={isValidating}
              onRetry={() => {
                void fetchAsyncData();
              }}
            />
          ) : (
            <DashboardPageLoading />
          )}
        </div>
      </>
    );
  }

  const { workspace, perms } = data;
  return (
    <>
      {documentTitle(workspace.name)}
      {error && (
        <LoadingError
          title="Failed to load workspace"
          loading={isValidating}
          onRetry={() => {
            void fetchAsyncData();
          }}
        />
      )}
      <PlasmicWorkspacePage
        root={{ ref, className: styles.dashboardContent }}
        defaultLayout={{ render: ({ children }) => <>{children}</> }}
        workspaceSection={{
          props: {
            workspace,
            projects,
            databases,
            onUpdate,
            perms,
            matcher,
            filterProps,
          },
        }}
        {...rest}
      />
    </>
  );
}

const WorkspacePage = React.forwardRef(WorkspacePage_);
export default WorkspacePage;
