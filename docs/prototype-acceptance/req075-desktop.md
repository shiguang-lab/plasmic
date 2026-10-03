# REQ075 Desktop 正式交付验收

2026-10-04。[Studio 项目](https://plasmic.studio.publib.cn/projects/b1VPmGnbGvyKc4rnA2xLVv)。业务需求、页面路径及演示数据范围见 [REQ075 PC 原型验收](req075-pc.md)。

## 正式结构

- 5 个业务 Pages：客群列表、常规 SQL 建群、一次性 SQL 建群、常规详情、一次性详情；页面 UUID 和路由保持。
- 1 个总览 Arena：`REQ075 · Desktop`，引用这五个 Pages，画板按三上两下排列。
- 移除空 home、两张 MCP 测试页面、测试 Arena 和五个重复的逐页 Arena。
- 原生 Page 预览仅一个 Desktop 列，总览与 Page 画板均为 Studio 默认 **1440×1024**，移动端断点数为 0。
- 每页使用一个 Overseas AppShell；页面根高度固定，宽表和长内容在内部滚动。
- 顶部面包屑由当前 `pagePath` 匹配 `menuItems` 的完整树，自动显示产品名 → 父级菜单 → 当前页面；列表为两级，SQL 建群及详情为三级。隐藏的详情路由保留在菜单树中，不显示为侧栏菜单项。

所有原型修改通过桌面 MCP 完成。MCP 补充了删除/重命名 Arena、调整画板、设置原生 Page 的 Desktop 预览列、删除断点能力，遵守原有编辑权限及撤销机制。

## 保存后验收

保存 revision **139**，重新启动桌面客户端并打开项目后，通过 MCP 读取模型、布局及截图：

- 556 个业务节点、8 个覆盖层和 30 个业务交互 UUID 全部保留。
- 5 个原生 Page 画板与 5 个总览画板均为 1440×1024。
- 五页实际渲染的文档高度为 1024，AppShell 从 (0,0) 填满画板。
- `validate` 为 valid=true，错误 0、警告 0；代码组件实例 199，其中 Ant Design 6 为 194、Overseas 为 5。
- 已逐页检查 MCP 截图：列表分页、SQL 底部操作栏可见，详情分别为六个/五个 Tab。宽表在内部横向滚动。

本次检查聚焦正式结构、Desktop 尺寸、业务 UUID 保留及五页默认画面；此前的 32 项运行交互证据不作为本次重新执行的结果。

证据目录：`desktop/desktop-report/req075-pc/`（本机忽略产物）。`route-migration-save.json` 保存 revision 139；`route-appshell-contracts.json` 与 `route-breadcrumb-reopened-models.json` 确认两套 AppShell 契约及五页实例均已删除 `breadcrumbItems`。`*-route-breadcrumb-layout-0.json`、`*-route-breadcrumb-visual-0.png` 验证父级链、当前页面、侧栏选中和顶部边界。`formal-reopened-overview.json`、`*-formal-reopened-model.json`、`formal-desktop-layout-checks.json` 与 `formal-reopened-validation.json` 验证正式结构和业务 UUID。MCP 脱敏调用记录为 `transcript.jsonl`。

## Skill 与验证

仓库 `skills/plasmic-prototype/` 与本机 `/Users/yanxianliang/.codex/skills/plasmic-prototype/` 已同步：PC 默认读取 Desktop preset；只交付业务 Pages 和一个总览 Arena；不生成移动端模式；移除测试产物；固定视口并内部滚动；保存后重开验证。独立管理页面使用包含父级与隐藏子路由的完整菜单树，面包屑由 AppShell 自动推导，不传页面级面包屑数组。相同尺寸的多画板截图使用 `artboardElementUuid` 指定目标页面。

本次 Overseas 的 2 项测试、类型检查与构建通过，原生组件库升级的 12 项测试通过，覆盖删除旧参数同时保留其它参数。Ant Design 6 类型检查与 12 项测试通过。Skill 验证通过。WAB 全量类型检查有 10 项既有错误，修改文件没有报错，不能视为全量类型检查通过。

隐藏离屏窗口截图改为获取 Electron `paint` 位图，避免 `capturePage` 的 UnknownVizError；6 项测试及正式客户端五页截图通过。参照 [Electron 离屏渲染接口](https://www.electronjs.org/docs/latest/tutorial/offscreen-rendering)。

## 正式镜像部署

源提交 `e89cb815ba92ee6ae7bcb38b60a6d79f3ffb9939`，tag **0.0.26**。[GitHub Actions 37161509931](https://github.com/shiguang-lab/plasmic/actions/runs/37161509931) 的 server/web 构建成功。NAS 从 GHCR 拉取镜像，执行数据库迁移和原生 hostless 组件库发布，server/web/db/storage 均 healthy；没有本地源码挂载。

- server digest：`sha256:d03471299c52c58d2c4481bededdd0d8db30e8b6a8d46286dfa96b29f8d18c4b`。
- web digest：`sha256:a55faf0f398d8535c2aa422678a17e24ee1f7e53ce35d1745ee3a637870dc619`。
- 更新前备份：`/volume1/docker/plasmic/backups/pre-0.0.26-20261003-232202`，包含数据库、Compose、环境及 storage。
- Overseas 原生库从 **0.2.0** 升级到 **1.0.0**，Ant Design 6 原生库为 **1.0.0**，项目通过 MCP 确认使用最新版本。

发布迁移仅允许两套 AppShell 删除 `breadcrumbItems`，并断言参数确实已删除；其它组件、参数和插槽继续遵守原生发布约束。升级已有项目时原生组件库升级流程会清除旧实例参数。该字段已从组件接口及注册契约移除。

本机 Electron 包内含来自正式 web 镜像的 810 个静态资源（78.4 MiB），API 继续调用 NAS。桌面包位于 `desktop/dist/0.0.1/Plasmic Desktop-darwin-arm64/Plasmic Desktop.app`。
