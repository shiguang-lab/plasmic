import registerComponent from '@plasmicapp/host/registerComponent';
import { ActionGroup as ActionGroup$1 } from '@react/ui';
import React, { useState, useEffect } from 'react';
import { Popconfirm } from 'antd';
import { usePlasmicLink } from '@plasmicapp/host';

function ActionGroup({ items, onAction, dropdownProps, ...props }) {
  const Link = usePlasmicLink();
  const [pendingKey, setPendingKey] = useState();
  const pending = items?.find((item, index) => item && (item.key ?? `action-${index}`) === pendingKey);
  useEffect(() => {
    if (!pending || pending.disabled || !pending.confirm) setPendingKey(void 0);
  }, [pending]);
  const invoke = (item, key) => {
    item.onClick?.();
    onAction?.(key);
  };
  const actions = /* @__PURE__ */ React.createElement(ActionGroup$1, { ...props, dropdownProps: { trigger: ["hover"], ...dropdownProps }, items: items?.map((item, index) => item && {
    ...item,
    label: item.href && !item.disabled ? /* @__PURE__ */ React.createElement(Link, { href: item.href }, item.label) : item.label,
    onClick: () => {
      const key = item.key ?? `action-${index}`;
      if (item.confirm) setPendingKey(key);
      else invoke(item, key);
    }
  }) });
  if (!items?.some((item) => item && item.confirm)) return actions;
  return /* @__PURE__ */ React.createElement(
    Popconfirm,
    {
      open: !!pending && !pending.disabled && !!pending.confirm,
      placement: "topRight",
      title: pending ? pending.confirm?.title : void 0,
      description: pending ? pending.confirm?.description : void 0,
      okText: pending ? pending.confirm?.okText : void 0,
      cancelText: pending ? pending.confirm?.cancelText ?? "\u53D6\u6D88" : "\u53D6\u6D88",
      okButtonProps: { danger: !!pending && pending.danger },
      onOpenChange: (open) => {
        if (!open) setPendingKey(void 0);
      },
      onCancel: () => setPendingKey(void 0),
      onConfirm: () => {
        setPendingKey(void 0);
        if (pending && !pending.disabled && pendingKey) invoke(pending, pendingKey);
      }
    },
    /* @__PURE__ */ React.createElement("div", { style: { display: "inline-flex" } }, actions)
  );
}
const actionGroupMeta = {
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
          confirm: { type: "object", fields: { title: "string", description: "string", okText: "string", cancelText: "string" } }
        }
      },
      defaultValue: [{ key: "detail", label: "\u8BE6\u60C5" }, { key: "edit", label: "\u7F16\u8F91" }],
      description: "Items take precedence over Children. Dynamic arrays may include false/null for permission checks."
    },
    children: { type: "slot", hidePlaceholder: true },
    max: { type: "number", min: 1, defaultValue: 3 },
    divider: { type: "boolean", defaultValue: false },
    moreText: { type: "string", defaultValue: "\u66F4\u591A" },
    moreIcon: { type: "slot", hidePlaceholder: true },
    moreButtonType: { type: "choice", options: ["link", "text", "default", "primary", "dashed"], defaultValue: "link" },
    moreButtonSize: { type: "choice", options: ["small", "medium", "large"], defaultValue: "small" },
    dropdownProps: "object",
    onAction: { type: "eventHandler", argTypes: [{ name: "key", type: "string" }] }
  }
};
function registerActionGroup(loader) {
  (loader?.registerComponent ?? registerComponent)(ActionGroup, actionGroupMeta);
}

export { ActionGroup, actionGroupMeta, registerActionGroup };
//# sourceMappingURL=registerActionGroup.esm.js.map
