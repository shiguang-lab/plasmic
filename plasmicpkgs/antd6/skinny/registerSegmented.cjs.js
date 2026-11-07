'use strict';

var jsxRuntime = require('react/jsx-runtime');
var Ant = require('antd');
var utils = require('./utils-B1jTF3MA.cjs.js');
require('@plasmicapp/host/registerComponent');
require('@plasmicapp/host/registerGlobalContext');
require('react');
require('@shiguang-lab/plasmic-antd6/thumbnails');

const segmentedComponentName = "plasmic-antd6-segmented";
function AntdSegmented(props) {
  return /* @__PURE__ */ jsxRuntime.jsx(Ant.Segmented, { ...props });
}
function registerSegmented(loader) {
  utils.registerComponentHelper(loader, AntdSegmented, {
    description: "Choose one value from a compact horizontal set of labeled or icon options. The owning page decides what the selected value changes; content panels are not provided by this control.",
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

exports.AntdSegmented = AntdSegmented;
exports.registerSegmented = registerSegmented;
exports.segmentedComponentName = segmentedComponentName;
//# sourceMappingURL=registerSegmented.cjs.js.map
