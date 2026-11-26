import type { DatePickerSemanticType } from "antd/es/date-picker/generatePicker/interface";
import type { ElementSemanticType } from "antd/es/skeleton/Element";
import type { ListItemSemanticClassNames } from "antd/es/list/Item";
import type { StepsSemanticType } from "antd/es/steps";
import type { AnchorSemanticType } from "antd/es/anchor/Anchor";
import type { AutoCompleteSemanticType } from "antd/es/auto-complete/AutoComplete";
import type { RibbonSemanticType } from "antd/es/badge/Ribbon";
import type { CardMetaSemanticType } from "antd/es/card/CardMeta";
import type { CascaderSemanticType } from "antd/es/cascader/index";
import type { DividerSemanticType } from "antd/es/divider/index";
import type { EmptySemanticType } from "antd/es/empty/index";
import type { FloatButtonSemanticType } from "antd/es/float-button/FloatButton";
import type { FloatButtonGroupSemanticType } from "antd/es/float-button/FloatButtonGroup";
import type { ImageSemanticType } from "antd/es/image/index";
import type { SiderSemanticType } from "antd/es/layout/Sider";
import type { ListySemanticType } from "antd/es/listy/index";
import type { MasonrySemanticType } from "antd/es/masonry/Masonry";
import type { MentionSemanticType } from "antd/es/mentions/index";
import type { PopconfirmSemanticType } from "antd/es/popconfirm/index";
import type { QRCodeSemanticType } from "antd/es/qr-code/interface";
import type { ResultSemanticType } from "antd/es/result/index";
import type { SkeletonSemanticType } from "antd/es/skeleton/Skeleton";
import type { SpaceSemanticType } from "antd/es/space/index";
import type { SpinSemanticType } from "antd/es/spin/index";
import type { SplitterSemanticType } from "antd/es/splitter/interface";
import type { TransferSemanticType } from "antd/es/transfer/index";
import type { TreeSelectSemanticType } from "antd/es/tree-select/index";
import type { TypographySemanticType } from "antd/es/typography/Base/index";
import type { OTPSemanticType } from "antd/es/input/OTP/index";
import type { InputSearchSemanticType } from "antd/es/input/Search";
import type { UploadSemanticType } from "antd/es/upload/interface";
import type { CalendarSemanticType } from "antd/es/calendar/generateCalendar";
import type { TimePickerSemanticType } from "antd/es/time-picker/index";
import type { TourSemanticType } from "antd/es/tour/interface";
import type { PlasmicCanvasProps } from "@plasmicapp/host";
import {
  PropType,
  usePlasmicCanvasComponentInfo,
  usePlasmicCanvasContext,
} from "@plasmicapp/host";
import { CodeComponentMeta } from "@plasmicapp/host/registerComponent";
import * as Ant from "antd";
import type { AlertSemanticType } from "antd/es/alert/Alert";
import type { BadgeSemanticType } from "antd/es/badge/Badge";
import type { CardSemanticType } from "antd/es/card/Card";
import type { DescriptionsSemanticType } from "antd/es/descriptions";
import type { StatisticSemanticType } from "antd/es/statistic/Statistic";
import type { TagSemanticType } from "antd/es/tag";
import dayjs from "dayjs";
import React from "react";
import {
  getCanvasItems,
  renderCanvasSlot,
  useCanvasOverlay,
} from "./canvas-overlay";
import { semanticAppearance, type SemanticPartLabels } from "./semantic-appearance";
import { Registerable, registerComponentHelper } from "./utils";

const canvasOverlay = { triggerSlot: "children" };

// Export the same implementations that generated pages import.
export const AntdAffix: typeof Ant.Affix = Ant.Affix;
export const AntdAlert: typeof Ant.Alert = Ant.Alert;
export const AntdAnchor: typeof Ant.Anchor = Ant.Anchor;
export const AntdAutoComplete: typeof Ant.AutoComplete = Ant.AutoComplete;
const badgeStatuses = [
  "success",
  "processing",
  "default",
  "error",
  "warning",
] as const;
export type BadgeStatus = (typeof badgeStatuses)[number];
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
export const AntdDescriptionsItem: typeof Ant.Descriptions.Item =
  Ant.Descriptions.Item;
export const AntdDescriptions = React.forwardRef<
  React.ComponentRef<typeof Ant.Descriptions>,
  React.ComponentPropsWithoutRef<typeof Ant.Descriptions>
