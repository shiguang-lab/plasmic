import type { PlasmicCanvasProps } from "@plasmicapp/host";
import { Tooltip } from "antd";
import cls from "classnames";
import React from "react";
import {
  useCanvasOverlay,
} from "./canvas-overlay";
import { Registerable, registerComponentHelper } from "./utils";

const canvasOverlay = { triggerSlot: "children" };

export function AntdTooltip(
  props: React.ComponentProps<typeof Tooltip> &
    PlasmicCanvasProps & {
      titleText?: string;
      popupRootClassName?: string;
    },
) {
  const {
    props: canvasProps,
    open,
    isEditing,
    destroyOnHidden,
  } = useCanvasOverlay(props, canvasOverlay.triggerSlot);
  const { popupRootClassName, titleText, classNames, ...rest } = canvasProps;
  return (
    <Tooltip
      {...rest}
      open={open}
      destroyOnHidden={destroyOnHidden}
      onOpenChange={canvasProps.onOpenChange}
      afterOpenChange={isEditing ? undefined : canvasProps.afterOpenChange}
      classNames={(info) => {
        const names =
          typeof classNames === "function" ? classNames(info) : classNames;
        return { ...names, root: cls(names?.root, popupRootClassName) };
      }}
      title={props.title === undefined ? titleText : props.title}
    />
  );
}

export function registerTooltip(loader?: Registerable) {
  registerComponentHelper(loader, AntdTooltip, {
    name: "plasmic-antd6-tooltip",
    canvasOverlay,
    displayName: "Tooltip",
    isAttachment: true,
    props: {
      open: {
        type: "boolean",
        description: "Controlled open state of the tooltip.",
      },
      defaultOpen: {
        type: "boolean",
        description: "Initial open state when open is not controlled.",
      },
      onOpenChange: {
        type: "eventHandler",
        argTypes: [{ name: "open", type: "boolean" }],
      },
      children: {
        type: "slot",
        defaultValue: {
          type: "text",
          value: "This text element is wrapped in a Tooltip component",
        },
        mergeWithParent: true,
      } as any,
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
      trigger: {
        type: "choice",
        options: ["hover", "focus", "click", "contextMenu"],
        multiSelect: true,
        description: "Interactions that reveal the Tooltip.",
        defaultValueHint: ["hover"],
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
    states: {
      open: {
        type: "writable",
        valueProp: "open",
        initialValueProp: "defaultOpen",
        onChangeProp: "onOpenChange",
        variableType: "boolean",
      },
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerTooltip",
    importName: "AntdTooltip",
  });
}
