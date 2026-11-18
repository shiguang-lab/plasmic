import type { ButtonProps } from "@mui/material/Button";
import type { GridProps } from "@mui/material/Grid";
import type { PropType } from "@plasmicapp/host";
import type { CodeComponentMeta } from "@plasmicapp/host/registerComponent";
import api from "./api.json";
import * as components from "./components";

export const componentName = (name: string) =>
  `plasmic-material-ui-${name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()}`;
const importPath = "@shiguang-lab/plasmic-material-ui/components";
type Props = Record<string, PropType<any>>;
type ApiProp = {
  description?: string;
  type: { name: string; description?: string };
  default?: string;
  required?: boolean;
  signature?: { type: string; describedArgs: string[] };
};
const cleanType = (value: string) =>
  value
    .replace(/<br>/g, "")
    .replace(/&#124;/g, "|")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
function primitive(
  type: "text" | "number" | "boolean" | "object",
):
  | { type: "string" }
  | { type: "number" }
  | { type: "boolean" }
  | { type: "exprEditor" } {
  switch (type) {
    case "text":
      return { type: "string" };
    case "number":
      return { type: "number" };
    case "boolean":
      return { type: "boolean" };
    case "object":
      return { type: "exprEditor" };
  }
}
function property(name: string, prop: ApiProp): Props[string] {
  const nativeType = cleanType(prop.type.description ?? prop.type.name);
  const common = {
    description: prop.description
      ? cleanType(prop.description)
          .replace(/<[^>]*>/g, "")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&amp;/g, "&")
      : `MUI ${name}: ${prop.signature?.type ?? nativeType}.`,
    exprHint: prop.signature?.type ?? nativeType,
    required: prop.required,
    ...(["sx", "slots", "slotProps", "classes", "component"].includes(name)
      ? { advanced: true }
      : {}),
  };
  // MUI also uses custom validators for React nodes/elements (e.g. Tooltip).
  if (/^(node|element)(\s*\|\s*string)?$/.test(nativeType)) {
    return {
      type: "slot",
      description: common.description,
      hidePlaceholder:
        !prop.required && (name !== "children" || nativeType === "element"),
    };
  }
  if (prop.type.name === "func") {
    if (name.startsWith("on")) {
      const args = prop.signature?.type.match(/^function\((.*?)\)\s*=>/s)?.[1];
      return {
        ...common,
        type: "eventHandler",
        argTypes: args
          ? args.split(/,\s*(?![^<]*>)/).map((arg, index) => {
              const [argName, ...typeParts] = arg.split(":");
              const type = typeParts.join(":").trim();
              return {
                name: argName.trim().replace(/\?$/, "") || `arg${index}`,
                type: /^(boolean|boolean \| null)$/.test(type)
                  ? "boolean"
                  : /^(number|number \| null)$/.test(type)
                    ? "number"
                    : type === "string"
                      ? "string"
                      : "object",
              };
            })
          : [{ name: "event", type: "object" }],
      };
    }
    return {
      ...common,
      type: "exprEditor",
      advanced: true,
      exprHint: prop.signature?.type ?? "A JavaScript function.",
    };
  }
  const parts = nativeType
    .split(/\s*\|\s*/)
    .flatMap((part) =>
      part === "bool" && nativeType.includes("|") ? ["true", "false"] : [part],
    );
  const literals = parts.filter((part) =>
    /^'[^']*'$|^(true|false|-?\d+)$/.test(part),
  );
  let type: Exclude<PropType<any>, string | React.ComponentType<any>>;
  if (
    literals.length &&
    parts.every((part) => literals.includes(part) || part === "string")
  ) {
    type = {
      type: "choice",
      options: literals.map((part) =>
        part.startsWith("'") ? part.slice(1, -1) : JSON.parse(part),
      ),
    };
  } else if (nativeType === "bool") {
    type = { type: "boolean" };
  } else if (nativeType === "number" || nativeType === "integer") {
    type = { type: "number" };
  } else if (prop.type.name === "string" || nativeType === "string") {
    type =
      name === "src" || name === "image"
        ? { type: "imageUrl" }
        : name === "href"
          ? { type: "href" }
          : { type: "string" };
  } else if (
    prop.type.name === "object" ||
    (prop.type.name === "shape" && name !== "slots")
  ) {
    type = { type: "object" };
  } else {
    // Mixed values, arrays, component types, refs and functions need a control
    // that can preserve their real JavaScript value, not coerce them to text/objects.
    type = {
      type: "exprEditor",
      ...(["elementType", "element type", "ref"].includes(nativeType) ||
      name === "slots"
        ? { advanced: true }
        : {}),
    };
  }
  let defaultValueHint: any;
  if (
    prop.default !== undefined &&
    /^(?:true|false|null|-?\d+(\.\d+)?|'[^']*')$/.test(prop.default)
  ) {
    defaultValueHint = prop.default.startsWith("'")
      ? prop.default.slice(1, -1)
      : JSON.parse(prop.default);
  }
  return {
    ...common,
    ...type,
    ...(defaultValueHint != null ? { defaultValueHint } : {}),
  };
}

