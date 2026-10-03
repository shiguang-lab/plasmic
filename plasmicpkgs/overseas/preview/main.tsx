import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { PlasmicCanvasHost } from "@plasmicapp/host";
import { Button, ConfigProvider, Typography } from "antd";
import { AppShell, registerAppShell } from "../src/registerAppShell";
import { Registerable } from "../src/registerAppShell";

registerAppShell();
let registration: any;
registerAppShell({ registerComponent(_component, meta) { registration = meta; } } as Registerable);
const sources = [{ value: "PAKORA", label: "PAKORA" }, { value: "TACO", label: "TACO" }];
const languages = [{ value: "zh-CN", label: "简体中文" }, { value: "en", label: "English" }, { value: "ar", label: "العربية" }];
const menus = [{ key: "apps", label: "APP 配置" }, { key: "pages", label: "页面管理" }, { key: "errors", label: "错误码管理" }, { key: "settings", label: "中台配置管理" }];
const logo = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><g fill="#1677ff"><path d="M9 6h13v6H9zM9 15h6v7H9zM21 23h6v6h-6zM22 1h5v5h-5z"/></g><g fill="#00c9ee"><path d="M3 6h6v6H3zM3 16h6v6H3zM3 25h6v5H3zM15 12h6v5h-6z"/></g></svg>')}`;
function Preview() {
  const [page, setPage] = useState("apps");
  const [source, setSource] = useState("PAKORA");
  const [language, setLanguage] = useState("zh-CN");
  return <AppShell className="app-shell-preview" timeZone="Asia/Shanghai" productName="增长管理平台" logoUrl={logo} userName="示例用户" breadcrumbItems={[{ title: "增长管理平台" }, { title: menus.find(item => item.key === page)?.label || "APP 配置" }]} menuItems={menus} selectedMenuKey={page} onMenuSelect={setPage} appSources={sources} appSource={source} onAppSourceChange={setSource} languages={languages} language={language} onLanguageChange={setLanguage}>
    <div style={{ height: "100%", minHeight: "calc(100vh - 96px)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
      <strong style={{ color: "#536176", fontSize: 18 }}>页面业务内容插槽 (Page Body Slot)</strong>
      <span style={{ color: "#9cacc1", fontSize: 14 }}>在实例中直接替换此 Slot 填充业务页面；外层固定保留 16px 内容间距</span>
    </div>
  </AppShell>;
}
function Gallery() {
  return <div style={{ padding: 32, maxWidth: 960, margin: "auto" }}>
    <Typography.Title level={3}>Application layouts</Typography.Title>
    <Typography.Paragraph>已注册 AppShell。业务内容放入 Page body 插槽，页面共用同一个外壳组件。</Typography.Paragraph>
    <a href="?preview" style={{ display: "block", width: 480, color: "inherit", textDecoration: "none", border: "1px solid #e5e5e5", borderRadius: 8, overflow: "hidden" }}>
      <img src={registration.thumbnailUrl} alt="AppShell 布局预览" style={{ display: "block", width: "100%" }} />
      <div style={{ padding: 16 }}><strong>{registration.displayName}</strong><p>239px 侧栏 · 64px 顶栏 · Page body 插槽</p><Button type="primary">打开预览</Button></div>
    </a>
    <Typography.Title level={5}>实例配置</Typography.Title>
    <Typography.Paragraph>productName、logoUrl、userName、languages、appSources、menuItems、userMenuItems。支持选中菜单、折叠状态，以及语言/App Source/菜单/用户操作事件。</Typography.Paragraph>
    <Typography.Paragraph>此地址也提供 <a href="?host">Plasmic 组件 Host</a>；缩略图随注册信息内置，不依赖外部图片服务。</Typography.Paragraph>
  </div>;
}
const params = new URLSearchParams(location.search);
createRoot(document.getElementById("root")!).render(params.has("host") ? <PlasmicCanvasHost /> : <ConfigProvider><>{params.has("preview") ? <Preview /> : <Gallery />}</></ConfigProvider>);
