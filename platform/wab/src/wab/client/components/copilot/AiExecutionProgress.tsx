import { AiNodeReference } from "@/wab/client/components/copilot/AiNodeReference";
import type { LocalEditSession } from "@/wab/client/copilot/local-edit-session";
import { useI18n } from "@/wab/client/i18n";
import type { AiTask, EditRecord } from "@/wab/shared/copilot/ai-chat";
import { PROTOTYPE_TOOL_META } from "@/wab/shared/copilot/prototype-tools";
import {
  CheckCircleFilled,
  CloseCircleFilled,
  LoadingOutlined,
  RightOutlined,
} from "@ant-design/icons";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import { Button } from "antd";
import { createStyles } from "antd-style";
import React from "react";

const useStyles = createStyles(({ token }) => ({
  root: {
    minWidth: 0,
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: token.borderRadiusLG,
    background: token.colorFillQuaternary,
    "& > summary": {
      display: "flex",
      alignItems: "center",
      gap: 7,
      padding: "10px 12px",
      cursor: "pointer",
      listStyle: "none",
      fontSize: 12,
      color: token.colorTextSecondary,
    },
    "& > summary::-webkit-details-marker": { display: "none" },
    "& > summary:focus-visible": {
      outline: `2px solid ${token.colorPrimary}`,
      outlineOffset: -2,
      borderRadius: token.borderRadiusLG,
    },
    "&[open] > summary [data-progress-caret]": { transform: "rotate(90deg)" },
  },
  caret: { fontSize: 10, transition: "transform 150ms" },
  count: {
    marginLeft: "auto",
    fontSize: 11,
    fontVariantNumeric: "tabular-nums",
    whiteSpace: "nowrap",
  },
  failed: { color: token.colorErrorText, fontSize: 11 },
  viewport: { maxHeight: 360, minHeight: 0 },
  steps: { listStyle: "none", padding: "2px 12px 12px", margin: 0 },
  step: {
    position: "relative",
    display: "grid",
    gridTemplateColumns: "16px minmax(0, 1fr)",
    gap: 9,
    paddingBottom: 16,
    "&:last-child": { paddingBottom: 0 },
    "&:not(:last-child)::before": {
      content: '""',
      position: "absolute",
      left: 7,
      top: 22,
      bottom: 4,
      borderLeft: `1px solid ${token.colorBorderSecondary}`,
    },
  },
  indicator: {
    position: "relative",
    zIndex: 1,
    fontSize: 14,
    lineHeight: "20px",
    color: token.colorTextTertiary,
    "&[data-status=completed]": { color: token.colorSuccessText },
    "&[data-status=running]": { color: token.colorPrimaryText },
    "&[data-status=failed]": { color: token.colorErrorText },
  },
  content: { minWidth: 0, display: "flex", flexDirection: "column", gap: 5 },
  heading: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
  },
  title: {
    fontSize: 12,
    fontWeight: 500,
    lineHeight: "20px",
    color: token.colorText,
    overflowWrap: "anywhere",
  },
  status: {
    fontSize: 11,
    lineHeight: "20px",
    flexShrink: 0,
    color: token.colorTextTertiary,
    "&[data-status=running]": { color: token.colorPrimaryText },
    "&[data-status=failed]": { color: token.colorErrorText },
  },
  metadata: {
    fontSize: 11,
    color: token.colorTextTertiary,
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    alignItems: "center",
    "& code": { fontFamily: token.fontFamilyCode, fontSize: 10 },
  },
  error: {
    margin: "2px 0 0",
    padding: "6px 8px",
    borderRadius: token.borderRadiusSM,
    background: token.colorErrorBg,
    color: token.colorErrorText,
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
}));

export function AiExecutionProgress({
  task,
  session,
  lastRecord,
}: {
  task: AiTask;
  session: LocalEditSession;
  lastRecord?: EditRecord;
}) {
  const { t, label } = useI18n();
  const { styles } = useStyles();
  const [open, setOpen] = React.useState(task.status === "running");
  const completed = task.operations.filter(
    (operation) => operation.status === "completed",
  ).length;
  const failed = task.operations.filter(
    (operation) => operation.status === "failed",
  ).length;
  const steps = [
    ...task.operations.map((operation) => ({
      id: operation.id,
      operation,
      record: task.records.find((record) => record.id === operation.id),
    })),
    ...task.records
      .filter(
        (record) =>
          !task.operations.some((operation) => operation.id === record.id),
      )
      .map((record) => ({ id: record.id, operation: undefined, record })),
  ];
  return (
    <details
      className={styles.root}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      data-test-id="local-ai-operations"
    >
      <summary>
        <RightOutlined className={styles.caret} data-progress-caret="" />
        <span>{t("Execution progress")}</span>
        {failed > 0 && (
          <span className={styles.failed}>
            {t("{count} failed", { count: failed })}
          </span>
        )}
        <span
          className={styles.count}
          aria-label={
            task.operations.length
              ? t("{completed} of {total} steps completed", {
                  completed,
                  total: task.operations.length,
                })
              : t("{count} changes", { count: task.records.length })
          }
        >
          {task.operations.length
            ? `${completed}/${task.operations.length}`
            : t("{count} changes", { count: task.records.length })}
        </span>
      </summary>
      <Scrollbar scrollX={false} defer={false} className={styles.viewport}>
        <ol className={styles.steps}>
          {steps.map(({ id, operation, record }, index) => {
            const name = operation?.name ?? record?.name;
            const metadata = Object.entries(PROTOTYPE_TOOL_META).find(
              ([key]) => key === name,
            )?.[1];
            const status = operation?.status;
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
                    <CloseCircleFilled />
                  ) : status === "completed" ? (
                    <CheckCircleFilled />
                  ) : (
                    <RightOutlined />
                  )}
                </span>
                <div className={styles.content}>
                  <div className={styles.heading}>
                    <span className={styles.title}>
                      {metadata ? label(metadata.title) : name}
                    </span>
                    <span className={styles.status} data-status={status}>
                      {status === "running"
                        ? t("Running")
                        : status === "failed"
                          ? t("Failed")
                          : status === "completed"
                            ? t("Completed")
                            : t("Changes")}
                    </span>
                  </div>
                  <div className={styles.metadata}>
                    <span>{t("Step {number}", { number: index + 1 })}</span>
                    <code>{name}</code>
                    {record?.undone && <span>{t("Undone")}</span>}
                  </div>
                  {node && (
                    <div>
                      <AiNodeReference
                        node={node}
                        onLocate={(reference) =>
                          void session.locate(task, reference)
                        }
                      />
                    </div>
                  )}
                  {operation?.error && (
                    <p className={styles.error} role="alert">
                      {operation.error}
                    </p>
                  )}
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
          })}
        </ol>
      </Scrollbar>
    </details>
  );
}