>((props, ref) => {
  if (props.items != null) {
    return <Ant.Descriptions {...props} ref={ref} />;
  }
  return renderCanvasSlot(props.children, (children) => (
    <Ant.Descriptions
      {...props}
      ref={ref}
      children={undefined}
      items={getCanvasItems(children, (item) => item.type === AntdDescriptionsItem)
        .filter(React.isValidElement<React.ComponentProps<typeof AntdDescriptionsItem> & PlasmicCanvasProps>).map(
        (item, index) => {
          const { __canvas: _selection, ...itemProps } = item.props;
          return { ...itemProps, key: item.key ?? String(index) };
        }
      )}
    />
  ));
});
export const AntdDivider: typeof Ant.Divider = Ant.Divider;
export const AntdEmpty: typeof Ant.Empty = Ant.Empty;
export const AntdFlex: typeof Ant.Flex = Ant.Flex;
export const AntdFloatButton: typeof Ant.FloatButton = Ant.FloatButton;
export const AntdFloatButtonGroup: typeof Ant.FloatButton.Group =
  Ant.FloatButton.Group;
export const AntdBackTop: typeof Ant.FloatButton.BackTop =
  Ant.FloatButton.BackTop;
export function AntdImage(props: React.ComponentProps<typeof Ant.Image>) {
  const canvas = usePlasmicCanvasContext();
  return (
    <Ant.Image
      {...props}
      preview={canvas && !canvas.interactive ? false : props.preview}
    />
  );
}
export function AntdImagePreviewGroup(
  props: React.ComponentProps<typeof Ant.Image.PreviewGroup>,
) {
  const canvas = usePlasmicCanvasContext();
  return (
    <Ant.Image.PreviewGroup
      {...props}
      preview={canvas && !canvas.interactive ? false : props.preview}
    />
  );
}
export const AntdLayout: typeof Ant.Layout = Ant.Layout;
export const AntdLayoutHeader: typeof Ant.Layout.Header = Ant.Layout.Header;
export const AntdLayoutFooter: typeof Ant.Layout.Footer = Ant.Layout.Footer;
export const AntdLayoutContent: typeof Ant.Layout.Content = Ant.Layout.Content;
export const AntdLayoutSider: typeof Ant.Layout.Sider = Ant.Layout.Sider;
export const AntdMentions: typeof Ant.Mentions = Ant.Mentions;
export function AntdPopconfirm(
  props: React.ComponentProps<typeof Ant.Popconfirm> & PlasmicCanvasProps,
) {
  const {
    props: rest,
    open,
    isEditing,
    destroyOnHidden,
  } = useCanvasOverlay(props, canvasOverlay.triggerSlot);
  return (
    <Ant.Popconfirm
      {...rest}
      open={open}
      destroyOnHidden={destroyOnHidden}
      onOpenChange={rest.onOpenChange}
      afterOpenChange={isEditing ? undefined : rest.afterOpenChange}
      onConfirm={isEditing ? undefined : props.onConfirm}
      onCancel={isEditing ? undefined : props.onCancel}
    />
  );
}
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
export const AntdInputOTP: typeof Ant.Input.OTP = Ant.Input.OTP;
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

