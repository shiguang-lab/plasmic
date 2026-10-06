'use strict';

var Ant = require('antd');
var React = require('react');
var utils = require('./utils-DFFF-Zj5.cjs.js');
require('@plasmicapp/host/registerComponent');
require('@plasmicapp/host/registerGlobalContext');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var React__default = /*#__PURE__*/_interopDefault(React);

function AntdSteps(props) {
  return /* @__PURE__ */ React__default.default.createElement(Ant.Steps, { ...props });
}
function registerSteps(loader) {
  const statusOptions = ["wait", "process", "finish", "error"];
  utils.registerComponentHelper(loader, AntdSteps, {
    name: "plasmic-antd6-steps",
    displayName: "Steps",
    props: {
      items: {
        type: "array",
        itemType: {
          type: "object",
          nameFunc: (item) => item.title,
          fields: {
            title: "string",
            content: "string",
            subTitle: "string",
            disabled: "boolean",
            status: {
              displayName: "Status",
              type: "choice",
              options: statusOptions,
              defaultValueHint: "wait"
            }
            // TODO icon: 'slot',
          }
        },
        defaultValue: [
          {
            title: "Applied",
            content: "Application has been submitted."
          },
          {
            title: "In Review",
            content: "Application is being reviewed."
          },
          {
            title: "Closed",
            content: "Final decision on the application."
          }
        ]
      },
      current: {
        type: "number",
        displayName: "Current step",
        defaultValueHint: 0
      },
      size: {
        type: "choice",
        options: ["small", "medium"],
        description: "Set the size of steps",
        defaultValueHint: "medium"
      },
      orientation: {
        type: "choice",
        options: ["horizontal", "vertical"],
        description: "Direction of steps",
        defaultValueHint: "horizontal"
      },
      status: {
        displayName: "Status of current step",
        type: "choice",
        options: statusOptions,
        defaultValueHint: "process"
      },
      type: {
        type: "choice",
        options: ["default", "navigation", "inline", "dot"],
        defaultValueHint: "default"
      },
      percent: {
        advanced: true,
        type: "number",
        description: "Number between 0 to 100"
      },
      responsive: {
        advanced: true,
        type: "boolean",
        description: "Change to vertical when screen narrower than 532px"
      },
      onChange: {
        type: "eventHandler",
        argTypes: [
          {
            name: "step",
            type: "number"
          }
        ]
      }
    },
    states: {
      current: {
        type: "writable",
        valueProp: "current",
        onChangeProp: "onChange",
        variableType: "number"
      }
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerSteps",
    importName: "AntdSteps"
  });
}

exports.AntdSteps = AntdSteps;
exports.registerSteps = registerSteps;
//# sourceMappingURL=registerSteps.cjs.js.map
