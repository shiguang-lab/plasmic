import { useUsersMap } from "@/wab/client/api-hooks";
import { NoItemMessage } from "@/wab/client/components/sidebar-tabs/versions-tab/NoItemMessage";
import {
  promptLoad,
  promptRevisionRevert,
} from "@/wab/client/components/sidebar-tabs/versions-tab/utils";
import VersionsListItem from "@/wab/client/components/sidebar/VersionsListItem";
import { ClickStopper } from "@/wab/client/components/widgets";
import { TriggerTarget } from "@/wab/client/components/widgets/TriggerAnchor";
import { useI18n } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ApiUser, MainBranchId } from "@/wab/shared/ApiSchema";
import { MinimalRevisionInfo } from "@/wab/shared/SharedApi";
import { spawn } from "@/wab/shared/common";
import { Tooltip } from "antd";
import React from "react";
import { useStore } from "zustand";

interface RevisionsListProps {
  studioCtx: StudioCtx;
}

export function RevisionsList(
  props: RevisionsListProps,
) {
  const { t: uiT } = useI18n();
  const { studioCtx } = props;
  const currentBranchName = useStore(studioCtx.uiEnvironment.store, (state) => state.branchName);
  const revisions = useStore(studioCtx.versionHistory.store, (state) => state.revisions);
  const hasReleases = useStore(studioCtx.versionHistory.store, (state) => state.releases.length > 0);
  const selectedRevisionId = useStore(studioCtx.versionHistory.store, (state) => state.selectedRevisionId);
  const { data: userById } = useUsersMap(revisions.map((row) => row.createdById));

  const onSelectRevision = async (projectRevision: MinimalRevisionInfo) => {
    const answer =
      !studioCtx.needsSaving() ||
      !studioCtx.canEditProject() ||
      (await promptLoad("Load autosaved version"));
    if (answer) {
      studioCtx.switchToRevision(projectRevision.id);
    }
  };

  const projectRevisions = React.useMemo(
    () =>
      revisions.filter((revision, index) => {
        // remove latest revision which is current state of the project
        if (index === 0) {
          return false;
        }

        // remove initial revision which were created during project creation
        if (
          !hasReleases &&
          currentBranchName === MainBranchId &&
          revision.revision <= 2
        ) {
          return false;
        }

        return true;
      }),
    [revisions, hasReleases, currentBranchName],
  );

  const onRevert = async (revision: MinimalRevisionInfo, user?: ApiUser) => {
    const answer = await promptRevisionRevert(
      revision,
      studioCtx.revisions[0],
      studioCtx,
      user,
    );
    if (answer) {
      await studioCtx.revertTo(revision);
    }
  };

  if (projectRevisions.length === 0) {
    return (
      <NoItemMessage>
        <UiText message={"No Autosaved Versions"} />
      </NoItemMessage>
    );
  }

  return (
    <>
      {projectRevisions.map((revision) => {
        const author =
          userById && revision.createdById
            ? userById[revision.createdById]
            : undefined;
        return (
          <VersionsListItem
            key={revision.id}
            isSelected={
              selectedRevisionId === revision.id
            }
            itemDate={revision.createdAt}
            onClick={() => onSelectRevision(studioCtx.versionHistory.getRevision(revision.id))}
            revertBtn={{
              wrap: (node) => (
                <ClickStopper
                  style={{
                    display: "flex",
                    alignItems: "center",
                  }}
                  preventDefault
                >
                  <Tooltip title={uiT("Revert to this version")}>
                    <TriggerTarget>{node}</TriggerTarget>
                  </Tooltip>
                </ClickStopper>
              ),
              props: {
                onClick: () => spawn(onRevert(studioCtx.versionHistory.getRevision(revision.id), author)),
              },
            }}
            author={author}
          />
        );
      })}
    </>
  );
}