const children: Record<string, string[]> = {
  BottomNavigation: ["BottomNavigationAction"],
  Tabs: ["Tab"],
  Select: ["MenuItem", "NativeOption"],
  NativeSelect: ["NativeOption"],
  Accordion: ["AccordionSummary", "AccordionDetails", "AccordionActions"],
  Stepper: ["Step"],
  Step: ["StepLabel", "StepButton", "StepContent"],
  RadioGroup: ["FormControlLabel", "Radio"],
  ToggleButtonGroup: ["ToggleButton"],
  ButtonGroup: ["Button"],
  Menu: ["MenuItem"],
  MenuList: ["MenuItem"],
  ImageList: ["ImageListItem"],
  Table: ["TableHead", "TableBody", "TableFooter"],
  TableHead: ["TableRow"],
  TableBody: ["TableRow"],
  TableFooter: ["TableRow"],
  TableRow: ["TableCell"],
};

// These children are optional decoration, fallback content or sizing input,
// rather than an empty content area that needs a canvas drop target.
const optionalChildren = new Set<keyof typeof api>([
  "Avatar",
  "Backdrop",
  "Badge",
  "Box",
  "CardMedia",
  "Container",
  "Divider",
  "Grid",
  "ListItemText",
  "Paper",
  "Skeleton",
  "Stack",
  "StepButton",
  "StepLabel",
  "TableCell",
  "TableSortLabel",
  "TextField",
  // These inspect native child types, or render inside SVG/HTML structures
  // where a placeholder div is not a valid child.
  "Accordion",
  "AvatarGroup",
  "Breadcrumbs",
  "List",
  "SvgIcon",
]);

