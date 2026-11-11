import CommentPostForm from "@/wab/client/components/comments/CommentPostForm";
import {
  CommentSubjectName,
  CommentSubjectType,
} from "@/wab/client/components/comments/CommentSubjectInputs";
import ThreadComments from "@/wab/client/components/comments/ThreadComments";
import { TplCommentThread } from "@/wab/client/components/comments/utils";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { PanelCloseButton } from "@/wab/client/components/studio/PanelCloseButton";
import { useI18n } from "@/wab/client/i18n";
import { OpenedThread } from "@/wab/client/studio-ctx/comments-ctx";
import { canUpdateHistory } from "@/wab/client/studio-ctx/StudioCtx";
import { CommentThreadId } from "@/wab/shared/ApiSchema";
import {
  AimOutlined,
  ArrowLeftOutlined,
  CheckCircleOutlined,
  DownOutlined,
  UpOutlined,
} from "@ant-design/icons";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import { Alert, Button, Flex, Skeleton, Tooltip, Typography, message } from "antd";
import { createStyles } from "antd-style";
import * as React from "react";
import { useStore } from "zustand";

export const useCommentPanelStyles = createStyles(({ token }) => ({
  root: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minHeight: 0,
    minWidth: 0,
  },
  header: {
    padding: 12,
    borderBottom: `1px solid ${token.colorBorderSecondary}`,
    flexShrink: 0,
  },
  back: { padding: "0 4px", fontSize: 13, fontWeight: 500 },
  context: {
    padding: "12px 16px",
    borderBottom: `1px solid ${token.colorBorder}`,
    flexShrink: 0,
  },
  location: {
    flex: 1,
    minWidth: 0,
    padding: 0,
    height: "auto",
    textAlign: "left",
    justifyContent: "flex-start",
    overflow: "hidden",
    "& .ant-btn-content": {
      display: "flex",
      alignItems: "center",
      gap: 8,
      flex: 1,
      minWidth: 0,
    },
  },
  locationIcon: {
    color: token.colorPrimaryText,
    background: token.colorPrimaryBg,
    borderRadius: 6,
    padding: 7,
    flexShrink: 0,
  },
  locationDetails: { flex: 1, minWidth: 0 },
  locationText: { width: "100%", color: "inherit" },
  locationName: {
    fontSize: 12,
    fontWeight: 500,
  },
  resolve: { flexShrink: 0 },
  secondary: { fontSize: 11, color: token.colorTextSecondary },
  content: { padding: "24px 16px 16px" },
  composer: {
    padding: "12px 14px 8px",
    borderTop: `1px solid ${token.colorBorderSecondary}`,
    background: token.colorBgContainer,
    flexShrink: 0,
  },
}));

