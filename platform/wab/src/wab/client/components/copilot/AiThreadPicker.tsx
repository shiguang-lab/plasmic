import { Modal } from "@/wab/client/components/widgets/Modal";
import { TriggerTarget } from "@/wab/client/components/widgets/TriggerAnchor";
import type { AiSessionView } from "@/wab/client/copilot/ai-session-view";
import { useI18n } from "@/wab/client/i18n";
import {
  DownOutlined,
  MessageOutlined,
  MoreOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import {
  Button,
  Dropdown,
  Empty,
  Input,
  Popover,
  Spin,
  Tag,
  Tooltip,
} from "antd";
import { createStyles } from "antd-style";
import * as React from "react";

const useStyles = createStyles(({ token }) => ({
  bar: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
    width: "100%",
    minHeight: 28,
    "& .ant-btn": { height: 24, paddingInline: 4, fontSize: 12 },
    "& > .ant-btn": { flexShrink: 0, color: token.colorTextSecondary },
    "& .ant-btn:not(:disabled):not(.ant-btn-disabled):hover": {
      background: "transparent",
    },
  },
  current: {
    display: "flex",
    alignItems: "center",
    flex: 1,
    minWidth: 0,
    "& > .ant-btn": { minWidth: 0, textAlign: "left" },
    "& .anticon-down": { fontSize: 10 },
    "& .ant-btn > span:not(.anticon)": {
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
  },
  title: {
    flex: "0 1 auto",
    minWidth: 0,
    maxWidth: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 6,
  },
  popup: {
    width: 320,
    maxWidth: "calc(100vw - 32px)",
    minWidth: 0,
    color: token.colorText,
    background: token.colorBgElevated,
  },
  filters: { display: "flex", alignItems: "center", gap: 4, margin: "8px 0" },
  list: { maxHeight: "min(340px, calc(100vh - 220px))", minHeight: 64 },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    borderRadius: token.borderRadius,
    "&[data-selected=true]": { background: token.colorFillSecondary },
  },
  entry: {
    flex: 1,
    minWidth: 0,
    textAlign: "left",
    border: 0,
    background: "transparent",
    color: "inherit",
    cursor: "pointer",
    borderRadius: token.borderRadius,
    padding: "9px 8px",
    font: "inherit",
    "&:hover": { background: token.colorFillTertiary },
  },
  line: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    minWidth: 0,
  },
  name: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    flex: 1,
  },
  secondary: {
    color: token.colorTextSecondary,
    fontSize: 11,
    marginTop: 3,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  date: { flexShrink: 0, color: token.colorTextTertiary, fontSize: 11 },
  more: { width: "100%", marginTop: 8 },
}));

