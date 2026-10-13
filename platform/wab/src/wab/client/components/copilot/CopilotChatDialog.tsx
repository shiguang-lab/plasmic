import {
  useAiAttachments,
} from "@/wab/client/components/copilot/AiAttachments";
import { AiMarkdown } from "@/wab/client/components/copilot/AiMarkdown";
import { AiComposer } from "@/wab/client/components/copilot/AiComposer";
import { PanelCloseButton } from "@/wab/client/components/studio/PanelCloseButton";
import { editorPanelHeaderStyle } from "@/wab/client/components/ui/layout-styles";
import { useAppCtx } from "@/wab/client/contexts/AppContexts";
import { getLocalEditSession } from "@/wab/client/copilot/local-edit-session";
import { useLocalAiStatus } from "@/wab/client/copilot/use-local-ai-status";
import { useI18n } from "@/wab/client/i18n";
import { ApiProject, CopilotChatOpenOpts } from "@/wab/shared/ApiSchema";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import { Alert, Button, Image, Tag } from "antd";
import { createStyles } from "antd-style";
import * as React from "react";

import type { LocalAiContext } from "@/wab/shared/copilot/local-edit";

export interface CopilotChatDialogProps {
  context?: LocalAiContext;
  project: ApiProject;
  width: number;
  chatOpenOpts?: CopilotChatOpenOpts;
  onClose: () => void;
  hiddenByModal: boolean;
  readOnly?: boolean;
}

const useStyles = createStyles(({ token }) => ({
  panel: {
    position: "fixed",
    top: 82,
    left: 84,
    height: "calc(100dvh - 170px)",
    maxWidth: "calc(100vw - 96px)",
    boxSizing: "border-box",
    zIndex: 1000,
    display: "flex",
    flexDirection: "column",
    background: token.colorBgContainer,
    color: token.colorText,
    border: `1px solid ${token.colorBorder}`,
    borderRadius: token.borderRadiusLG,
    boxShadow: token.boxShadowSecondary,
    pointerEvents: "auto",
  },
  header: editorPanelHeaderStyle(token),
  history: { flex: 1, minHeight: 0 },
  historyContent: { padding: 16 },
  task: {
    paddingBottom: 16,
    marginBottom: 16,
    borderBottom: `1px solid ${token.colorBorderSecondary}`,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
  },
  composer: {
    padding: 12,
    flexShrink: 0,
    borderTop: `1px solid ${token.colorBorderSecondary}`,
  },
  details: {
    marginTop: 8,
    "& pre": {
      fontSize: 11,
      whiteSpace: "pre-wrap",
      overflowWrap: "anywhere",
    },
  },
  detailScroll: { maxHeight: 240 },
}));

