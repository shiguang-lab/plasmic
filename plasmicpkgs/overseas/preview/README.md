# AppShell 本地预览

运行 `pnpm --filter @shiguang-lab/plasmic-overseas preview:app-shell`。

- 缩略图卡片：<http://127.0.0.1:3106/>
- 交互预览：<http://127.0.0.1:3106/?preview>
- Plasmic 本地组件 Host：<http://127.0.0.1:3106/?host>
- SearchForm 交互预览：<http://127.0.0.1:3106/?search-form>（字段、Slot、折叠、查询/重置、校验及插入/修改/删除演示）。组件设计与生成规则见 [SearchForm](../../../ai/plasmic/references/libraries/overseas/components/search-form.md)。

预览服务运行后，在仓库根目录执行 `node plasmicpkgs/overseas/preview/verify-search-form.mjs` 进行浏览器验收。使用 WAB 已安装的 Playwright，默认打开本机 Google Chrome；其它环境用 PLASMIC_BROWSER_PATH 指定 Chromium 可执行文件。截图保存至 `desktop/desktop-report/search-form/runtime.png`。

AppShell 已加入 Overseas 的 `registerAll()`，组件名为
`plasmic-overseas-app-shell`，分组为 `Application layouts`。
`section` 和 `thumbnailUrl` 让 Studio 插入面板显示静态预览卡片。本地构建的 SVG 预览来自 `src/componentThumbnails.ts` 生成的清单；平台发布时上传为独立内容哈希资源，模型和注册代码使用同一绝对 URL。
预览首页直接使用这份注册元数据；完整交互在交互预览页查看。

布局参考 pen-antd-kit 的 `standards/patterns/admin-app-shell.md`：
239px 侧栏、80px 折叠侧栏、64px 顶栏、16px 内容外边距。业务内容区域背景由页面决定。
每页使用同一个 AppShell，在 `Page body` 插槽中编辑业务内容。
AppShell 最外层自身设置 `width:100%`、`height:100vh`，注册默认尺寸与此一致。保留普通 Page 的默认根节点布局，不需要为祖先逐层设置高度。
Studio 画布开启「显示完整页面高度」时会注入 `--canvas-content-height:auto`，AppShell 随内容长高（最小为画板视口高度），内容区不再内部滚动；预览和导出中不存在该变量，行为不变。

预览服务运行后，在仓库根目录执行 `node plasmicpkgs/overseas/preview/verify-app-shell.mjs`，验证无父级高度、短视口、受限父容器、已有实例 CSS 和长内容滚动下的尺寸及操作可达性。浏览器路径规则同上。

配置项：

| 配置 | 用途 |
| --- | --- |
| `productName`、`logoUrl` | 产品品牌 |
| `userName`、`userMenuItems` | 用户名及用户操作菜单 |
| `languages`、`language` | 语言选项 `{value,label}` 和当前值 |
| `appSources`、`appSource` | 应用源选项 `{value,label}` 和当前值 |
| `menuItems`、`selectedMenuKey` | 嵌套菜单和 `href` 路由树；`hidden` 用于隐藏详情路由。当前 `pagePath` 自动推导选中项及所有父级面包屑；没有路由上下文时按选中 key 预览 |
| `collapsed` | 侧栏折叠状态 |
| `direction` | 独立于语言的 `ltr` / `rtl` 布局 |
| `timeZone`、`currentTime` | IANA 时区或外部提供的时间文本 |

语言、应用源、菜单、折叠和方向均注册可写状态及对应事件。
AppSource 选择器参照 fintechgrowthui 中 `@react/ui` 的显示效果：180px 选择框、8px 状态圆点、320px 下拉面板、当前应用标记和上下提示。中文/英文文案跟随 `language`。实现仅依赖现有 Ant Design 6；应用源数据和业务数据更新仍由 `appSources`、`appSource`、`onAppSourceChange` 管理，不访问 fintechgrowthui 的接口或缓存。
业务页通过事件处理切换、导航、翻译和用户操作；选择语言不会自动翻译业务内容。
本地示例按模板展示增长管理平台、四项菜单、PAKORA 应用源及空白业务内容插槽。面包屑由菜单树自动生成，菜单事件更新选中项，语言选项通过地球图标菜单选择。

### 自动面包屑

AppShell 读取 Plasmic `PageParamsProvider` 的 `pagePath`，在 `menuItems` 中递归匹配 `href`，显示产品名及完整父级链。父级带 `href` 时可点击；隐藏详情路由会选中侧栏中最近的可见父级。没有页面路由上下文的独立组件预览使用 `selectedMenuKey`。

```json
[
  {
    "key": "groups",
    "label": "客群列表",
    "href": "/req-075/groups",
    "children": [
      {
        "key": "detail",
        "label": "常规客群详情",
        "href": "/req-075/regular-detail",
        "hidden": true
      }
    ]
  }
]
```

以上配置在详情页自动显示「产品名 / 客群列表 / 常规客群详情」，详情不加入侧栏，不再配置独立的 `breadcrumbItems`。

注册代码随组件包构建。NAS 上的现有镜像需要经过正式发布更新，
才会包含新的 AppShell；本地预览不修改现有项目的 Host 配置或页面模型。
