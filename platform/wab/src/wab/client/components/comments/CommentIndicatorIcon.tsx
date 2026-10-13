import { Icon } from "@/wab/client/components/widgets/Icon";
import { useI18n } from "@/wab/client/i18n";
import SpeechBubblesvgIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__SpeechBubbleSvg";
import { Tooltip } from "antd";
import * as React from "react";

export default function CommentIndicatorIcon({
  commentCount,
  replyCount,
  otherVariantsCount,
}: {
  commentCount: number;
  replyCount: number;
  otherVariantsCount?: number;
}) {
  const { t } = useI18n();
  const comments = t(commentCount === 1 ? "1 comment" : "{count} comments", {
    count: commentCount,
  });
  const replies =
    replyCount > 0
      ? t(
          replyCount === 1
            ? "{comments} and 1 reply"
            : "{comments} and {count} replies",
          { comments, count: replyCount },
        )
      : comments;
  const title = otherVariantsCount
    ? t("{summary}; {count} comments in other variants", {
        summary: replies,
        count: otherVariantsCount,
      })
    : replies;
  return (
    <Tooltip title={title}>
      <Icon icon={SpeechBubblesvgIcon} />
    </Tooltip>
  );
}
