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
  hasPublishedVersion: boolean;
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
    hasPublishedVersion,
    canEdit,
    publish,
    unpublish,
  } = props;
  return (
    <section
      aria-label="Published website"
      style={{
        padding: 16,
        border: "1px solid #ddd",
        borderRadius: 6,
        margin: "12px 0",
      }}
    >
      <h3>Published website</h3>
      <p>
        Publish an interactive website without Studio controls. Anyone with the
        link can view it. Draft edits stay in Studio.
      </p>
      <Checkbox
        checked={enabled}
        disabled={busy || !canEdit || !!publication?.enabled}
        onChange={(event) => setEnabled(event.target.checked)}
      >
        Publish website when saving a version
      </Checkbox>
      <div style={{ margin: "12px 0" }}>
        <label htmlFor="preview-entry-page">Entry page</label>{" "}
        {publication?.pages.length ? (
          <Select
            id="preview-entry-page"
            aria-label="Entry page"
            value={entryPath || publication.entryPath}
            disabled={busy || !canEdit}
            style={{ minWidth: 240 }}
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
            placeholder="First published page"
            style={{ width: 240 }}
            onChange={(event) => setEntryPath(event.target.value)}
          />
        )}
      </div>
      {publication?.enabled && (
        <>
          <div>Published version: {publication.version}</div>
          <a href={publication.url} target="_blank" rel="noopener noreferrer">
            {publication.url}
          </a>{" "}
          <Button onClick={() => copy(publication.url)}>Copy link</Button>
        </>
      )}
      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <Button
          disabled={!hasPublishedVersion || !canEdit}
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
      {!hasPublishedVersion && (
        <p>
          Save a published version first, or select website publishing above and
          click Publish.
        </p>
      )}
      {error && (
        <Alert
          type="error"
          showIcon
          message="Website publishing failed"
          description={error}
          style={{ marginTop: 12 }}
        />
      )}
    </section>
  );
}
