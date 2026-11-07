import { Avatar } from "@/wab/client/components/studio/Avatar";
import { useShareDialog } from "@/wab/client/components/top-bar/useShareDialog";
import UserListItem from "@/wab/client/components/user-mentions/UserListItem";
import {
  DefaultUserMentionsPopoverContentProps,
  PlasmicUserMentionsPopoverContent,
} from "@/wab/client/plasmic/plasmic_kit_user_mentions/PlasmicUserMentionsPopoverContent";
import type { ProjectMentionUser } from "@/wab/client/studio-ctx/StudioCtx";
import { HTMLElementRefOf } from "@plasmicapp/react-web";
import * as React from "react";

export interface UserMentionsPopoverContentProps extends DefaultUserMentionsPopoverContentProps {
  users: readonly ProjectMentionUser[];
  highlightIndex: number;
  onSelectUser: (user: ProjectMentionUser) => void;
}

function UserMentionsPopoverContent_(
  props: UserMentionsPopoverContentProps,
  ref: HTMLElementRefOf<"div">,
) {
  const { users, highlightIndex = 0, onSelectUser, ...plasmicProps } = props;
  const { openShareDialog } = useShareDialog();

  return (
    <PlasmicUserMentionsPopoverContent
      root={{ ref }}
      {...plasmicProps}
      userList={{
        children: users.map((user, index) => (
          <UserListItem
            value={user.email}
            label={user.email}
            key={user.email}
            userEmail={user.email}
            username={`${user.displayName}`}
            isHighlighted={index === highlightIndex}
            avatar={<Avatar user={user} size={"small"} />}
            root={{
              onClick: () => onSelectUser(user),
            }}
          />
        )),
      }}
      shareProject={{
        onClick: () => {
          openShareDialog();
        },
      }}
    />
  );
}

const UserMentionsPopoverContent = React.forwardRef(
  UserMentionsPopoverContent_,
);
export { UserMentionsPopoverContent };
