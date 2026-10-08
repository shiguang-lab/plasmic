import styles from "@/wab/client/components/TopFrame/TopBar/PreviewPublishSection.module.scss";
import GlobeSvgIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__GlobeSvg";
import type { PreviewPublication } from "@plasmic-shared/preview";
import { Alert, Button, Checkbox, Input, Select } from "antd";
import copy from "copy-to-clipboard";
import React from "react";

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
      aria-label="Published website"
      aria-busy={busy}
      className={styles.section}
    >
      <div className={styles.header}>
        <span className={styles.icon} aria-hidden="true">
          <GlobeSvgIcon />
        </span>
        <h3>Published website</h3>
        <span className={publication?.enabled ? styles.live : styles.offline}>
          {publication?.enabled ? "Live" : "Not published"}
        </span>
      </div>
      <div className={styles.content}>
        <p className={styles.description}>
          Save and publish your latest changes as an interactive website. Anyone
          with the link can view it.
        </p>
        <Checkbox
          checked={enabled}
          disabled={busy || !canEdit}
          onChange={(event) => setEnabled(event.target.checked)}
        >
          Update website when publishing a version
        </Checkbox>
        <div className={styles.field}>
          <label htmlFor="preview-entry-page">Entry page</label>
          {publication?.pages.length ? (
            <Select
              id="preview-entry-page"
              aria-label="Entry page"
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
              aria-label="Entry page"
              value={entryPath}
              disabled={busy || !canEdit}
              placeholder="First page (default)"
              className={styles.input}
              onChange={(event) => setEntryPath(event.target.value)}
            />
          )}
        </div>
        {publication?.enabled && (
          <div className={styles.publication}>
            <div className={styles.description}>
              Published version: {publication.version}
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
                Copy link
              </Button>
            </div>
          </div>
        )}
        <div className={styles.actions}>
          <Button
            type="primary"
            aria-label={
              publication?.enabled ? "Update website" : "Publish website"
            }
            disabled={busy || !canEdit}
            loading={busy}
            onClick={publish}
          >
            {publication?.enabled ? "Update website" : "Publish website"}
          </Button>
          {publication?.enabled && (
            <Button danger disabled={busy || !canEdit} onClick={unpublish}>
              Unpublish website
            </Button>
          )}
        </div>
        {error && (
          <Alert
            type="error"
            showIcon
            message="Website publishing failed"
            description={error}
          />
        )}
      </div>
    </section>
  );
}