export function CommentThreadPanel({
  openedThread,
  navigationIds,
}: {
  openedThread: OpenedThread;
  navigationIds: readonly CommentThreadId[];
}) {
  const studioCtx = useStudioCtx();
  const ctx = studioCtx.commentsCtx;
  const { t } = useI18n();
  const { styles, cx } = useCommentPanelStyles();
  const thread = useStore(ctx.store, (state) =>
    state.threadsById.get(openedThread.threadId),
  );
  const hasLoaded = useStore(ctx.requestStore, (state) => state.hasLoaded);
  const scroll = React.useRef<HTMLElement>(null);
  const sent = React.useRef(false);
  const [messages, messageHolder] = message.useMessage();
  const count = thread?.comments.length ?? 0;
  React.useEffect(() => {
    if (hasLoaded && !thread) {
      ctx.closeCommentThreadDialog();
    }
  }, [ctx, hasLoaded, thread]);
  React.useEffect(() => {
    scroll.current?.scrollTo({ top: 0 });
    sent.current = false;
  }, [openedThread.threadId]);
  React.useEffect(() => {
    if (sent.current) {
      scroll.current?.scrollTo({
        top: scroll.current.scrollHeight,
        behavior: "smooth",
      });
      sent.current = false;
    }
  }, [count]);
  const index = navigationIds.indexOf(openedThread.threadId);
  const navigate = (delta: number) => {
    const id = navigationIds[index + delta];
    if (id) {
      ctx.openCommentThreadDialog(id);
    }
  };
  const resolve = (value: TplCommentThread) => {
    ctx.editThread(value.id, !value.resolved);
    if (!value.resolved) {
      const key = `resolve-comment-${value.id}`;
      messages.success({
        key,
        content: (
          <Flex align="center" gap={12}>
            {t("Comment resolved")}
            <Button
              type="link"
              size="small"
              onClick={() => {
                ctx.editThread(value.id, false);
                messages.destroy(key);
              }}
            >
              {t("Undo")}
            </Button>
          </Flex>
        ),
      });
    }
  };
  return (
    <section className={styles.root} aria-label={t("Comment details")}>
      {messageHolder}
      <Flex align="center" justify="space-between" className={styles.header}>
        <Button
          type="text"
          className={styles.back}
          icon={<ArrowLeftOutlined />}
          onClick={() => ctx.closeCommentThreadDialog()}
          aria-label={t("Back to comments")}
        >
          {t("Comment details")}
        </Button>
        <Flex align="center" gap={2}>
          <span className={styles.secondary}>
            {index + 1} / {navigationIds.length}
          </span>
          <Tooltip title={t("Previous comment")}>
            <Button
              type="text"
              size="small"
              icon={<UpOutlined />}
              aria-label={t("Previous comment")}
              disabled={index <= 0}
              onClick={() => navigate(-1)}
            />
          </Tooltip>
          <Tooltip title={t("Next comment")}>
            <Button
              type="text"
              size="small"
              icon={<DownOutlined />}
              aria-label={t("Next comment")}
              disabled={index < 0 || index >= navigationIds.length - 1}
              onClick={() => navigate(1)}
            />
          </Tooltip>
          <PanelCloseButton onClick={() => studioCtx.collapseRightPanel()} />
        </Flex>
      </Flex>
      {thread ? (
        <>
          <Flex align="center" gap={8} className={styles.context}>
            <Button
              type="text"
              className={styles.location}
              aria-label={t("Locate comment target")}
              disabled={!thread.subjectInfo}
              onClick={() => {
                void studioCtx.focusCommentThread(thread.id);
              }}
            >
              <span className={styles.locationIcon}>
                <AimOutlined />
              </span>
              <Flex vertical align="flex-start" className={styles.locationDetails}>
                <Typography.Text
                  className={cx(styles.locationText, styles.locationName)}
                  ellipsis={{ tooltip: true }}
                >
                  {thread.subjectInfo ? (
                    <CommentSubjectName
                      studio={studioCtx}
                      subject={thread.subjectInfo.subject}
                      fallback={thread.label}
                    />
                  ) : (
                    t("Deleted element")
                  )}
                </Typography.Text>
                <Typography.Text
                  className={cx(styles.locationText, styles.secondary)}
                  ellipsis={{ tooltip: true }}
                >
                  {thread.subjectInfo?.ownerComponentName}
                  {thread.subjectInfo && openedThread.viewCtx && (
                    <>
                      {" "}
                      ·{" "}
                      <CommentSubjectType
                        view={openedThread.viewCtx}
                        subject={thread.subjectInfo.subject}
                      />
                    </>
                  )}
                </Typography.Text>
              </Flex>
            </Button>
            {canUpdateHistory(studioCtx, thread) && (
              <Tooltip title={t(thread.resolved ? "Re-open" : "Resolve")}>
                <Button
                  type="text"
                  size="small"
                  shape="circle"
                  className={styles.resolve}
                  icon={<CheckCircleOutlined />}
                  aria-label={t(thread.resolved ? "Re-open" : "Resolve")}
                  onClick={() => resolve(thread)}
                />
              </Tooltip>
            )}
          </Flex>
          {thread.resolved && (
            <Alert type="success" showIcon title={t("Comment resolved")} />
          )}
          <Scrollbar
            ref={scroll}
            scrollX={false}
            style={{ flex: 1, minHeight: 0 }}
          >
            <div className={styles.content}>
              <ThreadComments key={thread.id} commentThread={thread} />
            </div>
          </Scrollbar>
          <footer className={styles.composer}>
            <CommentPostForm
              key={thread.id}
              id={thread.id}
              initialRows={2}
              defaultValue={ctx.getThreadDraft(thread)}
              onChange={(value) => ctx.setThreadDraft(thread, value)}
              onSubmit={(value) => {
                sent.current = true;
                ctx.postThreadComment(thread.id, { body: value });
                ctx.clearThreadDraft(thread);
              }}
            />
          </footer>
        </>
      ) : (
        <Scrollbar scrollX={false} style={{ flex: 1, minHeight: 0 }}>
          <div className={styles.content}>
            <Skeleton active />
          </div>
        </Scrollbar>
      )}
    </section>
  );
}
