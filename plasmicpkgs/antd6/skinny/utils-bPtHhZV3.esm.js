import registerComponent from "@plasmicapp/host/registerComponent";
import registerGlobalContext from "@plasmicapp/host/registerGlobalContext";
import { Result } from "antd";
import React from "react";

const sections = {
  General: ["button", "float-button", "typography", "back-top"],
  Layout: [
    "divider",
    "flex",
    "row",
    "col",
    "layout",
    "masonry",
    "space",
    "splitter",
  ],
  Navigation: [
    "anchor",
    "breadcrumb",
    "dropdown",
    "menu",
    "pagination",
    "steps",
    "tabs",
    "tab-item",
    "submenu",
  ],
  "Data Entry": [
    "auto-complete",
    "cascader",
    "checkbox",
    "color-picker",
    "date-picker",
    "date-range-picker",
    "form",
    "input",
    "textarea",
    "mentions",
    "radio",
    "rate",
    "select",
    "option",
    "slider",
    "range-slider",
    "switch",
    "time-picker",
    "time-range-picker",
    "transfer",
    "tree-select",
    "upload",
  ],
  "Data Display": [
    "avatar",
    "badge",
    "calendar",
    "card",
    "carousel",
    "collapse",
    "single-collapse",
    "descriptions",
    "empty",
    "image",
    "list",
    "listy",
    "popover",
    "qr-code",
    "segmented",
    "statistic",
    "table",
    "tag",
    "timeline",
    "tooltip",
    "tour",
    "tree",
    "directory-tree",
  ],
  Feedback: [
    "alert",
    "drawer",
    "modal",
    "popconfirm",
    "progress",
    "result",
    "skeleton",
    "spin",
    "watermark",
  ],
  Other: ["affix", "border-beam"],
};
function getComponentSection(name) {
  const suffix = name.replace(/^plasmic-antd6-/, "");
  return Object.entries(sections).find(([, families]) =>
    families.some(
      (family) => suffix === family || suffix.startsWith(`${family}-`),
    ),
  )?.[0];
}
const componentChildren = {
  "avatar-group": { displayName: "Avatar.Group", parent: "avatar" },
  "badge-ribbon": { displayName: "Badge.Ribbon", parent: "badge" },
  "breadcrumb-item": { displayName: "Breadcrumb.Item", parent: "breadcrumb" },
  "card-grid": { displayName: "Card.Grid", parent: "card" },
  "card-meta": { displayName: "Card.Meta", parent: "card" },
  "cascader-panel": { displayName: "Cascader.Panel", parent: "cascader" },
  "float-button-group": {
    displayName: "FloatButton.Group",
    parent: "float-button",
  },
  "back-top": { displayName: "FloatButton.BackTop", parent: "float-button" },
  "image-preview-group": { displayName: "Image.PreviewGroup", parent: "image" },
  "list-item": { displayName: "List.Item", parent: "list" },
  "list-item-meta": { displayName: "List.Item.Meta", parent: "list-item" },
  "space-compact": { displayName: "Space.Compact", parent: "space" },
  "splitter-panel": { displayName: "Splitter.Panel", parent: "splitter" },
  "statistic-timer": { displayName: "Statistic.Timer", parent: "statistic" },
  "tag-checkable": { displayName: "Tag.CheckableTag", parent: "tag" },
  "input-otp": { displayName: "Input.OTP", parent: "input" },
  "input-search": { displayName: "Input.Search", parent: "input" },
  "input-password": { displayName: "Input.Password", parent: "input" },
  textarea: { displayName: "Input.TextArea", parent: "input" },
  "upload-dragger": { displayName: "Upload.Dragger", parent: "upload" },
  "time-range-picker": {
    displayName: "TimePicker.RangePicker",
    parent: "time-picker",
  },
  "date-range-picker": {
    displayName: "DatePicker.RangePicker",
    parent: "date-picker",
  },
  "directory-tree": { displayName: "Tree.DirectoryTree", parent: "tree" },
  option: { displayName: "Select.Option", parent: "select" },
  "option-group": { displayName: "Select.OptGroup", parent: "select" },
  "table-column": { displayName: "Table.Column", parent: "table" },
  "table-column-group": { displayName: "Table.ColumnGroup", parent: "table" },
  "checkbox-group": { displayName: "Checkbox.Group", parent: "checkbox" },
  "radio-button": { displayName: "Radio.Button", parent: "radio" },
  "radio-group": { displayName: "Radio.Group", parent: "radio" },
  "menu-item": { displayName: "Menu.Item", parent: "menu" },
  "menu-item-group": { displayName: "Menu.ItemGroup", parent: "menu" },
  "menu-divider": { displayName: "Menu.Divider", parent: "menu" },
  submenu: { displayName: "Menu.SubMenu", parent: "menu" },
  "form-item": { displayName: "Form.Item", parent: "form" },
  "form-list": { displayName: "Form.List", parent: "form" },
  "collapse-item": { displayName: "Collapse.Panel", parent: "collapse" },
  "tab-item": { displayName: "Tabs.TabPane", parent: "tabs" },
  "layout-header": { displayName: "Layout.Header", parent: "layout" },
  "layout-footer": { displayName: "Layout.Footer", parent: "layout" },
  "layout-content": { displayName: "Layout.Content", parent: "layout" },
  "layout-sider": { displayName: "Layout.Sider", parent: "layout" },
  "skeleton-button": { displayName: "Skeleton.Button", parent: "skeleton" },
  "skeleton-input": { displayName: "Skeleton.Input", parent: "skeleton" },
  "skeleton-avatar": { displayName: "Skeleton.Avatar", parent: "skeleton" },
  "skeleton-image": { displayName: "Skeleton.Image", parent: "skeleton" },
  "skeleton-node": { displayName: "Skeleton.Node", parent: "skeleton" },
  "typography-text": { displayName: "Typography.Text", parent: "typography" },
  "typography-title": { displayName: "Typography.Title", parent: "typography" },
  "typography-paragraph": {
    displayName: "Typography.Paragraph",
    parent: "typography",
  },
  "typography-link": { displayName: "Typography.Link", parent: "typography" },
};

