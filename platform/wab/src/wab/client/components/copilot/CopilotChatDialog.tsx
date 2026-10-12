import { useAppCtx } from "@/wab/client/contexts/AppContexts";
import {
  getLocalEditSession,
  localAiFetch,
} from "@/wab/client/copilot/local-edit-session";
import { useI18n } from "@/wab/client/i18n";
import { ApiProject, CopilotChatOpenOpts } from "@/wab/shared/ApiSchema";
import { Alert, Button, Input, Radio, Space, Tag } from "antd";
import { createStyles } from "antd-style";
import * as React from "react";

export interface CopilotChatDialogProps {
  project: ApiProject;
  chatOpenOpts?: CopilotChatOpenOpts;
  onClose: () => void;
  hiddenByModal: boolean;
}

const useStyles = createStyles(({ token }) => ({
  panel: {
    position: "fixed",
    top: 76,
    right: 20,
    bottom: 24,
    width: 420,
    maxWidth: "calc(100vw - 32px)",
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
  header: {
    padding: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: `1px solid ${token.colorBorderSecondary}`,
  },
  history: { flex: 1, overflow: "auto", padding: 16, minHeight: 0 },
  task: {
    paddingBottom: 16,
    marginBottom: 16,
    borderBottom: `1px solid ${token.colorBorderSecondary}`,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
  },
  composer: {
    padding: 16,
    borderTop: `1px solid ${token.colorBorderSecondary}`,
  },
  details: {
    marginTop: 8,
    "& pre": {
      maxHeight: 240,
      overflow: "auto",
      fontSize: 11,
      whiteSpace: "pre-wrap",
    },
  },
}));

export function CopilotChatDialog({
  project,
  chatOpenOpts,
  onClose,
  hiddenByModal,
}: CopilotChatDialogProps) {
  const { t, label } = useI18n();
  const { styles } = useStyles();
  const appCtx = useAppCtx();
  const enabled = appCtx.appConfig.enableLocalAiEditing;
  const session = React.useMemo(
    () => getLocalEditSession(project.id),
    [project.id],
  );
  const tasks = React.useSyncExternalStore(session.subscribe, session.snapshot);
  const [mode, setMode] = React.useState<"local" | "page">("local");
  const [pageName, setPageName] = React.useState("");
  const [pagePath, setPagePath] = React.useState("");
  const [draft, setDraft] = React.useState("");
  const [status, setStatus] = React.useState<{
    configured: boolean;
    model: string | null;
    pageGenerationEnabled?: boolean;
  }>();
  const [error, setError] = React.useState<string>();
  const consumed = React.useRef<CopilotChatOpenOpts>();
  const draftBinding = React.useRef(chatOpenOpts?.localEditBinding);
  React.useEffect(() => {
    const controller = new AbortController();
    if (enabled) {
      void localAiFetch<{
        configured: boolean;
        model: string | null;
        pageGenerationEnabled?: boolean;
      }>(project.id, "status", undefined, controller.signal)
        .then(setStatus)
        .catch((reason) => {
          if (!controller.signal.aborted) {
            setError(reason.message);
          }
        });
    }
    return () => {
      controller.abort();
      session.stop();
    };
  }, [project.id, enabled, session]);
  React.useEffect(() => {
    if (chatOpenOpts?.prompt && consumed.current !== chatOpenOpts) {
      setMode("local");
      setDraft(chatOpenOpts.prompt);
      draftBinding.current = chatOpenOpts.localEditBinding;
      if (status?.configured && !session.running) {
        consumed.current = chatOpenOpts;
        setDraft("");
        void session.run(chatOpenOpts.prompt, chatOpenOpts.localEditBinding);
        draftBinding.current = undefined;
      }
    }
  }, [chatOpenOpts, status, session]);
  const lastTask = tasks.at(-1);
  const lastRecord = tasks.flatMap((task) => task.records).at(-1);
  const pageEnabled =
    appCtx.appConfig.enableLocalAiPageGeneration &&
    status?.pageGenerationEnabled;
  const validPage =
    pageEnabled &&
    /^[A-Z][A-Za-z0-9]*$/.test(pageName.trim()) &&
    /^\/[A-Za-z0-9/_-]*$/.test(pagePath.trim());
  const send = () => {
    if (draft.trim() && !session.running && status?.configured) {
      consumed.current = chatOpenOpts;
      if (mode === "page") {
        if (!validPage) {
          return;
        }
        void session.run(draft, undefined, {
          name: pageName.trim(),
          path: pagePath.trim(),
        });
      } else {
        void session.run(draft, draftBinding.current);
      }
      draftBinding.current = undefined;
      setDraft("");
    }
  };
  return (
    <section
      className={styles.panel}
      aria-label={t("AI assistant")}
      style={hiddenByModal ? { visibility: "hidden" } : undefined}
      data-test-id="local-ai-panel"
      data-ai-busy={session.running}
    >
      <div className={styles.header}>
        <strong>{t("AI assistant")}</strong>
        <Button
          onClick={() => {
            session.stop();
            onClose();
          }}
        >
          {t("Close")}
        </Button>
      </div>
      <div className={styles.history} aria-live="polite">
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
        {error && <Alert type="error" message={error} />}
        {!tasks.length && (
          <p>
            {t(
              "Describe a change to the current selection or page. The editing scope stays fixed during the task.",
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
              <p key={index}>{message}</p>
            ))}
            {task.error && <Alert type="error" message={task.error} />}
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
                <pre>{JSON.stringify(record.input, null, 2)}</pre>
                <details>
                  <summary>{t("Before")}</summary>
                  <pre>{record.before}</pre>
                </details>
                <details>
                  <summary>{t("After")}</summary>
                  <pre>{record.after}</pre>
                </details>
                {record === lastRecord &&
                  !record.undone &&
                  !session.running && (
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
      <div className={styles.composer}>
        {pageEnabled && (
          <Radio.Group
            value={mode}
            onChange={(event) => setMode(event.target.value)}
            disabled={session.running}
            style={{ marginBottom: 12 }}
          >
            <Radio.Button value="local">{t("Edit current scope")}</Radio.Button>
            <Radio.Button value="page" data-test-id="local-ai-page-mode">
              {t("Generate new page")}
            </Radio.Button>
          </Radio.Group>
        )}
        {mode === "page" && (
          <Space
            direction="vertical"
            style={{ width: "100%", marginBottom: 12 }}
          >
            <Input
              data-test-id="local-ai-page-name"
              aria-label={t("New page name")}
              placeholder="RecordsPage"
              value={pageName}
              onChange={(event) => setPageName(event.target.value)}
              disabled={session.running}
            />
            <Input
              data-test-id="local-ai-page-path"
              aria-label={t("New page route")}
              placeholder="/records"
              value={pagePath}
              onChange={(event) => setPagePath(event.target.value)}
              disabled={session.running}
            />
            <small>
              {t("Use a PascalCase page name and a route starting with /.")}
            </small>
          </Space>
        )}
        <Input.TextArea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t("Describe what you want to change…")}
          aria-label={t("Describe what you want to change…")}
          autoSize={{ minRows: 2, maxRows: 5 }}
          data-test-id="local-ai-prompt"
        />
        <Space style={{ marginTop: 12 }}>
          {session.running ? (
            <Button
              onClick={() => session.stop()}
              disabled={
                lastTask?.status !== "running" || lastTask.phase === "Stopping"
              }
            >
              {t("Stop AI task")}
            </Button>
          ) : (
            <Button
              type="primary"
              disabled={
                !draft.trim() ||
                !status?.configured ||
                !enabled ||
                (mode === "page" && !validPage)
              }
              onClick={send}
            >
              {t("Send AI request")}
            </Button>
          )}
          {status?.model && <span>{status.model}</span>}
        </Space>
      </div>
    </section>
  );
}
