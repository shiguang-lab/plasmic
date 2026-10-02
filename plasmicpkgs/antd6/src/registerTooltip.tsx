import React from "react";
import { Tooltip } from "antd";
import { Registerable, registerComponentHelper } from "./utils";

export function AntdTooltip(
  props: React.ComponentProps<typeof Tooltip> & {
    titleText?: string;
    popupRootClassName?: string;
  },
) {
  const { popupRootClassName, titleText, ...rest } = props;
  return (
    <Tooltip
      {...rest}
      classNames={{ root: popupRootClassName }}
      title={props.title || titleText}
    />
  );
}

export function registerTooltip(loader?: Registerable) {
  registerComponentHelper(loader, AntdTooltip, {
    name: "plasmic-antd6-tooltip",
    displayName: "Tooltip",
    isAttachment: true,
    props: {
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
