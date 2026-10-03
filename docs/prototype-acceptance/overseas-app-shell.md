# Overseas AppShell 集成验收

当前正式交付使用 Desktop 1440×1024、一个总览 Arena 和五个业务 Pages，见 [Desktop 交付验收](req075-desktop.md)。本文运行交互证据来自此前的壳层集成验收。

## 注册与使用

`plasmicpkgs/overseas` 是独立的 Overseas 业务组件库。`registerAll()` 注册 `plasmic-overseas-app-shell`，画布入口是 `platform/canvas-packages/src/overseas.ts`。NAS 的 `deploy/nas-antd6.ts` 通过原生 hostless 发布流程建立组件库和组件商店入口。

Studio 插入面板中，Overseas 与 Ant Design 6 是两个独立库。AppShell 位于 Overseas 的 Application layouts 分组，缩略图随注册信息内置；Ant Design 6 根据组件注册的 section 分类。

AppShell 支持产品名、Logo、用户名、时区、面包屑、语言列表、App Source 列表、菜单、用户操作和折叠状态。菜单的 href 使用 Plasmic Link；页面业务内容放入 children 插槽。展开侧栏 239px、折叠侧栏 80px、顶部 64px、业务区外间距 16px。

已发布的 Ant Design 6 AppShell 契约不能被原生 hostless 发布器删除，因此旧注册仅转发到同一实现，并在插入面板隐藏。新页面使用 Overseas 注册。

## 实现检查

- Overseas：1 项注册测试、类型检查、Rollup 与声明构建通过。
- Ant Design 6：12 项注册测试、类型检查与 Rollup 构建通过。
- 生产依赖构建 `pnpm --filter @shiguang-lab/plasmic-antd6... build` 通过。
- WAB MCP 与插入面板分组：29 项测试通过。
- 桌面 MCP 集成与本地 RPC：16 项测试通过。
- `tools/clean-svg.ts` 通过，Overseas 图标符合根分组和像素尺寸约定。
- `mkCodeComponent` 缩略图元数据回归测试通过（1 项），确保 section 不会覆盖 thumbnailUrl。
- WAB 全量类型检查仍存在已有的 TopFrame、enterprise chat 和 OAuth session 类型错误；相关 MCP、分组和插入面板文件没有报错。

## 原型回归范围

REQ075 五个 PC Desktop 1440×1024 页面复用 Overseas AppShell。迁移通过桌面 MCP 完成，保留业务元素 UUID、状态和交互；原型业务仍使用演示数据。

本机证据目录：`desktop/desktop-report/req075-pc/`。`transcript.jsonl` 记录脱敏 MCP 调用；`appshell-migration-plan.json` 定义迁移前的 556 个业务节点和 30 个业务交互。

## MCP 持久化与画面检查

当前保存 revision **134**。重新启动客户端并打开项目后，确认每页只有一个 Overseas AppShell，556 个业务节点、8 个覆盖层和 30 个业务交互 UUID 保留。模型校验错误 0、警告 0，共 199 个代码组件实例，其中 Ant Design 6 为 194，Overseas 为 5。

唯一总览 `REQ075 · Desktop` 引用这五个业务 Pages；原生 Page 预览只有 Desktop 列，画板和实际文档均为 1440×1024，没有移动端断点。页面根容器为 width=100%、minWidth=1440px、height=minHeight=maxHeight=1024px，长内容内部滚动。

## 实际运行预览回归

以下操作在桌面完整运行预览中执行：

- 侧栏展开/折叠正常，折叠时 snapshot_layout 实测 aside 宽度 80px。
- 语言菜单有简体中文与 English，选择后按钮 title 更新；RTL 切换后按钮变为“切换为 LTR”，恢复默认正常。语言配置表示壳层选择状态，不代表业务内容自动翻译。
- App Source 下拉显示配置的 TACO · 墨西哥。
- 用户菜单切换只读访客后隐藏新建和编辑操作；恢复管理员后新建操作恢复。
- SQL 圈选器菜单进入常规 SQL 建群，客群列表菜单返回列表。
- SQL 校验前提交禁用，校验成功显示结果集包含 uid + app_source，并解锁提交。

运行截图 `overseas-list-runtime-final-0.png` 通过 MCP 获取，尺寸 1920×1080。运行验证文本位于 `desktop/desktop-report/app-shell/overseas-*-runtime.txt`。

## 正式发布

当前 NAS 镜像 tag **0.0.23**、Overseas 原生库版本 **0.2.0**。AppSource 的 180px 选择器、320px 下拉面板、状态点、当前标记与中英文提示参照 fintechgrowthui 的效果实现，没有引入 @react/ui。Desktop 静态资源来自正式 web 镜像，API 调用 NAS。发布来源、备份与验收详见 [Desktop 交付验收](req075-desktop.md)。

组件插入预览已检查 Overseas → Application layouts → AppShell 图片卡片，以及 Ant Design 6 分组；对应证据位于本机 `desktop/desktop-report/app-shell/overseas-insert-preview.png` 和 `antd6-installed-groups.png`。
