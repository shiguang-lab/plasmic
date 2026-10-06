import { MenuUnfoldOutlined, MenuFoldOutlined, GlobalOutlined, SwapOutlined, DownOutlined } from '@ant-design/icons';
import { usePlasmicLink, useSelector } from '@plasmicapp/host';
import registerComponent from '@plasmicapp/host/registerComponent';
import { theme, Select, ConfigProvider, Layout, Avatar, Menu, Button, Breadcrumb, Dropdown } from 'antd';
import React, { useState, useEffect } from 'react';

function AppSourceSelect({ options, value, language, onChange }) {
  const { token } = theme.useToken();
  const chinese = language.replace(/_/g, "-").toLowerCase().startsWith("zh");
  const title = chinese ? "\u8FD0\u8425 App" : "Operations App";
  const current = chinese ? "\u5F53\u524D" : "Current";
  const hint = chinese ? "\u5207\u6362 App \u4EE5\u67E5\u770B\u5BF9\u5E94\u6570\u636E" : "Switch apps to view their data";
  const label = (text, active) => /* @__PURE__ */ React.createElement("span", { style: { display: "inline-flex", gap: 10, alignItems: "center", minWidth: 0 } }, /* @__PURE__ */ React.createElement("i", { "aria-hidden": "true", style: { display: "inline-block", width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: active ? token.colorPrimary : token.colorTextQuaternary } }), /* @__PURE__ */ React.createElement("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, text));
  const hintStyle = { padding: "8px 12px", color: token.colorTextTertiary, fontSize: 12 };
  return /* @__PURE__ */ React.createElement(
    Select,
    {
      "aria-label": title,
      value,
      style: { minWidth: 180, width: 180 },
      popupMatchSelectWidth: 320,
      options: options.map((item) => ({ value: item.value, label: label(item.label, true), text: item.label })),
      onChange: (next) => {
        if (next !== value) onChange(next);
      },
      optionRender: (option) => /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, padding: "8px 4px" } }, label(option.data.text, option.value === value), option.value === value && /* @__PURE__ */ React.createElement("span", { style: { color: token.colorPrimary, fontSize: 12, flexShrink: 0 } }, current)),
      popupRender: (menu) => /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { style: hintStyle }, title), menu, /* @__PURE__ */ React.createElement("div", { style: hintStyle }, hint))
    }
  );
}

const menuItemType = { type: "object", nameFunc: (item) => item.label || item.key, fields: { key: "string", label: "string", href: { type: "href", description: "Page route; uses Plasmic navigation." }, disabled: "boolean", hidden: { type: "boolean", description: "Hide this route from the sidebar while retaining its breadcrumb ancestry." }, type: { type: "choice", options: ["item", "group", "divider"] }, children: { type: "array" } } };
menuItemType.fields.children.itemType = menuItemType;

const routePath = (href) => href.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
function findMenuPath(items, pagePath, selectedKey) {
  for (const item of items) {
    const childPath = findMenuPath(item.children ?? [], pagePath, selectedKey);
    if (childPath.length) return [item, ...childPath];
    if (item.type !== "divider" && (pagePath ? !!item.href && routePath(item.href) === routePath(pagePath) : item.key === selectedKey)) return [item];
  }
  return [];
}
function visibleMenuItems(items) {
  return items.filter((item) => !item.hidden).map((item) => {
    const { children, ...rest } = item;
    const visibleChildren = visibleMenuItems(children ?? []);
    return visibleChildren.length ? { ...rest, children: visibleChildren } : rest;
  });
}

