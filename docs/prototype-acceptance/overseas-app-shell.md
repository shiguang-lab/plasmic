# Overseas AppShell 集成验收

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

REQ075 五个 PC 1920×1080 页面复用 Overseas AppShell。迁移通过桌面 MCP 完成，保留业务元素 UUID、状态和交互；原型业务仍使用演示数据。

本机证据目录：`desktop/desktop-report/req075-pc/`。`transcript.jsonl` 记录脱敏 MCP 调用；`appshell-migration-plan.json` 定义迁移前的 556 个业务节点和 30 个业务交互。

## MCP 持久化与画面检查

保存 revision **127**，重新加载桌面项目后读取五页，确认每页只有一个 `plasmic-overseas-app-shell` 实例，没有旧 Ant Design 6 AppShell；556 个业务节点和 30 个业务交互 UUID 全部保留。`validate` 返回 valid=true、错误 0、警告 0；共 199 个代码组件实例，其中 Ant Design 6 为 194，Overseas AppShell 为 5。

五个独立画布的实际根布局均为 **1920×1080**，文档高度 1080，AppShell 起点为 (0,0)。固定 PC 页面根容器使用 width=100%、minWidth=1920px、minHeight=maxHeight=1080px，避免外层主题容器中未确定的百分比宽度导致收缩。长内容在业务区内部滚动。

截图在确认目标业务元素 UUID 已渲染后获取，避免导航切换过程中抓到上一页。一次性详情实际为一次性类型及 5 个 Tab，常规详情为 6 个 Tab。

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

发布 tag **0.0.22**，源提交 `dea0069270125701867c3fe58eac92d6b3836ecf`，[GitHub Actions 37133787414](https://github.com/shiguang-lab/plasmic/actions/runs/37133787414) 的 server/web 任务成功。NAS 通过拉取 GHCR 镜像更新，并运行迁移及原生 hostless 组件库发布；没有挂载本地源码覆盖服务。

更新前备份：`/volume1/docker/plasmic/backups/pre-0.0.22-20261003-154130`，包含数据库、Compose、环境配置及 storage 文件。数据库约 249 MiB；环境配置仅本机用户可读。

- server 镜像 digest：`sha256:c5439bfdc867a9938799e5f5337a3e3dba3ffd05c1fe97eb64a7ff9e5c189502`。
- web 镜像 digest：`sha256:642bd21ed876319d8da7a5f07ee30ee21abbaab596044a98dc986bba15ef7a8e`。
- Overseas 发布项目 ID：`f3f4ju424PVNTAQPkwovrE`；Ant Design 6 发布项目 ID：`eYLujTHmWfX9qEoQaFDSi4`。

本机 Electron 包从正式 web 镜像提取静态资源后重建，包含 810 个本地资源，78.4 MiB，接口继续调用 NAS。`prepare-assets --from` 生成的 manifest revision 为 null，因此来源提交以 NAS 镜像 OCI 标签核对，不把 manifest 的空 revision 作为来源证明。

正式部署后 server/web/db/storage 四个容器均 healthy，server/web OCI revision 均为源提交 `dea0069270125701867c3fe58eac92d6b3836ecf`。项目通过 MCP 升级 Overseas 到原生组件库版本 0.1.0，保存 revision 127 后重新加载，五页的实例及业务节点验证通过。

正式桌面客户端的插入面板验收：

- Overseas → Application layouts → AppShell 以带图片的卡片显示，`overseas-insert-preview.png` 已保存。
- 搜索 AppShell 只返回 Overseas → Application layouts，旧 Ant Design 6 入口已隐藏；证据 `overseas-search-registration.txt`。
- Ant Design 6 分类标题实际显示，截图 `antd6-installed-groups.png`。

以上 UI 截图及注册搜索记录位于 `desktop/desktop-report/app-shell/`。最终客户端停留在客群列表画布，并打开 Overseas 插入面板供直接查看。
