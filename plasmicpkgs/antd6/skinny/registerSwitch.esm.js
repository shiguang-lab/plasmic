import { Switch } from 'antd';
import React from 'react';
import { j as switchComponentName } from './names-DKofLcnC.esm.js';
import { r as registerComponentHelper } from './utils-CJsqmMg5.esm.js';
import '@plasmicapp/host/registerComponent';
import '@plasmicapp/host/registerGlobalContext';

function AntdSwitch(props) {
  return /* @__PURE__ */ React.createElement(Switch, { ...props });
}
AntdSwitch.__plasmicFormFieldMeta = { valueProp: "checked" };
function registerSwitch(loader) {
  registerComponentHelper(loader, AntdSwitch, {
    name: switchComponentName,
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

export { AntdSwitch, registerSwitch };
//# sourceMappingURL=registerSwitch.esm.js.map
