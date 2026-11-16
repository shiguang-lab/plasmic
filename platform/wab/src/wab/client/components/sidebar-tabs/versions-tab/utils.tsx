import { SiteDiffs } from "@/wab/client/components/modals/SiteDiffs";
import { showTemporaryPrompt } from "@/wab/client/components/quick-modals";
import { NoItemMessage } from "@/wab/client/components/sidebar-tabs/versions-tab/NoItemMessage";
import Button from "@/wab/client/components/widgets/Button";
import { Modal } from "@/wab/client/components/widgets/Modal";
import { TriggerTarget } from "@/wab/client/components/widgets/TriggerAnchor";
import { useErrorMessage } from "@/wab/client/hooks/useErrorMessage";
import { getUiLocale, useI18n } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import { translate } from "@/wab/client/i18n/locales";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { zIndex } from "@/wab/client/z-index";
import { ApiUser } from "@/wab/shared/ApiSchema";
import { fullName, getUserEmail } from "@/wab/shared/ApiSchemaUtil";
import {
  MinimalRevisionInfo,
  PkgVersionInfoMeta,
} from "@/wab/shared/SharedApi";
import { FastBundler } from "@/wab/shared/bundler";
import { getBundle, parseBundle } from "@/wab/shared/bundles";
import { unbundleProjectDependencyRevision } from "@/wab/shared/core/tagged-unbundle";
import { compareSites } from "@/wab/shared/site-diffs";
import { filterUsefulDiffs } from "@/wab/shared/site-diffs/filter-useful-diffs";
import { formatDateShortTimeShort } from "@/wab/shared/utils/date-utils";
import { Alert, Spin, Tooltip } from "antd";
import React from "react";
// Errors are presented once by useErrorMessage in the confirmation dialog.
// eslint-disable-next-line no-restricted-imports
import { useAsync } from "react-use";

interface ConfirmModalProps {
  title: string;
  onSubmit: (value: boolean) => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  children: React.ReactNode;
}

const ConfirmModal = ({
  title,
  onSubmit,
  onCancel,
  confirmText,
  cancelText,
  children,
}: ConfirmModalProps) => (
  <Modal
    title={title}
    open={true}
    zIndex={zIndex.quickModal}
    footer={
      <>
        <Button className="mr-sm" onClick={onCancel}>
          {cancelText ?? <UiText message="Cancel" />}
        </Button>
        <Button type="primary" onClick={() => onSubmit(true)}>
          {confirmText ?? <UiText message="Confirm" />}
        </Button>
      </>
    }
    onCancel={() => onCancel()}
  >
    {children}
  </Modal>
);

/**
 * Compares two revisions and returns the diffs between them.
 * @param revertRevisionId - The revision to revert to
 * @param latestRevisionId - The latest/current revision to compare against
 * @param studioCtx - The studio context
 * @returns The filtered useful diffs
 */
const getRevisionDiffs = async (
  revertRevisionId: string,
  latestRevisionId: string,
  studioCtx: StudioCtx,
) => {
  const revertBundler = new FastBundler();
  const latestBundler = new FastBundler();

  const { rev: revertRev, depPkgs: revertDepPkgs } =
    await studioCtx.appCtx.api.getProjectRevision(
      studioCtx.siteInfo.id,
      revertRevisionId,
    );
  const { rev: latestRev, depPkgs: latestDepPkgs } =
    await studioCtx.appCtx.api.getProjectRevision(
      studioCtx.siteInfo.id,
      latestRevisionId,
    );

  const revertSite = unbundleProjectDependencyRevision(
    revertBundler,
    getBundle(
      revertRev,
      parseBundle(revertRev).version ?? studioCtx.appCtx.lastBundleVersion,
    ),
    revertDepPkgs,
  ).site;
  const latestSite = unbundleProjectDependencyRevision(
    latestBundler,
    getBundle(latestRev, studioCtx.appCtx.lastBundleVersion),
    latestDepPkgs,
  ).site;

  const changeLog = compareSites(revertSite, latestSite);
  return filterUsefulDiffs(changeLog);
};

/**
 * Renders the revert confirmation modal with diffs.
 */
