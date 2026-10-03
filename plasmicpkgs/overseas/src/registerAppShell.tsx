import React, { useEffect, useState } from "react";
import { Avatar, Breadcrumb, Button, ConfigProvider, Dropdown, Layout, Menu, theme } from "antd";
import { DownOutlined, GlobalOutlined, MenuFoldOutlined, MenuUnfoldOutlined, SwapOutlined } from "@ant-design/icons";
import { usePlasmicLink, useSelector } from "@plasmicapp/host";
import { menuItemType } from "./menuItemType";
import { AppSourceSelect } from "./AppSourceSelect";
import { findMenuPath, visibleMenuItems, ShellMenuItem } from "./menuNavigation";
import registerComponent, { CodeComponentMeta } from "@plasmicapp/host/registerComponent";
export type Registerable = { registerComponent: typeof registerComponent };

export interface ShellOption { value: string; label: string; }
export interface AppShellProps {
  className?: string;
  direction?: "ltr" | "rtl";
  onDirectionChange?: (value: "ltr" | "rtl") => void;
  timeZone?: string;
  currentTime?: string;
  productName?: string;
  logoUrl?: string;
  /** Reserved by the published hostless contract; never used for rendering. */
  breadcrumbItems?: { title: string }[];
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
  children?: React.ReactNode;
}
export const DEFAULT_LANGUAGES: ShellOption[] = [
  { value: "zh-CN", label: "简体中文" }, { value: "en", label: "English" },
];
export const DEFAULT_APP_SOURCES: ShellOption[] = [{ value: "PAKORA", label: "PAKORA" }];
export const DEFAULT_MENU_ITEMS = [{ key: "apps", label: "APP 配置" }, { key: "pages", label: "页面管理" }, { key: "errors", label: "错误码管理" }, { key: "settings", label: "中台配置管理" }];

