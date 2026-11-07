import {
  DefaultUserMentionDisplayProps,
  PlasmicUserMentionDisplay,
} from "@/wab/client/plasmic/plasmic_kit_user_mentions/PlasmicUserMentionDisplay";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { useStore } from "zustand";
import { HTMLElementRefOf } from "@plasmicapp/react-web";
import * as React from "react";

export interface UserMentionDisplayProps extends DefaultUserMentionDisplayProps {
  email: string;
  defaultEmailDisplay: React.ReactNode;
}

function UserMentionDisplay_(
  props: UserMentionDisplayProps,
  ref: HTMLElementRefOf<"div">,
) {
  const { email, defaultEmailDisplay, ...plasmicProps } = props;

  const studioCtx = useStudioCtx();
  const mentionedUser = useStore(studioCtx.projectMetadataStore, (state) => state.mentionUsers.find((user) => user.email === email));

  if (!mentionedUser) {
    return defaultEmailDisplay;
  }

  return (
    <PlasmicUserMentionDisplay
      root={{
        ref,
      }}
      {...plasmicProps}
      children={`${mentionedUser.displayName}`}
    />
  );
}

export const UserMentionDisplay = React.forwardRef(UserMentionDisplay_);
