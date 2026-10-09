'use strict';

var Ant = require('antd');
var names = require('./names-DbJduus8.cjs.js');
var utils = require('./utils-DlS9-CF8.cjs.js');
require('@plasmicapp/host/registerComponent');
require('@plasmicapp/host/registerGlobalContext');
require('react');

const AntdInput = Ant.Input;
const AntdTextArea = Ant.Input.TextArea;
const AntdPassword = Ant.Input.Password;
const AntdInputNumber = Ant.InputNumber;
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
  utils.registerComponentHelper(loader, AntdInput, {
    name: names.inputComponentName,
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
  utils.registerComponentHelper(loader, AntdTextArea, {
    name: names.textAreaComponentName,
    parentComponentName: names.inputComponentName,
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
  utils.registerComponentHelper(loader, AntdPassword, {
    name: names.passwordComponentName,
    parentComponentName: names.inputComponentName,
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
  utils.registerComponentHelper(loader, AntdInputNumber, {
    name: names.inputNumberComponentName,
    parentComponentName: names.inputComponentName,
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

exports.AntdInput = AntdInput;
exports.AntdInputNumber = AntdInputNumber;
exports.AntdPassword = AntdPassword;
exports.AntdTextArea = AntdTextArea;
exports.inputHelpers = inputHelpers;
exports.registerInput = registerInput;
exports.registerNumberInput = registerNumberInput;
exports.registerPasswordInput = registerPasswordInput;
exports.registerTextArea = registerTextArea;
//# sourceMappingURL=registerInput.cjs.js.map
