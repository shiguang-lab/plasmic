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

function AntdTooltip(props) {
  const {
    props: canvasProps,
    open,
    isEditing,
  } = canvasOverlay.useCanvasOverlay(props, "children");
  const { popupRootClassName, titleText, classNames, ...rest } = canvasProps;
  return /* @__PURE__ */ React__default.default.createElement(Ant.Tooltip, {
    ...rest,
    open,
    destroyOnHidden: isEditing ? true : props.destroyOnHidden,
    onOpenChange: isEditing ? void 0 : props.onOpenChange,
    afterOpenChange: isEditing ? void 0 : props.afterOpenChange,
    classNames: (info) => {
      const names =
        typeof classNames === "function" ? classNames(info) : classNames;
      return {
        ...names,
        root: cls__default.default(names?.root, popupRootClassName),
      };
    },
    title: props.title === void 0 ? titleText : props.title,
  });
}
function registerTooltip(loader) {
  utils.registerComponentHelper(loader, AntdTooltip, {
    name: "plasmic-antd6-tooltip",
    displayName: "Tooltip",
    isAttachment: true,
    props: {
      previewOpen: canvasOverlay.previewOpenProp,
      children: {
        type: "slot",
        defaultValue: {
          type: "text",
          value: "This text element is wrapped in a Tooltip component",
        },
        mergeWithParent: true,
      },
      popupRootClassName: {
        type: "class",
        displayName: "Overlay",
      },
      titleText: {
        type: "string",
        displayName: "Tooltip contents",
        description: "What gets shown inside the tooltip on hover",
        defaultValue: "Tooltip contents",
      },
      title: {
        type: "slot",
        displayName: "Tooltip contents",
        hidePlaceholder: true,
      },
      color: {
        type: "color",
        description: "Tooltip fill color",
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
        description: "Default placement of tooltip",
        defaultValueHint: "top",
      },
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerTooltip",
    importName: "AntdTooltip",
  });
}

exports.AntdTooltip = AntdTooltip;
exports.registerTooltip = registerTooltip;
//# sourceMappingURL=registerTooltip.cjs.js.map
