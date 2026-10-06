import { Tooltip } from 'antd';
import cls from 'classnames';
import React from 'react';
import { u as useCanvasOverlay, p as previewOpenProp } from './canvas-overlay-CXR871_R.esm.js';
import { r as registerComponentHelper } from './utils-z8_Paxbd.esm.js';
import '@plasmicapp/host';
import '@plasmicapp/host/registerComponent';
import '@plasmicapp/host/registerGlobalContext';

const canvasOverlay = { triggerSlot: "children" };
function AntdTooltip(props) {
  const {
    props: canvasProps,
    open,
    isEditing
  } = useCanvasOverlay(props, canvasOverlay.triggerSlot);
  const { popupRootClassName, titleText, classNames, ...rest } = canvasProps;
  return /* @__PURE__ */ React.createElement(
    Tooltip,
    {
      ...rest,
      open,
      destroyOnHidden: isEditing ? true : props.destroyOnHidden,
      onOpenChange: isEditing ? void 0 : props.onOpenChange,
      afterOpenChange: isEditing ? void 0 : props.afterOpenChange,
      classNames: (info) => {
        const names = typeof classNames === "function" ? classNames(info) : classNames;
        return { ...names, root: cls(names?.root, popupRootClassName) };
      },
      title: props.title === void 0 ? titleText : props.title
    }
  );
}
function registerTooltip(loader) {
  registerComponentHelper(loader, AntdTooltip, {
    name: "plasmic-antd6-tooltip",
    canvasOverlay,
    displayName: "Tooltip",
    isAttachment: true,
    props: {
      previewOpen: previewOpenProp,
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
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerTooltip",
    importName: "AntdTooltip"
  });
}

export { AntdTooltip, registerTooltip };
//# sourceMappingURL=registerTooltip.esm.js.map