const RevertConfirmModal = ({
  title,
  description,
  revertRevisionId,
  latestRevisionId,
  studioCtx,
  onSubmit,
  onCancel,
}: {
  title: string;
  description: React.ReactNode;
  revertRevisionId?: string;
  latestRevisionId?: string;
  studioCtx: StudioCtx;
  onSubmit: (value: boolean) => void;
  onCancel: () => void;
}) => {
  const { t: uiT } = useI18n();
  const { value: diffs, loading: isLoadingDiffs, error } = useAsync(async () => {
    if (!revertRevisionId || !latestRevisionId) {
      return null;
    }
    return getRevisionDiffs(revertRevisionId, latestRevisionId, studioCtx);
  }, [revertRevisionId, latestRevisionId, studioCtx]);
  useErrorMessage(error, "Failed to load changes");
  return (
    <ConfirmModal
      title={title}
      onSubmit={onSubmit}
      onCancel={onCancel}
      confirmText={uiT("Revert")}
    >
      <div>
        <Alert
          type="warning"
          showIcon
          className="mv-m"
          description={description}
        />
      </div>
      {error ? (
        <p>
          {uiT(
            "Could not fetch the differences. You can still proceed with the revert.",
          )}
        </p>
      ) : isLoadingDiffs ? (
        <div className="p-m text-center">
          <Spin />
          <div className="mt-sm dimfg">
            <UiText message={"Loading changes..."} />
          </div>
        </div>
      ) : (
        diffs != null &&
        (diffs.length > 0 ? (
          <>
            <div className="mt-m">
              <UiText
                message={
                  "This will undo the following changes made after that point:"
                }
              />
            </div>
            <SiteDiffs diffs={diffs} />
          </>
        ) : (
          <NoItemMessage>
            <UiText message={"No changes"} />
          </NoItemMessage>
        ))
      )}
    </ConfirmModal>
  );
};

export const promptVersionRevert = async (
  release: PkgVersionInfoMeta,
  releases: readonly PkgVersionInfoMeta[],
  revisions: readonly MinimalRevisionInfo[],
  studioCtx: StudioCtx,
  user?: ApiUser | null,
) => {
  // Find the latest published version to compare against
  const latestRelease = releases[0];
  // if there are any revision then the top one should be the latest revisioon otherwise the top relase will be latest
  const latestRevisionId = revisions[0]?.id || latestRelease?.revisionId;

  return showTemporaryPrompt<boolean>((onSubmit, onCancel) => (
    <RevertConfirmModal
      title={translate(getUiLocale(), "Revert to version {part1}", { part1: release.version })}
      description={
        <UiText
          message="You are about to revert to version {part1}, originally published by {part2}."
          values={{
            part1: release.version,
            part2: <UserOnDate user={user} date={new Date(release.createdAt)} />,
          }}
        />
      }
      revertRevisionId={release.revisionId}
      latestRevisionId={latestRevisionId}
      studioCtx={studioCtx}
      onSubmit={onSubmit}
      onCancel={onCancel}
    />
  ));
};

export const promptLoad = async (title: string) => {
  return showTemporaryPrompt<boolean>((onSubmit, onCancel) => (
    <ConfirmModal
      title={title}
      onSubmit={onSubmit}
      onCancel={onCancel}
      confirmText={translate(getUiLocale(), "Yes")}
    >
      <Alert
        type="warning"
        showIcon
        message={<UiText message={"Changes you made may not be saved."} />}
        className="mv-m"
        description={
          <UiText
            message={
              "Consider saving your changes before loading another version. Are you sure you want to proceed?"
            }
          />
        }
      />
    </ConfirmModal>
  ));
};

export const promptRevisionRevert = async (
  revertRevision: MinimalRevisionInfo,
  latestRevision: MinimalRevisionInfo,
  studioCtx: StudioCtx,
  user?: ApiUser,
) => {
  return showTemporaryPrompt<boolean>((onSubmit, onCancel) => (
    <RevertConfirmModal
      title={translate(getUiLocale(), "Revert to an Autosaved version")}
      description={
        <UiText
          message="You are about to go back in time to an autosaved version by {part1}."
          values={{
            part1: <UserOnDate user={user} date={new Date(revertRevision.createdAt)} />,
          }}
        />
      }
      revertRevisionId={revertRevision.id}
      latestRevisionId={latestRevision.id}
      studioCtx={studioCtx}
      onSubmit={onSubmit}
      onCancel={onCancel}
    />
  ));
};

export const UserOnDate = function ({
  user,
  date,
}: {
  user?: ApiUser | null;
  date: Date;
}) {
  const { t: studioUiT } = useI18n();

  return (
    <span>
      <UiText
        message={"{part1} on {part2}"}
        values={{
          part1: user ? (
            <Tooltip title={getUserEmail(user)}>
              <TriggerTarget>{fullName(user)}</TriggerTarget>
            </Tooltip>
          ) : (
            studioUiT("Unknown User")
          ),
          part2: formatDateShortTimeShort(date),
        }}
      />
    </span>
  );
};
