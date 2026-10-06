import { b as buttonComponentName, f as formComponentName } from './names-DKofLcnC.esm.js';
import { a as arrayEq, r as registerComponentHelper } from './utils-z8_Paxbd.esm.js';
import { InputType, formHelpers } from './Form.esm.js';
import { FormWrapper as SchemaForm } from './SchemaForm.esm.js';
import { Input, InputNumber, Radio } from 'antd';
import 'react';
import { AntdCheckbox } from './registerCheckbox.esm.js';
import { AntdDatePicker } from './registerDatePicker.esm.js';
import { AntdRadioGroup } from './registerRadio.esm.js';
import { AntdSelect } from './registerSelect.esm.js';
export { FormGroup } from './FormGroup.esm.js';
export { FormItemWrapper } from './FormItem.esm.js';
export { FormListWrapper } from './FormList.esm.js';
import '@plasmicapp/host/registerComponent';
import '@plasmicapp/host/registerGlobalContext';
import 'fast-deep-equal';
import './contexts-DtHxvgts.esm.js';
import '@plasmicapp/data-sources';
import 'classnames';
import 'dayjs';
import './canvas-overlay-CXR871_R.esm.js';
import '@plasmicapp/host';
import './react-utils-BpvCcwyE.esm.js';

/* @__PURE__ */ new Map([
  [Input, InputType.Text],
  [Input.TextArea, InputType.TextArea],
  [Input.Password, InputType.Password],
  [InputNumber, InputType.Number],
  [AntdSelect, InputType.Select],
  [AntdRadioGroup, InputType.RadioGroup],
  [Radio, InputType.Radio],
  [AntdDatePicker, InputType.DatePicker],
  [AntdCheckbox, InputType.Checkbox]
]);
/* @__PURE__ */ new Map([
  ["text-input", InputType.Text],
  ["select", InputType.Select],
  ["checkbox", InputType.Checkbox],
  ["switch", InputType.Checkbox]
]);
const COMMON_ACTIONS = [
  {
    type: "button-action",
    label: "Append new Form Field",
    onClick: ({ studioOps }) => {
      studioOps.appendToSlot(
        {
          type: "component",
          name: "plasmic-antd6-form-item"
        },
        "children"
      );
    },
    hidden: (props) => props.mode !== "advanced"
  }
  // {
  //   type: "button-action" as const,
  //   label: "Append new Form Field Group",
  //   onClick: ({ studioOps }: ActionProps<any>) => {
  //     studioOps.appendToSlot(
  //       {
  //         type: "component",
  //         name: "plasmic-antd6-form-group",
  //       },
  //       "children"
  //     );
  //   },
  // },
  // {
  //   type: "button-action" as const,
  //   label: "Append new Form List",
  //   onClick: ({ studioOps }: ActionProps<any>) => {
  //     studioOps.appendToSlot(
  //       {
  //         type: "component",
  //         name: "plasmic-antd6-form-list",
  //       },
  //       "children"
  //     );
  //   },
  // },
];
function getDefaultValueHint(field) {
  return (_props, contextData, { item }) => {
    if (!contextData || !("mergedFields" in contextData)) {
      return void 0;
    }
    if (item?.fieldId) {
      const fieldSetting = contextData.mergedFields?.find(
        (f) => f.fieldId === item.fieldId
      );
      return fieldSetting?.[field];
    }
    return void 0;
  };
}
function commonFormItemProps(usage) {
  const getFormItemProps = (ps, _ctx, { item }) => {
    {
      return item;
    }
  };
  return {
    name: {
      type: "string",
      required: true,
      displayName: "Field key",
      description: "Key name for this field value in the submitted form data.",
      validator: (value, _ps, ctx) => {
        let currFullPath = [];
        {
          currFullPath = [value];
        }
        const nameCounter = (ctx?.internalFieldCtx?.registeredFields ?? []).filter((formItem) => arrayEq(formItem.fullPath, currFullPath)).length;
        return nameCounter === 1 ? true : `Repeated form field key: ${currFullPath.join(" \u2192 ")}`;
      },
      defaultValueHint: getDefaultValueHint("name")
    },
    initialValue: {
      type: "dynamic",
      control: (ps, ctx, {
        item,
        path
      }) => {
        let inputType = InputType.Unknown;
        {
          inputType = item.inputType;
          if (!ps.data) {
            inputType = item.inputType;
          } else if (path != null && typeof path[1] === "number") {
            inputType = ctx?.mergedFields?.[path[1]].inputType ?? InputType.Unknown;
          }
        }
        if ([
          InputType.Text,
          InputType.TextArea,
          InputType.Password,
          InputType.Select,
          InputType.RadioGroup
        ].includes(inputType)) {
          return {
            type: "string",
            defaultValueHint: getDefaultValueHint("initialValue")
          };
        } else if (InputType.Number === inputType) {
          return {
            type: "number",
            defaultValueHint: getDefaultValueHint("initialValue")
          };
        } else if (InputType.Checkbox === inputType) {
          return {
            type: "boolean",
            defaultValueHint: getDefaultValueHint("initialValue")
          };
        } else if (InputType.DatePicker === inputType) {
          return {
            type: "dateString",
            defaultValueHint: getDefaultValueHint("initialValue")
          };
        } else {
          return {
            type: "exprEditor",
            defaultValueHint: getDefaultValueHint("initialValue")
          };
        }
      }
    },
    rules: {
      displayName: "Validation rules",
      type: "formValidationRules"
    },
    valuePropName: {
      type: "string",
      advanced: true,
      defaultValueHint: "value",
      description: "The prop name for specifying the value of the form control component"
    },
    trigger: {
      type: "string",
      displayName: "Trigger prop name",
      advanced: true,
      defaultValueHint: "onChange",
      description: "The prop name of event handler that is called when value is changed"
    },
    noLabel: {
      type: "boolean",
      advanced: true
    },
    alignLabellessWithControls: {
      type: "boolean",
      displayName: "Align with controls?",
      description: "Aligns the content with form controls in the grid",
      hidden: (ps, ctx, extras) => {
        const formItem = getFormItemProps(ps, ctx, extras);
        return !formItem?.noLabel || ctx?.layout?.layout !== "horizontal";
      },
      defaultValueHint: true
    },
    colon: {
      type: "boolean",
      defaultValueHint: true,
      advanced: true,
      hidden: () => true
    },
    labelAlign: {
      type: "choice",
      options: ["left", "right"],
      advanced: true,
      hidden: (ps, ctx, extras) => {
        const formItem = getFormItemProps(ps, ctx, extras);
        return !!formItem?.noLabel || ctx?.layout?.layout !== "horizontal";
      }
    },
    hidden: {
      type: "boolean",
      defaultValueHint: getDefaultValueHint("hidden")
    },
    validateTrigger: {
      displayName: "Validate when",
      type: "choice",
      options: [
        { value: "onBlur", label: "a field loses focus" },
        { value: "onChange", label: "a field changes" },
        { value: "onSubmit", label: "the form is submitted" }
      ],
      multiSelect: true,
      defaultValueHint: ["onChange"],
      advanced: true
    },
    shouldUpdate: {
      type: "boolean",
      advanced: true,
      displayName: "Always re-render",
      description: "Form fields normally only re-render when the corresponding form value changes, for performance. This forces it to always re-render."
    },
    dependencies: {
      type: "array",
      advanced: true,
      displayName: "Dependencies",
      description: "Form fields can depend on other form fields. This forces it to re-evaluate the validation rules when the other form fields changes."
    },
    hideValidationMessage: {
      type: "boolean",
      displayName: "Hide validation message?",
      description: "If true, will hide the validation error message",
      defaultValueHint: false,
      advanced: true
    },
    customizeProps: {
      type: "function",
      description: "Customize the props passed into the wrapped field component. Takes the current status ('success', 'warning', 'error', or 'validating').)",
      argNames: ["fieldData"],
      argValues: (_ps, ctx) => [
        {
          status: ctx?.status?.status
        }
      ],
      advanced: true
    },
    noStyle: {
      type: "boolean",
      displayName: "Field control only",
      description: "Don't render anything but the field control - so no label, help text, validation error, etc.",
      advanced: true
    },
    preserve: {
      type: "boolean",
      advanced: true,
      defaultValueHint: true,
      description: "Keep field value even when field removed."
    }
  };
}
const commonSimplifiedFormArrayItemType = (propName) => ({
  type: "object",
  fields: {
    label: {
      type: "string",
      defaultValueHint: getDefaultValueHint("label")
    },
    inputType: {
      type: "choice",
      options: Object.values(InputType).filter(
        (inputType) => ![
          InputType.Option,
          InputType.OptionGroup,
          InputType.Radio,
          InputType.Unknown
        ].includes(inputType)
      ),
      defaultValue: InputType.Text,
      defaultValueHint: getDefaultValueHint("inputType")
    },
    options: {
      type: "array",
      itemType: {
        type: "object",
        fields: {
          type: {
            type: "choice",
            options: [
              { value: "option", label: "Option" },
              { value: "option-group", label: "Option Group" }
            ],
            defaultValue: "option",
            hidden: (ps, _ctx, { path }) => {
              if (ps[propName]?.[path[1]]?.inputType !== InputType.Select) {
                return true;
              }
              return false;
            }
          },
          label: "string",
          value: {
            type: "string",
            hidden: (ps, _ctx, { path, item }) => {
              if (ps[propName]?.[path[1]]?.inputType !== InputType.Select) {
                return false;
              }
              return item.type !== "option";
            }
          },
          options: {
            type: "array",
            itemType: {
              type: "object",
              nameFunc: (item) => item.label || item.value,
              fields: {
                value: "string",
                label: "string"
              }
            },
            hidden: (ps, _ctx, { path, item }) => {
              if (ps[propName]?.[path[1]]?.inputType !== InputType.Select) {
                return true;
              }
              return item.type !== "option-group";
            }
          }
        },
        nameFunc: (item) => item?.label
      },
      hidden: (_ps, _ctx, { item }) => ![InputType.Select, InputType.RadioGroup].includes(item.inputType)
    },
    optionType: {
      type: "choice",
      options: [
        { value: "default", label: "Radio" },
        { value: "button", label: "Button" }
      ],
      hidden: (_ps, _ctx, { item }) => InputType.RadioGroup !== item.inputType,
      defaultValueHint: "Radio",
      displayName: "Option Type"
    },
    showTime: {
      type: "boolean",
      displayName: "Show Time",
      description: "To provide an additional time selection",
      hidden: (_ps, _ctx, { item }) => ![InputType.DatePicker].includes(item.inputType)
    },
    ...commonFormItemProps()
  },
  nameFunc: (item) => item.fieldId ?? item.label ?? item.name
});

