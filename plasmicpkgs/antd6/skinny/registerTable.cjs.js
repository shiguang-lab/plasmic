'use strict';

var jsxRuntime = require('react/jsx-runtime');
var host = require('@plasmicapp/host');
var Ant = require('antd');
var React = require('react');
var utils = require('./utils-B1jTF3MA.cjs.js');
require('@plasmicapp/host/registerComponent');
require('@plasmicapp/host/registerGlobalContext');
require('@shiguang-lab/plasmic-antd6/thumbnails');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var React__default = /*#__PURE__*/_interopDefault(React);

const rowStyle = {
  display: "flex",
  minHeight: 32,
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8
};
const inputStyle = {
  width: 120,
  minWidth: 0,
  flexShrink: 0
};
const checkboxStyles = {
  root: {
    ...rowStyle,
    flexDirection: "row-reverse",
    gap: 0,
    font: "inherit"
  },
  label: { flex: 1, paddingInlineStart: 0, paddingInlineEnd: 8 }
};
function TablePaginationControl({
  value,
  updateValue,
  componentProps
}) {
  const options = value && typeof value === "object" ? value : {};
  const update = (key, next) => {
    const result = { ...options };
    if (next == null) {
      delete result[key];
    } else {
      result[key] = next;
    }
    updateValue(result);
  };
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 8, width: "100%" }, children: [
    /* @__PURE__ */ jsxRuntime.jsx(
      Ant.Checkbox,
      {
        styles: checkboxStyles,
        checked: value !== false,
        onChange: (e) => updateValue(e.target.checked ? { ...options } : false),
        children: "Show pagination"
      }
    ),
    value !== false && /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
      /* @__PURE__ */ jsxRuntime.jsxs("label", { style: rowStyle, children: [
        "Page size",
        " ",
        /* @__PURE__ */ jsxRuntime.jsx(
          Ant.Input,
          {
            type: "number",
            style: inputStyle,
            "aria-label": "Page size",
            min: 1,
            step: 1,
            value: options.pageSize ?? options.defaultPageSize ?? "",
            placeholder: "10",
            onChange: (e) => {
              if (!e.target.validity.valid) {
                return;
              }
              update(
                options.pageSize !== void 0 ? "pageSize" : "defaultPageSize",
                e.target.value === "" ? null : Number(e.target.value)
              );
            }
          }
        )
      ] }),
      /* @__PURE__ */ jsxRuntime.jsx(
        Ant.Checkbox,
        {
          styles: checkboxStyles,
          checked: options.showSizeChanger ?? (options.total ?? componentProps?.data?.data?.length ?? 0) > 50,
          onChange: (e) => update("showSizeChanger", e.target.checked),
          children: "Show size changer"
        }
      ),
      /* @__PURE__ */ jsxRuntime.jsx(
        Ant.Checkbox,
        {
          styles: checkboxStyles,
          checked: options.showQuickJumper ?? false,
          onChange: (e) => update("showQuickJumper", e.target.checked),
          children: "Show quick jumper"
        }
      )
    ] })
  ] });
}
function TableScrollControl({
  value,
  updateValue
}) {
  const options = value && typeof value === "object" ? value : {};
  const update = (key, next) => {
    const result = { ...options };
    if (next == null || next === "") {
      delete result[key];
    } else {
      result[key] = next;
    }
    updateValue(result);
  };
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 8, width: "100%" }, children: [
    /* @__PURE__ */ jsxRuntime.jsxs("label", { style: rowStyle, children: [
      /* @__PURE__ */ jsxRuntime.jsx(Ant.Tooltip, { title: "Horizontal scroll width in pixels, a percentage, or max-content. Leave empty to fit the container without horizontal scrolling.", children: /* @__PURE__ */ jsxRuntime.jsx("span", { children: "x" }) }),
      /* @__PURE__ */ jsxRuntime.jsx(
        Ant.Input,
        {
          type: "text",
          style: inputStyle,
          "aria-label": "scroll.x",
          value: options.x ?? "",
          onChange: (e) => {
            const text = e.target.value.trim();
            update(
              "x",
              text && Number.isFinite(Number(text)) ? Number(text) : text
            );
          }
        }
      )
    ] }),
    /* @__PURE__ */ jsxRuntime.jsxs("label", { style: rowStyle, children: [
      /* @__PURE__ */ jsxRuntime.jsx(Ant.Tooltip, { title: "Table body height in pixels. Leave empty to grow with content.", children: /* @__PURE__ */ jsxRuntime.jsx("span", { children: "y" }) }),
      /* @__PURE__ */ jsxRuntime.jsx(
        Ant.Input,
        {
          type: "number",
          style: inputStyle,
          "aria-label": "scroll.y",
          min: 1,
          value: options.y ?? "",
          onChange: (e) => {
            if (!e.target.validity.valid) {
              return;
            }
            update("y", e.target.value === "" ? null : Number(e.target.value));
          }
        }
      )
    ] })
  ] });
}

