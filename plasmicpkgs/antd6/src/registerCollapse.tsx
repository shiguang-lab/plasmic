import { Collapse } from "antd";
import React from "react";
import { Registerable, registerComponentHelper } from "./utils";

export const collapseComponentName = "plasmic-antd6-collapse";
export const collapsePanelComponentName = "plasmic-antd6-collapse-item";

export function AntdCollapse(props: React.ComponentProps<typeof Collapse>) {
  return <Collapse {...props} />;
}

export function AntdCollapsePanel(props: React.ComponentProps<typeof Collapse.Panel>) {
  return <Collapse.Panel {...props} />;
}

export function registerCollapse(loader?: Registerable) {
  registerComponentHelper(loader, AntdCollapse, {
    name: collapseComponentName,
    displayName: "Collapse",
    defaultStyles: { width: "stretch" },
    props: {
      accordion: { type: "boolean", defaultValueHint: false },
      items: {
        type: "array",
        itemType: {
          type: "object",
          fields: {
            key: "string",
            label: "string",
            children: "string",
            extra: "string",
            showArrow: "boolean",
            forceRender: "boolean",
            collapsible: { type: "choice", options: ["header", "icon", "disabled"] },
          },
          nameFunc: (item: any) => item.label ?? item.key,
        },
        defaultValue: [
          { key: "1", label: "First panel", children: "First panel content" },
          { key: "2", label: "Second panel", children: "Second panel content" },
        ],
      },
      activeKey: {
        type: "object",
        editOnly: true,
        uncontrolledProp: "defaultActiveKey",
        description: "Active panel key or array of keys. Use an array to expand multiple panels.",
      },
      children: {
        type: "slot",
        allowedComponents: [collapsePanelComponentName],
        hidePlaceholder: true,
        description: "Legacy Collapse.Panel children. Prefer items for new configurations.",
      },
      bordered: { type: "boolean", defaultValueHint: true },
      ghost: "boolean",
      size: { type: "choice", options: ["small", "medium", "large"] },
      collapsible: { type: "choice", options: ["header", "icon", "disabled"] },
      expandIconPlacement: { type: "choice", options: ["start", "end"] },
      destroyOnHidden: "boolean",
      onChange: { type: "eventHandler", argTypes: [{ name: "activeKey", type: "object" }] },
    },
    states: {
      activeKey: { type: "writable", valueProp: "activeKey", onChangeProp: "onChange", variableType: "object" },
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerCollapse",
    importName: "AntdCollapse",
  });
  registerComponentHelper(loader, AntdCollapsePanel, {
    name: collapsePanelComponentName,
    displayName: "Collapse.Panel",
    description: "Legacy Antd panel API; prefer Collapse.items for new configurations.",
    props: {
      header: { type: "slot", defaultValue: "Panel header" },
      children: { type: "slot", defaultValue: "Panel content" },
      extra: { type: "slot", hidePlaceholder: true },
      showArrow: { type: "boolean", defaultValueHint: true },
      forceRender: "boolean",
      collapsible: { type: "choice", options: ["header", "icon", "disabled"] },
    },
    parentComponentName: collapseComponentName,
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerCollapse",
    importName: "AntdCollapsePanel",
  });
}
