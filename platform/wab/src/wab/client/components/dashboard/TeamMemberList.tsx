import TeamMemberListItem from "@/wab/client/components/dashboard/TeamMemberListItem";
import { Matcher } from "@/wab/client/components/view-common";
import { Modal } from "@/wab/client/components/widgets/Modal";
import ShareDialogContent from "@/wab/client/components/widgets/plasmic/ShareDialogContent";
import { useI18n } from "@/wab/client/i18n";
import { DefaultTeamMemberListProps } from "@/wab/client/plasmic/plasmic_kit_dashboard/PlasmicTeamMemberList";
import { ApiPermission, ApiTeam, TeamMember } from "@/wab/shared/ApiSchema";
import { fullName } from "@/wab/shared/ApiSchemaUtil";
import { GrantableAccessLevel, accessLevelRank } from "@/wab/shared/EntUtil";
import { HTMLElementRefOf } from "@plasmicapp/react-web";
import { Button, Empty, Flex, Input, Select, Typography } from "antd";
import { createStyles } from "antd-style";
import { sortBy } from "lodash";
import * as React from "react";

interface TeamMemberListProps extends DefaultTeamMemberListProps {
  team: ApiTeam;
  members: TeamMember[];
  perms: ApiPermission[];
  onChangeRole: (email: string, role?: GrantableAccessLevel) => Promise<void>;
  onRemoveUser: (email: string) => Promise<void>;
  onReload: () => Promise<void>;
  disabled?: boolean;
}

const useMembersStyles = createStyles(({ token }) => ({
  root: {
    color: token.colorText,
    background: token.colorBgContainer,
    padding: 24,
  },
  search: { width: 280, maxWidth: "100%" },
  filter: { minWidth: 180 },
}));

function TeamMemberList_(
  props: TeamMemberListProps,
  ref: HTMLElementRefOf<"div">,
) {
  const {
    members,
    perms,
    onChangeRole,
    onRemoveUser,
    onReload,
    disabled,
    team,
    ...rest
  } = props;

  const { t } = useI18n();
  const { styles, cx } = useMembersStyles();

  // Shared Modal
  const [sharedModal, setSharedModal] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const matcher = new Matcher(query);

  // Team member filters + search
  const [filterSelect, setFilterSelect] = React.useState<string | null>("all");
  let displayedMembers = members
    .filter(
      (m) =>
        (m.type === "user" && matcher.matches(fullName(m))) ||
        matcher.matches(m.email),
    )
    .filter((m) => {
      if (filterSelect === "all") {
        return true;
      }
      if (filterSelect === "none") {
        return !perms.some(
          (p) =>
            (p.user?.email ?? p.email) === m.email &&
            p.accessLevel !== "blocked",
        );
      }

      return perms.some(
        (p) =>
          (p.user?.email || p?.email) === m.email &&
          p.accessLevel === filterSelect,
      );
    });
  // The following lines perform 2 stable sorts so the members are sorted by
  // access level rank -> name (or email, if it's a member with no user).
  displayedMembers = sortBy(displayedMembers, (m) =>
    m.type === "user" ? fullName(m) : m.email,
  );
  displayedMembers = sortBy(
    displayedMembers,
    (m) =>
      -accessLevelRank(
        perms.find((p) => (p.user?.email ?? p.email) === m.email)
          ?.accessLevel ?? "blocked",
      ),
  );
  return (
    <>
      <section ref={ref} className={cx(styles.root, rest.className)}>
        <Flex vertical gap={16}>
          <Flex align="center" justify="space-between" gap={12} wrap>
            <Typography.Title level={4} style={{ margin: 0 }}>
              {t("Members")}
            </Typography.Title>
            <Button
              type="primary"
              disabled={disabled}
              onClick={() => setSharedModal(true)}
            >
              {t("Invite")}
            </Button>
          </Flex>
          <Flex gap={12} wrap>
            <Input.Search
              className={styles.search}
              aria-label={t("Search members")}
              placeholder={t("Search members")}
              value={query}
              allowClear
              onChange={(e) => setQuery(e.target.value)}
            />
            <Select
              className={styles.filter}
              aria-label={t("Filter by role")}
              value={filterSelect}
              onChange={setFilterSelect}
              options={(
                [
                  { value: "all", label: "All Roles" },
                  { value: "owner", label: "Owners" },
                  { value: "editor", label: "Developers" },
                  { value: "designer", label: "Designers" },
                  { value: "content", label: "Content Creators" },
                  ...(perms.some((p) => p.accessLevel === "commenter")
                    ? [{ value: "commenter", label: "Commenters" as const }]
                    : []),
                  { value: "viewer", label: "Viewers" },
                  { value: "none", label: "None" },
                ] as const
              ).map((item) => ({ value: item.value, label: t(item.label) }))}
            />
          </Flex>
        </Flex>
        {!displayedMembers.length && (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t("No matching members")}
          />
        )}
        {displayedMembers.map((user) => (
          <TeamMemberListItem
            key={user.email}
            user={user}
            matcher={matcher}
            perm={perms.find(
              (p) => p.user?.email === user.email || p.email === user.email,
            )}
            changeRole={onChangeRole}
            removeUser={onRemoveUser}
            disabled={disabled}
            perms={perms}
          />
        ))}
      </section>
      {sharedModal && (
        <Modal
          open={true}
          onCancel={() => setSharedModal(false)}
          footer={null}
          closable
        >
          <ShareDialogContent
            resource={{ type: "team", resource: team }}
            perms={perms}
            closeDialog={() => setSharedModal(false)}
            reloadPerms={onReload}
            updateResourceCallback={onReload}
          />
        </Modal>
      )}
    </>
  );
}

const TeamMemberList = React.forwardRef(TeamMemberList_);
export default TeamMemberList;
