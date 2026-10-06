import { usePlasmicCanvasContext } from "@plasmicapp/host";
import { getCanvasItems, getSelectedCanvasItemKey, renderCanvasSlot } from "./canvas-overlay";
import { Collapse } from "antd";
import React from "react";
import { Registerable, registerComponentHelper } from "./utils";

export const collapseComponentName = "plasmic-antd6-collapse";
export const collapsePanelComponentName = "plasmic-antd6-collapse-item";

export function AntdCollapse(props: React.ComponentProps<typeof Collapse>) {
  return props.items !== undefined ? <Collapse {...props} /> : renderCanvasSlot(props.children, (children) => <CollapseWithChildren {...props} children={children} />);
}

function CollapseWithChildren({ children, activeKey, defaultActiveKey, onChange, accordion, ...rest }: React.ComponentProps<typeof Collapse>) {
  const canvas = usePlasmicCanvasContext();
  const panels = getCanvasItems(children, (item) => item.type === AntdCollapsePanel || item.type === Collapse.Panel);
  const selectedKey = canvas && !canvas.interactive ? getSelectedCanvasItemKey(panels) : undefined;
  const businessKeys = activeKey ?? defaultActiveKey ?? [];
  const openKeys = selectedKey == null ? activeKey : accordion ? String(selectedKey) : Array.from(new Set([...(Array.isArray(businessKeys) ? businessKeys : [businessKeys]), String(selectedKey)]));
  return <Collapse {...rest} key={selectedKey == null ? "business" : "canvas-reveal"} accordion={accordion} activeKey={openKeys} defaultActiveKey={defaultActiveKey}
    onChange={selectedKey == null ? onChange : undefined}
    items={panels.map((panel, index) => {
      const { header, __plasmic_selection_prop__: _selection, ...props } = panel.props;
      return { ...props, key: panel.key ?? String(index), label: header };
    })}
  />;
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
        displayName: "Items",
        advanced: true,
        description: "Items take precedence, as in Ant Design. Clear items to edit rich content in the children slot. ReactNode content can also be supplied through code or data binding.",
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
        displayName: "Panels",
        allowedComponents: [collapsePanelComponentName],
        hidePlaceholder: true,
        hidden: (ps: any) => ps.items != null,
        description: "Panel headers and content support components and layouts. This slot is not rendered when items are set.",
        defaultValue: ["1", "2"].map((key) => ({
          type: "component" as const,
          name: collapsePanelComponentName,
          props: {
            key,
            header: [{ type: "text" as const, value: `Panel ${key}` }],
            children: [{ type: "text" as const, value: `Panel ${key} content` }],
          },
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
    description: "Header, content, and extra slots for a collapse panel.",
    props: {
      key: { type: "string", displayName: "Key", description: "A unique panel key within this Collapse." },
      header: { type: "slot", displayName: "Header", defaultValue: "Header" },
      children: { type: "slot", displayName: "Content", defaultValue: "Content" },
      extra: { type: "slot", displayName: "Extra", hidePlaceholder: true },
      showArrow: { type: "boolean", defaultValueHint: true },
      forceRender: "boolean",
      collapsible: { type: "choice", options: ["header", "icon", "disabled"] },
    },
    parentComponentName: collapseComponentName,
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerCollapse",
    importName: "AntdCollapsePanel",
  });
}
