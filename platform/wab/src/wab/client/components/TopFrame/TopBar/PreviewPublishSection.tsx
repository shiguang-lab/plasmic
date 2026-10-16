import {
  ErrorDescription,
  getErrorType,
} from "@/wab/client/api-error-presentation";
import styles from "@/wab/client/components/TopFrame/TopBar/PreviewPublishSection.module.scss";
import { reactConfirm } from "@/wab/client/components/quick-modals";
import { useI18n } from "@/wab/client/i18n";
import { GlobalOutlined } from "@ant-design/icons";
import type { PreviewPage, PreviewPublication } from "@plasmic-shared/preview";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import {
  Alert,
  Button,
  Checkbox,
  Flex,
  Select,
  Steps,
  Typography,
  notification,
} from "antd";
import { createStyles } from "antd-style";
import copy from "copy-to-clipboard";
import React from "react";

const usePublishStyles = createStyles(({ token }) => ({
  root: {
    color: token.colorText,
    [`& .${styles.icon}, & .${styles.offline}`]: {
      background: token.colorFillSecondary,
      color: token.colorTextSecondary,
    },
    [`& .${styles.live}`]: {
      background: token.colorSuccessBg,
      color: token.colorSuccessText,
    },
    [`& .${styles.content}, & .${styles.version}`]: {
      borderColor: token.colorBorderSecondary,
      background: token.colorBgContainer,
    },
    [`& .${styles.description}, & .${styles.version}`]: {
      color: token.colorTextSecondary,
    },
  },
}));

export interface PreviewPublishSectionProps {
  publication: PreviewPublication | null | undefined;
  pages: PreviewPage[];
  enabled: boolean;
  setEnabled: (value: boolean) => void;
  hasActions: boolean;
  saveLabel:
    "Save version" | "Save version and run integrations" | "Run integrations";
  currentVersion: string;
  entryPath: string;
  setEntryPath: (value: string) => void;
  busy: boolean;
  phase?: "saving" | "building" | "unpublishing" | "integrations";
  success: boolean;
  current: boolean;
  loading: boolean;
  error?: unknown;
  canEdit: boolean;
  publish: () => void;
  unpublish: () => void;
  close: () => void;
  nextVersion?: string;
  releaseDetails?: React.ReactNode;
  options?: React.ReactNode;
  renderDialog: (
    body: React.ReactNode,
    footer: React.ReactNode,
  ) => React.ReactNode;
}

