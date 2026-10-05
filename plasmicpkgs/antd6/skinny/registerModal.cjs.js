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

const styleSections = [
  "visibility",
  "typography",
  "spacing",
  "background",
  "transform",
  "transitions",
  "layout",
  "overflow",
  "border",
  "shadows",
  "effects",
];
function AntdModal(props) {
  const {
    props: canvasProps,
    open,
    isEditing,
  } = canvasOverlay.useCanvasOverlay(props, "trigger");
  const {
    onOpenChange,
    onOk,
    onCancel,
    width,
    footer,
    hideFooter,
    modalScopeClassName,
    wrapClassName,
    trigger,
    mask,
    closeOnOutsideClick,
    defaultStylesClassName,
    ...rest
  } = canvasProps;
  const memoOnCancel = React__default.default.useMemo(() => {
    if (onOpenChange || onCancel) {
      return (e) => {
        onOpenChange?.(false);
        onCancel?.(e);
      };
    } else {
      return void 0;
    }
  }, [onOpenChange, onCancel]);
  const widthProp = React.useMemo(() => {
    if (typeof width === "string" && /^\d+$/.test(width)) {
      return +width;
    }
    return width;
  }, [width]);
  return /* @__PURE__ */ React__default.default.createElement(
    React__default.default.Fragment,
    null,
    /* @__PURE__ */ React__default.default.createElement(Ant.Modal, {
      ...rest,
      mask:
        closeOnOutsideClick === void 0 || mask === false
          ? mask
          : {
              ...(typeof mask === "object" ? mask : {}),
              closable: closeOnOutsideClick,
            },
      onOk: isEditing ? void 0 : onOk,
      width: widthProp,
      onCancel: isEditing ? void 0 : memoOnCancel,
      afterOpenChange: isEditing ? void 0 : props.afterOpenChange,
      afterClose: isEditing ? void 0 : props.afterClose,
      open,
      destroyOnHidden: isEditing ? true : props.destroyOnHidden,
      forceRender: isEditing ? false : props.forceRender,
      focusable: isEditing
        ? { trap: false, focusTriggerAfterClose: false }
        : props.focusable,
      footer: hideFooter ? null : footer,
      wrapClassName,
      className: cls__default.default(
        props.className,
        defaultStylesClassName,
        modalScopeClassName,
      ),
    }),
    trigger
      ? /* @__PURE__ */ React__default.default.createElement(
          "div",
          { onClick: isEditing ? void 0 : () => onOpenChange?.(true) },
          trigger,
        )
      : null,
  );
}
function registerModal(loader) {
  utils.registerComponentHelper(loader, AntdModal, {
    name: "plasmic-antd6-modal",
    displayName: "Modal",
    styleSections,
    description:
      "[See tutorial video](https://www.youtube.com/watch?v=TkjxNJIFun8)",
    props: {
      previewOpen: canvasOverlay.previewOpenProp,
      open: {
        type: "boolean",
      },
      mask: { type: "object" },
      destroyOnHidden: { type: "boolean" },
      width: {
        type: "string",
        defaultValueHint: "520px",
        description: "Change the width of the modal",
        helpText:
          "Default unit is px. You can also use % or other units for width.",
      },
      children: {
        type: "slot",
        defaultValue: {
          type: "vbox",
          children: ["Modal content"],
        },
      },
      title: {
        type: "slot",
        defaultValue: "Modal title",
      },
      footer: {
        type: "slot",
        hidePlaceholder: true,
        hidden: (ps) => ps.hideFooter ?? false,
      },
      trigger: {
        type: "slot",
        hidePlaceholder: true,
        defaultValue: {
          type: "component",
          name: "plasmic-antd6-button",
          props: {
            children: {
              type: "text",
              value: "Show modal",
            },
          },
        },
        ...{
          mergeWithParent: true,
        },
      },
      closeIcon: {
        type: "slot",
        hidePlaceholder: true,
      },
      onOk: {
        type: "eventHandler",
        argTypes: [],
        description:
          "Validate and save, then explicitly close the modal after success. Clicking OK does not change open automatically.",
      },
      onCancel: {
        type: "eventHandler",
        argTypes: [],
      },
      okText: {
        type: "string",
        hidden: (ps) => !!ps.footer,
        advanced: true,
      },
      cancelText: {
        type: "string",
        hidden: (ps) => !!ps.footer,
        advanced: true,
      },
      hideFooter: {
        type: "boolean",
        description: "Hide the modal footer slot",
        advanced: true,
      },
      onOpenChange: {
        type: "eventHandler",
        argTypes: [{ name: "open", type: "boolean" }],
      },
      closeOnOutsideClick: {
        type: "boolean",
        displayName: "Close modal on outside click?",
        description:
          "Whether to close the modal when user clicks outside the modal",
        defaultValueHint: true,
      },
      wrapClassName: {
        type: "class",
        displayName: "Modal overlay",
        styleSections: ["background"],
      },
      modalScopeClassName: {
        type: "styleScopeClass",
        scopeName: "modal",
      },
      modalContentClassName: {
        type: "class",
        displayName: "Modal content",
        noSelf: true,
        styleSections,
        selectors: [
          {
            selector: ":modal .ant-modal-container",
            label: "Base",
          },
        ],
      },
      closeButtonClassName: {
        type: "class",
        displayName: "Close button",
        noSelf: true,
        selectors: [
          {
            selector: ":modal .ant-modal-close",
            label: "Base",
          },
        ],
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
    templates: {
      "Modal Form": {
        props: {
          children: {
            type: "component",
            name: "plasmic-antd6-form",
          },
          hideFooter: true,
        },
      },
      "Generic Modal": {},
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerModal",
    importName: "AntdModal",
  });
}

exports.AntdModal = AntdModal;
exports.registerModal = registerModal;
//# sourceMappingURL=registerModal.cjs.js.map
