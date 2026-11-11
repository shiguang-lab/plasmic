import registerComponent, {
  type CodeComponentMeta,
  type EventHandlerType,
} from "@plasmicapp/host/registerComponent";
import {
  IntlDepartmentSelect as NativeDepartmentSelect,
  IntlDepartmentView as NativeDepartmentView,
  IntlDictSelect as NativeDictSelect,
  IntlDictView as NativeDictView,
  IntlUserSelect as NativeUserSelect,
  IntlUserView as NativeUserView,
  type IntlDepartmentSelectProps,
  type IntlDepartmentViewProps,
  type IntlDictSelectProps,
  type IntlDictViewProps,
  type IntlUserSelectProps,
  type IntlUserViewProps,
} from "@react/ui";
import {
  formatListData,
  formatTreeData,
} from "@react/ui/esm/intl-dict-select/utils.js";
import intlStyles from "@react/ui/esm/intl-styles.js";
import { forwardRef, useMemo, type ComponentRef } from "react";
import {
  demoDepartments,
  demoDictCode,
  demoUsers,
  getDemoDictItems,
} from "./intlDemoData";
import type { Registerable } from "./registerActionGroup";

export const IntlUserSelect = forwardRef<
  ComponentRef<typeof NativeUserSelect>,
  IntlUserSelectProps
>(function IntlUserSelect({ options, ...props }, ref) {
  return (
    <NativeUserSelect {...props} ref={ref} options={options ?? demoUsers} />
  );
});

export function IntlUserView({ options, ...props }: IntlUserViewProps) {
  return <NativeUserView {...props} options={options ?? demoUsers} />;
}

export const IntlDepartmentSelect = forwardRef<
  ComponentRef<typeof NativeDepartmentSelect>,
  IntlDepartmentSelectProps
>(function IntlDepartmentSelect({ treeData, ...props }, ref) {
  return (
    <NativeDepartmentSelect
      {...props}
      ref={ref}
      treeData={treeData ?? demoDepartments}
    />
  );
});

export function IntlDepartmentView({
  treeData,
  ...props
}: IntlDepartmentViewProps) {
  return (
    <NativeDepartmentView {...props} treeData={treeData ?? demoDepartments} />
  );
}

export const IntlDictSelect = forwardRef<
  ComponentRef<typeof NativeDictSelect>,
  IntlDictSelectProps
>(function IntlDictSelect(props, ref) {
  const {
    type,
    dictCode,
    labelField = "dictItemName",
    valueField = "dictItemCode",
    separator = "/",
    adaptor,
  } = props;
  const data = type === "tree" ? props.treeData : props.options;
  const items = getDemoDictItems(dictCode);
  const options = useMemo(
    () =>
      type !== "tree" && data == null
        ? formatListData(items, labelField, valueField, adaptor)
        : undefined,
    [data, type, items, labelField, valueField, adaptor],
  );
  const treeData = useMemo(
    () =>
      type === "tree" && data == null
        ? formatTreeData(
            items,
            labelField,
            valueField,
            separator,
            intlStyles.treeNodeTitle,
            adaptor,
          )
        : undefined,
    [data, type, items, labelField, valueField, separator, adaptor],
  );
  return props.type === "tree" ? (
    <NativeDictSelect
      {...props}
      ref={ref}
      treeData={props.treeData ?? treeData}
    />
  ) : (
    <NativeDictSelect {...props} ref={ref} options={props.options ?? options} />
  );
});

export function IntlDictView({ treeData, ...props }: IntlDictViewProps) {
  return (
    <NativeDictView
      {...props}
      treeData={treeData ?? getDemoDictItems(props.dictCode)}
    />
  );
}

const library = {
  section: "React UI",
  importPath: "@shiguang-lab/plasmic-react-ui/skinny/registerIntlComponents",
};

const sizeOptions = ["small", "middle", "large"];

const selectProps = {
  value: {
    type: "exprEditor",
    displayName: "Selected value",
    description: "Initial selected value. Pass an array in multiple mode.",
    editOnly: true,
    uncontrolledProp: "defaultValue",
  },
  placeholder: "string",
  disabled: "boolean",
  allowClear: { type: "boolean", defaultValueHint: true },
  showSearch: { type: "boolean", defaultValueHint: true },
  size: { type: "choice", options: sizeOptions, defaultValueHint: "middle" },
  maxTagCount: "number",
  labelInValue: { type: "boolean", advanced: true },
} as const;

const selectChange = {
  type: "eventHandler",
  argTypes: [
    { name: "value", type: "object" },
    { name: "option", type: "object" },
  ],
} satisfies EventHandlerType<IntlUserSelectProps>;

const treeChange = {
  type: "eventHandler",
  argTypes: [
    { name: "value", type: "object" },
    { name: "label", type: "object" },
    { name: "extra", type: "object" },
  ],
} satisfies EventHandlerType<IntlDepartmentSelectProps>;

const selectState = {
  value: {
    type: "writable",
    valueProp: "value",
    onChangeProp: "onChange",
    variableType: "object",
  },
} as const;

const viewProps = {
  separator: "string",
  emptyText: { type: "slot", hidePlaceholder: true },
} as const;

const userFields = {
  valueKey: { type: "string", defaultValueHint: "userId" },
  labelKey: { type: "string", defaultValueHint: "nickname" },
  options: {
    type: "array",
    description:
      "User records with userId, username and nickname. Uses demo users when omitted.",
    itemType: {
      type: "object",
      fields: { userId: "string", username: "string", nickname: "string" },
    },
  },
} as const;

