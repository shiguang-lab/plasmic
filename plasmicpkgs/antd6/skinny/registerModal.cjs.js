'use strict';

var Ant = require('antd');
var cls = require('classnames');
var React = require('react');
var lodash = require('lodash');
var registerButton = require('./registerButton.cjs.js');
var canvasOverlay$1 = require('./canvas-overlay-CK330rTr.cjs.js');
var utils = require('./utils-Diqr9Iet.cjs.js');
require('./names-DbJduus8.cjs.js');
require('@plasmicapp/host');
require('@plasmicapp/host/registerComponent');
require('@plasmicapp/host/registerGlobalContext');
require('@shiguang-lab/plasmic-antd6/thumbnails');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var cls__default = /*#__PURE__*/_interopDefault(cls);
var React__default = /*#__PURE__*/_interopDefault(React);

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
  "effects"
];
const canvasOverlay = { triggerSlot: "trigger" };
function AntdModal(props) {
  const {
    props: canvasProps,
    open,
    isEditing,
    destroyOnHidden
  } = canvasOverlay$1.useCanvasOverlay(props, canvasOverlay.triggerSlot);
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
    okButtonProps,
    cancelButtonProps,
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
  return /* @__PURE__ */ React__default.default.createElement(React__default.default.Fragment, null, /* @__PURE__ */ React__default.default.createElement(
    Ant.Modal,
    {
      ...rest,
      okButtonProps: isEditing ? { ...okButtonProps, "data-plasmic-modal-part": "ok" } : okButtonProps,
      cancelButtonProps: isEditing ? { ...cancelButtonProps, "data-plasmic-modal-part": "cancel" } : cancelButtonProps,
      mask: closeOnOutsideClick === void 0 || mask === false ? mask : {
        ...typeof mask === "object" ? mask : {},
        closable: closeOnOutsideClick
      },
      onOk: isEditing ? void 0 : onOk,
      width: widthProp,
      onCancel: isEditing ? void 0 : memoOnCancel,
      afterOpenChange: isEditing ? void 0 : canvasProps.afterOpenChange,
      afterClose: isEditing ? void 0 : canvasProps.afterClose,
      open,
      destroyOnHidden,
      forceRender: isEditing ? false : props.forceRender,
      focusable: isEditing ? { trap: false, focusTriggerAfterClose: false } : props.focusable,
      footer: hideFooter ? null : footer,
      wrapClassName,
      className: cls__default.default(
        props.className,
        defaultStylesClassName,
        modalScopeClassName
      )
    }
  ), trigger ? /* @__PURE__ */ React__default.default.createElement("div", { onClick: isEditing ? void 0 : () => onOpenChange?.(true) }, trigger) : null);
}
function registerModal(loader) {
  utils.registerComponentHelper(loader, AntdModal, {
    name: "plasmic-antd6-modal",
    canvasOverlay,
    canvasParts: {
      ok: { selector: '[data-plasmic-modal-part="ok"]', displayName: "Confirm button", props: ["okText", "okButtonProps", "confirmLoading", "onOk"], text: { prop: "okText", selector: ":scope > span:not(.ant-btn-icon)" } },
      cancel: { selector: '[data-plasmic-modal-part="cancel"]', displayName: "Cancel button", props: ["cancelText", "cancelButtonProps", "onCancel"], text: { prop: "cancelText", selector: ":scope > span:not(.ant-btn-icon)" } }
    },
    displayName: "Modal",
    styleSections,
    description: "Open a dialog over the current page for focused confirmation, information or form editing. Control its open state and OK/cancel events. [See tutorial video](https://www.youtube.com/watch?v=TkjxNJIFun8)",
    props: {
      previewOpen: canvasOverlay$1.previewOpenProp,
      open: {
        type: "boolean"
      },
      mask: { type: "object" },
      destroyOnHidden: { type: "boolean" },
      width: {
        type: "string",
        defaultValueHint: "520px",
        description: "Change the width of the modal",
        helpText: "Default unit is px. You can also use % or other units for width."
      },
      children: {
        type: "slot",
        defaultValue: {
          type: "vbox",
          children: ["Modal content"]
        }
      },
      title: {
        type: "slot",
        hidePlaceholder: true
      },
      footer: {
        type: "slot",
        hidePlaceholder: true,
        hidden: (ps) => ps.hideFooter ?? false
      },
      trigger: {
        type: "slot",
        description: "Optional inline opener. Clear this Slot when another business control owns opening the Modal; binding open does not remove the default opener.",
        hidePlaceholder: true,
        defaultValue: {
          type: "component",
          name: "plasmic-antd6-button",
          props: {
            children: {
              type: "text",
              value: "Show modal"
            }
          }
        },
        ...{
          mergeWithParent: true
        }
      },
      closeIcon: {
        type: "slot",
        hidePlaceholder: true
      },
      onOk: {
        type: "eventHandler",
        argTypes: [],
        description: "Validate and save, then explicitly close the modal after success. Clicking OK does not change open automatically."
      },
      onCancel: {
        type: "eventHandler",
        argTypes: []
      },
      okText: {
        type: "string",
        hidden: (ps) => !!ps.footer,
        advanced: true
      },
      cancelText: {
        type: "string",
        hidden: (ps) => !!ps.footer,
        advanced: true
      },
      hideFooter: {
        type: "boolean",
        description: "Hide the modal footer slot",
        advanced: true
      },
      confirmLoading: {
        type: "boolean",
        description: "Show loading on the default OK button while saving."
      },
      okButtonProps: {
        type: "object",
        fields: { ...lodash.omit(registerButton.getButtonProps(), ["children", "icon", "onClick", "submitsForm", "target"]), style: { type: "object" } },
        display: "inline",
        advanced: true,
        description: "Native Button props for the default OK button."
      },
      cancelButtonProps: {
        type: "object",
        fields: { ...lodash.omit(registerButton.getButtonProps(), ["children", "icon", "onClick", "submitsForm", "target"]), style: { type: "object" } },
        display: "inline",
        advanced: true,
        description: "Native Button props for the default Cancel button."
      },
      onOpenChange: {
        type: "eventHandler",
        argTypes: [{ name: "open", type: "boolean" }]
      },
      closeOnOutsideClick: {
        type: "boolean",
        displayName: "Close modal on outside click?",
        description: "Whether to close the modal when user clicks outside the modal",
        defaultValueHint: true
      },
      wrapClassName: {
        type: "class",
        displayName: "Modal overlay",
        styleSections: ["background"]
      },
      modalScopeClassName: {
        type: "styleScopeClass",
        scopeName: "modal"
      },
      modalContentClassName: {
        type: "class",
        displayName: "Modal content",
        noSelf: true,
        styleSections,
        selectors: [
          {
            selector: ":modal .ant-modal-container",
            label: "Base"
          }
        ]
      },
      closeButtonClassName: {
        type: "class",
        displayName: "Close button",
        noSelf: true,
        selectors: [
          {
            selector: ":modal .ant-modal-close",
            label: "Base"
          }
        ],
        advanced: true
      },
      defaultStylesClassName: {
        type: "themeResetClass"
      }
    },
    states: {
      open: {
        type: "writable",
        valueProp: "open",
        onChangeProp: "onOpenChange",
        variableType: "boolean"
      }
    },
    templates: {
      "Modal Form": {
        props: {
          children: {
            type: "component",
            name: "plasmic-antd6-form"
          },
          hideFooter: true
        }
      },
      "Generic Modal": {}
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerModal",
    importName: "AntdModal"
  });
}

exports.AntdModal = AntdModal;
exports.registerModal = registerModal;
//# sourceMappingURL=registerModal.cjs.js.map
