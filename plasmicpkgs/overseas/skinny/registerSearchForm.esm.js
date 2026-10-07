import registerComponent from '@plasmicapp/host/registerComponent';
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
    return /* @__PURE__ */ React.createElement(React.Fragment, null, control);
  }
  const ownHandler = child.props[trigger];
  const formHandler = binding[trigger];
  return React.cloneElement(child, {
    ...binding,
    [trigger]: (...args) => {
      formHandler?.(...args);
      ownHandler?.(...args);
    }
  });
}
function SearchFormItem({
  className,
  name,
  label,
  labelContent,
  children,
  required,
  requiredMessage,
  rules,
  valuePropName,
  trigger,
  help
}) {
  const child = React.Children.toArray(children)[0];
  const controlMeta = React.isValidElement(child) ? child.type.__plasmicFormFieldMeta : void 0;
  const changeEvent = trigger ?? controlMeta?.onChangeProp ?? "onChange";
  return /* @__PURE__ */ React.createElement(
    Form.Item,
    {
      className,
      name,
      label: labelContent ?? label,
      help,
      style: { marginBottom: 16 },
      valuePropName: valuePropName ?? controlMeta?.valueProp ?? "value",
      trigger: changeEvent,
      rules: [
        ...required ? [
          {
            required: true,
            message: requiredMessage ?? `\u8BF7\u8F93\u5165${label ?? name ?? "\u67E5\u8BE2\u6761\u4EF6"}`
          }
        ] : [],
        ...rules ?? []
      ]
    },
    /* @__PURE__ */ React.createElement(FieldControl, { control: children, trigger: changeEvent })
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
function searchGrid(spans) {
  let rows = 1, lastRowSpan = 0;
  for (const rawSpan of spans) {
    const span = normalizedSpan(rawSpan);
    if (lastRowSpan + span > 24) {
      rows++;
      lastRowSpan = span;
    } else {
      lastRowSpan += span;
    }
  }
  return {
    rows,
    lastRowSpan,
    rowsWithActions: rows + (lastRowSpan === 24 ? 1 : 0),
    actionSpan: lastRowSpan === 24 ? 24 : 24 - lastRowSpan
  };
}
function searchLayout(spans, minRows, collapsed) {
  const all = searchGrid(spans);
  const showExpand = all.rowsWithActions > Math.max(1, minRows);
  let visibleCount = spans.length;
  if (collapsed && showExpand) {
    visibleCount = 0;
    while (visibleCount < spans.length && searchGrid(spans.slice(0, visibleCount + 1)).rowsWithActions <= Math.max(1, minRows)) {
      visibleCount++;
    }
    if (spans.length && visibleCount === 0) {
      visibleCount = 1;
    }
  }
  return {
    showExpand,
    visibleCount,
    actionSpan: searchGrid(spans.slice(0, visibleCount)).actionSpan
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
    const names = items.flatMap(
      (item) => item.props.name ? [item.props.name] : []
    );
    const namesKey = JSON.stringify(names);
    const previousNames = useRef(/* @__PURE__ */ new Set());
    const getValues = () => form.getFieldsValue(names);
    useEffect(() => {
      if (editing) {
        form.resetFields();
      } else {
        previousNames.current.forEach((name) => {
          if (!names.includes(name)) {
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
      previousNames.current = new Set(names);
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
    return /* @__PURE__ */ React.createElement(
      "div",
      {
        className,
        style: embedded ? { marginBottom: 0 } : {
          background: token.colorBgContainer,
          padding: "16px 20px 0",
          borderRadius: 8,
          border: `1px solid ${token.colorBorderSecondary}`,
          marginBottom
        }
      },
      /* @__PURE__ */ React.createElement(
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
          }
        },
        /* @__PURE__ */ React.createElement(Row, { gutter: 24 }, items.map((item, index) => /* @__PURE__ */ React.createElement(
          Col,
          {
            key: item.key ?? item.props.name ?? index,
            span: normalizedSpan(item.props.span ?? colSpan),
            xs: 24,
            sm: 12,
            md: normalizedSpan(item.props.span ?? colSpan),
            style: {
              display: index < layout.visibleCount ? void 0 : "none"
            }
          },
          item
        )), /* @__PURE__ */ React.createElement(
          Col,
          {
            span: layout.actionSpan,
            xs: 24,
            sm: layout.actionSpan,
            md: layout.actionSpan,
            style: { textAlign: "right" }
          },
          /* @__PURE__ */ React.createElement(Form.Item, { style: { marginBottom: 16 } }, /* @__PURE__ */ React.createElement(
            Space,
            {
              size: "small",
              wrap: true,
              style: { justifyContent: "flex-end", width: "100%" }
            },
            /* @__PURE__ */ React.createElement(Button, { type: "primary", htmlType: "submit", loading }, searchText),
            /* @__PURE__ */ React.createElement(Button, { onClick: reset }, resetText),
            extraActions,
            layout.showExpand && /* @__PURE__ */ React.createElement(
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
                }
              },
              /* @__PURE__ */ React.createElement(
                DownOutlined,
                {
                  rotate: displayCollapsed ? 0 : 180,
                  style: { transition: "transform 0.24s" }
                }
              ),
              displayCollapsed ? expandText : collapseText
            )
          ))
        ))
      )
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
          props: { name: "keyword", label: "\u5173\u952E\u8BCD" }
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
      defaultValue: true,
      description: "Collapse at runtime; the editor displays every field for editing."
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
    label: { type: "string", defaultValue: "\u6761\u4EF6" },
    labelContent: {
      type: "slot",
      displayName: "Custom label",
      hidePlaceholder: true
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
