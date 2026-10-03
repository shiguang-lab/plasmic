# REQ075 Desktop 正式交付验收

2026-10-04。[Studio 项目](https://plasmic.studio.publib.cn/projects/b1VPmGnbGvyKc4rnA2xLVv)。业务需求、页面路径及演示数据范围见 [REQ075 PC 原型验收](req075-pc.md)。

## 正式结构

- 5 个业务 Pages：客群列表、常规 SQL 建群、一次性 SQL 建群、常规详情、一次性详情；页面 UUID 和路由保持。
- 1 个总览 Arena：`REQ075 · Desktop`，引用这五个 Pages，画板按三上两下排列。
- 移除空 home、两张 MCP 测试页面、测试 Arena 和五个重复的逐页 Arena。
- 原生 Page 预览仅一个 Desktop 列，总览与 Page 画板均为 Studio 默认 **1440×1024**，移动端断点数为 0。
- 每页使用一个 Overseas AppShell；页面根高度固定，宽表和长内容在内部滚动。
- 顶部面包屑配置为产品名 → 菜单层级 → 当前页面；列表为两级，SQL 建群及详情为三级。

所有原型修改通过桌面 MCP 完成。MCP 补充了删除/重命名 Arena、调整画板、设置原生 Page 的 Desktop 预览列、删除断点能力，遵守原有编辑权限及撤销机制。

## 保存后验收

保存 revision **134**，重新启动桌面客户端并打开项目后，通过 MCP 读取模型、布局及截图：

- 556 个业务节点、8 个覆盖层和 30 个业务交互 UUID 全部保留。
- 5 个原生 Page 画板与 5 个总览画板均为 1440×1024。
- 五页实际渲染的文档高度为 1024，AppShell 从 (0,0) 填满画板。
- `validate` 为 valid=true，错误 0、警告 0；代码组件实例 199，其中 Ant Design 6 为 194、Overseas 为 5。
- 已逐页检查 MCP 截图：列表分页、SQL 底部操作栏可见，详情分别为六个/五个 Tab。宽表在内部横向滚动。

本次检查聚焦正式结构、Desktop 尺寸、业务 UUID 保留及五页默认画面；此前的 32 项运行交互证据不作为本次重新执行的结果。

证据目录：`desktop/desktop-report/req075-pc/`（本机忽略产物）。主要文件为 `formal-final-save.json`、`formal-reopened-overview.json`、`*-formal-reopened-model.json`、`formal-desktop-layout-checks.json`、`formal-reopened-validation.json` 和 `*-formal-visual-0.png`。面包屑修复证据为 `breadcrumb-fixed-save.json`、`breadcrumb-reopened-models.json`、`*-breadcrumb-layout-0.json` 和 `*-breadcrumb-visual-0.png`；重开后的五页 DOM 验证面包屑文字及顶部 64px 内的边界。MCP 脱敏调用记录为 `transcript.jsonl`。

## Skill 与验证

仓库 `skills/plasmic-prototype/` 与本机 `/Users/yanxianliang/.codex/skills/plasmic-prototype/` 已同步：PC 默认读取 Desktop preset；只交付业务 Pages 和一个总览 Arena；不生成移动端模式；移除测试产物；固定视口并内部滚动；保存后重开验证。独立管理页面必须配置 AppShell 面包屑，不在业务区重复绘制。 同尺寸多画板截图使用 `artboardElementUuid` 指定目标页面。

技能验证通过。WAB 原型操作测试 28 项、资源导出测试 9 项、桌面画板导出测试 6 项、MCP 配置及 RPC 测试 16 项通过。Overseas 注册测试及类型检查通过。WAB 全量类型检查仍有 9 项已有的 TopFrame、enterprise chat、OAuth session 错误，相关修改文件没有报错。

隐藏离屏窗口截图改为获取 Electron `paint` 位图，避免 `capturePage` 的 UnknownVizError；6 项测试及正式客户端五页截图通过。参照 [Electron 离屏渲染接口](https://www.electronjs.org/docs/latest/tutorial/offscreen-rendering)。

## 正式镜像部署

源提交 `545302ea1ea33de517fb8c3a54dead2de1706dbd`，tag **0.0.23**。[GitHub Actions 37158185194](https://github.com/shiguang-lab/plasmic/actions/runs/37158185194) 的 server/web 构建成功。NAS 从 GHCR 拉取镜像，执行迁移和原生 hostless 组件库发布，server/web/db/storage 均 healthy；没有本地源码挂载。

- server digest：`sha256:8dd86e78b8af8ec0efe25e2150edd8408ccb7840d9b982c6b297ba16e1d3602d`。
- web digest：`sha256:d38b7e804317709a1f132eda82c44b8c0a141bf5599ef1894ebb942cb360edd8`。
- 更新前备份：`/volume1/docker/plasmic/backups/pre-0.0.23-20261003-222205`，包含数据库、Compose、环境及 storage。
- Overseas 原生库版本 **0.2.0**，项目通过 MCP 升级。

本机 Electron 包内含来自正式 web 镜像的 810 个静态资源（78.4 MiB），API 继续调用 NAS。桌面 MCP 修复独立随客户端打包，未修改 NAS 镜像内容。桌面包位于 `desktop/dist/0.0.1/Plasmic Desktop-darwin-arm64/Plasmic Desktop.app`。
