'use strict';

var host = require('@plasmicapp/host');
var Ant = require('antd');
var dayjs = require('dayjs');
var React = require('react');
var canvasOverlay$1 = require('./canvas-overlay-BCQmyJjQ.cjs.js');
var utils = require('./utils-CRCm44nj.cjs.js');
require('@plasmicapp/host/registerComponent');
require('@plasmicapp/host/registerGlobalContext');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

function _interopNamespace(e) {
  if (e && e.__esModule) return e;
  var n = Object.create(null);
  if (e) {
    Object.keys(e).forEach(function (k) {
      if (k !== 'default') {
        var d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: function () { return e[k]; }
        });
      }
    });
  }
  n.default = e;
  return Object.freeze(n);
}

var Ant__namespace = /*#__PURE__*/_interopNamespace(Ant);
var dayjs__default = /*#__PURE__*/_interopDefault(dayjs);
var React__default = /*#__PURE__*/_interopDefault(React);

const canvasOverlay = { triggerSlot: "children" };
const AntdAffix = Ant__namespace.Affix;
const AntdAlert = Ant__namespace.Alert;
const AntdAnchor = Ant__namespace.Anchor;
const AntdAutoComplete = Ant__namespace.AutoComplete;
const AntdBadge = Ant__namespace.Badge;
const AntdBadgeRibbon = Ant__namespace.Badge.Ribbon;
const AntdBorderBeam = Ant__namespace.BorderBeam;
function AntdCard({
  actions,
  ...rest
}) {
  return /* @__PURE__ */ React__default.default.createElement(
    Ant__namespace.Card,
    {
      ...rest,
      actions: actions ? React__default.default.Children.toArray(actions) : void 0
    }
  );
}
const AntdCardMeta = Ant__namespace.Card.Meta;
const AntdCardGrid = Ant__namespace.Card.Grid;
const AntdCarousel = Ant__namespace.Carousel;
const AntdCascader = Ant__namespace.Cascader;
const AntdCascaderPanel = Ant__namespace.Cascader.Panel;
const AntdCol = Ant__namespace.Col;
const AntdDescriptions = Ant__namespace.Descriptions;
const AntdDivider = Ant__namespace.Divider;
const AntdEmpty = Ant__namespace.Empty;
const AntdFlex = Ant__namespace.Flex;
const AntdFloatButton = Ant__namespace.FloatButton;
const AntdFloatButtonGroup = Ant__namespace.FloatButton.Group;
const AntdBackTop = Ant__namespace.FloatButton.BackTop;
function AntdImage({
  objectFit,
  style,
  ...props
}) {
  const canvas = host.usePlasmicCanvasContext();
  return /* @__PURE__ */ React__default.default.createElement(
    Ant__namespace.Image,
    {
      ...props,
      preview: canvas && !canvas.interactive ? false : props.preview,
      style: { ...style, ...objectFit ? { objectFit } : {} }
    }
  );
}
function AntdImagePreviewGroup(props) {
  const canvas = host.usePlasmicCanvasContext();
  return /* @__PURE__ */ React__default.default.createElement(
    Ant__namespace.Image.PreviewGroup,
    {
      ...props,
      preview: canvas && !canvas.interactive ? false : props.preview
    }
  );
}
const AntdLayout = Ant__namespace.Layout;
const AntdLayoutHeader = Ant__namespace.Layout.Header;
const AntdLayoutFooter = Ant__namespace.Layout.Footer;
const AntdLayoutContent = Ant__namespace.Layout.Content;
const AntdLayoutSider = Ant__namespace.Layout.Sider;
const AntdMentions = Ant__namespace.Mentions;
function AntdPopconfirm(props) {
  const {
    props: rest,
    open,
    isEditing
  } = canvasOverlay$1.useCanvasOverlay(props, canvasOverlay.triggerSlot);
  return /* @__PURE__ */ React__default.default.createElement(
    Ant__namespace.Popconfirm,
    {
      ...rest,
      open,
      destroyOnHidden: isEditing ? true : props.destroyOnHidden,
      onOpenChange: isEditing ? void 0 : props.onOpenChange,
      afterOpenChange: isEditing ? void 0 : props.afterOpenChange,
      onConfirm: isEditing ? void 0 : props.onConfirm,
      onCancel: isEditing ? void 0 : props.onCancel
    }
  );
}
const AntdQRCode = Ant__namespace.QRCode;
const AntdResult = Ant__namespace.Result;
const AntdRow = Ant__namespace.Row;
const AntdSkeleton = Ant__namespace.Skeleton;
const AntdSkeletonButton = Ant__namespace.Skeleton.Button;
const AntdSkeletonInput = Ant__namespace.Skeleton.Input;
const AntdSkeletonAvatar = Ant__namespace.Skeleton.Avatar;
const AntdSkeletonImage = Ant__namespace.Skeleton.Image;
const AntdSkeletonNode = Ant__namespace.Skeleton.Node;
const AntdSpace = Ant__namespace.Space;
const AntdSpaceCompact = Ant__namespace.Space.Compact;
const AntdSpin = Ant__namespace.Spin;
const AntdSplitter = Ant__namespace.Splitter;
const AntdSplitterPanel = Ant__namespace.Splitter.Panel;
const AntdStatistic = Ant__namespace.Statistic;
const AntdStatisticTimer = Ant__namespace.Statistic.Timer;
function AntdTag({
  value,
  options,
  defaultColor,
  automaticColor,
  children,
  color,
  ...props
}) {
  const text = value == null ? "" : String(value);
  const option = options?.find((item) => item.value === text);
  const colors = [
    "blue",
    "green",
    "orange",
    "purple",
    "cyan",
    "magenta",
    "red",
    "gold"
  ];
  const hash = Array.from(text).reduce(
    (current, char) => current * 31 + char.charCodeAt(0) >>> 0,
    0
  );
  return /* @__PURE__ */ React__default.default.createElement(
    Ant__namespace.Tag,
    {
      ...props,
      color: color ?? (option?.color || defaultColor || (automaticColor ? colors[hash % colors.length] : void 0))
    },
    children ?? option?.label ?? text
  );
}
const AntdTagCheckable = Ant__namespace.Tag.CheckableTag;
const AntdTimeline = Ant__namespace.Timeline;
const AntdTreeSelect = Ant__namespace.TreeSelect;
const AntdTypography = Ant__namespace.Typography;
const AntdTypographyTitle = Ant__namespace.Typography.Title;
const AntdTypographyText = Ant__namespace.Typography.Text;
const AntdTypographyParagraph = Ant__namespace.Typography.Paragraph;
const AntdTypographyLink = Ant__namespace.Typography.Link;
const AntdWatermark = Ant__namespace.Watermark;
function AntdInputOTP({
  onChange,
  onComplete,
  ...rest
}) {
  return /* @__PURE__ */ React__default.default.createElement(
    Ant__namespace.Input.OTP,
    {
      ...rest,
      onInput: (values) => onChange?.(values.join("")),
      onChange: onComplete
    }
  );
}
function AntdInputSearch({
  onChange,
  ...rest
}) {
  return /* @__PURE__ */ React__default.default.createElement(
    Ant__namespace.Input.Search,
    {
      ...rest,
      onChange: (event2) => onChange?.(event2.target.value)
    }
  );
}
const AntdUploadDragger = Ant__namespace.Upload.Dragger;
function AntdCalendar({
  value,
  onChange,
  onSelect,
  ...rest
}) {
  return /* @__PURE__ */ React__default.default.createElement(
    Ant__namespace.Calendar,
    {
      ...rest,
      value: value ? dayjs__default.default(value) : void 0,
      onChange: (date) => onChange?.(date.toISOString()),
      onSelect: (date) => onSelect?.(date.toISOString())
    }
  );
}
function AntdTimePicker({ value, onChange, ...rest }) {
  return /* @__PURE__ */ React__default.default.createElement(
    Ant__namespace.TimePicker,
    {
      ...rest,
      value: value === void 0 ? void 0 : value ? dayjs__default.default(value) : null,
      onChange: (date) => onChange?.(date ? date.toISOString() : null)
    }
  );
}
function AntdTimeRangePicker({
  value,
  onChange,
  ...rest
}) {
  return /* @__PURE__ */ React__default.default.createElement(
    Ant__namespace.TimePicker.RangePicker,
    {
      ...rest,
      value: value === void 0 ? void 0 : value === null ? null : [
        value[0] ? dayjs__default.default(value[0]) : null,
        value[1] ? dayjs__default.default(value[1]) : null
      ],
      onChange: (dates) => onChange?.(
        dates ? [dates[0]?.toISOString() ?? null, dates[1]?.toISOString() ?? null] : null
      )
    }
  );
}
function AntdList(props) {
  return /* @__PURE__ */ React__default.default.createElement(
    Ant__namespace.List,
    {
      ...props,
      renderItem: props.renderItem
    }
  );
}
function AntdListItem({
  actions,
  ...rest
}) {
  return /* @__PURE__ */ React__default.default.createElement(
    Ant__namespace.List.Item,
    {
      ...rest,
      actions: actions ? React__default.default.Children.toArray(actions) : void 0
    }
  );
}
const AntdListItemMeta = Ant__namespace.List.Item.Meta;
function AntdListy(props) {
  return /* @__PURE__ */ React__default.default.createElement(
    Ant__namespace.Listy,
    {
      ...props,
      rowKey: "key",
      itemRender: (item) => /* @__PURE__ */ React__default.default.createElement("div", null, item.content)
    }
  );
}
function AntdMasonry(props) {
  return /* @__PURE__ */ React__default.default.createElement(
    Ant__namespace.Masonry,
    {
      ...props,
      itemRender: (item) => /* @__PURE__ */ React__default.default.createElement("div", null, item.data?.content)
    }
  );
}
function AntdTransfer(props) {
  return /* @__PURE__ */ React__default.default.createElement(
    Ant__namespace.Transfer,
    {
      ...props,
      render: (item) => String(item.title ?? item.key ?? "")
    }
  );
}
function AntdTour(props) {
  return /* @__PURE__ */ React__default.default.createElement(
    Ant__namespace.Tour,
    {
      ...props,
      steps: props.steps?.map(({ targetSelector, ...step }) => ({
        ...step,
        title: step.title ?? "",
        target: targetSelector && typeof document !== "undefined" ? document.querySelector(targetSelector) : null
      }))
    }
  );
}
const slot = (text) => ({ type: "slot", defaultValue: text });
const choice = (options, defaultValueHint) => ({
  type: "choice",
  options,
  defaultValueHint
});
const event = (name, type) => ({
  type: "eventHandler",
  argTypes: [{ name, type }]
});
const sizes = choice(["small", "medium", "large"], "medium");
const variant = choice(
  ["outlined", "borderless", "filled", "underlined"],
  "outlined"
);
const valueState = (variableType, valueProp = "value", onChangeProp = "onChange") => ({
  [valueProp]: {
    type: "writable",
    variableType,
    valueProp,
    onChangeProp
  }
});
function register(loader, component, suffix, importName, props, extra = {}) {
  utils.registerComponentHelper(loader, component, {
    name: `plasmic-antd6-${suffix}`,
    displayName: suffix.split("-").map((s) => s[0].toUpperCase() + s.slice(1)).join(" "),
    props,
    importName,
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerAdditional",
    ...extra
  });
}
function registerAdditional(loader) {
  register(loader, AntdAffix, "affix", "AntdAffix", {
    children: slot("Affixed content"),
    offsetTop: "number",
    offsetBottom: "number",
    onChange: event("affixed", "boolean")
  });
  register(loader, AntdAlert, "alert", "AntdAlert", {
    icon: { type: "slot", hidePlaceholder: true },
    title: { ...slot("Alert title"), hidePlaceholder: true },
    description: { ...slot("Alert description"), hidePlaceholder: true },
    type: choice(["success", "info", "warning", "error"], "info"),
    showIcon: "boolean",
    banner: "boolean",
    closable: "object",
    action: { type: "slot", hidePlaceholder: true }
  });
  register(loader, AntdAnchor, "anchor", "AntdAnchor", {
    items: {
      type: "array",
      defaultValue: [{ key: "section", href: "#section", title: "Section" }]
    },
    affix: "boolean",
    offsetTop: "number",
    direction: choice(["vertical", "horizontal"]),
    onChange: event("href", "string")
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
        defaultValue: [{ value: "Option 1" }, { value: "Option 2" }]
      },
      placeholder: "string",
      disabled: "boolean",
      allowClear: "boolean",
      variant,
      onChange: event("value", "string"),
      onSearch: event("value", "string")
    },
    { states: valueState("text") }
  );
  register(loader, AntdBadge, "badge", "AntdBadge", {
    children: { type: "slot", hidePlaceholder: true },
    count: { type: "number" },
    dot: "boolean",
    showZero: "boolean",
    overflowCount: "number",
    color: { type: "color" },
    size: choice(["small", "medium"]),
    status: choice(["success", "processing", "default", "error", "warning"]),
    text: "string"
  });
  register(loader, AntdBadgeRibbon, "badge-ribbon", "AntdBadgeRibbon", {
    children: slot("Ribbon content"),
    text: { ...slot("Ribbon"), hidePlaceholder: true },
    color: { type: "color" },
    placement: choice(["start", "end"])
  });
  register(loader, AntdBorderBeam, "border-beam", "AntdBorderBeam", {
    children: slot("Border beam"),
    color: { type: "color" }
  });
  register(loader, AntdCard, "card", "AntdCard", {
    children: slot("Card content"),
    title: { ...slot("Card title"), hidePlaceholder: true },
    extra: { type: "slot", hidePlaceholder: true },
    cover: { type: "slot", hidePlaceholder: true },
    actions: { type: "slot", hidePlaceholder: true },
    size: choice(["small", "medium"], "medium"),
    variant: choice(["outlined", "borderless"]),
    hoverable: "boolean",
    loading: "boolean",
    styles: "object",
    classNames: "object"
  });
  register(loader, AntdCardMeta, "card-meta", "AntdCardMeta", {
    title: { ...slot("Title"), hidePlaceholder: true },
    description: { ...slot("Description"), hidePlaceholder: true },
    avatar: { type: "slot", hidePlaceholder: true }
  });
  register(loader, AntdCardGrid, "card-grid", "AntdCardGrid", {
    children: slot("Grid cell"),
    hoverable: "boolean"
  });
  register(loader, AntdCarousel, "carousel", "AntdCarousel", {
    children: {
      type: "slot",
      defaultValue: [
        { type: "vbox", children: ["Slide 1"] },
        { type: "vbox", children: ["Slide 2"] }
      ]
    },
    autoplay: "boolean",
    arrows: "boolean",
    dots: "boolean",
    infinite: "boolean",
    effect: choice(["scrollx", "fade"]),
    dotPlacement: choice(["top", "bottom", "start", "end"]),
    afterChange: event("slide", "number")
  });
  const cascaderProps = {
    options: {
      type: "array",
      defaultValue: [
        {
          label: "Parent",
          value: "parent",
          children: [{ label: "Child", value: "child" }]
        }
      ]
    },
    value: { type: "array" },
    multiple: "boolean",
    disabled: "boolean",
    onChange: event("value", "object")
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
      variant
    },
    { states: valueState("array") }
  );
  register(
    loader,
    AntdCascaderPanel,
    "cascader-panel",
    "AntdCascaderPanel",
    cascaderProps,
    { states: valueState("array") }
  );
  register(loader, AntdRow, "row", "AntdRow", {
    children: {
      type: "slot",
      defaultValue: [
        {
          type: "component",
          name: "plasmic-antd6-col",
          props: { span: 12, children: "Column 1" }
        },
        {
          type: "component",
          name: "plasmic-antd6-col",
          props: { span: 12, children: "Column 2" }
        }
      ]
    },
    gutter: { type: "number", defaultValue: 16 },
    align: choice(["top", "middle", "bottom", "stretch"]),
    justify: choice([
      "start",
      "end",
      "center",
      "space-around",
      "space-between",
      "space-evenly"
    ]),
    wrap: "boolean"
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
    xxl: "object"
  });
  register(loader, AntdDescriptions, "descriptions", "AntdDescriptions", {
    title: { ...slot("Details"), hidePlaceholder: true },
    items: {
      type: "array",
      defaultValue: [{ key: "name", label: "Name", children: "Example" }]
    },
    column: "number",
    layout: choice(["horizontal", "vertical"]),
    bordered: "boolean",
    size: sizes,
    styles: "object",
    classNames: "object"
  });
  register(loader, AntdDivider, "divider", "AntdDivider", {
    children: slot("Divider"),
    orientation: choice(["horizontal", "vertical"]),
    titlePlacement: choice(["start", "center", "end"]),
    dashed: "boolean",
    plain: "boolean",
    size: sizes
  });
  register(loader, AntdEmpty, "empty", "AntdEmpty", {
    description: { ...slot("No data"), hidePlaceholder: true },
    children: { type: "slot", hidePlaceholder: true },
    image: "imageUrl"
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
      "space-evenly"
    ])
  });
  register(loader, AntdFloatButton, "float-button", "AntdFloatButton", {
    icon: { type: "slot", hidePlaceholder: true },
    content: { ...slot("Help"), hidePlaceholder: true },
    tooltip: "string",
    type: choice(["default", "primary"]),
    shape: choice(["circle", "square"]),
    onClick: event("event", "object")
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
          "plasmic-antd6-back-top"
        ],
        defaultValue: [
          { type: "component", name: "plasmic-antd6-float-button" }
        ]
      },
      trigger: choice(["click", "hover"]),
      shape: choice(["circle", "square"]),
      open: "boolean",
      onOpenChange: event("open", "boolean")
    }
  );
  register(loader, AntdBackTop, "back-top", "AntdBackTop", {
    visibilityHeight: "number",
    duration: "number",
    icon: { type: "slot", hidePlaceholder: true }
  });
  register(loader, AntdImage, "image", "AntdImage", {
    src: { type: "imageUrl", defaultValue: "https://placehold.co/320x200" },
    alt: "string",
    width: "number",
    height: "number",
    preview: "boolean",
    fallback: "imageUrl",
    objectFit: choice(["fill", "contain", "cover", "none", "scale-down"])
  });
  register(
    loader,
    AntdImagePreviewGroup,
    "image-preview-group",
    "AntdImagePreviewGroup",
    {
      children: { type: "slot", allowedComponents: ["plasmic-antd6-image"] },
      items: { type: "array" }
    }
  );
  register(loader, AntdLayout, "layout", "AntdLayout", {
    children: {
      type: "slot",
      defaultValue: [
        { type: "component", name: "plasmic-antd6-layout-header" },
        { type: "component", name: "plasmic-antd6-layout-content" },
        { type: "component", name: "plasmic-antd6-layout-footer" }
      ]
    },
    hasSider: "boolean"
  });
  for (const [suffix, component, importName] of [
    ["header", AntdLayoutHeader, "AntdLayoutHeader"],
    ["footer", AntdLayoutFooter, "AntdLayoutFooter"],
    ["content", AntdLayoutContent, "AntdLayoutContent"]
  ]) {
    register(loader, component, `layout-${suffix}`, importName, {
      children: slot(suffix)
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
      onCollapse: event("collapsed", "boolean")
    },
    { states: valueState("boolean", "collapsed", "onCollapse") }
  );
  register(loader, AntdList, "list", "AntdList", {
    children: { type: "slot", displayName: "Static content", hidePlaceholder: true },
    dataSource: { type: "array", displayName: "Data source" },
    renderItem: {
      type: "slot",
      displayName: "Render item",
      renderPropParams: ["item", "index"],
      hidePlaceholder: true,
      description: "Render each dataSource item using item and index bindings. Supports List.Item, tags, buttons, and layouts."
    },
    header: { type: "slot", hidePlaceholder: true },
    footer: { type: "slot", hidePlaceholder: true },
    size: choice(["small", "default", "large"], "default"),
    split: "boolean",
    bordered: "boolean",
    loading: "boolean"
  });
  register(loader, AntdListItem, "list-item", "AntdListItem", {
    children: slot("Item"),
    extra: { type: "slot", hidePlaceholder: true },
    actions: { type: "slot", hidePlaceholder: true }
  });
  register(loader, AntdListItemMeta, "list-item-meta", "AntdListItemMeta", {
    title: { ...slot("Item title"), hidePlaceholder: true },
    description: { ...slot("Item description"), hidePlaceholder: true },
    avatar: { type: "slot", hidePlaceholder: true }
  });
  register(loader, AntdListy, "listy", "AntdListy", {
    items: {
      type: "array",
      defaultValue: [
        { key: "1", content: "First item" },
        { key: "2", content: "Second item" }
      ]
    },
    height: { type: "number", defaultValue: 240 },
    virtual: "boolean",
    sticky: "boolean"
  });
  register(loader, AntdMasonry, "masonry", "AntdMasonry", {
    items: {
      type: "array",
      defaultValue: [
        { key: "1", data: { content: "First tile" } },
        { key: "2", data: { content: "Second tile" } }
      ]
    },
    columns: { type: "number", defaultValue: 2 },
    gutter: { type: "number", defaultValue: 16 }
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
        defaultValue: [{ value: "alice", label: "Alice" }]
      },
      prefix: "string",
      placeholder: "string",
      disabled: "boolean",
      onChange: event("value", "string")
    },
    { states: valueState("text") }
  );
  register(
    loader,
    AntdPopconfirm,
    "popconfirm",
    "AntdPopconfirm",
    {
      previewOpen: canvasOverlay$1.previewOpenProp,
      icon: { type: "slot", hidePlaceholder: true },
      children: slot("Delete"),
      title: { ...slot("Delete this item?"), hidePlaceholder: true },
      description: { type: "slot", hidePlaceholder: true },
      okText: "string",
      cancelText: "string",
      disabled: "boolean",
      onConfirm: event("event", "object"),
      onCancel: event("event", "object")
    },
    { canvasOverlay }
  );
  register(loader, AntdQRCode, "qr-code", "AntdQRCode", {
    value: { type: "string", defaultValue: "https://publib.cn" },
    size: "number",
    color: { type: "color" },
    bgColor: { type: "color" },
    icon: "imageUrl",
    type: choice(["canvas", "svg"]),
    status: choice(["active", "expired", "loading", "scanned"])
  });
  register(loader, AntdResult, "result", "AntdResult", {
    title: { ...slot("Success"), hidePlaceholder: true },
    subTitle: { ...slot("The operation completed"), hidePlaceholder: true },
    extra: { type: "slot", hidePlaceholder: true },
    icon: { type: "slot", hidePlaceholder: true },
    status: choice([
      "success",
      "error",
      "info",
      "warning",
      "404",
      "403",
      "500"
    ])
  });
  register(loader, AntdSkeleton, "skeleton", "AntdSkeleton", {
    children: { type: "slot", hidePlaceholder: true },
    active: "boolean",
    loading: { type: "boolean", defaultValue: true },
    avatar: "boolean",
    title: "boolean",
    paragraph: "object",
    round: "boolean"
  });
  for (const [suffix, component, importName] of [
    ["button", AntdSkeletonButton, "AntdSkeletonButton"],
    ["input", AntdSkeletonInput, "AntdSkeletonInput"],
    ["avatar", AntdSkeletonAvatar, "AntdSkeletonAvatar"],
    ["image", AntdSkeletonImage, "AntdSkeletonImage"],
    ["node", AntdSkeletonNode, "AntdSkeletonNode"]
  ]) {
    register(loader, component, `skeleton-${suffix}`, importName, {
      active: "boolean"
    });
  }
  const spaceProps = {
    children: slot("Spaced content"),
    orientation: choice(["horizontal", "vertical"]),
    size: { type: "number", defaultValue: 16 }
  };
  register(loader, AntdSpace, "space", "AntdSpace", {
    ...spaceProps,
    wrap: "boolean",
    separator: { type: "slot", hidePlaceholder: true },
    align: choice(["start", "end", "center", "baseline"])
  });
  register(loader, AntdSpaceCompact, "space-compact", "AntdSpaceCompact", {
    children: slot("Compact content"),
    orientation: choice(["horizontal", "vertical"]),
    size: sizes,
    block: "boolean"
  });
  register(loader, AntdSpin, "spin", "AntdSpin", {
    indicator: { type: "slot", hidePlaceholder: true },
    children: slot("Loading content"),
    spinning: { type: "boolean", defaultValue: true },
    description: "string",
    size: sizes,
    delay: "number",
    fullscreen: "boolean"
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
            props: { children: "Left panel" }
          },
          {
            type: "component",
            name: "plasmic-antd6-splitter-panel",
            props: { children: "Right panel" }
          }
        ]
      },
      onResize: event("sizes", "object")
    },
    { defaultStyles: { height: "240px", width: "100%" } }
  );
  register(loader, AntdSplitterPanel, "splitter-panel", "AntdSplitterPanel", {
    children: slot("Panel"),
    defaultSize: "string",
    min: "string",
    max: "string",
    resizable: "boolean",
    collapsible: "object"
  });
  register(loader, AntdStatistic, "statistic", "AntdStatistic", {
    title: { ...slot("Total"), hidePlaceholder: true },
    value: { type: "number", defaultValue: 128 },
    precision: "number",
    prefix: { type: "slot", hidePlaceholder: true },
    suffix: { type: "slot", hidePlaceholder: true },
    loading: "boolean",
    styles: "object"
  });
  register(
    loader,
    AntdStatisticTimer,
    "statistic-timer",
    "AntdStatisticTimer",
    {
      title: { ...slot("Timer"), hidePlaceholder: true },
      type: choice(["countdown", "countup"]),
      value: { type: "number", description: "Unix timestamp in milliseconds" },
      format: "string",
      onFinish: { type: "eventHandler", argTypes: [] }
    }
  );
  register(loader, AntdTag, "tag", "AntdTag", {
    value: {
      type: "string",
      displayName: "Value",
      description: "Read the bound value. Configure its label and color below."
    },
    options: {
      type: "array",
      displayName: "Tag labels and colors",
      itemType: {
        type: "object",
        nameFunc: (item) => item.label || item.value,
        fields: {
          value: { type: "string", displayName: "Value" },
          label: { type: "string", displayName: "Label" },
          color: { type: "color", displayName: "Color" }
        }
      }
    },
    defaultColor: { type: "color", displayName: "Default color" },
    automaticColor: { type: "boolean", displayName: "Assign colors automatically" },
    closeIcon: { type: "slot", hidePlaceholder: true },
    children: { ...slot("Tag"), hidePlaceholder: true },
    color: { type: "color" },
    variant: choice(["outlined", "filled", "solid"]),
    closable: "boolean",
    icon: { type: "slot", hidePlaceholder: true },
    onClose: event("event", "object")
  });
  register(
    loader,
    AntdTagCheckable,
    "tag-checkable",
    "AntdTagCheckable",
    {
      children: slot("Choice"),
      checked: "boolean",
      onChange: event("checked", "boolean")
    },
    { states: valueState("boolean", "checked") }
  );
  register(loader, AntdTimeline, "timeline", "AntdTimeline", {
    items: {
      type: "array",
      defaultValue: [
        { title: "First", content: "First event" },
        { title: "Second", content: "Second event" }
      ]
    },
    mode: choice(["start", "end", "alternate"]),
    reverse: "boolean"
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
          { key: "2", title: "Two" }
        ]
      },
      targetKeys: { type: "array" },
      showSearch: "boolean",
      disabled: "boolean",
      oneWay: "boolean",
      onChange: event("targetKeys", "object")
    },
    { states: valueState("array", "targetKeys") }
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
            children: [{ title: "Child", value: "child" }]
          }
        ]
      },
      value: {
        type: "object",
        description: "Single value, array of values in multiple/checkable mode, or labelInValue objects."
      },
      multiple: "boolean",
      treeCheckable: "boolean",
      treeDefaultExpandAll: "boolean",
      allowClear: "boolean",
      disabled: "boolean",
      placeholder: "string",
      variant,
      onChange: event("value", "object")
    },
    { states: valueState("object") }
  );
  register(loader, AntdTypography, "typography", "AntdTypography", {
    children: slot("Typography")
  });
  const textProps = {
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
    disabled: "boolean"
  };
  register(
    loader,
    AntdTypographyText,
    "typography-text",
    "AntdTypographyText",
    textProps
  );
  register(
    loader,
    AntdTypographyTitle,
    "typography-title",
    "AntdTypographyTitle",
    {
      ...textProps,
      children: slot("Heading"),
      level: { type: "choice", options: [1, 2, 3, 4, 5], defaultValueHint: 2 }
    }
  );
  register(
    loader,
    AntdTypographyParagraph,
    "typography-paragraph",
    "AntdTypographyParagraph",
    { ...textProps, children: slot("Paragraph") }
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
      target: choice(["_self", "_blank"])
    }
  );
  register(loader, AntdWatermark, "watermark", "AntdWatermark", {
    children: slot("Watermarked content"),
    content: { type: "string", defaultValue: "Confidential" },
    image: "imageUrl",
    rotate: "number",
    font: "object",
    gap: { type: "array" }
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
      onComplete: event("value", "string")
    },
    { states: valueState("text") }
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
      onSearch: event("value", "string")
    },
    { states: valueState("text") }
  );
  register(loader, AntdUploadDragger, "upload-dragger", "AntdUploadDragger", {
    children: slot("Drop files here"),
    action: "string",
    name: "string",
    multiple: "boolean",
    accept: "string",
    disabled: "boolean",
    onChange: event("info", "object")
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
      onSelect: event("value", "string")
    },
    { states: valueState("text") }
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
      onChange: event("value", "string")
    },
    { states: valueState("text") }
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
      onChange: event("value", "object")
    },
    { states: valueState("array") }
  );
  register(loader, AntdTour, "tour", "AntdTour", {
    open: "boolean",
    current: "number",
    steps: {
      type: "array",
      defaultValue: [{ title: "Welcome", description: "Start your tour" }]
    },
    type: choice(["default", "primary"]),
    onChange: event("current", "number"),
    onClose: event("current", "number")
  });
}

