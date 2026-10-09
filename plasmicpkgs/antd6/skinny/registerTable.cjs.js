'use strict';

var host = require('@plasmicapp/host');
var Ant = require('antd');
var React = require('react');
var registerAdditional = require('./registerAdditional.cjs.js');
var registerTooltip = require('./registerTooltip.cjs.js');
var utils = require('./utils-DlS9-CF8.cjs.js');
require('dayjs');
require('./canvas-overlay-BCQmyJjQ.cjs.js');
require('@plasmicapp/host/registerComponent');
require('@plasmicapp/host/registerGlobalContext');
require('classnames');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var React__default = /*#__PURE__*/_interopDefault(React);

const attr = (value) => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const binding = (code) => `{{ ${code} }}`;
function columnTemplateHtml(props) {
  const value = "column.text";
  const label = "column.label";
  const text = (code = value) => `<span data-plasmic-name="Label">${attr(binding(code))}</span>`;
  const component = (name, values, children = "", attributes = "") => `<plasmic-component data-plasmic-component="plasmic-antd6-${name}" data-plasmic-name="${attr(`${String(props.dataIndex ?? "Cell")} \xB7 ${name} template`)}" data-props="${attr(JSON.stringify(values))}" ${attributes}>${children}</plasmic-component>`;
  const visible = `data-visible-if="${attr(binding('cell != null && String(cell) !== ""'))}"`;
  const size = binding("column.size");
  const content = (() => {
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
        return `<a data-plasmic-name="Link template" href="${attr(binding(value))}" ${visible} ${`target="${attr(binding('column.openInNewTab ? "_blank" : "_self"'))}" rel="noopener noreferrer"`}>${text(label)}</a>`;
      default:
        return text();
    }
  })();
  return props.ellipsis ? component(
    "tooltip",
    { onlyWhenOverflow: true },
    `<slot name="children">${content}</slot><slot name="title">${text(["link", "button"].includes(props.displayType ?? "text") ? label : value)}</slot>`
  ) : content;
}

const rowStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8
};
const inputStyle = {
  appearance: "auto",
  width: 120,
  minWidth: 0,
  height: 26,
  border: "1px solid #ddd",
  borderRadius: 4,
  padding: "2px 6px",
  boxSizing: "border-box",
  background: "white",
  color: "#333",
  font: "inherit"
};
const checkboxStyle = {
  appearance: "auto",
  width: 16,
  height: 16,
  accentColor: "#1677ff"
};
function TablePaginationControl({
  value,
  updateValue,
  componentProps
}) {
  const options = value && typeof value === "object" ? value : {};
  const update = (key, next) => {
    const result = { ...options };
    if (next == null) delete result[key];
    else result[key] = next;
    updateValue(result);
  };
  return /* @__PURE__ */ React__default.default.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 8 } }, /* @__PURE__ */ React__default.default.createElement("label", { style: rowStyle }, "Show pagination", " ", /* @__PURE__ */ React__default.default.createElement(
    "input",
    {
      type: "checkbox",
      style: checkboxStyle,
      "aria-label": "Show pagination",
      checked: value !== false,
      onChange: (e) => updateValue(e.target.checked ? { ...options } : false)
    }
  )), value !== false && /* @__PURE__ */ React__default.default.createElement(React__default.default.Fragment, null, /* @__PURE__ */ React__default.default.createElement("label", { style: rowStyle }, "Page size", " ", /* @__PURE__ */ React__default.default.createElement(
    "input",
    {
      type: "number",
      style: inputStyle,
      "aria-label": "Page size",
      min: 1,
      step: 1,
      value: options.pageSize ?? options.defaultPageSize ?? "",
      placeholder: "10",
      onChange: (e) => {
        if (!e.target.validity.valid) return;
        update(
          options.pageSize !== void 0 ? "pageSize" : "defaultPageSize",
          e.target.value === "" ? null : Number(e.target.value)
        );
      }
    }
  )), /* @__PURE__ */ React__default.default.createElement("label", { style: rowStyle }, "Show size changer", " ", /* @__PURE__ */ React__default.default.createElement(
    "input",
    {
      type: "checkbox",
      style: checkboxStyle,
      "aria-label": "Show size changer",
      checked: options.showSizeChanger ?? (options.total ?? componentProps?.data?.data?.length ?? 0) > 50,
      onChange: (e) => update("showSizeChanger", e.target.checked)
    }
  )), /* @__PURE__ */ React__default.default.createElement("label", { style: rowStyle }, "Show quick jumper", " ", /* @__PURE__ */ React__default.default.createElement(
    "input",
    {
      type: "checkbox",
      style: checkboxStyle,
      "aria-label": "Show quick jumper",
      checked: options.showQuickJumper ?? false,
      onChange: (e) => update("showQuickJumper", e.target.checked)
    }
  ))));
}
function TableScrollControl({
  value,
  updateValue
}) {
  const options = value && typeof value === "object" ? value : {};
  const update = (key, next) => {
    const result = { ...options };
    if (next == null || next === "") delete result[key];
    else result[key] = next;
    updateValue(result);
  };
  return /* @__PURE__ */ React__default.default.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 8 } }, /* @__PURE__ */ React__default.default.createElement("label", { style: rowStyle }, "Horizontal scroll width", " ", /* @__PURE__ */ React__default.default.createElement(
    "input",
    {
      type: "text",
      style: inputStyle,
      "aria-label": "Horizontal scroll width",
      value: options.x ?? "",
      placeholder: "Fit content",
      onChange: (e) => {
        const text = e.target.value.trim();
        update(
          "x",
          text && Number.isFinite(Number(text)) ? Number(text) : text
        );
      }
    }
  )), /* @__PURE__ */ React__default.default.createElement("label", { style: rowStyle }, "Table body height", " ", /* @__PURE__ */ React__default.default.createElement(
    "input",
    {
      type: "number",
      style: inputStyle,
      "aria-label": "Table body height",
      min: 1,
      value: options.y ?? "",
      placeholder: "Grow with content",
      onChange: (e) => {
        if (!e.target.validity.valid) return;
        update("y", e.target.value === "" ? null : Number(e.target.value));
      }
    }
  )));
}

