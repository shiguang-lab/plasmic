import { jsx } from 'react/jsx-runtime';
import { Switch } from 'antd';
import { h as switchComponentName } from './names-DQIzgrvq.esm.js';
import { r as registerComponentHelper } from './utils-DPGVAauG.esm.js';
import '@plasmicapp/host/registerComponent';
import '@plasmicapp/host/registerGlobalContext';
import 'react';
import '@shiguang-lab/plasmic-antd6/thumbnails';

function AntdSwitch(props) {
  return /* @__PURE__ */ jsx(Switch, { ...props });
}
AntdSwitch.__plasmicFormFieldMeta = { valueProp: "checked" };
function registerSwitch(loader) {
  registerComponentHelper(loader, AntdSwitch, {
    description: "Toggle a boolean setting between on and off, with checked and change-event bindings.",
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
