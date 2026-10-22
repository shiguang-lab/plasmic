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
import { AntdTooltip } from "./registerTooltip";
import { TablePaginationControl, TableScrollControl } from "./table-controls";
import { Registerable, asArray, registerComponentHelper } from "./utils";

export type AntdColumnProps = ColumnType<any> & {
  displayType?: "text" | "custom";
  onCellClick?: (cell: unknown, row: any, index: number) => void;
  children?: React.ReactNode;
  className?: string;
  __plasmic_selection_prop__?: unknown;
  __plasmic_cell__?: {
    type: React.ElementType;
    props: React.HTMLAttributes<HTMLElement>;
  };
};

/** Custom render applies when selected explicitly, or when only a render slot is set. */
function isCustomColumn(props: Pick<AntdColumnProps, "displayType" | "render">) {
  return (
    props.displayType === "custom" ||
    (props.displayType === undefined && !!props.render)
  );
}

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
      title: props.ellipsis ? undefined : cell.props.title,
    },
    props.ellipsis ? (
      <AntdTooltip onlyWhenOverflow>{props.children}</AntdTooltip>
    ) : (
      props.children
    ),
  );
}

export const AntdColumnGroup = Object.assign(
  function AntdColumnGroup(props: AntdColumnProps) {
    return <AntdColumn {...props} />;
  },
  { __ANT_TABLE_COLUMN_GROUP: true },
);

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
    const {
      displayType: _displayType,
      onCellClick: _click,
      children: nested,
      render,
      ...column
    } = child.props;
    const custom = isCustomColumn(child.props);
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
        onHeaderCell,
        onCell: (row: any, index?: number) => {
          const cellProps = column.onCell?.(row, index);
          return {
            ...cellProps,
            ...(custom && !isEditing && child.props.onCellClick
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
        render: (value: any, row: any, index: number) =>
          custom
            ? render?.(value, row, index)
            : value == null
              ? ""
              : String(value),
      },
    ];
  });
}

function TableWithColumns({
  children,
  columns,
  components,
  ...props
}: React.ComponentProps<typeof Table>) {
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
        <TableWithColumns {...props} components={components}>
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
  if (columns !== undefined) {
    return (
      <Table
        {...props}
        pagination={pagination}
        columns={columns}
        components={components}
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
        columns={getColumns(
          children,
          body?.cell ?? "td",
          components?.header?.cell ?? "th",
          !!canvas && !canvas.interactive,
        )}
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
  props: React.ComponentProps<typeof Table> & {
    data: any;
    rowKey?: string;
    isSelectable?: undefined | "single" | "multiple";
    selectedRowKeys?: string[];
    defaultSelectedRowKeys?: string[];
    onSelectedRowKeysChange?: (keys: string[]) => void;
    onSelectedRowsChange?: (rows: any[]) => void;
    setControlContextData?: (ctx: any) => void;
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
    ...rest
  } = props;
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
      loading={data?.isLoading}
      dataSource={data?.data}
      rowSelection={selection}
      rowKey={rowKey}
      {...rest}
      scroll={{ x: "max-content", ...rest.scroll }}
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
        ],
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
        description: "False hides pagination; otherwise use native pagination options: current, pageSize/defaultPageSize, total, pageSizeOptions, showSizeChanger, and showTotal(total, range) returning content. Bind showTotal to display the total before the pager controls; keep paging and total under this one owner.",
      },
      scroll: {
        type: "custom",
        displayName: "Scroll",
        control: TableScrollControl,
        description:
          "Horizontal width accepts pixels, percentages, or max-content. Leave it unset to fit content. The table body grows with content when height is unset.",
      },
      onChange: {
        type: "eventHandler",
        displayName: "On change",
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
        description: "Choose a unique, stable field to identify selected rows.",
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
        hidden: (ps: any) => !ps.isSelectable,
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
        description: "The data field used by this column. Changes apply to every row.",
      },
      displayType: {
        type: "choice",
        displayName: "Display type",
        options: [
          { value: "text", label: "Text" },
          { value: "custom", label: "Custom render" },
        ],
        defaultValueHint: (ps: AntdColumnProps) =>
          ps.render ? "custom" : "text",
        description:
          "Applies to all rows. Text shows the field value. Custom render shows the Custom render slot for every row; place registered components such as Badge, Tag, Avatar or a link there.",
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
        hidden: (ps: AntdColumnProps) => !isCustomColumn(ps),
      },
      render: {
        type: "slot",
        renderPropParams: ["cell", "row", "index"],
        hidePlaceholder: true,
        displayName: "Custom render",
        hidden: (ps: AntdColumnProps) => !isCustomColumn(ps),
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
        description: "Column width in pixels. Applies to the header and all rows.",
      },
      ellipsis: {
        type: "boolean",
        displayName: "Ellipsis",
        description:
          "Show ellipsis and a Tooltip only when content overflows. For custom Tooltip content, place a Tooltip in Custom render.",
      },
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerTable",
    importName: "AntdColumn",
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
