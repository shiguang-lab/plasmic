import { CommentSubjectName, CommentSubjectType } from "@/wab/client/components/comments/CommentSubjectInputs";
import { useStudioArena } from "@/wab/client/studio-ctx/arena-state";
import CommentPostForm from "@/wab/client/components/comments/CommentPostForm";
import { FloatingWindow } from "@/wab/client/components/widgets/FloatingWindow";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import {
  DefaultThreadCommentsDialogProps,
  PlasmicThreadCommentsDialog,
} from "@/wab/client/plasmic/plasmic_kit_comments/PlasmicThreadCommentsDialog";
import { OpenedThread } from "@/wab/client/studio-ctx/comments-ctx";
import { canUpdateHistory } from "@/wab/client/studio-ctx/StudioCtx";
import { OnClickAway } from "@/wab/commons/components/OnClickAway";
import * as React from "react";
import { useStore } from "zustand";

export type ThreadCommentsDialogProps = DefaultThreadCommentsDialogProps & {
  openedThread: OpenedThread;
};

export const ThreadCommentsDialog = React.memo(function ThreadCommentsDialog({
  openedThread,
  ...props
}: ThreadCommentsDialogProps) {
  const studioCtx = useStudioCtx();
  const focusedMode = useStudioArena(studioCtx, (state) => state.focusedMode);
  const commentsCtx = studioCtx.commentsCtx;

  const selectedThread = useStore(commentsCtx.store, (state) =>
    state.threadsById.get(openedThread.threadId),
  );
  const hasLoaded = useStore(
    commentsCtx.requestStore,
    (state) => state.hasLoaded,
  );
  React.useEffect(() => {
    if (hasLoaded && !selectedThread) {
      commentsCtx.closeCommentThreadDialog();
    }
  }, [commentsCtx, hasLoaded, selectedThread]);
  if (!selectedThread) {
    return null;
  }
  const subjectInfo = selectedThread.subjectInfo;

  const handleClickOutside = () => {
    if (!commentsCtx.hasDialogInteraction(openedThread)) {
      commentsCtx.closeCommentThreadDialog();
    }
  };

  const markThreadAsInteracted = () => {
    commentsCtx.markDialogInteracted(openedThread);
  };

  const canUpdateThreadHistory = canUpdateHistory(studioCtx, selectedThread);

  return (
    <OnClickAway onDone={handleClickOutside}>
      <FloatingWindow
        handleSelector=".CommentDialogDragHandle"
        focusedMode={focusedMode}
        initialWidth={300}
        onClick={markThreadAsInteracted}
        onKeyDown={markThreadAsInteracted}
      >
        <PlasmicThreadCommentsDialog
          commentsDialogHead={{
            className: "CommentDialogDragHandle",
            close: {
              onClick: () => commentsCtx.closeCommentThreadDialog(),
              "data-test-id": "thread-comment-dialog-close-btn",
            },
            ...(subjectInfo
              ? {
                  name: <CommentSubjectName studio={studioCtx} subject={subjectInfo.subject} fallback="Unnamed element" />,
                  type: openedThread.viewCtx
                    ? <CommentSubjectType view={openedThread.viewCtx} subject={subjectInfo.subject} />
                    : "",
                }
              : {
                  name: "Deleted element",
                  type: "",
                }),
            canUpdateHistory: canUpdateThreadHistory,
            threadHistoryStatus: {
              commentThread: selectedThread,
              "data-test-id": "thread-comment-dialog-history-btn",
            },
          }}
          threadComments={{
            commentThread: selectedThread,
          }}
          replyForm={{
            render: () => (
              <CommentPostForm
                id={selectedThread.id}
                initialRows={1}
                defaultValue={commentsCtx.getThreadDraft(selectedThread)}
                onSubmit={(value: string) => {
                  commentsCtx.postThreadComment(selectedThread.id, {
                    body: value,
                  });
                  commentsCtx.clearThreadDraft(selectedThread);
                }}
                onChange={(value) =>
                  commentsCtx.setThreadDraft(selectedThread, value)
                }
              />
            ),
          }}
          {...props}
        />
      </FloatingWindow>
    </OnClickAway>
  );
});
