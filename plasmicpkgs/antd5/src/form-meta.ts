import type { TableSchema } from "@plasmicapp/data-sources";
import { deriveFieldConfigs } from "@plasmicapp/data-sources";
import type { SimplifiedFormItemsProp } from "./form/Form";
import {
  checkboxComponentName,
  datePickerComponentName,
  inputComponentName,
  inputNumberComponentName,
  optionComponentName,
  optionGroupComponentName,
  passwordComponentName,
  radioComponentName,
  radioGroupComponentName,
  selectComponentName,
  textAreaComponentName,
} from "./names";
export type { SimplifiedFormItemsProp } from "./form/Form";
export * from "./names";

export enum InputType {
  Text = "Text",
  TextArea = "Text Area",
  Password = "Password",
  Number = "Number",
  Select = "Select",
  Option = "Option",
  OptionGroup = "Option Group",
  Radio = "Radio",
  RadioGroup = "Radio Group",
  Checkbox = "Checkbox",
  DatePicker = "DatePicker",
  Unknown = "Unkown",
}

export enum FormType {
  NewEntry,
  UpdateEntry,
}

export const OPTIMIZED_FORM_IMPORT = {
  name: "FormWrapper",
  path: "@plasmicpkgs/antd5/skinny/Form",
};

export const formTypeDescription = `
  You can create form with two different behaviors:
  \n\n
  1. Create a new entry: The form will be created empty and it will create a new row when submitted.
  2. Update an entry: The form will be pre-filled with the row values and it will update the table entry when submitted.
  \n\n
  For both options, you can customize later.
`;

export const componentNameToInputType = {
  [inputComponentName]: InputType.Text,
  [textAreaComponentName]: InputType.TextArea,
  [passwordComponentName]: InputType.Password,
  [inputNumberComponentName]: InputType.Number,
  [selectComponentName]: InputType.Select,
  [optionComponentName]: InputType.Option,
  [optionGroupComponentName]: InputType.OptionGroup,
  [radioComponentName]: InputType.Radio,
  [radioGroupComponentName]: InputType.RadioGroup,
  [datePickerComponentName]: InputType.DatePicker,
  [checkboxComponentName]: InputType.Checkbox,
};

export const inputTypeToComponentName = Object.fromEntries(
  Object.entries(componentNameToInputType).map((kv) => kv.reverse()),
) as Record<InputType, string>;

export function deriveFormFieldConfigs(
  dataFormItems: SimplifiedFormItemsProp[],
  schema: TableSchema,
  data: any,
) {
  return deriveFieldConfigs<SimplifiedFormItemsProp>(
    dataFormItems,
    schema,
    (field) => ({
      inputType: InputType.Text,
      ...(field && {
        key: field.id,
        fieldId: field.id,
        label: field.label ?? field.id,
        name: field.id,
        inputType:
          field.type === "string"
            ? InputType.Text
            : field.type === "number"
              ? InputType.Number
              : field.type === "boolean"
                ? InputType.Checkbox
                : InputType.Text, //missing date and date-time
        initialValue: data ? data[field.id] : undefined,
      }),
    }),
  );
}
