'use strict';

var jsxRuntime = require('react/jsx-runtime');
var Ant = require('antd');
var cls = require('classnames');
var canvasOverlay$1 = require('./canvas-overlay-D2jWZ-TY.cjs.js');
var utils = require('./utils-B1jTF3MA.cjs.js');
require('@plasmicapp/host');
require('react');
require('@plasmicapp/host/registerComponent');
require('@plasmicapp/host/registerGlobalContext');
require('@shiguang-lab/plasmic-antd6/thumbnails');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var cls__default = /*#__PURE__*/_interopDefault(cls);

const canvasOverlay = { triggerSlot: "children" };
function AntdTooltip(props) {
  const {
    props: canvasProps,
    open,
    isEditing,
    destroyOnHidden
  } = canvasOverlay$1.useCanvasOverlay(props, canvasOverlay.triggerSlot);
  const { popupRootClassName, titleText, classNames, ...rest } = canvasProps;
  return /* @__PURE__ */ jsxRuntime.jsx(
    Ant.Tooltip,
    {
      ...rest,
      open,
      destroyOnHidden,
      onOpenChange: canvasProps.onOpenChange,
      afterOpenChange: isEditing ? void 0 : canvasProps.afterOpenChange,
      classNames: (info) => {
        const names = typeof classNames === "function" ? classNames(info) : classNames;
        return { ...names, root: cls__default.default(names?.root, popupRootClassName) };
      },
      title: props.title === void 0 ? titleText : props.title
    }
  );
}
function registerTooltip(loader) {
  utils.registerComponentHelper(loader, AntdTooltip, {
    name: "plasmic-antd6-tooltip",
    canvasOverlay,
    displayName: "Tooltip",
    isAttachment: true,
    props: {
      open: {
        type: "boolean",
        description: "Controlled open state of the tooltip."
      },
      defaultOpen: {
        type: "boolean",
        description: "Initial open state when open is not controlled."
      },
      onOpenChange: {
        type: "eventHandler",
        argTypes: [{ name: "open", type: "boolean" }]
      },
      children: {
        type: "slot",
        defaultValue: {
          type: "text",
          value: "This text element is wrapped in a Tooltip component"
        },
        mergeWithParent: true
      },
      popupRootClassName: {
        type: "class",
        displayName: "Overlay"
      },
      titleText: {
        type: "string",
        displayName: "Tooltip contents",
        description: "What gets shown inside the tooltip on hover",
        defaultValue: "Tooltip contents"
      },
      trigger: {
        type: "choice",
        options: ["hover", "focus", "click", "contextMenu"],
        multiSelect: true,
        description: "Interactions that reveal the Tooltip.",
        defaultValueHint: ["hover"]
      },
      title: {
        type: "slot",
        displayName: "Tooltip contents",
        hidePlaceholder: true
      },
      color: {
        type: "color",
        description: "Tooltip fill color"
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
          "bottomRight"
        ],
        description: "Default placement of tooltip",
        defaultValueHint: "top"
      }
    },
    states: {
      open: {
        type: "writable",
        valueProp: "open",
        initialValueProp: "defaultOpen",
        onChangeProp: "onOpenChange",
        variableType: "boolean"
      }
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerTooltip",
    importName: "AntdTooltip"
  });
}

exports.AntdTooltip = AntdTooltip;
exports.registerTooltip = registerTooltip;
//# sourceMappingURL=registerTooltip.cjs.js.map
