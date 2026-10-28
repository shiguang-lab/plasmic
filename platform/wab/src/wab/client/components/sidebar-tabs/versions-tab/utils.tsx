import { SiteDiffs } from "@/wab/client/components/modals/SiteDiffs";
import { showTemporaryPrompt } from "@/wab/client/components/quick-modals";
import { NoItemMessage } from "@/wab/client/components/sidebar-tabs/versions-tab/NoItemMessage";
import Button from "@/wab/client/components/widgets/Button";
import { Modal } from "@/wab/client/components/widgets/Modal";
import { TriggerTarget } from "@/wab/client/components/widgets/TriggerAnchor";
import { useAsyncStrict } from "@/wab/client/hooks/useAsyncStrict";
import { useErrorMessage } from "@/wab/client/hooks/useErrorMessage";
import { getUiLocale, useI18n } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import { translate } from "@/wab/client/i18n/locales";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ApiUser } from "@/wab/shared/ApiSchema";
import { fullName, getUserEmail } from "@/wab/shared/ApiSchemaUtil";
import {
  MinimalRevisionInfo,
  PkgVersionInfoMeta,
} from "@/wab/shared/SharedApi";
import { FastBundler } from "@/wab/shared/bundler";
import { getBundle, parseBundle } from "@/wab/shared/bundles";
import { unbundleProjectDependencyRevision } from "@/wab/shared/core/tagged-unbundle";
import { ChangeLogEntry, compareSites } from "@/wab/shared/site-diffs";
import { filterUsefulDiffs } from "@/wab/shared/site-diffs/filter-useful-diffs";
import { formatDateShortTimeShort } from "@/wab/shared/utils/date-utils";
import { Alert, Form, Spin, Tooltip } from "antd";
import React from "react";

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
    footer={
      <Form onFinish={() => onSubmit(true)}>
        <Form.Item>
          <Button className="mr-sm" onClick={() => onCancel()}>
            {cancelText ?? <UiText message="Cancel" />}
          </Button>
          <Button
            type="primary"
            htmlType="submit"
            onClick={() => onSubmit(true)}
          >
            {confirmText ?? <UiText message="Confirm" />}
          </Button>
        </Form.Item>
      </Form>
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
  diffs,
  isLoadingDiffs,
  error,
  onSubmit,
  onCancel,
}: {
  title: string;
  description: React.ReactNode;
  diffs: ChangeLogEntry[] | null;
  isLoadingDiffs?: boolean;
  error?: Error | null;
  onSubmit: (value: boolean) => void;
  onCancel: () => void;
}) => {
  const { t: uiT } = useI18n();
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
        diffs !== null &&
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
  releases: PkgVersionInfoMeta[],
  revisions: MinimalRevisionInfo[],
  studioCtx: StudioCtx,
  user?: ApiUser | null,
) => {
  // Find the latest published version to compare against
  const latestRelease = releases[0];
  // if there are any revision then the top one should be the latest revisioon otherwise the top relase will be latest
  const latestRevisionId = revisions[0]?.id || latestRelease?.revisionId;

  return showTemporaryPrompt<boolean>((onSubmit, onCancel) => {
    const ModalContent = () => {
      const { t: uiT } = useI18n();

      const state = useAsyncStrict(async () => {
        if (!release.revisionId || !latestRevisionId) {
          return null;
        }
        return getRevisionDiffs(
          release.revisionId,
          latestRevisionId,
          studioCtx,
        );
      }, [release.revisionId, latestRevisionId, studioCtx]);

      return (
        <RevertConfirmModal
          title={uiT("Revert to version {part1}", { part1: release.version })}
          description={
            <>
              <UiText
                message={
                  "You are about to revert to version {part1}, originally published by {part2}."
                }
                values={{
                  part1: release.version,
                  part2: (
                    <UserOnDate
                      user={user}
                      date={new Date(release.createdAt)}
                    />
                  ),
                }}
              />
            </>
          }
          diffs={state.value ?? null}
          isLoadingDiffs={state.loading}
          error={state.error}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      );
    };

    return <ModalContent />;
  });
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
  return showTemporaryPrompt<boolean>((onSubmit, onCancel) => {
    const ModalContent = () => {
      const { t: uiT } = useI18n();
      const state = useAsyncStrict(async () => {
        return getRevisionDiffs(
          revertRevision.id,
          latestRevision.id,
          studioCtx,
        );
      }, [revertRevision.id, latestRevision.id, studioCtx]);

      return (
        <RevertConfirmModal
          title={uiT("Revert to an Autosaved version")}
          description={
            <>
              <UiText
                message={
                  "You are about to go back in time to an autosaved version by {part1}."
                }
                values={{
                  part1: (
                    <UserOnDate
                      user={user}
                      date={new Date(revertRevision.createdAt)}
                    />
                  ),
                }}
              />
            </>
          }
          diffs={state.value ?? null}
          isLoadingDiffs={state.loading}
          error={state.error}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      );
    };

    return <ModalContent />;
  });
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