// API inheritance includes children even when the implementation replaces it
// with its own content. Keep the actual icon/message/page props instead.
const ignoredChildren = new Set<keyof typeof api>([
  "Checkbox",
  "Radio",
  "Switch",
  "MobileStepper",
  "PaginationItem",
  "SnackbarContent",
  "TablePagination",
]);
const childParents: Record<string, string> = {
  BottomNavigationAction: "BottomNavigation",
  Tab: "Tabs",
  Step: "Stepper",
  StepLabel: "Stepper",
  StepButton: "Stepper",
  StepContent: "Stepper",
  StepConnector: "Stepper",
  AccordionSummary: "Accordion",
  AccordionDetails: "Accordion",
  AccordionActions: "Accordion",
  DialogTitle: "Dialog",
  DialogContent: "Dialog",
  DialogContentText: "Dialog",
  DialogActions: "Dialog",
  CardHeader: "Card",
  CardContent: "Card",
  CardActions: "Card",
  CardActionArea: "Card",
  CardMedia: "Card",
  AlertTitle: "Alert",
  ImageListItem: "ImageList",
  ImageListItemBar: "ImageList",
  ListItem: "List",
  ListItemButton: "List",
  ListItemText: "List",
  ListItemIcon: "List",
  ListItemAvatar: "List",
  ListSubheader: "List",
  TableHead: "Table",
  TableBody: "Table",
  TableFooter: "Table",
  TableRow: "Table",
  TableCell: "Table",
  TableSortLabel: "Table",
  TablePagination: "Table",
};
export const element = (name: string, props: Record<string, any> = {}) => ({
  type: "component" as const,
  name: componentName(name),
  props,
});
const text = (value: string) => ({ type: "text" as const, value });
const defaults: Record<string, Record<string, any>> = {
  Button: { children: text("按钮"), variant: "contained" },
  Fab: { children: text("＋"), "aria-label": "添加" },
  IconButton: { children: text("＋"), "aria-label": "添加" },
  Typography: { children: text("正文内容") },
  Link: { children: text("查看详情"), href: "#" },
  TextField: { label: text("输入内容"), fullWidth: true },
  InputLabel: { children: text("标签") },
  FormLabel: { children: text("选项") },
  FormHelperText: { children: text("提示信息") },
  FormControlLabel: { label: text("选项"), control: element("Checkbox") },
  Autocomplete: {
    options: ["北京", "上海", "深圳"],
    textFieldProps: { label: "城市" },
  },
  Select: {
    defaultValue: "first",
    children: [
      element("MenuItem", { value: "first", children: text("选项一") }),
      element("MenuItem", { value: "second", children: text("选项二") }),
    ],
  },
  NativeSelect: {
    children: [
      element("NativeOption", { value: "first", children: text("选项一") }),
      element("NativeOption", { value: "second", children: text("选项二") }),
    ],
  },
  RadioGroup: {
    children: [
      element("FormControlLabel", {
        value: "first",
        label: text("选项一"),
        control: element("Radio"),
      }),
      element("FormControlLabel", {
        value: "second",
        label: text("选项二"),
        control: element("Radio"),
      }),
    ],
  },
  Slider: { defaultValue: 30, "aria-label": "数值" },
  Rating: { defaultValue: 3, name: "rating" },
  BottomNavigation: {
    showLabels: true,
    children: [
      element("BottomNavigationAction", { label: text("首页"), value: "home" }),
      element("BottomNavigationAction", {
        label: text("我的"),
        value: "profile",
      }),
    ],
    defaultValue: "home",
  },
  Tabs: {
    children: [
      element("Tab", { label: text("全部"), value: "all" }),
      element("Tab", { label: text("收藏"), value: "saved" }),
    ],
    defaultValue: "all",
  },
  Tab: { label: text("标签") },
  BottomNavigationAction: { label: text("导航") },
  ToggleButtonGroup: {
    exclusive: true,
    children: [
      element("ToggleButton", { value: "list", children: text("列表") }),
      element("ToggleButton", { value: "grid", children: text("网格") }),
    ],
  },
  ToggleButton: { value: "option", children: text("选项") },
  ButtonGroup: {
    children: [
      element("Button", { children: text("上一步") }),
      element("Button", { children: text("下一步") }),
    ],
  },
  AppBar: {
    position: "static",
    children: element("Toolbar", {
      children: element("Typography", {
        children: text("应用"),
        variant: "h6",
      }),
    }),
  },
  Accordion: {
    children: [
      element("AccordionSummary", { children: text("展开详情") }),
      element("AccordionDetails", { children: text("详情内容") }),
    ],
  },
  Card: {
    children: element("CardContent", {
      children: element("Typography", { children: text("卡片内容") }),
    }),
  },
  CardHeader: { title: text("标题"), subheader: text("描述") },
  List: {
    children: element("ListItem", {
      children: element("ListItemText", {
        primary: text("列表项"),
        secondary: text("描述"),
      }),
    }),
  },
  ListItemText: { primary: text("列表项") },
  Chip: { label: text("标签") },
  Avatar: { children: text("人") },
  Alert: { severity: "info", children: text("提示信息") },
  Snackbar: { message: text("操作成功"), autoHideDuration: 6000 },
  Dialog: {
    children: [
      element("DialogTitle", { children: text("提示") }),
      element("DialogContent", {
        children: element("DialogContentText", {
          children: text("请确认操作内容"),
        }),
      }),
    ],
  },
  Drawer: {
    anchor: "bottom",
    children: element("Box", { sx: { p: 3 }, children: text("抽屉内容") }),
  },
  SwipeableDrawer: {
    anchor: "bottom",
    children: element("Box", { sx: { p: 3 }, children: text("抽屉内容") }),
  },
  Tooltip: {
    title: text("提示信息"),
    children: element("Button", { children: text("查看提示") }),
  },
  Menu: {
    anchorReference: "anchorPosition",
    anchorPosition: { top: 72, left: 16 },
    children: [
      element("MenuItem", { children: text("编辑") }),
      element("MenuItem", { children: text("删除") }),
    ],
  },
  Pagination: { count: 10 },
  TablePagination: { count: 100, page: 0, rowsPerPage: 10, component: "div" },
  MobileStepper: {
    steps: 3,
    activeStep: 0,
    position: "static",
    backButton: element("Button", { children: text("上一步") }),
    nextButton: element("Button", { children: text("下一步") }),
  },
  Stepper: {
    activeStep: 0,
    children: [
      element("Step", {
        children: element("StepLabel", { children: text("填写信息") }),
      }),
      element("Step", {
        children: element("StepLabel", { children: text("确认提交") }),
      }),
    ],
  },
  Skeleton: { variant: "rounded", width: 240, height: 120 },
  Table: {
    children: [
      element("TableHead", {
        children: element("TableRow", {
          children: element("TableCell", { children: text("名称") }),
        }),
      }),
      element("TableBody", {
        children: element("TableRow", {
          children: element("TableCell", { children: text("内容") }),
        }),
      }),
    ],
  },
};
const overlays = [
  "Dialog",
  "Drawer",
  "SwipeableDrawer",
  "Snackbar",
  "Menu",
  "Tooltip",
];
type Binding = [
  string,
  "text" | "number" | "boolean" | "object",
  string?,
  string?,
];
const bindings: Record<string, Binding[]> = {
  TextField: [["value", "text", "defaultValue"]],
  Input: [["value", "text", "defaultValue"]],
  InputBase: [["value", "text", "defaultValue"]],
  OutlinedInput: [["value", "text", "defaultValue"]],
  Select: [["value", "object", "defaultValue"]],
  NativeSelect: [["value", "text", "defaultValue"]],
  RadioGroup: [["value", "text", "defaultValue"]],
  Checkbox: [["checked", "boolean", "defaultChecked"]],
  Switch: [["checked", "boolean", "defaultChecked"]],
  Radio: [["checked", "boolean", "defaultChecked"]],
  Slider: [["value", "object", "defaultValue"]],
  Rating: [["value", "number", "defaultValue"]],
  Tabs: [["value", "object", "defaultValue"]],
  BottomNavigation: [["value", "object", "defaultValue"]],
  ToggleButtonGroup: [["value", "object"]],
  Pagination: [["page", "number", "defaultPage"]],
  Accordion: [["expanded", "boolean", "defaultExpanded"]],
  Autocomplete: [
    ["value", "object", "defaultValue"],
    ["inputValue", "text", undefined, "onInputChange"],
  ],
  TablePagination: [
    ["page", "number", undefined, "onPageChange"],
    ["rowsPerPage", "number", undefined, "onRowsPerPageChange"],
  ],
  ...Object.fromEntries(
    overlays.map((name) => [
      name,
      [["open", "boolean", "defaultOpen", "onOpenChange"]] as Binding[],
    ]),
  ),
};

