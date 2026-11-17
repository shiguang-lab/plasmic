import type { ButtonProps } from "@mui/material/Button";
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
  | { type: "object" } {
  switch (type) {
    case "text":
      return { type: "string" };
    case "number":
      return { type: "number" };
    case "boolean":
      return { type: "boolean" };
    case "object":
      return { type: "object" };
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
  if (prop.type.name === "node" || prop.type.name === "element") {
    return {
      type: "slot",
      description: common.description,
      hidePlaceholder:
        name !== "children" || (prop.type.name === "element" && !prop.required),
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
                type:
                  type === "boolean"
                    ? "boolean"
                    : type === "number"
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
  const parts = nativeType.split(/\s*\|\s*/);
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
  } else if (prop.type.name === "bool") {
    type = { type: "boolean" };
  } else if (prop.type.name === "number") {
    type = { type: "number" };
  } else if (
    prop.type.name === "string" ||
    nativeType === "string" ||
    prop.type.name === "elementType"
  ) {
    type =
      name === "src"
        ? { type: "imageUrl" }
        : name === "href"
          ? { type: "href" }
          : { type: "string" };
  } else {
    type = { type: "object" };
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
  Select: ["MenuItem"],
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
  ImageListItem: ["ImageListItemBar"],
  Table: ["TableHead", "TableBody", "TableFooter"],
  TableHead: ["TableRow"],
  TableBody: ["TableRow"],
  TableFooter: ["TableRow"],
  TableRow: ["TableCell"],
};
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
      | (K extends "Button" ? keyof ButtonProps<"a"> : never),
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
};

export function componentMeta(name: keyof typeof api): CodeComponentMeta<any> {
  const doc = api[name];
  const props: Props = Object.fromEntries(
    Object.entries(doc.props).map(([key, value]) => [
      key,
      property(key, value as ApiProp),
    ]),
  );
  Object.assign(props, htmlProps[name]);
  Object.assign(props, {
    id: { type: "string", advanced: true },
    tabIndex: { type: "number", advanced: true },
    "aria-describedby": { type: "string", advanced: true },
    "aria-label": { type: "string", advanced: true },
    "aria-labelledby": { type: "string", advanced: true },
    role: { type: "string", advanced: true },
    title: props.title ?? { type: "string", advanced: true },
    style: { type: "object", advanced: true },
  });
  for (const event of ["onClick", "onFocus", "onBlur", "onKeyDown"]) {
    props[event] ??= {
      type: "eventHandler",
      argTypes: [{ name: "event", type: "object" }],
    };
  }
  // MUI component types and refs are expressions; element instances use slots.
  for (const key of ["slots", "action", "inputRef", "container", "anchorEl"]) {
    if (key in props)
      props[key] = {
        type: "exprEditor",
        advanced: true,
        description: `Native MUI ${key}. Bind an expression with the original MUI type.`,
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
  // Box inherits children from @mui/system; Material UI's API JSON omits it.
  if (name === "Box") props.children = { type: "slot" };
  if (children[name])
    props.children = {
      type: "slot",
      allowedComponents: children[name].map(componentName),
    };
  const states: NonNullable<CodeComponentMeta<any>["states"]> = {};
  for (const [key, variableType, initial, event = "onChange"] of bindings[
    name
  ] ?? []) {
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
        ? { description: current.description }
        : {}),
      ...primitive(variableType),
      ...(initial ? { editOnly: true, uncontrolledProp: initial } : {}),
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
    description: `Material UI ${name}. Mobile-first React component. https://mui.com/material-ui/api/${componentName(name).replace("plasmic-material-ui-", "")}/`,
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