var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) =>
  key in obj
    ? __defProp(obj, key, {
        enumerable: true,
        configurable: true,
        writable: true,
        value,
      })
    : (obj[key] = value);
var __publicField = (obj, key, value) => __defNormalProp(obj, key + "", value);
function makeRegisterGlobalContext(component, meta) {
  return function (loader) {
    if (loader) {
      loader.registerGlobalContext(component, meta);
    } else {
      registerGlobalContext(component, meta);
    }
  };
}
function registerComponentHelper(loader, component, meta) {
  const suffix = meta.name.replace(/^plasmic-antd6-/, "");
  const child = componentChildren[suffix];
  const isStandalone = suffix === "radio" || suffix === "input-number";
  meta = {
    ...meta,
    displayName: child?.displayName ?? meta.displayName,
    section: meta.section ?? getComponentSection(meta.name),
    parentComponentName: child
      ? `plasmic-antd6-${child.parent}`
      : isStandalone
        ? void 0
        : meta.parentComponentName,
  };
  if (loader) {
    loader.registerComponent(component, meta);
  } else {
    registerComponent(component, meta);
  }
}
function traverseReactEltTree(children, callback) {
  const rec = (elts) => {
    (Array.isArray(elts) ? elts : [elts]).forEach((elt) => {
      if (elt) {
        callback(elt);
        if (elt.children) {
          rec(elt.children);
        }
        if (elt.props?.children && elt.props.children !== elt.children) {
          rec(elt.props.children);
        }
      }
    });
  };
  rec(children);
}
function asArray(x) {
  if (Array.isArray(x)) {
    return x;
  } else if (x == null) {
    return [];
  } else {
    return [x];
  }
}
function omit(obj, ...keys) {
  if (Object.keys(obj).length === 0) {
    return obj;
  }
  const res = {};
  for (const key of Object.keys(obj)) {
    if (!keys.includes(key)) {
      res[key] = obj[key];
    }
  }
  return res;
}
function usePrevious(value) {
  const prevValue = React.useRef(void 0);
  React.useEffect(() => {
    prevValue.current = value;
    return () => {
      prevValue.current = void 0;
    };
  });
  return prevValue.current;
}
function capitalize(value) {
  return value[0].toUpperCase() + value.slice(1);
}
function ensureArray(x) {
  return Array.isArray(x) ? x : [x];
}
function setFieldsToUndefined(obj) {
  if (typeof obj === "object" && obj !== null) {
    for (const key in obj) {
      if (typeof obj[key] === "object") {
        setFieldsToUndefined(obj[key]);
      }
      obj[key] = void 0;
    }
  }
}
function arrayEq(xs, ys) {
  return xs.length === ys.length && xs.every((x, i) => x === ys[i]);
}
class ErrorBoundary extends React.Component {
  constructor() {
    super(...arguments);
    __publicField(this, "state", { hasError: false, errorInfo: "" });
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, errorInfo: error.message };
  }
  componentDidCatch(error, errorInfo) {
    console.log(error, errorInfo);
  }
  componentDidUpdate(prevProps, prevState) {
    if (
      prevProps.canvasEnvId !== this.props.canvasEnvId &&
      prevState.hasError
    ) {
      this.setState({ hasError: false });
    }
  }
  render() {
    if (this.state.hasError) {
      return /* @__PURE__ */ React.createElement(Result, {
        status: "error",
        title: this.props.message ?? "Something went wrong.",
        extra: this.state.errorInfo,
      });
    }
    return this.props.children;
  }
}
function isUnsafeKey(key) {
  return (
    (Array.isArray(key) && key[0] === "__proto__") ||
    key === "__proto__" ||
    key === "constructor" ||
    key === "prototype"
  );
}
function get(obj, path) {
  const keys = Array.isArray(path) ? path : path.split(".");
  let i;
  for (i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (!obj || !Object.hasOwn(obj, key) || isUnsafeKey(key)) {
      obj = void 0;
      break;
    }
    obj = obj[key];
  }
  return obj;
}

export {
  ErrorBoundary as E,
  arrayEq as a,
  asArray as b,
  capitalize as c,
  ensureArray as e,
  get as g,
  makeRegisterGlobalContext as m,
  omit as o,
  registerComponentHelper as r,
  setFieldsToUndefined as s,
  traverseReactEltTree as t,
  usePrevious as u,
};
//# sourceMappingURL=utils-bPtHhZV3.esm.js.map
