import registerComponent, {
  CodeComponentMeta,
} from "@plasmicapp/host/registerComponent";
import {
  ActionItem,
  ActionGroup as ReactUIActionGroup,
  ActionGroupProps as ReactUIActionGroupProps,
} from "@react/ui";
import React from "react";
export type Registerable = { registerComponent: typeof registerComponent };

export interface ActionGroupProps extends Omit<
  ReactUIActionGroupProps,
  "items"
> {
  items?: (ActionItem | null | false | undefined)[];
  onAction?: (key: string) => void;
}

// Studio cannot store item onClick functions in JSON, so one registration event
// receives the clicked key. Rendering, permission filtering, folding and the
// More dropdown defaults stay in @react/ui.
export function ActionGroup({ items, onAction, ...props }: ActionGroupProps) {
  return (
    <ReactUIActionGroup
      {...props}
      items={items?.map(
        (item, index) =>
          item && {
            ...item,
            onClick: () => {
              item.onClick?.();
              onAction?.(item.key ?? `action-${index}`);
            },
          },
      )}
    />
  );
}

export const actionGroupMeta: CodeComponentMeta<ActionGroupProps> = {
  name: "plasmic-react-ui-action-group",
  displayName: "ActionGroup",
  section: "React UI",
  description:
    "@react/ui row actions. Filter permissions before folding; More occupies one of the max positions.",
  importPath: "@shiguang-lab/plasmic-react-ui/skinny/registerActionGroup",
  importName: "ActionGroup",
  props: {
    items: {
      type: "array",
      itemType: {
        type: "object",
        fields: {
          key: "string",
          label: "string",
          disabled: "boolean",
          danger: "boolean",
          tooltip: "string",
        },
      },
      defaultValue: [
        { key: "detail", label: "详情" },
        { key: "edit", label: "编辑" },
      ],
      description:
        "Items take precedence over Children. Dynamic arrays may include false/null for permission checks.",
    },
    children: { type: "slot", hidePlaceholder: true },
    max: { type: "number", min: 1, defaultValue: 3 },
    divider: { type: "boolean", defaultValue: false },
    moreText: { type: "string", defaultValue: "更多" },
    moreIcon: { type: "slot", hidePlaceholder: true },
    moreButtonType: {
      type: "choice",
      options: ["link", "text", "default", "primary", "dashed"],
      defaultValue: "link",
    },
    moreButtonSize: {
      type: "choice",
      options: ["small", "medium", "large"],
      defaultValue: "small",
    },
    dropdownProps: {
      type: "object",
      description:
        "Native Ant Design Dropdown props for More, except menu. @react/ui defaults to trigger ['click'] and placement bottomRight.",
    },
    onAction: {
      type: "eventHandler",
      argTypes: [{ name: "key", type: "string" }],
      description:
        "Fires with the clicked item key, for visible and folded items alike.",
    },
  },
};

export function registerActionGroup(loader?: Registerable) {
  (loader?.registerComponent ?? registerComponent)(
    ActionGroup,
    actionGroupMeta,
  );
}
export type { ActionItem };
