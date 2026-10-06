import { usePlasmicCanvasContext, usePlasmicCanvasComponentInfo } from '@plasmicapp/host';
import { Table, Button, Image, Avatar } from 'antd';
import { AntdTag } from './registerAdditional.esm.js';
import React from 'react';
import { b as asArray, r as registerComponentHelper } from './utils-CSvRw6Za.esm.js';
import 'dayjs';
import './canvas-overlay-BurdwRe9.esm.js';
import '@plasmicapp/host/registerComponent';
import '@plasmicapp/host/registerGlobalContext';

const attr = (value) => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const binding = (code) => `{{ ${code} }}`;
function columnTemplateHtml(props) {
  const value = "column.text";
  const label = "column.label";
  const text = (code = value) => `<span data-plasmic-name="\u663E\u793A\u6587\u5B57">${attr(binding(code))}</span>`;
  const component = (name, values, children = "", attributes = "") => `<plasmic-component data-plasmic-component="plasmic-antd6-${name}" data-plasmic-name="${attr(`${String(props.dataIndex ?? "\u5355\u5143\u683C")} \xB7 ${name}\u6A21\u677F`)}" data-props="${attr(JSON.stringify(values))}" ${attributes}>${children}</plasmic-component>`;
  const visible = `data-visible-if="${attr(binding('cell != null && String(cell) !== ""'))}"`;
  const size = binding("column.size");
  switch (props.displayType) {
    case "tag":
      return component(
        "tag",
        {
          value: binding("tagValue"),
          options: binding("column.tagOptions"),
          defaultColor: binding("column.tagColor"),
          automaticColor: true
        },
        '<slot name="children"></slot>',
        `data-repeat="${attr(binding("column.values"))}" data-repeat-item="tagValue"`
      );
    case "avatar":
      return component(
        "avatar",
        { src: binding(value), alt: binding(label), size },
        "",
        visible
      );
    case "image":
      return component(
        "image",
        {
          src: binding(value),
          alt: binding(label),
          width: size,
          height: size,
          objectFit: "cover"
        },
        "",
        visible
      );
    case "button":
      return component(
        "button",
        { size: "small" },
        `<slot name="children">${text(label)}</slot>`
      );
    case "link":
      return `<a data-plasmic-name="\u94FE\u63A5\u6A21\u677F" href="${attr(binding(value))}" ${visible} ${`target="${attr(binding('column.openInNewTab ? "_blank" : "_self"'))}" rel="noopener noreferrer"`}>${text(label)}</a>`;
    default:
      return text();
  }
}

