import styles from "./SaveIndicator.module.less";
import { cx } from "@/wab/shared/common";
import { useStudioSaveState } from "@/wab/client/studio-ctx/save-state";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { DesktopDraftDialog } from "@/wab/client/components/top-bar/DesktopDraftDialog";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { useI18n } from "@/wab/client/i18n";
import {
  useDesktopDraftController,
  useDesktopDraftSelector,
} from "@/wab/client/studio-ctx/desktop-drafts-react";
import { Button, Tooltip } from "antd";
import * as React from "react";

export interface SaveIndicatorProps {
  className?: string;
}

const SaveIndicator = React.forwardRef<HTMLDivElement, SaveIndicatorProps>(
    function SaveIndicator(props, ref) {
      const { t, locale } = useI18n();

      const studioCtx = useStudioCtx();
      const [saveStatus, canSave] = useStudioSaveState(studioCtx,
        useShallow((state) => [state.saveStatus, state.canSave] as const));
      const canEditProject = useStore(studioCtx.uiEnvironment.store,
        (state) => state.canEditProject);
      const status = canEditProject ? saveStatus : "readonly";
      const labels = {
        saved: t("Saved"),
        pending: t("Pending changes"),
        saving: t("Saving…"),
        error: t("Save failed. Click to retry."),
        blocked: t("Saving blocked. Resolve the issue above."),
        unlogged: t("Unlogged changes"),
        readonly: t("Read-only"),
      };
      const controller = useDesktopDraftController(studioCtx);
      const draft = useDesktopDraftSelector(
        controller,
        (state) => state.status,
      );
      const draftState = draft?.state;
      const localLabel =
        draftState === "conflict"
          ? t("Drafts need attention")
          : status === "saved" && draft
            ? t("Synced")
            : draftState === "local"
              ? status === "saving"
                ? t("Syncing…")
                : t("Saved on this device")
              : draftState === "error" && status !== "readonly"
                ? t("Edits are not saved")
                : undefined;
      const description =
        draftState === "conflict"
          ? t(
              "Local drafts are preserved on this device. Click to review them without replacing the remote project.",
            )
          : status === "saved" && draft
            ? t("All edits have been saved to the server.")
            : draftState === "local"
              ? t(
                  "Your edits are backed up on this device but have not synced to the server. They can be recovered on this device.",
                )
              : draftState === "error"
                ? t(
                    "Local backup failed and your latest edits have not synced. Keep the editor open and retry.",
                  )
                : labels[status];
      const tooltip = (
        <>
          <div>{description}</div>
          {draft?.savedAt && (
            <div>
              {t("Last local backup: {time}", {
                time: new Date(draft.savedAt).toLocaleString(locale),
              })}
            </div>
          )}
          {draft?.error && <div>{draft.error}</div>}
        </>
      );
      const label = localLabel ?? labels[status];
      const displayState =
        draftState === "conflict"
          ? "conflict"
          : localLabel && status === "saved"
            ? "synced"
            : localLabel && draftState === "local"
              ? status === "saving"
                ? "saving"
                : "local"
              : localLabel && draftState === "error"
                ? "error"
                : status;
      const canRetry =
        (status === "error" && canSave) ||
        (draftState === "error" && canEditProject) ||
        draftState === "conflict";
      const content = (
        <span className="save-indicator-content">
          <span className="save-indicator-dot" aria-hidden="true" />
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
                  type="link"
                  size="small"
                  aria-label={label}
                  onClick={() => {
                    if (draftState === "conflict" && controller) {
                      controller.setDialogOpen(true);
                    } else {
                      void studioCtx.save();
                    }
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
);

export default SaveIndicator;