// API tables omit native DOM props inherited by MUI's TypeScript contracts.
const htmlProps: {
  [K in keyof typeof api]?: Partial<
    Record<
      | keyof React.ComponentProps<(typeof components)[K]>
      | (K extends "Button" ? keyof ButtonProps<"a"> : never)
      | (K extends "Grid" ? keyof GridProps : never)
      | (K extends "CardMedia" ? keyof React.ComponentProps<"img"> : never),
      PropType<any>
    >
  >;
} = {
  Link: { href: "href", target: "string", rel: "string", download: "string" },
  Button: { name: "string", value: "string", target: "string", rel: "string" },
  Checkbox: { name: "string", autoFocus: "boolean", readOnly: "boolean" },
  Switch: { name: "string", autoFocus: "boolean", readOnly: "boolean" },
  Radio: { name: "string", autoFocus: "boolean", readOnly: "boolean" },
  InputLabel: { htmlFor: "string" },
  FormLabel: { htmlFor: "string" },
  CardMedia: {
    alt: "string",
    srcSet: "string",
    sizes: "string",
    loading: { type: "choice", options: ["eager", "lazy"] },
  },
  Grid: { sx: "object", component: "exprEditor" },
};

const usageDescriptions: Partial<Record<keyof typeof api, string>> = {
  Drawer: "A side panel that slides in from a screen edge. Place a detail view or an edit form alongside the current page, or show navigation. Use anchor to choose the edge.",
  SwipeableDrawer: "A touch-operated navigation drawer. Swipe inward from the screen edge to open it and swipe back to dismiss it.",
  Slider: "Choose a numeric value by dragging a thumb along a track. Use two thumbs to set the lower and upper bounds of a range.",
};