export function CopilotChatDialog({
  project,
  context,
  width,
  chatOpenOpts,
  onClose,
  hiddenByModal,
  readOnly = false,
}: CopilotChatDialogProps) {
  const { t, label, locale } = useI18n();
  const { styles } = useStyles();
  const appCtx = useAppCtx();
  const enabled = appCtx.appConfig.enableLocalAiEditing;
  const session = React.useMemo(
    () => getLocalEditSession(project.id),
    [project.id],
  );
  const tasks = React.useSyncExternalStore(session.subscribe, session.snapshot);
  const model = session.selectedModel;
  const draft = session.draft.prompt;
  const setDraft = (prompt: string) => {
    session.draft = { ...session.draft, prompt };
  };
  const attachmentState = useAiAttachments(
    session.draft.attachments,
    (attachments) => {
      session.draft = { ...session.draft, attachments };
    },
  );
  const { data: status, error } = useLocalAiStatus(project.id, enabled);
  const consumed = React.useRef<CopilotChatOpenOpts>();
  React.useEffect(() => {
    if (status) {
      const selected = session.selectedModel;
      session.selectedModel =
        selected && status.models.includes(selected)
          ? selected
          : (status.model ?? undefined);
    }
  }, [status, session]);
  React.useEffect(() => {
    if (chatOpenOpts?.prompt && consumed.current !== chatOpenOpts) {
      session.draft = {
        ...session.draft,
        prompt: chatOpenOpts.prompt,
        attachments: chatOpenOpts.attachments ?? [],
      };
      if (!readOnly && status?.configured && !session.running) {
        consumed.current = chatOpenOpts;
        void session.run(
          chatOpenOpts.prompt,
          chatOpenOpts.localEditBinding,
          appCtx.appConfig.enableLocalAiPageGeneration &&
            status.pageGenerationEnabled
            ? "auto"
            : undefined,
          chatOpenOpts.attachments,
          model ?? status.model ?? undefined,
        );
      }
    }
  }, [chatOpenOpts, status, session, model, session.running]);
  const lastTask = tasks.at(-1);
  const lastRecord = tasks
    .flatMap((task) => task.records)
    .filter((record) => !record.undone)
    .at(-1);
  const pageEnabled =
    appCtx.appConfig.enableLocalAiPageGeneration &&
    status?.pageGenerationEnabled;
  const send = () => {
    if (
      enabled && !readOnly &&
      draft.trim() &&
      !session.running &&
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
      style={{ width, visibility: hiddenByModal ? "hidden" : undefined }}
      data-test-id="local-ai-panel"
      data-ai-busy={session.running}
    >
      <div className={styles.header}>
        <strong>{t("AI assistant")}</strong>
        <PanelCloseButton onClick={onClose} />
      </div>
      <Scrollbar scrollX={false} className={styles.history}>
        <div className={styles.historyContent} aria-live="polite">
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
          {error && <Alert type="error" message={label(error.message)} />}
          {session.error && <Alert type="error" message={label(session.error)} />}
          {session.before && <Button onClick={() => void session.loadEarlier()}>{t("Load earlier messages")}</Button>}
          {!tasks.length && (
            <p>
              {t(
                pageEnabled
                  ? "Describe what you need. AI can edit the current selection or page, or create a new page."
                  : "Describe a change to the current selection or page. The editing scope stays fixed during the task.",
              )}
            </p>
          )}
          {tasks.map((task) => (
            <article
              key={task.id}
              className={styles.task}
              data-test-id="local-ai-task"
              data-ai-status={task.status}
              data-ai-saved-revision={task.savedRevision}
            >
              <p>
                <strong>{task.prompt}</strong>
              </p>
              <small>{task.authorName ?? task.authorId} · {task.model} · {new Date(task.createdAt).toLocaleString(locale)}</small>
              {task.files?.map((file) => {
                const url = `/api/v1/projects/${encodeURIComponent(project.id)}/ai/chat/attachments/${file.id}`;
                return <div key={file.id}>{file.mediaType.startsWith("image/") && <Image src={`${url}?preview=1`} preview={{ src: url }} width={100} alt={file.name} />}<a href={url} download={file.name}>{file.name}</a></div>;
              })}
              {task.nodes?.map((node) => <Tag key={node.uuid} onClick={() => void session.locate(task,node.uuid)} style={{ cursor: "pointer" }}>{node.name}</Tag>)}
              <Tag
                color={
                  task.status === "failed"
                    ? "error"
                    : task.status === "running"
                      ? "processing"
                      : undefined
                }
              >
                {label(task.phase)}
              </Tag>
              {task.binding && (
                <p>
                  {t("Pinned scope")}:{" "}
                  {task.scopeLabel ??
                    (task.binding.elementUuids.length
                      ? t("Current selection")
                      : t("Current page"))}
                </p>
              )}
              {task.messages.map((message, index) => (
                <AiMarkdown key={index}>{message}</AiMarkdown>
              ))}
              {task.parts?.flatMap((part,index) => part.type === "result" && part.text !== task.phase && part.text !== task.error
                ? [<p key={`result-${index}`}>{part.status === "verified" ? t("Saved revision {revision} verified. Start a new request from the current editor.",{revision:part.revision ?? ""}) : label(part.text)}</p>]
                : [])}
              {task.error && <Alert type="error" message={task.error} />}
              {task.needsReconciliation && session.canStop(task) && <Button onClick={() => void session.reconcile(task)}>{t("Verify saved design")}</Button>}
              {(task.status === "failed" || task.status === "stopped") && !task.needsReconciliation && session.canStop(task) && <Button disabled={session.running} onClick={() => void session.retry(task)}>{t("Retry in current editor")}</Button>}
              {!!task.operations.length && (
                <details
                  className={styles.details}
                  data-test-id="local-ai-operations"
                >
                  <summary>{t("Execution progress")}</summary>
                  <ol>
                    {task.operations.map((operation) => (
                      <li key={operation.id}>
                        {operation.name} ·{" "}
                        {label(
                          operation.status === "completed"
                            ? "Completed"
                            : operation.status === "failed"
                              ? "Failed"
                              : "Running",
                        )}
                        {operation.error && <div>{operation.error}</div>}
                      </li>
                    ))}
                  </ol>
                </details>
              )}
              {task.records.map((record) => (
                <details
                  className={styles.details}
                  key={record.id}
                  data-test-id="local-ai-change"
                  data-ai-undone={!!record.undone}
                >
                  <summary>
                    {t("Changes")}: {record.name}
                    {record.undone ? ` · ${t("Undone")}` : ""}
                  </summary>
                  <Scrollbar scrollX={false} className={styles.detailScroll}>
                    <pre>{JSON.stringify(record.input, null, 2)}</pre>
                  </Scrollbar>
                  <details>
                    <summary>{t("Before")}</summary>
                    <Scrollbar scrollX={false} className={styles.detailScroll}>
                      <pre>{record.before}</pre>
                    </Scrollbar>
                  </details>
                  <details>
                    <summary>{t("After")}</summary>
                    <Scrollbar scrollX={false} className={styles.detailScroll}>
                      <pre>{record.after}</pre>
                    </Scrollbar>
                  </details>
                  {record === lastRecord &&
                    !record.undone &&
                    !session.running && session.canUndo(record) && (
                      <Button
                        size="small"
                        onClick={() => void session.undo(task, record)}
                      >
                        {t("Undo")}
                      </Button>
                    )}
                </details>
              ))}
              {task.savedRevision !== undefined && (
                <p>
                  {t("Saved revision {revision}.", {
                    revision: task.savedRevision,
                  })}
                </p>
              )}
              {task.status === "completed" && (
                <p>
                  {t(
                    "Model structure checked. Visual layout and interactions were not tested.",
                  )}
                </p>
              )}
              {(task.status === "stopped" || task.status === "failed") &&
                task.records.length > 0 && (
                  <p>
                    {t(
                      "Completed changes are retained and may have been saved automatically.",
                    )}
                  </p>
                )}
            </article>
          ))}
        </div>
      </Scrollbar>
      <div className={styles.composer}>
        <AiComposer
          value={draft}
          onChange={setDraft}
          onSubmit={send}
          attachmentState={attachmentState}
          scope={
            context?.scope ??
            (session.running && lastTask?.scopeLabel
              ? lastTask.scopeLabel
              : t("Current page"))
          }
          models={status?.models}
          model={model ?? status?.model}
          onModelChange={(value) => {
            session.selectedModel = value;
          }}
          disabled={!enabled || readOnly}
          canSubmit={!!status?.configured}
          running={session.running}
          onStop={() => session.stop()}
          stopDisabled={
            lastTask?.status !== "running" || !session.canStop(lastTask) || lastTask.phase === "Stopping"
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
