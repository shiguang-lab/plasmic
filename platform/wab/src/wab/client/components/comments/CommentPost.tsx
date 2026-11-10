import CommentPostForm from "@/wab/client/components/comments/CommentPostForm";
import { ReactionsByEmoji } from "@/wab/client/components/comments/ReactionsByEmoji";
import { TplCommentThread } from "@/wab/client/components/comments/utils";
import { Avatar } from "@/wab/client/components/studio/Avatar";
import { ClickStopper } from "@/wab/client/components/widgets";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { UiText } from "@/wab/client/i18n/UiText";
import { useI18n } from "@/wab/client/i18n";
import {
  DefaultCommentPostProps,
  PlasmicCommentPost,
} from "@/wab/client/plasmic/plasmic_kit_comments/PlasmicCommentPost";
import { StandardMarkdown } from "@/wab/client/utils/StandardMarkdown";
import { ApiComment } from "@/wab/shared/ApiSchema";
import { fullName } from "@/wab/shared/ApiSchemaUtil";
import { ensure, ensureString, maybe } from "@/wab/shared/common";
import { HTMLElementRefOf } from "@plasmicapp/react-web";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import { Menu, Typography } from "antd";
import copy from "copy-to-clipboard";
import { groupBy } from "lodash";
import moment from "moment";
import * as React from "react";
import { useStore } from "zustand";

export interface CommentPostProps extends DefaultCommentPostProps {
  comment: ApiComment;
  commentThread: TplCommentThread;
}

function CommentPost_(props: CommentPostProps, ref: HTMLElementRefOf<"div">) {
  const {
    comment,
    commentThread,
    ...rest
  } = props;

  const [isEditing, setIsEditing] = React.useState(false);
  const { t } = useI18n();
  const replyCount = commentThread.comments.filter(value => !value.deletedAt).length - 1;

  const studioCtx = useStudioCtx();
  const commentsCtx = studioCtx.commentsCtx;
  const appCtx = studioCtx.appCtx;

  const author = ensure(
    useStore(commentsCtx.store, (state) =>
      state.usersMap.get(ensureString(comment.createdById)),
    ),
    `Author of comment ${comment.createdById} should be present in usersMap`,
  );

  const reactionsByEmoji =
    maybe(
      useStore(commentsCtx.store, (state) =>
        state.reactionsByCommentId.get(comment.id),
      ),
      (xs) => groupBy(xs, (x) => x.data.emojiName),
    ) ?? {};

  const popoverTargetRef = React.useRef<HTMLDivElement>(null);

  const body = comment.deletedAt ? null : (
    <StandardMarkdown components={{
      pre: ({ children }) => <Scrollbar scrollY={false} style={{ maxWidth: "100%" }}><pre style={{ overflow: "visible" }}>{children}</pre></Scrollbar>,
      table: ({ children }) => <Scrollbar scrollY={false} style={{ maxWidth: "100%" }}><table style={{ overflow: "visible", display: "table" }}>{children}</table></Scrollbar>,
    }}>{comment.body}</StandardMarkdown>
  );

  return (
    <PlasmicCommentPost
      className="CommentPost"
      root={{
        ref: popoverTargetRef,
        "data-test-id": `comment-post-${commentThread.id}`,
      }}
      {...rest}
      body={props.hoverBox ? <Scrollbar scrollX={false} style={{ maxHeight: 200, minHeight: 0, minWidth: 0, width: "100%" }}>{body}</Scrollbar> : body}
      isEditing={isEditing}
      isDeleted={Boolean(comment.deletedAt)}
      commentPostForm={{
        render: () => (
          <CommentPostForm
            isEditing
            id={comment.id}
            initialRows={1}
            defaultValue={comment.body}
            onSubmit={(value: string) => {
              if (value.trim() !== comment.body.trim()) {
                commentsCtx.editComment(comment.id, value.trim());
              }
              setIsEditing(false);
            }}
            onCancel={() => {
              setIsEditing(false);
            }}
          />
        ),
      }}
      timestamp={moment(comment.createdAt).fromNow()}
      userFullName={fullName(author)}
      repliesLink={{ render: () => props.hoverBox && replyCount > 0 ? <Typography.Text type="secondary">{t("{count} replies", { count: replyCount })}</Typography.Text> : null }}
      avatarContainer={{ children: <Avatar user={author} /> }}
      reactionsContainer={{
        children: (
          <ReactionsByEmoji
            commentId={comment.id}
            reactionsByEmoji={reactionsByEmoji}
          />
        ),
      }}
      threadHistoryStatus={{
        commentThread,
      }}
      btnMore={{
        wrap: (node) => <ClickStopper preventDefault>{node}</ClickStopper>,
        props: {
          menu: () => (
            <Menu>
              <Menu.Item
                key="copy"
                onClick={() => {
                  copy(comment.body);
                }}
              >
                <UiText message={"Copy text"} />
              </Menu.Item>
              {appCtx.selfInfo?.id === comment.createdById && (
                <>
                  <Menu.Item
                    key="edit"
                    onClick={() => {
                      setIsEditing(true);
                    }}
                  >
                    <UiText message={"Edit comment"} />
                  </Menu.Item>
                  <Menu.Item
                    key="remove"
                    onClick={() => {
                      commentsCtx.deleteComment(comment.id);
                    }}
                  >
                    <UiText message={"Delete comment"} />
                  </Menu.Item>
                </>
              )}
            </Menu>
          ),
        },
      }}
    />
  );
}

const CommentPost = React.forwardRef(CommentPost_);
export default CommentPost;
