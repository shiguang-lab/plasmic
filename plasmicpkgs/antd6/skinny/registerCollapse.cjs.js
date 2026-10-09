'use strict';

var host = require('@plasmicapp/host');
var canvasOverlay = require('./canvas-overlay-BCQmyJjQ.cjs.js');
var Ant = require('antd');
var React = require('react');
var utils = require('./utils-DlS9-CF8.cjs.js');
require('@plasmicapp/host/registerComponent');
require('@plasmicapp/host/registerGlobalContext');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var React__default = /*#__PURE__*/_interopDefault(React);

const collapseComponentName = "plasmic-antd6-collapse";
const collapsePanelComponentName = "plasmic-antd6-collapse-item";
function AntdCollapse(props) {
  return props.items !== void 0 ? /* @__PURE__ */ React__default.default.createElement(Ant.Collapse, { ...props }) : canvasOverlay.renderCanvasSlot(props.children, (children) => /* @__PURE__ */ React__default.default.createElement(CollapseWithChildren, { ...props, children }));
}
function CollapseWithChildren({ children, activeKey, defaultActiveKey, onChange, accordion, ...rest }) {
  const canvas = host.usePlasmicCanvasContext();
  const panels = canvasOverlay.getCanvasItems(children, (item) => item.type === AntdCollapsePanel || item.type === Ant.Collapse.Panel);
  const selectedKey = canvas && !canvas.interactive ? canvasOverlay.getSelectedCanvasItemKey(panels) : void 0;
  const businessKeys = activeKey ?? defaultActiveKey ?? [];
  const openKeys = selectedKey == null ? activeKey : accordion ? String(selectedKey) : Array.from(/* @__PURE__ */ new Set([...Array.isArray(businessKeys) ? businessKeys : [businessKeys], String(selectedKey)]));
  return /* @__PURE__ */ React__default.default.createElement(
    Ant.Collapse,
    {
      ...rest,
      key: selectedKey == null ? "business" : "canvas-reveal",
      accordion,
      activeKey: openKeys,
      defaultActiveKey,
      onChange: selectedKey == null ? onChange : void 0,
      items: panels.map((panel, index) => {
        const { header, __plasmic_selection_prop__: _selection, ...props } = panel.props;
        return { ...props, key: panel.key ?? String(index), label: header };
      })
    }
  );
}
function AntdCollapsePanel(props) {
  return /* @__PURE__ */ React__default.default.createElement(Ant.Collapse.Panel, { ...props });
}
function registerCollapse(loader) {
  utils.registerComponentHelper(loader, AntdCollapse, {
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
            collapsible: { type: "choice", options: ["header", "icon", "disabled"] }
          },
          nameFunc: (item) => item.label ?? item.key
        }
      },
      activeKey: {
        type: "object",
        editOnly: true,
        uncontrolledProp: "defaultActiveKey",
        description: "Active panel key or array of keys. Use an array to expand multiple panels."
      },
      children: {
        type: "slot",
        displayName: "Panels",
        allowedComponents: [collapsePanelComponentName],
        hidePlaceholder: true,
        hidden: (ps) => ps.items != null,
        description: "Panel headers and content support components and layouts. This slot is not rendered when items are set.",
        defaultValue: ["1", "2"].map((key) => ({
          type: "component",
          name: collapsePanelComponentName,
          props: {
            key,
            header: [{ type: "text", value: `Panel ${key}` }],
            children: [{ type: "text", value: `Panel ${key} content` }]
          }
        }))
      },
      bordered: { type: "boolean", defaultValueHint: true },
      ghost: "boolean",
      size: { type: "choice", options: ["small", "medium", "large"] },
      collapsible: { type: "choice", options: ["header", "icon", "disabled"] },
      expandIconPlacement: { type: "choice", options: ["start", "end"] },
      destroyOnHidden: "boolean",
      onChange: { type: "eventHandler", argTypes: [{ name: "activeKey", type: "object" }] }
    },
    states: {
      activeKey: { type: "writable", valueProp: "activeKey", onChangeProp: "onChange", variableType: "object" }
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerCollapse",
    importName: "AntdCollapse"
  });
  utils.registerComponentHelper(loader, AntdCollapsePanel, {
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
      collapsible: { type: "choice", options: ["header", "icon", "disabled"] }
    },
    parentComponentName: collapseComponentName,
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerCollapse",
    importName: "AntdCollapsePanel"
  });
}

exports.AntdCollapse = AntdCollapse;
exports.AntdCollapsePanel = AntdCollapsePanel;
exports.collapseComponentName = collapseComponentName;
exports.collapsePanelComponentName = collapsePanelComponentName;
exports.registerCollapse = registerCollapse;
//# sourceMappingURL=registerCollapse.cjs.js.map
