# REQ075 PC 原型验收

2026-10-04。REQ075「海外客群管理平台」P0 的正式原型仅包含 PC，使用 Studio 默认 Desktop **1440×1024**。正式结构、持久化及截图验收见 [Desktop 交付验收](req075-desktop.md)。圈选、权限角色、名单和审计反馈使用演示数据；未连接业务 SQL 引擎、生产客群服务或真实导出任务。

## 输入与范围

需求：`/Users/yanxianliang/overseas/pd-atlas/03_迭代需求交付/01_业务需求/REQ075_客群管理平台P0需求/1.需求/REQ_海外客群管理平台.md`，v1.36。

产品设计：同目录 `海外客群管理平台.pen`，通过 Pen MCP 读取。原需求和设计保持不变。设计约定来自 `/Users/yanxianliang/overseas/pen-antd-kit/pen-prototype-platform/standards/` manifest 11.0.1，已吸收到仓库 `skills/plasmic-prototype/` 并安装到本机同名 skill。

采用最新具体条款：详情只读，列表承载管理动作；SQL 仅初始化/首次圈选失败可改，基本属性按 §5.2/6.4 可改。App TACO 从入口带入，不增加 App 筛选。采用用户指定的 Studio Desktop 默认尺寸，长表内部滚动。不加入 P1 AI/可视化条件/观测或 P2 标签画像/历史版本。

## 可编辑交付

[Studio 项目](https://plasmic.studio.publib.cn/projects/b1VPmGnbGvyKc4rnA2xLVv)，唯一总览画布 `REQ075 · Desktop`，包含以上业务 Pages 的引用。

| 页面 | 页面路径 | 组件 UUID |
| --- | --- | --- |
| 客群列表 | `/req-075/groups` | `Ne1KXZPJ2Up_` |
| 常规 SQL 建群 | `/req-075/regular` | `weebeeZgziPR` |
| 一次性 SQL 建群 | `/req-075/onetime` | `_m3gE-2H_x4K` |
| 常规详情 | `/req-075/regular-detail` | `ayKXc8e7JTsP` |
| 一次性详情 | `/req-075/onetime-detail` | `N5dvwSUWcJMa` |

全部生成、修改、保存均通过桌面 MCP 的 SDK/stdIO 调用完成。浏览器操作仅用于实际预览验收，没有使用浏览器脚本修改设计模型。交付中已移除空 home、MCP 测试页面及重复的逐页 Arena；仅保留 5 个业务 Pages 和 1 个总览 Arena，不包含移动端断点。

## 验收结果

当前使用独立 Overseas AppShell，MCP 保存 revision **134**。重新启动客户端并打开项目后读取五页：556 个业务节点、8 个覆盖层及 30 个业务交互 UUID 全部保留；每页复用一个 Overseas AppShell。`validate` 返回 `valid: true`，5 个业务页面，199 个代码组件实例（Ant Design 6 为 194、Overseas 为 5），错误 0、警告 0。

原生 Page 预览和总览中的 5 个画板均为 **1440×1024**，没有移动断点。五页实际渲染的文档高度均为 1024，AppShell 从 (0,0) 填满画板。宽表在内部横向滚动，分页及 SQL 页面底部操作保留在视口内。

业务 P0 在 AppShell 迁移前已执行并保留 **32 项真实预览交互**证据；本次迁移保留其模型与交互，并额外回归壳层菜单、角色和 SQL 校验。原业务验收覆盖：

- 草稿/应用筛选分离、ID 查询、重置、全部/我负责的、第二页、50 条切换回第一页。
- 名称修改、停用、初始化删除、管理员/运营/只读权限，管理员导出成功反馈。
- 未校验禁止提交、DELETE 校验失败、预跑中/失败/成功、失败禁止保存、成功 Top100 全字段脱敏。
- 常规保存返回初始化、上线转圈选中；新客群人数 0、没有旧快照、成员空、圈选记录处理中 0。
- 一次性名称必填、Key 重复禁用继续、基本信息传递、默认 14 天/最多 365 天、上线返回列表。
- 基本属性保留 30 天与截止 19:30:00 传递到只读详情；常规 6 个 Tab，一次性 5 个 Tab，无观测/管理按钮。
- 脱敏成员第二页、完整 12,340 人/617 页到末页、只读应用记录、圈选失败记录保留人数 0 和失败原因。

MCP 已读取布局、模型和截图。编辑模式的空槽占位会影响 Badge 的显示，真实预览为正常 7px 状态点；最终列表图片取自桌面运行预览的 MCP 截图。预跑 Modal 及详情的实际运行截图也已保存。

## 能力补充与发布

补充 Antd6 Table 的 size、pagination、scroll、onChange 和列 width/ellipsis 注册契约。执行依赖构建成功、6 项注册测试通过、类型检查通过。发布提交 `30dee0af261f6117adcf5ce20f2d335d99c199bd`，tag `0.0.12`，[Actions 37121503821](https://github.com/shiguang-lab/plasmic/actions/runs/37121503821) 成功，GHCR 镜像随后部署 NAS。通过官方 hostless 发布流程更新 Antd6 库，并配置自动升级。

当前壳层部署与镜像版本、构建结果见 [Overseas AppShell 验收](overseas-app-shell.md)。

## 本机证据

目录：`/Users/yanxianliang/shiguang/plasmic/desktop/desktop-report/req075-pc/`（忽略的本地验收产物）。

- `plan.json`：输入、范围、规范取舍、规范化路径和画布 UUID。
- `transcript.jsonl`：脱敏 MCP 调用记录，包含失败尝试及后续成功修正。
- `accepted-validation.json`、`*-accepted-model.json`：重开后的模型验证。
- `formal-final-save.json`：Desktop 整理 revision 133；面包屑修复保存在 `breadcrumb-fixed-save.json`，revision 134。
- `formal-reopened-overview.json`、`*-formal-reopened-model.json`、`formal-reopened-validation.json`：正式交付重开后的结构、业务 UUID 与校验。
- `formal-desktop-layout-checks.json`、`*-formal-visual-0.png`：正式交付五页的布局及 MCP 截图，1440×1024。
- `overseas-list-runtime-final-0.png`：此前 1920×1080 壳层运行预览截图。
- `layout-checks.json`：按页面根 UUID 匹配尺寸与滚动诊断。
- `preview-acceptance.json`：32 项实际交互证据。
- `list-runtime-screenshot-0.png`：原业务验收运行预览 MCP 截图，1920×1080。
- `preflight-running-final.jpg`、`preflight-failed.jpg`、`preflight-success.jpg`、`members-last-page.jpg`：关键状态与长分页截图。

这是原型生成和更新流程验收，不代表业务后端 SQL、导出或生产权限服务已经上线。
