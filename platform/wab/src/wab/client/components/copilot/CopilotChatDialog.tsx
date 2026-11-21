import styles from "./CopilotChatDialog.module.less";
import { useAiSessionSnapshot } from "@/wab/client/copilot/ai-session-view";
import { useErrorMessage } from "@/wab/client/hooks/useErrorMessage";
import { useAiAttachments } from "@/wab/client/components/copilot/AiAttachments";
import { AiComposer } from "@/wab/client/components/copilot/AiComposer";
import { usePrepareAiMarkdown } from "@/wab/client/components/copilot/AiMarkdown";
import { AiNodeReference } from "@/wab/client/components/copilot/AiNodeReference";
import { AiResponse } from "@/wab/client/components/copilot/AiResponse";
import { AiSyncNotice } from "@/wab/client/components/copilot/AiSyncNotice";
import { AiRunningNotice, AiThreadPicker } from "@/wab/client/components/copilot/AiThreadPicker";
import { AiWelcome } from "@/wab/client/components/copilot/AiWelcome";
import { PanelCloseButton } from "@/wab/client/components/studio/PanelCloseButton";
import { LoadingError } from "@/wab/client/components/widgets/LoadingError";
import { useAppCtx } from "@/wab/client/contexts/AppContexts";
import type { AiSessionView } from "@/wab/client/copilot/ai-session-view";
import { useLocalAiStatus } from "@/wab/client/copilot/use-local-ai-status";
import { useI18n } from "@/wab/client/i18n";
import { ApiProject, CopilotChatOpenOpts } from "@/wab/shared/ApiSchema";
import type { AiTask } from "@/wab/shared/copilot/ai-chat";
import type { LocalAiModel, LocalAiStatus } from "@/wab/shared/copilot/local-edit";
import { getPublicUrl } from "@/wab/shared/urls";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import { Alert, Button, Image, Skeleton, Spin, Tag } from "antd";
import * as React from "react";
import type { LocalAiContext } from "@/wab/shared/copilot/local-edit";

export interface CopilotChatDialogProps {
  context?: LocalAiContext;
  project: ApiProject;
  session: AiSessionView;
  fetchStatus: () => Promise<LocalAiStatus>;
  fetchModels: () => Promise<LocalAiModel[]>;
  onDownloadAttachment: (file: AiTask["files"][number]) => Promise<void>;
  chatOpenOpts?: CopilotChatOpenOpts;
  onClose: () => void;
  hiddenByModal: boolean;
  readOnly?: boolean;
}

