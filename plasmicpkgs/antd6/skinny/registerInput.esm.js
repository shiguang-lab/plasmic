import { Input, InputNumber } from 'antd';
import { i as inputComponentName, t as textAreaComponentName, p as passwordComponentName, d as inputNumberComponentName } from './names-DKofLcnC.esm.js';
import { r as registerComponentHelper } from './utils-z8_Paxbd.esm.js';
import '@plasmicapp/host/registerComponent';
import '@plasmicapp/host/registerGlobalContext';
import 'react';

const AntdInput = Input;
const AntdTextArea = Input.TextArea;
const AntdPassword = Input.Password;
const AntdInputNumber = InputNumber;
const inputHelpers = {
  states: {
    value: {
      onChangeArgsToValue: (e) => {
        return e.target.value;
      }
    }
  }
};
const COMMON_HELPERS_CONFIG = {
  helpers: inputHelpers,
  importName: "inputHelpers",
  importPath: "@shiguang-lab/plasmic-antd6/skinny/registerInput"
};
const COMMON_STATES = {
  value: {
    type: "writable",
    valueProp: "value",
    variableType: "text",
    onChangeProp: "onChange",
    hidden: (ps) => !!ps.__plasmicFormField
  }
};
const COMMON_DECORATOR_PROPS = {
  prefix: {
    type: "slot",
    hidePlaceholder: true
  },
  suffix: {
    type: "slot",
    hidePlaceholder: true
  }
};
const COMMON_ADVANCED_PROPS = {
  maxLength: {
    type: "number",
    advanced: true
  },
  variant: {
    type: "choice",
    options: ["outlined", "borderless", "filled", "underlined"],
    defaultValueHint: "outlined"
  },
  allowClear: {
    type: "boolean",
    advanced: true
  },
  autoFocus: {
    type: "boolean",
    advanced: true
  },
  readOnly: {
    type: "boolean",
    advanced: true
  }
};
const COMMON_EVENT_HANDLERS = {
  onChange: {
    type: "eventHandler",
    argTypes: [
      {
        name: "event",
        type: "object"
      }
    ]
  },
  onPressEnter: {
    type: "eventHandler",
    argTypes: [
      {
        name: "event",
        type: "object"
      }
    ]
  }
};
const inputTypeOptions = [
  "text",
  "password",
  "number",
  "date",
  "datetime-local",
  "time",
  "email",
  "tel",
  "hidden"
];
function registerInput(loader) {
  registerComponentHelper(loader, AntdInput, {
    name: inputComponentName,
    displayName: "Input",
    styleSections: ["visibility"],
    props: {
      value: {
        type: "string",
        hidden: (ps) => !!ps.__plasmicFormField
      },
      placeholder: {
        type: "string"
      },
      size: {
        type: "choice",
        options: ["large", "medium", "small"]
      },
      disabled: {
        type: "boolean"
      },
      type: {
        type: "choice",
        options: inputTypeOptions,
        defaultValueHint: "text"
      },
      ...COMMON_ADVANCED_PROPS,
      ...COMMON_DECORATOR_PROPS,
      ...COMMON_EVENT_HANDLERS
    },
    states: {
      ...COMMON_STATES
    },
    ...{ trapsSelection: true },
    componentHelpers: COMMON_HELPERS_CONFIG,
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerInput",
    importName: "AntdInput"
  });
}
function registerTextArea(loader) {
  registerComponentHelper(loader, AntdTextArea, {
    name: textAreaComponentName,
    parentComponentName: inputComponentName,
    displayName: "Text Area",
    styleSections: ["visibility"],
    props: {
      value: {
        type: "string",
        hidden: (ps) => !!ps.__plasmicFormField
      },
      placeholder: {
        type: "string"
      },
      disabled: {
        type: "boolean"
      },
      maxLength: {
        type: "number",
        advanced: true
      },
      variant: {
        type: "choice",
        options: ["outlined", "borderless", "filled", "underlined"],
        defaultValueHint: "outlined"
      },
      autoSize: {
        type: "boolean",
        displayName: "Auto grow height?"
      },
      ...COMMON_EVENT_HANDLERS
    },
    states: {
      ...COMMON_STATES
    },
    componentHelpers: COMMON_HELPERS_CONFIG,
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerInput",
    importName: "AntdTextArea"
  });
}
function registerPasswordInput(loader) {
  registerComponentHelper(loader, AntdPassword, {
    name: passwordComponentName,
    parentComponentName: inputComponentName,
    displayName: "Password Input",
    styleSections: ["visibility"],
    props: {
      value: {
        type: "string",
        hidden: (ps) => !!ps.__plasmicFormField
      },
      placeholder: {
        type: "string"
      },
      disabled: {
        type: "boolean"
      },
      maxLength: {
        type: "number",
        advanced: true
      },
      variant: {
        type: "choice",
        options: ["outlined", "borderless", "filled", "underlined"],
        defaultValueHint: "outlined"
      },
      ...COMMON_EVENT_HANDLERS
    },
    states: {
      ...COMMON_STATES
    },
    componentHelpers: COMMON_HELPERS_CONFIG,
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerInput",
    importName: "AntdPassword"
  });
}
function registerNumberInput(loader) {
  registerComponentHelper(loader, AntdInputNumber, {
    name: inputNumberComponentName,
    parentComponentName: inputComponentName,
    displayName: "Number Input",
    styleSections: ["visibility"],
    props: {
      value: {
        type: "number",
        hidden: (ps) => !!ps.__plasmicFormField
      },
      placeholder: {
        type: "string"
      },
      disabled: {
        type: "boolean"
      },
      max: {
        type: "number"
      },
      min: {
        type: "number"
      },
      step: {
        type: "number",
        helpText: "Increment or decrement step"
      },
      controls: {
        type: "boolean",
        displayName: "Show add/minus controls?",
        advanced: true
      },
      type: {
        type: "choice",
        options: inputTypeOptions,
        displayName: "Input type",
        advanced: true
      },
      ...COMMON_DECORATOR_PROPS,
      maxLength: COMMON_ADVANCED_PROPS.maxLength,
      variant: COMMON_ADVANCED_PROPS.variant,
      autoFocus: COMMON_ADVANCED_PROPS.autoFocus,
      readOnly: COMMON_ADVANCED_PROPS.readOnly,
      ...COMMON_EVENT_HANDLERS,
      // onChange directly called with the number
      onChange: {
        type: "eventHandler",
        argTypes: [
          {
            name: "value",
            type: "number"
          }
        ]
      }
    },
    states: {
      value: { ...COMMON_STATES.value, variableType: "number" }
    },
    ...{ trapsSelection: true },
    // InputNumber emits numeric values directly.
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerInput",
    importName: "AntdInputNumber"
  });
}

export { AntdInput, AntdInputNumber, AntdPassword, AntdTextArea, inputHelpers, registerInput, registerNumberInput, registerPasswordInput, registerTextArea };
//# sourceMappingURL=registerInput.esm.js.map
