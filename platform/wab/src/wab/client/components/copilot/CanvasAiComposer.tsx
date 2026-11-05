import { AppCtx } from "@/wab/client/app-ctx";
import { useAiAttachments } from "@/wab/client/components/copilot/AiAttachments";
import { AiComposer } from "@/wab/client/components/copilot/AiComposer";
import { AiSyncNotice } from "@/wab/client/components/copilot/AiSyncNotice";
import {
  AiRunningNotice,
  AiThreadPicker,
} from "@/wab/client/components/copilot/AiThreadPicker";
import {
  editorCanvasControlsLayout,
  editorLeftRailLayout,
} from "@/wab/client/components/ui/layout-styles";
import { getLocalEditSession } from "@/wab/client/copilot/local-edit-session";
import { useLocalAiStatus } from "@/wab/client/copilot/use-local-ai-status";
import { useErrorMessage } from "@/wab/client/hooks/useErrorMessage";
import { useI18n } from "@/wab/client/i18n";
import { LocalAiContext, LocalAiDraft } from "@/wab/shared/copilot/local-edit";
import { createStyles } from "antd-style";
import * as React from "react";

const leftInset =
  editorLeftRailLayout.left +
  editorLeftRailLayout.width +
  editorLeftRailLayout.panelGap;
// Keep the bottom-right canvas controls clear as the editor viewport narrows.
const rightInset = 180;
const useStyles = createStyles(() => ({
  conversations: {
    marginBottom: 4,
    padding: "0 7px",
    width: "100%",
    boxSizing: "border-box",
  },
  threadPicker: {
    width: "fit-content",
    maxWidth: "100%",
    marginInlineStart: "auto",
    position: "relative",
    zIndex: 1000,
    mixBlendMode: "difference",
    color: "#fff",
    "& .ant-btn:not(:disabled):not(.ant-btn-disabled)": { color: "inherit" },
    "& .ant-btn:disabled": { color: "inherit", opacity: 0.4 },
  },
  foreground: {
    position: "relative",
    zIndex: 1000,
  },
  position: {
    // A fixed/z-indexed ancestor would isolate the picker from the canvas backdrop.
    position: "absolute",
    bottom: editorCanvasControlsLayout.edgeInset,
    left: leftInset,
    right: rightInset,
    marginInline: "auto",
    width: 530,
    maxWidth: `calc(100% - ${leftInset + rightInset}px)`,
  },
}));

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
  const { styles } = useStyles();
  const session = React.useMemo(
    () => getLocalEditSession(projectId),
    [projectId],
  );
  React.useSyncExternalStore(session.subscribe, session.snapshot);
  useErrorMessage(session.error);
  const enabled = appCtx?.appConfig.enableLocalAiEditing ?? true;
  // Authentication initializes the session while the shell is already editable.
  // Keep early input outside that reset, then adopt it in the ready session.
  const [pendingDraft, setPendingDraft] = React.useState<LocalAiDraft>();
  const draft = pendingDraft ?? session.draft;
  const setDraft = (next: LocalAiDraft) => {
    if (loading) {
      setPendingDraft(next);
    } else {
      session.draft = next;
    }
  };
  React.useLayoutEffect(() => {
    if (!loading && pendingDraft) {
      session.draft = pendingDraft;
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
  const activeTask = session.activeRun;
  const archived = !!session.activeThread?.archivedAt;
  const threadId = session.activeThreadId;
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
          model={session.selectedModel ?? status?.model}
          onModelMenuOpen={refreshModels}
          onModelChange={(model) => {
            session.selectedModel = model;
          }}
          disabled={!enabled || archived}
          running={
            !!activeTask && activeTask.threadId === session.activeThreadId
          }
          onStop={() => session.stop()}
          stopDisabled={!activeTask || !session.canStop(activeTask)}
          canSubmit={
            !loading &&
            enabled &&
            !!context?.binding &&
            !!status?.configured &&
            !session.running &&
            !session.historyLoading &&
            !session.syncError &&
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
                  : session.blockingTask?.needsReconciliation
                    ? t("Verify saved design")
                    : session.running &&
                        activeTask?.threadId !== session.activeThreadId
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