export function CopilotChatDialog({
  project,
  context,
  session,
  fetchStatus,
  fetchModels,
  onDownloadAttachment,
  chatOpenOpts,
  onClose,
  hiddenByModal,
  readOnly = false,
}: CopilotChatDialogProps) {
  const { t, label, locale } = useI18n();

  const appCtx = useAppCtx();
  const enabled = appCtx.appConfig.enableLocalAiEditing;
  const view = useAiSessionSnapshot(session);
  const tasks = view.visibleTasks;
  const markdown = usePrepareAiMarkdown();
  const model = view.selectedModel;
  const draft = view.draft.prompt;
  const threadId = view.activeThreadId;
  const setDraft = (prompt: string) => {
    session.setThreadDraft(view.activeThreadId, { ...view.draft, prompt });
  };
  const attachmentState = useAiAttachments(
    view.draft.attachments,
    attachments => session.setThreadAttachments(threadId, attachments),
    threadId,
  );
  const { data: status, error, modelsLoaded, refreshModels } = useLocalAiStatus(
    project.id,
    enabled,
    fetchStatus,
    fetchModels,
  );
  useErrorMessage(error);
  useErrorMessage(view.error);
  const consumed = React.useRef<CopilotChatOpenOpts>(undefined);
  React.useEffect(() => {
    if (status) {
      const selected = session.selectedModel;
      if (!selected || (modelsLoaded && !status.models.some(option => option.id === selected))) {
        session.setSelectedModel(status.model ?? undefined);
      }
    }
  }, [status, modelsLoaded, session]);
  React.useEffect(() => {
    if (chatOpenOpts?.prompt && consumed.current !== chatOpenOpts) {
      session.setThreadDraft(session.activeThreadId, {
        ...session.draft,
        prompt: chatOpenOpts.prompt,
      });
      if (!readOnly && status?.configured && !session.running) {
        consumed.current = chatOpenOpts;
        void session.run(
          chatOpenOpts.prompt,
          context?.binding,
          appCtx.appConfig.enableLocalAiPageGeneration &&
            status.pageGenerationEnabled
            ? "auto"
            : undefined,
          session.draft.attachments,
          model ?? status.model ?? undefined,
        );
      }
    }
  }, [chatOpenOpts, status, session, model, view.running]);
  const historyRef = React.useRef<HTMLElement>(null);
  const followLatest = React.useRef(view.scrollTop < 0);
  const previousLastTask = React.useRef(tasks.at(-1)?.id);
  const [displayedThread, setDisplayedThread] = React.useState<string>();
  // Keep an already displayed conversation mounted while paging through older messages.
  const historyReady = markdown.ready &&
    (!view.historyLoading || displayedThread === view.activeThreadId);
  React.useLayoutEffect(() => {
    if (!historyReady) {
      return;
    }
    const changedThread = displayedThread !== view.activeThreadId;
    if (changedThread) {
      followLatest.current = session.scrollTop < 0;
      setDisplayedThread(view.activeThreadId);
    } else if (tasks.at(-1)?.id !== previousLastTask.current) {
      followLatest.current = true;
    }
    previousLastTask.current = tasks.at(-1)?.id;
    const viewport = historyRef.current;
    if (viewport && (changedThread || followLatest.current)) {
      viewport.scrollTop = changedThread && session.scrollTop >= 0 ? session.scrollTop : viewport.scrollHeight;
    }
  }, [tasks, view.activeThreadId, historyReady, displayedThread]);
  const lastTask = tasks.at(-1);
  const lastRecord = view.tasks
    .flatMap((task) => task.records)
    .filter((record) => !record.undone)
    .at(-1);
  const pageEnabled =
    appCtx.appConfig.enableLocalAiPageGeneration &&
    status?.pageGenerationEnabled;
  const send = () => {
    if (
      enabled &&
      !readOnly &&
      draft.trim() &&
      !session.running &&
      !session.historyLoading &&
      !session.syncError &&
      !session.activeThread?.archivedAt &&
      status?.configured &&
      !attachmentState.reading
    ) {
      consumed.current = chatOpenOpts;
      void session.run(
        draft,
        context?.binding,
        pageEnabled ? "auto" : undefined,
        attachmentState.attachments,
        model,
      );
    }
  };
  return (
    <section
      className={styles.panel}
      aria-label={t("AI assistant")}
      style={{ visibility: hiddenByModal ? "hidden" : undefined }}
      data-test-id="local-ai-panel"
      data-ai-busy={view.running}
    >
      <div className={styles.header}>
        <strong>{t("AI assistant")}</strong>
        <PanelCloseButton onClick={onClose} />
      </div>
      <div className={styles.conversations}><AiThreadPicker session={session} readOnly={readOnly} disabled={!enabled} /></div>
      <Scrollbar
        ref={historyRef}
        scrollX={false}
        defer={false}
        className={styles.history}
        events={{
          scroll: (instance) => {
            if (!historyReady) {
              return;
            }
            const viewport = instance.elements().viewport;
            followLatest.current =
              viewport.scrollHeight -
                viewport.scrollTop -
                viewport.clientHeight <
              48;
            session.setThreadScroll(view.activeThreadId, viewport.scrollTop);
          },
          initialized: (instance) => {
            if (!historyReady) { return; }
            const viewport = instance.elements().viewport;
            viewport.scrollTop = session.scrollTop >= 0 ? session.scrollTop : viewport.scrollHeight;
          },
        }}
      >
        <div
          className={styles.historyContent}
          aria-live="polite"
          onClickCapture={(event) => {
            if (
              event.target instanceof Element &&
              event.target.closest("summary, button[aria-expanded]")
            ) {
              followLatest.current = false;
            }
          }}
        >
          {!enabled && (
            <Alert type="info" message={t("Local AI editing is disabled.")} />
          )}
          {enabled && status && !status.configured && (
            <Alert
              type="warning"
              message={t(
                "Configure the AI service on the server to start editing.",
              )}
            />
          )}
          {historyReady && view.before && (
            <Button onClick={() => void session.loadEarlier()}>
              {t("Load earlier messages")}
            </Button>
          )}
          <AiSyncNotice session={session} />
          {markdown.error ? (
            <LoadingError onRetry={markdown.retry} />
          ) : !historyReady ? (
            <div aria-busy="true">
              <Skeleton title={false} paragraph={{ rows: 3 }} />
            </div>
          ) : view.historyLoading && <Spin size="small" />}
          {historyReady && !tasks.length && !view.historyLoading && !view.syncError && <AiWelcome pageEnabled={!!pageEnabled} hasWorkspace={!!context?.binding} disabled={!enabled || readOnly || !status?.configured || !!view.activeThread?.archivedAt}
            onChoose={prompt => setDraft(draft ? `${draft}\n${prompt}` : prompt)} />}
          {historyReady && tasks.map((task) => (
            <article
              key={task.id}
              className={styles.task}
              data-test-id="local-ai-task"
              data-ai-status={task.status}
              data-ai-saved-revision={task.savedRevision}
            >
              <div className={styles.request}>
                <p>{task.prompt}</p>
                <div className={styles.metadata}>
                  <span>{task.authorName ?? task.authorId}</span>
                  <time dateTime={task.createdAt}>
                    {new Date(task.createdAt).toLocaleString(locale)}
                  </time>
                </div>
                {!!task.nodes?.length && (
                  <div className={styles.status} style={{ marginTop: 8 }}>
                    {task.nodes.map((node) => (
                      <AiNodeReference
                        key={node.uuid}
                        node={node}
                        onLocate={() => void session.locate(task, node)}
                      />
                    ))}
                  </div>
                )}
                {task.files?.map((file) => {
                  const url = `${getPublicUrl()}/api/v1/projects/${encodeURIComponent(project.id)}/ai/chat/attachments/${encodeURIComponent(file.id)}`;
                  return (
                    <div key={file.id} className={styles.files}>
                      {file.mediaType.startsWith("image/") && (
                        <Image
                          src={`${url}?preview=1`}
                          preview={{ src: url }}
                          width={100}
                          alt={file.name}
                        />
                      )}
                      <a
                        href={url}
                        download={file.name}
                        onClick={(event) => {
                          event.preventDefault();
                          void onDownloadAttachment(file);
                        }}
                      >
                        {file.name}
                      </a>
                    </div>
                  );
                })}
              </div>
              <div className={styles.response}>
                <div className={styles.status}>
                  <span>{t("AI assistant")}</span>
                  {task.model && <span>{task.model}</span>}

                  <Tag
                    color={
                      task.status === "failed"
                        ? "error"
                        : task.status === "running"
                          ? "processing"
                          : undefined
                    }
                  >
                    {task.phase === "Thinking"
                      ? t("Thinking")
                      : label(task.phase)}
                  </Tag>
                  {task.binding && (
                    <span>
                      {t("Scope")}:{" "}
                      {task.binding.canvasName ??
                        task.scopeLabel ??
                        t("Current page")}
                    </span>
                  )}
                </div>
                <AiResponse
                  task={task}
                  session={session}
                  lastRecord={lastRecord}
                />
                {task.error && <Alert type="error" message={task.error} />}
                {task.needsReconciliation && view.stoppable.includes(task.id) && (
                  <Button onClick={() => void session.reconcile(task)}>
                    {t("Verify saved design")}
                  </Button>
                )}
                {(task.status === "failed" || task.status === "stopped") &&
                  !task.needsReconciliation &&
                  view.stoppable.includes(task.id) && (
                    <Button
                      disabled={view.running}
                      onClick={() => void session.retry(task)}
                    >
                      {t("Retry in current editor")}
                    </Button>
                  )}
                {task.savedRevision !== undefined && (
                  <p className={styles.note}>
                    {t("Saved revision {revision}.", {
                      revision: task.savedRevision,
                    })}
                  </p>
                )}
                {task.status === "completed" && task.intent !== "discuss" && (
                  <p className={styles.note}>
                    {t(
                      "Model structure checked. Visual layout and interactions were not tested.",
                    )}
                  </p>
                )}
                {(task.status === "stopped" || task.status === "failed") &&
                  task.records.length > 0 && (
                    <p className={styles.note}>
                      {t(
                        "Completed changes are retained and may have been saved automatically.",
                      )}
                    </p>
                  )}
              </div>
            </article>
          ))}
        </div>
      </Scrollbar>
      <div className={styles.composer}>
        <AiRunningNotice session={session} />
        {view.activeThread?.archivedAt && <Alert type="info" message={t("This conversation is archived. Restore it to continue.")} action={!readOnly && <Button size="small" onClick={() => void session.updateThread(view.activeThreadId, {archived: false})}>{t("Restore conversation")}</Button>} />}
        <AiComposer
          value={draft}
          onChange={setDraft}
          onSubmit={send}
          attachmentState={attachmentState}
          scope={
            context?.scope ??
            (view.running && lastTask?.scopeLabel
              ? lastTask.scopeLabel
              : t("Current canvas"))
          }
          models={status?.models}
          onModelMenuOpen={refreshModels}
          model={model ?? status?.model}
          onModelChange={(value) => {
            session.setSelectedModel(value);
          }}
          disabled={!enabled || readOnly || !!view.activeThread?.archivedAt}
          canSubmit={!!status?.configured && !view.running && !view.historyLoading && !view.syncError}
          running={view.activeRun?.threadId === view.activeThreadId}
          onStop={() => session.stop()}
          stopDisabled={
            lastTask?.status !== "running" ||
            !view.stoppable.includes(lastTask.id) ||
            lastTask.phase === "Stopping"
          }
          placeholder={t(
            pageEnabled
              ? "Describe changes or a new page…"
              : "Describe what you want to change…",
          )}
          inputTestId="local-ai-prompt"
        />
      </div>
    </section>
  );
}
