import { jsx } from 'react/jsx-runtime';
import { Popover } from 'antd';
import cls from 'classnames';
import { u as useCanvasOverlay } from './canvas-overlay-BZz-_5Mj.esm.js';
import { r as registerComponentHelper } from './utils-DPGVAauG.esm.js';
import '@plasmicapp/host';
import 'react';
import '@plasmicapp/host/registerComponent';
import '@plasmicapp/host/registerGlobalContext';
import '@shiguang-lab/plasmic-antd6/thumbnails';

const canvasOverlay = { triggerSlot: "children" };
function AntdPopover(props) {
  const {
    props: canvasProps,
    open,
    isEditing,
    destroyOnHidden
  } = useCanvasOverlay(props, canvasOverlay.triggerSlot);
  const {
    popupRootClassName,
    popoverScopeClassName,
    defaultStylesClassName,
    contentText,
    content,
    classNames,
    ...rest
  } = canvasProps;
  return /* @__PURE__ */ jsx(
    Popover,
    {
      content: content === void 0 ? contentText : content,
      classNames: (info) => {
        const names = typeof classNames === "function" ? classNames(info) : classNames;
        return {
          ...names,
          root: cls(
            names?.root,
            popupRootClassName,
            popoverScopeClassName,
            defaultStylesClassName
          )
        };
      },
      ...rest,
      open,
      destroyOnHidden,
      onOpenChange: canvasProps.onOpenChange,
      afterOpenChange: isEditing ? void 0 : canvasProps.afterOpenChange
    }
  );
}
function registerPopover(loader) {
  registerComponentHelper(loader, AntdPopover, {
    name: "plasmic-antd6-popover",
    canvasOverlay,
    displayName: "Popover",
    isAttachment: true,
    props: {
      open: {
        type: "boolean",
        description: "Controlled open state of the popover. Leave unset for the native trigger."
      },
      defaultOpen: {
        type: "boolean",
        description: "Initial open state when open is not controlled."
      },
      arrow: {
        type: "boolean",
        defaultValue: true,
        advanced: true
      },
      children: {
        type: "slot",
        defaultValue: "This text element is wrapped in a Popover component",
        mergeWithParent: true
      },
      popoverScopeClassName: {
        type: "styleScopeClass",
        scopeName: "popover"
      },
      popoverContentClassName: {
        type: "class",
        displayName: "Popover content",
        selectors: [
          {
            selector: ":popover.ant-popover .ant-popover-container",
            label: "Base"
          }
        ]
      },
      popupRootClassName: {
        type: "class",
        displayName: "Overlay"
      },
      content: {
        type: "slot",
        displayName: "Popover contents",
        defaultValue: "Popover contents",
        hidePlaceholder: true
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
        hidden: (ps) => !!ps.content
      },
      title: {
        type: "slot",
        displayName: "Popover title",
        hidePlaceholder: true
      },
      color: {
        type: "color",
        description: "Popover fill color"
      },
      trigger: {
        type: "choice",
        options: ["hover", "focus", "click"],
        defaultValueHint: "hover",
        advanced: true
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
        description: "Default placement of popover",
        defaultValueHint: "top"
      },
      mouseEnterDelay: {
        type: "number",
        description: "Delay in seconds, before popover is shown on mouse enter",
        defaultValueHint: 0.1,
        advanced: true,
        hidden: (ps) => ps.trigger ? ps.trigger !== "hover" : false
      },
      mouseLeaveDelay: {
        type: "number",
        description: "Delay in seconds, before popover is hidden on mouse leave",
        defaultValueHint: 0.1,
        advanced: true,
        hidden: (ps) => ps.trigger ? ps.trigger !== "hover" : false
      },
      onOpenChange: {
        type: "eventHandler",
        argTypes: [{ name: "open", type: "boolean" }],
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
        initialValueProp: "defaultOpen",
        onChangeProp: "onOpenChange",
        variableType: "boolean"
      }
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerPopover",
    importName: "AntdPopover"
  });
}

export { AntdPopover, registerPopover };
//# sourceMappingURL=registerPopover.esm.js.map