const departmentFields = {
  labelField: { type: "string", defaultValueHint: "label" },
  valueField: { type: "string", defaultValueHint: "value" },
  showFullPath: { type: "boolean", defaultValueHint: false },
  pathSeparator: { type: "string", defaultValueHint: " / " },
  treeData: {
    type: "array",
    description:
      "Department nodes with label, value and optional children. Uses demo departments when omitted.",
  },
} as const;

const dictFields = {
  dictCode: {
    type: "string",
    defaultValueHint: demoDictCode,
    description: "Dictionary code. The built-in demo uses DEMO_REGION.",
  },
  labelField: { type: "string", defaultValueHint: "dictItemName" },
  valueField: { type: "string", defaultValueHint: "dictItemCode" },
} as const;

const intlUserSelectMeta: CodeComponentMeta<IntlUserSelectProps> = {
  ...library,
  name: "plasmic-react-ui-intl-user-select",
  displayName: "IntlUserSelect",
  importName: "IntlUserSelect",
  description: "Search and select overseas users.",
  props: {
    ...selectProps,
    ...userFields,
    mode: { type: "choice", options: ["multiple", "tags"] },
    onChange: selectChange,
  },
  states: selectState,
};

const intlUserViewMeta: CodeComponentMeta<IntlUserViewProps> = {
  ...library,
  name: "plasmic-react-ui-intl-user-view",
  displayName: "IntlUserView",
  importName: "IntlUserView",
  description: "Display overseas user names for one or more user IDs.",
  props: {
    ...viewProps,
    ...userFields,
    value: {
      type: "exprEditor",
      defaultValue: demoUsers[0].userId,
      description: "A user ID, an array of IDs or a comma-separated string.",
    },
  },
};

const intlDepartmentSelectMeta: CodeComponentMeta<IntlDepartmentSelectProps> = {
  ...library,
  name: "plasmic-react-ui-intl-department-select",
  displayName: "IntlDepartmentSelect",
  importName: "IntlDepartmentSelect",
  description:
    "Search and select departments in an overseas organization tree.",
  props: {
    ...selectProps,
    ...departmentFields,
    multiple: "boolean",
    treeCheckable: "boolean",
    treeCheckStrictly: "boolean",
    treeDefaultExpandAll: "boolean",
    onChange: treeChange,
  },
  states: selectState,
};

const intlDepartmentViewMeta: CodeComponentMeta<IntlDepartmentViewProps> = {
  ...library,
  name: "plasmic-react-ui-intl-department-view",
  displayName: "IntlDepartmentView",
  importName: "IntlDepartmentView",
  description: "Display overseas department names or their full paths.",
  props: {
    ...viewProps,
    ...departmentFields,
    value: {
      type: "exprEditor",
      defaultValue: "demo-operations",
      description:
        "A department ID, an array of IDs or a comma-separated string.",
    },
  },
};

// Both branches share the registration. Hide the data input and controls
// that belong to the inactive branch of the native discriminated union.
const intlDictSelectMeta: CodeComponentMeta<IntlDictSelectProps> = {
  ...library,
  name: "plasmic-react-ui-intl-dict-select",
  displayName: "IntlDictSelect",
  importName: "IntlDictSelect",
  description: "Search and select overseas dictionary items in a list or tree.",
  props: {
    ...selectProps,
    ...dictFields,
    type: {
      type: "choice",
      options: ["list", "tree"],
      defaultValueHint: "list",
    },
    options: {
      type: "array",
      description:
        "List options with value and label. Set title to include the display name in search.",
      hidden: (props) => props.type === "tree",
    },
    treeData: {
      type: "array",
      description:
        "Formatted tree nodes with value, label, title, fullPath and optional children.",
      hidden: (props) => props.type !== "tree",
    },
    multiple: "boolean",
    autoSelectFirst: { type: "boolean", defaultValueHint: false },
    showFullPath: { type: "boolean", hidden: (props) => props.type !== "tree" },
    treeCheckable: {
      type: "boolean",
      hidden: (props) => props.type !== "tree",
    },
    treeCheckStrictly: {
      type: "boolean",
      hidden: (props) => props.type !== "tree",
    },
    treeDefaultExpandAll: {
      type: "boolean",
      hidden: (props) => props.type !== "tree",
    },
    onChange: {
      type: "eventHandler",
      argTypes: [
        { name: "value", type: "object" },
        { name: "optionOrLabel", type: "object" },
        { name: "extra", type: "object" },
      ],
    },
  },
  states: selectState,
};

const intlDictViewMeta: CodeComponentMeta<IntlDictViewProps> = {
  ...library,
  name: "plasmic-react-ui-intl-dict-view",
  displayName: "IntlDictView",
  importName: "IntlDictView",
  description: "Display labels for one or more overseas dictionary codes.",
  props: {
    ...viewProps,
    ...dictFields,
    value: {
      type: "exprEditor",
      defaultValue: "SG",
      description: "A dictionary item code or an array of item codes.",
    },
    treeData: {
      type: "array",
      description:
        "Dictionary items with dictItemCode and dictItemName. Supports nested children.",
    },
  },
};

export function registerIntlComponents(loader?: Registerable) {
  const register = loader?.registerComponent ?? registerComponent;
  register(IntlUserSelect, intlUserSelectMeta);
  register(IntlUserView, intlUserViewMeta);
  register(IntlDictSelect, intlDictSelectMeta);
  register(IntlDictView, intlDictViewMeta);
  register(IntlDepartmentSelect, intlDepartmentSelectMeta);
  register(IntlDepartmentView, intlDepartmentViewMeta);
}