// Render callbacks cannot be serialized as ordinary JSON props in Studio.
export function AntdList(
  props: React.ComponentProps<typeof Ant.List>,
) {
  return (
    <Ant.List
      {...props}
      renderItem={props.renderItem}
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
  > & {
    __canvas?: PlasmicCanvasProps["__canvas"];
  },
) {
  const canvas = usePlasmicCanvasContext();
  const info = usePlasmicCanvasComponentInfo(props);
  const { __canvas: _canvas, ...rest } = props;
  const fullContentView =
    !!canvas && !canvas.interactive && info?.fullContent === true;
  return (
    <Ant.Listy
      {...rest}
      {...(fullContentView
        ? { height: undefined, virtual: false, sticky: false }
        : {})}
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
const descriptionsItemAppearance: Props = {
  style: {
    type: "object",
    description: 'Native React.CSSProperties applied to the Item table cell, including width as a CSS string ("25%", "160px") or a number in pixels. For four equal columns in an unbordered horizontal Descriptions, set { width: "25%" } on each of the four first-row Items with span=1. With borders, label and content are separate cells; this is not a field-group width control.',
  },
  className: {
    type: "string",
    description: "CSS class applied to the Item table cell(s).",
  },
  ...semanticAppearance(
    {
      label: "Label",
      content: "Content",
    },
    {
      stylesDescription:
        "Native per-Item semantic styles. These override the parent Descriptions label/content styles; they do not set the whole field group's width.",
      classNamesDescription: "Native per-Item semantic CSS classes.",
    },
  ),
};
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
  variableType: "text" | "boolean" | "number" | "array" | "object",
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
    icon: { type: "slot", hidePlaceholder: true },
    title: { ...slot("Alert title"), hidePlaceholder: true },
    description: { type: "slot", hidePlaceholder: true },
    type: choice(["success", "info", "warning", "error"], "info"),
    showIcon: "boolean",
    banner: "boolean",
    closable: "object",
    action: { type: "slot", hidePlaceholder: true },
    ...semanticAppearance(
      {
        root: "Alert container",
        icon: "Icon",
        section: "Content section",
        title: "Title",
        description: "Description",
        actions: "Actions",
        close: "Close button",
      } satisfies Record<
        keyof NonNullable<AlertSemanticType["classNames"]>,
        string
      >,
      { advanced: true },
    ),
  });
  register(loader, AntdAnchor, "anchor", "AntdAnchor", {
    ...semanticAppearance({
      root: "Root",
      item: "Item",
      itemTitle: "Item Title",
      indicator: "Indicator",
    } satisfies SemanticPartLabels<AnchorSemanticType["classNames"]>),
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
      ...semanticAppearance({
        root: "Root",
        prefix: "Prefix",
        input: "Input",
        placeholder: "Placeholder",
        content: "Content",
        clear: "Clear",
        popup: {
          root: "Root",
          listItem: "List Item",
          list: "List",
        },
      } satisfies SemanticPartLabels<AutoCompleteSemanticType["classNames"]>),
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
  // The outer ring is a pseudo-element. Keep the status dot itself visible.
  const badgeStyleId = "plasmic-antd6-canvas-badge-style";
  if (typeof document !== "undefined" && !document.getElementById(badgeStyleId)) {
    const style = document.createElement("style");
    style.id = badgeStyleId;
    style.setAttribute("data-plasmic-editor-style", "");
    style.textContent = ".__non_interactive_canvas .ant-badge-status-dot.ant-badge-status-processing::after { content: none !important; }";
    document.head.appendChild(style);
  }
  register(loader, AntdBadge, "badge", "AntdBadge", {
    children: { type: "slot", hidePlaceholder: true },
    count: { type: "number" },
    dot: "boolean",
    showZero: "boolean",
    overflowCount: "number",
    color: { type: "color" },
    size: choice(["small", "medium"]),
    status: choice([...badgeStatuses]),
    text: "string",
    ...semanticAppearance(
      {
        root: "Badge container",
        indicator: "Indicator",
      } satisfies Record<
        keyof NonNullable<BadgeSemanticType["classNames"]>,
        string
      >,
      { advanced: true },
    ),
  });
  register(loader, AntdBadgeRibbon, "badge-ribbon", "AntdBadgeRibbon", {
    ...semanticAppearance({
      root: "Root",
      content: "Content",
      indicator: "Indicator",
    } satisfies SemanticPartLabels<RibbonSemanticType["classNames"]>),
    children: slot("Ribbon content"),
    text: { ...slot("Ribbon"), hidePlaceholder: true },
    color: { type: "color" },
    placement: choice(["start", "end"]),
  });
  register(loader, AntdBorderBeam, "border-beam", "AntdBorderBeam", {
    children: slot("Border beam"),
    color: { type: "color" },
  });
  register(loader, AntdCard, "card", "AntdCard", {
    children: slot("Card content"),
    title: { type: "slot", hidePlaceholder: true },
    extra: { type: "slot", hidePlaceholder: true },
    cover: { type: "slot", hidePlaceholder: true },
    actions: { type: "slot", hidePlaceholder: true },
    size: choice(["small", "medium"], "medium"),
    variant: choice(["outlined", "borderless"]),
    hoverable: "boolean",
    loading: "boolean",
    ...semanticAppearance({
      root: "Card container",
      header: "Header",
      title: "Title",
      extra: "Extra content",
      body: "Body",
      actions: "Actions",
      cover: "Cover",
    } satisfies Record<keyof NonNullable<CardSemanticType["classNames"]>, string>),
  });
  register(loader, AntdCardMeta, "card-meta", "AntdCardMeta", {
    ...semanticAppearance({
      root: "Root",
      section: "Section",
      avatar: "Avatar",
      title: "Title",
      description: "Description",
    } satisfies SemanticPartLabels<CardMetaSemanticType["classNames"]>),
    title: { ...slot("Title"), hidePlaceholder: true },
    description: { type: "slot", hidePlaceholder: true },
    avatar: { type: "slot", hidePlaceholder: true },
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
      ...semanticAppearance({
        root: "Root",
        prefix: "Prefix",
        suffix: "Suffix",
        input: "Input",
        placeholder: "Placeholder",
        content: "Content",
        item: "Item",
        itemContent: "Item Content",
        itemRemove: "Item Remove",
        popup: {
          root: "Root",
          listItem: "List Item",
          list: "List",
        },
      } satisfies SemanticPartLabels<CascaderSemanticType["classNames"]>),
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
    gutter: { type: "number", defaultValueHint: 0 },
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
    span: "number",
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
    title: { type: "slot", hidePlaceholder: true, description: "Editable heading for this read-only information group." },
    items: {
      type: "array",
      advanced: true,
      description: "Use only when the field collection itself is determined at runtime or the user explicitly requests native items: [{ key, label, children, span?, style?, className?, styles?, classNames? }]. Item style controls its table cell; styles.label/content control its label/value. Fixed fields must use Descriptions.Item label/content slots, even with data-bound values. Items override slots, including an empty array; leave unset for canvas editing.",
      itemType: {
        type: "object",
        fields: {
          key: "string",
          label: "string",
          children: "string",
          span: "number",
          ...descriptionsItemAppearance,
        },
        nameFunc: (item) => item.label ?? item.key,
      },
    },
    children: {
      type: "slot",
      displayName: "Items",
      allowedComponents: ["plasmic-antd6-descriptions-item"],
      allowRootWrapper: false,
      hidePlaceholder: true,
      hidden: (ps) => ps.items != null,
      description: "Only direct Descriptions.Item children are allowed; no span/div/text fields, layout wrappers or other components. Edit label/content inside each Item. Use either this slot or native items, never both; clear these children when setting items.",
      defaultValue: [{
        type: "component",
        name: "plasmic-antd6-descriptions-item",
        props: {
          key: "name",
          label: "Name",
          children: "Example",
        },
      }],
    },
    column: { type: "number", description: 'Number of fields per row, not an equal-width switch. In unbordered horizontal layout, four first-row Items with span=1 and style: { width: "25%" } establish four equal columns. Use span for long values and verify rendered widths.' },
    layout: choice(["horizontal", "vertical"]),
    bordered: "boolean",
    size: sizes,
    ...semanticAppearance({
      root: "Descriptions container",
      header: "Header",
      title: "Title",
      extra: "Extra content",
      label: "Label",
      content: "Content",
    } satisfies Record<
      keyof NonNullable<DescriptionsSemanticType["classNames"]>,
      string
    >),
  }, { description: "Display grouped read-only label/value fields in details, drawers, confirmations or create/edit summaries. Use alongside Form for mixed read-only and editable content; use Statistic for emphasized metrics." });
  register(loader, AntdDescriptionsItem, "descriptions-item", "AntdDescriptionsItem", {
    key: { type: "string", description: "A stable field key within this Descriptions." },
    label: { ...slot("Label"), hidePlaceholder: true, mergeWithParent: true },
    children: { ...slot("Value"), displayName: "Content", hidePlaceholder: true, mergeWithParent: true },
    span: { type: "number", min: 1, defaultValueHint: 1, description: "Columns occupied by this field." },
    ...descriptionsItemAppearance,
  }, { description: "Editable label and content for a read-only field. Converted to a native Descriptions items entry at runtime." });
  register(loader, AntdDivider, "divider", "AntdDivider", {
    ...semanticAppearance({
      root: "Root",
      rail: "Rail",
      content: "Content",
    } satisfies SemanticPartLabels<DividerSemanticType["classNames"]>),
    children: { type: "slot", hidePlaceholder: true },
    orientation: choice(["horizontal", "vertical"]),
    titlePlacement: choice(["start", "center", "end"]),
    dashed: "boolean",
    plain: "boolean",
    size: sizes,
  });
  register(loader, AntdEmpty, "empty", "AntdEmpty", {
    ...semanticAppearance({
      root: "Root",
      image: "Image",
      description: "Description",
      footer: "Footer",
    } satisfies SemanticPartLabels<EmptySemanticType["classNames"]>),
    description: { type: "slot", hidePlaceholder: true },
    children: { type: "slot", hidePlaceholder: true },
    image: "imageUrl",
  });
  register(loader, AntdFlex, "flex", "AntdFlex", {
    children: slot("Flex content"),
    vertical: "boolean",
    wrap: choice(["nowrap", "wrap", "wrap-reverse"]),
    gap: "number",
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
    ...semanticAppearance({
      root: "Root",
      icon: "Icon",
      content: "Content",
    } satisfies SemanticPartLabels<FloatButtonSemanticType["classNames"]>),
    icon: { type: "slot", hidePlaceholder: true },
    content: { type: "slot", hidePlaceholder: true },
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
      ...semanticAppearance({
        root: "Root",
        list: "List",
        item: "Item",
        itemIcon: "Item Icon",
        itemContent: "Item Content",
        trigger: "Trigger",
        triggerIcon: "Trigger Icon",
        triggerContent: "Trigger Content",
      } satisfies SemanticPartLabels<FloatButtonGroupSemanticType["classNames"]>),
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
    ...semanticAppearance({
      root: "Root",
      icon: "Icon",
      content: "Content",
    } satisfies SemanticPartLabels<FloatButtonSemanticType["classNames"]>),
    visibilityHeight: "number",
    duration: "number",
    icon: { type: "slot", hidePlaceholder: true },
  });
  register(loader, AntdImage, "image", "AntdImage", {
    ...semanticAppearance({
      root: "Root",
      image: "Image",
      cover: "Cover",
      placeholder: {
        progress: {
          root: "Root",
          content: "Content",
          rail: "Rail",
          indicator: "Indicator",
        },
      },
      popup: {
        root: "Root",
        mask: "Mask",
        body: "Body",
        footer: "Footer",
        actions: "Actions",
        close: "Close",
      },
    } satisfies SemanticPartLabels<ImageSemanticType["classNames"]>),
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
      ...semanticAppearance({
        root: "Root",
        image: "Image",
        cover: "Cover",
        placeholder: {
          progress: {
            root: "Root",
            content: "Content",
            rail: "Rail",
            indicator: "Indicator",
          },
        },
        popup: {
          root: "Root",
          mask: "Mask",
          body: "Body",
          footer: "Footer",
          actions: "Actions",
          close: "Close",
        },
      } satisfies SemanticPartLabels<ImageSemanticType["classNames"]>),
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
      ...semanticAppearance({
        root: "Root",
        body: "Body",
      } satisfies SemanticPartLabels<SiderSemanticType["classNames"]>),
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
    children: { type: "slot", displayName: "Static content", hidePlaceholder: true },
    dataSource: { type: "array", displayName: "Data source" },
    renderItem: {
      type: "slot", displayName: "Render item", renderPropParams: ["item", "index"], hidePlaceholder: true,
      description: "Render each dataSource item using item and index bindings. Supports List.Item, tags, buttons, and layouts.",
    },
    header: { type: "slot", hidePlaceholder: true },
    footer: { type: "slot", hidePlaceholder: true },
    size: choice(["small", "default", "large"], "default"),
    split: "boolean",
    bordered: "boolean",
    loading: "boolean",
  });
  register(loader, AntdListItem, "list-item", "AntdListItem", {
    ...semanticAppearance({
      actions: "Actions",
      extra: "Extra",
    } satisfies SemanticPartLabels<ListItemSemanticClassNames>),
    children: slot("Item"),
    extra: { type: "slot", hidePlaceholder: true },
    actions: { type: "slot", hidePlaceholder: true },
  });
  register(loader, AntdListItemMeta, "list-item-meta", "AntdListItemMeta", {
    title: { ...slot("Item title"), hidePlaceholder: true },
    description: { type: "slot", hidePlaceholder: true },
    avatar: { type: "slot", hidePlaceholder: true },
  });
  register(loader, AntdListy, "listy", "AntdListy", {
    ...semanticAppearance({
      root: "Root",
      item: "Item",
      groupHeader: "Group Header",
    } satisfies SemanticPartLabels<ListySemanticType["classNames"]>),
    items: {
      type: "array",
      defaultValue: [
        { key: "1", content: "First item" },
        { key: "2", content: "Second item" },
      ],
    },
    height: "number",
    virtual: "boolean",
    sticky: "boolean",
  });
  register(loader, AntdMasonry, "masonry", "AntdMasonry", {
    ...semanticAppearance({
      root: "Root",
      item: "Item",
    } satisfies SemanticPartLabels<MasonrySemanticType["classNames"]>),
    items: {
      type: "array",
      defaultValue: [
        { key: "1", data: { content: "First tile" } },
        { key: "2", data: { content: "Second tile" } },
      ],
    },
    columns: { type: "number", defaultValueHint: 3 },
    gutter: { type: "number", defaultValueHint: 0 },
  });
  register(
    loader,
    AntdMentions,
    "mentions",
    "AntdMentions",
    {
      ...semanticAppearance({
        root: "Root",
        textarea: "Textarea",
        popup: "Popup",
        suffix: "Suffix",
      } satisfies SemanticPartLabels<MentionSemanticType["classNames"]>),
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
  register(
    loader,
    AntdPopconfirm,
    "popconfirm",
    "AntdPopconfirm",
    {
      ...semanticAppearance({
        title: "Title",
        content: "Content",
        root: "Root",
        container: "Container",
        arrow: "Arrow",
        icon: "Icon",
      } satisfies SemanticPartLabels<PopconfirmSemanticType["classNames"]>),
      icon: { type: "slot", hidePlaceholder: true },
      children: slot("Delete"),
      title: { ...slot("Delete this item?"), hidePlaceholder: true },
      description: { type: "slot", hidePlaceholder: true },
      okText: "string",
      cancelText: "string",
      okButtonProps: "object",
      disabled: "boolean",
      open: {
        type: "boolean",
        description:
          "Native controlled open state. Leave unset for the native click trigger; bind it when another action, such as an ActionGroup item, requests confirmation.",
      },
      onOpenChange: event("open", "boolean"),
      onConfirm: event("event", "object"),
      onCancel: event("event", "object"),
    },
    { canvasOverlay },
  );
  register(loader, AntdQRCode, "qr-code", "AntdQRCode", {
    ...semanticAppearance({
      root: "Root",
      cover: "Cover",
    } satisfies SemanticPartLabels<QRCodeSemanticType["classNames"]>),
    value: { type: "string", defaultValue: "https://publib.cn" },
    size: "number",
    color: { type: "color" },
    bgColor: { type: "color" },
    icon: "imageUrl",
    type: choice(["canvas", "svg"]),
    status: choice(["active", "expired", "loading", "scanned"]),
  });
  register(loader, AntdResult, "result", "AntdResult", {
    ...semanticAppearance({
      root: "Root",
      title: "Title",
      subTitle: "Sub Title",
      body: "Body",
      extra: "Extra",
      icon: "Icon",
    } satisfies SemanticPartLabels<ResultSemanticType["classNames"]>),
    title: { ...slot("Success"), hidePlaceholder: true },
    subTitle: { type: "slot", hidePlaceholder: true },
    extra: { type: "slot", hidePlaceholder: true },
    icon: { type: "slot", hidePlaceholder: true },
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
    ...semanticAppearance({
      root: "Root",
      header: "Header",
      section: "Section",
      avatar: "Avatar",
      title: "Title",
      paragraph: "Paragraph",
    } satisfies SemanticPartLabels<SkeletonSemanticType["classNames"]>),
    children: { type: "slot", hidePlaceholder: true },
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
      ...semanticAppearance({
        root: "Root",
        content: "Content",
      } satisfies SemanticPartLabels<ElementSemanticType["classNames"]>),
      active: "boolean",
    });
  }
  const spaceProps: Props = {
    children: slot("Spaced content"),
    orientation: choice(["horizontal", "vertical"]),
    size: { type: "number", defaultValueHint: 8, description: "Gap in pixels. Unset uses the native small size." },
  };
  register(loader, AntdSpace, "space", "AntdSpace", {
    ...semanticAppearance({
      root: "Root",
      item: "Item",
      separator: "Separator",
    } satisfies SemanticPartLabels<SpaceSemanticType["classNames"]>),
    ...spaceProps,
    wrap: "boolean",
    separator: { type: "slot", hidePlaceholder: true },
    align: choice(["start", "end", "center", "baseline"]),
  });
  register(loader, AntdSpaceCompact, "space-compact", "AntdSpaceCompact", {
    children: slot("Compact content"),
    orientation: choice(["horizontal", "vertical"]),
    size: sizes,
    block: "boolean",
  });
  register(loader, AntdSpin, "spin", "AntdSpin", {
    ...semanticAppearance({
      root: "Root",
      section: "Section",
      indicator: "Indicator",
      description: "Description",
      container: "Container",
      tip: "Tip",
      mask: "Mask",
    } satisfies SemanticPartLabels<SpinSemanticType["classNames"]>),
    indicator: { type: "slot", hidePlaceholder: true },
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
      ...semanticAppearance({
        root: "Root",
        panel: "Panel",
        dragger: {
          default: "Default",
          active: "Active",
        },
      } satisfies SemanticPartLabels<SplitterSemanticType["classNames"]>),
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
    title: { type: "slot", hidePlaceholder: true },
    value: { type: "number", defaultValue: 128 },
    precision: "number",
    prefix: { type: "slot", hidePlaceholder: true },
    suffix: { type: "slot", hidePlaceholder: true },
    loading: "boolean",
    ...semanticAppearance({
      root: "Statistic container",
      header: "Header",
      title: "Title",
      content: "Content",
      value: "Value",
      prefix: "Prefix",
      suffix: "Suffix",
    } satisfies Record<
      keyof NonNullable<StatisticSemanticType["classNames"]>,
      string
    >),
  });
  register(
    loader,
    AntdStatisticTimer,
    "statistic-timer",
    "AntdStatisticTimer",
    {
      ...semanticAppearance({
        root: "Root",
        content: "Content",
        value: "Value",
        title: "Title",
        header: "Header",
        prefix: "Prefix",
        suffix: "Suffix",
      } satisfies SemanticPartLabels<StatisticSemanticType["classNames"]>),
      title: { type: "slot", hidePlaceholder: true },
      type: choice(["countdown", "countup"]),
      value: { type: "number", description: "Unix timestamp in milliseconds" },
      format: "string",
      onFinish: { type: "eventHandler", argTypes: [] },
    },
  );
  register(loader, AntdTag, "tag", "AntdTag", {
    closeIcon: { type: "slot", hidePlaceholder: true },
    children: { ...slot("Tag"), hidePlaceholder: true },
    color: { type: "color" },
    variant: choice(["outlined", "filled", "solid"]),
    closable: "boolean",
    icon: { type: "slot", hidePlaceholder: true },
    onClose: event("event", "object"),
    ...semanticAppearance(
      {
        root: "Tag container",
        icon: "Icon",
        content: "Content",
        close: "Close button",
      } satisfies Record<
        keyof NonNullable<TagSemanticType["classNames"]>,
        string
      >,
      { advanced: true },
    ),
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
// Timeline renders the Steps semantic regions except itemSubtitle.
    ...semanticAppearance({
      root: "Root",
      item: "Item",
      itemWrapper: "Item Wrapper",
      itemIcon: "Item Icon",
      itemSection: "Item Section",
      itemHeader: "Item Header",
      itemTitle: "Item Title",
      itemContent: "Item Content",
      itemRail: "Item Rail",
    } satisfies SemanticPartLabels<
      Omit<NonNullable<StepsSemanticType["classNames"]>, "itemSubtitle">
    >),
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
      ...semanticAppearance({
        root: "Root",
        section: "Section",
        header: "Header",
        title: "Title",
        body: "Body",
        list: "List",
        item: "Item",
        itemIcon: "Item Icon",
        itemContent: "Item Content",
        footer: "Footer",
        actions: "Actions",
        source: {
          section: "Section",
          header: "Header",
          title: "Title",
          body: "Body",
          list: "List",
          item: "Item",
          itemIcon: "Item Icon",
          itemContent: "Item Content",
          footer: "Footer",
        },
        target: {
          section: "Section",
          header: "Header",
          title: "Title",
          body: "Body",
          list: "List",
          item: "Item",
          itemIcon: "Item Icon",
          itemContent: "Item Content",
          footer: "Footer",
        },
      } satisfies SemanticPartLabels<TransferSemanticType["classNames"]>),
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
      ...semanticAppearance({
        root: "Root",
        prefix: "Prefix",
        input: "Input",
        suffix: "Suffix",
        content: "Content",
        placeholder: "Placeholder",
        item: "Item",
        itemContent: "Item Content",
        itemRemove: "Item Remove",
        popup: {
          root: "Root",
          item: "Item",
          itemTitle: "Item Title",
          itemSwitcher: "Item Switcher",
        },
      } satisfies SemanticPartLabels<TreeSelectSemanticType["classNames"]>),
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
      value: {
        type: "object",
        description:
          "Single value, array of values in multiple/checkable mode, or labelInValue objects.",
      },
      multiple: "boolean",
      treeCheckable: "boolean",
      treeDefaultExpandAll: "boolean",
      allowClear: "boolean",
      disabled: "boolean",
      placeholder: "string",
      variant,
      onChange: event("value", "object"),
    },
    { states: valueState("object") },
  );
  register(loader, AntdTypography, "typography", "AntdTypography", {
    ...semanticAppearance({
      root: "Root",
      actions: "Actions",
      action: "Action",
      textarea: "Textarea",
    } satisfies SemanticPartLabels<TypographySemanticType["classNames"]>),
    children: slot("Typography"),
  });
  const textProps: Props = {
    ...semanticAppearance({
      root: "Root",
      actions: "Actions",
      action: "Action",
      textarea: "Textarea",
    } satisfies SemanticPartLabels<TypographySemanticType["classNames"]>),
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
      // Typography.Title has no native strong prop.
      ...Object.fromEntries(
        Object.entries(textProps).filter(([name]) => name !== "strong"),
      ),
      children: slot("Heading"),
      level: { type: "choice", options: [1, 2, 3, 4, 5], defaultValueHint: 1 },
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
      ...semanticAppearance({
        root: "Root",
        input: "Input",
        separator: "Separator",
      } satisfies SemanticPartLabels<OTPSemanticType["classNames"]>),
      value: "string",
      length: { type: "number", defaultValueHint: 6 },
      disabled: "boolean",
      mask: "boolean",
      size: sizes,
      variant,
      onChange: {
        ...event("value", "string"),
        description: "Native onChange: fires with the complete code once every cell is filled.",
      },
      onInput: {
        ...event("values", "object"),
        description: "Native onInput: fires on each cell edit with the array of cell values.",
      },
    },
    { states: valueState("text") },
  );
  register(
    loader,
    AntdInputSearch,
    "input-search",
    "AntdInputSearch",
    {
      ...semanticAppearance({
        root: "Root",
        input: "Input",
        prefix: "Prefix",
        suffix: "Suffix",
        clear: "Clear",
        count: "Count",
        button: {
          root: "Root",
          icon: "Icon",
          content: "Content",
        },
      } satisfies SemanticPartLabels<InputSearchSemanticType["classNames"]>),
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
    ...semanticAppearance({
      root: "Root",
      list: "List",
      item: "Item",
      trigger: "Trigger",
    } satisfies SemanticPartLabels<UploadSemanticType["classNames"]>),
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
      ...semanticAppearance({
        root: "Root",
        header: "Header",
        body: "Body",
        content: "Content",
        item: "Item",
        itemContent: "Item Content",
      } satisfies SemanticPartLabels<CalendarSemanticType["classNames"]>),
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
      ...semanticAppearance({
        root: "Root",
        prefix: "Prefix",
        input: "Input",
        suffix: "Suffix",
        popup: {
          root: "Root",
          content: "Content",
          item: "Item",
          footer: "Footer",
          container: "Container",
        },
      } satisfies SemanticPartLabels<TimePickerSemanticType["classNames"]>),
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
      ...semanticAppearance({
        root: "Root",
        prefix: "Prefix",
        input: "Input",
        suffix: "Suffix",
        popup: {
          root: "Root",
          header: "Header",
          body: "Body",
          content: "Content",
          item: "Item",
          footer: "Footer",
          container: "Container",
        },
      } satisfies SemanticPartLabels<DatePickerSemanticType["classNames"]>),
      value: { type: "array" },
      format: "string",
      use12Hours: "boolean",
      disabled: "boolean",
      variant,
      onChange: event("value", "object"),
    },
    { states: valueState("array") },
  );
  register(loader, AntdTour, "tour", "AntdTour", {
    ...semanticAppearance({
      root: "Root",
      cover: "Cover",
      close: "Close",
      mask: "Mask",
      section: "Section",
      footer: "Footer",
      actions: "Actions",
      indicator: "Indicator",
      indicators: "Indicators",
      header: "Header",
      title: "Title",
      description: "Description",
    } satisfies SemanticPartLabels<TourSemanticType["classNames"]>),
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
