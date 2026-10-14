import { AiMarkdown } from "@/wab/client/components/copilot/AiMarkdown";
import { AiNodeReference } from "@/wab/client/components/copilot/AiNodeReference";
import type { LocalEditSession } from "@/wab/client/copilot/local-edit-session";
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
import { createStyles } from "antd-style";
import React from "react";

const useStyles = createStyles(({ token }) => ({
  root: {
    minWidth: 0,
    "& > summary": {
      display: "flex",
      alignItems: "center",
      gap: 9,
      padding: "2px 0",
      cursor: "pointer",
      listStyle: "none",
      fontSize: 12,
      fontWeight: 400,
      color: token.colorTextSecondary,
      lineHeight: "20px",
    },
    "& summary::-webkit-details-marker": { display: "none" },
    "& > summary:focus-visible": {
      outline: `2px solid ${token.colorPrimary}`,
      outlineOffset: -2,
      borderRadius: token.borderRadiusSM,
    },
    "&[open] > summary [data-progress-caret]": { transform: "rotate(90deg)" },
  },
  caret: {
    fontSize: 10,
    color: token.colorTextSecondary,
    transition: "transform 150ms",
    flexShrink: 0,
  },
  count: {
    marginLeft: "auto",
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    fontSize: 11,
    fontVariantNumeric: "tabular-nums",
    whiteSpace: "nowrap",
    color: token.colorTextTertiary,
  },
  summaryIcon: {
    width: 16,
    height: 20,
    fontSize: 12,
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: token.colorTextTertiary,
    "& [data-progress-caret]": { fontSize: "inherit" },
    "&[data-status=running]": { color: token.colorPrimaryText },
    "&[data-status=failed]": { color: token.colorErrorText },
  },
  notice: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    padding: "0 0 0 25px",
    margin: "0 0 8px",
    color: token.colorTextTertiary,
    fontSize: 11,
  },
  steps: { listStyle: "none", padding: "8px 0 4px", margin: 0 },
  step: {
    position: "relative",
    display: "grid",
    gridTemplateColumns: "16px minmax(0, 1fr)",
    gap: 9,
    paddingBottom: 12,
    "&:last-child": { paddingBottom: 0 },
    "&:not(:last-child)::before": {
      content: "''",
      position: "absolute",
      left: 7.5,
      top: 21,
      bottom: 2,
      borderLeft: `1px solid ${token.colorBorderSecondary}`,
    },
  },
  indicator: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "start",
    width: 16,
    height: 20,
    fontSize: 12,
    lineHeight: "20px",
    color: token.colorTextTertiary,
    "&[data-status=running]": { color: token.colorPrimaryText },
    "&[data-status=failed]": { color: token.colorErrorText },
  },
  content: { minWidth: 0 },
  heading: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    minWidth: 0,
    minHeight: 20,
  },
  title: {
    fontSize: 12,
    fontWeight: 400,
    lineHeight: "20px",
    color: token.colorTextSecondary,
    overflowWrap: "anywhere",
  },
  target: {
    fontSize: 11,
    lineHeight: "18px",
    color: token.colorTextTertiary,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    minWidth: 0,
  },
  status: {
    marginLeft: "auto",
    fontSize: 11,
    lineHeight: "20px",
    flexShrink: 0,
    color: token.colorTextTertiary,
    "&[data-status=running]": { color: token.colorPrimaryText },
    "&[data-status=failed]": { color: token.colorErrorText },
  },
  tool: {
    "& > summary": { cursor: "pointer", listStyle: "none" },
    "& > summary::-webkit-details-marker": { display: "none" },
    "&[open] > summary [data-tool-caret]": { transform: "rotate(90deg)" },
    "& > summary:focus-visible": {
      outline: `2px solid ${token.colorPrimary}`,
      borderRadius: token.borderRadiusSM,
    },
  },
  metadata: {
    fontSize: 11,
    color: token.colorTextTertiary,
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    alignItems: "center",
    marginTop: 6,
    "& code": { fontFamily: token.fontFamilyCode, fontSize: 10 },
  },
  errorSummary: {
    fontSize: 11,
    lineHeight: 1.6,
    color: token.colorTextSecondary,
    margin: "3px 0 0",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    "&[data-status=failed]": { color: token.colorErrorText },
  },
  error: {
    margin: "6px 0 0",
    padding: "6px 8px",
    borderRadius: token.borderRadiusSM,
    background: token.colorFillQuaternary,
    color: token.colorTextSecondary,
    fontSize: 11,
    lineHeight: 1.6,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
  },
  change: {
    fontSize: 11,
    color: token.colorTextSecondary,
    "& summary": { cursor: "pointer", lineHeight: "22px" },
    "& details": { marginTop: 6 },
    "& pre": {
      margin: "6px 0",
      fontFamily: token.fontFamilyCode,
      fontSize: 11,
      lineHeight: 1.6,
      whiteSpace: "pre-wrap",
      overflowWrap: "anywhere",
    },
    "& button": { marginTop: 6 },
  },
  detailScroll: { maxHeight: 200 },
  reasoningToggle: {
    width: "100%",
    padding: 0,
    border: 0,
    background: "transparent",
    textAlign: "left",
    font: "inherit",
    cursor: "pointer",
    "&[aria-expanded=true] [data-reasoning-caret]": {
      transform: "rotate(90deg)",
    },
    "&:focus-visible": {
      outline: `2px solid ${token.colorPrimary}`,
      borderRadius: token.borderRadiusSM,
    },
  },
  reasoningBody: {
    margin: "3px 0 0",
    display: "flow-root",
    "&[data-collapsed=true]": { maxHeight: "35.2px", overflow: "hidden" },
  },
}));

function ThoughtSummary({
  children,
  thinking,
}: {
  children: React.ReactNode;
  thinking: boolean;
}) {
  const { t } = useI18n();
  const { styles } = useStyles();
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
  session: LocalEditSession;
  lastRecord?: EditRecord;
  parts?: AiMessagePart[];
}) {
  const { t, label } = useI18n();
  const { styles } = useStyles();
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
