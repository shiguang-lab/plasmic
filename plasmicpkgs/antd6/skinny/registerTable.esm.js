import "@plasmicapp/host/registerComponent";
import "@plasmicapp/host/registerGlobalContext";
import { Table } from "antd";
import React from "react";
import {
  b as asArray,
  r as registerComponentHelper,
} from "./utils-CSvRw6Za.esm.js";

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
  const [uncontrolledSelectedRowKeys, setUncontrolledSelectedRowKeys] =
    React.useState(defaultSelectedRowKeys ?? []);
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
            ? asArray(selectedRowKeys)
            : uncontrolledSelectedRowKeys,
        }
      : void 0;
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
  return /* @__PURE__ */ React.createElement(Table, {
    loading: data?.isLoading,
    dataSource: data?.data,
    rowSelection: selection,
    rowKey,
    ...rest,
  });
});
const AntdColumnGroup = Table.ColumnGroup;
const AntdColumn = Table.Column;
function registerTable(loader) {
  registerComponentHelper(loader, AntdTable, {
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
  registerComponentHelper(loader, AntdColumn, {
    name: "plasmic-antd6-table-column",
    displayName: "Column",
    parentComponentName: "plasmic-antd6-table",
    props: {
      title: {
        type: "slot",
        defaultValue: "Column Name",
      },
      dataIndex: {
        type: "string",
        displayName: "Column key",
      },
      render: {
        type: "slot",
        renderPropParams: ["cell", "row", "index"],
        hidePlaceholder: true,
        displayName: "Custom render",
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
    ...{ isRenderless: true },
  });
  registerComponentHelper(loader, AntdColumnGroup, {
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
    ...{ isRenderless: true },
  });
}

export { AntdColumn, AntdColumnGroup, AntdTable, registerTable };
//# sourceMappingURL=registerTable.esm.js.map
