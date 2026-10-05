import "@plasmicapp/host/registerComponent";
import "@plasmicapp/host/registerGlobalContext";
import { Collapse } from "antd";
import React from "react";
import { r as registerComponentHelper } from "./utils-CSvRw6Za.esm.js";

const collapseComponentName = "plasmic-antd6-collapse";
const collapsePanelComponentName = "plasmic-antd6-collapse-item";
function AntdCollapse(props) {
  return /* @__PURE__ */ React.createElement(Collapse, { ...props });
}
function AntdCollapsePanel(props) {
  return /* @__PURE__ */ React.createElement(Collapse.Panel, { ...props });
}
function registerCollapse(loader) {
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
            collapsible: {
              type: "choice",
              options: ["header", "icon", "disabled"],
            },
          },
          nameFunc: (item) => item.label ?? item.key,
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
        description:
          "Active panel key or array of keys. Use an array to expand multiple panels.",
      },
      children: {
        type: "slot",
        allowedComponents: [collapsePanelComponentName],
        hidePlaceholder: true,
        description:
          "Legacy Collapse.Panel children. Prefer items for new configurations.",
      },
      bordered: { type: "boolean", defaultValueHint: true },
      ghost: "boolean",
      size: { type: "choice", options: ["small", "medium", "large"] },
      collapsible: { type: "choice", options: ["header", "icon", "disabled"] },
      expandIconPlacement: { type: "choice", options: ["start", "end"] },
      destroyOnHidden: "boolean",
      onChange: {
        type: "eventHandler",
        argTypes: [{ name: "activeKey", type: "object" }],
      },
    },
    states: {
      activeKey: {
        type: "writable",
        valueProp: "activeKey",
        onChangeProp: "onChange",
        variableType: "object",
      },
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerCollapse",
    importName: "AntdCollapse",
  });
  registerComponentHelper(loader, AntdCollapsePanel, {
    name: collapsePanelComponentName,
    displayName: "Collapse.Panel",
    description:
      "Legacy Antd panel API; prefer Collapse.items for new configurations.",
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

export {
  AntdCollapse,
  AntdCollapsePanel,
  collapseComponentName,
  collapsePanelComponentName,
  registerCollapse,
};
//# sourceMappingURL=registerCollapse.esm.js.map
