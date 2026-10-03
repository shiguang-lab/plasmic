# AppShell 本地预览

运行 `pnpm --filter @shiguang-lab/plasmic-overseas preview:app-shell`。

- 缩略图卡片：<http://127.0.0.1:3106/>
- 交互预览：<http://127.0.0.1:3106/?preview>
- Plasmic 本地组件 Host：<http://127.0.0.1:3106/?host>

AppShell 已加入 Overseas 的 `registerAll()`，组件名为
`plasmic-overseas-app-shell`，分组为 `Application layouts`。
`section` 和内嵌 `thumbnailUrl` 让 Studio 插入面板显示静态预览卡片。
预览首页直接使用这份注册元数据；完整交互在交互预览页查看。

布局参考 pen-antd-kit 的 `standards/patterns/admin-app-shell.md`：
239px 侧栏、80px 折叠侧栏、64px 顶栏、16px 内容外边距、白色内容区域。
每页使用同一个 AppShell，在 `Page body` 插槽中编辑业务内容。

配置项：

| 配置 | 用途 |
| --- | --- |
| `productName`、`logoUrl` | 产品品牌 |
| `breadcrumbItems` | 可选顶栏路径 `{title}`；未配置时不占位 |
| `userName`、`userMenuItems` | 用户名及用户操作菜单 |
| `languages`、`language` | 语言选项 `{value,label}` 和当前值 |
| `appSources`、`appSource` | 应用源选项 `{value,label}` 和当前值 |
| `menuItems`、`selectedMenuKey` | 支持嵌套菜单、`href` 页面路由及选中项 |
| `collapsed` | 侧栏折叠状态 |
| `direction` | 独立于语言的 `ltr` / `rtl` 布局 |
| `timeZone`、`currentTime` | IANA 时区或外部提供的时间文本 |

语言、应用源、菜单、折叠和方向均注册可写状态及对应事件。
AppSource 选择器参照 fintechgrowthui 中 `@react/ui` 的显示效果：180px 选择框、8px 状态圆点、320px 下拉面板、当前应用标记和上下提示。中文/英文文案跟随 `language`。实现仅依赖现有 Ant Design 6；应用源数据和业务数据更新仍由 `appSources`、`appSource`、`onAppSourceChange` 管理，不访问 fintechgrowthui 的接口或缓存。
业务页通过事件处理切换、导航、翻译和用户操作；选择语言不会自动翻译业务内容。
本地示例按模板展示增长管理平台、四项菜单、PAKORA 应用源及空白业务内容插槽。菜单事件更新顶栏路径，语言选项通过地球图标菜单选择。

注册代码随组件包构建。NAS 上的现有镜像需要经过正式发布更新，
才会包含新的 AppShell；本地预览不修改现有项目的 Host 配置或页面模型。
