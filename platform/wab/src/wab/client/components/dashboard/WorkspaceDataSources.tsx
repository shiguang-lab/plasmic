import { AppCtx } from "@/wab/client/app-ctx";
import DataSource from "@/wab/client/components/dashboard/DataSource";
import { DataSourceModal } from "@/wab/client/components/modals/DataSourceModal";
import { Matcher } from "@/wab/client/components/view-common";
import { ApiDataSource, WorkspaceId } from "@/wab/shared/ApiSchema";
import { AccessLevel } from "@/wab/shared/EntUtil";
import { canEditDataSource } from "@/wab/shared/perms";
import { HTMLElementRefOf } from "@plasmicapp/react-web";
import { Flex } from "antd";
import * as React from "react";

export interface WorkspaceDataSourcesProps {
  className?: string;
  workspaceId: WorkspaceId;
  appCtx: AppCtx;
  dataSources: ApiDataSource[];
  matcher: Matcher;
  readOnly: boolean;
  workspaceAccessLevel: AccessLevel;
  onUpdate: () => Promise<void>;
}

function WorkspaceDataSources_(
  {
    workspaceId,
    appCtx,
    dataSources,
    matcher,
    readOnly,
    workspaceAccessLevel,
    onUpdate,
    ...props
  }: WorkspaceDataSourcesProps,
  ref: HTMLElementRefOf<"div">,
) {
  const [isEditing, setIsEditing] = React.useState<ApiDataSource>();
  return (
    <>
      <Flex ref={ref} className={props.className} vertical gap={12}>
        {dataSources
          .filter((source) => matcher.matches(source.name))
          .map((source) => (
            <DataSource
              key={source.id}
              appCtx={appCtx}
              source={source}
              readOnly={
                !canEditDataSource(
                  source.ownerId,
                  appCtx.selfInfo?.id,
                  workspaceAccessLevel,
                )
              }
              matcher={matcher}
              onClick={() => !readOnly && setIsEditing(source)}
              onUpdate={onUpdate}
            />
          ))}
      </Flex>
      {isEditing && (
        <DataSourceModal
          appCtx={appCtx}
          editingDataSource={isEditing}
          onDone={() => setIsEditing(undefined)}
          workspaceId={workspaceId}
          key={isEditing.id}
          onUpdate={onUpdate}
          canEdit={canEditDataSource(
            isEditing.ownerId,
            appCtx.selfInfo?.id,
            workspaceAccessLevel,
          )}
        />
      )}
    </>
  );
}

const WorkspaceDataSources = React.forwardRef(WorkspaceDataSources_);
export default WorkspaceDataSources;
