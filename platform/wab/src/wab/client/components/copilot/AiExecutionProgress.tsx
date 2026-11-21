import styles from "./AiExecutionProgress.module.less";
import { AiMarkdown } from "@/wab/client/components/copilot/AiMarkdown";
import { AiNodeReference } from "@/wab/client/components/copilot/AiNodeReference";
import type { AiSessionView } from "@/wab/client/copilot/ai-session-view";
import { useI18n } from "@/wab/client/i18n";
import type {
  AiMessagePart,
  AiTask,
  EditRecord,
} from "@/wab/shared/copilot/ai-chat";
import { PROTOTYPE_TOOL_META } from "@/wab/shared/copilot/prototype-tools";
import {
  BulbOutlined,
  CheckOutlined,
  CloseOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  LoadingOutlined,
  MessageOutlined,
  PauseCircleOutlined,
  ReloadOutlined,
  RightOutlined,
  ToolOutlined,
} from "@ant-design/icons";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import { Button, Tooltip } from "antd";
import React from "react";

function ThoughtSummary({
  children,
  thinking,
}: {
  children: React.ReactNode;
  thinking: boolean;
}) {
  const { t } = useI18n();

  const [expanded, setExpanded] = React.useState(false);
  const bodyId = React.useId();
  return (
    <div data-test-id="ai-reasoning-details">
      <button
        type="button"
        className={`${styles.heading} ${styles.reasoningToggle}`}
        aria-expanded={expanded}
        aria-controls={bodyId}
        onClick={() => setExpanded((value) => !value)}
      >
        <span className={styles.title}>{t("Thought summary")}</span>
        {thinking && <span className={styles.status}>{t("Thinking")}</span>}
        <RightOutlined
          className={styles.caret}
          data-reasoning-caret=""
          aria-hidden
        />
      </button>
      <div
        id={bodyId}
        className={styles.reasoningBody}
        data-collapsed={!expanded}
      >
        {children}
      </div>
    </div>
  );
}

