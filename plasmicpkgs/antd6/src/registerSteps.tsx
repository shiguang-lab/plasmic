import { Steps } from "antd";
import type { StepsSemanticType } from "antd/es/steps";
import React from "react";
import { semanticAppearance } from "./semantic-appearance";
import { Registerable, registerComponentHelper } from "./utils";

export function AntdSteps(props: React.ComponentProps<typeof Steps>) {
  return <Steps {...props} />;
}

export function registerSteps(loader?: Registerable) {
  const statusOptions = ["wait", "process", "finish", "error"];
  registerComponentHelper(loader, AntdSteps, {
    description: "Display the current stage and progress through a sequence of steps. Use registered change events when allowing the user to select a stage; the owning page provides step content.",
    name: "plasmic-antd6-steps",
    displayName: "Steps",
    props: {
      items: {
        type: "array",
        itemType: {
          type: "object",
          nameFunc: (item: any) => item.title,
          fields: {
            title: "string",
            content: "string",
            subTitle: "string",
            disabled: "boolean",
            status: {
              displayName: "Status",
              type: "choice",
              options: statusOptions,
              defaultValueHint: "wait",
            },
            // TODO icon: 'slot',
          },
        },
        defaultValue: [
          {
            title: "Applied",
            content: "Application has been submitted.",
          },
          {
            title: "In Review",
            content: "Application is being reviewed.",
          },
          {
            title: "Closed",
            content: "Final decision on the application.",
          },
        ],
      },
      current: {
        type: "number",
        displayName: "Current step",
        defaultValueHint: 0,
      },
      size: {
        type: "choice",
        options: ["small", "medium"],
        description: "Set the size of steps",
        defaultValueHint: "medium",
      },
      orientation: {
        type: "choice",
        options: ["horizontal", "vertical"],
        description: "Direction of steps",
        defaultValueHint: "horizontal",
      },
      status: {
        displayName: "Status of current step",
        type: "choice",
        options: statusOptions,
        defaultValueHint: "process",
      },
      type: {
        type: "choice",
        options: ["default", "navigation", "inline", "dot"],
        defaultValueHint: "default",
      },
      percent: {
        advanced: true,
        type: "number",
        description: "Number between 0 to 100",
      },
      responsive: {
        advanced: true,
        type: "boolean",
        description: "Change to vertical when screen narrower than 532px",
      },
      ...semanticAppearance(
        {
          root: "Steps container",
          item: "Step item",
          itemWrapper: "Step wrapper",
          itemIcon: "Step icon",
          itemSection: "Step section",
          itemHeader: "Step header",
          itemTitle: "Step title",
          itemSubtitle: "Step subtitle",
          itemContent: "Step content",
          itemRail: "Step rail",
        } satisfies Record<
          keyof NonNullable<StepsSemanticType["classNames"]>,
          string
        >,
        { advanced: true },
      ),
      onChange: {
        type: "eventHandler",
        argTypes: [
          {
            name: "step",
            type: "number",
          },
        ],
      },
    },
    states: {
      current: {
        type: "writable",
        valueProp: "current",
        onChangeProp: "onChange",
        variableType: "number",
      },
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerSteps",
    importName: "AntdSteps",
  });
}
