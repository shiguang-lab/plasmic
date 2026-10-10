import { Matcher } from "@/wab/client/components/view-common";
import { useAppCtx } from "@/wab/client/contexts/AppContexts";
import { useI18n } from "@/wab/client/i18n";
import { DefaultTeamMemberListItemProps } from "@/wab/client/plasmic/plasmic_kit_dashboard/PlasmicTeamMemberListItem";
import { ApiPermission, TeamMember } from "@/wab/shared/ApiSchema";
import { fullName, getUserEmail } from "@/wab/shared/ApiSchemaUtil";
import { GrantableAccessLevel, accessLevelRank } from "@/wab/shared/EntUtil";
import { ensure } from "@/wab/shared/common";
import { MoreOutlined } from "@ant-design/icons";
import {
  Alert,
  Avatar,
  Button,
  Dropdown,
  Flex,
  Select,
  Tooltip,
  Typography,
} from "antd";
import { createStyles } from "antd-style";
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
const roles = [
  { value: "owner", label: "Owner" },
  { value: "editor", label: "Developer" },
  { value: "designer", label: "Designer" },
  { value: "content", label: "Content Creator" },
  { value: "commenter", label: "Commenter" },
  { value: "viewer", label: "Viewer" },
] as const;
const useMemberStyles = createStyles(({ token }) => ({
  root: {
    padding: 16,
    borderBottom: `1px solid ${token.colorBorderSecondary}`,
    color: token.colorText,
  },
  identity: {
    flex: 1,
    minWidth: 180,
    maxWidth: "100%",
    wordBreak: "break-word",
  },
  role: { minWidth: 150 },
  detail: { minWidth: 130 },
}));

const TeamMemberListItem = React.forwardRef<
  HTMLDivElement,
  TeamMemberListItemProps
>(function TeamMemberListItem(
  { user, matcher, perm, changeRole, removeUser, disabled, perms, className },
  ref,
) {
  const selfInfo = ensure(
    useAppCtx().selfInfo,
    "Unexpected undefined selfInfo",
  );
  const { t } = useI18n();
  const { styles, cx } = useMemberStyles();
  const [busy, setBusy] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const selfPerm = perms.find(
    (p) =>
      p.userId === selfInfo.id || (p.user?.email ?? p.email) === selfInfo.email,
  );
  const selfRank = selfPerm ? accessLevelRank(selfPerm.accessLevel) : -1;
  const targetRank = perm ? accessLevelRank(perm.accessLevel) : -1;
  const isSelf =
    user.type === "user"
      ? user.id === selfInfo.id
      : user.email === selfInfo.email;
  const roleValue =
    roles.find((role) => role.value === perm?.accessLevel)?.value ?? "none";
  const canRemove =
    !disabled &&
    perm?.accessLevel !== "owner" &&
    (isSelf || selfRank >= accessLevelRank("editor"));
  const name = user.type === "user" ? fullName(user) : user.email;
  const perform = async (action: () => Promise<void>) => {
    setBusy(true);
    setFailed(false);
    try {
      await action();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={ref} className={cx(styles.root, className)}>
      <Flex align="center" wrap gap={16}>
        <Flex align="center" gap={12} className={styles.identity}>
          <Avatar>{name.charAt(0).toUpperCase()}</Avatar>
          <Flex vertical>
            <Typography.Text strong>
              {matcher.boldSnippets(name)}
            </Typography.Text>
            <Typography.Text type="secondary">
              {matcher.boldSnippets(
                user.type === "user" ? getUserEmail(user) : user.email,
              )}
            </Typography.Text>
          </Flex>
        </Flex>
        <Flex vertical className={styles.detail}>
          <Typography.Text type="secondary">
            {t("Last active")}:{" "}
            {user.type === "user" && user.lastActive
              ? moment(user.lastActive).fromNow()
              : t("Never")}
          </Typography.Text>
          <Typography.Text type="secondary">
            {t("Projects")}:{" "}
            {user.type === "user" ? (user.projectsCreated ?? 0) : 0}
          </Typography.Text>
        </Flex>
        <Tooltip
          title={
            roleValue === "none"
              ? t(
                  "Members without a team role may still have workspace or project permissions and count toward seats.",
                )
              : undefined
          }
        >
          <Select<GrantableAccessLevel | "none">
            className={styles.role}
            aria-label={t("Role for {email}", { email: user.email })}
            value={roleValue}
            disabled={disabled || busy || isSelf || targetRank > selfRank}
            loading={busy}
            options={[
              ...roles
                .filter(
                  (role) =>
                    role.value !== "owner" || selfPerm?.accessLevel === "owner",
                )
                .map((role) => ({ value: role.value, label: t(role.label) })),
              { value: "none", label: t("None") },
            ]}
            onChange={(value) => {
              if (value !== roleValue) {
                void perform(() =>
                  changeRole(user.email, value === "none" ? undefined : value),
                );
              }
            }}
          />
        </Tooltip>
        {canRemove && (
          <Dropdown
            trigger={["click"]}
            menu={{
              items: [
                {
                  key: "remove",
                  label: t(isSelf ? "Remove self" : "Remove member"),
                  danger: true,
                  disabled: busy,
                },
              ],
              onClick: () => {
                void perform(() => removeUser(user.email));
              },
            }}
          >
            <Button
              aria-label={t("Actions for {email}", { email: user.email })}
              icon={<MoreOutlined />}
              disabled={busy}
            />
          </Dropdown>
        )}
      </Flex>
      {failed && (
        <Alert
          type="error"
          showIcon
          title={t("Failed to update team member")}
        />
      )}
    </div>
  );
});
export default TeamMemberListItem;