exports.AntdAffix = AntdAffix;
exports.AntdAlert = AntdAlert;
exports.AntdAnchor = AntdAnchor;
exports.AntdAutoComplete = AntdAutoComplete;
exports.AntdBackTop = AntdBackTop;
exports.AntdBadge = AntdBadge;
exports.AntdBadgeRibbon = AntdBadgeRibbon;
exports.AntdBorderBeam = AntdBorderBeam;
exports.AntdCalendar = AntdCalendar;
exports.AntdCard = AntdCard;
exports.AntdCardGrid = AntdCardGrid;
exports.AntdCardMeta = AntdCardMeta;
exports.AntdCarousel = AntdCarousel;
exports.AntdCascader = AntdCascader;
exports.AntdCascaderPanel = AntdCascaderPanel;
exports.AntdCol = AntdCol;
exports.AntdDescriptions = AntdDescriptions;
exports.AntdDivider = AntdDivider;
exports.AntdEmpty = AntdEmpty;
exports.AntdFlex = AntdFlex;
exports.AntdFloatButton = AntdFloatButton;
exports.AntdFloatButtonGroup = AntdFloatButtonGroup;
exports.AntdImage = AntdImage;
exports.AntdImagePreviewGroup = AntdImagePreviewGroup;
exports.AntdInputOTP = AntdInputOTP;
exports.AntdInputSearch = AntdInputSearch;
exports.AntdLayout = AntdLayout;
exports.AntdLayoutContent = AntdLayoutContent;
exports.AntdLayoutFooter = AntdLayoutFooter;
exports.AntdLayoutHeader = AntdLayoutHeader;
exports.AntdLayoutSider = AntdLayoutSider;
exports.AntdList = AntdList;
exports.AntdListItem = AntdListItem;
exports.AntdListItemMeta = AntdListItemMeta;
exports.AntdListy = AntdListy;
exports.AntdMasonry = AntdMasonry;
exports.AntdMentions = AntdMentions;
exports.AntdPopconfirm = AntdPopconfirm;
exports.AntdQRCode = AntdQRCode;
exports.AntdResult = AntdResult;
exports.AntdRow = AntdRow;
exports.AntdSkeleton = AntdSkeleton;
exports.AntdSkeletonAvatar = AntdSkeletonAvatar;
exports.AntdSkeletonButton = AntdSkeletonButton;
exports.AntdSkeletonImage = AntdSkeletonImage;
exports.AntdSkeletonInput = AntdSkeletonInput;
exports.AntdSkeletonNode = AntdSkeletonNode;
exports.AntdSpace = AntdSpace;
exports.AntdSpaceCompact = AntdSpaceCompact;
exports.AntdSpin = AntdSpin;
exports.AntdSplitter = AntdSplitter;
exports.AntdSplitterPanel = AntdSplitterPanel;
exports.AntdStatistic = AntdStatistic;
exports.AntdStatisticTimer = AntdStatisticTimer;
exports.AntdTag = AntdTag;
exports.AntdTagCheckable = AntdTagCheckable;
exports.AntdTimePicker = AntdTimePicker;
exports.AntdTimeRangePicker = AntdTimeRangePicker;
exports.AntdTimeline = AntdTimeline;
exports.AntdTour = AntdTour;
exports.AntdTransfer = AntdTransfer;
exports.AntdTreeSelect = AntdTreeSelect;
exports.AntdTypography = AntdTypography;
exports.AntdTypographyLink = AntdTypographyLink;
exports.AntdTypographyParagraph = AntdTypographyParagraph;
exports.AntdTypographyText = AntdTypographyText;
exports.AntdTypographyTitle = AntdTypographyTitle;
exports.AntdUploadDragger = AntdUploadDragger;
exports.AntdWatermark = AntdWatermark;
exports.registerAdditional = registerAdditional;
//# sourceMappingURL=registerAdditional.cjs.js.map
