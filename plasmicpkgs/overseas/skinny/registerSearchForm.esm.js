import registerComponent from '@plasmicapp/host/registerComponent';
import { jsx, jsxs, Fragment } from 'react/jsx-runtime';
import { DownOutlined } from '@ant-design/icons';
import { usePlasmicCanvasContext } from '@plasmicapp/host';
import { Form, theme, Row, Col, Space, Button, Typography } from 'antd';
import React, { useState, useMemo, useRef, useEffect, useImperativeHandle } from 'react';

function FieldControl({
  control,
  trigger,
  ...binding
}) {
  const child = React.Children.toArray(control)[0];
  if (!React.isValidElement(child)) {
    return /* @__PURE__ */ jsx(Fragment, { children: control });
  }
  const ownHandler = child.props[trigger];
  const formHandler = binding[trigger];
  return React.cloneElement(child, {
    ...binding,
    [trigger]: (...args) => {
      formHandler?.(...args);
      if (typeof ownHandler === "function") ownHandler(...args);
    }
  });
}
function SearchFormItem({
  className,
  name,
  label,
  children,
  required,
  requiredMessage,
  rules,
  valuePropName,
  trigger,
  help
}) {
  const labelRef = useRef(null);
  const child = React.Children.toArray(children)[0];
  const controlMeta = React.isValidElement(child) ? child.type.__plasmicFormFieldMeta : void 0;
  const changeEvent = trigger ?? controlMeta?.onChangeProp ?? "onChange";
  return /* @__PURE__ */ jsx(
    Form.Item,
    {
      className,
      name,
      label: label == null || label === "" ? label : /* @__PURE__ */ jsx("span", { ref: labelRef, children: label }),
      help,
      style: { marginBottom: 16 },
      valuePropName: valuePropName ?? controlMeta?.valueProp ?? "value",
      trigger: changeEvent,
      rules: [
        ...required ? [
          () => ({
            required: true,
            message: requiredMessage ?? `\u8BF7\u8F93\u5165${labelRef.current?.textContent?.trim() || name || "\u67E5\u8BE2\u6761\u4EF6"}`
          })
        ] : [],
        ...rules ?? []
      ],
      children: /* @__PURE__ */ jsx(FieldControl, { control: children, trigger: changeEvent })
    }
  );
}
function collectSearchItems(children) {
  const items = [];
  function visit(nodes) {
    React.Children.forEach(nodes, (node) => {
      if (!React.isValidElement(node)) {
        return;
      }
      if (node.type === SearchFormItem) {
        items.push(node);
      } else {
        visit(node.props.children);
      }
    });
  }
  visit(children);
  return items;
}
function normalizedSpan(span) {
  return Math.min(24, Math.max(1, Math.round(span) || 6));
}
function measureSearchGrid(spans, rowLimit = Infinity) {
  let rows = 1;
  let lastRowSpan = 0;
  let count = 0;
  for (; count < spans.length; count++) {
    const span = normalizedSpan(spans[count]);
    const startsRow = lastRowSpan + span > 24;
    const nextRows = startsRow ? rows + 1 : rows;
    const nextSpan = startsRow ? span : lastRowSpan + span;
    if (nextRows + Number(nextSpan === 24) > rowLimit) {
      if (!count) {
        count = 1;
        lastRowSpan = nextSpan;
      }
      break;
    }
    rows = nextRows;
    lastRowSpan = nextSpan;
  }
  return { count, rows, lastRowSpan };
}
function searchLayout(spans, minRows, collapsed) {
  const rowLimit = Math.max(1, minRows);
  const { count, rows, lastRowSpan } = measureSearchGrid(
    spans,
    collapsed ? rowLimit : void 0
  );
  return {
    showExpand: count < spans.length || rows + Number(lastRowSpan === 24) > rowLimit,
    visibleCount: count,
    actionSpan: 24 - lastRowSpan || 24
  };
}
function searchDefaults(items, initialValues = {}) {
  const values = { ...initialValues };
  const clearValues = {};
  for (const item of items) {
    if (!item.name) {
      continue;
    }
    if (item.initialValue !== void 0) {
      values[item.name] = item.initialValue;
    } else if (!(item.name in values) && item.clearValue !== void 0) {
      values[item.name] = item.clearValue;
    }
    if (item.clearValue !== void 0) {
      clearValues[item.name] = item.clearValue;
    }
  }
  return { initialValues: values, clearValues };
}
const SearchForm = React.forwardRef(
  function SearchForm2({
    className,
    children,
    extraActions,
    initialValues,
    onSearch,
    onReset,
    onValuesChange,
    loading = false,
    disabled = false,
    collapsed,
    defaultCollapsed = true,
    onCollapsedChange,
    minRows = 1,
    colSpan = 6,
    labelWidth,
    searchText = "\u67E5\u8BE2",
    resetText = "\u91CD\u7F6E",
    expandText = "\u5C55\u5F00",
    collapseText = "\u6536\u8D77",
    embedded = false,
    marginBottom = 16
  }, ref) {
    const [form] = Form.useForm();
    const { token } = theme.useToken();
    const canvas = usePlasmicCanvasContext();
    const editing = !!canvas && !canvas.interactive;
    const [localCollapsed, setCollapsed] = useState(defaultCollapsed);
    const isCollapsed = collapsed ?? localCollapsed;
    const displayCollapsed = editing ? false : isCollapsed;
    const items = useMemo(() => collectSearchItems(children), [children]);
    const defaults = useMemo(
      () => searchDefaults(
        items.map((item) => item.props),
        initialValues
      ),
      [items, initialValues]
    );
    const defaultKey = JSON.stringify(defaults.initialValues);
    const { names, namesKey } = useMemo(() => {
      const fieldNames = items.flatMap(
        (item) => item.props.name ? [item.props.name] : []
      );
      return { names: fieldNames, namesKey: JSON.stringify(fieldNames) };
    }, [items]);
    const previousNames = useRef(/* @__PURE__ */ new Set());
    const getValues = () => form.getFieldsValue(names);
    useEffect(() => {
      const nextNames = new Set(names);
      if (editing) {
        form.resetFields();
      } else {
        previousNames.current.forEach((name) => {
          if (!nextNames.has(name)) {
            form.setFieldValue(name, void 0);
          }
        });
        const addedValues = {};
        for (const name of names) {
          if (!previousNames.current.has(name)) {
            addedValues[name] = defaults.initialValues[name];
          }
        }
        form.setFieldsValue(addedValues);
      }
      previousNames.current = nextNames;
      onValuesChange?.(getValues());
    }, [form, editing, defaultKey, namesKey]);
    const layout = searchLayout(
      items.map((item) => item.props.span ?? colSpan),
      minRows,
      displayCollapsed
    );
    const notify = () => onValuesChange?.(getValues());
    const changeCollapsed = (next) => {
      setCollapsed(next);
      onCollapsedChange?.(next);
    };
    const reset = () => {
      form.resetFields();
      form.setFieldsValue(defaults.clearValues);
      notify();
      onReset?.(getValues());
    };
    useImperativeHandle(ref, () => ({
      submit: () => form.submit(),
      reset,
      setFieldsValue: (values) => {
        form.setFieldsValue(values);
        notify();
      }
    }));
    return /* @__PURE__ */ jsx(
      "div",
      {
        className,
        style: embedded ? { marginBottom: 0 } : {
          background: token.colorBgContainer,
          padding: "16px 20px 0",
          borderRadius: 8,
          border: `1px solid ${token.colorBorderSecondary}`,
          marginBottom
        },
        children: /* @__PURE__ */ jsx(
          Form,
          {
            form,
            initialValues: defaults.initialValues,
            disabled,
            preserve: true,
            layout: "horizontal",
            labelCol: labelWidth === void 0 ? void 0 : { flex: `${labelWidth}px` },
            wrapperCol: { flex: "1", style: { minWidth: 0 } },
            onFinish: onSearch,
            onFinishFailed: ({ errorFields }) => {
              if (isCollapsed && errorFields.some(
                (error) => items.slice(layout.visibleCount).some((item) => item.props.name === error.name[0])
              )) {
                changeCollapsed(false);
              }
            },
            onValuesChange: (changedValues) => {
              const restored = {};
              for (const [name, clearValue] of Object.entries(
                defaults.clearValues
              )) {
                if (name in changedValues && (changedValues[name] === void 0 || changedValues[name] === null)) {
                  restored[name] = clearValue;
                }
              }
              form.setFieldsValue(restored);
              notify();
            },
            children: /* @__PURE__ */ jsxs(Row, { gutter: 24, children: [
              items.map((item, index) => /* @__PURE__ */ jsx(
                Col,
                {
                  span: normalizedSpan(item.props.span ?? colSpan),
                  xs: 24,
                  sm: 12,
                  md: normalizedSpan(item.props.span ?? colSpan),
                  style: {
                    display: index < layout.visibleCount ? void 0 : "none"
                  },
                  children: item
                },
                item.key ?? item.props.name ?? index
              )),
              /* @__PURE__ */ jsx(
                Col,
                {
                  span: layout.actionSpan,
                  xs: 24,
                  sm: layout.actionSpan,
                  md: layout.actionSpan,
                  style: { textAlign: "right" },
                  children: /* @__PURE__ */ jsx(Form.Item, { style: { marginBottom: 16 }, children: /* @__PURE__ */ jsxs(
                    Space,
                    {
                      size: "small",
                      wrap: true,
                      style: { justifyContent: "flex-end", width: "100%" },
                      children: [
                        /* @__PURE__ */ jsx(Button, { type: "primary", htmlType: "submit", loading, children: searchText }),
                        /* @__PURE__ */ jsx(Button, { onClick: reset, children: resetText }),
                        extraActions,
                        layout.showExpand && /* @__PURE__ */ jsxs(
                          Typography.Link,
                          {
                            "aria-expanded": !displayCollapsed,
                            onClick: () => {
                              changeCollapsed(!isCollapsed);
                            },
                            style: {
                              fontSize: 12,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              userSelect: "none"
                            },
                            children: [
                              /* @__PURE__ */ jsx(
                                DownOutlined,
                                {
                                  rotate: displayCollapsed ? 0 : 180,
                                  style: { transition: "transform 0.24s" }
                                }
                              ),
                              displayCollapsed ? expandText : collapseText
                            ]
                          }
                        )
                      ]
                    }
                  ) })
                }
              )
            ] })
          }
        )
      }
    );
  }
);

