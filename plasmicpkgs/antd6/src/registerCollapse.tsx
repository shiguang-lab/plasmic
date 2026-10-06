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
        displayName: "原生 items 数据",
        advanced: true,
        description: "设置 items 时按 Ant Design 原生规则优先使用该数据。清除 items 后可在内容插槽中编辑富内容；ReactNode 内容也可以通过代码或数据绑定传入。",
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
      },
      activeKey: {
        type: "object",
        editOnly: true,
        uncontrolledProp: "defaultActiveKey",
        description: "Active panel key or array of keys. Use an array to expand multiple panels.",
      },
      children: {
        type: "slot",
        displayName: "折叠面板",
        allowedComponents: [collapsePanelComponentName],
        hidePlaceholder: true,
        hidden: (ps: any) => ps.items != null,
        description: "面板标题和内容支持组件及布局。设置原生 items 数据时该插槽不参与渲染。",
        defaultValue: ["1", "2"].map((key) => ({
          type: "component" as const,
          name: collapsePanelComponentName,
          props: { key, header: `面板 ${key}`, children: `面板 ${key} 内容` },
        })),
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
    description: "折叠面板的标题、内容和附加内容插槽。",
    props: {
      key: { type: "string", displayName: "面板标识", description: "同一 Collapse 中唯一的面板 key。" },
      header: { type: "slot", displayName: "面板标题", defaultValue: "面板标题" },
      children: { type: "slot", displayName: "面板内容", defaultValue: "面板内容" },
      extra: { type: "slot", displayName: "附加内容", hidePlaceholder: true },
      showArrow: { type: "boolean", defaultValueHint: true },
      forceRender: "boolean",
      collapsible: { type: "choice", options: ["header", "icon", "disabled"] },
    },
    parentComponentName: collapseComponentName,
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerCollapse",
    importName: "AntdCollapsePanel",
  });
}
