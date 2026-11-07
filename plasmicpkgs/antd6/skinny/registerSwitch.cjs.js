'use strict';

var jsxRuntime = require('react/jsx-runtime');
var Ant = require('antd');
var names = require('./names-DbJduus8.cjs.js');
var utils = require('./utils-B1jTF3MA.cjs.js');
require('@plasmicapp/host/registerComponent');
require('@plasmicapp/host/registerGlobalContext');
require('react');
require('@shiguang-lab/plasmic-antd6/thumbnails');

function AntdSwitch(props) {
  return /* @__PURE__ */ jsxRuntime.jsx(Ant.Switch, { ...props });
}
AntdSwitch.__plasmicFormFieldMeta = { valueProp: "checked" };
function registerSwitch(loader) {
  utils.registerComponentHelper(loader, AntdSwitch, {
    description: "Toggle a boolean setting between on and off, with checked and change-event bindings.",
    name: names.switchComponentName,
    displayName: "Switch",
    props: {
      checked: {
        type: "boolean",
        editOnly: true,
        uncontrolledProp: "defaultChecked",
        description: "Whether the switch is toggled on",
        defaultValueHint: false,
        hidden: (ps) => !!ps.__plasmicFormField
      },
      disabled: {
        type: "boolean",
        description: "If switch is disabled",
        defaultValueHint: false
      },
      autoFocus: {
        type: "boolean",
        description: "If get focus when component mounted",
        defaultValueHint: false,
        advanced: true
      },
      onChange: {
        type: "eventHandler",
        argTypes: [{ name: "checked", type: "boolean" }]
      }
    },
    states: {
      checked: {
        type: "writable",
        valueProp: "checked",
        onChangeProp: "onChange",
        variableType: "boolean",
        hidden: (ps) => !!ps.__plasmicFormField
      }
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerSwitch",
    importName: "AntdSwitch"
  });
}

exports.AntdSwitch = AntdSwitch;
exports.registerSwitch = registerSwitch;
//# sourceMappingURL=registerSwitch.cjs.js.map
