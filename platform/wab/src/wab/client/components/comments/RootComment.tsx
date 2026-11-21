import styles from "./RootComment.module.less";
import { cx } from "@/wab/shared/common";
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
import moment from "moment";
import * as React from "react";
import { useStore } from "zustand";

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
