import { PlasmicCanvasProps, usePlasmicCanvasContext, usePlasmicCanvasComponentInfo } from "@plasmicapp/host";
import { getCanvasItems, getSelectedCanvasItemKey, renderCanvasSlot } from "./canvas-overlay";
import { Collapse } from "antd";
import React from "react";
import { Registerable, registerComponentHelper } from "./utils";

export const collapseComponentName = "plasmic-antd6-collapse";
export const collapsePanelComponentName = "plasmic-antd6-collapse-item";

type NativeCollapseProps = React.ComponentProps<typeof Collapse>;
type AntdCollapseProps = NativeCollapseProps & PlasmicCanvasProps & {
  headerBackgroundColor?: string;
  expandText?: string;
  collapseText?: string;
};

export function AntdCollapse({
  children,
  styles,
  headerBackgroundColor,
  expandIcon,
  expandText,
  collapseText,
  ...rest
}: AntdCollapseProps) {
  const resolvedStyles: NativeCollapseProps["styles"] = headerBackgroundColor
    ? (info) => {
        const semanticStyles = typeof styles === "function" ? styles(info) : styles;
        return {
          ...semanticStyles,
          header: { ...semanticStyles?.header, backgroundColor: headerBackgroundColor },
        };
      }
    : styles;

  let renderIndicator = expandIcon;
  if (!renderIndicator && (expandText || collapseText)) {
    const expandedLabel = collapseText || "Collapse";
    const collapsedLabel = expandText || "Expand";
    renderIndicator = ({ isActive }) => isActive ? expandedLabel : collapsedLabel;
  }

  if (rest.items !== undefined) {
    const { __canvas: _canvas, ...nativeProps } = rest;
    return (
      <Collapse {...nativeProps} styles={resolvedStyles} expandIcon={renderIndicator}>
        {children}
      </Collapse>
    );
  }

  return renderCanvasSlot(children, (panels) => (
    <CollapseWithChildren {...rest} styles={resolvedStyles} expandIcon={renderIndicator}>
      {panels}
    </CollapseWithChildren>
  ));
}

function CollapseWithChildren(props: NativeCollapseProps & PlasmicCanvasProps) {
  const { children, activeKey, defaultActiveKey, onChange, accordion, __canvas: _canvas, ...rest } = props;
  const canvas = usePlasmicCanvasContext();
  const state = usePlasmicCanvasComponentInfo(props)?.states?.activeKey;
  const panels = getCanvasItems(children, (item) => item.type === AntdCollapsePanel || item.type === Collapse.Panel).filter(React.isValidElement<React.ComponentProps<typeof Collapse.Panel> & PlasmicCanvasProps>);
  const selectedKey = canvas ? getSelectedCanvasItemKey(panels) : undefined;
  const businessKeys = activeKey ?? defaultActiveKey ?? [];
  const revealKeys = selectedKey == null ? undefined : accordion ? String(selectedKey) : Array.from(new Set([...(Array.isArray(businessKeys) ? businessKeys : [businessKeys]), String(selectedKey)]));
  const openKeys = revealKeys === undefined ? activeKey : state ? state.reveal(revealKeys) as typeof activeKey : revealKeys;
  return <Collapse {...rest} accordion={accordion} activeKey={openKeys} defaultActiveKey={defaultActiveKey}
    onChange={state || selectedKey == null ? onChange : undefined}
    items={panels.map((panel, index) => {
      const { header, ref: _ref, __canvas: _selection, ...panelProps } = panel.props;
      return { ...panelProps, key: panel.key ?? String(index), label: header };
    })}
  />;
}

export function AntdCollapsePanel(props: React.ComponentProps<typeof Collapse.Panel>) {
  return <Collapse.Panel {...props} />;
}

export function registerCollapse(loader?: Registerable) {
  registerComponentHelper(loader, AntdCollapse, {
    description: "Expand or collapse labeled content sections, independently or in accordion mode. Keeps section headers available while their content is hidden.",
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
      headerBackgroundColor: {
        type: "color",
        displayName: "Header background color",
        description: "Background color of the entire header row of each panel. Overrides only the backgroundColor in the header semantic styles.",
      },
      styles: {
        type: "object",
        display: "inline",
        displayName: "Semantic styles",
        description: "Configure common CSS properties for each native Ant Design Collapse region.",
        fields: {
          root: {
            type: "object",
            description: "Styles for the Collapse container.",
            fields: {
              maxWidth: { type: "number", min: 0, displayName: "Max width (px)" },
              marginInline: { type: "number", displayName: "Inline margin (px)" },
              backgroundColor: { type: "color" },
              borderColor: { type: "color" },
              borderWidth: { type: "number", min: 0, displayName: "Border width (px)" },
              borderRadius: { type: "number", min: 0, displayName: "Border radius (px)" },
            },
          },
          header: {
            type: "object",
            description: "Styles for the entire header row of each panel. Use Header background color for the fill.",
            fields: {
              paddingInline: { type: "number", min: 0, displayName: "Inline padding (px)" },
              paddingBlock: { type: "number", min: 0, displayName: "Block padding (px)" },
              color: { type: "color", displayName: "Text color" },
            },
          },
          title: {
            type: "object",
            description: "Styles for the title within each header.",
            fields: {
              color: { type: "color", displayName: "Text color" },
              fontSize: { type: "number", min: 0, displayName: "Font size (px)" },
              fontWeight: { type: "number", min: 1, max: 1000 },
            },
          },
          body: {
            type: "object",
            description: "Styles for the content body of each panel.",
            fields: {
              paddingInline: { type: "number", min: 0, displayName: "Inline padding (px)" },
              paddingBlock: { type: "number", min: 0, displayName: "Block padding (px)" },
              backgroundColor: { type: "color" },
              color: { type: "color", displayName: "Text color" },
            },
          },
          icon: {
            type: "object",
            description: "Styles for the expand indicator container.",
            fields: {
              color: { type: "color" },
              fontSize: { type: "number", min: 0, displayName: "Font size (px)" },
              fontWeight: { type: "number", min: 1, max: 1000 },
            },
          },
        },
      },
      size: { type: "choice", options: ["small", "medium", "large"] },
      collapsible: { type: "choice", options: ["header", "icon", "disabled"] },
      expandIconPlacement: {
        type: "choice",
        options: ["start", "end"],
        defaultValueHint: "start",
        description: "Place the expand indicator at the start or end of the header.",
      },
      expandText: {
        type: "string",
        defaultValueHint: "Expand",
        description: "Label for a collapsed panel. Setting either text label enables text indicators when Expand icon is empty.",
      },
      collapseText: {
        type: "string",
        defaultValueHint: "Collapse",
        description: "Label for an expanded panel. Setting either text label enables text indicators when Expand icon is empty.",
      },
      expandIcon: {
        type: "slot",
        displayName: "Expand icon",
        renderPropParams: ["panelProps"],
        hidePlaceholder: true,
        description: "Custom indicator with panelProps.isActive. Takes precedence over the text labels. Keep the content non-interactive so Collapse owns the trigger.",
      },
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
