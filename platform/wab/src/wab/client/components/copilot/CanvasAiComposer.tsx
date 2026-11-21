import styles from "./CanvasAiComposer.module.less";
import { useAiSessionSnapshot } from "@/wab/client/copilot/ai-session-view";
import { AppCtx } from "@/wab/client/app-ctx";
import { useAiAttachments } from "@/wab/client/components/copilot/AiAttachments";
import { AiComposer } from "@/wab/client/components/copilot/AiComposer";
import { AiSyncNotice } from "@/wab/client/components/copilot/AiSyncNotice";
import {
  AiRunningNotice,
  AiThreadPicker,
} from "@/wab/client/components/copilot/AiThreadPicker";
import { getLocalEditSession } from "@/wab/client/copilot/local-edit-session";
import { useLocalAiStatus } from "@/wab/client/copilot/use-local-ai-status";
import { useErrorMessage } from "@/wab/client/hooks/useErrorMessage";
import { useI18n } from "@/wab/client/i18n";
import { LocalAiContext, LocalAiDraft } from "@/wab/shared/copilot/local-edit";
import * as React from "react";

export interface CanvasAiComposerProps {
  appCtx?: AppCtx;
  projectId: string;
  context?: LocalAiContext;
  onOpen?: () => Promise<void>;
  hiddenByModal?: boolean;
  loading?: boolean;
}

export function CanvasAiComposer({
  appCtx,
  projectId,
  context,
  onOpen,
  hiddenByModal,
  loading = !appCtx,
}: CanvasAiComposerProps) {
  const { t } = useI18n();

  const session = React.useMemo(
    () => getLocalEditSession(projectId),
    [projectId],
  );
  const view = useAiSessionSnapshot(session);
  useErrorMessage(view.error);
  const enabled = appCtx?.appConfig.enableLocalAiEditing ?? true;
  // Authentication initializes the session while the shell is already editable.
  // Keep early input outside that reset, then adopt it in the ready session.
  const [pendingDraft, setPendingDraft] = React.useState<LocalAiDraft>();
  const draft = pendingDraft ?? view.draft;
  const setDraft = (next: LocalAiDraft) => {
    if (loading) {
      setPendingDraft(next);
    } else {
      session.setThreadDraft(view.activeThreadId, next);
    }
  };
  React.useLayoutEffect(() => {
    if (!loading && pendingDraft) {
      session.setThreadDraft(session.activeThreadId, pendingDraft);
      setPendingDraft(undefined);
    }
  }, [loading, pendingDraft, session]);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  React.useEffect(() => {
    if (enabled && !loading && pickerOpen) {
      return session.retain();
    }
    return undefined;
  }, [enabled, loading, pickerOpen, session]);
  // Metadata uses the existing login cookie; the server checks the AI flag and
  // project permissions without waiting for application or canvas readiness.
  const { data: status, refreshModels } = useLocalAiStatus(projectId, enabled);
  const activeTask = view.activeRun;
  const archived = !!view.activeThread?.archivedAt;
  const threadId = view.activeThreadId;
  const attachmentState = useAiAttachments(
    draft.attachments,
    (attachments) => {
      if (loading) {
        setPendingDraft({ ...draft, attachments });
      } else {
        session.setThreadAttachments(threadId, attachments);
      }
    },
    loading ? projectId : threadId,
  );
  const open = () => {
    if (
      loading ||
      !enabled ||
      !status?.configured ||
      session.running ||
      session.historyLoading ||
      session.syncError ||
      archived ||
      !context?.binding ||
      !session.draft.prompt.trim() ||
      attachmentState.reading
    ) {
      return;
    }
    // Submit once in the execution owner; opening the panel carries no deferred request.
    void session.run(
      session.draft.prompt.trim(),
      context.binding,
      appCtx?.appConfig.enableLocalAiPageGeneration &&
        status.pageGenerationEnabled
        ? "auto"
        : undefined,
      session.draft.attachments,
      session.selectedModel ?? status.model ?? undefined,
      session.activeThreadId,
    );
    void onOpen?.();
  };
  return (
    <div
      className={styles.position}
      style={{ visibility: hiddenByModal ? "hidden" : undefined }}
    >
      <div className={styles.conversations}>
        <div className={styles.threadPicker}>
          <AiThreadPicker
            session={session}
            disabled={loading || !enabled || !context}
            placement="topRight"
            onOpenChange={setPickerOpen}
          />
        </div>
        <div className={styles.foreground}>
          <AiRunningNotice session={session} onOpen={() => void onOpen?.()} />
          {(pickerOpen || !!activeTask) && <AiSyncNotice session={session} />}
        </div>
      </div>
      <div className={styles.foreground}>
        <AiComposer
          value={draft.prompt}
          onChange={(prompt) => {
            setDraft({ ...draft, prompt });
          }}
          onSubmit={open}
          attachmentState={attachmentState}
          scope={context?.scope ?? t("Current canvas")}
          models={status?.models}
          model={view.selectedModel ?? status?.model}
          onModelMenuOpen={refreshModels}
          onModelChange={(model) => {
            session.setSelectedModel(model);
          }}
          disabled={!enabled || archived}
          running={
            !!activeTask && activeTask.threadId === view.activeThreadId
          }
          onStop={() => session.stop()}
          stopDisabled={!activeTask || !view.stoppable.includes(activeTask.id)}
          canSubmit={
            !loading &&
            enabled &&
            !!context?.binding &&
            !!status?.configured &&
            !view.running &&
            !view.historyLoading &&
            !view.syncError &&
            !archived
          }
          placeholder={t(
            !loading && !context?.binding
              ? "Open a page or canvas before using AI."
              : "Describe what you want to change…",
          )}
          ariaLabel={t("AI canvas editing")}
          testId="canvas-ai-composer"
          availability={
            loading
              ? t("Loading…")
              : !enabled
              ? t("Local AI editing is disabled.")
              : archived
                ? t("This conversation is archived. Restore it to continue.")
                : !status?.configured
                  ? t(
                      "Configure the AI service on the server to start editing.",
                    )
                  : view.blockingTask?.needsReconciliation
                    ? t("Verify saved design")
                    : view.running &&
                        activeTask?.threadId !== view.activeThreadId
                      ? t("A task is running in another conversation.")
                      : !context?.binding
                        ? t("Open a page or canvas before using AI.")
                        : undefined
          }
        />
      </div>
    </div>
  );
}
