import { PropType } from "@plasmicapp/host";
import { CodeComponentMeta } from "@plasmicapp/host/registerComponent";
import * as Ant from "antd";
import dayjs from "dayjs";
import React from "react";
import { Registerable, registerComponentHelper } from "./utils";

// Export the same implementations that generated pages import.
export const AntdAffix: typeof Ant.Affix = Ant.Affix;
export const AntdAlert: typeof Ant.Alert = Ant.Alert;
export const AntdAnchor: typeof Ant.Anchor = Ant.Anchor;
export const AntdAutoComplete: typeof Ant.AutoComplete = Ant.AutoComplete;
export const AntdBadge: typeof Ant.Badge = Ant.Badge;
export const AntdBadgeRibbon: typeof Ant.Badge.Ribbon = Ant.Badge.Ribbon;
export const AntdBorderBeam: typeof Ant.BorderBeam = Ant.BorderBeam;
export function AntdCard({
  actions,
  ...rest
}: Omit<React.ComponentProps<typeof Ant.Card>, "actions"> & {
  actions?: React.ReactNode;
}) {
  return (
    <Ant.Card
      {...rest}
      actions={actions ? React.Children.toArray(actions) : undefined}
    />
  );
}
export const AntdCardMeta: typeof Ant.Card.Meta = Ant.Card.Meta;
export const AntdCardGrid: typeof Ant.Card.Grid = Ant.Card.Grid;
export const AntdCarousel: typeof Ant.Carousel = Ant.Carousel;
export const AntdCascader: typeof Ant.Cascader = Ant.Cascader;
export const AntdCascaderPanel: typeof Ant.Cascader.Panel = Ant.Cascader.Panel;
export const AntdCol: typeof Ant.Col = Ant.Col;
export const AntdDescriptions: typeof Ant.Descriptions = Ant.Descriptions;
export const AntdDivider: typeof Ant.Divider = Ant.Divider;
export const AntdEmpty: typeof Ant.Empty = Ant.Empty;
export const AntdFlex: typeof Ant.Flex = Ant.Flex;
export const AntdFloatButton: typeof Ant.FloatButton = Ant.FloatButton;
export const AntdFloatButtonGroup: typeof Ant.FloatButton.Group =
  Ant.FloatButton.Group;
export const AntdBackTop: typeof Ant.FloatButton.BackTop =
  Ant.FloatButton.BackTop;
export const AntdImage: typeof Ant.Image = Ant.Image;
export const AntdImagePreviewGroup: typeof Ant.Image.PreviewGroup =
  Ant.Image.PreviewGroup;
export const AntdLayout: typeof Ant.Layout = Ant.Layout;
export const AntdLayoutHeader: typeof Ant.Layout.Header = Ant.Layout.Header;
export const AntdLayoutFooter: typeof Ant.Layout.Footer = Ant.Layout.Footer;
export const AntdLayoutContent: typeof Ant.Layout.Content = Ant.Layout.Content;
export const AntdLayoutSider: typeof Ant.Layout.Sider = Ant.Layout.Sider;
export const AntdMentions: typeof Ant.Mentions = Ant.Mentions;
export const AntdPopconfirm: typeof Ant.Popconfirm = Ant.Popconfirm;
export const AntdQRCode: typeof Ant.QRCode = Ant.QRCode;
export const AntdResult: typeof Ant.Result = Ant.Result;
export const AntdRow: typeof Ant.Row = Ant.Row;
export const AntdSkeleton: typeof Ant.Skeleton = Ant.Skeleton;
export const AntdSkeletonButton: typeof Ant.Skeleton.Button =
  Ant.Skeleton.Button;
export const AntdSkeletonInput: typeof Ant.Skeleton.Input = Ant.Skeleton.Input;
export const AntdSkeletonAvatar: typeof Ant.Skeleton.Avatar =
  Ant.Skeleton.Avatar;
export const AntdSkeletonImage: typeof Ant.Skeleton.Image = Ant.Skeleton.Image;
export const AntdSkeletonNode: typeof Ant.Skeleton.Node = Ant.Skeleton.Node;
export const AntdSpace: typeof Ant.Space = Ant.Space;
export const AntdSpaceCompact: typeof Ant.Space.Compact = Ant.Space.Compact;
export const AntdSpin: typeof Ant.Spin = Ant.Spin;
export const AntdSplitter: typeof Ant.Splitter = Ant.Splitter;
export const AntdSplitterPanel: typeof Ant.Splitter.Panel = Ant.Splitter.Panel;
export const AntdStatistic: typeof Ant.Statistic = Ant.Statistic;
export const AntdStatisticTimer: typeof Ant.Statistic.Timer =
  Ant.Statistic.Timer;
