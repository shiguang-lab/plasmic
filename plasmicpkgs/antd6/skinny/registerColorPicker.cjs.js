'use strict';

var Ant = require('antd');
var React = require('react');
var utils = require('./utils-DFFF-Zj5.cjs.js');
require('@plasmicapp/host/registerComponent');
require('@plasmicapp/host/registerGlobalContext');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var React__default = /*#__PURE__*/_interopDefault(React);

function AntdColorPicker({
  showTextSwitch,
  onChange,
  ...props
}) {
  return /* @__PURE__ */ React__default.default.createElement(
    Ant.ColorPicker,
    {
      ...props,
      showText: props.showText ?? showTextSwitch,
      onChange: (value) => {
        onChange?.(typeof value === "string" ? value : value.toHexString());
      }
    }
  );
}
function registerColorPicker(loader) {
  utils.registerComponentHelper(loader, AntdColorPicker, {
    name: "plasmic-antd6-color-picker",
    displayName: "Color Picker",
    props: {
      children: {
        type: "slot",
        hidePlaceholder: true,
        mergeWithParent: true
      },
      value: {
        displayName: "Color value",
        type: "color",
        editOnly: true,
        uncontrolledProp: "defaultValue",
        hidden: (ps) => !!ps.__plasmicFormField
      },
      showTextSwitch: {
        type: "boolean",
        displayName: "Show text"
      },
      showText: {
        type: "slot",
        hidePlaceholder: true
      },
      allowClear: "boolean",
      disabled: {
        type: "boolean",
        advanced: true
      },
      trigger: {
        advanced: true,
        type: "choice",
        options: ["click", "hover"],
        defaultValueHint: "click"
      },
      format: {
        advanced: true,
        type: "choice",
        options: ["hex", "hsb", "rgb"],
        defaultValueHint: "hex"
      },
      onChange: {
        type: "eventHandler",
        argTypes: [
          {
            name: "color",
            type: "string"
          }
        ]
      }
    },
    states: {
      value: {
        type: "writable",
        valueProp: "value",
        onChangeProp: "onChange",
        variableType: "text",
        hidden: (ps) => !!ps.__plasmicFormField
      }
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerColorPicker",
    importName: "AntdColorPicker"
  });
}

exports.AntdColorPicker = AntdColorPicker;
exports.registerColorPicker = registerColorPicker;
//# sourceMappingURL=registerColorPicker.cjs.js.map
