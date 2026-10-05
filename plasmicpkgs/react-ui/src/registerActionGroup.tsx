import registerComponent, { CodeComponentMeta } from "@plasmicapp/host/registerComponent";
import { ActionGroup as ReactUIActionGroup, ActionGroupProps as ReactUIActionGroupProps, ActionItem } from "@react/ui";
import React, { useEffect, useState } from "react";
import { Popconfirm } from "antd";
import { usePlasmicLink } from "@plasmicapp/host";
export type Registerable = { registerComponent: typeof registerComponent };

export interface ActionGroupItem extends ActionItem {
  href?: string;
  confirm?: { title: string; description?: string; okText: string; cancelText?: string };
}

export interface ActionGroupProps extends Omit<ReactUIActionGroupProps, "items"> {
  items?: (ActionGroupItem | null | false | undefined)[];
  onAction?: (key: string) => void;
}

// The registration event makes item actions editable without putting functions
// in JSON. Rendering, permission filtering and overflow stay in @react/ui.
export function ActionGroup({ items, onAction, dropdownProps, ...props }: ActionGroupProps) {
  const Link = usePlasmicLink();
  const [pendingKey, setPendingKey] = useState<string>();
  const pending = items?.find((item, index) => item && (item.key ?? `action-${index}`) === pendingKey);
  useEffect(() => {
    if (!pending || pending.disabled || !pending.confirm) setPendingKey(undefined);
  }, [pending]);
  const invoke = (item: ActionGroupItem, key: string) => {
    item.onClick?.();
    onAction?.(key);
  };
  const actions = <ReactUIActionGroup {...props} dropdownProps={{ trigger: ["hover"], ...dropdownProps }} items={items?.map((item, index) => item && ({
    ...item,
    label: item.href && !item.disabled ? <Link href={item.href}>{item.label}</Link> : item.label,
    onClick: () => {
      const key = item.key ?? `action-${index}`;
      if (item.confirm) setPendingKey(key);
      else invoke(item, key);
    },
  }))} />;
  if (!items?.some((item) => item && item.confirm)) return actions;
  return <Popconfirm
    open={!!pending && !pending.disabled && !!pending.confirm}
    placement="topRight"
    title={pending ? pending.confirm?.title : undefined}
    description={pending ? pending.confirm?.description : undefined}
    okText={pending ? pending.confirm?.okText : undefined}
    cancelText={pending ? pending.confirm?.cancelText ?? "取消" : "取消"}
    okButtonProps={{ danger: !!pending && pending.danger }}
    onOpenChange={(open) => { if (!open) setPendingKey(undefined); }}
    onCancel={() => setPendingKey(undefined)}
    onConfirm={() => {
      setPendingKey(undefined);
      if (pending && !pending.disabled && pendingKey) invoke(pending, pendingKey);
    }}
  ><div style={{ display: "inline-flex" }}>{actions}</div></Popconfirm>;
}

export const actionGroupMeta: CodeComponentMeta<ActionGroupProps> = {
  name: "plasmic-react-ui-action-group",
  displayName: "ActionGroup",
  section: "React UI",
  description: "@react/ui row actions. Filter permissions before folding; More occupies one of the max positions.",
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
          href: "href",
          disabled: "boolean",
          danger: "boolean",
          tooltip: "string",
          confirm: { type: "object", fields: { title: "string", description: "string", okText: "string", cancelText: "string" } },
        },
      },
      defaultValue: [{ key: "detail", label: "详情" }, { key: "edit", label: "编辑" }],
      description: "Items take precedence over Children. Dynamic arrays may include false/null for permission checks.",
    },
    children: { type: "slot", hidePlaceholder: true },
    max: { type: "number", min: 1, defaultValue: 3 },
    divider: { type: "boolean", defaultValue: false },
    moreText: { type: "string", defaultValue: "更多" },
    moreIcon: { type: "slot", hidePlaceholder: true },
    moreButtonType: { type: "choice", options: ["link", "text", "default", "primary", "dashed"], defaultValue: "link" },
    moreButtonSize: { type: "choice", options: ["small", "medium", "large"], defaultValue: "small" },
    dropdownProps: "object",
    onAction: { type: "eventHandler", argTypes: [{ name: "key", type: "string" }] },
  },
};

export function registerActionGroup(loader?: Registerable) {
  (loader?.registerComponent ?? registerComponent)(ActionGroup, actionGroupMeta);
}
export type { ActionItem };
