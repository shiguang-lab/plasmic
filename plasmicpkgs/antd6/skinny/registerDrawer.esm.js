import { Drawer } from 'antd';
import cls from 'classnames';
import React from 'react';
import { u as useCanvasOverlay, p as previewOpenProp } from './canvas-overlay-Dan70Oxr.esm.js';
import { r as registerComponentHelper } from './utils-CJsqmMg5.esm.js';
import '@plasmicapp/host';
import '@plasmicapp/host/registerComponent';
import '@plasmicapp/host/registerGlobalContext';

const canvasOverlay = {};
function AntdDrawer(props) {
  const { props: canvasProps, open, isEditing } = useCanvasOverlay(props);
  const {
    onOpenChange,
    onClose,
    footer,
    drawerScopeClassName,
    rootClassName,
    defaultStylesClassName,
    ...rest
  } = canvasProps;
  const memoOnClose = React.useMemo(() => {
    if (onOpenChange || onClose) {
      return (e) => {
        onOpenChange?.(false);
        onClose?.(e);
      };
    } else {
      return void 0;
    }
  }, [onOpenChange, onClose]);
  return /* @__PURE__ */ React.createElement(
    Drawer,
    {
      ...rest,
      onClose: isEditing ? void 0 : memoOnClose,
      afterOpenChange: isEditing ? void 0 : props.afterOpenChange,
      rootClassName: cls(rootClassName, drawerScopeClassName),
      open,
      destroyOnHidden: isEditing ? true : props.destroyOnHidden,
      forceRender: isEditing ? false : props.forceRender,
      autoFocus: isEditing ? false : props.autoFocus,
      focusable: isEditing ? { trap: false, focusTriggerAfterClose: false } : props.focusable,
      footer,
      className: cls(props.className, defaultStylesClassName)
    }
  );
}
function registerDrawer(loader) {
  registerComponentHelper(loader, AntdDrawer, {
    name: "plasmic-antd6-drawer",
    canvasOverlay,
    displayName: "Drawer",
    props: {
      previewOpen: previewOpenProp,
      open: {
        type: "boolean"
      },
      size: { type: "number", defaultValueHint: 378 },
      mask: { type: "object" },
      destroyOnHidden: { type: "boolean" },
      placement: {
        type: "choice",
        options: ["top", "right", "bottom", "left"],
        defaultValueHint: "right"
      },
      children: {
        type: "slot",
        defaultValue: {
          type: "vbox",
          children: ["Drawer content"]
        }
      },
      title: {
        type: "slot",
        defaultValue: "Drawer title"
      },
      footer: {
        type: "slot",
        hidePlaceholder: true
      },
      closeIcon: {
        type: "slot",
        hidePlaceholder: true
      },
      onOpenChange: {
        type: "eventHandler",
        argTypes: [{ name: "open", type: "boolean" }]
      },
      drawerScopeClassName: {
        type: "styleScopeClass",
        scopeName: "drawer"
      },
      drawerHeaderClassName: {
        type: "class",
        displayName: "Drawer header",
        noSelf: true,
        selectors: [
          {
            selector: ":drawer .ant-drawer-header",
            label: "Base"
          }
        ]
      },
      drawerBodyClassName: {
        type: "class",
        displayName: "Drawer body",
        noSelf: true,
        selectors: [
          {
            selector: ":drawer .ant-drawer-body",
            label: "Base"
          }
        ]
      },
      drawerFooterClassName: {
        type: "class",
        displayName: "Drawer footer",
        noSelf: true,
        selectors: [
          {
            selector: ":drawer .ant-drawer-footer",
            label: "Base"
          }
        ]
      },
      drawerTitleClassName: {
        type: "class",
        displayName: "Drawer title",
        noSelf: true,
        selectors: [
          {
            selector: ":drawer .ant-drawer-title",
            label: "Base"
          }
        ]
      },
      drawerMaskClassName: {
        type: "class",
        displayName: "Drawer mask",
        styleSections: ["background"],
        noSelf: true,
        selectors: [
          {
            selector: ":drawer .ant-drawer-mask",
            label: "Base"
          }
        ]
      },
      drawerContentWrapperClassName: {
        type: "class",
        displayName: "Drawer content wrapper",
        noSelf: true,
        selectors: [
          {
            selector: ":drawer .ant-drawer-content-wrapper",
            label: "Base"
          }
        ],
        advanced: true
      },
      closeButtonClassName: {
        type: "class",
        displayName: "Close button",
        noSelf: true,
        selectors: [
          {
            selector: ":drawer .ant-drawer-close",
            label: "Base"
          }
        ],
        advanced: true
      },
      forceRender: {
        advanced: true,
        type: "boolean"
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
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerDrawer",
    importName: "AntdDrawer"
  });
}

export { AntdDrawer, registerDrawer };
//# sourceMappingURL=registerDrawer.esm.js.map
