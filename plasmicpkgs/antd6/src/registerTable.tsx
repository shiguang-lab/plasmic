import {
  usePlasmicCanvasComponentInfo,
  usePlasmicCanvasContext,
} from "@plasmicapp/host";
import { Table } from "antd";
import type {
  ColumnGroupType,
  ColumnType,
  TableRowSelection,
} from "antd/es/table/interface";
import React from "react";
import { TablePaginationControl, TableScrollControl } from "./table-controls";
import { Registerable, asArray, registerComponentHelper } from "./utils";

export type AntdColumnProps = ColumnType<any> & {
  onCellClick?: (cell: unknown, row: any, index: number) => void;
  children?: React.ReactNode;
  className?: string;
  __plasmic_selection_prop__?: unknown;
  __plasmic_cell__?: {
    type: React.ElementType;
    props: React.HTMLAttributes<HTMLElement>;
  };
};

/** Rendering the original column elements gives Studio a selectable Fiber for every cell. */
export function AntdColumn(props: AntdColumnProps) {
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
      className:
        [cell.props.className, props.className].filter(Boolean).join(" ") ||
        undefined,
      onClick: isEditing
        ? (event: React.MouseEvent) => event.preventDefault()
        : cell.props.onClick,
      "data-plasmic-canvas-part": isEditing ? "column" : undefined,
      "data-plasmic-table-column-selected": isSelected || undefined,
      style: cell.props.style,
    },
    props.children,
  );
}

export const AntdColumnGroup = Object.assign(
  function AntdColumnGroup(props: AntdColumnProps) {
    return <AntdColumn {...props} />;
  },
  { __ANT_TABLE_COLUMN_GROUP: true },
);

/** An authored position for Ant Design's native expansion column. */
export function AntdExpandColumn() {
  return null;
}

interface TableColumnCellProps extends React.HTMLAttributes<HTMLElement> {
  __plasmic_column__?: {
    element: React.ReactElement<AntdColumnProps>;
    type: React.ElementType;
  };
}

function renderTableCell(
  { __plasmic_column__: column, ...props }: TableColumnCellProps,
  type: "td" | "th",
) {
  return column
    ? React.cloneElement(column.element, {
        children: props.children,
        __plasmic_cell__: { type: column.type, props },
      })
    : React.createElement(type, props);
}

function TableBodyCell(props: TableColumnCellProps) {
  return renderTableCell(props, "td");
}

function TableHeaderCell(props: TableColumnCellProps) {
  return renderTableCell(props, "th");
}

