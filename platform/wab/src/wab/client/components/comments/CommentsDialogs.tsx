import { CommentPostFormDialog } from "@/wab/client/components/comments/CommentPostFormDialog";
import { ThreadCommentsDialog } from "@/wab/client/components/comments/ThreadCommentsDialog";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import * as React from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";

export type CommentsTabProps = {
  studioCtx: StudioCtx;
};

export function CommentsDialogs(props: CommentsTabProps) {
  const { studioCtx } = props;

  const commentsCtx = studioCtx.commentsCtx;

  const { thread, newThread } = useStore(
    commentsCtx.dialogStore,
    useShallow((state) => ({
      thread: state.thread,
      newThread: state.newThread,
    })),
  );
  if (thread) {
    return <ThreadCommentsDialog openedThread={thread} />;
  }

  if (newThread) {
    return <CommentPostFormDialog openedNewThread={newThread} />;
  }

  return null;
}
