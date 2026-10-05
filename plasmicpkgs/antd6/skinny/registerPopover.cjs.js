"use strict";

var Ant = require("antd");
var cls = require("classnames");
var React = require("react");
var canvasOverlay = require("./canvas-overlay-S34meFm4.cjs.js");
var utils = require("./utils-CRCm44nj.cjs.js");
require("@plasmicapp/host");
require("@plasmicapp/host/registerComponent");
require("@plasmicapp/host/registerGlobalContext");

function _interopDefault(e) {
  return e && e.__esModule ? e : { default: e };
}

var cls__default = /*#__PURE__*/ _interopDefault(cls);
var React__default = /*#__PURE__*/ _interopDefault(React);

function AntdPopover(props) {
  const {
    props: canvasProps,
    open,
    isEditing,
  } = canvasOverlay.useCanvasOverlay(props, "children");
  const {
    popupRootClassName,
    popoverScopeClassName,
    defaultStylesClassName,
    contentText,
    content,
    classNames,
    ...rest
  } = canvasProps;
  return /* @__PURE__ */ React__default.default.createElement(Ant.Popover, {
    content: content === void 0 ? contentText : content,
    classNames: (info) => {
      const names =
        typeof classNames === "function" ? classNames(info) : classNames;
      return {
        ...names,
        root: cls__default.default(
          names?.root,
          popupRootClassName,
          popoverScopeClassName,
          defaultStylesClassName,
        ),
      };
    },
    ...rest,
    open,
    destroyOnHidden: isEditing ? true : props.destroyOnHidden,
    onOpenChange: isEditing ? void 0 : props.onOpenChange,
    afterOpenChange: isEditing ? void 0 : props.afterOpenChange,
  });
}
function registerPopover(loader) {
  utils.registerComponentHelper(loader, AntdPopover, {
    name: "plasmic-antd6-popover",
    displayName: "Popover",
    isAttachment: true,
    props: {
      previewOpen: canvasOverlay.previewOpenProp,
      open: {
        type: "boolean",
        editOnly: true,
        uncontrolledProp: "defaultOpen",
        description: "Default open state of the popover",
      },
      arrow: {
        type: "boolean",
        defaultValue: true,
        advanced: true,
      },
      children: {
        type: "slot",
        defaultValue: "This text element is wrapped in a Popover component",
        mergeWithParent: true,
      },
      popoverScopeClassName: {
        type: "styleScopeClass",
        scopeName: "popover",
      },
      popoverContentClassName: {
        type: "class",
        displayName: "Popover content",
        selectors: [
          {
            selector: ":popover.ant-popover .ant-popover-container",
            label: "Base",
          },
        ],
      },
      popupRootClassName: {
        type: "class",
        displayName: "Overlay",
      },
      content: {
        type: "slot",
        displayName: "Popover contents",
        defaultValue: "Popover contents",
        hidePlaceholder: true,
      },
      /**
       *  NOTE: contentText ensures that the popover shows as a custom behaviour without modifications
       * (when a random element is given a custom behaviour of Popover, the props of type "slot" do not receive any default value.
       * Therefore we use the contentText which has a string default value, so that the popover shows with at least something)
       *  */
      contentText: {
        type: "string",
        displayName: "Popover contents",
        description: "What gets shown inside the popover on hover",
        defaultValue: "Popover contents",
        hidden: (ps) => !!ps.content,
      },
      title: {
        type: "slot",
        displayName: "Popover title",
        hidePlaceholder: true,
        defaultValue: "Popover title",
      },
      color: {
        type: "color",
        description: "Popover fill color",
      },
      trigger: {
        type: "choice",
        options: ["hover", "focus", "click"],
        defaultValueHint: "hover",
        advanced: true,
      },
      placement: {
        type: "choice",
        options: [
          "topLeft",
          "top",
          "topRight",
          "leftTop",
          "left",
          "leftBottom",
          "rightTop",
          "right",
          "rightBottom",
          "bottomLeft",
          "bottom",
          "bottomRight",
        ],
        description: "Default placement of popover",
        defaultValueHint: "top",
      },
      mouseEnterDelay: {
        type: "number",
        description: "Delay in seconds, before popover is shown on mouse enter",
        defaultValueHint: 0.1,
        advanced: true,
        hidden: (ps) => (ps.trigger ? ps.trigger !== "hover" : false),
      },
      mouseLeaveDelay: {
        type: "number",
        description:
          "Delay in seconds, before popover is hidden on mouse leave",
        defaultValueHint: 0.1,
        advanced: true,
        hidden: (ps) => (ps.trigger ? ps.trigger !== "hover" : false),
      },
      onOpenChange: {
        type: "eventHandler",
        argTypes: [{ name: "open", type: "boolean" }],
        advanced: true,
      },
      defaultStylesClassName: {
        type: "themeResetClass",
      },
    },
    states: {
      open: {
        type: "writable",
        valueProp: "open",
        onChangeProp: "onOpenChange",
        variableType: "boolean",
      },
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerPopover",
    importName: "AntdPopover",
  });
}

exports.AntdPopover = AntdPopover;
exports.registerPopover = registerPopover;
//# sourceMappingURL=registerPopover.cjs.js.map
