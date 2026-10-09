import { UiText } from "@/wab/client/i18n/UiText";
import PublishSpinner from "@/wab/client/components/widgets/PublishSpinner";
import Select from "@/wab/client/components/widgets/Select";
import PP__PermissionItem from "@/wab/client/components/widgets/plasmic/PlasmicPermissionItem";
import { AccessLevel, GrantableAccessLevel } from "@/wab/shared/EntUtil";
import { Tooltip } from "antd";
import React, { ReactNode } from "react";

interface PermissionItemProps {
  email?: ReactNode;
  canEdit?: boolean;
  onGrant: (value: GrantableAccessLevel) => Promise<void>;
  onRevoke: () => Promise<void>;
  accessLevel: AccessLevel;
  showOwnerOption?: boolean;
}

export const contentCreatorTooltip = (
  <Tooltip
    zIndex={200000}
    title="Can edit pages using existing components, and can update CMS content."
  ><UiText message={"Content creator"} /></Tooltip>
);
export const designerTooltip = (
  <Tooltip
    zIndex={200000}
    title="Can update Plasmic designs including all styling and layout. Can create design components."
  ><UiText message={"Designer"} /></Tooltip>
);
export const developerTooltip = (
  <Tooltip zIndex={200000} title="Can update anything including model schemas."><UiText message={"Developer"} /></Tooltip>
);
export const commenterTooltip = (
  <Tooltip zIndex={200000} title="Can view and comment on content."><UiText message={"Commenter"} /></Tooltip>
);
export const viewerTooltip = (
  <Tooltip zIndex={200000} title="Can view content."><UiText message={"Viewer"} /></Tooltip>
);

function PermissionItem(props: PermissionItemProps) {
  const { accessLevel, onGrant, onRevoke, canEdit } = props;
  const [loading, setLoading] = React.useState(false);
  const [temporary, setTemporary] = React.useState("");
  return (
    <PP__PermissionItem
      email={props.email}
      role={props.accessLevel == "owner" ? "owner" : undefined}
      loading={loading}
      roleDropdown={{
        value: temporary || accessLevel,
        "aria-label": `Permission level for ${props.email}`,
        onChange: async (key) => {
          setLoading(true);
          setTemporary(key as GrantableAccessLevel);
          try {
            await onGrant(key as GrantableAccessLevel);
          } catch (e) {
            setTemporary("");
            throw e;
          } finally {
            setLoading(false);
          }
        },
        children: [
          <Select.Option value="viewer">{viewerTooltip}</Select.Option>,
          <Select.Option value="commenter">{commenterTooltip}</Select.Option>,
          <Select.Option value="content">
            {contentCreatorTooltip}
          </Select.Option>,
          <Select.Option value="designer">{designerTooltip}</Select.Option>,
          <Select.Option value="editor">{developerTooltip}</Select.Option>,
          <Select.Option
            value="owner"
            style={props.showOwnerOption ? {} : { display: "none" }}
          ><UiText message={"Owner"} /></Select.Option>,
        ],
        isDisabled: !canEdit || loading,
      }}
      deleteBtn={
        props.accessLevel === "owner" || !canEdit
          ? { render: () => null }
          : {
              onClick: async () => {
                setLoading(true);
                try {
                  await onRevoke();
                } catch (e) {
                  setLoading(false);
                  throw e;
                }
              },
            }
      }
      root={{
        style: {
          flexShrink: 0,
        },
      }}
      spinner={<PublishSpinner />}
    />
  );
}

export default PermissionItem as React.FunctionComponent<PermissionItemProps>;