export function AiExecutionProgress({
  task,
  session,
  lastRecord,
  parts,
}: {
  task: AiTask;
  session: AiSessionView;
  lastRecord?: EditRecord;
  parts?: AiMessagePart[];
}) {
  const { t, label } = useI18n();

  const [open, setOpen] = React.useState(
    task.status === "running" || task.status === "failed",
  );
  const userToggled = React.useRef(false);
  React.useEffect(() => {
    if (!userToggled.current) {
      setOpen(task.status === "running" || task.status === "failed");
    }
  }, [task.status]);
  const operations = parts
    ? task.operations.filter((operation) =>
        parts.some(
          (part) => part.type === "tool" && part.operationId === operation.id,
        ),
      )
    : task.operations;
  const records = parts
    ? task.records.filter((record) =>
        parts.some(
          (part) =>
            (part.type === "tool" || part.type === "change") &&
            part.operationId === record.id,
        ),
      )
    : task.records;
  type Step = {
    id: string;
    operation: AiTask["operations"][number] | undefined;
    record: EditRecord | undefined;
    text: string | undefined;
    reasoning?: boolean;
    complete?: boolean;
  };
  const steps: Step[] = parts
    ? parts.flatMap<Step>((part, index) => {
        if (part.type === "markdown" || part.type === "reasoning") {
          return [
            {
              id: `text-${index}`,
              operation: undefined,
              record: undefined,
              text: part.text,
              reasoning: part.type === "reasoning",
              complete: part.complete,
            },
          ];
        }
        if (part.type !== "tool" && part.type !== "change") {
          return [];
        }
        if (
          part.type === "change" &&
          parts.some(
            (other) =>
              other.type === "tool" && other.operationId === part.operationId,
          )
        ) {
          return [];
        }
        return [
          {
            id: part.operationId,
            operation: operations.find(
              (operation) => operation.id === part.operationId,
            ),
            record: records.find((record) => record.id === part.operationId),
            text: undefined,
          },
        ];
      })
    : [
        ...operations.map((operation) => ({
          id: operation.id,
          operation,
          record: records.find((record) => record.id === operation.id),
          text: undefined,
        })),
        ...records
          .filter(
            (record) =>
              !operations.some((operation) => operation.id === record.id),
          )
          .map((record) => ({
            id: record.id,
            operation: undefined,
            record,
            text: undefined,
          })),
      ];
  const recovered = operations.filter(
    (operation) => operation.status === "failed" && operation.recoveredBy,
  ).length;
  const rejected = operations.filter(
    (operation) => operation.status === "failed" && !operation.recoveredBy,
  ).length;
  const statusLabel =
    task.status === "running"
      ? label(task.phase)
      : task.status === "completed"
        ? t("Completed")
        : task.status === "stopped"
          ? t("Stopped")
          : t("Incomplete");
  const count = operations.length || records.length;
  const countLabel = operations.length
    ? t("{count} tool calls", { count })
    : t("{count} changes", { count });
  const nodes = [
    ...(task.nodes ?? []),
    ...task.parts.filter((part) => part.type === "node"),
  ];
  return (
    <details
      className={styles.root}
      open={open}
      data-test-id="local-ai-operations"
    >
      <summary
        onClick={(event) => {
          event.preventDefault();
          userToggled.current = true;
          setOpen((value) => !value);
        }}
      >
        <Tooltip title={statusLabel}>
          <span
            className={styles.summaryIcon}
            data-status={task.status}
            data-test-id="ai-process-state"
            role="img"
            aria-label={statusLabel}
          >
            {task.status === "running" ? (
              <LoadingOutlined spin aria-hidden />
            ) : task.status === "failed" ? (
              <ExclamationCircleOutlined aria-hidden />
            ) : task.status === "stopped" ? (
              <PauseCircleOutlined aria-hidden />
            ) : (
              <RightOutlined
                className={styles.caret}
                data-progress-caret=""
                aria-hidden
              />
            )}
          </span>
        </Tooltip>
        <span>{t("Processing")}</span>
        {count > 0 && (
          <Tooltip title={countLabel}>
            <span
              className={styles.count}
              aria-label={countLabel}
              data-test-id="ai-process-count"
            >
              {operations.length ? (
                <ToolOutlined aria-hidden />
              ) : (
                <EditOutlined aria-hidden />
              )}
              <span>{count}</span>
            </span>
          </Tooltip>
        )}
      </summary>
      {(recovered > 0 || rejected > 0) && (
        <p className={styles.notice}>
          {recovered > 0 && (
            <span>{t("{count} recovered retries", { count: recovered })}</span>
          )}
          {rejected > 0 && (
            <span>{t("{count} rejected calls", { count: rejected })}</span>
          )}
        </p>
      )}
      <ol className={styles.steps}>
        {steps.map(
          ({ id, operation, record, text, reasoning, complete }, index) => {
            if (text !== undefined) {
              const markdown = (
                <AiMarkdown
                  compact
                  running={task.status === "running" && complete !== true}
                  nodes={nodes}
                  onLocate={(node) => void session.locate(task, node)}
                >
                  {text}
                </AiMarkdown>
              );
              return (
                <li
                  key={id}
                  className={styles.step}
                  data-test-id={
                    reasoning ? "ai-reasoning" : "ai-process-message"
                  }
                >
                  <span className={styles.indicator} aria-hidden="true">
                    {reasoning ? <BulbOutlined /> : <MessageOutlined />}
                  </span>
                  <div className={styles.content}>
                    {reasoning ? (
                      <ThoughtSummary
                        thinking={task.status === "running" && !complete}
                      >
                        {markdown}
                      </ThoughtSummary>
                    ) : (
                      markdown
                    )}
                  </div>
                </li>
              );
            }
            const name = operation?.name ?? record?.name;
            const metadata = Object.entries(PROTOTYPE_TOOL_META).find(
              ([key]) => key === name,
            )?.[1];
            const status = operation?.recoveredBy
              ? "recovered"
              : operation?.status;
            const errorSummary =
              operation?.errorSummary ??
              (operation?.error ? t("Tool call was rejected.") : undefined);
            const nodeUuid = record?.input.elementUuid;
            const node =
              typeof nodeUuid === "string"
                ? (task.nodes?.find((item) => item.uuid === nodeUuid) ?? {
                    uuid: nodeUuid,
                    name: nodeUuid,
                    page: record?.binding.componentUuid ?? null,
                    branch: record?.binding.branchId ?? null,
                  })
                : undefined;
            return (
              <li
                key={id}
                className={styles.step}
                data-test-id="ai-execution-step"
                data-operation-id={id}
                data-operation-status={status}
              >
                <span
                  className={styles.indicator}
                  data-status={status}
                  aria-hidden="true"
                >
                  {status === "running" ? (
                    <LoadingOutlined spin />
                  ) : status === "failed" ? (
                    <CloseOutlined />
                  ) : status === "recovered" ? (
                    <ReloadOutlined />
                  ) : status === "completed" ? (
                    <CheckOutlined />
                  ) : (
                    <RightOutlined />
                  )}
                </span>
                <div className={styles.content}>
                  <details
                    className={styles.tool}
                    data-test-id="ai-operation-details"
                  >
                    <summary>
                      <div className={styles.heading}>
                        <span className={styles.title}>
                          {operation?.title
                            ? label(operation.title)
                            : metadata
                              ? label(metadata.title)
                              : name}
                        </span>
                        {(status === "running" ||
                          status === "failed" ||
                          status === "recovered") && (
                          <span className={styles.status} data-status={status}>
                            {status === "running"
                              ? t("Running")
                              : status === "recovered"
                                ? t("Recovered")
                                : t("Failed")}
                          </span>
                        )}
                        <RightOutlined
                          className={styles.caret}
                          data-tool-caret=""
                        />
                      </div>
                      {operation?.target && (
                        <div className={styles.target} title={operation.target}>
                          {operation.target}
                        </div>
                      )}
                      {errorSummary && (
                        <p className={styles.errorSummary} data-status={status}>
                          {label(errorSummary)}
                        </p>
                      )}
                    </summary>
                    <div className={styles.metadata}>
                      <span>
                        {t("Step {number}", {
                          number: operation
                            ? task.operations.indexOf(operation) + 1
                            : index + 1,
                        })}
                      </span>
                      <code>{name}</code>
                      {status === "completed" && <span>{t("Completed")}</span>}
                      {record?.undone && <span>{t("Undone")}</span>}
                      {operation?.retryOf && (
                        <span>
                          {t("Retries step {number}", {
                            number:
                              task.operations.findIndex(
                                (item) => item.id === operation.retryOf,
                              ) + 1,
                          })}
                        </span>
                      )}
                    </div>
                    {node && (
                      <AiNodeReference
                        node={node}
                        onLocate={(reference) =>
                          void session.locate(task, reference)
                        }
                      />
                    )}
                    {operation?.error && (
                      <Scrollbar
                        scrollX={false}
                        defer={false}
                        className={styles.detailScroll}
                      >
                        <pre className={styles.error}>{operation.error}</pre>
                      </Scrollbar>
                    )}
                  </details>
                  {record && (
                    <details
                      className={styles.change}
                      data-test-id="local-ai-change"
                      data-ai-undone={!!record.undone}
                    >
                      <summary>{t("Changes")}</summary>
                      <Scrollbar
                        scrollX={false}
                        defer={false}
                        className={styles.detailScroll}
                      >
                        <pre>{JSON.stringify(record.input, null, 2)}</pre>
                      </Scrollbar>
                      <details>
                        <summary>{t("Before")}</summary>
                        <Scrollbar
                          scrollX={false}
                          defer={false}
                          className={styles.detailScroll}
                        >
                          <pre>{record.before}</pre>
                        </Scrollbar>
                      </details>
                      <details>
                        <summary>{t("After")}</summary>
                        <Scrollbar
                          scrollX={false}
                          defer={false}
                          className={styles.detailScroll}
                        >
                          <pre>{record.after}</pre>
                        </Scrollbar>
                      </details>
                      {record === lastRecord &&
                        !record.undone &&
                        !session.running &&
                        session.canUndo(record) && (
                          <Button
                            size="small"
                            onClick={() => void session.undo(task, record)}
                          >
                            {t("Undo")}
                          </Button>
                        )}
                    </details>
                  )}
                </div>
              </li>
            );
          },
        )}
      </ol>
    </details>
  );
}
