"use strict";

var host = require("@plasmicapp/host");
var Ant = require("antd");
var React = require("react");
var registerAdditional = require("./registerAdditional.cjs.js");
var utils = require("./utils-CRCm44nj.cjs.js");
require("dayjs");
require("./canvas-overlay-S34meFm4.cjs.js");
require("@plasmicapp/host/registerComponent");
require("@plasmicapp/host/registerGlobalContext");

function _interopDefault(e) {
  return e && e.__esModule ? e : { default: e };
}

var React__default = /*#__PURE__*/ _interopDefault(React);

const attr = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
const binding = (code) => `{{ ${code} }}`;
function columnTemplateHtml(props) {
  const value = "column.text";
  const label = "column.label";
  const text = (code = value) =>
    `<span data-plasmic-name="\u663E\u793A\u6587\u5B57">${attr(binding(code))}</span>`;
  const component = (name, values, children = "", attributes = "") =>
    `<plasmic-component data-plasmic-component="plasmic-antd6-${name}" data-plasmic-name="${attr(`${String(props.dataIndex ?? "\u5355\u5143\u683C")} \xB7 ${name}\u6A21\u677F`)}" data-props="${attr(JSON.stringify(values))}" ${attributes}>${children}</plasmic-component>`;
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
          automaticColor: true,
        },
        '<slot name="children"></slot>',
        `data-repeat="${attr(binding("column.values"))}" data-repeat-item="tagValue"`,
      );
    case "avatar":
      return component(
        "avatar",
        { src: binding(value), alt: binding(label), size },
        "",
        visible,
      );
    case "image":
      return component(
        "image",
        {
          src: binding(value),
          alt: binding(label),
          width: size,
          height: size,
          objectFit: "cover",
        },
        "",
        visible,
      );
    case "button":
      return component(
        "button",
        { size: "small" },
        `<slot name="children">${text(label)}</slot>`,
      );
    case "link":
      return `<a data-plasmic-name="\u94FE\u63A5\u6A21\u677F" href="${attr(binding(value))}" ${visible} ${`target="${attr(binding('column.openInNewTab ? "_blank" : "_self"'))}" rel="noopener noreferrer"`}>${text(label)}</a>`;
    default:
      return text();
  }
}

const rowStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
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
  font: "inherit",
};
const checkboxStyle = {
  appearance: "auto",
  width: 16,
  height: 16,
  accentColor: "#1677ff",
};
function TablePaginationControl({ value, updateValue, componentProps }) {
  const options = value && typeof value === "object" ? value : {};
  const update = (key, next) => {
    const result = { ...options };
    if (next == null) delete result[key];
    else result[key] = next;
    updateValue(result);
  };
  return /* @__PURE__ */ React__default.default.createElement(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: 8 } },
    /* @__PURE__ */ React__default.default.createElement(
      "label",
      { style: rowStyle },
      "\u663E\u793A\u5206\u9875",
      " ",
      /* @__PURE__ */ React__default.default.createElement("input", {
        type: "checkbox",
        style: checkboxStyle,
        "aria-label": "\u663E\u793A\u5206\u9875",
        checked: value !== false,
        onChange: (e) => updateValue(e.target.checked ? { ...options } : false),
      }),
    ),
    value !== false &&
      /* @__PURE__ */ React__default.default.createElement(
        React__default.default.Fragment,
        null,
        /* @__PURE__ */ React__default.default.createElement(
          "label",
          { style: rowStyle },
          "\u6BCF\u9875\u6761\u6570",
          " ",
          /* @__PURE__ */ React__default.default.createElement("input", {
            type: "number",
            style: inputStyle,
            "aria-label": "\u6BCF\u9875\u6761\u6570",
            min: 1,
            step: 1,
            value: options.pageSize ?? options.defaultPageSize ?? "",
            placeholder: "10",
            onChange: (e) => {
              if (!e.target.validity.valid) return;
              update(
                options.pageSize !== void 0 ? "pageSize" : "defaultPageSize",
                e.target.value === "" ? null : Number(e.target.value),
              );
            },
          }),
        ),
        /* @__PURE__ */ React__default.default.createElement(
          "label",
          { style: rowStyle },
          "\u53EF\u5207\u6362\u6BCF\u9875\u6761\u6570",
          " ",
          /* @__PURE__ */ React__default.default.createElement("input", {
            type: "checkbox",
            style: checkboxStyle,
            "aria-label": "\u53EF\u5207\u6362\u6BCF\u9875\u6761\u6570",
            checked:
              options.showSizeChanger ??
              (options.total ?? componentProps?.data?.data?.length ?? 0) > 50,
            onChange: (e) => update("showSizeChanger", e.target.checked),
          }),
        ),
        /* @__PURE__ */ React__default.default.createElement(
          "label",
          { style: rowStyle },
          "\u5FEB\u901F\u8DF3\u9875",
          " ",
          /* @__PURE__ */ React__default.default.createElement("input", {
            type: "checkbox",
            style: checkboxStyle,
            "aria-label": "\u5FEB\u901F\u8DF3\u9875",
            checked: options.showQuickJumper ?? false,
            onChange: (e) => update("showQuickJumper", e.target.checked),
          }),
        ),
      ),
  );
}
function TableScrollControl({ value, updateValue }) {
  const options = value && typeof value === "object" ? value : {};
  const update = (key, next) => {
    const result = { ...options };
    if (next == null || next === "") delete result[key];
    else result[key] = next;
    updateValue(result);
  };
  return /* @__PURE__ */ React__default.default.createElement(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: 8 } },
    /* @__PURE__ */ React__default.default.createElement(
      "label",
      { style: rowStyle },
      "\u6C34\u5E73\u6EDA\u52A8\u5BBD\u5EA6",
      " ",
      /* @__PURE__ */ React__default.default.createElement("input", {
        type: "text",
        style: inputStyle,
        "aria-label": "\u6C34\u5E73\u6EDA\u52A8\u5BBD\u5EA6",
        value: options.x ?? "",
        placeholder: "\u81EA\u52A8\u9002\u5E94\u5185\u5BB9",
        onChange: (e) => {
          const text = e.target.value.trim();
          update(
            "x",
            text && Number.isFinite(Number(text)) ? Number(text) : text,
          );
        },
      }),
    ),
    /* @__PURE__ */ React__default.default.createElement(
      "label",
      { style: rowStyle },
      "\u8868\u4F53\u6700\u5927\u9AD8\u5EA6",
      " ",
      /* @__PURE__ */ React__default.default.createElement("input", {
        type: "number",
        style: inputStyle,
        "aria-label": "\u8868\u4F53\u6700\u5927\u9AD8\u5EA6",
        min: 1,
        value: options.y ?? "",
        placeholder: "\u968F\u5185\u5BB9\u589E\u957F",
        onChange: (e) => {
          if (!e.target.validity.valid) return;
          update("y", e.target.value === "" ? null : Number(e.target.value));
        },
      }),
    ),
  );
}