export function AppShell({
  className, productName = "增长管理平台", logoUrl, userName = "示例用户",
  languages = DEFAULT_LANGUAGES, language, onLanguageChange,
  appSources = DEFAULT_APP_SOURCES, appSource, onAppSourceChange,
  menuItems = DEFAULT_MENU_ITEMS, selectedMenuKey, onMenuSelect,
  userMenuItems = [{ key: "profile", label: "个人资料" }, { key: "logout", label: "退出登录" }], onUserAction,
  collapsed, onCollapsedChange, direction, onDirectionChange, timeZone = "Asia/Shanghai", currentTime, children,
}: AppShellProps) {
  const { token } = theme.useToken();
  const [localCollapsed, setCollapsed] = useState(false);
  const [localLanguage, setLanguage] = useState<string>();
  const [localSource, setSource] = useState<string>();
  const [localMenu, setMenu] = useState<string>();
  const [localDirection, setDirection] = useState<"ltr" | "rtl">("ltr");
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (currentTime !== undefined) return;
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, [currentTime]);
  const isCollapsed = collapsed ?? localCollapsed;
  const currentLanguage = language || localLanguage || languages[0]?.value || "en";
  const currentSource = appSource || localSource || appSources[0]?.value;
  const currentDirection = direction ?? localDirection;
  const PlasmicLink = usePlasmicLink();
  const pagePath = useSelector("pagePath") as string | undefined;
  const menuPath = findMenuPath(menuItems ?? [], pagePath, selectedMenuKey ?? localMenu);
  const selectedKey = [...menuPath].reverse().find(item => !item.hidden && item.type !== "group")?.key;
  const breadcrumbItems = [{ title: productName }, ...menuPath.filter(item => item.label).map(item => ({
    title: item.href && item !== menuPath.at(-1)
      ? <PlasmicLink href={item.href}>{item.label}</PlasmicLink>
      : item.label,
  }))];
  const timeParts = Object.fromEntries(new Intl.DateTimeFormat(currentLanguage, { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(now).map(({ type, value }) => [type, value]));
  const clock = currentTime ?? `${timeParts.year}-${timeParts.month}-${timeParts.day} ${timeParts.hour}:${timeParts.minute}:${timeParts.second}`;
  const linkedMenu = (items: any[]): any[] => items.map(item => item && ({ ...item, ...(item.href ? { label: <PlasmicLink href={item.href}>{item.label}</PlasmicLink> } : {}), ...(item.children ? { children: linkedMenu(item.children) } : {}) }));
  return <ConfigProvider direction={currentDirection}>
    <div className={className} style={{ minHeight: 0, overflow: "hidden" }}>
    <Layout style={{ width: "100%", height: "100%", minHeight: 0, overflow: "hidden", background: "#f0f2f5" }}>
      <Layout.Sider width={239} collapsedWidth={80} collapsed={isCollapsed} theme="light" style={{ borderInlineEnd: `1px solid ${token.colorBorderSecondary}`, overflow: "auto" }}>
        <div style={{ height: 64, padding: "0 16px", display: "flex", alignItems: "center", gap: 10, overflow: "hidden", whiteSpace: "nowrap" }}>
          {logoUrl ? <img src={logoUrl} alt="" style={{ width: 30, height: 30, objectFit: "contain", flexShrink: 0 }} /> : <Avatar shape="square" size={30} style={{ flexShrink: 0 }}>{productName.slice(0, 1)}</Avatar>}
          {!isCollapsed && <strong style={{ fontSize: 16, color: token.colorText }} title={productName}>{productName}</strong>}
        </div>
        <Menu mode="inline" theme="light" inlineCollapsed={isCollapsed} items={linkedMenu(visibleMenuItems(menuItems ?? []))} defaultOpenKeys={menuPath.slice(0, -1).filter(item => !item.hidden).map(item => item.key)} selectedKeys={selectedKey ? [selectedKey] : []} onClick={({ key }) => { setMenu(key); onMenuSelect?.(key); }} style={{ borderInlineEnd: 0 }} />
      </Layout.Sider>
      <Layout style={{ minWidth: 0, minHeight: 0 }}>
        <Layout.Header style={{ height: 64, padding: "0 24px", background: token.colorBgContainer, borderBottom: `1px solid ${token.colorBorderSecondary}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, lineHeight: "normal" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 0 }}>
          <Button type="text" aria-label={isCollapsed ? "展开侧栏" : "折叠侧栏"} icon={isCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />} onClick={() => { setCollapsed(!isCollapsed); onCollapsedChange?.(!isCollapsed); }} />
          {breadcrumbItems.length > 0 && <Breadcrumb items={breadcrumbItems} />}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <time style={{ color: token.colorTextSecondary, whiteSpace: "nowrap", fontSize: 14 }}>当地时间：{clock}</time>
            {appSources.length > 0 && <AppSourceSelect value={currentSource} options={appSources} language={currentLanguage} onChange={value => { setSource(value); onAppSourceChange?.(value); }} />}
            {languages.length > 0 && <Dropdown trigger={["click"]} menu={{ items: languages.map(({ value, label }) => ({ key: value, label })), selectedKeys: [currentLanguage], onClick: ({ key }) => { setLanguage(key); onLanguageChange?.(key); } }}>
              <Button type="text" aria-label="语言" title={languages.find(option => option.value === currentLanguage)?.label} icon={<GlobalOutlined />} />
            </Dropdown>}
            <Button type={currentDirection === "rtl" ? "primary" : "text"} aria-label={currentDirection === "rtl" ? "切换为 LTR" : "切换为 RTL"} icon={<SwapOutlined />} onClick={() => { const next = currentDirection === "rtl" ? "ltr" : "rtl"; setDirection(next); onDirectionChange?.(next); }} />
            <Dropdown menu={{ items: userMenuItems, onClick: ({ key }) => onUserAction?.(key) }} trigger={["click"]}>
              <Button type="text" style={{ height: 32, paddingInline: 0 }}><Avatar size={32}>{userName.slice(0, 1)}</Avatar><span>{userName}</span><DownOutlined /></Button>
            </Dropdown>
          </div>
        </Layout.Header>
        <Layout.Content style={{ padding: 16, minHeight: 0, overflow: "auto" }}>
          <div style={{ minHeight: "100%", background: token.colorBgContainer }}>{children}</div>
        </Layout.Content>
      </Layout>
    </Layout>
    </div>
  </ConfigProvider>;
}

const optionType = { type: "object" as const, fields: { value: "string" as const, label: "string" as const }, nameFunc: (item: ShellOption) => item.label };
const thumbnail = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270" viewBox="0 0 480 270"><rect width="480" height="270" fill="#f5f5f5"/><path d="M0 0h60v270H0zM60 0h420v16H60z" fill="white"/><text x="5" y="11" font-family="sans-serif" font-size="6" font-weight="bold">AppShell</text><rect x="2" y="24" width="56" height="12" rx="2" fill="#e6f4ff"/><text x="7" y="32" font-family="sans-serif" font-size="5" fill="#1677ff">Navigation</text><text x="7" y="47" font-family="sans-serif" font-size="5">Menu</text><text x="65" y="11" font-family="sans-serif" font-size="6">☰</text><text x="80" y="11" font-family="sans-serif" font-size="5" fill="#8c8c8c">Product / Page</text><text x="295" y="11" font-family="sans-serif" font-size="5" fill="#8c8c8c">Local time</text><rect x="330" y="4" width="45" height="9" rx="2" fill="white" stroke="#d9d9d9"/><text x="334" y="10" font-family="sans-serif" font-size="4">App Source</text><text x="386" y="11" font-family="sans-serif" font-size="5">◎ ⇆ ● User</text><rect x="64" y="20" width="412" height="246" fill="white"/><rect x="72" y="30" width="92" height="6" rx="2" fill="#e6e9ed"/><rect x="72" y="44" width="396" height="1" fill="#f0f0f0"/><text x="270" y="145" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#8c8c8c">Page Body Slot</text></svg>`;
export const appShellThumbnail = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(thumbnail)}`;
export const appShellMeta: CodeComponentMeta<AppShellProps> = {
    name: "plasmic-overseas-app-shell", displayName: "AppShell", section: "Application layouts", thumbnailUrl: appShellThumbnail,
    description: "Shared admin shell with menu-derived route selection and breadcrumbs, configurable product, user, languages and App Sources. Put page content in the children slot.",
    importPath: "@shiguang-lab/plasmic-overseas/skinny/registerAppShell", importName: "AppShell",
    defaultStyles: { width: "1440px", height: "1024px" },
    props: {
      direction: { type: "choice", options: ["ltr", "rtl"], defaultValue: "ltr" }, onDirectionChange: { type: "eventHandler", argTypes: [{ name: "value", type: "string" }] },
      timeZone: { type: "string", defaultValue: "Asia/Shanghai" }, currentTime: { type: "string", description: "Host-supplied clock text; otherwise show the current time in timeZone." },
      productName: { type: "string", defaultValue: "增长管理平台" }, logoUrl: "imageUrl", userName: { type: "string", defaultValue: "示例用户" },
      breadcrumbItems: { type: "array", hidden: () => true, itemType: { type: "object", fields: { title: "string" } } },
      languages: { type: "array", itemType: optionType, defaultValue: DEFAULT_LANGUAGES },
      language: "string", onLanguageChange: { type: "eventHandler", argTypes: [{ name: "value", type: "string" }] },
      appSources: { type: "array", itemType: optionType, defaultValue: DEFAULT_APP_SOURCES }, appSource: "string",
      onAppSourceChange: { type: "eventHandler", argTypes: [{ name: "value", type: "string" }] },
      menuItems: { type: "array", itemType: menuItemType as any, defaultValue: DEFAULT_MENU_ITEMS }, selectedMenuKey: "string",
      onMenuSelect: { type: "eventHandler", argTypes: [{ name: "key", type: "string" }] },
      userMenuItems: { type: "array", itemType: menuItemType as any }, onUserAction: { type: "eventHandler", argTypes: [{ name: "key", type: "string" }] },
      collapsed: "boolean", onCollapsedChange: { type: "eventHandler", argTypes: [{ name: "value", type: "boolean" }] },
      children: { type: "slot", displayName: "Page body", hidePlaceholder: true },
    },
    states: {
      direction: { type: "writable", variableType: "text", valueProp: "direction", onChangeProp: "onDirectionChange" },
      language: { type: "writable", variableType: "text", valueProp: "language", onChangeProp: "onLanguageChange" },
      appSource: { type: "writable", variableType: "text", valueProp: "appSource", onChangeProp: "onAppSourceChange" },
      selectedMenuKey: { type: "writable", variableType: "text", valueProp: "selectedMenuKey", onChangeProp: "onMenuSelect" },
      collapsed: { type: "writable", variableType: "boolean", valueProp: "collapsed", onChangeProp: "onCollapsedChange" },
    },
};
export function registerAppShell(loader?: Registerable) {
  (loader?.registerComponent ?? registerComponent)(AppShell, appShellMeta);
}