function getColumns(
  children: React.ReactNode,
  bodyCell: React.ElementType,
  headerCell: React.ElementType,
  isEditing: boolean,
): (ColumnType<any> | ColumnGroupType<any>)[] {
  return React.Children.toArray(children).flatMap((child) => {
    if (!React.isValidElement<AntdColumnProps>(child)) {
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
    const onHeaderCell: NonNullable<ColumnType<any>["onHeaderCell"]> = (
      col,
    ) => ({
      ...column.onHeaderCell?.(col),
      __plasmic_column__: { element: child, type: headerCell },
    });
    if (
      (child.type as { __ANT_TABLE_COLUMN_GROUP?: boolean })
        .__ANT_TABLE_COLUMN_GROUP
    ) {
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
        // Preview initial sorting edits without controlling sorting at runtime.
        ...(isEditing && column.sortOrder === undefined
          ? { sortOrder: column.defaultSortOrder ?? null }
          : {}),
        onHeaderCell,
        onCell: (row: any, index?: number) => {
          const cellProps = column.onCell?.(row, index);
          return {
            ...cellProps,
            ...(render && !isEditing && child.props.onCellClick
              ? {
                  onClick: (event: React.MouseEvent<HTMLElement>) => {
                    cellProps?.onClick?.(event);
                    const action = (event.target as Element).closest?.(
                      "button, a[href], .ant-avatar",
                    );
                    if (
                      !action ||
                      !event.currentTarget.contains(action) ||
                      action.matches(":disabled, [aria-disabled=true]")
                    ) {
                      return;
                    }
                    const path = asArray(column.dataIndex ?? []);
                    child.props.onCellClick?.(
                      path.reduce((value: any, field) => value?.[field], row),
                      row,
                      index ?? 0,
                    );
                  },
                }
              : {}),
            __plasmic_column__: { element: child, type: bodyCell },
          };
        },
        // Without a render slot, Ant Design renders the field value natively.
        ...(render ? { render } : {}),
      },
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
}: React.ComponentProps<typeof Table> & {
  contentEditing?: boolean;
  fullContentView?: boolean;
}) {
  const canvas = usePlasmicCanvasContext();
  // Evaluate a data-context reader's slot inside its observer, preserving bindings.
  if (
    columns === undefined &&
    React.isValidElement<{ children: (...args: unknown[]) => React.ReactNode }>(
      children,
    ) &&
    typeof children.props.children === "function"
  ) {
    const renderChildren = children.props.children;
    return React.cloneElement(children, {
      children: (...args: unknown[]) => (
        <TableWithColumns
          {...props}
          components={components}
          contentEditing={contentEditing}
          fullContentView={fullContentView}
        >
          {renderChildren(...args)}
        </TableWithColumns>
      ),
    });
  }
  // Default page size initializes runtime pagination once. While authoring,
  // reflect edits immediately without turning the published prop into controlled state.
  const pagination =
    props.pagination !== false && canvas && !canvas.interactive
      ? {
          ...props.pagination,
          pageSize:
            props.pagination?.pageSize ?? props.pagination?.defaultPageSize,
        }
      : props.pagination;
  const editingProps = contentEditing
    ? {
        scroll: undefined,
        virtual: false,
        sticky: false,
        expandable: props.expandable && { ...props.expandable, fixed: undefined },
        style: { ...props.style, width: "max-content" },
      }
    : fullContentView
      ? {
          // Studio's full page height view: render every row in the page flow.
          // Horizontal scrolling and the saved props stay unchanged.
          scroll: props.scroll && { ...props.scroll, y: undefined },
          virtual: false,
          sticky: false,
        }
      : {};
  const expandColumns = (
    items: (ColumnType<any> | ColumnGroupType<any>)[],
  ): (ColumnType<any> | ColumnGroupType<any>)[] =>
    items.map((column) => column === Table.EXPAND_COLUMN ? column : ({
      ...column,
      fixed: undefined,
      ...("children" in column
        ? { children: expandColumns(column.children) }
        : {}),
    }));
  const prepareColumns = (items: (ColumnType<any> | ColumnGroupType<any>)[]) => {
    // Native showExpandColumn only suppresses automatic insertion; an explicit
    // EXPAND_COLUMN must also be removed when the author hides the column.
    const visible = props.expandable?.showExpandColumn === false
      ? items.filter((column) => column !== Table.EXPAND_COLUMN)
      : items;
    return contentEditing ? expandColumns(visible) : visible;
  };
  if (columns !== undefined) {
    return (
      <Table
        {...props}
        pagination={pagination}
        columns={prepareColumns(columns)}
        components={components}
        {...editingProps}
      />
    );
  }
  const body =
    typeof components?.body === "object" ? components.body : undefined;
  return (
    <>
      {canvas && !canvas.interactive && (
        <style data-plasmic-editor-style>
          {
            "[data-plasmic-table-column-selected] { outline: 1px solid #1677ff; background: #e6f4ff !important; }"
          }
        </style>
      )}
      <Table
        {...props}
        pagination={pagination}
        data-plasmic-canvas-part-scope={
          canvas && !canvas.interactive ? "true" : undefined
        }
        columns={(() => {
          const resolved = getColumns(
            children,
            body?.cell ?? "td",
            components?.header?.cell ?? "th",
            !!canvas && !canvas.interactive,
          );
          return prepareColumns(resolved);
        })()}
        {...editingProps}
        components={{
          ...components,
          header: { ...components?.header, cell: TableHeaderCell },
          body:
            typeof components?.body === "function"
              ? components.body
              : { ...body, cell: TableBodyCell },
        }}
      />
    </>
  );
}

export interface TableRef {
  selectRowByKey: (key: string) => void;
  selectRowByIndex: (index: number) => void;
  selectRowsByKeys: (keys: string[]) => void;
  selectRowsByIndexes: (indexs: number[]) => void;
  clearSelection: () => void;
}

export const AntdTable = React.forwardRef(function AntdTable(
  props: Omit<React.ComponentProps<typeof Table>, "onExpand" | "onExpandedRowsChange"> & {
    onExpand?: NonNullable<React.ComponentProps<typeof Table>["expandable"]>["onExpand"];
    onExpandedRowsChange?: NonNullable<React.ComponentProps<typeof Table>["expandable"]>["onExpandedRowsChange"];
    data: any;
    rowKey?: string;
    isSelectable?: undefined | "single" | "multiple";
    selectedRowKeys?: string[];
    defaultSelectedRowKeys?: string[];
    canvasExpandedRowKeys?: readonly React.Key[];
    onSelectedRowKeysChange?: (keys: string[]) => void;
    onSelectedRowsChange?: (rows: any[]) => void;
    setControlContextData?: (ctx: any) => void;
    __plasmic_selection_prop__?: unknown;
  },
  ref: React.Ref<TableRef>,
) {
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
  // Slots and events are top-level registration props so Studio and MCP can
  // edit the template and attach native interactions. Forward them explicitly.
  const rowExpansion = expandable || expandedRowRender || onExpand || onExpandedRowsChange
    ? {
        ...expandable,
        ...(expandedRowRender ? { expandedRowRender } : {}),
        ...(onExpand ? { onExpand } : {}),
        ...(onExpandedRowsChange ? { onExpandedRowsChange } : {}),
      }
    : undefined;
  const revealRows = isEditing && canvasExpandedRowKeys === undefined && !!rowExpansion?.expandedRowRender &&
    (info?.isEditingContents || (info?.isSelected &&
      info.selectedSlotName === "expandedRowRender"));
  const canvasRowKeys: React.Key[] = [];
  if (isEditing && (canvasExpandedRowKeys !== undefined || revealRows || rowExpansion?.defaultExpandAllRows)) {
    const collect = (rows: any[]) => rows.forEach((row) => {
      const key = row[rowKey ?? "key"];
      if (key != null && (!rowExpansion?.rowExpandable || rowExpansion.rowExpandable(row))) {
        canvasRowKeys.push(key);
      }
      const children = row[rowExpansion?.childrenColumnName ?? "children"];
      if (Array.isArray(children)) collect(children);
    });
    collect(data?.data ?? []);
  }
  const initialCanvasKeys = canvasExpandedRowKeys?.filter(key => canvasRowKeys.includes(key)) ??
    rowExpansion?.expandedRowKeys ??
    rowExpansion?.defaultExpandedRowKeys ??
    (rowExpansion?.defaultExpandAllRows ? canvasRowKeys : []);
  const canvasKeysSource = JSON.stringify([rowKey, canvasExpandedRowKeys !== undefined, initialCanvasKeys]);
  const [canvasExpansion, setCanvasExpansion] = React.useState<{
    source: string;
    keys: readonly React.Key[];
  }>();
  React.useEffect(() => setCanvasExpansion(undefined), [isEditing, canvasKeysSource]);
  const resolvedExpansion = isEditing && rowExpansion
    ? {
        ...rowExpansion,
        expandedRowKeys: revealRows ? canvasRowKeys :
          canvasExpansion?.source === canvasKeysSource ? canvasExpansion.keys : initialCanvasKeys,
        expandRowByClick: false,
        onExpand: undefined,
        onExpandedRowsChange: revealRows ? undefined : (keys: readonly React.Key[]) => {
          // Native canvas interactions own temporary keys, never business state.
          setCanvasExpansion({ source: canvasKeysSource, keys });
        },
      }
    : rowExpansion;
  setControlContextData?.(data);

  const isControlled = !!selectedRowKeys;
  const [uncontrolledSelectedRowKeys, setUncontrolledSelectedRowKeys] =
    React.useState<string[]>(defaultSelectedRowKeys ?? []);
  const selection: TableRowSelection<any> | undefined =
    isSelectable && rowKey
      ? {
          onChange: (rowKeys, rows) => {
            if (!isControlled) {
              setUncontrolledSelectedRowKeys(rowKeys as string[]);
            }
            onSelectedRowsChange?.(rows);
            onSelectedRowKeysChange?.(rowKeys as string[]);
          },
          type: isSelectable === "single" ? "radio" : "checkbox",
          selectedRowKeys: isControlled
            ? asArray(selectedRowKeys)
            : uncontrolledSelectedRowKeys,
        }
      : undefined;

  React.useImperativeHandle(
    ref,
    () => ({
      selectRowByIndex(index: number) {
        if (data.data && rowKey) {
          const row = data.data[index];
          const rows = row ? [row] : [];
          this._setSelectedRows(rows);
        }
      },
      selectRowsByIndexes(indexes: number[]) {
        if (data.data && rowKey) {
          const rows = indexes.map((x) => data.data[x]).filter((x) => !!x);
          this._setSelectedRows(rows);
        }
      },
      selectRowByKey(key: string) {
        if (data.data && rowKey) {
          const rows = data.data.filter((r: any) => r[rowKey] === key);
          this._setSelectedRows(rows);
        }
      },
      selectRowsByKeys(keys: string[]) {
        if (data.data && rowKey) {
          const rows = data.data.filter((r: any) => keys.includes(r[rowKey]));
          this._setSelectedRows(rows);
        }
      },
      clearSelection() {
        this._setSelectedRows([]);
      },
      _setSelectedRows(rows: any[]) {
        onSelectedRowsChange?.(rows);
        if (rowKey) {
          onSelectedRowKeysChange?.(rows.map((r) => r[rowKey]));
        }
        if (!isControlled) {
          setUncontrolledSelectedRowKeys(rows.map((r) => r[rowKey!]));
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
  return (
    <TableWithColumns
      key={isEditing ? "canvas" : "runtime"}
      loading={data?.isLoading}
      dataSource={data?.data}
      rowSelection={selection}
      rowKey={rowKey}
      {...rest}
      expandable={resolvedExpansion}
      contentEditing={
        !!canvas && !canvas.interactive && info?.isEditingContents
      }
      fullContentView={
        !!canvas &&
        !canvas.interactive &&
        // Read from the canvas prop so this works with any @plasmicapp/host.
        (
          props.__plasmic_selection_prop__ as
            | { isFullContentView?: boolean }
            | undefined
        )?.isFullContentView === true
      }
    />
  );
});

export function registerTable(loader?: Registerable) {
  registerComponentHelper(loader, AntdTable, {
    name: "plasmic-antd6-table",
    displayName: "Table",
    props: {
      data: {
        type: "dataSourceOpData" as any,
        displayName: "Data",
      },
      children: {
        type: "slot",
        displayName: "Columns",
        allowedComponents: [
          "plasmic-antd6-table-column",
          "plasmic-antd6-table-column-group",
          "plasmic-antd6-table-expand-column",
        ],
      },
      expandedRowRender: {
        type: "slot",
        displayName: "Expanded row content",
        renderPropParams: ["row", "index", "indent", "expanded"],
        hidePlaceholder: true,
        description:
          "Row detail template receiving row, index, indent and expanded. Mapped to native expandable.expandedRowRender; takes precedence over a renderer in expandable. Use row fields in this slot. Configure Canvas expanded rows to show representative detail variants directly on the editing canvas. Selection does not broaden configured samples. When canvas samples are unset, selecting this slot or Edit contents reveals eligible rows without changing runtime expansion. Selecting the Table alone does not reveal rows. The canvas modifier-click gesture changes temporary keys. Requires data and a stable rowKey.",
      },
      onExpand: {
        type: "eventHandler",
        argTypes: [{ name: "expanded", type: "boolean" }, { name: "row", type: "object" }],
        description: "Mapped to native expandable.onExpand(expanded, row). Use MCP createInteraction with eventName onExpand. Top-level handler takes precedence over expandable.onExpand.",
      },
      onExpandedRowsChange: {
        type: "eventHandler",
        argTypes: [{ name: "expandedKeys", type: "object" }],
        description: "Mapped to native expandable.onExpandedRowsChange(expandedKeys). Use MCP createInteraction with eventName onExpandedRowsChange to update the state bound to expandable.expandedRowKeys. Top-level handler takes precedence over expandable.onExpandedRowsChange.",
      },
      expandable: {
        type: "object",
        displayName: "Expandable rows",
        description:
          "Native Ant Design expandable configuration. Add Expanded row content to enable row details. Insert one Table.ExpandColumn among Columns to choose its position; otherwise Ant Design places it automatically. State remains in this object; bind expandedRowKeys and update it from the top-level onExpandedRowsChange event for controlled expansion. Top-level render and event props take precedence over callbacks supplied in expandable.",
        fields: {
          showExpandColumn: { type: "boolean", defaultValueHint: true, description: "Show the expansion column. When false, use expandRowByClick or controlled expandedRowKeys to open rows." },
          expandRowByClick: { type: "boolean", defaultValueHint: false },
          columnTitle: { type: "string", description: "Expansion column heading." },
          columnWidth: { type: "number", description: "Expansion column width in pixels." },
          fixed: { type: "choice", options: ["left", "right"], description: "Pin the expansion column while scrolling horizontally. Leave unset for no explicit pinning." },
          rowExpandable: { type: "exprEditor", description: "Predicate (row) => boolean. False prevents that row from expanding; it does not hide the entire column." },
          defaultExpandAllRows: { type: "boolean", defaultValueHint: false, description: "Initially expand all loaded rows. Uncontrolled; defaultExpandedRowKeys takes precedence." },
          defaultExpandedRowKeys: { type: "exprEditor", description: "Initial array of stable rowKey values. User clicks own expansion afterward." },
          expandedRowKeys: { type: "exprEditor", description: "Controlled array of rowKey values. Bind state and update it from onExpandedRowsChange. An empty array closes every row; omit for uncontrolled expansion." },
        },
      },
      canvasExpandedRowKeys: {
        type: "choice",
        displayName: "Canvas expanded rows",
        multiSelect: true,
        editOnly: true,
        description:
          "Initial rowKey values expanded only on the editing canvas. Select representative loaded rows covering every requirement-defined detail variant (fields, layout, available actions and boundary data); the Table does not infer a status field. An empty array closes all canvas rows; omit to follow native expansion settings. Manual canvas expansion is temporary. Changing this value refreshes the samples. Ignored in Interactive mode, Preview and generated exports. Requires Expanded row content and stable row keys; missing or ineligible rows are ignored.",
        options: (ps: any) => (ps.data?.data ?? [])
          .map((row: any) => row[ps.rowKey ?? "key"])
          .filter((key: React.Key | null | undefined) => key != null),
      },
      title: {
        type: "slot",
        displayName: "Title",
        renderPropParams: ["currentPageData"],
        hidePlaceholder: true,
        description:
          "Optional content above the column headers. Receives the current page rows as currentPageData; column headings use Column.title.",
      },
      bordered: {
        type: "boolean",
        displayName: "Bordered",
        defaultValueHint: false,
        advanced: true,
      },
      size: {
        type: "choice",
        displayName: "Size",
        options: [
          { value: "small", label: "Small" },
          { value: "medium", label: "Medium" },
          { value: "large", label: "Large" },
        ],
        defaultValueHint: "large",
      },
      pagination: {
        type: "custom",
        displayName: "Pagination",
        control: TablePaginationControl,
        description:
          "False hides pagination; otherwise use native pagination options: current, pageSize/defaultPageSize, total, pageSizeOptions, showSizeChanger, and showTotal(total, range) returning content. Bind showTotal to display the total before the pager controls; keep paging and total under this one owner.",
      },
      scroll: {
        type: "custom",
        displayName: "Scroll",
        control: TableScrollControl,
        description:
          "Native Ant Design scroll. Horizontal width accepts pixels, percentages, or max-content; unset keeps the table within its container without horizontal scrolling. The table body grows with content when height is unset.",
      },
      onChange: {
        type: "eventHandler",
        displayName: "On change",
        description:
          "Receives pagination, filters, sorter and extra. Sorter contains field, columnKey and order (ascend/descend, or undefined when cleared); multiple sorting can return an array. extra.action is paginate, sort or filter. With Column.sorter=true, use these values to request server-sorted data; rows are not reordered locally.",
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
          { value: "single", label: "Single" },
          { value: "multiple", label: "Multiple" },
        ],
        displayName: "Select rows?",
      },
      rowKey: {
        type: "choice",
        displayName: "Row key",
        description: "Choose a unique, stable field to identify rows for selection and expansion.",
        options: (ps: any) => {
          const data = ps.data;
          if (!data || data.isLoading) {
            return undefined;
          }
          if (data.schema) {
            return data.schema.fields.map((f: any) => ({
              value: f.id,
              label: f.label || f.id,
            }));
          }
          return data.data?.length ? Object.keys(data.data[0]) : undefined;
        },
      },
      selectedRowKeys: {
        type: "choice",
        displayName: "Selected row keys",
        multiSelect: (ps: any) => ps.isSelectable === "multiple",
        options: (ps: any) => {
          const key = ps.rowKey;
          if (key && ps.data?.data) {
            return ps.data.data.map((r: any) => r[key]);
          }
          return [];
        },
        hidden: (ps: any) => !ps.rowKey,
      },
      onSelectedRowKeysChange: {
        type: "eventHandler",
        displayName: "On selected row keys change",
        argTypes: [{ name: "keys", type: "object" }],
        hidden: (ps: any) => !ps.isSelectable,
      },
      onSelectedRowsChange: {
        type: "eventHandler",
        displayName: "On selected rows change",
        argTypes: [{ name: "rows", type: "object" }],
        hidden: (ps: any) => !ps.isSelectable,
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
    styleSections: false,
    parentComponentName: "plasmic-antd6-table",
    props: {
      title: {
        type: "slot",
        displayName: "Title",
        defaultValue: "Title",
      },
      dataIndex: {
        type: "string",
        displayName: "Data index",
        description:
          "The data field used by this column. Changes apply to every row.",
      },
      render: {
        type: "slot",
        renderPropParams: ["cell", "row", "index"],
        hidePlaceholder: true,
        displayName: "Custom render",
        description:
          "Native Column.render for every row, receiving cell, row and index. Leave it empty to show the field value.",
      },
      onCellClick: {
        type: "eventHandler",
        displayName: "On cell click",
        description:
          "Triggered by clicking a button, link, or avatar inside Custom render. Receives the cell value, row, and row index.",
        argTypes: [
          { name: "cell", type: "object" },
          { name: "row", type: "object" },
          { name: "index", type: "number" },
        ],
        hidden: (ps: AntdColumnProps) => !ps.render,
      },
      align: {
        type: "choice",
        displayName: "Align",
        options: [
          { value: "left", label: "Left" },
          { value: "right", label: "Right" },
          { value: "center", label: "Center" },
        ],
        defaultValueHint: "left",
      },
      sorter: {
        type: "exprEditor",
        displayName: "Sorter",
        description:
          "Native column sorter. For local sorting, use a comparator such as (a, b) => a.amount - b.amount or (a, b) => a.name.localeCompare(b.name). Use true for server sorting through Table On change; true alone does not reorder rows. Use false to disable. Multiple sorting accepts { compare: (a, b) => a.amount - b.amount, multiple: 1 }.",
      },
      defaultSortOrder: {
        type: "choice",
        displayName: "Default sort order",
        options: [
          { value: "ascend", label: "Ascending" },
          { value: "descend", label: "Descending" },
        ],
        description:
          "Initial sorting direction. Leave unset for no initial sorting. Requires Sorter; users can change the direction by clicking the header in Preview.",
      },
      sortOrder: {
        type: "choice",
        displayName: "Sort order",
        options: [
          { value: "ascend", label: "Ascending" },
          { value: "descend", label: "Descending" },
        ],
        advanced: true,
        description:
          "Controlled sorting direction. Bind to state updated by Table On change; use null to clear sorting. Leave unset to let header clicks manage sorting. For single-column sorting, control only one column.",
      },
      sortDirections: {
        type: "exprEditor",
        displayName: "Sort directions",
        advanced: true,
        description:
          'Header click order. Defaults to ["ascend", "descend"], followed by clearing sorting. Repeat the first direction at the end to prevent clearing.',
      },
      fixed: {
        type: "choice",
        displayName: "Fixed",
        options: [
          { value: "left", label: "Left" },
          { value: "right", label: "Right" },
        ],
        advanced: true,
      },
      colSpan: {
        type: "number",
        displayName: "Col span",
        advanced: true,
      },
      width: {
        type: "number",
        displayName: "Width",
        description:
          "Native column width in pixels, applied to the header and all rows.",
      },
      ellipsis: {
        type: "exprEditor",
        displayName: "Ellipsis",
        description:
          "Native column ellipsis: false disables truncation; true enables truncation with the browser title; { showTitle: false } keeps truncation without the cell title. For long text, use { showTitle: false } with a Tooltip in Custom render to show the complete cell value. This option does not create the Tooltip itself.",
      },
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerTable",
    importName: "AntdColumn",
  });

  registerComponentHelper(loader, AntdExpandColumn, {
    name: "plasmic-antd6-table-expand-column",
    displayName: "Table.ExpandColumn",
    description: "Place once directly in Table Columns to position the native expansion column. Configure visibility, title, width and fixed side in Table.expandable; put detail content in Table.expandedRowRender. Do not nest in ColumnGroup.",
    parentComponentName: "plasmic-antd6-table",
    styleSections: false,
    props: {},
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerTable",
    importName: "AntdExpandColumn",
  });

  registerComponentHelper(loader, AntdColumnGroup, {
    name: "plasmic-antd6-table-column-group",
    displayName: "Column Group",
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
