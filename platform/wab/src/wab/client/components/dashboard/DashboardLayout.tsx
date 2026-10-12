import { DashboardPageLoading } from "@/wab/client/components/dashboard/DashboardPageLoading";
import DefaultTeamLayout from "@/wab/client/components/dashboard/DefaultTeamLayout";
import { SpacesNavigation } from "@/wab/client/components/dashboard/SpacesNavigation";
import styles from "@/wab/client/components/dashboard/dashboard.module.scss";
import { SpacesNavigationSkeleton } from "@/wab/client/components/dashboard/DashboardSkeletons";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import { useLocation } from "@/wab/client/route/HistoryProvider";
import { APP_ROUTES } from "@/wab/shared/route/app-routes";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import { observer } from "mobx-react";
import * as React from "react";

export const DashboardLayout = observer(function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const appCtx = React.useContext(AppCtxContext);
  const { pathname } = useLocation();
  const teamId =
    APP_ROUTES.orgSettings.parse(pathname)?.teamId ??
    APP_ROUTES.org.parse(pathname)?.teamId;
  const workspaceId = APP_ROUTES.workspace.parse(pathname)?.workspaceId;
  const workspace = appCtx?.workspaces.find((w) => w.id === workspaceId);
  const isPlayground = !!APP_ROUTES.playground.parse(pathname);
  const isPersonalWorkspace =
    !!workspace && workspace.id === appCtx?.personalWorkspace?.id;
  const team =
    workspace?.team ??
    (isPlayground
      ? appCtx?.personalTeam
      : appCtx?.getAllTeams().find((t) => t.id === teamId));
  const isSpaces =
    !!APP_ROUTES.organizations.parse(pathname) ||
    !!teamId ||
    (!!workspaceId && !isPersonalWorkspace);
  const content = (
    <React.Suspense fallback={<DashboardPageLoading />}>
      {children}
    </React.Suspense>
  );

  return (
    <DefaultTeamLayout
      team={team}
      workspace={workspace}
      navigation={
        isPlayground || isPersonalWorkspace
          ? "myProjects"
          : APP_ROUTES.allProjects.parse(pathname)
            ? "allProjects"
            : isSpaces
              ? "spaces"
              : undefined
      }
    >
      {isSpaces ? (
        <div className={styles.spacesContent}>
          {appCtx ? (
            <SpacesNavigation team={team} workspace={workspace} />
          ) : (
            <SpacesNavigationSkeleton />
          )}
          <Scrollbar scrollX={false} className={styles.spacesDetail}>
            {content}
          </Scrollbar>
        </div>
      ) : (
        content
      )}
    </DefaultTeamLayout>
  );
});
