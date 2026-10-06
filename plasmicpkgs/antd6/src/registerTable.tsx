import {
  usePlasmicCanvasComponentInfo,
  usePlasmicCanvasContext,
} from "@plasmicapp/host";
import { Avatar, Button, Image, Table } from "antd";
import type {
  ColumnGroupType,
  ColumnType,
  TableRowSelection,
} from "antd/es/table/interface";
import React from "react";
import { AntdTag } from "./registerAdditional";
import { AntdTooltip } from "./registerTooltip";
import { columnTemplateHtml } from "./table-column-template";
import { TablePaginationControl, TableScrollControl } from "./table-controls";
import { Registerable, asArray, registerComponentHelper } from "./utils";

export interface TagOption {
  value: string;
  label?: string;
  color?: string;
}

export type AntdColumnProps = ColumnType<any> & {
  displayType?:
    "text" | "tag" | "link" | "avatar" | "image" | "button" | "custom";
  tagOptions?: TagOption[];
  tagColor?: string;
  templateType?: AntdColumnProps["displayType"];
  displayLabel?: string;
  contentSize?: number;
  openInNewTab?: boolean;
  onCellClick?: (cell: unknown, row: any, index: number) => void;
  children?: React.ReactNode;
  className?: string;
  __plasmic_selection_prop__?: unknown;
  __plasmic_cell__?: {
    type: React.ElementType;
    props: React.HTMLAttributes<HTMLElement>;
  };
};

