import CommentPost from "@/wab/client/components/comments/CommentPost";
import { TplCommentThread } from "@/wab/client/components/comments/utils";
import { useI18n } from "@/wab/client/i18n";
import { useStudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { observer } from "mobx-react";
import * as React from "react";

export default observer(function RootComment({
  commentThread,
}: {
  commentThread: TplCommentThread;
}) {
  const studioCtx = useStudioCtx();
  const { t } = useI18n();
  const [comment] = commentThread.comments;

  return (
    <CommentPost
      comment={comment}
      commentThread={commentThread}
      subjectLabel={commentThread.label}
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
