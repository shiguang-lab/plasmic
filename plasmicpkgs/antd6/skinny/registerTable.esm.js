import { usePlasmicCanvasContext, usePlasmicCanvasComponentInfo } from '@plasmicapp/host';
import { Tooltip, Input, Checkbox, Table } from 'antd';
import React from 'react';
import { b as asArray, r as registerComponentHelper } from './utils-Cmdig6Yl.esm.js';
import '@plasmicapp/host/registerComponent';
import '@plasmicapp/host/registerGlobalContext';

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
  return /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 8, width: "100%" } }, /* @__PURE__ */ React.createElement(
    Checkbox,
    {
      styles: checkboxStyles,
      checked: value !== false,
      onChange: (e) => updateValue(e.target.checked ? { ...options } : false)
    },
    "Show pagination"
  ), value !== false && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("label", { style: rowStyle }, "Page size", " ", /* @__PURE__ */ React.createElement(
    Input,
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
  )), /* @__PURE__ */ React.createElement(
    Checkbox,
    {
      styles: checkboxStyles,
      checked: options.showSizeChanger ?? (options.total ?? componentProps?.data?.data?.length ?? 0) > 50,
      onChange: (e) => update("showSizeChanger", e.target.checked)
    },
    "Show size changer"
  ), /* @__PURE__ */ React.createElement(
    Checkbox,
    {
      styles: checkboxStyles,
      checked: options.showQuickJumper ?? false,
      onChange: (e) => update("showQuickJumper", e.target.checked)
    },
    "Show quick jumper"
  )));
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
  return /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 8, width: "100%" } }, /* @__PURE__ */ React.createElement("label", { style: rowStyle }, /* @__PURE__ */ React.createElement(Tooltip, { title: "Horizontal scroll width in pixels, a percentage, or max-content. Leave empty to fit the container without horizontal scrolling." }, /* @__PURE__ */ React.createElement("span", null, "x")), /* @__PURE__ */ React.createElement(
    Input,
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
  )), /* @__PURE__ */ React.createElement("label", { style: rowStyle }, /* @__PURE__ */ React.createElement(Tooltip, { title: "Table body height in pixels. Leave empty to grow with content." }, /* @__PURE__ */ React.createElement("span", null, "y")), /* @__PURE__ */ React.createElement(
    Input,
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
  )));
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
function AntdExpandColumn() {
  return null;
}
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
    if (child.type === AntdExpandColumn) {
      return [Table.EXPAND_COLUMN];
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
  const canvas = usePlasmicCanvasContext();
  if (columns === void 0 && React.isValidElement(
    children
  ) && typeof children.props.children === "function") {
    const renderChildren = children.props.children;
    return React.cloneElement(children, {
      children: (...args) => /* @__PURE__ */ React.createElement(
        TableWithColumns,
        {
          ...props,
          components,
          contentEditing,
          fullContentView
        },
        renderChildren(...args)
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
  const expandColumns = (items) => items.map((column) => column === Table.EXPAND_COLUMN ? column : {
    ...column,
    fixed: void 0,
    ..."children" in column ? { children: expandColumns(column.children) } : {}
  });
  const prepareColumns = (items) => {
    const visible = props.expandable?.showExpandColumn === false ? items.filter((column) => column !== Table.EXPAND_COLUMN) : items;
    return contentEditing ? expandColumns(visible) : visible;
  };
  if (columns !== void 0) {
    return /* @__PURE__ */ React.createElement(
      Table,
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
  return /* @__PURE__ */ React.createElement(React.Fragment, null, canvas && !canvas.interactive && /* @__PURE__ */ React.createElement("style", { "data-plasmic-editor-style": true }, "[data-plasmic-table-column-selected] { outline: 1px solid #1677ff; background: #e6f4ff !important; }"), /* @__PURE__ */ React.createElement(
    Table,
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
    canvasExpandedRowKeys,
    expandable,
    expandedRowRender,
    onExpand,
    onExpandedRowsChange,
    ...rest
  } = props;
  const canvas = usePlasmicCanvasContext();
  const info = usePlasmicCanvasComponentInfo(props);
  const isEditing = !!canvas && !canvas.interactive;
  const rowExpansion = expandable || expandedRowRender || onExpand || onExpandedRowsChange ? {
    ...expandable,
    ...expandedRowRender ? { expandedRowRender } : {},
    ...onExpand ? { onExpand } : {},
    ...onExpandedRowsChange ? { onExpandedRowsChange } : {}
  } : void 0;
  const revealRows = isEditing && canvasExpandedRowKeys === void 0 && !!rowExpansion?.expandedRowRender && (info?.isEditingContents || info?.isSelected && info.selectedSlotName === "expandedRowRender");
  const canvasRowKeys = [];
  if (isEditing && (canvasExpandedRowKeys !== void 0 || revealRows || rowExpansion?.defaultExpandAllRows)) {
    const collect = (rows) => rows.forEach((row) => {
      const key = row[rowKey ?? "key"];
      if (key != null && (!rowExpansion?.rowExpandable || rowExpansion.rowExpandable(row))) {
        canvasRowKeys.push(key);
      }
      const children = row[rowExpansion?.childrenColumnName ?? "children"];
      if (Array.isArray(children)) collect(children);
    });
    collect(data?.data ?? []);
  }
  const initialCanvasKeys = canvasExpandedRowKeys?.filter((key) => canvasRowKeys.includes(key)) ?? rowExpansion?.expandedRowKeys ?? rowExpansion?.defaultExpandedRowKeys ?? (rowExpansion?.defaultExpandAllRows ? canvasRowKeys : []);
  const canvasKeysSource = JSON.stringify([rowKey, canvasExpandedRowKeys !== void 0, initialCanvasKeys]);
  const [canvasExpansion, setCanvasExpansion] = React.useState();
  React.useEffect(() => setCanvasExpansion(void 0), [isEditing, canvasKeysSource]);
  const resolvedExpansion = isEditing && rowExpansion ? {
    ...rowExpansion,
    expandedRowKeys: revealRows ? canvasRowKeys : canvasExpansion?.source === canvasKeysSource ? canvasExpansion.keys : initialCanvasKeys,
    expandRowByClick: false,
    onExpand: void 0,
    onExpandedRowsChange: revealRows ? void 0 : (keys) => {
      setCanvasExpansion({ source: canvasKeysSource, keys });
    }
  } : rowExpansion;
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
      key: isEditing ? "canvas" : "runtime",
      loading: data?.isLoading,
      dataSource: data?.data,
      rowSelection: selection,
      rowKey,
      ...rest,
      expandable: resolvedExpansion,
      contentEditing: !!canvas && !canvas.interactive && info?.isEditingContents,
      fullContentView: !!canvas && !canvas.interactive && // Read from the canvas prop so this works with any @plasmicapp/host.
      props.__plasmic_selection_prop__?.isFullContentView === true
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
        description: "Row detail template receiving row, index, indent and expanded. Mapped to native expandable.expandedRowRender; takes precedence over a renderer in expandable. Use row fields in this slot. Configure Canvas expanded rows to show representative detail variants directly on the editing canvas. Selection does not broaden configured samples. When canvas samples are unset, selecting this slot or Edit contents reveals eligible rows without changing runtime expansion. Selecting the Table alone does not reveal rows. The canvas modifier-click gesture changes temporary keys. Requires data and a stable rowKey."
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
      canvasExpandedRowKeys: {
        type: "choice",
        displayName: "Canvas expanded rows",
        multiSelect: true,
        editOnly: true,
        description: "Initial rowKey values expanded only on the editing canvas. Select representative loaded rows covering every requirement-defined detail variant (fields, layout, available actions and boundary data); the Table does not infer a status field. An empty array closes all canvas rows; omit to follow native expansion settings. Manual canvas expansion is temporary. Changing this value refreshes the samples. Ignored in Interactive mode, Preview and generated exports. Requires Expanded row content and stable row keys; missing or ineligible rows are ignored.",
        options: (ps) => (ps.data?.data ?? []).map((row) => row[ps.rowKey ?? "key"]).filter((key) => key != null)
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
  registerComponentHelper(loader, AntdColumn, {
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
  registerComponentHelper(loader, AntdExpandColumn, {
    name: "plasmic-antd6-table-expand-column",
    displayName: "Table.ExpandColumn",
    thumbnailUrl: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80"><rect x="8" y="10" width="104" height="60" rx="4" fill="#fff" stroke="#d9d9d9"/><path d="M8 30h104M8 50h104M32 10v40" stroke="#d9d9d9"/><path d="m16 18 4 4 4-4M16 40h8m-4-4v8" fill="none" stroke="#1677ff" stroke-width="2"/><rect x="36" y="55" width="68" height="10" rx="2" fill="#e6f4ff"/></svg>'
    ),
    description: "Place once directly in Table Columns to position the native expansion column. Configure visibility, title, width and fixed side in Table.expandable; put detail content in Table.expandedRowRender. Do not nest in ColumnGroup.",
    parentComponentName: "plasmic-antd6-table",
    styleSections: false,
    props: {},
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerTable",
    importName: "AntdExpandColumn"
  });
  registerComponentHelper(loader, AntdColumnGroup, {
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

export { AntdColumn, AntdColumnGroup, AntdExpandColumn, AntdTable, registerTable };
//# sourceMappingURL=registerTable.esm.js.map
