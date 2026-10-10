import styles from "@/wab/client/components/TopFrame/TopBar/PreviewPublishSection.module.scss";
import { useI18n } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import GlobeSvgIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__GlobeSvg";
import type { PreviewPublication } from "@plasmic-shared/preview";
import { Alert, Button, Checkbox, Input, Select } from "antd";
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
    [`& .${styles.content}`]: {
      borderColor: token.colorBorderSecondary,
      background: token.colorBgContainer,
      borderRadius: token.borderRadiusLG,
    },
    [`& .${styles.description}`]: { color: token.colorTextSecondary },
  },
}));

export interface PreviewPublishSectionProps {
  publication: PreviewPublication | null | undefined;
  enabled: boolean;
  setEnabled: (value: boolean) => void;
  entryPath: string;
  setEntryPath: (value: string) => void;
  busy: boolean;
  error?: string;
  canEdit: boolean;
  publish: () => void;
  unpublish: () => void;
}

export default function PreviewPublishSection(
  props: PreviewPublishSectionProps,
) {
  const { t: uiT } = useI18n();
  const { styles: themeStyles, cx } = usePublishStyles();
  const {
    publication,
    enabled,
    setEnabled,
    entryPath,
    setEntryPath,
    busy,
    error,
    canEdit,
    publish,
    unpublish,
  } = props;
  return (
    <section
      aria-label={uiT("Published website")}
      aria-busy={busy}
      className={cx(styles.section, themeStyles.root)}
    >
      <div className={styles.header}>
        <span className={styles.icon} aria-hidden="true">
          <GlobeSvgIcon />
        </span>
        <h3>
          <UiText message={"Published website"} />
        </h3>
        <span className={publication?.enabled ? styles.live : styles.offline}>
          {uiT(publication?.enabled ? "Live" : "Not published")}
        </span>
      </div>
      <div className={styles.content}>
        <p className={styles.description}>
          <UiText
            message={
              "Save and publish your latest changes as an interactive website. Anyone with the link can view it."
            }
          />
        </p>
        <Checkbox
          className={styles.versionUpdate}
          checked={enabled}
          disabled={busy || !canEdit}
          onChange={(event) => setEnabled(event.target.checked)}
        >
          <UiText message={"Also update website when saving a version"} />
        </Checkbox>
        <div className={styles.field}>
          <label htmlFor="preview-entry-page">
            <UiText message={"Entry page"} />
          </label>
          {publication?.pages.length ? (
            <Select
              id="preview-entry-page"
              aria-label={uiT("Entry page")}
              value={entryPath || publication.entryPath}
              disabled={busy || !canEdit}
              className={styles.input}
              onChange={setEntryPath}
              options={publication.pages
                .filter((page) => !page.path.includes("["))
                .map((page) => ({
                  value: page.path,
                  label: `${page.name} (${page.path})`,
                }))}
            />
          ) : (
            <Input
              id="preview-entry-page"
              aria-label={uiT("Entry page")}
              value={entryPath}
              disabled={busy || !canEdit}
              placeholder={uiT("First page (default)")}
              className={styles.input}
              onChange={(event) => setEntryPath(event.target.value)}
            />
          )}
        </div>
        {publication?.enabled && (
          <div className={styles.publication}>
            <div className={styles.description}>
              <UiText
                message={"Published version: {part1}"}
                values={{ part1: publication.version }}
              />
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
              <Button size="small" onClick={() => copy(publication.url)}>
                <UiText message={"Copy link"} />
              </Button>
            </div>
          </div>
        )}
        <div className={styles.actions}>
          <Button
            type="primary"
            aria-label={uiT(
              publication?.enabled ? "Update website" : "Publish website",
            )}
            disabled={busy || !canEdit}
            loading={busy}
            onClick={publish}
          >
            {uiT(publication?.enabled ? "Update website" : "Publish website")}
          </Button>
          {publication?.enabled && (
            <Button danger disabled={busy || !canEdit} onClick={unpublish}>
              <UiText message={"Unpublish website"} />
            </Button>
          )}
        </div>
        {error && (
          <Alert
            type="error"
            showIcon
            title={uiT("Website publishing failed")}
            description={error}
          />
        )}
      </div>
    </section>
  );
}
