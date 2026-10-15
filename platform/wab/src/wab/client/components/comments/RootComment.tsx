import CommentPost from "@/wab/client/components/comments/CommentPost";
import { TplCommentThread } from "@/wab/client/components/comments/utils";
import { useI18n } from "@/wab/client/i18n";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { CheckCircleOutlined } from "@ant-design/icons";
import { Flex, Tooltip } from "antd";
import { observer } from "mobx-react";
import * as React from "react";

export default observer(function RootComment({
  commentThread,
  showLocation = false,
}: {
  commentThread: TplCommentThread;
  showLocation?: boolean;
}) {
  const studioCtx = useStudioCtx();
  const { t } = useI18n();
  const [comment] = commentThread.comments;
  const label =
    showLocation && commentThread.subjectInfo
      ? `${commentThread.subjectInfo.ownerComponent.name} · ${commentThread.label}`
      : commentThread.label;

  return (
    <CommentPost
      comment={comment}
      commentThread={commentThread}
      subjectLabel={
        <Flex align="center" gap={6}>
          <span style={{ minWidth: 0, flex: 1, overflowWrap: "anywhere" }}>
            {label}
          </span>
          {commentThread.resolved && (
            <Tooltip title={t("Resolved")}>
              <CheckCircleOutlined aria-label={t("Resolved")} />
            </Tooltip>
          )}
        </Flex>
      }
      isThread
      repliesLinkLabel={
        commentThread.comments.length > 1
          ? t("{count} replies", { count: commentThread.comments.length - 1 })
          : t("Reply")
      }
      onClick={async () => {
        studioCtx.commentsCtx.openCommentThreadDialog(commentThread.id);
      }}
    />
  );
});