/** The same picker controls the top-frame composer and the assistant panel. */
export function AiThreadPicker({
  session,
  readOnly = false,
  disabled = false,
  placement = "bottomLeft",
  onOpenChange,
}: {
  session: AiSessionView;
  readOnly?: boolean;
  disabled?: boolean;
  placement?: "bottomLeft" | "topRight";
  onOpenChange?: (open: boolean) => void;
}) {
  const { t, locale } = useI18n();
  const { styles } = useStyles();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [archived, setArchived] = React.useState(false);
  const [renaming, setRenaming] = React.useState<{
    id: string;
    title: string;
  }>();
  const [saving, setSaving] = React.useState(false);
  const title = session.activeThread?.title || t("New conversation");
  React.useEffect(() => {
    onOpenChange?.(open && !disabled);
    return () => onOpenChange?.(false);
  }, [open, disabled, onOpenChange]);
  React.useEffect(() => {
    if (!open || disabled) {
      return;
    }
    const timeout = setTimeout(
      () => void session.searchThreads(query, archived),
      query ? 200 : 0,
    );
    return () => clearTimeout(timeout);
  }, [open, query, archived, session, disabled]);
  const choose = (id: string) => {
    void session.selectThread(id);
    setOpen(false);
  };
  const trigger = (
    <Button
      type="text"
      size="small"
      icon={<MessageOutlined />}
      className={styles.title}
      aria-label={t("Switch conversation")}
      aria-expanded={open && !disabled}
      aria-haspopup="dialog"
      disabled={disabled}
    >
      <span>{title}</span>
      <DownOutlined />
    </Button>
  );
  return (
    <>
      <div className={styles.bar} data-test-id="ai-thread-picker">
        <div className={styles.current}>
          <Popover
            trigger="click"
            destroyOnHidden
            placement={placement}
            open={open && !disabled}
            onOpenChange={(value) => {
              setOpen(value && !disabled);
              if (value) {
                setQuery("");
                setArchived(false);
              }
            }}
            content={
              <section
                className={styles.popup}
                role="dialog"
                aria-label={t("Conversations")}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setOpen(false);
                  }
                }}
              >
                <Input
                  autoFocus
                  allowClear
                  value={query}
                  maxLength={200}
                  placeholder={t("Search conversations")}
                  aria-label={t("Search conversations")}
                  onChange={(event) => setQuery(event.target.value)}
                />
                <div className={styles.filters}>
                  <Button
                    size="small"
                    type={archived ? "text" : "default"}
                    aria-pressed={!archived}
                    onClick={() => setArchived(false)}
                  >
                    {t("Active conversations")}
                  </Button>
                  <Button
                    size="small"
                    type={archived ? "default" : "text"}
                    aria-pressed={archived}
                    onClick={() => setArchived(true)}
                  >
                    {t("Archived conversations")}
                  </Button>
                </div>
                <Spin spinning={session.threadListLoading} size="small">
                  <Scrollbar
                    className={styles.list}
                    scrollX={false}
                    defer={false}
                  >
                    {session.threads.map((thread) => {
                      const name =
                        thread.title ||
                        thread.draft?.slice(0, 60) ||
                        t("New conversation");
                      const running =
                        session.activeRun?.threadId === thread.id ||
                        thread.lastTask?.status === "running";
                      return (
                        <div
                          key={thread.id}
                          className={styles.row}
                          data-selected={thread.id === session.activeThreadId}
                        >
                          <button
                            type="button"
                            className={styles.entry}
                            aria-current={
                              thread.id === session.activeThreadId
                                ? "true"
                                : undefined
                            }
                            onClick={() => choose(thread.id)}
                          >
                            <span className={styles.line}>
                              <Tooltip title={name}>
                                <span className={styles.name}>{name}</span>
                              </Tooltip>
                              {running && (
                                <Tag color="processing">{t("Running")}</Tag>
                              )}
                              {thread.lastTask?.needsReconciliation && (
                                <Tag color="warning">
                                  {t("Verify saved design")}
                                </Tag>
                              )}
                              {thread.lastTask?.status === "failed" &&
                                !running && (
                                  <Tag color="error">{t("Failed")}</Tag>
                                )}
                              <time
                                className={styles.date}
                                dateTime={thread.lastMessageAt}
                              >
                                {new Date(
                                  thread.lastMessageAt,
                                ).toLocaleDateString(locale, {
                                  month: "short",
                                  day: "numeric",
                                })}
                              </time>
                            </span>
                            <span
                              className={styles.secondary}
                              style={{ display: "block" }}
                            >
                              {thread.lastTask?.prompt || t("Unsent draft")}
                            </span>
                          </button>
                          {!!thread.title && !readOnly && (
                            <Dropdown
                              trigger={["click"]}
                              menu={{
                                items: [
                                  {
                                    key: "rename",
                                    label: t("Rename conversation"),
                                  },
                                  {
                                    key: "archive",
                                    label: t(
                                      thread.archivedAt
                                        ? "Restore conversation"
                                        : "Archive conversation",
                                    ),
                                    disabled:
                                      running ||
                                      thread.lastTask?.needsReconciliation,
                                  },
                                ],
                                onClick: ({ key }) => {
                                  if (key === "rename") {
                                    setRenaming({
                                      id: thread.id,
                                      title: thread.title,
                                    });
                                  } else {
                                    void session.updateThread(thread.id, {
                                      archived: !thread.archivedAt,
                                    });
                                  }
                                },
                              }}
                            >
                              <Button
                                type="text"
                                size="small"
                                icon={<MoreOutlined />}
                                aria-label={t("Conversation actions: {title}", {
                                  title: name,
                                })}
                              />
                            </Dropdown>
                          )}
                        </div>
                      );
                    })}
                    {!session.threads.length && !session.threadListLoading && (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={t("No conversations found")}
                      />
                    )}
                  </Scrollbar>
                </Spin>
                {session.threadListBefore && (
                  <Button
                    className={styles.more}
                    size="small"
                    loading={session.threadListLoading}
                    onClick={() =>
                      void session.searchThreads(query, archived, true)
                    }
                  >
                    {t("Load more conversations")}
                  </Button>
                )}
              </section>
            }
          >
            <TriggerTarget>{trigger}</TriggerTarget>
          </Popover>
        </div>
        <Button
          size="small"
          type="text"
          icon={<PlusOutlined />}
          disabled={readOnly || disabled}
          aria-label={t("New conversation")}
          onClick={() => {
            session.newThread();
            setOpen(false);
          }}
        >
          {t("New")}
        </Button>
      </div>
      <Modal
        title={t("Rename conversation")}
        open={!!renaming}
        onCancel={() => setRenaming(undefined)}
        okText={t("Save")}
        cancelText={t("Cancel")}
        confirmLoading={saving}
        okButtonProps={{ disabled: !renaming?.title.trim() }}
        onOk={async () => {
          if (!renaming?.title.trim()) {
            return;
          }
          setSaving(true);
          try {
            await session.updateThread(renaming.id, {
              title: renaming.title.trim(),
            });
            setRenaming(undefined);
          } finally {
            setSaving(false);
          }
        }}
      >
        <Input
          value={renaming?.title ?? ""}
          maxLength={100}
          aria-label={t("Conversation name")}
          onChange={(event) =>
            setRenaming(
              (current) => current && { ...current, title: event.target.value },
            )
          }
        />
      </Modal>
    </>
  );
}

export function AiRunningNotice({
  session,
  onOpen,
}: {
  session: AiSessionView;
  onOpen?: () => void;
}) {
  const { t } = useI18n();
  const run = session.blockingTask;
  if (!run || run.threadId === session.activeThreadId) {
    return null;
  }
  const sameBranch = run.binding.branchId === session.branchId;
  return (
    <div role="status" style={{ padding: "8px 0", fontSize: 12 }}>
      {t(
        run.needsReconciliation
          ? sameBranch
            ? "Another conversation needs saved-design verification."
            : "Open the task's branch to verify the saved design."
          : sameBranch
            ? "A task is running in another conversation."
            : "A task is running in another branch.",
      )}
      {sameBranch && (
        <Button
          type="link"
          size="small"
          onClick={() => {
            void session.selectThread(run.threadId);
            onOpen?.();
          }}
        >
          {t(
            run.needsReconciliation
              ? "View conversation"
              : "View running conversation",
          )}
        </Button>
      )}
    </div>
  );
}