const DEFAULT_LANGUAGES = [
  { value: "zh-CN", label: "\u7B80\u4F53\u4E2D\u6587" },
  { value: "en", label: "English" }
];
const DEFAULT_APP_SOURCES = [
  { value: "PAKORA", label: "PAKORA" }
];
const DEFAULT_MENU_ITEMS = [
  { key: "apps", label: "APP \u914D\u7F6E" },
  { key: "pages", label: "\u9875\u9762\u7BA1\u7406" },
  { key: "errors", label: "\u9519\u8BEF\u7801\u7BA1\u7406" },
  { key: "settings", label: "\u4E2D\u53F0\u914D\u7F6E\u7BA1\u7406" }
];
function AppShell({
  className,
  productName = "\u589E\u957F\u7BA1\u7406\u5E73\u53F0",
  logoUrl,
  userName = "\u793A\u4F8B\u7528\u6237",
  languages = DEFAULT_LANGUAGES,
  language,
  onLanguageChange,
  appSources = DEFAULT_APP_SOURCES,
  appSource,
  onAppSourceChange,
  menuItems = DEFAULT_MENU_ITEMS,
  selectedMenuKey,
  onMenuSelect,
  userMenuItems = [
    { key: "profile", label: "\u4E2A\u4EBA\u8D44\u6599" },
    { key: "logout", label: "\u9000\u51FA\u767B\u5F55" }
  ],
  onUserAction,
  collapsed,
  onCollapsedChange,
  direction,
  onDirectionChange,
  timeZone = "Asia/Shanghai",
  currentTime,
  children
}) {
  const { token } = theme.useToken();
  const [localCollapsed, setCollapsed] = useState(false);
  const [localLanguage, setLanguage] = useState();
  const [localSource, setSource] = useState();
  const [localMenu, setMenu] = useState();
  const [localDirection, setDirection] = useState("ltr");
  const [now, setNow] = useState(() => /* @__PURE__ */ new Date());
  useEffect(() => {
    if (currentTime !== void 0) {
      return;
    }
    const timer = setInterval(() => setNow(/* @__PURE__ */ new Date()), 1e3);
    return () => clearInterval(timer);
  }, [currentTime]);
  const isCollapsed = collapsed ?? localCollapsed;
  const currentLanguage = language || localLanguage || languages[0]?.value || "en";
  const currentSource = appSource || localSource || appSources[0]?.value;
  const currentDirection = direction ?? localDirection;
  const PlasmicLink = usePlasmicLink();
  const pagePath = useSelector("pagePath");
  const menuPath = findMenuPath(
    menuItems ?? [],
    pagePath,
    selectedMenuKey ?? localMenu
  );
  const selectedKey = [...menuPath].reverse().find((item) => !item.hidden && item.type !== "group")?.key;
  const breadcrumbItems = [
    { title: productName },
    ...menuPath.filter((item) => item.label).map((item) => ({
      title: item.href && item !== menuPath.at(-1) ? /* @__PURE__ */ React.createElement(PlasmicLink, { href: item.href }, item.label) : item.label
    }))
  ];
  const timeParts = Object.fromEntries(
    new Intl.DateTimeFormat(currentLanguage, {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    }).formatToParts(now).map(({ type, value }) => [type, value])
  );
  const clock = currentTime ?? `${timeParts.year}-${timeParts.month}-${timeParts.day} ${timeParts.hour}:${timeParts.minute}:${timeParts.second}`;
  const linkedMenu = (items) => items.map(
    (item) => item && {
      ...item,
      ...item.href ? {
        label: /* @__PURE__ */ React.createElement(PlasmicLink, { href: item.href }, item.label)
      } : {},
      ...item.children ? { children: linkedMenu(item.children) } : {}
    }
  );
  return /* @__PURE__ */ React.createElement(ConfigProvider, { direction: currentDirection }, /* @__PURE__ */ React.createElement("div", { className, style: { minHeight: 0, overflow: "hidden" } }, /* @__PURE__ */ React.createElement(
    Layout,
    {
      style: {
        width: "100%",
        height: "100%",
        minHeight: 0,
        overflow: "hidden",
        background: "#f0f2f5"
      }
    },
    /* @__PURE__ */ React.createElement(
      Layout.Sider,
      {
        width: 239,
        collapsedWidth: 80,
        collapsed: isCollapsed,
        theme: "light",
        style: {
          borderInlineEnd: `1px solid ${token.colorBorderSecondary}`,
          overflow: "auto"
        }
      },
      /* @__PURE__ */ React.createElement(
        "div",
        {
          style: {
            height: 64,
            padding: "0 16px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            overflow: "hidden",
            whiteSpace: "nowrap"
          }
        },
        logoUrl ? /* @__PURE__ */ React.createElement(
          "img",
          {
            src: logoUrl,
            alt: "",
            style: {
              width: 30,
              height: 30,
              objectFit: "contain",
              flexShrink: 0
            }
          }
        ) : /* @__PURE__ */ React.createElement(Avatar, { shape: "square", size: 30, style: { flexShrink: 0 } }, productName.slice(0, 1)),
        !isCollapsed && /* @__PURE__ */ React.createElement(
          "strong",
          {
            style: { fontSize: 16, color: token.colorText },
            title: productName
          },
          productName
        )
      ),
      /* @__PURE__ */ React.createElement(
        Menu,
        {
          mode: "inline",
          theme: "light",
          inlineCollapsed: isCollapsed,
          items: linkedMenu(visibleMenuItems(menuItems ?? [])),
          defaultOpenKeys: menuPath.slice(0, -1).filter((item) => !item.hidden).map((item) => item.key),
          selectedKeys: selectedKey ? [selectedKey] : [],
          onClick: ({ key }) => {
            setMenu(key);
            onMenuSelect?.(key);
          },
          style: { borderInlineEnd: 0 }
        }
      )
    ),
    /* @__PURE__ */ React.createElement(Layout, { style: { minWidth: 0, minHeight: 0 } }, /* @__PURE__ */ React.createElement(
      Layout.Header,
      {
        style: {
          height: 64,
          padding: "0 24px",
          background: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          lineHeight: "normal"
        }
      },
      /* @__PURE__ */ React.createElement(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            gap: 16,
            minWidth: 0
          }
        },
        /* @__PURE__ */ React.createElement(
          Button,
          {
            type: "text",
            "aria-label": isCollapsed ? "\u5C55\u5F00\u4FA7\u680F" : "\u6298\u53E0\u4FA7\u680F",
            icon: isCollapsed ? /* @__PURE__ */ React.createElement(MenuUnfoldOutlined, null) : /* @__PURE__ */ React.createElement(MenuFoldOutlined, null),
            onClick: () => {
              setCollapsed(!isCollapsed);
              onCollapsedChange?.(!isCollapsed);
            }
          }
        ),
        breadcrumbItems.length > 0 && /* @__PURE__ */ React.createElement(Breadcrumb, { items: breadcrumbItems })
      ),
      /* @__PURE__ */ React.createElement(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            gap: 8,
            minWidth: 0
          }
        },
        /* @__PURE__ */ React.createElement(
          "time",
          {
            style: {
              color: token.colorTextSecondary,
              whiteSpace: "nowrap",
              fontSize: 14
            }
          },
          "\u5F53\u5730\u65F6\u95F4\uFF1A",
          clock
        ),
        appSources.length > 0 && /* @__PURE__ */ React.createElement(
          AppSourceSelect,
          {
            value: currentSource,
            options: appSources,
            language: currentLanguage,
            onChange: (value) => {
              setSource(value);
              onAppSourceChange?.(value);
            }
          }
        ),
        languages.length > 0 && /* @__PURE__ */ React.createElement(
          Dropdown,
          {
            menu: {
              items: languages.map(({ value, label }) => ({
                key: value,
                label
              })),
              selectedKeys: [currentLanguage],
              onClick: ({ key }) => {
                setLanguage(key);
                onLanguageChange?.(key);
              }
            }
          },
          /* @__PURE__ */ React.createElement(
            Button,
            {
              type: "text",
              "aria-label": "\u8BED\u8A00",
              title: languages.find(
                (option) => option.value === currentLanguage
              )?.label,
              icon: /* @__PURE__ */ React.createElement(GlobalOutlined, null)
            }
          )
        ),
        /* @__PURE__ */ React.createElement(
          Button,
          {
            type: currentDirection === "rtl" ? "primary" : "text",
            "aria-label": currentDirection === "rtl" ? "\u5207\u6362\u4E3A LTR" : "\u5207\u6362\u4E3A RTL",
            icon: /* @__PURE__ */ React.createElement(SwapOutlined, null),
            onClick: () => {
              const next = currentDirection === "rtl" ? "ltr" : "rtl";
              setDirection(next);
              onDirectionChange?.(next);
            }
          }
        ),
        /* @__PURE__ */ React.createElement(
          Dropdown,
          {
            menu: {
              items: userMenuItems,
              onClick: ({ key }) => onUserAction?.(key)
            }
          },
          /* @__PURE__ */ React.createElement(Button, { type: "text", style: { height: 32, paddingInline: 0 } }, /* @__PURE__ */ React.createElement(Avatar, { size: 32 }, userName.slice(0, 1)), /* @__PURE__ */ React.createElement("span", null, userName), /* @__PURE__ */ React.createElement(DownOutlined, null))
        )
      )
    ), /* @__PURE__ */ React.createElement(
      Layout.Content,
      {
        style: { padding: 16, minHeight: 0, overflow: "auto" }
      },
      /* @__PURE__ */ React.createElement("div", { style: { minHeight: "100%" } }, children)
    ))
  )));
}
const optionType = {
  type: "object",
  fields: { value: "string", label: "string" },
  nameFunc: (item) => item.label
};
const thumbnail = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270" viewBox="0 0 480 270"><rect width="480" height="270" fill="#f5f5f5"/><path d="M0 0h60v270H0zM60 0h420v16H60z" fill="white"/><text x="5" y="11" font-family="sans-serif" font-size="6" font-weight="bold">AppShell</text><rect x="2" y="24" width="56" height="12" rx="2" fill="#e6f4ff"/><text x="7" y="32" font-family="sans-serif" font-size="5" fill="#1677ff">Navigation</text><text x="7" y="47" font-family="sans-serif" font-size="5">Menu</text><text x="65" y="11" font-family="sans-serif" font-size="6">\u2630</text><text x="80" y="11" font-family="sans-serif" font-size="5" fill="#8c8c8c">Product / Page</text><text x="295" y="11" font-family="sans-serif" font-size="5" fill="#8c8c8c">Local time</text><rect x="330" y="4" width="45" height="9" rx="2" fill="white" stroke="#d9d9d9"/><text x="334" y="10" font-family="sans-serif" font-size="4">App Source</text><text x="386" y="11" font-family="sans-serif" font-size="5">\u25CE \u21C6 \u25CF User</text><rect x="64" y="20" width="412" height="246" fill="white"/><rect x="72" y="30" width="92" height="6" rx="2" fill="#e6e9ed"/><rect x="72" y="44" width="396" height="1" fill="#f0f0f0"/><text x="270" y="145" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#8c8c8c">Page Body Slot</text></svg>`;
const appShellThumbnail = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(thumbnail)}`;
const appShellMeta = {
  name: "plasmic-overseas-app-shell",
  displayName: "AppShell",
  section: "\u5E94\u7528\u5E03\u5C40",
  thumbnailUrl: appShellThumbnail,
  description: "\u5171\u4EAB\u540E\u53F0\u6846\u67B6\uFF0C\u6839\u636E\u83DC\u5355\u8DEF\u7531\u540C\u6B65\u5BFC\u822A\u548C\u9762\u5305\u5C51\u3002\u53EF\u914D\u7F6E\u4EA7\u54C1\u3001\u7528\u6237\u3001\u8BED\u8A00\u548C App \u6765\u6E90\uFF0C\u5728\u9875\u9762\u5185\u5BB9\u63D2\u69FD\u4E2D\u7F16\u8F91\u9875\u9762\u3002",
  importPath: "@shiguang-lab/plasmic-overseas/skinny/registerAppShell",
  importName: "AppShell",
  defaultStyles: { width: "1440px", height: "1024px" },
  props: {
    direction: { displayName: "\u9605\u8BFB\u65B9\u5411", type: "choice", options: ["ltr", "rtl"], defaultValue: "ltr" },
    onDirectionChange: {
      type: "eventHandler",
      argTypes: [{ name: "value", type: "string" }]
    },
    timeZone: { displayName: "\u65F6\u533A", type: "string", defaultValue: "Asia/Shanghai" },
    currentTime: {
      displayName: "\u5F53\u524D\u65F6\u95F4",
      type: "string",
      description: "Host-supplied clock text; otherwise show the current time in timeZone."
    },
    productName: { displayName: "\u4EA7\u54C1\u540D\u79F0", type: "string", defaultValue: "\u589E\u957F\u7BA1\u7406\u5E73\u53F0" },
    logoUrl: { type: "imageUrl", displayName: "\u4EA7\u54C1\u6807\u5FD7" },
    userName: { displayName: "\u7528\u6237\u540D", type: "string", defaultValue: "\u793A\u4F8B\u7528\u6237" },
    languages: {
      displayName: "\u8BED\u8A00\u5217\u8868",
      type: "array",
      itemType: optionType,
      defaultValue: DEFAULT_LANGUAGES
    },
    language: { type: "string", displayName: "\u5F53\u524D\u8BED\u8A00" },
    onLanguageChange: {
      type: "eventHandler",
      argTypes: [{ name: "value", type: "string" }]
    },
    appSources: {
      displayName: "App \u6765\u6E90\u5217\u8868",
      type: "array",
      itemType: optionType,
      defaultValue: DEFAULT_APP_SOURCES
    },
    appSource: { type: "string", displayName: "\u5F53\u524D App \u6765\u6E90" },
    onAppSourceChange: {
      type: "eventHandler",
      argTypes: [{ name: "value", type: "string" }]
    },
    menuItems: {
      displayName: "\u5BFC\u822A\u83DC\u5355",
      type: "array",
      itemType: menuItemType,
      defaultValue: DEFAULT_MENU_ITEMS
    },
    selectedMenuKey: { type: "string", displayName: "\u5F53\u524D\u83DC\u5355\u6807\u8BC6" },
    onMenuSelect: {
      type: "eventHandler",
      argTypes: [{ name: "key", type: "string" }]
    },
    userMenuItems: { displayName: "\u7528\u6237\u83DC\u5355", type: "array", itemType: menuItemType },
    onUserAction: {
      type: "eventHandler",
      argTypes: [{ name: "key", type: "string" }]
    },
    collapsed: { type: "boolean", displayName: "\u6298\u53E0\u4FA7\u680F" },
    onCollapsedChange: {
      type: "eventHandler",
      argTypes: [{ name: "value", type: "boolean" }]
    },
    children: { type: "slot", displayName: "\u9875\u9762\u5185\u5BB9", hidePlaceholder: true }
  },
  states: {
    direction: {
      type: "writable",
      variableType: "text",
      valueProp: "direction",
      onChangeProp: "onDirectionChange"
    },
    language: {
      type: "writable",
      variableType: "text",
      valueProp: "language",
      onChangeProp: "onLanguageChange"
    },
    appSource: {
      type: "writable",
      variableType: "text",
      valueProp: "appSource",
      onChangeProp: "onAppSourceChange"
    },
    selectedMenuKey: {
      type: "writable",
      variableType: "text",
      valueProp: "selectedMenuKey",
      onChangeProp: "onMenuSelect"
    },
    collapsed: {
      type: "writable",
      variableType: "boolean",
      valueProp: "collapsed",
      onChangeProp: "onCollapsedChange"
    }
  }
};
function registerAppShell(loader) {
  (loader?.registerComponent ?? registerComponent)(AppShell, appShellMeta);
}

export { AppShell, DEFAULT_APP_SOURCES, DEFAULT_LANGUAGES, DEFAULT_MENU_ITEMS, appShellMeta, appShellThumbnail, registerAppShell };
//# sourceMappingURL=registerAppShell.esm.js.map