const colProp = (displayName, defaultValue, description) => ({
  type: "object",
  displayName,
  advanced: true,
  fields: {
    span: {
      type: "number",
      displayName: "Width",
      description: "The number of grid columns to span in width (out of 24 columns total)",
      min: 1,
      max: 24
    },
    offset: {
      type: "number",
      displayName: "Offset",
      description: "Number of grid columns to skip from the left (out of 24 columns total)",
      min: 0,
      max: 23
    },
    horizontalOnly: {
      type: "boolean",
      displayName: "Horizontal only",
      description: "Only apply when form layout is horizontal"
    }
  },
  nameFunc: () => `Edit ${displayName}`,
  description,
  defaultValue
});
const formTypeDescription = `
  You can create form with two different behaviors:
  


  1. Create a new entry: The form will be created empty and it will create a new row when submitted.
  2. Update an entry: The form will be pre-filled with the row values and it will update the table entry when submitted.
  


  For both options, you can customize later.
`;
function registerForm(loader) {
  registerComponentHelper(loader, SchemaForm, {
    name: formComponentName,
    displayName: "Form",
    description: "[Learn how to use forms](https://docs.plasmic.app/learn/forms/)",
    defaultStyles: {
      layout: "vbox",
      alignItems: "flex-start"
    },
    props: {
      disabled: { type: "boolean", defaultValueHint: false },
      mode: {
        type: "controlMode",
        defaultValue: "simplified"
      },
      data: {
        type: "formDataConnection",
        disableDynamicValue: true,
        disableLinkToProp: true,
        hidden: (ps) => ps.mode !== "simplified" || !ps.data,
        invariantable: true
      },
      formItems: {
        displayName: "Fields",
        type: "array",
        itemType: commonSimplifiedFormArrayItemType("formItems"),
        defaultValue: [
          {
            label: "Name",
            name: "name",
            inputType: InputType.Text
          },
          {
            label: "Message",
            name: "message",
            inputType: InputType.TextArea
          }
        ],
        hidden: (ps) => {
          if (ps.mode === "advanced") {
            return true;
          }
          return !!ps.data;
        },
        invariantable: true
      },
      /**
       * dataFormItems are used to expand the form items from schema forms.
       * We can't use the formItems prop because it has a default value. Therefore, if we unset the formItems prop,
       * we would end up with the default value of formItems + schema form items.
       * Ideally, we would need to support dynamic default value.
       */
      dataFormItems: {
        displayName: "Data Fields",
        type: "array",
        itemType: commonSimplifiedFormArrayItemType("dataFormItems"),
        hidden: (ps) => {
          if (ps.mode === "advanced") {
            return true;
          }
          return !ps.data;
        },
        unstable__keyFunc: (x) => x.key,
        unstable__minimalValue: (ps, contextData) => {
          return ps.data ? contextData?.minimalFullLengthFields : void 0;
        },
        unstable__canDelete: (item, ps, ctx) => {
          if (ps.mode !== "simplified") {
            return true;
          }
          if (!ctx?.schema || Object.keys(ctx.schema).length === 0) {
            return false;
          }
          if (item.fieldId && ctx.schema.fields?.some((f) => f.id === item.fieldId)) {
            return false;
          }
          return true;
        },
        invariantable: true
      },
      submitSlot: {
        type: "slot",
        hidden: () => true,
        defaultValue: {
          type: "component",
          name: buttonComponentName,
          props: {
            type: "primary",
            submitsForm: true,
            children: {
              type: "text",
              value: "Submit"
            }
          }
        },
        ...{
          mergeWithParent: () => true,
          hiddenMergedProps: (ps) => !ps.mode
        }
      },
      children: {
        type: "slot",
        hidden: (props) => props.mode !== "advanced"
      },
      initialValues: {
        displayName: "Initial field values",
        type: "object"
      },
      layout: {
        displayName: "Form layout",
        type: "choice",
        options: ["horizontal", "vertical", "inline"],
        defaultValue: "vertical"
      },
      labelAlign: {
        type: "choice",
        options: ["left", "right"],
        defaultValueHint: "right",
        advanced: true,
        hidden: (ps) => ps.layout !== "horizontal"
      },
      labelCol: colProp(
        "Label layout",
        {
          span: 8,
          horizontalOnly: true
        },
        "Set the width and offset of the labels"
      ),
      wrapperCol: colProp(
        "Control layout",
        {
          span: 16,
          horizontalOnly: true
        },
        "Set the width and offset of the form controls"
      ),
      colon: {
        type: "boolean",
        description: `Show a colon after labels by default (only for horizontal layout)`,
        defaultValueHint: true,
        advanced: true,
        hidden: (props) => (props.layout ?? "horizontal") !== "horizontal"
      },
      requiredMark: {
        displayName: "Required/optional indicators",
        type: "choice",
        options: [
          {
            value: "optional",
            label: "Indicate optional fields"
          },
          {
            value: true,
            label: "Indicate required fields with asterisk"
          },
          {
            value: false,
            label: "Show no indicators"
          }
        ],
        advanced: true,
        defaultValueHint: true
      },
      extendedOnValuesChange: {
        type: "eventHandler",
        displayName: "On values change",
        argTypes: [
          {
            name: "values",
            type: "object"
          }
        ]
      },
      onFinish: {
        type: "eventHandler",
        displayName: "On submit",
        argTypes: [
          {
            name: "values",
            type: "object"
          }
        ]
      },
      onFinishFailed: {
        // function({ values, errorFields, outOfDate })
        type: "eventHandler",
        displayName: "On invalid submit",
        argTypes: [
          {
            name: "data",
            type: "object"
          }
        ]
      },
      validateTrigger: {
        displayName: "Validate when",
        type: "choice",
        options: [
          { value: "onBlur", label: "a field loses focus" },
          { value: "onChange", label: "a field changes" },
          { value: "onSubmit", label: "the form is submitted" }
        ],
        multiSelect: true,
        defaultValueHint: ["onChange"],
        advanced: true
      },
      autoDisableWhileSubmitting: {
        displayName: "Auto disable while submitting",
        type: "boolean",
        defaultValueHint: true,
        advanced: true,
        description: "When disabled, it allows the creation of new submissions even while existing submissions are in progress."
      },
      onIsSubmittingChange: {
        type: "eventHandler",
        displayName: "On Is Submitting Change",
        argTypes: [
          {
            name: "isSubmitting",
            type: "boolean"
          }
        ],
        advanced: true
      }
    },
    actions: [
      ...COMMON_ACTIONS,
      {
        type: "form-schema",
        hidden: (ps) => ps.mode !== "simplified" || !!ps.data
      }
    ],
    states: {
      value: {
        type: "readonly",
        variableType: "object",
        onChangeProp: "extendedOnValuesChange"
      },
      isSubmitting: {
        type: "readonly",
        variableType: "boolean",
        onChangeProp: "onIsSubmittingChange",
        initVal: false
      }
    },
    componentHelpers: {
      helpers: formHelpers,
      importName: "formHelpers",
      importPath: "@shiguang-lab/plasmic-antd6/skinny/Form"
    },
    refActions: {
      setFieldsValue: {
        displayName: "Set multiple fields",
        argTypes: [
          {
            name: "newValues",
            displayName: "New Values",
            type: "exprEditor"
          }
        ]
      },
      setFieldValue: {
        displayName: "Set field",
        argTypes: [
          {
            name: "namePath",
            displayName: "Name Path",
            type: {
              type: "dataSelector",
              data: (_, ctx) => {
                if (!ctx?.formInstance) {
                  return {};
                }
                return ctx.formInstance.getFieldsValue(true);
              }
            }
          },
          {
            name: "value",
            displayName: "New Value",
            type: "exprEditor"
          }
        ]
      },
      resetFields: {
        displayName: "Reset fields to initial value",
        argTypes: []
      },
      clearFields: {
        displayName: "Clear fields",
        argTypes: []
      },
      validateFields: {
        displayName: "Validate fields",
        argTypes: [
          {
            name: "nameList",
            displayName: "Name List",
            type: "object"
          },
          {
            name: "options",
            displayName: "Options",
            type: "object"
          }
        ]
      }
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/SchemaForm",
    importName: "FormWrapper"
  });
}

export { SchemaForm as FormWrapper, formHelpers, formTypeDescription, registerForm };
//# sourceMappingURL=registerForm.esm.js.map
