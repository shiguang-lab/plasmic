"use strict";

var host = require("@plasmicapp/host");
var Ant = require("antd");
var React = require("react");
var utils = require("./utils-CRCm44nj.cjs.js");
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
  const value = 'cell == null ? "" : String(cell)';
  const label =
    props.displayLabel == null ? value : JSON.stringify(props.displayLabel);
  const text = (code = value) => `<span>${attr(binding(code))}</span>`;
  const component = (name, values, children = "", attributes = "") =>
    `<plasmic-component data-plasmic-component="plasmic-antd6-${name}" data-props="${attr(JSON.stringify(values))}" ${attributes}>${children}</plasmic-component>`;
  const visible = `data-visible-if="${attr(binding('cell != null && String(cell) !== ""'))}"`;
  const size = props.contentSize ?? 32;
  switch (props.displayType) {
    case "tag": {
      const option = `${JSON.stringify(props.tagOptions ?? [])}.find(option => option.value === String(tagValue))`;
      const colors =
        '["blue","green","orange","purple","cyan","magenta","red","gold"]';
      return component(
        "tag",
        {
          color: binding(
            `(${option})?.color || ${JSON.stringify(props.tagColor ?? "")} || ${colors}[Array.from(String(tagValue)).reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 0) % 8]`,
          ),
        },
        `<slot name="children">${text(`(${option})?.label ?? String(tagValue)`)}</slot>`,
        `data-repeat="${attr(binding("(Array.isArray(cell) ? cell : [cell]).filter(value => value != null)"))}" data-repeat-item="tagValue"`,
      );
    }
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
      return `<a href="${attr(binding(value))}" ${visible}${props.openInNewTab ? ' target="_blank" rel="noopener noreferrer"' : ""}>${text(label)}</a>`;
    default:
      return text();
  }
}

