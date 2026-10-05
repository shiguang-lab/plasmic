"use strict";

var Ant = require("antd");
var cls = require("classnames");
var React = require("react");
var utils = require("./utils-CRCm44nj.cjs.js");
require("@plasmicapp/host/registerComponent");
require("@plasmicapp/host/registerGlobalContext");

function _interopDefault(e) {
  return e && e.__esModule ? e : { default: e };
}

var cls__default = /*#__PURE__*/ _interopDefault(cls);
var React__default = /*#__PURE__*/ _interopDefault(React);

function AntdDrawer(props) {
  const {
    onOpenChange,
    onClose,
    open,
    footer,
    drawerScopeClassName,
    rootClassName,
    defaultStylesClassName,
    ...rest
  } = props;
  const memoOnClose = React__default.default.useMemo(() => {
    if (onOpenChange || onClose) {
      return (e) => {
        onOpenChange?.(false);
        onClose?.(e);
      };
    } else {
      return void 0;
    }
  }, [onOpenChange, onClose]);
  return /* @__PURE__ */ React__default.default.createElement(Ant.Drawer, {
    ...rest,
    onClose: memoOnClose,
    rootClassName: cls__default.default(rootClassName, drawerScopeClassName),
    open,
    footer,
    className: cls__default.default(props.className, defaultStylesClassName),
  });
}
function registerDrawer(loader) {
  utils.registerComponentHelper(loader, AntdDrawer, {
    name: "plasmic-antd6-drawer",
    displayName: "Drawer",
    props: {
      open: {
        type: "boolean",
      },
      size: { type: "number", defaultValueHint: 378 },
      mask: { type: "object" },
      destroyOnHidden: { type: "boolean" },
      placement: {
        type: "choice",
        options: ["top", "right", "bottom", "left"],
        defaultValueHint: "right",
      },
      children: {
        type: "slot",
        defaultValue: {
          type: "vbox",
          children: ["Drawer content"],
        },
      },
      title: {
        type: "slot",
        defaultValue: "Drawer title",
      },
      footer: {
        type: "slot",
        hidePlaceholder: true,
      },
      closeIcon: {
        type: "slot",
        hidePlaceholder: true,
      },
      onOpenChange: {
        type: "eventHandler",
        argTypes: [{ name: "open", type: "boolean" }],
      },
      drawerScopeClassName: {
        type: "styleScopeClass",
        scopeName: "drawer",
      },
      drawerHeaderClassName: {
        type: "class",
        displayName: "Drawer header",
        noSelf: true,
        selectors: [
          {
            selector: ":drawer .ant-drawer-header",
            label: "Base",
          },
        ],
      },
      drawerBodyClassName: {
        type: "class",
        displayName: "Drawer body",
        noSelf: true,
        selectors: [
          {
            selector: ":drawer .ant-drawer-body",
            label: "Base",
          },
        ],
      },
      drawerFooterClassName: {
        type: "class",
        displayName: "Drawer footer",
        noSelf: true,
        selectors: [
          {
            selector: ":drawer .ant-drawer-footer",
            label: "Base",
          },
        ],
      },
      drawerTitleClassName: {
        type: "class",
        displayName: "Drawer title",
        noSelf: true,
        selectors: [
          {
            selector: ":drawer .ant-drawer-title",
            label: "Base",
          },
        ],
      },
      drawerMaskClassName: {
        type: "class",
        displayName: "Drawer mask",
        styleSections: ["background"],
        noSelf: true,
        selectors: [
          {
            selector: ":drawer .ant-drawer-mask",
            label: "Base",
          },
        ],
      },
      drawerContentWrapperClassName: {
        type: "class",
        displayName: "Drawer content wrapper",
        noSelf: true,
        selectors: [
          {
            selector: ":drawer .ant-drawer-content-wrapper",
            label: "Base",
          },
        ],
        advanced: true,
      },
      closeButtonClassName: {
        type: "class",
        displayName: "Close button",
        noSelf: true,
        selectors: [
          {
            selector: ":drawer .ant-drawer-close",
            label: "Base",
          },
        ],
        advanced: true,
      },
      forceRender: {
        advanced: true,
        type: "boolean",
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
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerDrawer",
    importName: "AntdDrawer",
  });
}

exports.AntdDrawer = AntdDrawer;
exports.registerDrawer = registerDrawer;
//# sourceMappingURL=registerDrawer.cjs.js.map
