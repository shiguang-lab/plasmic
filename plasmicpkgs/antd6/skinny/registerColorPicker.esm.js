import { ColorPicker } from 'antd';
import React from 'react';
import { r as registerComponentHelper } from './utils-CJsqmMg5.esm.js';
import '@plasmicapp/host/registerComponent';
import '@plasmicapp/host/registerGlobalContext';

function AntdColorPicker({
  showTextSwitch,
  onChange,
  ...props
}) {
  return /* @__PURE__ */ React.createElement(
    ColorPicker,
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
  registerComponentHelper(loader, AntdColorPicker, {
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

export { AntdColorPicker, registerColorPicker };
//# sourceMappingURL=registerColorPicker.esm.js.map