export function componentMeta(name: keyof typeof api): CodeComponentMeta<any> {
  const doc = api[name];
  const props: Props = Object.fromEntries(
    Object.entries(doc.props)
      .filter(
        ([key, value]) =>
          (value as ApiProp).type.description !== "unsupportedProp" &&
          !(key === "children" && ignoredChildren.has(name)),
      )
      .map(([key, value]) => [key, property(key, value as ApiProp)]),
  );
  Object.assign(props, htmlProps[name]);
  const domProps: Props = {
    id: { type: "string", advanced: true },
    tabIndex: { type: "number", advanced: true },
    "aria-describedby": { type: "string", advanced: true },
    "aria-label": { type: "string", advanced: true },
    "aria-labelledby": { type: "string", advanced: true },
    role: { type: "string", advanced: true },
    title: props.title ?? { type: "string", advanced: true },
    style: { type: "object", advanced: true },
  };
  for (const [key, value] of Object.entries(domProps)) props[key] ??= value;
  for (const event of ["onClick", "onFocus", "onBlur", "onKeyDown"]) {
    props[event] ??= {
      type: "eventHandler",
      argTypes: [{ name: "event", type: "object" }],
    };
  }
  // The API table omits the second checked argument implemented by SwitchBase.
  if (["Checkbox", "Radio", "Switch", "FormControlLabel"].includes(name)) {
    props.onChange = {
      ...(typeof props.onChange === "object" ? props.onChange : {}),
      type: "eventHandler",
      argTypes: [
        { name: "event", type: "object" },
        { name: "checked", type: "boolean" },
      ],
    };
  }
  for (const key of ["onTransitionEnter", "onTransitionExited"]) {
    if (key in props) props[key] = { type: "eventHandler", argTypes: [] };
  }
  if (name === "Autocomplete") {
    props.onChange = {
      type: "eventHandler",
      argTypes: [
        { name: "event", type: "object" },
        { name: "value", type: "object" },
        { name: "reason", type: "string" },
        { name: "details", type: "object" },
      ],
    };
  }
  if (props.sx)
    props.sx = {
      type: "object",
      description:
        "MUI sx, including responsive breakpoint objects, spacing, colors and selectors.",
    };
  if (name === "Autocomplete")
    props.textFieldProps = {
      type: "object",
      description:
        "Props for the default TextField rendered by renderInput. MUI's input refs and input attributes are preserved.",
    };
  if (name === "Autocomplete" && typeof props.renderInput === "object") {
    props.renderInput = {
      ...props.renderInput,
      required: false,
    } as Props[string];
  }
  if (name === "SwipeableDrawer") {
    for (const key of ["onOpen", "onClose"]) {
      const prop = props[key];
      if (typeof prop === "object" && prop.type === "eventHandler")
        props[key] = { ...prop, required: false };
    }
  }
  // These inherit children from @mui/system; Material UI's API JSON omits it.
  if (name === "Box" || name === "Container") props.children = { type: "slot" };
  const childProp = props.children;
  if (children[name])
    props.children = {
      ...(typeof childProp === "object" && childProp.type === "slot"
        ? childProp
        : {}),
      type: "slot",
      allowedComponents: children[name].map(componentName),
      hidePlaceholder: true,
    };
  if (optionalChildren.has(name))
    props.children = {
      ...(typeof props.children === "object" && props.children.type === "slot"
        ? props.children
        : {}),
      type: "slot",
      hidePlaceholder: true,
    };
  const states: NonNullable<CodeComponentMeta<any>["states"]> = {};
  for (const [key, variableType, initial, event = "onChange"] of bindings[
    name
  ] ?? []) {
    const initialProp = initial ? props[initial] : undefined;
    if (initial) delete props[initial];
    if (!(event in props))
      props[event] = {
        type: "eventHandler",
        argTypes: [
          {
            name: key,
            type: variableType === "text" ? "string" : variableType,
          },
        ],
      };
    const current = props[key];
    props[key] = {
      ...(typeof current === "object"
        ? {
            description: current.description,
            ...("exprHint" in current ? { exprHint: current.exprHint } : {}),
            ...("defaultValueHint" in current
              ? { defaultValueHint: current.defaultValueHint }
              : {}),
            ...("required" in current ? { required: current.required } : {}),
          }
        : {}),
      ...primitive(variableType),
      ...(initial ? { editOnly: true, uncontrolledProp: initial } : {}),
      ...(initial ? { required: false } : {}),
      ...(typeof initialProp === "object" && "defaultValueHint" in initialProp
        ? { defaultValueHint: initialProp.defaultValueHint }
        : {}),
    };
    states[key] = {
      type: "writable",
      valueProp: key,
      onChangeProp: event,
      variableType,
    };
  }
  for (const [key, value] of Object.entries(defaults[name] ?? {})) {
    const target =
      bindings[name]?.find((binding) => binding[2] === key)?.[0] ?? key;
    const current = props[target];
    if (current)
      props[target] = {
        ...(typeof current === "object" ? current : { type: current }),
        defaultValue: value,
      } as Props[string];
  }
  const helpers = (components as any)[`${name}Helpers`];
  return {
    name: componentName(name),
    displayName: name,
    section: doc.section,
    description: `Material UI ${name}. ${usageDescriptions[name] ?? "Mobile-first React component."} https://mui.com/material-ui/api/${componentName(name).replace("plasmic-material-ui-", "")}/`,
    importPath,
    importName: name,
    props,
    ...(childParents[name]
      ? { parentComponentName: componentName(childParents[name]) }
      : {}),
    ...(Object.keys(states).length
      ? {
          states,
          componentHelpers: {
            helpers,
            importPath,
            importName: `${name}Helpers`,
          },
        }
      : {}),
    ...(overlays.includes(name)
      ? { canvasOverlay: name === "Tooltip" ? { triggerSlot: "children" } : {} }
      : {}),
    ...([
      "Box",
      "Stack",
      "Container",
      "Grid",
      "AppBar",
      "Tabs",
      "BottomNavigation",
      "TextField",
      "Slider",
      "List",
    ].includes(name)
      ? { defaultStyles: { width: "stretch" } }
      : {}),
  };
}
export const componentNames = Object.keys(api) as (keyof typeof api)[];