const searchFormName = "plasmic-overseas-search-form";
const searchFormItemName = "plasmic-overseas-search-form-item";
const importPath = "@shiguang-lab/plasmic-overseas/skinny/registerSearchForm";
const searchFormMeta = {
  name: searchFormName,
  displayName: "SearchForm",
  section: "Business forms",
  description: "Editable query form. Insert SearchForm.Item nodes in Fields and an Ant Design 6 control in each item's Control slot. Query returns all fields, including collapsed ones; Reset restores defaults and clear values.",
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
          props: {
            name: "keyword",
            label: { type: "text", tag: "span", elementName: "Label", value: "\u5173\u952E\u8BCD" }
          }
        }
      ]
    },
    extraActions: {
      type: "slot",
      displayName: "Extra actions",
      hidePlaceholder: true
    },
    initialValues: {
      type: "object",
      description: "Defaults by field name. An item's initialValue takes precedence."
    },
    onSearch: {
      type: "eventHandler",
      argTypes: [{ name: "values", type: "object" }]
    },
    onReset: {
      type: "eventHandler",
      argTypes: [{ name: "values", type: "object" }]
    },
    onValuesChange: {
      type: "eventHandler",
      argTypes: [{ name: "values", type: "object" }]
    },
    loading: "boolean",
    disabled: "boolean",
    collapsed: {
      type: "boolean",
      editOnly: true,
      uncontrolledProp: "defaultCollapsed",
      defaultValueHint: true,
      description: "Initial collapsed state (defaults to true). Preview/runtime initialize defaultCollapsed and let the expand/collapse control update it. Bind the writable collapsed state only when controlling it externally. The editor displays every field for editing."
    },
    onCollapsedChange: {
      type: "eventHandler",
      argTypes: [{ name: "value", type: "boolean" }]
    },
    minRows: { type: "number", min: 1, defaultValue: 1 },
    colSpan: {
      type: "number",
      min: 1,
      max: 24,
      defaultValue: 6,
      description: "24-column grid. Use 6 for four columns or 8 for three columns."
    },
    labelWidth: {
      type: "number",
      min: 0,
      description: "Optional shared label width in pixels. Unset labels follow their content. Set a width that fits every label on one line to align controls across rows."
    },
    searchText: { type: "string", defaultValue: "\u67E5\u8BE2" },
    resetText: { type: "string", defaultValue: "\u91CD\u7F6E" },
    expandText: { type: "string", defaultValue: "\u5C55\u5F00" },
    collapseText: { type: "string", defaultValue: "\u6536\u8D77" },
    embedded: {
      type: "boolean",
      description: "Remove the outer card when embedding in an existing container."
    },
    marginBottom: {
      type: "number",
      min: 0,
      defaultValue: 16,
      hidden: (props) => !!props.embedded
    }
  },
  states: {
    values: {
      type: "readonly",
      variableType: "object",
      onChangeProp: "onValuesChange"
    },
    collapsed: {
      type: "writable",
      variableType: "boolean",
      valueProp: "collapsed",
      onChangeProp: "onCollapsedChange"
    }
  },
  refActions: {
    submit: { displayName: "Query", argTypes: [] },
    reset: { displayName: "Reset", argTypes: [] },
    setFieldsValue: {
      displayName: "Set draft values",
      argTypes: [{ name: "values", type: "exprEditor" }]
    }
  }
};
const searchFormItemMeta = {
  name: searchFormItemName,
  displayName: "SearchForm.Item",
  parentComponentName: searchFormName,
  description: "One editable query field. Use a unique name and exactly one input control in the Control slot; configure the control itself through its own props.",
  importPath,
  importName: "SearchFormItem",
  props: {
    name: {
      type: "string",
      description: "Unique field key in submitted values."
    },
    label: {
      type: "slot",
      displayName: "Label",
      fixedRoot: true,
      defaultValue: { type: "text", tag: "span", elementName: "Label", value: "\u6761\u4EF6" },
      hidePlaceholder: false
    },
    children: {
      type: "slot",
      displayName: "Control",
      description: "One Input, Select, DatePicker, Checkbox or custom value/onChange control."
    },
    span: {
      type: "number",
      min: 1,
      max: 24,
      description: "Override the form's colSpan."
    },
    initialValue: {
      type: "exprEditor",
      description: "Initial/default value; accepts strings, numbers, booleans, arrays or objects."
    },
    clearValue: {
      type: "exprEditor",
      description: "Business value restored when the control clears to null/undefined or the form resets."
    },
    required: "boolean",
    requiredMessage: { type: "string", hidden: (props) => !props.required },
    rules: {
      type: "object",
      description: "Ant Design validation rules array; configure required, type, min/max, pattern or validator expressions."
    },
    valuePropName: {
      type: "string",
      description: "Default value; inferred from registered controls (e.g. checked for Checkbox). Override for custom controls."
    },
    trigger: {
      type: "string",
      defaultValueHint: "onChange",
      description: "Event that updates this field; inferred from registered control metadata, otherwise onChange."
    },
    help: { type: "slot", hidePlaceholder: true }
  }
};
function registerSearchForm(loader) {
  const register = loader?.registerComponent ?? registerComponent;
  register(SearchFormItem, searchFormItemMeta);
  register(SearchForm, searchFormMeta);
}

export { SearchForm, SearchFormItem, registerSearchForm, searchFormItemMeta, searchFormItemName, searchFormMeta, searchFormName };
//# sourceMappingURL=registerSearchForm.esm.js.map
