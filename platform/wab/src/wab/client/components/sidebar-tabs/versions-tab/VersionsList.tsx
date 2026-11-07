import { useUsersMap } from "@/wab/client/api-hooks";
import { WithContextMenu } from "@/wab/client/components/ContextMenu";
import { NoItemMessage } from "@/wab/client/components/sidebar-tabs/versions-tab/NoItemMessage";
import {
  promptLoad,
  promptVersionRevert,
} from "@/wab/client/components/sidebar-tabs/versions-tab/utils";
import VersionsListItem from "@/wab/client/components/sidebar/VersionsListItem";
import { Matcher } from "@/wab/client/components/view-common";
import { ClickStopper } from "@/wab/client/components/widgets";
import { useI18n } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import { promptTagsAndDesc } from "@/wab/client/prompts";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ApiUser, BranchId } from "@/wab/shared/ApiSchema";
import { PkgVersionInfoMeta } from "@/wab/shared/SharedApi";
import { formatDateShortTimeShort } from "@/wab/shared/utils/date-utils";
import { Menu, Tag } from "antd";
import { useStore } from "zustand";
import React from "react";

interface VersionsListProps {
  studioCtx: StudioCtx;
  matcher: Matcher;
}

export function VersionsList(
  props: VersionsListProps,
) {
  const { t: studioUiT } = useI18n();

  const { studioCtx, matcher } = props;
  const releases = useStore(studioCtx.versionHistory.store, (state) => state.releases);
  const selectedReleaseId = useStore(studioCtx.versionHistory.store, (state) => state.selectedReleaseId);
  const { data: userById } = useUsersMap(releases.map((row) => row.createdById));

  const filteredReleases = React.useMemo(() => {
    if (!userById) {
      return [];
    }
    return releases.filter((release) => {
      const title = `${release.version} : ${
        release.description ??
        formatDateShortTimeShort(new Date(release.createdAt))
      }`;
      return matcher.matches(title);
    });
  }, [userById, releases, matcher]);

  const onSelect = async (release: PkgVersionInfoMeta) => {
    const answer =
      !studioCtx.needsSaving() ||
      !studioCtx.canEditProject() ||
      (await promptLoad("Load published version"));
    if (answer) {
      studioCtx.switchToBranchVersion(release);
    }
  };

  const renderMenu =
    (releaseId: string, user?: ApiUser | null) => () => (
      <Menu>
        <Menu.Item
          key="rename"
          onClick={async () => {
            const release = studioCtx.versionHistory.getRelease(releaseId);
            const tagsAndDesc = await promptTagsAndDesc(
              release.description,
              release.tags ?? [],
              studioCtx,
            );

            const { pkgId, version, branchId } = release;
            const toMerge = {
              description: tagsAndDesc?.desc,
              tags: tagsAndDesc?.tags,
            };
            await studioCtx.updatePkgVersion(
              pkgId,
              version,
              (branchId ?? null) as BranchId | null,
              toMerge,
            );
          }}
        >
          <UiText message={"Edit tags and description"} />
        </Menu.Item>
        <Menu.Item
          key="revert"
          onClick={async () => {
            const release = studioCtx.versionHistory.getRelease(releaseId);
            const answer = await promptVersionRevert(
              release,
              studioCtx.releases,
              studioCtx.revisions,
              studioCtx,
              user,
            );
            if (answer) {
              await studioCtx.revertTo(release);
            }
          }}
        >
          <UiText message={"Revert to this version"} />
        </Menu.Item>
      </Menu>
    );

  if (filteredReleases.length === 0) {
    return (
      <NoItemMessage>
        {releases.length === 0
          ? studioUiT("No Published Versions")
          : studioUiT("No versions match your search")}
      </NoItemMessage>
    );
  }

  return (
    <>
      {filteredReleases.map((release) => {
        const user =
          release.createdById && userById
            ? userById[release.createdById]
            : undefined;
        const menu = renderMenu(release.id, user);
        const title = `${release.version} : ${
          release.description ??
          formatDateShortTimeShort(new Date(release.createdAt))
        }`;

        return (
          <WithContextMenu key={release.id} overlay={menu}>
            <VersionsListItem
              itemDate={release.createdAt}
              publish
              isSelected={selectedReleaseId === release.id}
              onClick={() => onSelect(studioCtx.versionHistory.getRelease(release.id))}
              versionNumber={{ children: `v${release.version}` }}
              versionTitle={{
                children: matcher.boldSnippets(release.description || title),
              }}
              author={user}
              versionsTagsContainer={
                release.tags && release.tags.length > 0
                  ? {
                      children: release.tags.map((tag: string, idx: number) => (
                        <Tag key={`${release.id}-tag-${idx}`}>{tag}</Tag>
                      )),
                    }
                  : { render: () => null }
              }
              btnMore={{
                wrap: (node) => (
                  <ClickStopper preventDefault>{node}</ClickStopper>
                ),
                props: {
                  menu,
                },
              }}
            />
          </WithContextMenu>
        );
      })}
    </>
  );
}
