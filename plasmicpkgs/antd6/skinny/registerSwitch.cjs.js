'use strict';

var Ant = require('antd');
var React = require('react');
var names = require('./names-DbJduus8.cjs.js');
var utils = require('./utils-DFFF-Zj5.cjs.js');
require('@plasmicapp/host/registerComponent');
require('@plasmicapp/host/registerGlobalContext');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var React__default = /*#__PURE__*/_interopDefault(React);

function AntdSwitch(props) {
  return /* @__PURE__ */ React__default.default.createElement(Ant.Switch, { ...props });
}
AntdSwitch.__plasmicFormFieldMeta = { valueProp: "checked" };
function registerSwitch(loader) {
  utils.registerComponentHelper(loader, AntdSwitch, {
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