function renderColumnValue(value, props, row, rowIndex, isEditing) {
  const text = value == null ? "" : String(value);
  const label = props.displayLabel ?? text;
  const size = props.contentSize ?? 32;
  const onClick = isEditing
    ? void 0
    : () => props.onCellClick?.(value, row, rowIndex);
  switch (props.displayType) {
    case "link":
      return text
        ? /* @__PURE__ */ React__default.default.createElement(
            "a",
            {
              href: text,
              target: props.openInNewTab ? "_blank" : void 0,
              rel: props.openInNewTab ? "noopener noreferrer" : void 0,
              onClick,
            },
            label,
          )
        : null;
    case "avatar":
      return text
        ? /* @__PURE__ */ React__default.default.createElement(Ant.Avatar, {
            src: text,
            size,
            alt: label,
            onClick,
          })
        : null;
    case "image":
      return text
        ? /* @__PURE__ */ React__default.default.createElement(Ant.Image, {
            src: text,
            width: size,
            height: size,
            alt: label,
            preview: !isEditing,
            style: { objectFit: "cover" },
          })
        : null;
    case "button":
      return /* @__PURE__ */ React__default.default.createElement(
        Ant.Button,
        { size: "small", onClick },
        label,
      );
  }
  if (props.displayType !== "tag") {
    return text;
  }
  return utils
    .asArray(value)
    .filter((item) => item != null)
    .map((item, index) =>
      /* @__PURE__ */ React__default.default.createElement(
        registerAdditional.AntdTag,
        {
          key: index,
          value: String(item),
          options: props.tagOptions,
          defaultColor: props.tagColor,
          automaticColor: true,
        },
      ),
    );
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
      className:
        [cell.props.className, props.className].filter(Boolean).join(" ") ||
        void 0,
      onClick: isEditing
        ? (event) => event.preventDefault()
        : cell.props.onClick,
      "data-plasmic-canvas-part": isEditing ? "column" : void 0,
      "data-plasmic-table-column-selected": isSelected || void 0,
      style: cell.props.style,
    },
    props.children,
  );
}
const AntdColumnGroup = Object.assign(
  function AntdColumnGroup2(props) {
    return /* @__PURE__ */ React__default.default.createElement(AntdColumn, {
      ...props,
    });
  },
  { __ANT_TABLE_COLUMN_GROUP: true },
);
function renderTableCell({ __plasmic_column__: column, ...props }, type) {
  return column
    ? React__default.default.cloneElement(column.element, {
        children: props.children,
        __plasmic_cell__: { type: column.type, props },
      })
    : React__default.default.createElement(type, props);
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
      __plasmic_column__: { element: child, type: headerCell },
    });
    if (child.type.__ANT_TABLE_COLUMN_GROUP) {
      return [
        {
          ...column,
          key: child.key ?? column.key,
          onHeaderCell,
          children: getColumns(nested, bodyCell, headerCell, isEditing),
        },
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
            ...(displayType === "custom" &&
            !isEditing &&
            child.props.onCellClick
              ? {
                  onClick: (event) => {
                    cellProps?.onClick?.(event);
                    const action = event.target.closest?.(
                      "button, a[href], .ant-avatar",
                    );
                    if (
                      !action ||
                      !event.currentTarget.contains(action) ||
                      action.matches(":disabled, [aria-disabled=true]")
                    ) {
                      return;
                    }
                    const path = utils.asArray(column.dataIndex ?? []);
                    child.props.onCellClick?.(
                      path.reduce((value, field) => value?.[field], row),
                      row,
                      index ?? 0,
                    );
                  },
                }
              : {}),
            __plasmic_column__: { element: child, type: bodyCell },
          };
        },
        render: (value, row, index) =>
          displayType === "custom" || (displayType === void 0 && render)
            ? render?.(value, row, index, {
                text: value == null ? "" : String(value),
                label:
                  child.props.displayLabel ??
                  (value == null ? "" : String(value)),
                size: child.props.contentSize ?? 32,
                openInNewTab: child.props.openInNewTab ?? false,
                tagOptions: child.props.tagOptions ?? [],
                tagColor: child.props.tagColor,
                values: utils.asArray(value).filter((item) => item != null),
              })
            : renderColumnValue(value, child.props, row, index, isEditing),
      },
    ];
  });
}
function TableWithColumns({ children, columns, components, ...props }) {
  const canvas = host.usePlasmicCanvasContext();
  if (
    columns === void 0 &&
    React__default.default.isValidElement(children) &&
    typeof children.props.children === "function"
  ) {
    const renderChildren = children.props.children;
    return React__default.default.cloneElement(children, {
      children: (...args) =>
        /* @__PURE__ */ React__default.default.createElement(
          TableWithColumns,
          { ...props, components },
          renderChildren(...args),
        ),
    });
  }
  const pagination =
    props.pagination !== false && canvas && !canvas.interactive
      ? {
          ...props.pagination,
          pageSize:
            props.pagination?.pageSize ?? props.pagination?.defaultPageSize,
        }
      : props.pagination;
  if (columns !== void 0) {
    return /* @__PURE__ */ React__default.default.createElement(Ant.Table, {
      ...props,
      pagination,
      columns,
      components,
    });
  }
  const body = typeof components?.body === "object" ? components.body : void 0;
  return /* @__PURE__ */ React__default.default.createElement(
    React__default.default.Fragment,
    null,
    canvas &&
      !canvas.interactive &&
      /* @__PURE__ */ React__default.default.createElement(
        "style",
        { "data-plasmic-editor-style": true },
        "[data-plasmic-table-column-selected] { outline: 1px solid #1677ff; background: #e6f4ff !important; }",
      ),
    /* @__PURE__ */ React__default.default.createElement(Ant.Table, {
      ...props,
      pagination,
      "data-plasmic-canvas-part-scope":
        canvas && !canvas.interactive ? "true" : void 0,
      columns: getColumns(
        children,
        body?.cell ?? "td",
        components?.header?.cell ?? "th",
        !!canvas && !canvas.interactive,
      ),
      components: {
        ...components,
        header: { ...components?.header, cell: TableHeaderCell },
        body:
          typeof components?.body === "function"
            ? components.body
            : { ...body, cell: TableBodyCell },
      },
    }),
  );
}
const AntdTable = React__default.default.forwardRef(
  function AntdTable2(props, ref) {
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
    const [uncontrolledSelectedRowKeys, setUncontrolledSelectedRowKeys] =
      React__default.default.useState(defaultSelectedRowKeys ?? []);
    const selection =
      isSelectable && rowKey
        ? {
            onChange: (rowKeys, rows) => {
              if (!isControlled) {
                setUncontrolledSelectedRowKeys(rowKeys);
              }
              onSelectedRowsChange?.(rows);
              onSelectedRowKeysChange?.(rowKeys);
            },
            type: isSelectable === "single" ? "radio" : "checkbox",
            selectedRowKeys: isControlled
              ? utils.asArray(selectedRowKeys)
              : uncontrolledSelectedRowKeys,
          }
        : void 0;
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
        },
      }),
      [
        data,
        onSelectedRowKeysChange,
        onSelectedRowsChange,
        isSelectable,
        rowKey,
        isControlled,
      ],
    );
    return /* @__PURE__ */ React__default.default.createElement(
      TableWithColumns,
      {
        loading: data?.isLoading,
        dataSource: data?.data,
        rowSelection: selection,
        rowKey,
        ...rest,
        scroll: { x: "max-content", ...rest.scroll },
      },
    );
  },
);
function registerTable(loader) {
  utils.registerComponentHelper(loader, AntdTable, {
    name: "plasmic-antd6-table",
    displayName: "\u8868\u683C",
    props: {
      data: {
        type: "dataSourceOpData",
        displayName: "\u6570\u636E",
      },
      children: {
        type: "slot",
        displayName: "\u5217\u914D\u7F6E",
        allowedComponents: [
          "plasmic-antd6-table-column",
          "plasmic-antd6-table-column-group",
        ],
      },
      bordered: {
        type: "boolean",
        displayName: "\u663E\u793A\u8FB9\u6846",
        defaultValueHint: false,
        advanced: true,
      },
      size: {
        type: "choice",
        displayName: "\u884C\u5BC6\u5EA6",
        options: [
          { value: "small", label: "\u7D27\u51D1" },
          { value: "medium", label: "\u9002\u4E2D" },
          { value: "large", label: "\u5BBD\u677E" },
        ],
        defaultValueHint: "large",
      },
      pagination: {
        type: "custom",
        displayName: "\u5206\u9875",
        control: TablePaginationControl,
        description:
          "\u8BBE\u7F6E\u5206\u9875\u548C\u6BCF\u9875\u6761\u6570\uFF1B\u6570\u636E\u7ED1\u5B9A\u53EF\u63A7\u5236\u5B8C\u6574\u5206\u9875\u914D\u7F6E\u3002",
      },
      scroll: {
        type: "custom",
        displayName: "\u6EDA\u52A8\u533A\u57DF",
        control: TableScrollControl,
        description:
          "\u6C34\u5E73\u5BBD\u5EA6\u652F\u6301\u50CF\u7D20\u3001\u767E\u5206\u6BD4\u6216 max-content\uFF1B\u7559\u7A7A\u81EA\u52A8\u9002\u5E94\u5185\u5BB9\u3002\u8868\u4F53\u9AD8\u5EA6\u7559\u7A7A\u65F6\u968F\u5185\u5BB9\u589E\u957F\u3002",
      },
      onChange: {
        type: "eventHandler",
        displayName:
          "\u5206\u9875\u3001\u7B5B\u9009\u6216\u6392\u5E8F\u53D8\u5316",
        argTypes: [
          { name: "pagination", type: "object" },
          { name: "filters", type: "object" },
          { name: "sorter", type: "object" },
          { name: "extra", type: "object" },
        ],
      },
      isSelectable: {
        type: "choice",
        options: [
          { value: "single", label: "\u5355\u9009" },
          { value: "multiple", label: "\u591A\u9009" },
        ],
        displayName: "\u884C\u9009\u62E9\u65B9\u5F0F",
      },
      rowKey: {
        type: "choice",
        displayName: "\u884C\u6807\u8BC6\u5B57\u6BB5",
        description:
          "\u9009\u62E9\u6BCF\u884C\u552F\u4E00\u4E14\u7A33\u5B9A\u7684\u5B57\u6BB5\uFF0C\u7528\u4E8E\u8BB0\u5F55\u884C\u9009\u62E9\u3002",
        options: (_ps, ctx) => {
          if (ctx?.schema) {
            return ctx.schema.fields.map((f) => ({
              value: f.id,
              label: f.label || f.id,
            }));
          }
          return Object.keys(ctx?.data?.[0] ?? {});
        },
        hidden: (ps) => !ps.isSelectable,
      },
      selectedRowKeys: {
        type: "choice",
        displayName: "\u5DF2\u9009\u884C\u6807\u8BC6",
        multiSelect: (ps) => ps.isSelectable === "multiple",
        options: (ps, ctx) => {
          const key = ps.rowKey;
          if (key && ctx?.data) {
            return ctx.data.map((r) => r[key]);
          }
          return [];
        },
        hidden: (ps) => !ps.rowKey,
      },
      onSelectedRowKeysChange: {
        type: "eventHandler",
        displayName: "\u5DF2\u9009\u884C\u6807\u8BC6\u53D8\u5316",
        argTypes: [{ name: "keys", type: "object" }],
        hidden: (ps) => !ps.isSelectable,
      },
      onSelectedRowsChange: {
        type: "eventHandler",
        displayName: "\u5DF2\u9009\u884C\u6570\u636E\u53D8\u5316",
        argTypes: [{ name: "rows", type: "object" }],
        hidden: (ps) => !ps.isSelectable,
      },
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerTable",
    importName: "AntdTable",
    states: {
      selectedRowKeys: {
        type: "writable",
        valueProp: "selectedRowKeys",
        onChangeProp: "onSelectedRowKeysChange",
        variableType: "array",
      },
      // selectedRows: {
      //   type: "readonly",
      //   onChangeProp: "onSelectedRowsChange",
      // },
    },
    refActions: {
      selectRowByIndex: {
        displayName: "\u6309\u5E8F\u53F7\u9009\u62E9\u884C",
        argTypes: [
          {
            name: "index",
            displayName: "\u884C\u5E8F\u53F7",
            type: "number",
          },
        ],
      },
      selectRowByKey: {
        displayName: "\u6309\u6807\u8BC6\u9009\u62E9\u884C",
        argTypes: [
          {
            name: "key",
            displayName: "\u884C\u6807\u8BC6",
            type: "string",
          },
        ],
      },
    },
  });
  utils.registerComponentHelper(loader, AntdColumn, {
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
          if (componentProps.render) {
            return;
          }
          await studioOps.replaceSlotContent({
            slotName: "render",
            html: columnTemplateHtml(componentProps),
            props: {
              displayType: "custom",
              templateType: componentProps.displayType ?? "text",
            },
          });
        },
      },
    ],
    props: {
      templateType: {
        type: "choice",
        options: ["text", "tag", "link", "avatar", "image", "button"],
        hidden: () => true,
      },
      title: {
        type: "slot",
        displayName: "\u5217\u6807\u9898",
        defaultValue: "\u5217\u6807\u9898",
      },
      dataIndex: {
        type: "string",
        displayName: "\u6570\u636E\u5B57\u6BB5",
        description:
          "\u672C\u5217\u8BFB\u53D6\u7684\u6570\u636E\u5B57\u6BB5\u3002\u4FEE\u6539\u4F1A\u4F5C\u7528\u4E8E\u6240\u6709\u884C\u3002",
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
          { value: "custom", label: "\u81EA\u5B9A\u4E49\u5185\u5BB9" },
        ],
        defaultValueHint: (ps) => (ps.render ? "custom" : "text"),
        description:
          "\u4F5C\u7528\u4E8E\u6240\u6709\u884C\u3002\u8F6C\u4E3A\u6A21\u677F\u540E\u53EF\u76F4\u63A5\u9009\u62E9\u5185\u90E8\u5143\u7D20\u7F16\u8F91\uFF1B\u5DF2\u6709\u6A21\u677F\u4F1A\u4FDD\u7559\uFF0C\u5207\u56DE\u81EA\u5B9A\u4E49\u5185\u5BB9\u5373\u53EF\u6062\u590D\u3002",
      },
      displayLabel: {
        type: "string",
        displayName: "\u663E\u793A\u6587\u5B57",
        description:
          "\u7559\u7A7A\u65F6\u4F7F\u7528\u5B57\u6BB5\u503C\uFF0C\u4E5F\u7528\u4F5C\u56FE\u7247\u66FF\u4EE3\u6587\u5B57\u3002",
        hidden: (ps) =>
          !["link", "button", "avatar", "image"].includes(
            (ps.displayType === "custom" ? ps.templateType : ps.displayType) ??
              "text",
          ),
      },
      contentSize: {
        type: "number",
        displayName: "\u56FE\u7247 / \u5934\u50CF\u5C3A\u5BF8",
        defaultValueHint: 32,
        min: 1,
        hidden: (ps) =>
          !["avatar", "image"].includes(
            (ps.displayType === "custom" ? ps.templateType : ps.displayType) ??
              "text",
          ),
      },
      openInNewTab: {
        type: "boolean",
        displayName: "\u5728\u65B0\u6807\u7B7E\u9875\u6253\u5F00",
        hidden: (ps) =>
          (ps.displayType === "custom" ? ps.templateType : ps.displayType) !==
          "link",
      },
      onCellClick: {
        type: "eventHandler",
        displayName: "\u70B9\u51FB\u5355\u5143\u683C",
        description:
          "\u70B9\u51FB\u672C\u5217\u7684\u6309\u94AE\u3001\u94FE\u63A5\u6216\u5934\u50CF\u65F6\u89E6\u53D1\uFF0C\u4E5F\u9002\u7528\u4E8E\u81EA\u5B9A\u4E49\u5185\u5BB9\u3002",
        argTypes: [
          { name: "cell", type: "object" },
          { name: "row", type: "object" },
          { name: "index", type: "number" },
        ],
        hidden: (ps) =>
          !["button", "link", "avatar", "custom"].includes(
            ps.displayType ?? "text",
          ),
      },
      tagOptions: {
        type: "array",
        displayName: "\u6807\u7B7E\u6587\u5B57\u548C\u989C\u8272",
        hidden: (ps) =>
          (ps.displayType === "custom" ? ps.templateType : ps.displayType) !==
          "tag",
        description:
          "\u6309\u5B57\u6BB5\u503C\u914D\u7F6E\u663E\u793A\u6587\u5B57\u548C\u989C\u8272\uFF1B\u672A\u914D\u7F6E\u7684\u503C\u81EA\u52A8\u5206\u914D\u989C\u8272\u3002",
        itemType: {
          type: "object",
          nameFunc: (item) => item.label || item.value,
          fields: {
            value: { type: "string", displayName: "\u5B57\u6BB5\u503C" },
            label: { type: "string", displayName: "\u663E\u793A\u6587\u5B57" },
            color: { type: "color", displayName: "\u989C\u8272" },
          },
        },
      },
      tagColor: {
        type: "color",
        displayName: "\u9ED8\u8BA4\u6807\u7B7E\u989C\u8272",
        description:
          "\u7559\u7A7A\u65F6\u6309\u5B57\u6BB5\u503C\u81EA\u52A8\u5206\u914D\u989C\u8272\uFF1B\u5355\u9879\u989C\u8272\u4F18\u5148\u3002",
        hidden: (ps) =>
          (ps.displayType === "custom" ? ps.templateType : ps.displayType) !==
          "tag",
      },
      render: {
        type: "slot",
        renderPropParams: ["cell", "row", "index", "column"],
        hidePlaceholder: true,
        displayName: "\u5171\u4EAB\u5355\u5143\u683C\u6A21\u677F",
        hidden: (ps) =>
          (ps.displayType ?? (ps.render ? "custom" : "text")) !== "custom",
      },
      align: {
        type: "choice",
        displayName: "\u5BF9\u9F50\u65B9\u5F0F",
        options: [
          { value: "left", label: "\u5DE6\u5BF9\u9F50" },
          { value: "right", label: "\u53F3\u5BF9\u9F50" },
          { value: "center", label: "\u5C45\u4E2D" },
        ],
        defaultValueHint: "left",
      },
      fixed: {
        type: "choice",
        displayName: "\u56FA\u5B9A\u5217",
        options: [
          { value: "left", label: "\u5DE6\u4FA7" },
          { value: "right", label: "\u53F3\u4FA7" },
        ],
        advanced: true,
      },
      colSpan: {
        type: "number",
        displayName: "\u5408\u5E76\u5217\u6570",
        advanced: true,
      },
      width: {
        type: "number",
        displayName: "\u5217\u5BBD",
        description:
          "\u6574\u5217\u5BBD\u5EA6\uFF08\u50CF\u7D20\uFF09\uFF0C\u540C\u65F6\u4F5C\u7528\u4E8E\u8868\u5934\u548C\u6240\u6709\u884C\u3002",
      },
      ellipsis: {
        type: "boolean",
        displayName: "\u8D85\u957F\u5185\u5BB9\u7701\u7565",
        description:
          "\u8D85\u957F\u5185\u5BB9\u663E\u793A\u7701\u7565\u53F7\uFF0C\u60AC\u505C\u53EF\u67E5\u770B\u5B8C\u6574\u6587\u5B57\u3002",
      },
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerTable",
    importName: "AntdColumn",
  });
  utils.registerComponentHelper(loader, AntdColumnGroup, {
    name: "plasmic-antd6-table-column-group",
    displayName: "\u5217\u5206\u7EC4",
    styleSections: false,
    parentComponentName: "plasmic-antd6-table",
    props: {
      title: {
        type: "slot",
        defaultValue: "Column Group Name",
      },
      children: {
        type: "slot",
        allowedComponents: ["plasmic-antd6-table-column"],
      },
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerTable",
    importName: "AntdColumnGroup",
  });
}

exports.AntdColumn = AntdColumn;
exports.AntdColumnGroup = AntdColumnGroup;
exports.AntdTable = AntdTable;
exports.registerTable = registerTable;
//# sourceMappingURL=registerTable.cjs.js.map