function renderColumnValue(
  value: unknown,
  props: AntdColumnProps,
  row: any,
  rowIndex: number,
  isEditing: boolean,
) {
  const text = value == null ? "" : String(value);
  const label = props.displayLabel ?? text;
  const size = props.contentSize ?? 32;
  const onClick = isEditing
    ? undefined
    : () => props.onCellClick?.(value, row, rowIndex);
  switch (props.displayType) {
    case "link":
      return text ? (
        <a
          href={text}
          target={props.openInNewTab ? "_blank" : undefined}
          rel={props.openInNewTab ? "noopener noreferrer" : undefined}
          onClick={onClick}
        >
          {label}
        </a>
      ) : null;
    case "avatar":
      return text ? (
        <Avatar src={text} size={size} alt={label} onClick={onClick} />
      ) : null;
    case "image":
      return text ? (
        <Image
          src={text}
          width={size}
          height={size}
          alt={label}
          preview={!isEditing}
          style={{ objectFit: "cover" }}
        />
      ) : null;
    case "button":
      return (
        <Button size="small" onClick={onClick}>
          {label}
        </Button>
      );
  }
  if (props.displayType !== "tag") {
    return text;
  }
  return asArray(value)
    .filter((item) => item != null)
    .map((item, index) => (
      <AntdTag
        key={index}
        value={String(item)}
        options={props.tagOptions}
        defaultColor={props.tagColor}
        automaticColor
      />
    ));
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
            ...(displayType === "custom" &&
            !isEditing &&
            child.props.onCellClick
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
          displayType === "custom" || (displayType === undefined && render)
            ? (
                render as
                  | ((
                      cell: unknown,
                      row: any,
                      index: number,
                      column: unknown,
                    ) => React.ReactNode)
                  | undefined
              )?.(value, row, index, {
                text: value == null ? "" : String(value),
                label:
                  child.props.displayLabel ??
                  (value == null ? "" : String(value)),
                size: child.props.contentSize ?? 32,
                openInNewTab: child.props.openInNewTab ?? false,
                tagOptions: child.props.tagOptions ?? [],
                tagColor: child.props.tagColor,
                values: asArray(value).filter((item) => item != null),
              })
            : renderColumnValue(value, child.props, row, index, isEditing),
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
        description: "Configure pagination and page size. Data binding supports the full pagination configuration.",
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
        options: (_ps: any, ctx: any) => {
          if (ctx?.schema) {
            return ctx.schema.fields.map((f: any) => ({
              value: f.id,
              label: f.label || f.id,
            }));
          }
          return Object.keys(ctx?.data?.[0] ?? {});
        },
        hidden: (ps: any) => !ps.isSelectable,
      },
      selectedRowKeys: {
        type: "choice",
        displayName: "Selected row keys",
        multiSelect: (ps: any) => ps.isSelectable === "multiple",
        options: (ps: any, ctx: any) => {
          const key = ps.rowKey;
          if (key && ctx?.data) {
            return ctx.data.map((r: any) => r[key]);
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
    actions: [
      {
        type: "button-action",
        label: "Convert to editable template",
        hidden: (props: AntdColumnProps) =>
          props.displayType === "custom" || !!props.render,
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
          { value: "tag", label: "Tag" },
          { value: "link", label: "Link" },
          { value: "avatar", label: "Avatar" },
          { value: "image", label: "Image" },
          { value: "button", label: "Button" },
          { value: "custom", label: "Custom render" },
        ],
        defaultValueHint: (ps: AntdColumnProps) =>
          ps.render ? "custom" : "text",
        description:
          "Applies to all rows. Convert to a template to select and edit its elements. Existing templates are preserved and can be restored by switching to Custom render.",
      },
      displayLabel: {
        type: "string",
        displayName: "Label",
        description: "Uses the field value when unset. Also used as image alt text.",
        hidden: (ps: AntdColumnProps) =>
          !["link", "button", "avatar", "image"].includes(
            (ps.displayType === "custom" ? ps.templateType : ps.displayType) ??
              "text",
          ),
      },
      contentSize: {
        type: "number",
        displayName: "Image / avatar size",
        defaultValueHint: 32,
        min: 1,
        hidden: (ps: AntdColumnProps) =>
          !["avatar", "image"].includes(
            (ps.displayType === "custom" ? ps.templateType : ps.displayType) ??
              "text",
          ),
      },
      openInNewTab: {
        type: "boolean",
        displayName: "Open in new tab",
        hidden: (ps: AntdColumnProps) =>
          (ps.displayType === "custom" ? ps.templateType : ps.displayType) !==
          "link",
      },
      onCellClick: {
        type: "eventHandler",
        displayName: "On cell click",
        description: "Triggered by clicking buttons, links, or avatars in this column. Also available to custom content.",
        argTypes: [
          { name: "cell", type: "object" },
          { name: "row", type: "object" },
          { name: "index", type: "number" },
        ],
        hidden: (ps: AntdColumnProps) =>
          !["button", "link", "avatar", "custom"].includes(
            ps.displayType ?? "text",
          ),
      },
      tagOptions: {
        type: "array",
        displayName: "Tag labels and colors",
        hidden: (ps: AntdColumnProps) =>
          (ps.displayType === "custom" ? ps.templateType : ps.displayType) !==
          "tag",
        description: "Map field values to labels and colors. Unmapped values are assigned colors automatically.",
        itemType: {
          type: "object",
          nameFunc: (item: TagOption) => item.label || item.value,
          fields: {
            value: { type: "string", displayName: "Value" },
            label: { type: "string", displayName: "Label" },
            color: { type: "color", displayName: "Color" },
          },
        },
      },
      tagColor: {
        type: "color",
        displayName: "Default tag color",
        description: "When unset, colors are assigned by value. Individual item colors take precedence.",
        hidden: (ps: AntdColumnProps) =>
          (ps.displayType === "custom" ? ps.templateType : ps.displayType) !==
          "tag",
      },
      render: {
        type: "slot",
        renderPropParams: ["cell", "row", "index", "column"],
        hidePlaceholder: true,
        displayName: "Custom render",
        hidden: (ps: AntdColumnProps) =>
          (ps.displayType ?? (ps.render ? "custom" : "text")) !== "custom",
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
          "Show ellipsis and a Tooltip only when content overflows. Convert to an editable template to customize the Tooltip content.",
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
