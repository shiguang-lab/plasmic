import { useI18n } from "@/wab/client/i18n";
import { DesktopDraftDialog } from "@/wab/client/components/top-bar/DesktopDraftDialog";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import {
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  LoadingOutlined,
} from "@ant-design/icons";
import { Button, Tooltip } from "antd";
import { createStyles } from "antd-style";
import { observer } from "mobx-react";
import * as React from "react";

export interface SaveIndicatorProps {
  className?: string;
}

const useStyles = createStyles(({ token }) => ({
  root: {
    display: "flex",
    alignItems: "center",
    flexShrink: 0,
    color: token.colorTextSecondary,
    fontSize: 12,
    "&[data-save-state='error'], &[data-save-state='blocked']": {
      color: token.colorError,
    },
    "&[data-save-state='pending'], &[data-save-state='unlogged']": {
      color: token.colorWarning,
    },
    "&[data-save-state='saved']": { color: token.colorSuccess },
    "& .save-indicator-dot": {
      width: 6,
      height: 6,
      flexShrink: 0,
      borderRadius: "50%",
      background: "currentColor",
    },
    "&[data-save-state='saving']": { color: token.colorPrimary },
    "&[data-save-state='local'], &[data-save-state='conflict']": { color: token.colorWarning },
    "&[data-save-state='synced']": { color: token.colorSuccess },
    "& .save-indicator-content": {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
    },
    "& .save-indicator-label": {
      maxWidth: 140,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    "& .ant-btn": { color: "inherit", paddingInline: 4, height: 28 },
    "@media (max-width: 1100px)": {
      "& .save-indicator-label": { display: "none" },
    },
  },
}));

const SaveIndicator = observer(
  React.forwardRef<HTMLDivElement, SaveIndicatorProps>(
    function SaveIndicator(props, ref) {
      const { t, locale } = useI18n();
      const { styles, cx } = useStyles();
      const studioCtx = useStudioCtx();
      const status = studioCtx.canEditProject()
        ? studioCtx.saveStatus
        : "readonly";
      const labels = {
        saved: t("Saved"),
        pending: t("Pending changes"),
        saving: t("Saving…"),
        error: t("Save failed. Click to retry."),
        blocked: t("Saving blocked. Resolve the issue above."),
        unlogged: t("Unlogged changes"),
        readonly: t("Read-only"),
      };
      const icons = {
        saved: <span className="save-indicator-dot" aria-hidden="true" />,
        pending: <ClockCircleOutlined />,
        saving: <LoadingOutlined spin />,
        error: <ExclamationCircleOutlined />,
        blocked: <ExclamationCircleOutlined />,
        unlogged: <ClockCircleOutlined />,
        readonly: <EyeOutlined />,
      };
      const draft = studioCtx.desktopDraft?.status;
      const draftState = draft?.state;
      const localLabel = draftState === "conflict" ? t("Drafts need attention") :
        status === "saved" && draft ? t("Synced") :
        draftState === "local" ? status === "saving" ? t("Syncing…") : t("Saved on this device") :
        draftState === "error" && status !== "readonly" ? t("Edits are not saved") : undefined;
      const description = draftState === "conflict" ? t("Local drafts are preserved on this device. Click to review them without replacing the remote project.") :
        status === "saved" && draft ? t("All edits have been saved to the server.") :
        draftState === "local" ? t("Your edits are backed up on this device but have not synced to the server. They can be recovered on this device.") :
        draftState === "error" ? t("Local backup failed and your latest edits have not synced. Keep the editor open and retry.") : labels[status];
      const tooltip = <>
        <div>{description}</div>
        {draft?.savedAt && <div>{t("Last local backup: {time}", { time: new Date(draft.savedAt).toLocaleString(locale) })}</div>}
        {draft?.error && <div>{draft.error}</div>}
      </>;
      const label = localLabel ?? labels[status];
      const displayState = draftState === "conflict" ? "conflict" :
        localLabel && status === "saved" ? "synced" :
        localLabel && draftState === "local" ? status === "saving" ? "saving" : "local" :
        localLabel && draftState === "error" ? "error" : status;
      const canRetry = (status === "error" && studioCtx.canSave()) ||
        (draftState === "error" && studioCtx.canEditProject()) || draftState === "conflict";
      const content = (
        <span className="save-indicator-content">
          {displayState === "conflict" || displayState === "error" ? <ExclamationCircleOutlined /> : icons[status]}
          <span className="save-indicator-label">{label}</span>
        </span>
      );
      return (
        <>
        <Tooltip title={tooltip}>
          <div
            ref={ref}
            className={cx(props.className, styles.root)}
            role="status"
            aria-label={label}
            aria-live="polite"
            data-save-state={displayState}
          >
            {canRetry ? (
              <Button
                type="text"
                size="small"
                aria-label={label}
                onClick={() => {
                  if (draftState === "conflict" && studioCtx.desktopDraft) {studioCtx.desktopDraft.dialogOpen = true;}
                  else { void studioCtx.save(); }
                }}
              >
                {content}
              </Button>
            ) : (
              content
            )}
          </div>
        </Tooltip>
        <DesktopDraftDialog studioCtx={studioCtx} />
        </>
      );
    },
  ),
);

export default SaveIndicator;