export const AntdTag: typeof Ant.Tag = Ant.Tag;
export const AntdTagCheckable: typeof Ant.Tag.CheckableTag =
  Ant.Tag.CheckableTag;
export const AntdTimeline: typeof Ant.Timeline = Ant.Timeline;
export const AntdTreeSelect: typeof Ant.TreeSelect = Ant.TreeSelect;
export const AntdTypography: typeof Ant.Typography = Ant.Typography;
export const AntdTypographyTitle: typeof Ant.Typography.Title =
  Ant.Typography.Title;
export const AntdTypographyText: typeof Ant.Typography.Text =
  Ant.Typography.Text;
export const AntdTypographyParagraph: typeof Ant.Typography.Paragraph =
  Ant.Typography.Paragraph;
export const AntdTypographyLink: typeof Ant.Typography.Link =
  Ant.Typography.Link;
export const AntdWatermark: typeof Ant.Watermark = Ant.Watermark;
export function AntdInputOTP({
  onChange,
  onComplete,
  ...rest
}: Omit<React.ComponentProps<typeof Ant.Input.OTP>, "onChange" | "onInput"> & {
  onChange?: (value: string) => void;
  onComplete?: (value: string) => void;
}) {
  return (
    <Ant.Input.OTP
      {...rest}
      onInput={(values) => onChange?.(values.join(""))}
      onChange={onComplete}
    />
  );
}
export function AntdInputSearch({
  onChange,
  ...rest
}: Omit<React.ComponentProps<typeof Ant.Input.Search>, "onChange"> & {
  onChange?: (value: string) => void;
}) {
  return (
    <Ant.Input.Search
      {...rest}
      onChange={(event) => onChange?.(event.target.value)}
    />
  );
}
export const AntdUploadDragger: typeof Ant.Upload.Dragger = Ant.Upload.Dragger;

type CalendarProps = Omit<
  React.ComponentProps<typeof Ant.Calendar>,
  "value" | "onChange" | "onSelect"
> & {
  value?: string;
  onChange?: (value: string) => void;
  onSelect?: (value: string) => void;
};
export function AntdCalendar({
  value,
  onChange,
  onSelect,
  ...rest
}: CalendarProps) {
  return (
    <Ant.Calendar
      {...rest}
      value={value ? dayjs(value) : undefined}
      onChange={(date) => onChange?.(date.toISOString())}
      onSelect={(date) => onSelect?.(date.toISOString())}
    />
  );
}

type TimeProps = Omit<
  React.ComponentProps<typeof Ant.TimePicker>,
  "value" | "onChange"
> & {
  value?: string | null;
  onChange?: (value: string | null) => void;
};
export function AntdTimePicker({ value, onChange, ...rest }: TimeProps) {
  return (
    <Ant.TimePicker
      {...rest}
      value={value === undefined ? undefined : value ? dayjs(value) : null}
      onChange={(date) => onChange?.(date ? date.toISOString() : null)}
    />
  );
}
type TimeRangeProps = Omit<
  React.ComponentProps<typeof Ant.TimePicker.RangePicker>,
  "value" | "onChange"
> & {
  value?: [string | null, string | null] | null;
  onChange?: (value: [string | null, string | null] | null) => void;
};
export function AntdTimeRangePicker({
  value,
  onChange,
  ...rest
}: TimeRangeProps) {
  return (
    <Ant.TimePicker.RangePicker
      {...rest}
      value={
        value === undefined
          ? undefined
          : value === null
            ? null
            : [
                value[0] ? dayjs(value[0]) : null,
                value[1] ? dayjs(value[1]) : null,
              ]
      }
      onChange={(dates) =>
        onChange?.(
          dates
            ? [dates[0]?.toISOString() ?? null, dates[1]?.toISOString() ?? null]
            : null,
        )
      }
    />
  );
}

