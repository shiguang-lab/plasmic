import DefaultTeamLayout from "@/wab/client/components/dashboard/DefaultTeamLayout";
import { Spinner } from "@/wab/client/components/widgets";
import { useAppCtx } from "@/wab/client/contexts/AppContexts";
import { useLocation } from "@/wab/client/route/HistoryProvider";
import { APP_ROUTES } from "@/wab/shared/route/app-routes";
import { observer } from "mobx-react";
import * as React from "react";

export const DashboardLayout = observer(function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const appCtx = useAppCtx();
  const { pathname } = useLocation();
  const teamId = APP_ROUTES.org.parse(pathname)?.teamId;
  const workspaceId = APP_ROUTES.workspace.parse(pathname)?.workspaceId;
  const workspace = appCtx.workspaces.find((w) => w.id === workspaceId);
  const isPlayground = !!APP_ROUTES.playground.parse(pathname);
  const team =
    workspace?.team ??
    (isPlayground
      ? appCtx.personalTeam
      : appCtx.getAllTeams().find((t) => t.id === teamId));

  return (
    <DefaultTeamLayout
      team={team}
      workspace={workspace}
      navigation={
        isPlayground
          ? "myProjects"
          : APP_ROUTES.allProjects.parse(pathname)
            ? "allProjects"
            : undefined
      }
    >
      <React.Suspense fallback={<Spinner />}>{children}</React.Suspense>
    </DefaultTeamLayout>
  );
});
