import { useI18n } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import type { MessageKey } from "@/wab/client/i18n/locales";
import { AccessLevel, GrantableAccessLevel } from "@/wab/shared/EntUtil";
import { DeleteOutlined } from "@ant-design/icons";
import { Avatar, Button, Select, Tooltip, message } from "antd";
import { createStyles } from "antd-style";
import React, { ReactNode } from "react";

interface PermissionItemProps {
  email?: ReactNode;
  canEdit?: boolean;
  name?: string;
  isSelf?: boolean;
  description?: ReactNode;
  onGrant: (value: GrantableAccessLevel) => Promise<void>;
  onRevoke: () => Promise<void>;
  accessLevel: AccessLevel;
  showOwnerOption?: boolean;
}

// The labels are wrapped in spans: tooltips anchor through a DOM ref, and
// `UiText` renders bare text.
export const contentCreatorTooltip = (
  <Tooltip
    zIndex={200000}
    title={
      <UiText
        message={
          "Can edit pages using existing components, and can update CMS content."
        }
      />
    }
  >
    <span>
      <UiText message={"Content creator"} />
    </span>
  </Tooltip>
);
export const designerTooltip = (
  <Tooltip
    zIndex={200000}
    title={
      <UiText
        message={
          "Can update Plasmic designs including all styling and layout. Can create design components."
        }
      />
    }
  >
    <span>
      <UiText message={"Designer"} />
    </span>
  </Tooltip>
);
export const developerTooltip = (
  <Tooltip
    zIndex={200000}
    title={<UiText message={"Can update anything including model schemas."} />}
  >
    <span>
      <UiText message={"Developer"} />
    </span>
  </Tooltip>
);
export const commenterTooltip = (
  <Tooltip
    zIndex={200000}
    title={<UiText message={"Can view and comment on content."} />}
  >
    <span>
      <UiText message={"Commenter"} />
    </span>
  </Tooltip>
);
export const viewerTooltip = (
  <Tooltip zIndex={200000} title={<UiText message={"Can view content."} />}>
    <span>
      <UiText message={"Viewer"} />
    </span>
  </Tooltip>
);

export const permissionRoles = [
  ["viewer", "Viewer"],
  ["commenter", "Commenter"],
  ["content", "Content creator"],
  ["designer", "Designer"],
  ["editor", "Developer"],
] as const;
export const permissionDescriptions: Record<GrantableAccessLevel, MessageKey> =
  {
    viewer: "Can view content.",
    commenter: "Can view and comment on content.",
    content:
      "Can edit pages using existing components, and can update CMS content.",
    designer:
      "Can update Plasmic designs including all styling and layout. Can create design components.",
    editor: "Can update anything including model schemas.",
    owner: "Owner",
  };
const useStyles = createStyles(({ token }) => ({
  row: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 0",
    minWidth: 0,
    flexWrap: "wrap",
  },
  identity: { flex: "1 1 120px", minWidth: 0, overflowWrap: "anywhere" },
  secondary: { color: token.colorTextSecondary, fontSize: 12, marginTop: 2 },
  actions: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    marginLeft: "auto",
    "& .ant-select": { width: 120 },
  },
  avatar: {
    background: token.colorFillSecondary,
    color: token.colorTextSecondary,
    flexShrink: 0,
  },
}));

function PermissionItem(props: PermissionItemProps) {
  const { t } = useI18n();
  const { styles } = useStyles();
  const {
    accessLevel,
    canEdit,
    email,
    name,
    isSelf,
    description,
    onGrant,
    onRevoke,
  } = props;
  const [loading, setLoading] = React.useState(false);
  const options = permissionRoles.map(([value, label]) => ({
    value,
    label: t(label),
  }));
  return (
    <div className={styles.row}>
      <Avatar className={styles.avatar}>
        {(name || String(email)).slice(0, 1).toUpperCase()}
      </Avatar>
      <div className={styles.identity}>
        <div>
          {name || email}
          {isSelf && <span className={styles.secondary}> {t("(you)")}</span>}
        </div>
        {name && <div className={styles.secondary}>{email}</div>}
        {description && !isSelf && (
          <div className={styles.secondary}>{description}</div>
        )}
      </div>
      <div className={styles.actions}>
        {accessLevel === "owner" ? (
          <span className={styles.secondary}>{t("Owner")}</span>
        ) : (
          <>
            <Select
              aria-label={t("Permission level for {part1}", {
                part1: String(email),
              })}
              value={accessLevel === "blocked" ? undefined : accessLevel}
              disabled={!canEdit || loading}
              loading={loading}
              options={
                props.showOwnerOption
                  ? [...options, { value: "owner", label: t("Owner") }]
                  : options
              }
              onChange={async (value: GrantableAccessLevel) => {
                setLoading(true);
                try {
                  await onGrant(value);
                } catch {
                  void message.error({
                    content: t("Failed to update permissions"),
                  });
                } finally {
                  setLoading(false);
                }
              }}
            />
            {canEdit && (
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                aria-label={t("Remove direct permission for {email}", {
                  email: String(email),
                })}
                disabled={loading}
                onClick={async () => {
                  setLoading(true);
                  try {
                    await onRevoke();
                  } catch {
                    void message.error({
                      content: t("Failed to update permissions"),
                    });
                  } finally {
                    setLoading(false);
                  }
                }}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default PermissionItem;
