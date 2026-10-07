import registerComponent, {
  CodeComponentMeta,
} from "@plasmicapp/host/registerComponent";
import {
  SearchForm,
  SearchFormItem,
  SearchFormItemProps,
  SearchFormProps,
} from "./SearchForm";
import { Registerable } from "./registerAppShell";
export { SearchForm, SearchFormItem } from "./SearchForm";
export const searchFormName = "plasmic-overseas-search-form";
export const searchFormItemName = "plasmic-overseas-search-form-item";
const importPath = "@shiguang-lab/plasmic-overseas/skinny/registerSearchForm";

export const searchFormMeta: CodeComponentMeta<SearchFormProps> = {
  name: searchFormName,
  displayName: "SearchForm",
  section: "Business forms",
  description:
    "Editable query form. Insert SearchForm.Item nodes in Fields and an Ant Design 6 control in each item's Control slot. Query returns all fields, including collapsed ones; Reset restores defaults and clear values.",
  importPath,
  importName: "SearchForm",
  defaultStyles: { width: "stretch" },
  props: {
    children: {
      type: "slot",
      displayName: "Fields",
      allowedComponents: [searchFormItemName],
      defaultValue: [
        {
          type: "component",
          name: searchFormItemName,
          props: { name: "keyword", label: "关键词" },
        },
      ],
    },
    extraActions: {
      type: "slot",
      displayName: "Extra actions",
      hidePlaceholder: true,
    },
    initialValues: {
      type: "object",
      description:
        "Defaults by field name. An item's initialValue takes precedence.",
    },
    onSearch: {
      type: "eventHandler",
      argTypes: [{ name: "values", type: "object" }],
    },
    onReset: {
      type: "eventHandler",
      argTypes: [{ name: "values", type: "object" }],
    },
    onValuesChange: {
      type: "eventHandler",
      argTypes: [{ name: "values", type: "object" }],
    },
    loading: "boolean",
    disabled: "boolean",
    collapsed: {
      type: "boolean",
      defaultValue: true,
      description:
        "Collapse at runtime; the editor displays every field for editing.",
    },
    onCollapsedChange: {
      type: "eventHandler",
      argTypes: [{ name: "value", type: "boolean" }],
    },
    minRows: { type: "number", min: 1, defaultValue: 1 },
    colSpan: {
      type: "number",
      min: 1,
      max: 24,
      defaultValue: 6,
      description:
        "24-column grid. Use 6 for four columns or 8 for three columns.",
    },
    labelWidth: {
      type: "number",
      min: 0,
      description:
        "Optional shared label width in pixels. Unset labels follow their content. Set a width that fits every label on one line to align controls across rows.",
    },
    searchText: { type: "string", defaultValue: "查询" },
    resetText: { type: "string", defaultValue: "重置" },
    expandText: { type: "string", defaultValue: "展开" },
    collapseText: { type: "string", defaultValue: "收起" },
    embedded: {
      type: "boolean",
      description:
        "Remove the outer card when embedding in an existing container.",
    },
    marginBottom: {
      type: "number",
      min: 0,
      defaultValue: 16,
      hidden: (props) => !!props.embedded,
    },
  },
  states: {
    values: {
      type: "readonly",
      variableType: "object",
      onChangeProp: "onValuesChange",
    },
    collapsed: {
      type: "writable",
      variableType: "boolean",
      valueProp: "collapsed",
      onChangeProp: "onCollapsedChange",
    },
  },
  refActions: {
    submit: { displayName: "Query", argTypes: [] },
    reset: { displayName: "Reset", argTypes: [] },
    setFieldsValue: {
      displayName: "Set draft values",
      argTypes: [{ name: "values", type: "exprEditor" }],
    },
  },
};
export const searchFormItemMeta: CodeComponentMeta<SearchFormItemProps> = {
  name: searchFormItemName,
  displayName: "SearchForm.Item",
  parentComponentName: searchFormName,
  description:
    "One editable query field. Use a unique name and exactly one input control in the Control slot; configure the control itself through its own props.",
  importPath,
  importName: "SearchFormItem",
  props: {
    name: {
      type: "string",
      description: "Unique field key in submitted values.",
    },
    label: { type: "string", defaultValue: "条件" },
    labelContent: {
      type: "slot",
      displayName: "Custom label",
      hidePlaceholder: true,
    },
    children: {
      type: "slot",
      displayName: "Control",
      description:
        "One Input, Select, DatePicker, Checkbox or custom value/onChange control.",
    },
    span: {
      type: "number",
      min: 1,
      max: 24,
      description: "Override the form's colSpan.",
    },
    initialValue: {
      type: "exprEditor",
      description:
        "Initial/default value; accepts strings, numbers, booleans, arrays or objects.",
    },
    clearValue: {
      type: "exprEditor",
      description:
        "Business value restored when the control clears to null/undefined or the form resets.",
    },
    required: "boolean",
    requiredMessage: { type: "string", hidden: (props) => !props.required },
    rules: {
      type: "object",
      description:
        "Ant Design validation rules array; configure required, type, min/max, pattern or validator expressions.",
    },
    valuePropName: {
      type: "string",
      description:
        "Default value; inferred from registered controls (e.g. checked for Checkbox). Override for custom controls.",
    },
    trigger: {
      type: "string",
      defaultValueHint: "onChange",
      description:
        "Event that updates this field; inferred from registered control metadata, otherwise onChange.",
    },
    help: { type: "slot", hidePlaceholder: true },
  },
};
export function registerSearchForm(loader?: Registerable) {
  const register = loader?.registerComponent ?? registerComponent;
  register(SearchFormItem, searchFormItemMeta);
  register(SearchForm, searchFormMeta);
}
