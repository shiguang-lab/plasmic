"use strict";

var Ant = require("antd");
var React = require("react");
var utils = require("./utils-CRCm44nj.cjs.js");
require("@plasmicapp/host/registerComponent");
require("@plasmicapp/host/registerGlobalContext");

function _interopDefault(e) {
  return e && e.__esModule ? e : { default: e };
}

var React__default = /*#__PURE__*/ _interopDefault(React);

const segmentedComponentName = "plasmic-antd6-segmented";
function AntdSegmented(props) {
  return /* @__PURE__ */ React__default.default.createElement(Ant.Segmented, {
    ...props,
  });
}
function registerSegmented(loader) {
  utils.registerComponentHelper(loader, AntdSegmented, {
    name: segmentedComponentName,
    displayName: "Segmented",
    props: {
      options: {
        type: "array",
        description:
          "Antd options: strings, numbers, or objects with label, value and disabled.",
        defaultValue: ["Option 1", "Option 2", "Option 3"],
      },
      value: {
        type: "object",
        editOnly: true,
        uncontrolledProp: "defaultValue",
      },
      size: { type: "choice", options: ["small", "medium", "large"] },
      disabled: "boolean",
      block: "boolean",
      vertical: "boolean",
      name: "string",
      onChange: {
        type: "eventHandler",
        argTypes: [{ name: "value", type: "object" }],
      },
    },
    states: {
      value: {
        type: "writable",
        valueProp: "value",
        onChangeProp: "onChange",
        variableType: "object",
      },
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerSegmented",
    importName: "AntdSegmented",
  });
}

exports.AntdSegmented = AntdSegmented;
exports.registerSegmented = registerSegmented;
exports.segmentedComponentName = segmentedComponentName;
//# sourceMappingURL=registerSegmented.cjs.js.map