const tagColors = [
  "blue",
  "green",
  "orange",
  "purple",
  "cyan",
  "magenta",
  "red",
  "gold",
];
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
    .map((item, index) => {
      const tagText = String(item);
      const option = props.tagOptions?.find(
        (candidate) => candidate.value === tagText,
      );
      const hash = Array.from(tagText).reduce(
        (currentHash, char) => (currentHash * 31 + char.charCodeAt(0)) >>> 0,
        0,
      );
      return /* @__PURE__ */ React__default.default.createElement(
        Ant.Tag,
        {
          key: index,
          color:
            option?.color ||
            props.tagColor ||
            tagColors[hash % tagColors.length],
        },
        option?.label ?? tagText,
      );
    });
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
      style: {
        ...cell.props.style,
        ...(isSelected
          ? { outline: "1px solid #1677ff", background: "#e6f4ff" }
          : {}),
      },
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
            ? render?.(value, row, index)
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
  if (columns !== void 0) {
    return /* @__PURE__ */ React__default.default.createElement(Ant.Table, {
      ...props,
      columns,
      components,
    });
  }
  const body = typeof components?.body === "object" ? components.body : void 0;
  return /* @__PURE__ */ React__default.default.createElement(Ant.Table, {
    ...props,
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
  });
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
    displayName: "Table",
    props: {
      data: {
        type: "dataSourceOpData",
        displayName: "Data",
      },
      children: {
        type: "slot",
        allowedComponents: [
          "plasmic-antd6-table-column",
          "plasmic-antd6-table-column-group",
        ],
      },
      bordered: {
        type: "boolean",
        defaultValueHint: false,
        advanced: true,
      },
      size: {
        type: "choice",
        options: ["small", "medium", "large"],
        defaultValueHint: "large",
      },
      pagination: {
        type: "object",
        description:
          "Ant Design pagination options, or false to hide pagination.",
      },
      scroll: {
        type: "object",
        description:
          "Scrollable table viewport: x is the content width; y is the body height.",
      },
      onChange: {
        type: "eventHandler",
        argTypes: [
          { name: "pagination", type: "object" },
          { name: "filters", type: "object" },
          { name: "sorter", type: "object" },
          { name: "extra", type: "object" },
        ],
      },
      isSelectable: {
        type: "choice",
        options: ["single", "multiple"],
        displayName: "Select rows?",
      },
      rowKey: {
        type: "choice",
        options: (_ps, ctx) => {
          if (ctx.schema) {
            return ctx.schema.fields.map((f) => ({
              value: f.id,
              label: f.label || f.id,
            }));
          }
          return [];
        },
        hidden: (ps) => !ps.isSelectable,
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
        hidden: (ps) => !ps.rowKey,
      },
      onSelectedRowKeysChange: {
        type: "eventHandler",
        argTypes: [{ name: "keys", type: "object" }],
        hidden: (ps) => !ps.isSelectable,
      },
      onSelectedRowsChange: {
        type: "eventHandler",
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
        displayName: "Select row by index",
        argTypes: [
          {
            name: "index",
            displayName: "Index",
            type: "number",
          },
        ],
      },
      selectRowByKey: {
        displayName: "Select row by key",
        argTypes: [
          {
            name: "key",
            displayName: "Row key",
            type: "string",
          },
        ],
      },
    },
  });
  utils.registerComponentHelper(loader, AntdColumn, {
    name: "plasmic-antd6-table-column",
    displayName: "Column",
    parentComponentName: "plasmic-antd6-table",
    actions: [
      {
        type: "button-action",
        label: "Convert to custom template",
        hidden: (props) =>
          props.displayType === "custom" ||
          (props.displayType === void 0 && !!props.render),
        onClick: async ({ componentProps, studioOps }) => {
          await studioOps.replaceSlotContent({
            slotName: "render",
            html: columnTemplateHtml(componentProps),
            props: { displayType: "custom" },
          });
        },
      },
    ],
    props: {
      title: {
        type: "slot",
        defaultValue: "Column Name",
      },
      dataIndex: {
        type: "string",
        displayName: "Column key",
        description:
          "The field displayed by this column. Changes apply to every row.",
      },
      displayType: {
        type: "choice",
        displayName: "Display as",
        options: [
          { value: "text", label: "Text" },
          { value: "tag", label: "Tag" },
          { value: "link", label: "Link" },
          { value: "avatar", label: "Avatar" },
          { value: "image", label: "Image" },
          { value: "button", label: "Button" },
          { value: "custom", label: "Custom content" },
        ],
        defaultValueHint: (ps) => (ps.render ? "custom" : "text"),
        description:
          "Applies to every row. Use Convert to custom template to edit the preset as shared content.",
      },
      displayLabel: {
        type: "string",
        displayName: "Label",
        description:
          "Leave empty to use the field value. Also used as image alternative text.",
        hidden: (ps) =>
          !["link", "button", "avatar", "image"].includes(
            ps.displayType ?? "text",
          ),
      },
      contentSize: {
        type: "number",
        displayName: "Image size",
        defaultValueHint: 32,
        min: 1,
        hidden: (ps) => !["avatar", "image"].includes(ps.displayType ?? "text"),
      },
      openInNewTab: {
        type: "boolean",
        displayName: "Open in new tab",
        hidden: (ps) => ps.displayType !== "link",
      },
      onCellClick: {
        type: "eventHandler",
        description:
          "Runs when the column's button, link, or avatar is clicked, including in custom content.",
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
        displayName: "Tag labels and colors",
        hidden: (ps) => ps.displayType !== "tag",
        description:
          "Map field values to labels and colors. Unmapped values get an automatic color.",
        itemType: {
          type: "object",
          nameFunc: (item) => item.label || item.value,
          fields: {
            value: { type: "string", displayName: "Field value" },
            label: { type: "string", displayName: "Label" },
            color: { type: "color", displayName: "Color" },
          },
        },
      },
      tagColor: {
        type: "color",
        displayName: "Default tag color",
        description:
          "Leave empty to assign colors by value. Individual tag colors override this setting.",
        hidden: (ps) => ps.displayType !== "tag",
      },
      render: {
        type: "slot",
        renderPropParams: ["cell", "row", "index"],
        hidePlaceholder: true,
        displayName: "Custom render",
        hidden: (ps) =>
          (ps.displayType ?? (ps.render ? "custom" : "text")) !== "custom",
      },
      align: {
        type: "choice",
        options: ["left", "right", "center"],
        defaultValueHint: "left",
      },
      fixed: {
        type: "choice",
        options: ["left", "right"],
        advanced: true,
      },
      colSpan: {
        type: "number",
        advanced: true,
      },
      width: {
        type: "number",
        description: "Column width in pixels.",
      },
      ellipsis: {
        type: "boolean",
        description:
          "Ellipsize overflowing cells; Ant Design preserves the full value in the title.",
      },
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerTable",
    importName: "AntdColumn",
  });
  utils.registerComponentHelper(loader, AntdColumnGroup, {
    name: "plasmic-antd6-table-column-group",
    displayName: "Column Group",
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
