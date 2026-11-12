import { DownOutlined } from "@ant-design/icons";
import { usePlasmicCanvasContext } from "@plasmicapp/host";
import type { FormItemProps } from "antd";
import { Button, Col, Form, Row, Space, Typography, theme } from "antd";
import React, {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

export type SearchValues = Record<string, unknown>;
export interface SearchFormItemProps {
  className?: string;
  name?: string;
  label?: React.ReactNode;
  children?: React.ReactNode;
  span?: number;
  initialValue?: unknown;
  clearValue?: unknown;
  required?: boolean;
  requiredMessage?: string;
  rules?: FormItemProps["rules"];
  valuePropName?: string;
  trigger?: string;
  help?: React.ReactNode;
}

// Form.Item injects into one React child; the slot itself can be an array.
function FieldControl({
  control,
  trigger,
  ...binding
}: {
  control: React.ReactNode;
  trigger: string;
  [key: string]: any;
}) {
  const child = React.Children.toArray(control)[0];
  if (!React.isValidElement<Record<string, unknown>>(child)) {
    return <>{control}</>;
  }
  const ownHandler = child.props[trigger];
  const formHandler = binding[trigger];
  return React.cloneElement(child, {
    ...binding,
    [trigger]: (...args: any[]) => {
      formHandler?.(...args);
      if (typeof ownHandler === "function") ownHandler(...args);
    },
  });
}

export function SearchFormItem({
  className,
  name,
  label,
  children,
  required,
  requiredMessage,
  rules,
  valuePropName,
  trigger,
  help,
}: SearchFormItemProps) {
  const labelRef = useRef<HTMLSpanElement>(null);
  const child = React.Children.toArray(children)[0];
  const controlMeta = React.isValidElement(child)
    ? (child.type as any).__plasmicFormFieldMeta
    : undefined;
  const changeEvent = trigger ?? controlMeta?.onChangeProp ?? "onChange";
  return (
    <Form.Item
      className={className}
      name={name}
      label={label == null || label === "" ? label : <span ref={labelRef}>{label}</span>}
      help={help}
      style={{ marginBottom: 16 }}
      valuePropName={valuePropName ?? controlMeta?.valueProp ?? "value"}
      trigger={changeEvent}
      rules={[
        ...(required
          ? [
              () => ({
                required: true,
                message:
                  requiredMessage ?? `请输入${labelRef.current?.textContent?.trim() || name || "查询条件"}`,
              }),
            ]
          : []),
        ...(rules ?? []),
      ]}
    >
      <FieldControl control={children} trigger={changeEvent} />
    </Form.Item>
  );
}

export function collectSearchItems(
  children: React.ReactNode,
): React.ReactElement<SearchFormItemProps>[] {
  const items: React.ReactElement<SearchFormItemProps>[] = [];
  function visit(nodes: React.ReactNode) {
    React.Children.forEach(nodes, (node) => {
      if (!React.isValidElement<{ children?: React.ReactNode }>(node)) {
        return;
      }
      if (node.type === SearchFormItem) {
        items.push(node as React.ReactElement<SearchFormItemProps>);
      } else {
        visit(node.props.children);
      }
    });
  }
  visit(children);
  return items;
}

function normalizedSpan(span: number) {
  return Math.min(24, Math.max(1, Math.round(span) || 6));
}
function measureSearchGrid(spans: number[], rowLimit = Infinity) {
  let rows = 1;
  let lastRowSpan = 0;
  let count = 0;
  for (; count < spans.length; count++) {
    const span = normalizedSpan(spans[count]);
    const startsRow = lastRowSpan + span > 24;
    const nextRows = startsRow ? rows + 1 : rows;
    const nextSpan = startsRow ? span : lastRowSpan + span;
    if (nextRows + Number(nextSpan === 24) > rowLimit) {
      // Keep the first field visible even if the actions need another row.
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

export function searchGrid(spans: number[]) {
  const { rows, lastRowSpan } = measureSearchGrid(spans);
  return {
    rows,
    lastRowSpan,
    rowsWithActions: rows + Number(lastRowSpan === 24),
    actionSpan: 24 - lastRowSpan || 24,
  };
}

export function searchLayout(spans: number[], minRows: number, collapsed: boolean) {
  const rowLimit = Math.max(1, minRows);
  const { count, rows, lastRowSpan } = measureSearchGrid(
    spans,
    collapsed ? rowLimit : undefined,
  );
  return {
    showExpand: count < spans.length || rows + Number(lastRowSpan === 24) > rowLimit,
    visibleCount: count,
    actionSpan: 24 - lastRowSpan || 24,
  };
}

export function searchDefaults(
  items: SearchFormItemProps[],
  initialValues: SearchValues = {},
) {
  const values = { ...initialValues };
  const clearValues: SearchValues = {};
  for (const item of items) {
    if (!item.name) {
      continue;
    }
    if (item.initialValue !== undefined) {
      values[item.name] = item.initialValue;
    } else if (!(item.name in values) && item.clearValue !== undefined) {
      values[item.name] = item.clearValue;
    }
    if (item.clearValue !== undefined) {
      clearValues[item.name] = item.clearValue;
    }
  }
  return { initialValues: values, clearValues };
}

export interface SearchFormProps {
  className?: string;
  children?: React.ReactNode;
  extraActions?: React.ReactNode;
  initialValues?: SearchValues;
  onSearch?: (values: SearchValues) => void;
  onReset?: (values: SearchValues) => void;
  onValuesChange?: (values: SearchValues) => void;
  loading?: boolean;
  disabled?: boolean;
  collapsed?: boolean;
  defaultCollapsed?: boolean;
  onCollapsedChange?: (value: boolean) => void;
  minRows?: number;
  colSpan?: number;
  labelWidth?: number;
  searchText?: string;
  resetText?: string;
  expandText?: string;
  collapseText?: string;
  embedded?: boolean;
  marginBottom?: number;
}
export interface SearchFormActions {
  submit: () => void;
  reset: () => void;
  setFieldsValue: (values: SearchValues) => void;
}

export const SearchForm = React.forwardRef<SearchFormActions, SearchFormProps>(
  function SearchForm(
    {
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
      searchText = "查询",
      resetText = "重置",
      expandText = "展开",
      collapseText = "收起",
      embedded = false,
      marginBottom = 16,
    },
    ref,
  ) {
    const [form] = Form.useForm();
    const { token } = theme.useToken();
    const canvas = usePlasmicCanvasContext();
    const editing = !!canvas && !canvas.interactive;
    const [localCollapsed, setCollapsed] = useState(defaultCollapsed);
    const isCollapsed = collapsed ?? localCollapsed;
    const displayCollapsed = editing ? false : isCollapsed;
    const items = useMemo(() => collectSearchItems(children), [children]);
    const defaults = useMemo(
      () =>
        searchDefaults(
          items.map((item) => item.props),
          initialValues,
        ),
      [items, initialValues],
    );
    const defaultKey = JSON.stringify(defaults.initialValues);
    const { names, namesKey } = useMemo(() => {
      const fieldNames = items.flatMap((item) =>
        item.props.name ? [item.props.name] : [],
      );
      return { names: fieldNames, namesKey: JSON.stringify(fieldNames) };
    }, [items]);
    const previousNames = useRef(new Set<string>());
    const getValues = () => form.getFieldsValue(names) as SearchValues;
    useEffect(() => {
      const nextNames = new Set(names);
      if (editing) {
        form.resetFields();
      } else {
        previousNames.current.forEach((name) => {
          if (!nextNames.has(name)) {
            form.setFieldValue(name, undefined);
          }
        });
        const addedValues: SearchValues = {};
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
      displayCollapsed,
    );
    const notify = () => onValuesChange?.(getValues());
    const changeCollapsed = (next: boolean) => {
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
      },
    }));
    return (
      <div
        className={className}
        style={
          embedded
            ? { marginBottom: 0 }
            : {
                background: token.colorBgContainer,
                padding: "16px 20px 0",
                borderRadius: 8,
                border: `1px solid ${token.colorBorderSecondary}`,
                marginBottom,
              }
        }
      >
        <Form
          form={form}
          initialValues={defaults.initialValues}
          disabled={disabled}
          preserve
          layout="horizontal"
          labelCol={
            labelWidth === undefined ? undefined : { flex: `${labelWidth}px` }
          }
          wrapperCol={{ flex: "1", style: { minWidth: 0 } }}
          onFinish={onSearch}
          onFinishFailed={({ errorFields }) => {
            if (
              isCollapsed &&
              errorFields.some((error) =>
                items
                  .slice(layout.visibleCount)
                  .some((item) => item.props.name === error.name[0]),
              )
            ) {
              changeCollapsed(false);
            }
          }}
          onValuesChange={(changedValues: SearchValues) => {
            const restored: SearchValues = {};
            for (const [name, clearValue] of Object.entries(
              defaults.clearValues,
            )) {
              if (
                name in changedValues &&
                (changedValues[name] === undefined ||
                  changedValues[name] === null)
              ) {
                restored[name] = clearValue;
              }
            }
            form.setFieldsValue(restored);
            notify();
          }}
        >
          <Row gutter={24}>
            {items.map((item, index) => (
              <Col
                key={item.key ?? item.props.name ?? index}
                span={normalizedSpan(item.props.span ?? colSpan)}
                xs={24}
                sm={12}
                md={normalizedSpan(item.props.span ?? colSpan)}
                style={{
                  display: index < layout.visibleCount ? undefined : "none",
                }}
              >
                {item}
              </Col>
            ))}
            <Col
              span={layout.actionSpan}
              xs={24}
              sm={layout.actionSpan}
              md={layout.actionSpan}
              style={{ textAlign: "right" }}
            >
              <Form.Item style={{ marginBottom: 16 }}>
                <Space
                  size="small"
                  wrap
                  style={{ justifyContent: "flex-end", width: "100%" }}
                >
                  <Button type="primary" htmlType="submit" loading={loading}>
                    {searchText}
                  </Button>
                  <Button onClick={reset}>{resetText}</Button>
                  {extraActions}
                  {layout.showExpand && (
                    <Typography.Link
                      aria-expanded={!displayCollapsed}
                      onClick={() => {
                        changeCollapsed(!isCollapsed);
                      }}
                      style={{
                        fontSize: 12,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        userSelect: "none",
                      }}
                    >
                      <DownOutlined
                        rotate={displayCollapsed ? 0 : 180}
                        style={{ transition: "transform 0.24s" }}
                      />
                      {displayCollapsed ? expandText : collapseText}
                    </Typography.Link>
                  )}
                </Space>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </div>
    );
  },
);
