import { Input, InputNumber } from "antd";
import React from "react";
import {
  inputComponentName,
  inputNumberComponentName,
  passwordComponentName,
  textAreaComponentName,
} from "./names";
import { Registerable, registerComponentHelper } from "./utils";

export const AntdInput = Input;
export const AntdTextArea = Input.TextArea;
export const AntdPassword = Input.Password;
export const AntdInputNumber: typeof InputNumber = InputNumber;

export const inputHelpers = {
  states: {
    value: {
      onChangeArgsToValue: (
        e: Parameters<
          NonNullable<React.ComponentProps<typeof Input>["onChange"]>
        >[0],
      ) => {
        return e.target.value;
      },
    },
  },
};

const COMMON_HELPERS_CONFIG = {
  helpers: inputHelpers,
  importName: "inputHelpers",
  importPath: "@shiguang-lab/plasmic-antd6/skinny/registerInput",
} as const;
const COMMON_STATES = {
  value: {
    type: "writable",
    valueProp: "value",
    variableType: "text",
    onChangeProp: "onChange",
    hidden: (ps: any) => !!ps.__plasmicFormField,
  },
} as const;

const COMMON_DECORATOR_PROPS = {
  prefix: {
    type: "slot",
    hidePlaceholder: true,
  },
  suffix: {
    type: "slot",
    hidePlaceholder: true,
  },
} as const;

const COMMON_ADVANCED_PROPS = {
  maxLength: {
    type: "number",
    advanced: true,
  },
  variant: {
    type: "choice",
    options: ["outlined", "borderless", "filled", "underlined"],
    defaultValueHint: "outlined",
  },
  allowClear: {
    type: "boolean",
    advanced: true,
  },
  autoFocus: {
    type: "boolean",
    advanced: true,
  },
  readOnly: {
    type: "boolean",
    advanced: true,
  },
} as const;

const COMMON_EVENT_HANDLERS = {
  onChange: {
    type: "eventHandler",
    argTypes: [
      {
        name: "event",
        type: "object",
      },
    ] as any,
  },
  onPressEnter: {
    type: "eventHandler",
    argTypes: [
      {
        name: "event",
        type: "object",
      },
    ] as any,
  },
} as const;

const inputTypeOptions = [
  "text",
  "password",
  "number",
  "date",
  "datetime-local",
  "time",
  "email",
  "tel",
  "hidden",
];

export function registerInput(loader?: Registerable) {
  registerComponentHelper(loader, AntdInput, {
    name: inputComponentName,
    displayName: "Input",
    styleSections: ["visibility"],
    props: {
      value: {
        type: "string",
        hidden: (ps: any) => !!ps.__plasmicFormField,
      },
      placeholder: {
        type: "string",
      },
      size: {
        type: "choice",
        options: ["large", "medium", "small"],
      },
      disabled: {
        type: "boolean",
      },
      type: {
        type: "choice",
        options: inputTypeOptions,
        defaultValueHint: "text",
      },
      ...COMMON_ADVANCED_PROPS,
      ...COMMON_DECORATOR_PROPS,
      ...COMMON_EVENT_HANDLERS,
    },
    states: {
      ...COMMON_STATES,
    },
    ...({ trapsSelection: true } as any),
    componentHelpers: COMMON_HELPERS_CONFIG,
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerInput",
    importName: "AntdInput",
  });
}

export function registerTextArea(loader?: Registerable) {
  registerComponentHelper(loader, AntdTextArea, {
    name: textAreaComponentName,
    parentComponentName: inputComponentName,
    displayName: "Text Area",
    styleSections: ["visibility"],
    props: {
      value: {
        type: "string",
        hidden: (ps: any) => !!ps.__plasmicFormField,
      },
      placeholder: {
        type: "string",
      },
      disabled: {
        type: "boolean",
      },
      maxLength: {
        type: "number",
        advanced: true,
      },
      variant: {
        type: "choice",
        options: ["outlined", "borderless", "filled", "underlined"],
        defaultValueHint: "outlined",
      },
      autoSize: {
        type: "boolean",
        displayName: "Auto grow height?",
      },
      ...COMMON_EVENT_HANDLERS,
    },
    states: {
      ...COMMON_STATES,
    },
    componentHelpers: COMMON_HELPERS_CONFIG,
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerInput",
    importName: "AntdTextArea",
  });
}

export function registerPasswordInput(loader?: Registerable) {
  registerComponentHelper(loader, AntdPassword, {
    name: passwordComponentName,
    parentComponentName: inputComponentName,
    displayName: "Password Input",
    styleSections: ["visibility"],
    props: {
      value: {
        type: "string",
        hidden: (ps: any) => !!ps.__plasmicFormField,
      },
      placeholder: {
        type: "string",
      },
      disabled: {
        type: "boolean",
      },
      maxLength: {
        type: "number",
        advanced: true,
      },

      variant: {
        type: "choice",
        options: ["outlined", "borderless", "filled", "underlined"],
        defaultValueHint: "outlined",
      },
      ...COMMON_EVENT_HANDLERS,
    },
    states: {
      ...COMMON_STATES,
    },
    componentHelpers: COMMON_HELPERS_CONFIG,
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerInput",
    importName: "AntdPassword",
  });
}

export function registerNumberInput(loader?: Registerable) {
  registerComponentHelper(loader, AntdInputNumber, {
    name: inputNumberComponentName,
    parentComponentName: inputComponentName,
    displayName: "Number Input",
    styleSections: ["visibility"],
    props: {
      value: {
        type: "number",
        hidden: (ps: any) => !!ps.__plasmicFormField,
      },
      placeholder: {
        type: "string",
      },
      disabled: {
        type: "boolean",
      },
      max: {
        type: "number",
      },
      min: {
        type: "number",
      },
      step: {
        type: "number",
        helpText: "Increment or decrement step",
      },
      controls: {
        type: "boolean",
        displayName: "Show add/minus controls?",
        advanced: true,
      },
      type: {
        type: "choice",
        options: inputTypeOptions,
        displayName: "Input type",
        advanced: true,
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
            type: "number",
          },
        ],
      },
    },
    states: {
      value: { ...COMMON_STATES.value, variableType: "number" },
    },
    ...({ trapsSelection: true } as any),
    // InputNumber emits numeric values directly.
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerInput",
    importName: "AntdInputNumber",
  });
}