function renderColumnValue(value, props, row, rowIndex, isEditing) {
  const text = value == null ? "" : String(value);
  const label = props.displayLabel ?? text;
  const size = props.contentSize ?? 32;
  const onClick = isEditing ? void 0 : () => props.onCellClick?.(value, row, rowIndex);
  switch (props.displayType) {
    case "link":
      return text ? /* @__PURE__ */ React.createElement(
        "a",
        {
          href: text,
          target: props.openInNewTab ? "_blank" : void 0,
          rel: props.openInNewTab ? "noopener noreferrer" : void 0,
          onClick
        },
        label
      ) : null;
    case "avatar":
      return text ? /* @__PURE__ */ React.createElement(Avatar, { src: text, size, alt: label, onClick }) : null;
    case "image":
      return text ? /* @__PURE__ */ React.createElement(
        Image,
        {
          src: text,
          width: size,
          height: size,
          alt: label,
          preview: !isEditing,
          style: { objectFit: "cover" }
        }
      ) : null;
    case "button":
      return /* @__PURE__ */ React.createElement(Button, { size: "small", onClick }, label);
  }
  if (props.displayType !== "tag") {
    return text;
  }
  return asArray(value).filter((item) => item != null).map((item, index) => /* @__PURE__ */ React.createElement(
    AntdTag,
    {
      key: index,
      value: String(item),
      options: props.tagOptions,
      defaultColor: props.tagColor,
      automaticColor: true
    }
  ));
}
function AntdColumn(props) {
  const canvas = usePlasmicCanvasContext();
  const selection = usePlasmicCanvasComponentInfo(props);
  const cell = props.__plasmic_cell__;
  if (!cell) {
    return null;
  }
  const isEditing = !!canvas && !canvas.interactive;
  const isSelected = isEditing && selection?.isSelected;
  return React.createElement(
    cell.type,
    {
      ...cell.props,
      className: [cell.props.className, props.className].filter(Boolean).join(" ") || void 0,
      onClick: isEditing ? (event) => event.preventDefault() : cell.props.onClick,
      "data-plasmic-canvas-part": isEditing ? "column" : void 0,
      "data-plasmic-table-column-selected": isSelected || void 0,
      style: cell.props.style
    },
    props.children
  );
}
const AntdColumnGroup = Object.assign(
  function AntdColumnGroup2(props) {
    return /* @__PURE__ */ React.createElement(AntdColumn, { ...props });
  },
  { __ANT_TABLE_COLUMN_GROUP: true }
);
function renderTableCell({ __plasmic_column__: column, ...props }, type) {
  return column ? React.cloneElement(column.element, {
    children: props.children,
    __plasmic_cell__: { type: column.type, props }
  }) : React.createElement(type, props);
}
function TableBodyCell(props) {
  return renderTableCell(props, "td");
}
function TableHeaderCell(props) {
  return renderTableCell(props, "th");
}
function getColumns(children, bodyCell, headerCell, isEditing) {
  return React.Children.toArray(children).flatMap((child) => {
    if (!React.isValidElement(child)) {
      return [];
    }
    if (child.type === React.Fragment) {
      return getColumns(child.props.children, bodyCell, headerCell, isEditing);
    }
    const {
      displayType,
      templateType: _templateType,
      tagOptions: _options,
      tagColor: _color,
      displayLabel: _label,
      contentSize: _size,
      openInNewTab: _target,
      onCellClick: _click,
      children: nested,
      render,
      ...column
    } = child.props;
    const onHeaderCell = (col) => ({
      ...column.onHeaderCell?.(col),
      __plasmic_column__: { element: child, type: headerCell }
    });
    if (child.type.__ANT_TABLE_COLUMN_GROUP) {
      return [
        {
          ...column,
          key: child.key ?? column.key,
          onHeaderCell,
          children: getColumns(nested, bodyCell, headerCell, isEditing)
        }
      ];
    }
    return [
      {
        ...column,
        key: child.key ?? column.key,
        onHeaderCell,
        onCell: (row, index) => {
          const cellProps = column.onCell?.(row, index);
          return {
            ...cellProps,
            ...displayType === "custom" && !isEditing && child.props.onCellClick ? {
              onClick: (event) => {
                cellProps?.onClick?.(event);
                const action = event.target.closest?.(
                  "button, a[href], .ant-avatar"
                );
                if (!action || !event.currentTarget.contains(action) || action.matches(":disabled, [aria-disabled=true]")) {
                  return;
                }
                const path = asArray(column.dataIndex ?? []);
                child.props.onCellClick?.(
                  path.reduce((value, field) => value?.[field], row),
                  row,
                  index ?? 0
                );
              }
            } : {},
            __plasmic_column__: { element: child, type: bodyCell }
          };
        },
        render: (value, row, index) => displayType === "custom" || displayType === void 0 && render ? render?.(value, row, index, {
          text: value == null ? "" : String(value),
          label: child.props.displayLabel ?? (value == null ? "" : String(value)),
          size: child.props.contentSize ?? 32,
          openInNewTab: child.props.openInNewTab ?? false,
          tagOptions: child.props.tagOptions ?? [],
          tagColor: child.props.tagColor,
          values: asArray(value).filter((item) => item != null)
        }) : renderColumnValue(value, child.props, row, index, isEditing)
      }
    ];
  });
}
function TableWithColumns({
  children,
  columns,
  components,
  ...props
}) {
  const canvas = usePlasmicCanvasContext();
  if (columns === void 0 && React.isValidElement(
    children
  ) && typeof children.props.children === "function") {
    const renderChildren = children.props.children;
    return React.cloneElement(children, {
      children: (...args) => /* @__PURE__ */ React.createElement(TableWithColumns, { ...props, components }, renderChildren(...args))
    });
  }
  if (columns !== void 0) {
    return /* @__PURE__ */ React.createElement(Table, { ...props, columns, components });
  }
  const body = typeof components?.body === "object" ? components.body : void 0;
  return /* @__PURE__ */ React.createElement(React.Fragment, null, canvas && !canvas.interactive && /* @__PURE__ */ React.createElement("style", { "data-plasmic-editor-style": true }, "[data-plasmic-table-column-selected] { outline: 1px solid #1677ff; background: #e6f4ff !important; }"), /* @__PURE__ */ React.createElement(
    Table,
    {
      ...props,
      "data-plasmic-canvas-part-scope": canvas && !canvas.interactive ? "true" : void 0,
      columns: getColumns(
        children,
        body?.cell ?? "td",
        components?.header?.cell ?? "th",
        !!canvas && !canvas.interactive
      ),
      components: {
        ...components,
        header: { ...components?.header, cell: TableHeaderCell },
        body: typeof components?.body === "function" ? components.body : { ...body, cell: TableBodyCell }
      }
    }
  ));
}
const AntdTable = React.forwardRef(function AntdTable2(props, ref) {
  const {
    data,
    onSelectedRowKeysChange,
    onSelectedRowsChange,
    isSelectable,
    rowKey,
    setControlContextData,
    selectedRowKeys,
    defaultSelectedRowKeys,
    ...rest
  } = props;
  setControlContextData?.(data);
  const isControlled = !!selectedRowKeys;
  const [uncontrolledSelectedRowKeys, setUncontrolledSelectedRowKeys] = React.useState(defaultSelectedRowKeys ?? []);
  const selection = isSelectable && rowKey ? {
    onChange: (rowKeys, rows) => {
      if (!isControlled) {
        setUncontrolledSelectedRowKeys(rowKeys);
      }
      onSelectedRowsChange?.(rows);
      onSelectedRowKeysChange?.(rowKeys);
    },
    type: isSelectable === "single" ? "radio" : "checkbox",
    selectedRowKeys: isControlled ? asArray(selectedRowKeys) : uncontrolledSelectedRowKeys
  } : void 0;
  React.useImperativeHandle(
    ref,
    () => ({
      selectRowByIndex(index) {
        if (data.data && rowKey) {
          const row = data.data[index];
          const rows = row ? [row] : [];
          this._setSelectedRows(rows);
        }
      },
      selectRowsByIndexes(indexes) {
        if (data.data && rowKey) {
          const rows = indexes.map((x) => data.data[x]).filter((x) => !!x);
          this._setSelectedRows(rows);
        }
      },
      selectRowByKey(key) {
        if (data.data && rowKey) {
          const rows = data.data.filter((r) => r[rowKey] === key);
          this._setSelectedRows(rows);
        }
      },
      selectRowsByKeys(keys) {
        if (data.data && rowKey) {
          const rows = data.data.filter((r) => keys.includes(r[rowKey]));
          this._setSelectedRows(rows);
        }
      },
      clearSelection() {
        this._setSelectedRows([]);
      },
      _setSelectedRows(rows) {
        onSelectedRowsChange?.(rows);
        if (rowKey) {
          onSelectedRowKeysChange?.(rows.map((r) => r[rowKey]));
        }
        if (!isControlled) {
          setUncontrolledSelectedRowKeys(rows.map((r) => r[rowKey]));
        }
      }
    }),
    [
      data,
      onSelectedRowKeysChange,
      onSelectedRowsChange,
      isSelectable,
      rowKey,
      isControlled
    ]
  );
  return /* @__PURE__ */ React.createElement(
    TableWithColumns,
    {
      loading: data?.isLoading,
      dataSource: data?.data,
      rowSelection: selection,
      rowKey,
      ...rest,
      scroll: { x: "max-content", ...rest.scroll }
    }
  );
});
function registerTable(loader) {
  registerComponentHelper(loader, AntdTable, {
    name: "plasmic-antd6-table",
    displayName: "Table",
    props: {
      data: {
        type: "dataSourceOpData",
        displayName: "Data"
      },
      children: {
        type: "slot",
        allowedComponents: [
          "plasmic-antd6-table-column",
          "plasmic-antd6-table-column-group"
        ]
      },
      bordered: {
        type: "boolean",
        defaultValueHint: false,
        advanced: true
      },
      size: {
        type: "choice",
        options: ["small", "medium", "large"],
        defaultValueHint: "large"
      },
      pagination: {
        type: "object",
        description: "Ant Design pagination options, or false to hide pagination."
      },
      scroll: {
        type: "object",
        description: "Scrollable table viewport: x is the content width; y is the body height."
      },
      onChange: {
        type: "eventHandler",
        argTypes: [
          { name: "pagination", type: "object" },
          { name: "filters", type: "object" },
          { name: "sorter", type: "object" },
          { name: "extra", type: "object" }
        ]
      },
      isSelectable: {
        type: "choice",
        options: ["single", "multiple"],
        displayName: "Select rows?"
      },
      rowKey: {
        type: "choice",
        options: (_ps, ctx) => {
          if (ctx.schema) {
            return ctx.schema.fields.map((f) => ({
              value: f.id,
              label: f.label || f.id
            }));
          }
          return [];
        },
        hidden: (ps) => !ps.isSelectable
      },
      selectedRowKeys: {
        type: "choice",
        multiSelect: (ps) => ps.isSelectable === "multiple",
        options: (ps, ctx) => {
          const key = ps.rowKey;
          if (key && ctx.data) {
            return ctx.data.map((r) => r[key]);
          }
          return [];
        },
        hidden: (ps) => !ps.rowKey
      },
      onSelectedRowKeysChange: {
        type: "eventHandler",
        argTypes: [{ name: "keys", type: "object" }],
        hidden: (ps) => !ps.isSelectable
      },
      onSelectedRowsChange: {
        type: "eventHandler",
        argTypes: [{ name: "rows", type: "object" }],
        hidden: (ps) => !ps.isSelectable
      }
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerTable",
    importName: "AntdTable",
    states: {
      selectedRowKeys: {
        type: "writable",
        valueProp: "selectedRowKeys",
        onChangeProp: "onSelectedRowKeysChange",
        variableType: "array"
      }
      // selectedRows: {
      //   type: "readonly",
      //   onChangeProp: "onSelectedRowsChange",
      // },
    },
    refActions: {
      selectRowByIndex: {
        displayName: "Select row by index",
        argTypes: [
          {
            name: "index",
            displayName: "Index",
            type: "number"
          }
        ]
      },
      selectRowByKey: {
        displayName: "Select row by key",
        argTypes: [
          {
            name: "key",
            displayName: "Row key",
            type: "string"
          }
        ]
      }
    }
  });
  registerComponentHelper(loader, AntdColumn, {
    name: "plasmic-antd6-table-column",
    displayName: "\u8868\u683C\u5217",
    styleSections: false,
    parentComponentName: "plasmic-antd6-table",
    actions: [
      {
        type: "button-action",
        label: "\u8F6C\u4E3A\u53EF\u7F16\u8F91\u6A21\u677F",
        hidden: (props) => props.displayType === "custom" || !!props.render,
        onClick: async ({ componentProps, studioOps }) => {
          if (componentProps.render) return;
          await studioOps.replaceSlotContent({
            slotName: "render",
            html: columnTemplateHtml(componentProps),
            props: { displayType: "custom", templateType: componentProps.displayType ?? "text" }
          });
        }
      }
    ],
    props: {
      templateType: { type: "choice", options: ["text", "tag", "link", "avatar", "image", "button"], hidden: () => true },
      title: {
        type: "slot",
        displayName: "\u5217\u6807\u9898",
        defaultValue: "\u5217\u6807\u9898"
      },
      dataIndex: {
        type: "string",
        displayName: "\u6570\u636E\u5B57\u6BB5",
        description: "\u672C\u5217\u8BFB\u53D6\u7684\u6570\u636E\u5B57\u6BB5\u3002\u4FEE\u6539\u4F1A\u4F5C\u7528\u4E8E\u6240\u6709\u884C\u3002"
      },
      displayType: {
        type: "choice",
        displayName: "\u663E\u793A\u65B9\u5F0F",
        options: [
          { value: "text", label: "\u6587\u672C" },
          { value: "tag", label: "\u6807\u7B7E" },
          { value: "link", label: "\u94FE\u63A5" },
          { value: "avatar", label: "\u5934\u50CF" },
          { value: "image", label: "\u56FE\u7247" },
          { value: "button", label: "\u6309\u94AE" },
          { value: "custom", label: "\u81EA\u5B9A\u4E49\u5185\u5BB9" }
        ],
        defaultValueHint: (ps) => ps.render ? "custom" : "text",
        description: "\u4F5C\u7528\u4E8E\u6240\u6709\u884C\u3002\u8F6C\u4E3A\u6A21\u677F\u540E\u53EF\u76F4\u63A5\u9009\u62E9\u5185\u90E8\u5143\u7D20\u7F16\u8F91\uFF1B\u5DF2\u6709\u6A21\u677F\u4F1A\u4FDD\u7559\uFF0C\u5207\u56DE\u81EA\u5B9A\u4E49\u5185\u5BB9\u5373\u53EF\u6062\u590D\u3002"
      },
      displayLabel: {
        type: "string",
        displayName: "\u663E\u793A\u6587\u5B57",
        description: "Leave empty to use the field value. Also used as image alternative text.",
        hidden: (ps) => !["link", "button", "avatar", "image"].includes(
          (ps.displayType === "custom" ? ps.templateType : ps.displayType) ?? "text"
        )
      },
      contentSize: {
        type: "number",
        displayName: "\u56FE\u7247 / \u5934\u50CF\u5C3A\u5BF8",
        defaultValueHint: 32,
        min: 1,
        hidden: (ps) => !["avatar", "image"].includes((ps.displayType === "custom" ? ps.templateType : ps.displayType) ?? "text")
      },
      openInNewTab: {
        type: "boolean",
        displayName: "\u5728\u65B0\u6807\u7B7E\u9875\u6253\u5F00",
        hidden: (ps) => (ps.displayType === "custom" ? ps.templateType : ps.displayType) !== "link"
      },
      onCellClick: {
        type: "eventHandler",
        description: "Runs when the column's button, link, or avatar is clicked, including in custom content.",
        argTypes: [
          { name: "cell", type: "object" },
          { name: "row", type: "object" },
          { name: "index", type: "number" }
        ],
        hidden: (ps) => !["button", "link", "avatar", "custom"].includes(
          ps.displayType ?? "text"
        )
      },
      tagOptions: {
        type: "array",
        displayName: "\u6807\u7B7E\u6587\u5B57\u548C\u989C\u8272",
        hidden: (ps) => (ps.displayType === "custom" ? ps.templateType : ps.displayType) !== "tag",
        description: "\u6309\u5B57\u6BB5\u503C\u914D\u7F6E\u663E\u793A\u6587\u5B57\u548C\u989C\u8272\uFF1B\u672A\u914D\u7F6E\u7684\u503C\u81EA\u52A8\u5206\u914D\u989C\u8272\u3002",
        itemType: {
          type: "object",
          nameFunc: (item) => item.label || item.value,
          fields: {
            value: { type: "string", displayName: "\u5B57\u6BB5\u503C" },
            label: { type: "string", displayName: "\u663E\u793A\u6587\u5B57" },
            color: { type: "color", displayName: "\u989C\u8272" }
          }
        }
      },
      tagColor: {
        type: "color",
        displayName: "\u9ED8\u8BA4\u6807\u7B7E\u989C\u8272",
        description: "\u7559\u7A7A\u65F6\u6309\u5B57\u6BB5\u503C\u81EA\u52A8\u5206\u914D\u989C\u8272\uFF1B\u5355\u9879\u989C\u8272\u4F18\u5148\u3002",
        hidden: (ps) => (ps.displayType === "custom" ? ps.templateType : ps.displayType) !== "tag"
      },
      render: {
        type: "slot",
        renderPropParams: ["cell", "row", "index", "column"],
        hidePlaceholder: true,
        displayName: "\u5171\u4EAB\u5355\u5143\u683C\u6A21\u677F",
        hidden: (ps) => (ps.displayType ?? (ps.render ? "custom" : "text")) !== "custom"
      },
      align: {
        type: "choice",
        options: ["left", "right", "center"],
        defaultValueHint: "left"
      },
      fixed: {
        type: "choice",
        options: ["left", "right"],
        advanced: true
      },
      colSpan: {
        type: "number",
        advanced: true
      },
      width: {
        type: "number",
        displayName: "\u5217\u5BBD",
        description: "\u6574\u5217\u5BBD\u5EA6\uFF08\u50CF\u7D20\uFF09\uFF0C\u540C\u65F6\u4F5C\u7528\u4E8E\u8868\u5934\u548C\u6240\u6709\u884C\u3002"
      },
      ellipsis: {
        type: "boolean",
        description: "Ellipsize overflowing cells; Ant Design preserves the full value in the title."
      }
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerTable",
    importName: "AntdColumn"
  });
  registerComponentHelper(loader, AntdColumnGroup, {
    name: "plasmic-antd6-table-column-group",
    displayName: "\u5217\u5206\u7EC4",
    styleSections: false,
    parentComponentName: "plasmic-antd6-table",
    props: {
      title: {
        type: "slot",
        defaultValue: "Column Group Name"
      },
      children: {
        type: "slot",
        allowedComponents: ["plasmic-antd6-table-column"]
      }
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerTable",
    importName: "AntdColumnGroup"
  });
}

export { AntdColumn, AntdColumnGroup, AntdTable, registerTable };
//# sourceMappingURL=registerTable.esm.js.map
