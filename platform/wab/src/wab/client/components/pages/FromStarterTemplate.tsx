import { AppCtx } from "@/wab/client/app-ctx";
import { DashboardLayout } from "@/wab/client/components/dashboard/DashboardLayout";
import { ProjectCardsSkeleton } from "@/wab/client/components/widgets/ContentSkeletons";
import { useI18n } from "@/wab/client/i18n";
import { WorkspaceId } from "@/wab/shared/ApiSchema";
import { spawn } from "@/wab/shared/common";
import { APP_ROUTES } from "@/wab/shared/route/app-routes";
import { Typography } from "antd";
import * as React from "react";

export function FromStarterTemplate(props: {
  appCtx: AppCtx;
  projectId?: string;
  baseProjectId?: string;
  name?: string;
  path: string;
  workspaceId?: WorkspaceId;
  version?: string;
}) {
  const { appCtx, projectId, baseProjectId, name, path, workspaceId, version } =
    props;

  const { t } = useI18n();

  React.useEffect(() => {
    const createProject = async () => {
      if (projectId) {
        const { projectId: newProjectId } = await appCtx.api.cloneProject(
          projectId,
          { name, workspaceId },
        );
        return newProjectId;
      } else if (baseProjectId) {
        const { projectId: newProjectId } =
          await appCtx.api.clonePublishedTemplate(
            baseProjectId,
            name,
            workspaceId,
            version,
          );
        return newProjectId;
      }
      return undefined;
    };
    if (appCtx.selfInfo) {
      spawn(
        createProject().then((newProjectId) => {
          if (newProjectId) {
            location.href = APP_ROUTES.project.fill({
              projectId: newProjectId,
            });
          }
        }),
      );
    } else {
      appCtx.router.routeTo(APP_ROUTES.login.fill({}, { continueTo: path }));
    }
  }, [projectId, baseProjectId, appCtx, name]);

  return (
    <DashboardLayout>
      <section style={{ padding: 24 }}>
        <Typography.Title level={2}>
          {name ?? t("New project")}
        </Typography.Title>
        <ProjectCardsSkeleton />
      </section>
    </DashboardLayout>
  );
}