export function AntdMultipleDatePicker({
  value,
  onChange,
  ...rest
}: {
  value?: string[];
  onChange?: (value: string[]) => void;
  picker?: "date" | "week" | "month" | "quarter" | "year";
  disabled?: boolean;
}) {
  return (
    <Ant.DatePicker
      {...rest}
      multiple
      value={value?.map((date) => dayjs(date))}
      onChange={(dates) =>
        onChange?.(
          Array.isArray(dates) ? dates.map((date) => date.toISOString()) : [],
        )
      }
    />
  );
}

// Render callbacks cannot be serialized as ordinary JSON props in Studio.
export function AntdList(
  props: Omit<React.ComponentProps<typeof Ant.List>, "renderItem">,
) {
  return (
    <Ant.List
      {...props}
      renderItem={(item) => <Ant.List.Item>{String(item)}</Ant.List.Item>}
    />
  );
}
export function AntdListItem({
  actions,
  ...rest
}: Omit<React.ComponentProps<typeof Ant.List.Item>, "actions"> & {
  actions?: React.ReactNode;
}) {
  return (
    <Ant.List.Item
      {...rest}
      actions={actions ? React.Children.toArray(actions) : undefined}
    />
  );
}
export const AntdListItemMeta: typeof Ant.List.Item.Meta = Ant.List.Item.Meta;
export function AntdListy(
  props: Omit<
    Ant.ListyProps<{ key: string; content: string }>,
    "itemRender" | "rowKey"
  >,
) {
  return (
    <Ant.Listy
      {...props}
      rowKey="key"
      itemRender={(item) => <div>{item.content}</div>}
    />
  );
}
export function AntdMasonry(
  props: Omit<Ant.MasonryProps<{ content: string }>, "itemRender">,
) {
  return (
    <Ant.Masonry
      {...props}
      itemRender={(item) => <div>{item.data?.content}</div>}
    />
  );
}
export function AntdTransfer(props: React.ComponentProps<typeof Ant.Transfer>) {
  return (
    <Ant.Transfer
      {...props}
      render={(item) => String(item.title ?? item.key ?? "")}
    />
  );
}

// Tour targets are resolved inside the canvas document, never the Studio document.
export function AntdTour(
  props: Omit<React.ComponentProps<typeof Ant.Tour>, "steps"> & {
    steps?: { title?: string; description?: string; targetSelector?: string }[];
  },
) {
  return (
    <Ant.Tour
      {...props}
      steps={props.steps?.map(({ targetSelector, ...step }) => ({
        ...step,
        title: step.title ?? "",
        target:
          targetSelector && typeof document !== "undefined"
            ? document.querySelector<HTMLElement>(targetSelector)
            : null,
      }))}
    />
  );
}

type EditorProps = Record<string, unknown>;
type Props = Record<string, PropType<EditorProps>>;
const slot = (text: string) => ({ type: "slot" as const, defaultValue: text });
const choice = (options: string[], defaultValueHint?: string) => ({
  type: "choice" as const,
  options,
  defaultValueHint,
});
const event = (
  name: string,
  type: "string" | "number" | "boolean" | "object",
) => ({
  type: "eventHandler" as const,
  argTypes: [{ name, type }],
});
const sizes = choice(["small", "medium", "large"], "medium");
const variant = choice(
  ["outlined", "borderless", "filled", "underlined"],
  "outlined",
);
const valueState = (
  variableType: "text" | "boolean" | "number" | "array",
  valueProp = "value",
  onChangeProp = "onChange",
) => ({
  [valueProp]: {
    type: "writable" as const,
    variableType,
    valueProp,
    onChangeProp,
  },
});

function register(
  loader: Registerable | undefined,
  component: React.ComponentType<any>,
  suffix: string,
  importName: string,
  props: Props,
  extra: Partial<CodeComponentMeta<EditorProps>> = {},
) {
  registerComponentHelper<EditorProps>(loader, component, {
    name: `plasmic-antd6-${suffix}`,
    displayName: suffix
      .split("-")
      .map((s) => s[0].toUpperCase() + s.slice(1))
      .join(" "),
    props,
    importName,
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerAdditional",
    ...extra,
  });
}