function renderColumnValue(value, props, row, rowIndex, isEditing) {
  const text = value == null ? "" : String(value);
  const label = props.displayLabel ?? text;
  const size = props.contentSize ?? 32;
  const onClick = isEditing ? void 0 : () => props.onCellClick?.(value, row, rowIndex);
  switch (props.displayType) {
    case "link":
      return text ? /* @__PURE__ */ React__default.default.createElement(
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
      return text ? /* @__PURE__ */ React__default.default.createElement(Ant.Avatar, { src: text, size, alt: label, onClick }) : null;
    case "image":
      return text ? /* @__PURE__ */ React__default.default.createElement(
        Ant.Image,
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
      return /* @__PURE__ */ React__default.default.createElement(Ant.Button, { size: "small", onClick }, label);
  }
  if (props.displayType !== "tag") {
    return text;
  }
  return utils.asArray(value).filter((item) => item != null).map((item, index) => /* @__PURE__ */ React__default.default.createElement(
    registerAdditional.AntdTag,
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
  const canvas = host.usePlasmicCanvasContext();
  const selection = host.usePlasmicCanvasComponentInfo(props);
  const cell = props.__plasmic_cell__;
  if (!cell) {
    return null;
  }
  const isEditing = !!canvas && !canvas.interactive;
  const isSelected = isEditing && selection?.isSelected;
  return React__default.default.createElement(
    cell.type,
    {
      ...cell.props,
      className: [cell.props.className, props.className].filter(Boolean).join(" ") || void 0,
      onClick: isEditing ? (event) => event.preventDefault() : cell.props.onClick,
      "data-plasmic-canvas-part": isEditing ? "column" : void 0,
      "data-plasmic-table-column-selected": isSelected || void 0,
      style: cell.props.style,
      title: props.ellipsis ? void 0 : cell.props.title
    },
    props.ellipsis ? /* @__PURE__ */ React__default.default.createElement(registerTooltip.AntdTooltip, { onlyWhenOverflow: true }, props.children) : props.children
  );
}
const AntdColumnGroup = Object.assign(
  function AntdColumnGroup2(props) {
    return /* @__PURE__ */ React__default.default.createElement(AntdColumn, { ...props });
  },
  { __ANT_TABLE_COLUMN_GROUP: true }
);
function renderTableCell({ __plasmic_column__: column, ...props }, type) {
  return column ? React__default.default.cloneElement(column.element, {
    children: props.children,
    __plasmic_cell__: { type: column.type, props }
  }) : React__default.default.createElement(type, props);
}
function TableBodyCell(props) {
  return renderTableCell(props, "td");
}
function TableHeaderCell(props) {
  return renderTableCell(props, "th");
}
function getColumns(children, bodyCell, headerCell, isEditing) {
  return React__default.default.Children.toArray(children).flatMap((child) => {
    if (!React__default.default.isValidElement(child)) {
      return [];
    }
    if (child.type === React__default.default.Fragment) {
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
                const path = utils.asArray(column.dataIndex ?? []);
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
          values: utils.asArray(value).filter((item) => item != null)
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
  const canvas = host.usePlasmicCanvasContext();
  if (columns === void 0 && React__default.default.isValidElement(
    children
  ) && typeof children.props.children === "function") {
    const renderChildren = children.props.children;
    return React__default.default.cloneElement(children, {
      children: (...args) => /* @__PURE__ */ React__default.default.createElement(TableWithColumns, { ...props, components }, renderChildren(...args))
    });
  }
  const pagination = props.pagination !== false && canvas && !canvas.interactive ? {
    ...props.pagination,
    pageSize: props.pagination?.pageSize ?? props.pagination?.defaultPageSize
  } : props.pagination;
  if (columns !== void 0) {
    return /* @__PURE__ */ React__default.default.createElement(
      Ant.Table,
      {
        ...props,
        pagination,
        columns,
        components
      }
    );
  }
  const body = typeof components?.body === "object" ? components.body : void 0;
  return /* @__PURE__ */ React__default.default.createElement(React__default.default.Fragment, null, canvas && !canvas.interactive && /* @__PURE__ */ React__default.default.createElement("style", { "data-plasmic-editor-style": true }, "[data-plasmic-table-column-selected] { outline: 1px solid #1677ff; background: #e6f4ff !important; }"), /* @__PURE__ */ React__default.default.createElement(
    Ant.Table,
    {
      ...props,
      pagination,
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
const AntdTable = React__default.default.forwardRef(function AntdTable2(props, ref) {
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
  const [uncontrolledSelectedRowKeys, setUncontrolledSelectedRowKeys] = React__default.default.useState(defaultSelectedRowKeys ?? []);
  const selection = isSelectable && rowKey ? {
    onChange: (rowKeys, rows) => {
      if (!isControlled) {
        setUncontrolledSelectedRowKeys(rowKeys);
      }
      onSelectedRowsChange?.(rows);
      onSelectedRowKeysChange?.(rowKeys);
    },
    type: isSelectable === "single" ? "radio" : "checkbox",
    selectedRowKeys: isControlled ? utils.asArray(selectedRowKeys) : uncontrolledSelectedRowKeys
  } : void 0;
  React__default.default.useImperativeHandle(
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
  return /* @__PURE__ */ React__default.default.createElement(
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
  utils.registerComponentHelper(loader, AntdTable, {
    name: "plasmic-antd6-table",
    displayName: "Table",
    props: {
      data: {
        type: "dataSourceOpData",
        displayName: "Data"
      },
      children: {
        type: "slot",
        displayName: "Columns",
        allowedComponents: [
          "plasmic-antd6-table-column",
          "plasmic-antd6-table-column-group"
        ]
      },
      bordered: {
        type: "boolean",
        displayName: "Bordered",
        defaultValueHint: false,
        advanced: true
      },
      size: {
        type: "choice",
        displayName: "Size",
        options: [
          { value: "small", label: "Small" },
          { value: "medium", label: "Medium" },
          { value: "large", label: "Large" }
        ],
        defaultValueHint: "large"
      },
      pagination: {
        type: "custom",
        displayName: "Pagination",
        control: TablePaginationControl,
        description: "Configure pagination and page size. Data binding supports the full pagination configuration."
      },
      scroll: {
        type: "custom",
        displayName: "Scroll",
        control: TableScrollControl,
        description: "Horizontal width accepts pixels, percentages, or max-content. Leave it unset to fit content. The table body grows with content when height is unset."
      },
      onChange: {
        type: "eventHandler",
        displayName: "On change",
        argTypes: [
          { name: "pagination", type: "object" },
          { name: "filters", type: "object" },
          { name: "sorter", type: "object" },
          { name: "extra", type: "object" }
        ]
      },
      isSelectable: {
        type: "choice",
        options: [
          { value: "single", label: "Single" },
          { value: "multiple", label: "Multiple" }
        ],
        displayName: "Select rows?"
      },
      rowKey: {
        type: "choice",
        displayName: "Row key",
        description: "Choose a unique, stable field to identify selected rows.",
        options: (_ps, ctx) => {
          if (ctx?.schema) {
            return ctx.schema.fields.map((f) => ({
              value: f.id,
              label: f.label || f.id
            }));
          }
          return Object.keys(ctx?.data?.[0] ?? {});
        },
        hidden: (ps) => !ps.isSelectable
      },
      selectedRowKeys: {
        type: "choice",
        displayName: "Selected row keys",
        multiSelect: (ps) => ps.isSelectable === "multiple",
        options: (ps, ctx) => {
          const key = ps.rowKey;
          if (key && ctx?.data) {
            return ctx.data.map((r) => r[key]);
          }
          return [];
        },
        hidden: (ps) => !ps.rowKey
      },
      onSelectedRowKeysChange: {
        type: "eventHandler",
        displayName: "On selected row keys change",
        argTypes: [{ name: "keys", type: "object" }],
        hidden: (ps) => !ps.isSelectable
      },
      onSelectedRowsChange: {
        type: "eventHandler",
        displayName: "On selected rows change",
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
  utils.registerComponentHelper(loader, AntdColumn, {
    name: "plasmic-antd6-table-column",
    displayName: "Column",
    styleSections: false,
    parentComponentName: "plasmic-antd6-table",
    actions: [
      {
        type: "button-action",
        label: "Convert to editable template",
        hidden: (props) => props.displayType === "custom" || !!props.render,
        onClick: async ({ componentProps, studioOps }) => {
          if (componentProps.render) {
            return;
          }
          await studioOps.replaceSlotContent({
            slotName: "render",
            html: columnTemplateHtml(componentProps),
            props: {
              displayType: "custom",
              templateType: componentProps.displayType ?? "text"
            }
          });
        }
      }
    ],
    props: {
      templateType: {
        type: "choice",
        options: ["text", "tag", "link", "avatar", "image", "button"],
        hidden: () => true
      },
      title: {
        type: "slot",
        displayName: "Title",
        defaultValue: "Title"
      },
      dataIndex: {
        type: "string",
        displayName: "Data index",
        description: "The data field used by this column. Changes apply to every row."
      },
      displayType: {
        type: "choice",
        displayName: "Display type",
        options: [
          { value: "text", label: "Text" },
          { value: "tag", label: "Tag" },
          { value: "link", label: "Link" },
          { value: "avatar", label: "Avatar" },
          { value: "image", label: "Image" },
          { value: "button", label: "Button" },
          { value: "custom", label: "Custom render" }
        ],
        defaultValueHint: (ps) => ps.render ? "custom" : "text",
        description: "Applies to all rows. Convert to a template to select and edit its elements. Existing templates are preserved and can be restored by switching to Custom render."
      },
      displayLabel: {
        type: "string",
        displayName: "Label",
        description: "Uses the field value when unset. Also used as image alt text.",
        hidden: (ps) => !["link", "button", "avatar", "image"].includes(
          (ps.displayType === "custom" ? ps.templateType : ps.displayType) ?? "text"
        )
      },
      contentSize: {
        type: "number",
        displayName: "Image / avatar size",
        defaultValueHint: 32,
        min: 1,
        hidden: (ps) => !["avatar", "image"].includes(
          (ps.displayType === "custom" ? ps.templateType : ps.displayType) ?? "text"
        )
      },
      openInNewTab: {
        type: "boolean",
        displayName: "Open in new tab",
        hidden: (ps) => (ps.displayType === "custom" ? ps.templateType : ps.displayType) !== "link"
      },
      onCellClick: {
        type: "eventHandler",
        displayName: "On cell click",
        description: "Triggered by clicking buttons, links, or avatars in this column. Also available to custom content.",
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
        displayName: "Tag labels and colors",
        hidden: (ps) => (ps.displayType === "custom" ? ps.templateType : ps.displayType) !== "tag",
        description: "Map field values to labels and colors. Unmapped values are assigned colors automatically.",
        itemType: {
          type: "object",
          nameFunc: (item) => item.label || item.value,
          fields: {
            value: { type: "string", displayName: "Value" },
            label: { type: "string", displayName: "Label" },
            color: { type: "color", displayName: "Color" }
          }
        }
      },
      tagColor: {
        type: "color",
        displayName: "Default tag color",
        description: "When unset, colors are assigned by value. Individual item colors take precedence.",
        hidden: (ps) => (ps.displayType === "custom" ? ps.templateType : ps.displayType) !== "tag"
      },
      render: {
        type: "slot",
        renderPropParams: ["cell", "row", "index", "column"],
        hidePlaceholder: true,
        displayName: "Custom render",
        hidden: (ps) => (ps.displayType ?? (ps.render ? "custom" : "text")) !== "custom"
      },
      align: {
        type: "choice",
        displayName: "Align",
        options: [
          { value: "left", label: "Left" },
          { value: "right", label: "Right" },
          { value: "center", label: "Center" }
        ],
        defaultValueHint: "left"
      },
      fixed: {
        type: "choice",
        displayName: "Fixed",
        options: [
          { value: "left", label: "Left" },
          { value: "right", label: "Right" }
        ],
        advanced: true
      },
      colSpan: {
        type: "number",
        displayName: "Col span",
        advanced: true
      },
      width: {
        type: "number",
        displayName: "Width",
        description: "Column width in pixels. Applies to the header and all rows."
      },
      ellipsis: {
        type: "boolean",
        displayName: "Ellipsis",
        description: "Show ellipsis and a Tooltip only when content overflows. Convert to an editable template to customize the Tooltip content."
      }
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerTable",
    importName: "AntdColumn"
  });
  utils.registerComponentHelper(loader, AntdColumnGroup, {
    name: "plasmic-antd6-table-column-group",
    displayName: "Column Group",
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

exports.AntdColumn = AntdColumn;
exports.AntdColumnGroup = AntdColumnGroup;
exports.AntdTable = AntdTable;
exports.registerTable = registerTable;
//# sourceMappingURL=registerTable.cjs.js.map
