import {
  ErrorDescription,
  getErrorType,
} from "@/wab/client/api-error-presentation";
import { useAiAttachments } from "@/wab/client/components/copilot/AiAttachments";
import { AiComposer } from "@/wab/client/components/copilot/AiComposer";
import { AiNodeReference } from "@/wab/client/components/copilot/AiNodeReference";
import { AiResponse } from "@/wab/client/components/copilot/AiResponse";
import { PanelCloseButton } from "@/wab/client/components/studio/PanelCloseButton";
import {
  editorLeftRailLayout,
  editorPanelHeaderStyle,
} from "@/wab/client/components/ui/layout-styles";
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
    left:
      editorLeftRailLayout.left +
      editorLeftRailLayout.width +
      editorLeftRailLayout.panelGap,
    height: "calc(100dvh - 170px)",
    maxWidth: `calc(100vw - ${editorLeftRailLayout.left + editorLeftRailLayout.width + editorLeftRailLayout.panelGap + 12}px)`,
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
    fontSize: 13,
    fontWeight: 400,
    lineHeight: 1.6,
  },
  header: editorPanelHeaderStyle(token),
  history: { flex: 1, minHeight: 0 },
  historyContent: {
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 24,
  },
  empty: {
    margin: 0,
    padding: "8px 0",
    color: token.colorTextSecondary,
    fontSize: 13,
    fontWeight: 400,
  },
  request: {
    padding: "10px 12px",
    borderRadius: token.borderRadiusLG,
    background: token.colorFillSecondary,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    "& p": { margin: 0, fontWeight: 400 },
  },
  metadata: {
    display: "flex",
    flexWrap: "wrap",
    gap: "4px 8px",
    marginTop: 6,
    color: token.colorTextTertiary,
    fontSize: 11,
  },
  response: { display: "flex", flexDirection: "column", gap: 12, minWidth: 0 },
  status: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    color: token.colorTextSecondary,
    fontSize: 11,
  },
  note: {
    margin: 0,
    fontSize: 11,
    lineHeight: 1.6,
    color: token.colorTextSecondary,
  },
  files: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    fontSize: 12,
  },
  task: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    minWidth: 0,
    paddingBottom: 24,
    borderBottom: `1px solid ${token.colorBorderSecondary}`,
    "&:last-child": { paddingBottom: 0, borderBottom: 0 },
  },
  composer: {
    padding: 12,
    flexShrink: 0,
    borderTop: `1px solid ${token.colorBorderSecondary}`,
  },
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
  const historyRef = React.useRef<HTMLElement>(null);
  const followLatest = React.useRef(true);
  const previousLastTask = React.useRef(tasks.at(-1)?.id);
  React.useLayoutEffect(() => {
    if (tasks.at(-1)?.id !== previousLastTask.current) {
      followLatest.current = true;
    }
    previousLastTask.current = tasks.at(-1)?.id;
    const viewport = historyRef.current;
    if (viewport && followLatest.current) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [tasks]);
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
      enabled &&
      !readOnly &&
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
      <Scrollbar
        ref={historyRef}
        scrollX={false}
        defer={false}
        className={styles.history}
        events={{
          scroll: (instance) => {
            const viewport = instance.elements().viewport;
            followLatest.current =
              viewport.scrollHeight -
                viewport.scrollTop -
                viewport.clientHeight <
              48;
          },
          initialized: (instance) => {
            const viewport = instance.elements().viewport;
            viewport.scrollTop = viewport.scrollHeight;
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
          {error && (
            <Alert
              type={getErrorType(error)}
              message={<ErrorDescription error={error} />}
            />
          )}
          {session.error && (
            <Alert
              type={getErrorType(session.error)}
              message={<ErrorDescription error={session.error} />}
            />
          )}
          {session.before && (
            <Button onClick={() => void session.loadEarlier()}>
              {t("Load earlier messages")}
            </Button>
          )}
          {!tasks.length && (
            <p className={styles.empty}>
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
                  const url = `/api/v1/projects/${encodeURIComponent(project.id)}/ai/chat/attachments/${file.id}`;
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
                      <a href={url} download={file.name}>
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
                      {t("Pinned scope")}:{" "}
                      {task.scopeLabel ??
                        (task.binding.elementUuids.length
                          ? t("Current selection")
                          : t("Current page"))}
                    </span>
                  )}
                </div>
                <AiResponse
                  task={task}
                  session={session}
                  lastRecord={lastRecord}
                />
                {task.error && <Alert type="error" message={task.error} />}
                {task.needsReconciliation && session.canStop(task) && (
                  <Button onClick={() => void session.reconcile(task)}>
                    {t("Verify saved design")}
                  </Button>
                )}
                {(task.status === "failed" || task.status === "stopped") &&
                  !task.needsReconciliation &&
                  session.canStop(task) && (
                    <Button
                      disabled={session.running}
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
                {task.status === "completed" && (
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
            lastTask?.status !== "running" ||
            !session.canStop(lastTask) ||
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