export function registerAdditional(loader?: Registerable) {
  register(loader, AntdAffix, "affix", "AntdAffix", {
    children: slot("Affixed content"),
    offsetTop: "number",
    offsetBottom: "number",
    onChange: event("affixed", "boolean"),
  });
  register(loader, AntdAlert, "alert", "AntdAlert", {
    title: slot("Alert title"),
    description: slot("Alert description"),
    type: choice(["success", "info", "warning", "error"], "info"),
    showIcon: "boolean",
    banner: "boolean",
    closable: "object",
    action: "slot",
  });
  register(loader, AntdAnchor, "anchor", "AntdAnchor", {
    items: {
      type: "array",
      defaultValue: [{ key: "section", href: "#section", title: "Section" }],
    },
    affix: "boolean",
    offsetTop: "number",
    direction: choice(["vertical", "horizontal"]),
    onChange: event("href", "string"),
  });
  register(
    loader,
    AntdAutoComplete,
    "auto-complete",
    "AntdAutoComplete",
    {
      value: "string",
      options: {
        type: "array",
        defaultValue: [{ value: "Option 1" }, { value: "Option 2" }],
      },
      placeholder: "string",
      disabled: "boolean",
      allowClear: "boolean",
      variant,
      onChange: event("value", "string"),
      onSearch: event("value", "string"),
    },
    { states: valueState("text") },
  );
  register(loader, AntdBadge, "badge", "AntdBadge", {
    children: slot("Badge"),
    count: { type: "number", defaultValue: 5 },
    dot: "boolean",
    showZero: "boolean",
    overflowCount: "number",
    color: { type: "color" },
    size: choice(["small", "medium"]),
    status: choice(["success", "processing", "default", "error", "warning"]),
    text: "string",
  });
  register(loader, AntdBadgeRibbon, "badge-ribbon", "AntdBadgeRibbon", {
    children: slot("Ribbon content"),
    text: slot("Ribbon"),
    color: { type: "color" },
    placement: choice(["start", "end"]),
  });
  register(loader, AntdBorderBeam, "border-beam", "AntdBorderBeam", {
    children: slot("Border beam"),
    color: { type: "color" },
  });
  register(loader, AntdCard, "card", "AntdCard", {
    children: slot("Card content"),
    title: slot("Card title"),
    extra: "slot",
    cover: "slot",
    actions: "slot",
    size: choice(["small", "medium"], "medium"),
    variant: choice(["outlined", "borderless"]),
    hoverable: "boolean",
    loading: "boolean",
    styles: "object",
    classNames: "object",
  });
  register(loader, AntdCardMeta, "card-meta", "AntdCardMeta", {
    title: slot("Title"),
    description: slot("Description"),
    avatar: "slot",
  });
  register(loader, AntdCardGrid, "card-grid", "AntdCardGrid", {
    children: slot("Grid cell"),
    hoverable: "boolean",
  });
  register(loader, AntdCarousel, "carousel", "AntdCarousel", {
    children: {
      type: "slot",
      defaultValue: [
        { type: "vbox", children: ["Slide 1"] },
        { type: "vbox", children: ["Slide 2"] },
      ],
    },
    autoplay: "boolean",
    arrows: "boolean",
    dots: "boolean",
    infinite: "boolean",
    effect: choice(["scrollx", "fade"]),
    dotPlacement: choice(["top", "bottom", "start", "end"]),
    afterChange: event("slide", "number"),
  });
  const cascaderProps: Props = {
    options: {
      type: "array",
      defaultValue: [
        {
          label: "Parent",
          value: "parent",
          children: [{ label: "Child", value: "child" }],
        },
      ],
    },
    value: { type: "array" },
    multiple: "boolean",
    disabled: "boolean",
    onChange: event("value", "object"),
  };
  register(
    loader,
    AntdCascader,
    "cascader",
    "AntdCascader",
    {
      ...cascaderProps,
      placeholder: "string",
      allowClear: "boolean",
      showSearch: "boolean",
      variant,
    },
    { states: valueState("array") },
  );
  register(
    loader,
    AntdCascaderPanel,
    "cascader-panel",
    "AntdCascaderPanel",
    cascaderProps,
    { states: valueState("array") },
  );
  register(loader, AntdRow, "row", "AntdRow", {
    children: {
      type: "slot",
      defaultValue: [
        {
          type: "component",
          name: "plasmic-antd6-col",
          props: { span: 12, children: "Column 1" },
        },
        {
          type: "component",
          name: "plasmic-antd6-col",
          props: { span: 12, children: "Column 2" },
        },
      ],
    },
    gutter: { type: "number", defaultValue: 16 },
    align: choice(["top", "middle", "bottom", "stretch"]),
    justify: choice([
      "start",
      "end",
      "center",
      "space-around",
      "space-between",
      "space-evenly",
    ]),
    wrap: "boolean",
  });
  register(loader, AntdCol, "col", "AntdCol", {
    children: slot("Column"),
    span: { type: "number", defaultValue: 12 },
    offset: "number",
    order: "number",
    flex: "string",
    xs: "object",
    sm: "object",
    md: "object",
    lg: "object",
    xl: "object",
    xxl: "object",
  });
  register(loader, AntdDescriptions, "descriptions", "AntdDescriptions", {
    title: slot("Details"),
    items: {
      type: "array",
      defaultValue: [{ key: "name", label: "Name", children: "Example" }],
    },
    column: "number",
    layout: choice(["horizontal", "vertical"]),
    bordered: "boolean",
    size: sizes,
    styles: "object",
    classNames: "object",
  });
  register(loader, AntdDivider, "divider", "AntdDivider", {
    children: slot("Divider"),
    orientation: choice(["horizontal", "vertical"]),
    titlePlacement: choice(["start", "center", "end"]),
    dashed: "boolean",
    plain: "boolean",
    size: sizes,
  });
  register(loader, AntdEmpty, "empty", "AntdEmpty", {
    description: slot("No data"),
    children: "slot",
    image: "imageUrl",
  });
  register(loader, AntdFlex, "flex", "AntdFlex", {
    children: slot("Flex content"),
    vertical: "boolean",
    wrap: choice(["nowrap", "wrap", "wrap-reverse"]),
    gap: { type: "number", defaultValue: 16 },
    align: choice(["stretch", "center", "start", "end", "baseline"]),
    justify: choice([
      "start",
      "end",
      "center",
      "space-between",
      "space-around",
      "space-evenly",
    ]),
  });
  register(loader, AntdFloatButton, "float-button", "AntdFloatButton", {
    icon: "slot",
    content: slot("Help"),
    tooltip: "string",
    type: choice(["default", "primary"]),
    shape: choice(["circle", "square"]),
    onClick: event("event", "object"),
  });
  register(
    loader,
    AntdFloatButtonGroup,
    "float-button-group",
    "AntdFloatButtonGroup",
    {
      children: {
        type: "slot",
        allowedComponents: [
          "plasmic-antd6-float-button",
          "plasmic-antd6-back-top",
        ],
        defaultValue: [
          { type: "component", name: "plasmic-antd6-float-button" },
        ],
      },
      trigger: choice(["click", "hover"]),
      shape: choice(["circle", "square"]),
      open: "boolean",
      onOpenChange: event("open", "boolean"),
    },
  );
  register(loader, AntdBackTop, "back-top", "AntdBackTop", {
    visibilityHeight: "number",
    duration: "number",
    icon: "slot",
  });
  register(loader, AntdImage, "image", "AntdImage", {
    src: { type: "imageUrl", defaultValue: "https://placehold.co/320x200" },
    alt: "string",
    width: "number",
    height: "number",
    preview: "boolean",
    fallback: "imageUrl",
  });
  register(
    loader,
    AntdImagePreviewGroup,
    "image-preview-group",
    "AntdImagePreviewGroup",
    {
      children: { type: "slot", allowedComponents: ["plasmic-antd6-image"] },
      items: { type: "array" },
    },
  );
  register(loader, AntdLayout, "layout", "AntdLayout", {
    children: {
      type: "slot",
      defaultValue: [
        { type: "component", name: "plasmic-antd6-layout-header" },
        { type: "component", name: "plasmic-antd6-layout-content" },
        { type: "component", name: "plasmic-antd6-layout-footer" },
      ],
    },
    hasSider: "boolean",
  });
  for (const [suffix, component, importName] of [
    ["header", AntdLayoutHeader, "AntdLayoutHeader"],
    ["footer", AntdLayoutFooter, "AntdLayoutFooter"],
    ["content", AntdLayoutContent, "AntdLayoutContent"],
  ] as const) {
    register(loader, component, `layout-${suffix}`, importName, {
      children: slot(suffix),
    });
  }
  register(
    loader,
    AntdLayoutSider,
    "layout-sider",
    "AntdLayoutSider",
    {
      children: slot("Navigation"),
      width: "number",
      collapsed: "boolean",
      collapsible: "boolean",
      collapsedWidth: "number",
      theme: choice(["light", "dark"]),
      breakpoint: choice(["xs", "sm", "md", "lg", "xl", "xxl"]),
      onCollapse: event("collapsed", "boolean"),
    },
    { states: valueState("boolean", "collapsed", "onCollapse") },
  );
  register(loader, AntdList, "list", "AntdList", {
    children: "slot",
    dataSource: { type: "array", defaultValue: ["First item", "Second item"] },
    header: "slot",
    footer: "slot",
    size: choice(["small", "default", "large"], "default"),
    split: "boolean",
    bordered: "boolean",
    loading: "boolean",
  });
  register(loader, AntdListItem, "list-item", "AntdListItem", {
    children: slot("Item"),
    extra: "slot",
    actions: "slot",
  });
  register(loader, AntdListItemMeta, "list-item-meta", "AntdListItemMeta", {
    title: slot("Item title"),
    description: slot("Item description"),
    avatar: "slot",
  });
  register(loader, AntdListy, "listy", "AntdListy", {
    items: {
      type: "array",
      defaultValue: [
        { key: "1", content: "First item" },
        { key: "2", content: "Second item" },
      ],
    },
    height: { type: "number", defaultValue: 240 },
    virtual: "boolean",
    sticky: "boolean",
  });
  register(loader, AntdMasonry, "masonry", "AntdMasonry", {
    items: {
      type: "array",
      defaultValue: [
        { key: "1", data: { content: "First tile" } },
        { key: "2", data: { content: "Second tile" } },
      ],
    },
    columns: { type: "number", defaultValue: 2 },
    gutter: { type: "number", defaultValue: 16 },
  });
  register(
    loader,
    AntdMentions,
    "mentions",
    "AntdMentions",
    {
      value: "string",
      options: {
        type: "array",
        defaultValue: [{ value: "alice", label: "Alice" }],
      },
      prefix: "string",
      placeholder: "string",
      disabled: "boolean",
      onChange: event("value", "string"),
    },
    { states: valueState("text") },
  );
  register(loader, AntdPopconfirm, "popconfirm", "AntdPopconfirm", {
    children: slot("Delete"),
    title: slot("Delete this item?"),
    description: "slot",
    okText: "string",
    cancelText: "string",
    disabled: "boolean",
    onConfirm: event("event", "object"),
    onCancel: event("event", "object"),
  });
  register(loader, AntdQRCode, "qr-code", "AntdQRCode", {
    value: { type: "string", defaultValue: "https://publib.cn" },
    size: "number",
    color: { type: "color" },
    bgColor: { type: "color" },
    icon: "imageUrl",
    type: choice(["canvas", "svg"]),
    status: choice(["active", "expired", "loading", "scanned"]),
  });
  register(loader, AntdResult, "result", "AntdResult", {
    title: slot("Success"),
    subTitle: slot("The operation completed"),
    extra: "slot",
    icon: "slot",
    status: choice([
      "success",
      "error",
      "info",
      "warning",
      "404",
      "403",
      "500",
    ]),
  });
  register(loader, AntdSkeleton, "skeleton", "AntdSkeleton", {
    children: "slot",
    active: "boolean",
    loading: { type: "boolean", defaultValue: true },
    avatar: "boolean",
    title: "boolean",
    paragraph: "object",
    round: "boolean",
  });
  for (const [suffix, component, importName] of [
    ["button", AntdSkeletonButton, "AntdSkeletonButton"],
    ["input", AntdSkeletonInput, "AntdSkeletonInput"],
    ["avatar", AntdSkeletonAvatar, "AntdSkeletonAvatar"],
    ["image", AntdSkeletonImage, "AntdSkeletonImage"],
    ["node", AntdSkeletonNode, "AntdSkeletonNode"],
  ] as const) {
    register(loader, component, `skeleton-${suffix}`, importName, {
      active: "boolean",
    });
  }
  const spaceProps: Props = {
    children: slot("Spaced content"),
    orientation: choice(["horizontal", "vertical"]),
    size: { type: "number", defaultValue: 16 },
  };
  register(loader, AntdSpace, "space", "AntdSpace", {
    ...spaceProps,
    wrap: "boolean",
    separator: "slot",
    align: choice(["start", "end", "center", "baseline"]),
  });
  register(loader, AntdSpaceCompact, "space-compact", "AntdSpaceCompact", {
    children: slot("Compact content"),
    orientation: choice(["horizontal", "vertical"]),
    size: sizes,
    block: "boolean",
  });
  register(loader, AntdSpin, "spin", "AntdSpin", {
    children: slot("Loading content"),
    spinning: { type: "boolean", defaultValue: true },
    description: "string",
    size: sizes,
    delay: "number",
    fullscreen: "boolean",
  });
  register(
    loader,
    AntdSplitter,
    "splitter",
    "AntdSplitter",
    {
      orientation: choice(["horizontal", "vertical"]),
      children: {
        type: "slot",
        allowedComponents: ["plasmic-antd6-splitter-panel"],
        defaultValue: [
          {
            type: "component",
            name: "plasmic-antd6-splitter-panel",
            props: { children: "Left panel" },
          },
          {
            type: "component",
            name: "plasmic-antd6-splitter-panel",
            props: { children: "Right panel" },
          },
        ],
      },
      onResize: event("sizes", "object"),
    },
    { defaultStyles: { height: "240px", width: "100%" } },
  );
  register(loader, AntdSplitterPanel, "splitter-panel", "AntdSplitterPanel", {
    children: slot("Panel"),
    defaultSize: "string",
    min: "string",
    max: "string",
    resizable: "boolean",
    collapsible: "object",
  });
  register(loader, AntdStatistic, "statistic", "AntdStatistic", {
    title: slot("Total"),
    value: { type: "number", defaultValue: 128 },
    precision: "number",
    prefix: "slot",
    suffix: "slot",
    loading: "boolean",
    styles: "object",
  });
  register(
    loader,
    AntdStatisticTimer,
    "statistic-timer",
    "AntdStatisticTimer",
    {
      title: slot("Timer"),
      type: choice(["countdown", "countup"]),
      value: { type: "number", description: "Unix timestamp in milliseconds" },
      format: "string",
      onFinish: { type: "eventHandler", argTypes: [] },
    },
  );
  register(loader, AntdTag, "tag", "AntdTag", {
    children: slot("Tag"),
    color: { type: "color" },
    variant: choice(["outlined", "filled", "solid"]),
    closable: "boolean",
    icon: "slot",
    onClose: event("event", "object"),
  });
  register(
    loader,
    AntdTagCheckable,
    "tag-checkable",
    "AntdTagCheckable",
    {
      children: slot("Choice"),
      checked: "boolean",
      onChange: event("checked", "boolean"),
    },
    { states: valueState("boolean", "checked") },
  );
  register(loader, AntdTimeline, "timeline", "AntdTimeline", {
    items: {
      type: "array",
      defaultValue: [
        { title: "First", content: "First event" },
        { title: "Second", content: "Second event" },
      ],
    },
    mode: choice(["start", "end", "alternate"]),
    reverse: "boolean",
  });
  register(
    loader,
    AntdTransfer,
    "transfer",
    "AntdTransfer",
    {
      dataSource: {
        type: "array",
        defaultValue: [
          { key: "1", title: "One" },
          { key: "2", title: "Two" },
        ],
      },
      targetKeys: { type: "array" },
      showSearch: "boolean",
      disabled: "boolean",
      oneWay: "boolean",
      onChange: event("targetKeys", "object"),
    },
    { states: valueState("array", "targetKeys") },
  );
  register(
    loader,
    AntdTreeSelect,
    "tree-select",
    "AntdTreeSelect",
    {
      treeData: {
        type: "array",
        defaultValue: [
          {
            title: "Parent",
            value: "parent",
            children: [{ title: "Child", value: "child" }],
          },
        ],
      },
      value: "string",
      multiple: "boolean",
      treeCheckable: "boolean",
      treeDefaultExpandAll: "boolean",
      allowClear: "boolean",
      disabled: "boolean",
      placeholder: "string",
      variant,
      onChange: event("value", "object"),
    },
    { states: valueState("text") },
  );
  register(loader, AntdTypography, "typography", "AntdTypography", {
    children: slot("Typography"),
  });
  const textProps: Props = {
    children: slot("Text"),
    type: choice(["secondary", "success", "warning", "danger"]),
    strong: "boolean",
    italic: "boolean",
    underline: "boolean",
    delete: "boolean",
    code: "boolean",
    mark: "boolean",
    copyable: "boolean",
    ellipsis: "boolean",
    disabled: "boolean",
  };
  register(
    loader,
    AntdTypographyText,
    "typography-text",
    "AntdTypographyText",
    textProps,
  );
  register(
    loader,
    AntdTypographyTitle,
    "typography-title",
    "AntdTypographyTitle",
    {
      ...textProps,
      children: slot("Heading"),
      level: { type: "choice", options: [1, 2, 3, 4, 5], defaultValueHint: 2 },
    },
  );
  register(
    loader,
    AntdTypographyParagraph,
    "typography-paragraph",
    "AntdTypographyParagraph",
    { ...textProps, children: slot("Paragraph") },
  );
  register(
    loader,
    AntdTypographyLink,
    "typography-link",
    "AntdTypographyLink",
    {
      ...textProps,
      children: slot("Link"),
      href: "href",
      target: choice(["_self", "_blank"]),
    },
  );
  register(loader, AntdWatermark, "watermark", "AntdWatermark", {
    children: slot("Watermarked content"),
    content: { type: "string", defaultValue: "Confidential" },
    image: "imageUrl",
    rotate: "number",
    font: "object",
    gap: { type: "array" },
  });
  register(
    loader,
    AntdInputOTP,
    "input-otp",
    "AntdInputOTP",
    {
      value: "string",
      length: { type: "number", defaultValue: 6 },
      disabled: "boolean",
      mask: "boolean",
      size: sizes,
      variant,
      onChange: event("value", "string"),
      onComplete: event("value", "string"),
    },
    { states: valueState("text") },
  );
  register(
    loader,
    AntdInputSearch,
    "input-search",
    "AntdInputSearch",
    {
      value: "string",
      placeholder: "string",
      enterButton: "boolean",
      loading: "boolean",
      disabled: "boolean",
      allowClear: "boolean",
      onChange: event("value", "string"),
      onSearch: event("value", "string"),
    },
    { states: valueState("text") },
  );
  register(loader, AntdUploadDragger, "upload-dragger", "AntdUploadDragger", {
    children: slot("Drop files here"),
    action: "string",
    name: "string",
    multiple: "boolean",
    accept: "string",
    disabled: "boolean",
    onChange: event("info", "object"),
  });
  register(
    loader,
    AntdCalendar,
    "calendar",
    "AntdCalendar",
    {
      value: "string",
      fullscreen: "boolean",
      mode: choice(["month", "year"]),
      onChange: event("value", "string"),
      onSelect: event("value", "string"),
    },
    { states: valueState("text") },
  );
  register(
    loader,
    AntdTimePicker,
    "time-picker",
    "AntdTimePicker",
    {
      value: "string",
      format: { type: "string", defaultValue: "HH:mm:ss" },
      use12Hours: "boolean",
      disabled: "boolean",
      allowClear: "boolean",
      variant,
      onChange: event("value", "string"),
    },
    { states: valueState("text") },
  );
  register(
    loader,
    AntdTimeRangePicker,
    "time-range-picker",
    "AntdTimeRangePicker",
    {
      value: { type: "array" },
      format: "string",
      use12Hours: "boolean",
      disabled: "boolean",
      variant,
      onChange: event("value", "object"),
    },
    { states: valueState("array") },
  );
  register(
    loader,
    AntdMultipleDatePicker,
    "date-picker-multiple",
    "AntdMultipleDatePicker",
    {
      value: { type: "array" },
      picker: choice(["date", "week", "month", "quarter", "year"]),
      disabled: "boolean",
      onChange: event("value", "object"),
    },
    { states: valueState("array") },
  );
  register(loader, AntdTour, "tour", "AntdTour", {
    open: "boolean",
    current: "number",
    steps: {
      type: "array",
      defaultValue: [{ title: "Welcome", description: "Start your tour" }],
    },
    type: choice(["default", "primary"]),
    onChange: event("current", "number"),
    onClose: event("current", "number"),
  });
}
