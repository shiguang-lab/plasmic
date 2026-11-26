'use strict';

var jsxRuntime = require('react/jsx-runtime');
var host = require('@plasmicapp/host');
var Ant = require('antd');
var dayjs = require('dayjs');
var React = require('react');
var canvasOverlay$1 = require('./canvas-overlay-D2jWZ-TY.cjs.js');
var semanticAppearance = require('./semantic-appearance-Ba48UgLS.cjs.js');
var utils = require('./utils-B1jTF3MA.cjs.js');
require('@plasmicapp/host/registerComponent');
require('@plasmicapp/host/registerGlobalContext');
require('@shiguang-lab/plasmic-antd6/thumbnails');

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
const badgeStatuses = [
  "success",
  "processing",
  "default",
  "error",
  "warning"
];
const AntdBadge = Ant__namespace.Badge;
const AntdBadgeRibbon = Ant__namespace.Badge.Ribbon;
const AntdBorderBeam = Ant__namespace.BorderBeam;
function AntdCard({
  actions,
  ...rest
}) {
  return /* @__PURE__ */ jsxRuntime.jsx(
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
const AntdDescriptionsItem = Ant__namespace.Descriptions.Item;
const AntdDescriptions = React__default.default.forwardRef((props, ref) => {
  if (props.items != null) {
    return /* @__PURE__ */ jsxRuntime.jsx(Ant__namespace.Descriptions, { ...props, ref });
  }
  return canvasOverlay$1.renderCanvasSlot(props.children, (children) => /* @__PURE__ */ jsxRuntime.jsx(
    Ant__namespace.Descriptions,
    {
      ...props,
      ref,
      children: void 0,
      items: canvasOverlay$1.getCanvasItems(children, (item) => item.type === AntdDescriptionsItem).filter(React__default.default.isValidElement).map(
        (item, index) => {
          const { __canvas: _selection, ...itemProps } = item.props;
          return { ...itemProps, key: item.key ?? String(index) };
        }
      )
    }
  ));
});
const AntdDivider = Ant__namespace.Divider;
const AntdEmpty = Ant__namespace.Empty;
const AntdFlex = Ant__namespace.Flex;
const AntdFloatButton = Ant__namespace.FloatButton;
const AntdFloatButtonGroup = Ant__namespace.FloatButton.Group;
const AntdBackTop = Ant__namespace.FloatButton.BackTop;
function AntdImage(props) {
  const canvas = host.usePlasmicCanvasContext();
  return /* @__PURE__ */ jsxRuntime.jsx(
    Ant__namespace.Image,
    {
      ...props,
      preview: canvas && !canvas.interactive ? false : props.preview
    }
  );
}
function AntdImagePreviewGroup(props) {
  const canvas = host.usePlasmicCanvasContext();
  return /* @__PURE__ */ jsxRuntime.jsx(
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
    isEditing,
    destroyOnHidden
  } = canvasOverlay$1.useCanvasOverlay(props, canvasOverlay.triggerSlot);
  return /* @__PURE__ */ jsxRuntime.jsx(
    Ant__namespace.Popconfirm,
    {
      ...rest,
      open,
      destroyOnHidden,
      onOpenChange: rest.onOpenChange,
      afterOpenChange: isEditing ? void 0 : rest.afterOpenChange,
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
const AntdTag = Ant__namespace.Tag;
const AntdTagCheckable = Ant__namespace.Tag.CheckableTag;
const AntdTimeline = Ant__namespace.Timeline;
const AntdTreeSelect = Ant__namespace.TreeSelect;
const AntdTypography = Ant__namespace.Typography;
const AntdTypographyTitle = Ant__namespace.Typography.Title;
const AntdTypographyText = Ant__namespace.Typography.Text;
const AntdTypographyParagraph = Ant__namespace.Typography.Paragraph;
const AntdTypographyLink = Ant__namespace.Typography.Link;
const AntdWatermark = Ant__namespace.Watermark;
const AntdInputOTP = Ant__namespace.Input.OTP;
function AntdInputSearch({
  onChange,
  ...rest
}) {
  return /* @__PURE__ */ jsxRuntime.jsx(
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
  return /* @__PURE__ */ jsxRuntime.jsx(
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
  return /* @__PURE__ */ jsxRuntime.jsx(
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
  return /* @__PURE__ */ jsxRuntime.jsx(
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
  return /* @__PURE__ */ jsxRuntime.jsx(
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
  return /* @__PURE__ */ jsxRuntime.jsx(
    Ant__namespace.List.Item,
    {
      ...rest,
      actions: actions ? React__default.default.Children.toArray(actions) : void 0
    }
  );
}
const AntdListItemMeta = Ant__namespace.List.Item.Meta;
function AntdListy(props) {
  const canvas = host.usePlasmicCanvasContext();
  const info = host.usePlasmicCanvasComponentInfo(props);
  const { __canvas: _canvas, ...rest } = props;
  const fullContentView = !!canvas && !canvas.interactive && info?.fullContent === true;
  return /* @__PURE__ */ jsxRuntime.jsx(
    Ant__namespace.Listy,
    {
      ...rest,
      ...fullContentView ? { height: void 0, virtual: false, sticky: false } : {},
      rowKey: "key",
      itemRender: (item) => /* @__PURE__ */ jsxRuntime.jsx("div", { children: item.content })
    }
  );
}
function AntdMasonry(props) {
  return /* @__PURE__ */ jsxRuntime.jsx(
    Ant__namespace.Masonry,
    {
      ...props,
      itemRender: (item) => /* @__PURE__ */ jsxRuntime.jsx("div", { children: item.data?.content })
    }
  );
}
function AntdTransfer(props) {
  return /* @__PURE__ */ jsxRuntime.jsx(
    Ant__namespace.Transfer,
    {
      ...props,
      render: (item) => String(item.title ?? item.key ?? "")
    }
  );
}
function AntdTour(props) {
  return /* @__PURE__ */ jsxRuntime.jsx(
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
const descriptionsItemAppearance = {
  style: {
    type: "object",
    description: 'Native React.CSSProperties applied to the Item table cell, including width as a CSS string ("25%", "160px") or a number in pixels. For four equal columns in an unbordered horizontal Descriptions, set { width: "25%" } on each of the four first-row Items with span=1. With borders, label and content are separate cells; this is not a field-group width control.'
  },
  className: {
    type: "string",
    description: "CSS class applied to the Item table cell(s)."
  },
  ...semanticAppearance.semanticAppearance(
    {
      label: "Label",
      content: "Content"
    },
    {
      stylesDescription: "Native per-Item semantic styles. These override the parent Descriptions label/content styles; they do not set the whole field group's width.",
      classNamesDescription: "Native per-Item semantic CSS classes."
    }
  )
};
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
    description: { type: "slot", hidePlaceholder: true },
    type: choice(["success", "info", "warning", "error"], "info"),
    showIcon: "boolean",
    banner: "boolean",
    closable: "object",
    action: { type: "slot", hidePlaceholder: true },
    ...semanticAppearance.semanticAppearance(
      {
        root: "Alert container",
        icon: "Icon",
        section: "Content section",
        title: "Title",
        description: "Description",
        actions: "Actions",
        close: "Close button"
      },
      { advanced: true }
    )
  });
  register(loader, AntdAnchor, "anchor", "AntdAnchor", {
    ...semanticAppearance.semanticAppearance({
      root: "Root",
      item: "Item",
      itemTitle: "Item Title",
      indicator: "Indicator"
    }),
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
      ...semanticAppearance.semanticAppearance({
        root: "Root",
        prefix: "Prefix",
        input: "Input",
        placeholder: "Placeholder",
        content: "Content",
        clear: "Clear",
        popup: {
          root: "Root",
          listItem: "List Item",
          list: "List"
        }
      }),
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
    ...semanticAppearance.semanticAppearance(
      {
        root: "Badge container",
        indicator: "Indicator"
      },
      { advanced: true }
    )
  });
  register(loader, AntdBadgeRibbon, "badge-ribbon", "AntdBadgeRibbon", {
    ...semanticAppearance.semanticAppearance({
      root: "Root",
      content: "Content",
      indicator: "Indicator"
    }),
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
    title: { type: "slot", hidePlaceholder: true },
    extra: { type: "slot", hidePlaceholder: true },
    cover: { type: "slot", hidePlaceholder: true },
    actions: { type: "slot", hidePlaceholder: true },
    size: choice(["small", "medium"], "medium"),
    variant: choice(["outlined", "borderless"]),
    hoverable: "boolean",
    loading: "boolean",
    ...semanticAppearance.semanticAppearance({
      root: "Card container",
      header: "Header",
      title: "Title",
      extra: "Extra content",
      body: "Body",
      actions: "Actions",
      cover: "Cover"
    })
  });
  register(loader, AntdCardMeta, "card-meta", "AntdCardMeta", {
    ...semanticAppearance.semanticAppearance({
      root: "Root",
      section: "Section",
      avatar: "Avatar",
      title: "Title",
      description: "Description"
    }),
    title: { ...slot("Title"), hidePlaceholder: true },
    description: { type: "slot", hidePlaceholder: true },
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
      ...semanticAppearance.semanticAppearance({
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
          list: "List"
        }
      }),
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
    gutter: { type: "number", defaultValueHint: 0 },
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
    span: "number",
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
          ...descriptionsItemAppearance
        },
        nameFunc: (item) => item.label ?? item.key
      }
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
          children: "Example"
        }
      }]
    },
    column: { type: "number", description: 'Number of fields per row, not an equal-width switch. In unbordered horizontal layout, four first-row Items with span=1 and style: { width: "25%" } establish four equal columns. Use span for long values and verify rendered widths.' },
    layout: choice(["horizontal", "vertical"]),
    bordered: "boolean",
    size: sizes,
    ...semanticAppearance.semanticAppearance({
      root: "Descriptions container",
      header: "Header",
      title: "Title",
      extra: "Extra content",
      label: "Label",
      content: "Content"
    })
  }, { description: "Display grouped read-only label/value fields in details, drawers, confirmations or create/edit summaries. Use alongside Form for mixed read-only and editable content; use Statistic for emphasized metrics." });
  register(loader, AntdDescriptionsItem, "descriptions-item", "AntdDescriptionsItem", {
    key: { type: "string", description: "A stable field key within this Descriptions." },
    label: { ...slot("Label"), hidePlaceholder: true, mergeWithParent: true },
    children: { ...slot("Value"), displayName: "Content", hidePlaceholder: true, mergeWithParent: true },
    span: { type: "number", min: 1, defaultValueHint: 1, description: "Columns occupied by this field." },
    ...descriptionsItemAppearance
  }, { description: "Editable label and content for a read-only field. Converted to a native Descriptions items entry at runtime." });
  register(loader, AntdDivider, "divider", "AntdDivider", {
    ...semanticAppearance.semanticAppearance({
      root: "Root",
      rail: "Rail",
      content: "Content"
    }),
    children: { type: "slot", hidePlaceholder: true },
    orientation: choice(["horizontal", "vertical"]),
    titlePlacement: choice(["start", "center", "end"]),
    dashed: "boolean",
    plain: "boolean",
    size: sizes
  });
  register(loader, AntdEmpty, "empty", "AntdEmpty", {
    ...semanticAppearance.semanticAppearance({
      root: "Root",
      image: "Image",
      description: "Description",
      footer: "Footer"
    }),
    description: { type: "slot", hidePlaceholder: true },
    children: { type: "slot", hidePlaceholder: true },
    image: "imageUrl"
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
      "space-evenly"
    ])
  });
  register(loader, AntdFloatButton, "float-button", "AntdFloatButton", {
    ...semanticAppearance.semanticAppearance({
      root: "Root",
      icon: "Icon",
      content: "Content"
    }),
    icon: { type: "slot", hidePlaceholder: true },
    content: { type: "slot", hidePlaceholder: true },
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
      ...semanticAppearance.semanticAppearance({
        root: "Root",
        list: "List",
        item: "Item",
        itemIcon: "Item Icon",
        itemContent: "Item Content",
        trigger: "Trigger",
        triggerIcon: "Trigger Icon",
        triggerContent: "Trigger Content"
      }),
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
    ...semanticAppearance.semanticAppearance({
      root: "Root",
      icon: "Icon",
      content: "Content"
    }),
    visibilityHeight: "number",
    duration: "number",
    icon: { type: "slot", hidePlaceholder: true }
  });
  register(loader, AntdImage, "image", "AntdImage", {
    ...semanticAppearance.semanticAppearance({
      root: "Root",
      image: "Image",
      cover: "Cover",
      placeholder: {
        progress: {
          root: "Root",
          content: "Content",
          rail: "Rail",
          indicator: "Indicator"
        }
      },
      popup: {
        root: "Root",
        mask: "Mask",
        body: "Body",
        footer: "Footer",
        actions: "Actions",
        close: "Close"
      }
    }),
    src: { type: "imageUrl", defaultValue: "https://placehold.co/320x200" },
    alt: "string",
    width: "number",
    height: "number",
    preview: "boolean",
    fallback: "imageUrl"
  });
  register(
    loader,
    AntdImagePreviewGroup,
    "image-preview-group",
    "AntdImagePreviewGroup",
    {
      ...semanticAppearance.semanticAppearance({
        root: "Root",
        image: "Image",
        cover: "Cover",
        placeholder: {
          progress: {
            root: "Root",
            content: "Content",
            rail: "Rail",
            indicator: "Indicator"
          }
        },
        popup: {
          root: "Root",
          mask: "Mask",
          body: "Body",
          footer: "Footer",
          actions: "Actions",
          close: "Close"
        }
      }),
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
      ...semanticAppearance.semanticAppearance({
        root: "Root",
        body: "Body"
      }),
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
    ...semanticAppearance.semanticAppearance({
      actions: "Actions",
      extra: "Extra"
    }),
    children: slot("Item"),
    extra: { type: "slot", hidePlaceholder: true },
    actions: { type: "slot", hidePlaceholder: true }
  });
  register(loader, AntdListItemMeta, "list-item-meta", "AntdListItemMeta", {
    title: { ...slot("Item title"), hidePlaceholder: true },
    description: { type: "slot", hidePlaceholder: true },
    avatar: { type: "slot", hidePlaceholder: true }
  });
  register(loader, AntdListy, "listy", "AntdListy", {
    ...semanticAppearance.semanticAppearance({
      root: "Root",
      item: "Item",
      groupHeader: "Group Header"
    }),
    items: {
      type: "array",
      defaultValue: [
        { key: "1", content: "First item" },
        { key: "2", content: "Second item" }
      ]
    },
    height: "number",
    virtual: "boolean",
    sticky: "boolean"
  });
  register(loader, AntdMasonry, "masonry", "AntdMasonry", {
    ...semanticAppearance.semanticAppearance({
      root: "Root",
      item: "Item"
    }),
    items: {
      type: "array",
      defaultValue: [
        { key: "1", data: { content: "First tile" } },
        { key: "2", data: { content: "Second tile" } }
      ]
    },
    columns: { type: "number", defaultValueHint: 3 },
    gutter: { type: "number", defaultValueHint: 0 }
  });
  register(
    loader,
    AntdMentions,
    "mentions",
    "AntdMentions",
    {
      ...semanticAppearance.semanticAppearance({
        root: "Root",
        textarea: "Textarea",
        popup: "Popup",
        suffix: "Suffix"
      }),
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
      ...semanticAppearance.semanticAppearance({
        title: "Title",
        content: "Content",
        root: "Root",
        container: "Container",
        arrow: "Arrow",
        icon: "Icon"
      }),
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
        description: "Native controlled open state. Leave unset for the native click trigger; bind it when another action, such as an ActionGroup item, requests confirmation."
      },
      onOpenChange: event("open", "boolean"),
      onConfirm: event("event", "object"),
      onCancel: event("event", "object")
    },
    { canvasOverlay }
  );
  register(loader, AntdQRCode, "qr-code", "AntdQRCode", {
    ...semanticAppearance.semanticAppearance({
      root: "Root",
      cover: "Cover"
    }),
    value: { type: "string", defaultValue: "https://publib.cn" },
    size: "number",
    color: { type: "color" },
    bgColor: { type: "color" },
    icon: "imageUrl",
    type: choice(["canvas", "svg"]),
    status: choice(["active", "expired", "loading", "scanned"])
  });
  register(loader, AntdResult, "result", "AntdResult", {
    ...semanticAppearance.semanticAppearance({
      root: "Root",
      title: "Title",
      subTitle: "Sub Title",
      body: "Body",
      extra: "Extra",
      icon: "Icon"
    }),
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
      "500"
    ])
  });
  register(loader, AntdSkeleton, "skeleton", "AntdSkeleton", {
    ...semanticAppearance.semanticAppearance({
      root: "Root",
      header: "Header",
      section: "Section",
      avatar: "Avatar",
      title: "Title",
      paragraph: "Paragraph"
    }),
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
      ...semanticAppearance.semanticAppearance({
        root: "Root",
        content: "Content"
      }),
      active: "boolean"
    });
  }
  const spaceProps = {
    children: slot("Spaced content"),
    orientation: choice(["horizontal", "vertical"]),
    size: { type: "number", defaultValueHint: 8, description: "Gap in pixels. Unset uses the native small size." }
  };
  register(loader, AntdSpace, "space", "AntdSpace", {
    ...semanticAppearance.semanticAppearance({
      root: "Root",
      item: "Item",
      separator: "Separator"
    }),
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
    ...semanticAppearance.semanticAppearance({
      root: "Root",
      section: "Section",
      indicator: "Indicator",
      description: "Description",
      container: "Container",
      tip: "Tip",
      mask: "Mask"
    }),
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
      ...semanticAppearance.semanticAppearance({
        root: "Root",
        panel: "Panel",
        dragger: {
          default: "Default",
          active: "Active"
        }
      }),
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
    }
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
    title: { type: "slot", hidePlaceholder: true },
    value: { type: "number", defaultValue: 128 },
    precision: "number",
    prefix: { type: "slot", hidePlaceholder: true },
    suffix: { type: "slot", hidePlaceholder: true },
    loading: "boolean",
    ...semanticAppearance.semanticAppearance({
      root: "Statistic container",
      header: "Header",
      title: "Title",
      content: "Content",
      value: "Value",
      prefix: "Prefix",
      suffix: "Suffix"
    })
  });
  register(
    loader,
    AntdStatisticTimer,
    "statistic-timer",
    "AntdStatisticTimer",
    {
      ...semanticAppearance.semanticAppearance({
        root: "Root",
        content: "Content",
        value: "Value",
        title: "Title",
        header: "Header",
        prefix: "Prefix",
        suffix: "Suffix"
      }),
      title: { type: "slot", hidePlaceholder: true },
      type: choice(["countdown", "countup"]),
      value: { type: "number", description: "Unix timestamp in milliseconds" },
      format: "string",
      onFinish: { type: "eventHandler", argTypes: [] }
    }
  );
  register(loader, AntdTag, "tag", "AntdTag", {
    closeIcon: { type: "slot", hidePlaceholder: true },
    children: { ...slot("Tag"), hidePlaceholder: true },
    color: { type: "color" },
    variant: choice(["outlined", "filled", "solid"]),
    closable: "boolean",
    icon: { type: "slot", hidePlaceholder: true },
    onClose: event("event", "object"),
    ...semanticAppearance.semanticAppearance(
      {
        root: "Tag container",
        icon: "Icon",
        content: "Content",
        close: "Close button"
      },
      { advanced: true }
    )
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
    // Timeline renders the Steps semantic regions except itemSubtitle.
    ...semanticAppearance.semanticAppearance({
      root: "Root",
      item: "Item",
      itemWrapper: "Item Wrapper",
      itemIcon: "Item Icon",
      itemSection: "Item Section",
      itemHeader: "Item Header",
      itemTitle: "Item Title",
      itemContent: "Item Content",
      itemRail: "Item Rail"
    }),
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
      ...semanticAppearance.semanticAppearance({
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
          footer: "Footer"
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
          footer: "Footer"
        }
      }),
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
      ...semanticAppearance.semanticAppearance({
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
          itemSwitcher: "Item Switcher"
        }
      }),
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
    ...semanticAppearance.semanticAppearance({
      root: "Root",
      actions: "Actions",
      action: "Action",
      textarea: "Textarea"
    }),
    children: slot("Typography")
  });
  const textProps = {
    ...semanticAppearance.semanticAppearance({
      root: "Root",
      actions: "Actions",
      action: "Action",
      textarea: "Textarea"
    }),
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
      // Typography.Title has no native strong prop.
      ...Object.fromEntries(
        Object.entries(textProps).filter(([name]) => name !== "strong")
      ),
      children: slot("Heading"),
      level: { type: "choice", options: [1, 2, 3, 4, 5], defaultValueHint: 1 }
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
      ...semanticAppearance.semanticAppearance({
        root: "Root",
        input: "Input",
        separator: "Separator"
      }),
      value: "string",
      length: { type: "number", defaultValueHint: 6 },
      disabled: "boolean",
      mask: "boolean",
      size: sizes,
      variant,
      onChange: {
        ...event("value", "string"),
        description: "Native onChange: fires with the complete code once every cell is filled."
      },
      onInput: {
        ...event("values", "object"),
        description: "Native onInput: fires on each cell edit with the array of cell values."
      }
    },
    { states: valueState("text") }
  );
  register(
    loader,
    AntdInputSearch,
    "input-search",
    "AntdInputSearch",
    {
      ...semanticAppearance.semanticAppearance({
        root: "Root",
        input: "Input",
        prefix: "Prefix",
        suffix: "Suffix",
        clear: "Clear",
        count: "Count",
        button: {
          root: "Root",
          icon: "Icon",
          content: "Content"
        }
      }),
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
    ...semanticAppearance.semanticAppearance({
      root: "Root",
      list: "List",
      item: "Item",
      trigger: "Trigger"
    }),
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
      ...semanticAppearance.semanticAppearance({
        root: "Root",
        header: "Header",
        body: "Body",
        content: "Content",
        item: "Item",
        itemContent: "Item Content"
      }),
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
      ...semanticAppearance.semanticAppearance({
        root: "Root",
        prefix: "Prefix",
        input: "Input",
        suffix: "Suffix",
        popup: {
          root: "Root",
          content: "Content",
          item: "Item",
          footer: "Footer",
          container: "Container"
        }
      }),
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
      ...semanticAppearance.semanticAppearance({
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
          container: "Container"
        }
      }),
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
    ...semanticAppearance.semanticAppearance({
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
      description: "Description"
    }),
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
exports.AntdDescriptionsItem = AntdDescriptionsItem;
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
