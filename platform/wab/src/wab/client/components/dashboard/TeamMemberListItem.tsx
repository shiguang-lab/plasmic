import { Matcher } from "@/wab/client/components/view-common";
import Select from "@/wab/client/components/widgets/Select";
import {
  commenterTooltip,
  contentCreatorTooltip,
  designerTooltip,
  developerTooltip,
  viewerTooltip,
} from "@/wab/client/components/widgets/plasmic/PermissionItem";
import { useAppCtx } from "@/wab/client/contexts/AppContexts";
import { UiText } from "@/wab/client/i18n/UiText";
import {
  DefaultTeamMemberListItemProps,
  PlasmicTeamMemberListItem,
} from "@/wab/client/plasmic/plasmic_kit_dashboard/PlasmicTeamMemberListItem";
import { ApiPermission, TeamMember } from "@/wab/shared/ApiSchema";
import { fullName, getUserEmail } from "@/wab/shared/ApiSchemaUtil";
import { GrantableAccessLevel, accessLevelRank } from "@/wab/shared/EntUtil";
import { ensure } from "@/wab/shared/common";
import { HTMLElementRefOf } from "@plasmicapp/react-web";
import { Menu, Tooltip } from "antd";
import moment from "moment";
import * as React from "react";

interface TeamMemberListItemProps extends DefaultTeamMemberListItemProps {
  user: TeamMember;
  matcher: Matcher;
  perm?: ApiPermission;
  changeRole: (email: string, role?: GrantableAccessLevel) => Promise<void>;
  removeUser: (email: string) => Promise<void>;
  disabled?: boolean;
  perms: ApiPermission[];
}

function TeamMemberListItem_(
  props: TeamMemberListItemProps,
  ref: HTMLElementRefOf<"div">,
) {
  const {
    user,
    matcher,
    perm,
    changeRole,
    removeUser,
    disabled,
    perms,
    ...rest
  } = props;
  const appCtx = useAppCtx();
  const selfInfo = ensure(appCtx.selfInfo, "Unexpected undefined selfInfo");

  const selfPerm = perms.find((p) => p.userId === selfInfo.id);
  const selfRoleValue = selfPerm ? selfPerm.accessLevel : "none";

  const isSelf =
    user.type === "user"
      ? user.id === selfInfo.id
      : user.email === selfInfo.email;
  const targetRank = perm ? accessLevelRank(perm.accessLevel) : -1;
  const selfRank = selfPerm ? accessLevelRank(selfPerm.accessLevel) : -1;

  const roleValue =
    !!perm &&
    ["owner", "editor", "designer", "content", "commenter", "viewer"].includes(
      perm.accessLevel,
    )
      ? perm.accessLevel
      : "none";

  const noneDesc =
    "'None' means that the user has no team-wide permissions, but may have individual workspace or project permissions. Users with `None` will still count towards your seat count.";
  return (
    <PlasmicTeamMemberListItem
      root={{ ref }}
      {...rest}
      name={matcher.boldSnippets(
        user.type === "user" ? fullName(user) : user.email,
      )}
      email={matcher.boldSnippets(
        user.type === "user" ? getUserEmail(user) : user.email,
      )}
      lastActive={
        user.type === "user" && user.lastActive
          ? moment(user.lastActive).fromNow()
          : "never"
      }
      numProjects={`${
        user.type === "user" && user.projectsCreated ? user.projectsCreated : 0
      }`}
      role={{
        value: roleValue,
        isDisabled: disabled || isSelf || targetRank > selfRank,
        onChange: async (e) => {
          if (e !== roleValue && e !== null) {
            if (e === "none") {
              await changeRole(user.email);
            } else if (
              [
                "editor",
                "designer",
                "content",
                "commenter",
                "viewer",
                "owner",
              ].includes(e)
            ) {
              await changeRole(user.email, e as GrantableAccessLevel);
            }
          }
        },
        children: [
          <Select.Option
            style={selfRoleValue === "owner" ? {} : { display: "none" }}
            value="owner"
          >
            <UiText message={"Owner"} />
          </Select.Option>,
          <Select.Option value="editor">{developerTooltip}</Select.Option>,
          <Select.Option value="content">
            {contentCreatorTooltip}
          </Select.Option>,
          <Select.Option value="designer">{designerTooltip}</Select.Option>,
          <Select.Option value="commenter">{commenterTooltip}</Select.Option>,
          <Select.Option value="viewer">{viewerTooltip}</Select.Option>,
          <Select.Option
            style={{
              display: "none",
            }}
            value="none"
          >
            <UiText message={"None"} />
          </Select.Option>,
        ],
      }}
      roleHelp={{
        wrap: (node) =>
          roleValue === "none" ? (
            <Tooltip title={noneDesc}>{node}</Tooltip>
          ) : null,
      }}
      menuButton={{
        wrap: (node) =>
          !disabled &&
          // Owners may not be removed directly
          perm?.accessLevel !== "owner" &&
          // Can always remove self
          (isSelf ||
            // Can remove others if editor/developer or higher
            selfRank >= accessLevelRank("editor"))
            ? node
            : null,
        props: {
          menu: (
            <Menu>
              <Menu.Item
                onClick={async () => {
                  await removeUser(user.email);
                }}
              >
                <strong>
                  <UiText message={"Remove"} />
                </strong>{" "}
                {isSelf ? "self" : "member"}
              </Menu.Item>
            </Menu>
          ),
        },
      }}
    />
  );
}

const TeamMemberListItem = React.forwardRef(TeamMemberListItem_);
export default TeamMemberListItem;
