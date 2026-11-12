import { getComponentThumbnail } from "./componentThumbnails";
import {
  DownOutlined,
  GlobalOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SwapOutlined,
} from "@ant-design/icons";
import { usePlasmicCanvasContext, usePlasmicLink, useSelector } from "@plasmicapp/host";
import registerComponent, {
  CodeComponentMeta,
} from "@plasmicapp/host/registerComponent";
import {
  Avatar,
  Breadcrumb,
  Button,
  ConfigProvider,
  Dropdown,
  Layout,
  Menu,
  theme,
} from "antd";
import React, { useEffect, useMemo, useState } from "react";
import { AppSourceSelect } from "./AppSourceSelect";
import { menuItemType, sidebarMenuItemType } from "./menuItemType";
import {
  ShellMenuItem,
  findMenuPath,
  visibleMenuItems,
} from "./menuNavigation";
export type Registerable = { registerComponent: typeof registerComponent };

export interface ShellOption {
  value: string;
  label: string;
}
export interface AppShellProps {
  className?: string;
  direction?: "ltr" | "rtl";
  onDirectionChange?: (value: "ltr" | "rtl") => void;
  timeZone?: string;
  productName?: React.ReactNode;
  logoUrl?: string;
  userName?: string;
  languages?: ShellOption[];
  language?: string;
  onLanguageChange?: (value: string) => void;
  appSources?: ShellOption[];
  appSource?: string;
  onAppSourceChange?: (value: string) => void;
  menuItems?: ShellMenuItem[];
  selectedMenuKey?: string;
  onMenuSelect?: (key: string) => void;
  userMenuItems?: React.ComponentProps<typeof Menu>["items"];
  onUserAction?: (key: string) => void;
  collapsed?: boolean;
  onCollapsedChange?: (value: boolean) => void;
  initialContentScrollTop?: number;
  onContentScroll?: (scrollTop: number) => void;
  children?: React.ReactNode;
}
export const DEFAULT_LANGUAGES: ShellOption[] = [
  { value: "zh-CN", label: "简体中文" },
  { value: "en", label: "English" },
];
export const DEFAULT_APP_SOURCES: ShellOption[] = [
  { value: "PAKORA", label: "PAKORA" },
];
export const DEFAULT_MENU_ITEMS = [
  { key: "apps", label: "APP 配置" },
  { key: "pages", label: "页面管理" },
  { key: "errors", label: "错误码管理" },
  { key: "settings", label: "中台配置管理" },
];

// Pages can remount the shell during navigation. Keep only menu presentation
// state in the current window, scoped to the navigation tree, outside the canvas.
const menuOpenKeysByWindow = new WeakMap<Window, Map<string, string[]>>();

function LocalClock({ language, timeZone, color }: {
  language: string;
  timeZone: string;
  color: string;
}) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const formatter = useMemo(() => new Intl.DateTimeFormat(language, {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }), [language, timeZone]);
  const { year, month, day, hour, minute, second } = Object.fromEntries(
    formatter.formatToParts(now).map(({ type, value }) => [type, value]),
  );
  return (
    <time style={{ color, whiteSpace: "nowrap", fontSize: 14 }}>
      当地时间：{`${year}-${month}-${day} ${hour}:${minute}:${second}`}
    </time>
  );
}

