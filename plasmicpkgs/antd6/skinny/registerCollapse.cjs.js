'use strict';

var host = require('@plasmicapp/host');
var canvasOverlay = require('./canvas-overlay-x9v6z73H.cjs.js');
var Ant = require('antd');
var React = require('react');
var utils = require('./utils-DDtpTQdQ.cjs.js');
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
        displayName: "\u539F\u751F items \u6570\u636E",
        advanced: true,
        description: "\u8BBE\u7F6E items \u65F6\u6309 Ant Design \u539F\u751F\u89C4\u5219\u4F18\u5148\u4F7F\u7528\u8BE5\u6570\u636E\u3002\u6E05\u9664 items \u540E\u53EF\u5728\u5185\u5BB9\u63D2\u69FD\u4E2D\u7F16\u8F91\u5BCC\u5185\u5BB9\uFF1BReactNode \u5185\u5BB9\u4E5F\u53EF\u4EE5\u901A\u8FC7\u4EE3\u7801\u6216\u6570\u636E\u7ED1\u5B9A\u4F20\u5165\u3002",
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
        displayName: "\u6298\u53E0\u9762\u677F",
        allowedComponents: [collapsePanelComponentName],
        hidePlaceholder: true,
        hidden: (ps) => ps.items != null,
        description: "\u9762\u677F\u6807\u9898\u548C\u5185\u5BB9\u652F\u6301\u7EC4\u4EF6\u53CA\u5E03\u5C40\u3002\u8BBE\u7F6E\u539F\u751F items \u6570\u636E\u65F6\u8BE5\u63D2\u69FD\u4E0D\u53C2\u4E0E\u6E32\u67D3\u3002",
        defaultValue: ["1", "2"].map((key) => ({
          type: "component",
          name: collapsePanelComponentName,
          props: {
            key,
            header: [{ type: "text", value: `\u9762\u677F ${key}` }],
            children: [{ type: "text", value: `\u9762\u677F ${key} \u5185\u5BB9` }]
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
    description: "\u6298\u53E0\u9762\u677F\u7684\u6807\u9898\u3001\u5185\u5BB9\u548C\u9644\u52A0\u5185\u5BB9\u63D2\u69FD\u3002",
    props: {
      key: { type: "string", displayName: "\u9762\u677F\u6807\u8BC6", description: "\u540C\u4E00 Collapse \u4E2D\u552F\u4E00\u7684\u9762\u677F key\u3002" },
      header: { type: "slot", displayName: "\u9762\u677F\u6807\u9898", defaultValue: "\u9762\u677F\u6807\u9898" },
      children: { type: "slot", displayName: "\u9762\u677F\u5185\u5BB9", defaultValue: "\u9762\u677F\u5185\u5BB9" },
      extra: { type: "slot", displayName: "\u9644\u52A0\u5185\u5BB9", hidePlaceholder: true },
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
