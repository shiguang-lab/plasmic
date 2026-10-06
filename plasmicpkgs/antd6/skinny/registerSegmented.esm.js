import { Segmented } from 'antd';
import React from 'react';
import { r as registerComponentHelper } from './utils-z8_Paxbd.esm.js';
import '@plasmicapp/host/registerComponent';
import '@plasmicapp/host/registerGlobalContext';

const segmentedComponentName = "plasmic-antd6-segmented";
function AntdSegmented(props) {
  return /* @__PURE__ */ React.createElement(Segmented, { ...props });
}
function registerSegmented(loader) {
  registerComponentHelper(loader, AntdSegmented, {
    name: segmentedComponentName,
    displayName: "Segmented",
    props: {
      options: {
        type: "array",
        description: "Antd options: strings, numbers, or objects with label, value and disabled.",
        defaultValue: ["Option 1", "Option 2", "Option 3"]
      },
      value: { type: "object", editOnly: true, uncontrolledProp: "defaultValue" },
      size: { type: "choice", options: ["small", "medium", "large"] },
      disabled: "boolean",
      block: "boolean",
      vertical: "boolean",
      name: "string",
      onChange: { type: "eventHandler", argTypes: [{ name: "value", type: "object" }] }
    },
    states: {
      value: { type: "writable", valueProp: "value", onChangeProp: "onChange", variableType: "object" }
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerSegmented",
    importName: "AntdSegmented"
  });
}

export { AntdSegmented, registerSegmented, segmentedComponentName };
//# sourceMappingURL=registerSegmented.esm.js.map
