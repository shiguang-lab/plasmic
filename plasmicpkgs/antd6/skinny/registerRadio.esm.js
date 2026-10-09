import { Radio } from 'antd';
import React from 'react';
import { r as radioGroupComponentName, e as radioComponentName, g as radioButtonComponentName } from './names-DKofLcnC.esm.js';
import { r as registerComponentHelper, t as traverseReactEltTree } from './utils-CJsqmMg5.esm.js';
import '@plasmicapp/host/registerComponent';
import '@plasmicapp/host/registerGlobalContext';

const RadioGroup = Radio.Group;
const AntdRadio = Radio;
const AntdRadioButton = Radio.Button;
function AntdRadioGroup(props) {
  const { onChange, useChildren, ...rest } = props;
  const wrappedOnChange = React.useMemo(() => {
    if (onChange) {
      return (event) => onChange(event.target.value);
    } else {
      return void 0;
    }
  }, [onChange]);
  return /* @__PURE__ */ React.createElement(
    RadioGroup,
    {
      ...rest,
      onChange: wrappedOnChange,
      options: useChildren ? void 0 : rest.options
    }
  );
}
function registerRadio(loader) {
  registerComponentHelper(loader, AntdRadio, {
    name: radioComponentName,
    displayName: "Radio",
    props: {
      value: {
        type: "string",
        description: "The radio option value"
      },
      disabled: {
        type: "boolean",
        defaultValueHint: false
      },
      autoFocus: {
        type: "boolean",
        description: "If focused when first shown",
        defaultValueHint: false,
        advanced: true
      },
      children: {
        type: "slot",
        defaultValue: [
          {
            type: "text",
            value: "Radio"
          }
        ],
        ...{ mergeWithParent: true }
      }
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerRadio",
    importName: "AntdRadio",
    parentComponentName: radioGroupComponentName
  });
  registerComponentHelper(loader, AntdRadioButton, {
    name: radioButtonComponentName,
    displayName: "Radio Button",
    props: {
      value: {
        type: "string",
        description: "The radio option value"
      },
      disabled: {
        type: "boolean",
        defaultValueHint: false
      },
      autoFocus: {
        type: "boolean",
        description: "If focused when first shown",
        defaultValueHint: false,
        advanced: true
      },
      children: {
        type: "slot",
        defaultValue: [
          {
            type: "text",
            value: "Radio"
          }
        ],
        ...{ mergeWithParent: true }
      }
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerRadio",
    importName: "AntdRadioButton",
    parentComponentName: radioGroupComponentName
  });
  registerComponentHelper(loader, AntdRadioGroup, {
    name: radioGroupComponentName,
    displayName: "Radio Group",
    props: {
      options: {
        type: "array",
        hidden: (ps) => !!ps.useChildren,
        itemType: {
          type: "object",
          nameFunc: (item) => item.label || item.value,
          fields: {
            value: "string",
            label: "string"
          }
        },
        defaultValue: [
          {
            value: "option1",
            label: "Option 1"
          },
          {
            value: "option2",
            label: "Option 2"
          }
        ]
      },
      optionType: {
        type: "choice",
        options: [
          { value: "default", label: "Radio" },
          { value: "button", label: "Button" }
        ],
        hidden: (ps) => !!ps.useChildren,
        defaultValueHint: "default"
      },
      value: {
        type: "choice",
        editOnly: true,
        uncontrolledProp: "defaultValue",
        description: "Default selected value",
        options: (ps) => {
          if (ps.useChildren) {
            const options = /* @__PURE__ */ new Set();
            traverseReactEltTree(ps.children, (elt) => {
              if (typeof elt?.props?.value === "string") {
                options.add(elt.props.value);
              }
            });
            return Array.from(options.keys());
          } else {
            return ps.options ?? [];
          }
        },
        hidden: (ps) => !!ps.__plasmicFormField
      },
      disabled: {
        type: "boolean",
        description: "Disables all radios",
        defaultValueHint: false
      },
      useChildren: {
        displayName: "Use slot",
        type: "boolean",
        defaultValueHint: false,
        advanced: true,
        description: "Instead of configuring a list of options, customize the contents of the RadioGroup by dragging and dropping Radio in the outline/canvas, inside the 'children' slot. Lets you use any content or formatting within the Radio and RadioButton."
      },
      children: {
        type: "slot",
        allowedComponents: [
          "plasmic-antd6-radio",
          "plasmic-antd6-radio-button"
        ],
        defaultValue: [
          {
            type: "component",
            name: "plasmic-antd6-radio",
            props: {
              value: "op1",
              children: {
                type: "text",
                value: "Option 1"
              }
            }
          },
          {
            type: "component",
            name: "plasmic-antd6-radio",
            props: {
              value: "op2",
              children: {
                type: "text",
                value: "Option 2"
              }
            }
          }
        ]
      },
      onChange: {
        type: "eventHandler",
        argTypes: [{ name: "value", type: "string" }]
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
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerRadio",
    importName: "AntdRadioGroup",
    defaultStyles: {
      layout: "hbox"
    },
    ...{
      trapsSelection: true
    }
  });
}

export { AntdRadio, AntdRadioButton, AntdRadioGroup, registerRadio };
//# sourceMappingURL=registerRadio.esm.js.map