export function AppShell({
  className,
  productName = "增长管理平台",
  logoUrl,
  userName = "示例用户",
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
    { key: "profile", label: "个人资料" },
    { key: "logout", label: "退出登录" },
  ],
  onUserAction,
  collapsed,
  onCollapsedChange,
  direction,
  onDirectionChange,
  timeZone = "Asia/Shanghai",
  initialContentScrollTop,
  onContentScroll,
  children,
}: AppShellProps) {
  const { token } = theme.useToken();
  const canvas = usePlasmicCanvasContext();
  const [localCollapsed, setCollapsed] = useState(false);
  const [localLanguage, setLanguage] = useState<string>();
  const [localSource, setSource] = useState<string>();
  const [localMenu, setMenu] = useState<string>();
  const [localDirection, setDirection] = useState<"ltr" | "rtl">("ltr");
  const brandRef = React.useRef<HTMLDivElement>(null);
  const [brandText, setBrandText] = useState("");
  useEffect(() => {
    const brand = brandRef.current;
    if (!brand) return;
    const updateText = () => {
      const content = brand.cloneNode(true) as HTMLDivElement;
      content.querySelectorAll("[data-plasmic-slot-placeholder], [data-plasmic-editor-only], [data-slate-zero-width]")
        .forEach((element) => element.remove());
      setBrandText(content.textContent?.trim() ?? "");
    };
    updateText();
    const observer = new MutationObserver(updateText);
    observer.observe(brand, { childList: true, characterData: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  const contentRef = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (contentRef.current && initialContentScrollTop !== undefined) {
      contentRef.current.scrollTop = initialContentScrollTop;
    }
  }, [initialContentScrollTop]);
  const isCollapsed = collapsed ?? localCollapsed;
  const currentLanguage =
    language || localLanguage || languages[0]?.value || "en";
  const currentSource = appSource || localSource || appSources[0]?.value;
  const currentDirection = direction ?? localDirection;
  const PlasmicLink = usePlasmicLink();
  const pagePath = useSelector("pagePath") as string | undefined;
  const menuPath = findMenuPath(
    menuItems ?? [],
    pagePath,
    selectedMenuKey ?? localMenu,
  );
  const selectedKey = [...menuPath]
    .reverse()
    .find((item) => !item.hidden)?.key;
  const navigationKey = JSON.stringify(menuItems, ["key", "href", "hidden", "children"]);
  const routeKey = JSON.stringify([pagePath, menuPath.map((item) => item.key)]);
  const routeOpenKeys = menuPath
    .filter((item) => !item.hidden &&
      item.children?.some((child) => !child.hidden))
    .map((item) => item.key);
  const rememberedKeys = !canvas && typeof window !== "undefined"
    ? menuOpenKeysByWindow.get(window)?.get(navigationKey) ?? []
    : [];
  const [menuState, setMenuState] = useState(() => ({
    inCanvas: !!canvas,
    navigationKey,
    routeKey,
    openKeys: Array.from(new Set([...rememberedKeys, ...routeOpenKeys])),
  }));
  if (menuState.inCanvas !== !!canvas || menuState.navigationKey !== navigationKey || menuState.routeKey !== routeKey) {
    setMenuState({
      inCanvas: !!canvas,
      navigationKey,
      routeKey,
      openKeys: Array.from(new Set([
        ...(menuState.inCanvas === !!canvas && menuState.navigationKey === navigationKey ? menuState.openKeys : rememberedKeys),
        ...routeOpenKeys,
      ])),
    });
  }
  useEffect(() => {
    if (canvas) return;
    let menus = menuOpenKeysByWindow.get(window);
    if (!menus) {
      menus = new Map();
      menuOpenKeysByWindow.set(window, menus);
    }
    menus.set(menuState.navigationKey, menuState.openKeys);
  }, [canvas, menuState]);
  const breadcrumbItems = [
    ...((typeof productName === "string" ? productName : brandText)
      ? [{ title: typeof productName === "string" ? productName : brandText }]
      : []),
    ...menuPath
      .filter((item) => item.label)
      .map((item) => ({
        title:
          item.href && item !== menuPath.at(-1) ? (
            <PlasmicLink href={item.href}>{item.label}</PlasmicLink>
          ) : (
            item.label
          ),
      })),
  ];
  const linkedMenu = (items: ShellMenuItem[]): React.ComponentProps<typeof Menu>["items"] =>
    items.map(
      (item) =>
        item && {
          key: item.key,
          label: item.label,
          icon: item.icon,
          disabled: item.disabled,
          ...(item.href
            ? {
                label: <PlasmicLink href={item.href}>{item.label}</PlasmicLink>,
              }
            : {}),
          ...(item.children ? { children: linkedMenu(item.children) } : {}),
        },
    );
  return (
    <ConfigProvider direction={currentDirection}>
      <div
        className={className}
        style={{
          width: "100%",
          // Studio's iframe can grow with content; use its authored viewport.
          // Studio's "full page height" view sets --canvas-content-height to
          // `auto`, so the shell grows with its content and the content region
          // stops scrolling. Neither variable exists in previews or exports.
          height:
            "var(--canvas-content-height, var(--viewport-height, 100vh))",
          minWidth: 0,
          minHeight: "var(--viewport-height, 100vh)",
          flexShrink: 0,
          overflow: "hidden",
        }}
      >
        <Layout
          style={{
            width: "100%",
            height: "100%",
            // Fills the viewport when the shell height is `auto`.
            minHeight: "var(--viewport-height, 100vh)",
            overflow: "hidden",
            background: "#f0f2f5",
          }}
        >
          <Layout.Sider
            width={239}
            collapsedWidth={80}
            collapsed={isCollapsed}
            theme="light"
            style={{
              borderInlineEnd: `1px solid ${token.colorBorderSecondary}`,
              overflow: "auto",
            }}
          >
            <div
              style={{
                height: 64,
                padding: "0 16px",
                display: "flex",
                alignItems: "center",
                gap: 10,
                overflow: "hidden",
                whiteSpace: "nowrap",
              }}
            >
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt=""
                  style={{
                    width: 30,
                    height: 30,
                    objectFit: "contain",
                    flexShrink: 0,
                  }}
                />
              ) : (
                <Avatar
                  shape="square"
                  size={30}
                  style={{ flexShrink: 0 }}
                  icon={typeof productName === "string" ? undefined : <GlobalOutlined />}
                >
                  {typeof productName === "string" ? productName.slice(0, 1) : null}
                </Avatar>
              )}
                <div
                  ref={brandRef}
                  data-app-shell-product-name
                  style={{
                    flex: "1 1 0%",
                    minWidth: 0,
                    height: 32,
                    display: isCollapsed ? "none" : "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    overflow: "hidden",
                    fontSize: 16,
                    fontWeight: 600,
                    color: token.colorText,
                  }}
                  title={typeof productName === "string" ? productName : undefined}
                >
                  {productName}
                </div>
            </div>
            <Menu
              mode="inline"
              theme="light"
              inlineCollapsed={isCollapsed}
              items={linkedMenu(visibleMenuItems(menuItems ?? []))}
              openKeys={isCollapsed ? [] : menuState.openKeys}
              onOpenChange={(openKeys) => {
                if (!isCollapsed) setMenuState({ ...menuState, openKeys });
              }}
              selectedKeys={selectedKey ? [selectedKey] : []}
              onClick={({ key }) => {
                setMenu(key);
                onMenuSelect?.(key);
              }}
              style={{ borderInlineEnd: 0 }}
            />
          </Layout.Sider>
          <Layout style={{ minWidth: 0, minHeight: 0 }}>
            <Layout.Header
              style={{
                height: 64,
                padding: "0 24px",
                background: token.colorBgContainer,
                borderBottom: `1px solid ${token.colorBorderSecondary}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                lineHeight: "normal",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  minWidth: 0,
                }}
              >
                <Button
                  type="text"
                  aria-label={isCollapsed ? "展开侧栏" : "折叠侧栏"}
                  icon={
                    isCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />
                  }
                  onClick={() => {
                    setCollapsed(!isCollapsed);
                    onCollapsedChange?.(!isCollapsed);
                  }}
                />
                {breadcrumbItems.length > 0 && (
                  <Breadcrumb items={breadcrumbItems} />
                )}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  minWidth: 0,
                }}
              >
                <LocalClock
                  language={currentLanguage}
                  timeZone={timeZone}
                  color={token.colorTextSecondary}
                />
                {appSources.length > 0 && (
                  <AppSourceSelect
                    value={currentSource}
                    options={appSources}
                    language={currentLanguage}
                    onChange={(value) => {
                      setSource(value);
                      onAppSourceChange?.(value);
                    }}
                  />
                )}
                {languages.length > 0 && (
                  <Dropdown
                    menu={{
                      items: languages.map(({ value, label }) => ({
                        key: value,
                        label,
                      })),
                      selectedKeys: [currentLanguage],
                      onClick: ({ key }) => {
                        setLanguage(key);
                        onLanguageChange?.(key);
                      },
                    }}
                  >
                    <Button
                      type="text"
                      aria-label="语言"
                      title={
                        languages.find(
                          (option) => option.value === currentLanguage,
                        )?.label
                      }
                      icon={<GlobalOutlined />}
                    />
                  </Dropdown>
                )}
                <Button
                  type={currentDirection === "rtl" ? "primary" : "text"}
                  aria-label={
                    currentDirection === "rtl" ? "切换为 LTR" : "切换为 RTL"
                  }
                  icon={<SwapOutlined />}
                  onClick={() => {
                    const next = currentDirection === "rtl" ? "ltr" : "rtl";
                    setDirection(next);
                    onDirectionChange?.(next);
                  }}
                />
                <Dropdown
                  menu={{
                    items: userMenuItems,
                    onClick: ({ key }) => onUserAction?.(key),
                  }}
                >
                  <Button type="text" style={{ height: 32, paddingInline: 0 }}>
                    <Avatar size={32}>{userName.slice(0, 1)}</Avatar>
                    <span>{userName}</span>
                    <DownOutlined />
                  </Button>
                </Dropdown>
              </div>
            </Layout.Header>
            <Layout.Content
              ref={contentRef}
              onScroll={(event) => onContentScroll?.(event.currentTarget.scrollTop)}
              style={{ padding: 16, minHeight: 0, overflow: "auto" }}
            >
              <div style={{ minHeight: "100%" }}>{children}</div>
            </Layout.Content>
          </Layout>
        </Layout>
      </div>
    </ConfigProvider>
  );
}

const optionType = {
  type: "object" as const,
  fields: { value: "string" as const, label: "string" as const },
  nameFunc: (item: ShellOption) => item.label,
};
export const appShellThumbnail = getComponentThumbnail("plasmic-overseas-app-shell");
export const appShellMeta: CodeComponentMeta<AppShellProps> = {
  name: "plasmic-overseas-app-shell",
  displayName: "AppShell",
  section: "Application layout",
  thumbnailUrl: appShellThumbnail,
  description:
    "Shared application shell with route-based navigation and breadcrumbs. Configure the product, user, language, and app source; edit pages in the children slot.",
  importPath: "@shiguang-lab/plasmic-overseas/skinny/registerAppShell",
  importName: "AppShell",
  styleSections: false,
  defaultStyles: { width: "100%", height: "100vh" },
  props: {
    direction: { displayName: "Direction", type: "choice", options: ["ltr", "rtl"], defaultValue: "ltr" },
    onDirectionChange: {
      type: "eventHandler",
      argTypes: [{ name: "value", type: "string" }],
    },
    timeZone: { displayName: "Time zone", type: "string", defaultValue: "Asia/Shanghai" },
    productName: {
      displayName: "Brand",
      type: "slot",
      fixedRoot: true,
      defaultValue: {
        type: "text",
        tag: "span",
        elementName: "Brand",
        value: "增长管理平台",
        styles: {
          width: "100%", height: "100%", lineHeight: "32px",
          fontSize: "16px", fontWeight: "600", color: "inherit",
          flexShrink: 0, margin: "0", padding: "0",
        },
      },
      hidePlaceholder: false,
    },
    logoUrl: { type: "imageUrl", displayName: "Logo" },
    userName: { displayName: "User name", type: "string", defaultValue: "示例用户" },
    languages: {
      displayName: "Languages",
      type: "array",
      itemType: optionType,
      defaultValue: DEFAULT_LANGUAGES,
    },
    language: { type: "string", displayName: "Language" },
    onLanguageChange: {
      type: "eventHandler",
      argTypes: [{ name: "value", type: "string" }],
    },
    appSources: {
      displayName: "App sources",
      type: "array",
      itemType: optionType,
      defaultValue: DEFAULT_APP_SOURCES,
    },
    appSource: { type: "string", displayName: "App source" },
    onAppSourceChange: {
      type: "eventHandler",
      argTypes: [{ name: "value", type: "string" }],
    },
    menuItems: {
      displayName: "Menu items",
      type: "array",
      itemType: sidebarMenuItemType,
      defaultValue: DEFAULT_MENU_ITEMS,
    },
    selectedMenuKey: { type: "string", displayName: "Selected menu key" },
    onMenuSelect: {
      type: "eventHandler",
      argTypes: [{ name: "key", type: "string" }],
    },
    userMenuItems: { displayName: "User menu items", type: "array", itemType: menuItemType as any },
    onUserAction: {
      type: "eventHandler",
      argTypes: [{ name: "key", type: "string" }],
    },
    collapsed: { type: "boolean", displayName: "Collapsed" },
    onCollapsedChange: {
      type: "eventHandler",
      argTypes: [{ name: "value", type: "boolean" }],
    },
    children: { type: "slot", displayName: "Children", hidePlaceholder: true },
    initialContentScrollTop: {
      type: "number",
      displayName: "Initial content scroll position",
      description: "Restore the content region's vertical scroll position when returning to a page.",
    },
    onContentScroll: {
      type: "eventHandler",
      argTypes: [{ name: "scrollTop", type: "number" }],
    },
  },
  states: {
    direction: {
      type: "writable",
      variableType: "text",
      valueProp: "direction",
      onChangeProp: "onDirectionChange",
    },
    language: {
      type: "writable",
      variableType: "text",
      valueProp: "language",
      onChangeProp: "onLanguageChange",
    },
    appSource: {
      type: "writable",
      variableType: "text",
      valueProp: "appSource",
      onChangeProp: "onAppSourceChange",
    },
    selectedMenuKey: {
      type: "writable",
      variableType: "text",
      valueProp: "selectedMenuKey",
      onChangeProp: "onMenuSelect",
    },
    collapsed: {
      type: "writable",
      variableType: "boolean",
      valueProp: "collapsed",
      onChangeProp: "onCollapsedChange",
    },
  },
};
export function registerAppShell(loader?: Registerable) {
  (loader?.registerComponent ?? registerComponent)(AppShell, appShellMeta);
}
