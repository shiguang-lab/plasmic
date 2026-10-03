import { Segmented } from "antd";
import React from "react";
import { Registerable, registerComponentHelper } from "./utils";

export const segmentedComponentName = "plasmic-antd6-segmented";
export function AntdSegmented(props: React.ComponentProps<typeof Segmented>) {
  return <Segmented {...props} />;
}
export function registerSegmented(loader?: Registerable) {
  registerComponentHelper(loader, AntdSegmented, {
    name: segmentedComponentName,
    displayName: "Segmented",
    props: {
      options: {
        type: "array",
        description: "Antd options: strings, numbers, or objects with label, value and disabled.",
        defaultValue: ["Option 1", "Option 2", "Option 3"],
      },
      value: { type: "object", editOnly: true, uncontrolledProp: "defaultValue" },
      size: { type: "choice", options: ["small", "medium", "large"] },
      disabled: "boolean",
      block: "boolean",
      vertical: "boolean",
      name: "string",
      onChange: { type: "eventHandler", argTypes: [{ name: "value", type: "object" }] },
    },
    states: {
      value: { type: "writable", valueProp: "value", onChangeProp: "onChange", variableType: "object" },
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerSegmented",
    importName: "AntdSegmented",
  });
}