function AntdColumn(props) {
  const canvas = host.usePlasmicCanvasContext();
  const selection = host.usePlasmicCanvasComponentInfo(props);
  const cell = props.__plasmic_cell__;
  if (!cell) {
    return null;
  }
  const isEditing = !!canvas && !canvas.interactive;
  const selected = isEditing && selection?.selected;
  return React__default.default.createElement(
    cell.type,
    {
      ...cell.props,
      className: [cell.props.className, props.className].filter(Boolean).join(" ") || void 0,
      onClick: isEditing ? (event) => event.preventDefault() : cell.props.onClick,
      "data-plasmic-canvas-part": isEditing ? "column" : void 0,
      "data-plasmic-table-column-selected": selected || void 0,
      style: cell.props.style
    },
    props.children
  );
}
const AntdColumnGroup = Object.assign(
  function AntdColumnGroup2(props) {
    return /* @__PURE__ */ jsxRuntime.jsx(AntdColumn, { ...props });
  },
  { __ANT_TABLE_COLUMN_GROUP: true }
);
function AntdExpandColumn() {
  return null;
}
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
    if (child.type === AntdExpandColumn) {
      return [Ant.Table.EXPAND_COLUMN];
    }
    const {
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
        // Preview initial sorting edits without controlling sorting at runtime.
        ...isEditing && column.sortOrder === void 0 ? { sortOrder: column.defaultSortOrder ?? null } : {},
        onHeaderCell,
        onCell: (row, index) => {
          const cellProps = column.onCell?.(row, index);
          return {
            ...cellProps,
            ...render && !isEditing && child.props.onCellClick ? {
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
        // Without a render slot, Ant Design renders the field value natively.
        ...render ? { render } : {}
      }
    ];
  });
}
function TableWithColumns({
  children,
  columns,
  components,
  contentEditing,
  fullContentView,
  ...props
}) {
  const canvas = host.usePlasmicCanvasContext();
  if (columns === void 0 && React__default.default.isValidElement(
    children
  ) && typeof children.props.children === "function") {
    const renderChildren = children.props.children;
    return React__default.default.cloneElement(children, {
      children: (...args) => /* @__PURE__ */ jsxRuntime.jsx(
        TableWithColumns,
        {
          ...props,
          components,
          contentEditing,
          fullContentView,
          children: renderChildren(...args)
        }
      )
    });
  }
  const pagination = props.pagination !== false && canvas && !canvas.interactive ? {
    ...props.pagination,
    pageSize: props.pagination?.pageSize ?? props.pagination?.defaultPageSize
  } : props.pagination;
  const editingProps = contentEditing ? {
    scroll: void 0,
    virtual: false,
    sticky: false,
    expandable: props.expandable && { ...props.expandable, fixed: void 0 },
    style: { ...props.style, width: "max-content" }
  } : fullContentView ? {
    // Studio's full page height view: render every row in the page flow.
    // Horizontal scrolling and the saved props stay unchanged.
    scroll: props.scroll && { ...props.scroll, y: void 0 },
    virtual: false,
    sticky: false
  } : {};
  const expandColumns = (items) => items.map((column) => column === Ant.Table.EXPAND_COLUMN ? column : {
    ...column,
    fixed: void 0,
    ..."children" in column ? { children: expandColumns(column.children) } : {}
  });
  const prepareColumns = (items) => {
    const visible = props.expandable?.showExpandColumn === false ? items.filter((column) => column !== Ant.Table.EXPAND_COLUMN) : items;
    return contentEditing ? expandColumns(visible) : visible;
  };
  if (columns !== void 0) {
    return /* @__PURE__ */ jsxRuntime.jsx(
      Ant.Table,
      {
        ...props,
        pagination,
        columns: prepareColumns(columns),
        components,
        ...editingProps
      }
    );
  }
  const body = typeof components?.body === "object" ? components.body : void 0;
  return /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
    canvas && !canvas.interactive && /* @__PURE__ */ jsxRuntime.jsx("style", { "data-plasmic-editor-style": true, children: "[data-plasmic-table-column-selected] { outline: 1px solid #1677ff; background: #e6f4ff !important; }" }),
    /* @__PURE__ */ jsxRuntime.jsx(
      Ant.Table,
      {
        ...props,
        pagination,
        "data-plasmic-canvas-part-scope": canvas && !canvas.interactive ? "true" : void 0,
        columns: (() => {
          const resolved = getColumns(
            children,
            body?.cell ?? "td",
            components?.header?.cell ?? "th",
            !!canvas && !canvas.interactive
          );
          return prepareColumns(resolved);
        })(),
        ...editingProps,
        components: {
          ...components,
          header: { ...components?.header, cell: TableHeaderCell },
          body: typeof components?.body === "function" ? components.body : { ...body, cell: TableBodyCell }
        }
      }
    )
  ] });
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
    expandable,
    expandedRowRender,
    onExpand,
    onExpandedRowsChange,
    __canvas: _canvas,
    ...rest
  } = props;
  const canvas = host.usePlasmicCanvasContext();
  const info = host.usePlasmicCanvasComponentInfo(props);
  const isEditing = !!canvas && !canvas.interactive;
  const rowExpansion = expandable || expandedRowRender || onExpand || onExpandedRowsChange ? {
    ...expandable,
    ...expandedRowRender ? { expandedRowRender } : {},
    ...onExpand ? { onExpand } : {},
    ...onExpandedRowsChange ? { onExpandedRowsChange } : {}
  } : void 0;
  const revealRows = isEditing && !!rowExpansion?.expandedRowRender && (info?.editing || info?.selected && info.slot === "expandedRowRender");
  const canvasRowKeys = [];
  if (canvas && rowExpansion) {
    const collect = (rows) => rows.forEach((row) => {
      const key = row[rowKey ?? "key"];
      if (key != null && (!rowExpansion?.rowExpandable || rowExpansion.rowExpandable(row))) {
        canvasRowKeys.push(key);
      }
      const children = row[rowExpansion?.childrenColumnName ?? "children"];
      if (Array.isArray(children)) {
        collect(children);
      }
    });
    collect(data?.data ?? []);
  }
  const initialCanvasKeys = rowExpansion?.expandedRowKeys ?? rowExpansion?.defaultExpandedRowKeys ?? (rowExpansion?.defaultExpandAllRows ? canvasRowKeys : []);
  const expansionState = canvas && rowExpansion ? info?.getState?.(
    "expandable.expandedRowKeys",
    rowExpansion.expandedRowKeys,
    rowExpansion.defaultExpandedRowKeys ?? (rowExpansion.defaultExpandAllRows ? canvasRowKeys : [])
  ) : void 0;
  if (isEditing && expansionState) {
    expansionState.reveal(revealRows ? canvasRowKeys : initialCanvasKeys);
  }
  const resolvedExpansion = canvas && rowExpansion ? {
    ...rowExpansion,
    expandedRowKeys: expansionState ? expansionState.value : isEditing ? initialCanvasKeys : rowExpansion.expandedRowKeys,
    expandRowByClick: isEditing ? false : rowExpansion.expandRowByClick,
    onExpand: isEditing ? void 0 : rowExpansion.onExpand,
    onExpandedRowsChange: isEditing && revealRows ? void 0 : (keys) => {
      expansionState?.set(!isEditing && rowExpansion.expandedRowKeys !== void 0 ? rowExpansion.expandedRowKeys : keys);
      if (!isEditing) {
        rowExpansion.onExpandedRowsChange?.(keys);
      }
    }
  } : rowExpansion;
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
  return /* @__PURE__ */ jsxRuntime.jsx(
    TableWithColumns,
    {
      loading: data?.isLoading,
      dataSource: data?.data,
      rowSelection: selection,
      rowKey,
      ...rest,
      expandable: resolvedExpansion,
      contentEditing: !!canvas && !canvas.interactive && info?.editing,
      fullContentView: !!canvas && !canvas.interactive && info?.fullContent === true
    }
  );
});
function registerTable(loader) {
  utils.registerComponentHelper(loader, AntdTable, {
    description: "Display structured records as rows and columns, with registered controls for sorting, filtering, row selection, pagination and expandable detail content. Configure the relevant data and event props for each behavior.",
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
          "plasmic-antd6-table-column-group",
          "plasmic-antd6-table-expand-column"
        ]
      },
      expandedRowRender: {
        type: "slot",
        displayName: "Expanded row content",
        renderPropParams: ["row", "index", "indent", "expanded"],
        hidePlaceholder: true,
        description: "Row detail template receiving row, index, indent and expanded. Mapped to native expandable.expandedRowRender; takes precedence over a renderer in expandable. Use row fields in this slot. Selecting this slot or Edit contents reveals eligible rows through the temporary canvas session without changing runtime expansion. Selecting the Table alone does not reveal rows. The canvas modifier-click gesture changes temporary keys. Requires data and a stable rowKey."
      },
      onExpand: {
        type: "eventHandler",
        argTypes: [{ name: "expanded", type: "boolean" }, { name: "row", type: "object" }],
        description: "Mapped to native expandable.onExpand(expanded, row). Use MCP createInteraction with eventName onExpand. Top-level handler takes precedence over expandable.onExpand."
      },
      onExpandedRowsChange: {
        type: "eventHandler",
        argTypes: [{ name: "expandedKeys", type: "object" }],
        description: "Mapped to native expandable.onExpandedRowsChange(expandedKeys). Use MCP createInteraction with eventName onExpandedRowsChange to update the state bound to expandable.expandedRowKeys. Top-level handler takes precedence over expandable.onExpandedRowsChange."
      },
      expandable: {
        type: "object",
        displayName: "Expandable rows",
        description: "Native Ant Design expandable configuration. Add Expanded row content to enable row details. Insert one Table.ExpandColumn among Columns to choose its position; otherwise Ant Design places it automatically. State remains in this object; bind expandedRowKeys and update it from the top-level onExpandedRowsChange event for controlled expansion. Top-level render and event props take precedence over callbacks supplied in expandable.",
        fields: {
          showExpandColumn: { type: "boolean", defaultValueHint: true, description: "Show the expansion column. When false, use expandRowByClick or controlled expandedRowKeys to open rows." },
          expandRowByClick: { type: "boolean", defaultValueHint: false },
          columnTitle: { type: "string", description: "Expansion column heading." },
          columnWidth: { type: "number", description: "Expansion column width in pixels." },
          fixed: { type: "choice", options: ["left", "right"], description: "Pin the expansion column while scrolling horizontally. Leave unset for no explicit pinning." },
          rowExpandable: { type: "exprEditor", description: "Predicate (row) => boolean. False prevents that row from expanding; it does not hide the entire column." },
          defaultExpandAllRows: { type: "boolean", defaultValueHint: false, description: "Initially expand all loaded rows. Uncontrolled; defaultExpandedRowKeys takes precedence." },
          defaultExpandedRowKeys: { type: "exprEditor", description: "Initial array of stable rowKey values. User clicks own expansion afterward." },
          expandedRowKeys: { type: "exprEditor", description: "Controlled array of rowKey values. Bind state and update it from onExpandedRowsChange. An empty array closes every row; omit for uncontrolled expansion." }
        }
      },
      title: {
        type: "slot",
        displayName: "Title",
        renderPropParams: ["currentPageData"],
        hidePlaceholder: true,
        description: "Optional content above the column headers. Receives the current page rows as currentPageData; column headings use Column.title."
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
        description: "False hides pagination; otherwise use native pagination options: current, pageSize/defaultPageSize, total, pageSizeOptions, showSizeChanger, and showTotal(total, range) returning content. Bind showTotal to display the total before the pager controls; keep paging and total under this one owner."
      },
      scroll: {
        type: "custom",
        displayName: "Scroll",
        control: TableScrollControl,
        description: "Native Ant Design scroll. Horizontal width accepts pixels, percentages, or max-content; unset keeps the table within its container without horizontal scrolling. The table body grows with content when height is unset."
      },
      onChange: {
        type: "eventHandler",
        displayName: "On change",
        description: "Receives pagination, filters, sorter and extra. Sorter contains field, columnKey and order (ascend/descend, or undefined when cleared); multiple sorting can return an array. extra.action is paginate, sort or filter. With Column.sorter=true, use these values to request server-sorted data; rows are not reordered locally.",
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
        description: "Choose a unique, stable field to identify rows for selection and expansion.",
        options: (ps) => {
          const data = ps.data;
          if (!data || data.isLoading) {
            return void 0;
          }
          if (data.schema) {
            return data.schema.fields.map((f) => ({
              value: f.id,
              label: f.label || f.id
            }));
          }
          return data.data?.length ? Object.keys(data.data[0]) : void 0;
        }
      },
      selectedRowKeys: {
        type: "choice",
        displayName: "Selected row keys",
        multiSelect: (ps) => ps.isSelectable === "multiple",
        options: (ps) => {
          const key = ps.rowKey;
          if (key && ps.data?.data) {
            return ps.data.data.map((r) => r[key]);
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
    description: "Define a data or action column inside Table, including its title, data field and cell renderer. Requires the owning Table.",
    name: "plasmic-antd6-table-column",
    displayName: "Column",
    styleSections: false,
    parentComponentName: "plasmic-antd6-table",
    props: {
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
      render: {
        type: "slot",
        renderPropParams: ["cell", "row", "index"],
        hidePlaceholder: true,
        displayName: "Custom render",
        description: "Native Column.render for every row, receiving cell, row and index. Leave it empty to show the field value."
      },
      onCellClick: {
        type: "eventHandler",
        displayName: "On cell click",
        description: "Triggered by clicking a button, link, or avatar inside Custom render. Receives the cell value, row, and row index.",
        argTypes: [
          { name: "cell", type: "object" },
          { name: "row", type: "object" },
          { name: "index", type: "number" }
        ],
        hidden: (ps) => !ps.render
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
      sorter: {
        type: "exprEditor",
        displayName: "Sorter",
        description: "Native column sorter. For local sorting, use a comparator such as (a, b) => a.amount - b.amount or (a, b) => a.name.localeCompare(b.name). Use true for server sorting through Table On change; true alone does not reorder rows. Use false to disable. Multiple sorting accepts { compare: (a, b) => a.amount - b.amount, multiple: 1 }."
      },
      defaultSortOrder: {
        type: "choice",
        displayName: "Default sort order",
        options: [
          { value: "ascend", label: "Ascending" },
          { value: "descend", label: "Descending" }
        ],
        description: "Initial sorting direction. Leave unset for no initial sorting. Requires Sorter; users can change the direction by clicking the header in Preview."
      },
      sortOrder: {
        type: "choice",
        displayName: "Sort order",
        options: [
          { value: "ascend", label: "Ascending" },
          { value: "descend", label: "Descending" }
        ],
        advanced: true,
        description: "Controlled sorting direction. Bind to state updated by Table On change; use null to clear sorting. Leave unset to let header clicks manage sorting. For single-column sorting, control only one column."
      },
      sortDirections: {
        type: "exprEditor",
        displayName: "Sort directions",
        advanced: true,
        description: 'Header click order. Defaults to ["ascend", "descend"], followed by clearing sorting. Repeat the first direction at the end to prevent clearing.'
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
        description: "Native column width in pixels, applied to the header and all rows."
      },
      ellipsis: {
        type: "exprEditor",
        displayName: "Ellipsis",
        description: "Native column ellipsis: false disables truncation; true enables truncation with the browser title; { showTitle: false } keeps truncation without the cell title. For long text, use { showTitle: false } with a Tooltip in Custom render to show the complete cell value. This option does not create the Tooltip itself."
      }
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerTable",
    importName: "AntdColumn"
  });
  utils.registerComponentHelper(loader, AntdExpandColumn, {
    name: "plasmic-antd6-table-expand-column",
    displayName: "Table.ExpandColumn",
    description: "Place once directly in Table Columns to position the native expansion column. Configure visibility, title, width and fixed side in Table.expandable; put detail content in Table.expandedRowRender. Do not nest in ColumnGroup.",
    parentComponentName: "plasmic-antd6-table",
    styleSections: false,
    props: {},
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerTable",
    importName: "AntdExpandColumn"
  });
  utils.registerComponentHelper(loader, AntdColumnGroup, {
    description: "Group related columns under a shared heading inside Table; contains Column definitions rather than standalone page content.",
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
exports.AntdExpandColumn = AntdExpandColumn;
exports.AntdTable = AntdTable;
exports.registerTable = registerTable;
//# sourceMappingURL=registerTable.cjs.js.map