export default function PreviewPublishSection(
  props: PreviewPublishSectionProps,
) {
  const { t } = useI18n();
  const { styles: themeStyles } = usePublishStyles();
  const {
    publication,
    pages,
    enabled,
    setEnabled,
    hasActions,
    saveLabel,
    currentVersion,
    entryPath,
    setEntryPath,
    busy,
    phase,
    success,
    current,
    loading,
    error,
    canEdit,
    publish,
    unpublish,
    close,
    nextVersion,
    releaseDetails,
    options,
    renderDialog,
  } = props;
  const [confirming, setConfirming] = React.useState(false);
  const live = !!publication?.enabled;
  const copyLink = () => {
    if (!publication?.enabled) {
      return;
    }
    if (copy(publication.url)) {
      notification.success({ message: t("Link copied") });
    } else {
      notification.error({ message: t("Could not copy link") });
    }
  };
  const primaryLabel = busy
    ? "Publishing…"
    : success
      ? enabled
        ? "Copy website link"
        : "Done"
      : error
        ? "Retry publishing"
        : !enabled
          ? saveLabel
          : current
            ? "Already up to date"
            : live
              ? "Update publication"
              : "Publish";
  return renderDialog(
    <div className={themeStyles.root}>
      <Scrollbar scrollX={false} className={styles.scroll}>
        <div className={styles.body}>
          <div className={styles.version}>
            <div>{currentVersion}</div>
            <div>{t("Version")}</div>
          </div>
          <section
            aria-label={t("Published website")}
            aria-busy={busy}
            className={styles.section}
          >
            <div className={styles.header}>
              <span className={styles.icon} aria-hidden>
                <GlobalOutlined />
              </span>
              <h3>{t("Published website")}</h3>
              <span className={live ? styles.live : styles.offline}>
                {t(busy ? "Publishing…" : live ? "Live" : "Not published")}
              </span>
            </div>
            <div className={styles.content}>
              <p className={styles.description}>
                {t(
                  "Save and publish your latest changes as an interactive website. Anyone with the link can view it.",
                )}
              </p>
              <Checkbox
                className={styles.versionUpdate}
                checked={enabled}
                disabled={busy || loading || !canEdit}
                onChange={(event) => setEnabled(event.target.checked)}
              >
                {t("Also update website when saving a version")}
              </Checkbox>
              <div className={styles.field}>
                <label htmlFor="preview-entry-page">{t("Entry page")}</label>
                <Select
                  id="preview-entry-page"
                  aria-label={t("Entry page")}
                  value={entryPath || undefined}
                  placeholder={t("First page (default)")}
                  className={styles.input}
                  disabled={busy || loading || !canEdit}
                  onChange={setEntryPath}
                  options={pages
                    .filter((page) => !page.path.includes("["))
                    .map((page) => ({
                      value: page.path,
                      label: `${page.name} (${page.path})`,
                    }))}
                />
              </div>
              {live && (
                <div className={styles.publication}>
                  <div className={styles.description}>
                    {t("Published version: {part1}", {
                      part1: publication.version,
                    })}
                  </div>
                  <div className={styles.linkRow}>
                    <a
                      href={publication.url}
                      title={publication.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {publication.url}
                    </a>
                    <Button size="small" onClick={copyLink}>
                      {t("Copy link")}
                    </Button>
                  </div>
                  <div className={styles.actions}>
                    <Button
                      danger
                      disabled={busy || !canEdit || confirming || loading}
                      onClick={async () => {
                        setConfirming(true);
                        try {
                          if (
                            await reactConfirm({
                              title: t("Unpublish website"),
                              message: t(
                                "The website link will stop working. You can publish again later.",
                              ),
                            })
                          ) {
                            unpublish();
                          }
                        } finally {
                          setConfirming(false);
                        }
                      }}
                    >
                      {t("Unpublish website")}…
                    </Button>
                  </div>
                </div>
              )}
              {busy && (
                <>
                  <p className={styles.description}>
                    {t("You can close this window. Publishing will continue.")}
                  </p>
                  {enabled && phase !== "unpublishing" && (
                    <Steps
                      direction="vertical"
                      size="small"
                      current={
                        phase === "integrations"
                          ? 3
                          : phase === "building"
                            ? 1
                            : 0
                      }
                      items={[
                        { title: t("Save current version") },
                        { title: t("Build interactive website") },
                        { title: t("Update website link") },
                      ]}
                    />
                  )}
                </>
              )}
              {!busy && success && enabled && (
                <Alert
                  type="success"
                  showIcon
                  title={t("Published successfully")}
                />
              )}
              {!!error && (
                <Alert
                  type={getErrorType(error)}
                  showIcon
                  title={t(
                    enabled
                      ? "Website publishing failed"
                      : "The latest publish failed",
                  )}
                  description={
                    <>
                      <ErrorDescription error={error} />
                      {live && (
                        <p>{t("The previous website remains available.")}</p>
                      )}
                    </>
                  }
                />
              )}
            </div>
          </section>
          {releaseDetails}
          {!busy && <div className={styles.options}>{options}</div>}
        </div>
      </Scrollbar>
    </div>,
    <Flex align="center" justify="flex-end" gap={8} wrap>
      <Typography.Text
        type="secondary"
        style={{ flex: 1, textAlign: "start", fontSize: 12 }}
      >
        {busy
          ? t("Publishing…")
          : !canEdit
            ? t("You do not have permission to publish this project.")
            : !enabled
              ? t(saveLabel)
              : nextVersion && !success
                ? t("Publishing automatically saves version {version}.", {
                    version: nextVersion,
                  })
                : enabled && (current || success)
                  ? t("All changes are live.")
                  : t("Publish the saved version and update the website.")}
      </Typography.Text>
      {(busy || (success && enabled)) && (
        <Button type="text" onClick={close}>
          {t(busy ? "Continue in background" : "Done")}
        </Button>
      )}
      <Button
        type="primary"
        id="publish-flow-dialog-publish-btn"
        aria-label={t(primaryLabel)}
        disabled={
          busy ||
          loading ||
          (!success && (!canEdit || (enabled ? current : !hasActions)))
        }
        loading={busy}
        onClick={success ? (enabled ? copyLink : close) : publish}
      >
        {t(primaryLabel)}
      </Button>
    </Flex>,
  );
}
