import { TplCommentThread } from "@/wab/client/components/comments/utils";
import { Avatar } from "@/wab/client/components/studio/Avatar";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { useI18n } from "@/wab/client/i18n";
import { canUpdateHistory } from "@/wab/client/studio-ctx/StudioCtx";
import { StandardMarkdown } from "@/wab/client/utils/StandardMarkdown";
import { fullName } from "@/wab/shared/ApiSchemaUtil";
import { ensure, ensureString } from "@/wab/shared/common";
import {
  AimOutlined,
  CheckCircleOutlined,
  MessageOutlined,
} from "@ant-design/icons";
import { Button, Flex, Tooltip } from "antd";
import { createStyles } from "antd-style";
import moment from "moment";
import * as React from "react";
import { useStore } from "zustand";

const useStyles = createStyles(({ token }) => ({
  root: {
    position: "relative",
    borderBottom: `1px solid ${token.colorBorderSecondary}`,
  },
  open: {
    width: "100%",
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 9,
    border: 0,
    borderRadius: 0,
    background: "transparent",
    color: token.colorText,
    textAlign: "left",
    cursor: "pointer",
    fontFamily: "inherit",
    lineHeight: "inherit",
    "&:hover": { background: token.colorFillTertiary },
    "&:focus-visible": {
      outline: `2px solid ${token.colorPrimary}`,
      outlineOffset: -2,
    },
  },
  author: { width: "100%", minWidth: 0, fontSize: 12, paddingRight: 28 },
  name: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontWeight: 500,
  },
  secondary: {
    color: token.colorTextSecondary,
    fontSize: 11,
    whiteSpace: "nowrap",
  },
  target: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    color: token.colorTextSecondary,
    fontSize: 11,
    overflowWrap: "anywhere",
  },
  summary: {
    fontSize: 12,
    lineHeight: "20px",
    color: token.colorTextSecondary,
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: 2,
    overflow: "hidden",
    overflowWrap: "anywhere",
    "& *": {
      display: "inline",
      margin: 0,
      padding: 0,
      fontSize: "inherit",
      lineHeight: "inherit",
    },
    "& strong": { color: token.colorText, fontWeight: 500 },
  },
  preview: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    minWidth: 0,
    width: "100%",
  },
  lead: { color: token.colorText, fontWeight: 500, WebkitLineClamp: 1 },
  single: { WebkitLineClamp: 3 },
  replies: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    color: token.colorPrimaryText,
    fontSize: 11,
  },
  resolve: {
    position: "absolute",
    top: 16,
    right: 10,
    color: token.colorTextSecondary,
  },
}));

export default function RootComment({
  commentThread,
  showLocation = false,
  onOpen,
}: {
  commentThread: TplCommentThread;
  showLocation?: boolean;
  onOpen?: () => void;
}) {
  const studioCtx = useStudioCtx();
  const { t } = useI18n();
  const { styles, cx } = useStyles();
  const comment = ensure(
    commentThread.comments.find((c) => !c.deletedAt),
    "Comment summary requires a visible comment",
  );
  const author = ensure(
    useStore(studioCtx.commentsCtx.store, (state) =>
      state.usersMap.get(ensureString(comment.createdById)),
    ),
    "Comment author should exist",
  );
  const label = !commentThread.subjectInfo
    ? t("Deleted element")
    : !commentThread.subjectInfo.variants
      ? t("Deleted variant")
      : commentThread.label;
  const replies = commentThread.comments.filter((c) => !c.deletedAt).length - 1;
  const [lead, excerpt] = comment.body.trim().split(/\n\s*\n/);
  return (
    <article className={styles.root}>
      <button
        type="button"
        className={styles.open}
        data-comment-thread={commentThread.id}
        aria-label={t("Open comment by {name}", { name: fullName(author) })}
        onClick={() => {
          onOpen?.();
          studioCtx.commentsCtx.openCommentThreadDialog(commentThread.id);
        }}
      >
        <Flex align="center" gap={8} className={styles.author}>
          <Avatar user={author} size="small" showToolTip={false} />
          <span className={styles.name}>{fullName(author)}</span>
          <span className={styles.secondary}>
            {moment(comment.createdAt).fromNow()}
          </span>
        </Flex>
        <span className={styles.target}>
          <AimOutlined />
          {showLocation && commentThread.subjectInfo
            ? `${commentThread.subjectInfo.ownerComponentName} · `
            : ""}
          {label}
        </span>
        <div className={styles.preview}>
          <StandardMarkdown
            className={cx(
              styles.summary,
              excerpt ? styles.lead : styles.single,
            )}
            components={{
              a: ({ children }) => <span>{children}</span>,
              img: () => null,
            }}
          >
            {lead.slice(0, 400)}
          </StandardMarkdown>
          {excerpt && (
            <StandardMarkdown
              className={styles.summary}
              components={{
                a: ({ children }) => <span>{children}</span>,
                img: () => null,
              }}
            >
              {excerpt.slice(0, 400)}
            </StandardMarkdown>
          )}
        </div>
        <span className={styles.replies}>
          <MessageOutlined />
          {replies ? t("{count} replies", { count: replies }) : t("Reply")}
          {commentThread.resolved && (
            <>
              <CheckCircleOutlined />
              {t("Resolved")}
            </>
          )}
        </span>
      </button>
      {canUpdateHistory(studioCtx, commentThread) && (
        <Tooltip title={t(commentThread.resolved ? "Re-open" : "Resolve")}>
          <Button
            type="text"
            size="small"
            className={styles.resolve}
            icon={<CheckCircleOutlined />}
            aria-label={t(commentThread.resolved ? "Re-open" : "Resolve")}
            onClick={() =>
              studioCtx.commentsCtx.editThread(
                commentThread.id,
                !commentThread.resolved,
              )
            }
          />
        </Tooltip>
      )}
    </article>
  );
}
