# REQ075 Gemini 3.8 Flash 全链路测试 — 2026-10-19

**结论：模板驱动的 P0 业务生成验收失败；可编辑模型创建、返回体预算、后台截图及独立保存重开可用。** 不能把“结构检查通过”汇报成完整业务验收通过。没有发布 Desktop、skill 资源或原型，也没有手工补齐业务内容来掩盖本轮结果。

## 提示词、环境与范围

使用用户提供的五行模板，填入「REQ075 海外客群管理平台 P0」、数禾组织、海外 workspace 下新建项目、原始 REQ/P0 PRD、业务说明 HTML 和原始 .pen。HTML 是业务内容说明，界面参考为 .pen。[实际提示词](../../../desktop/desktop-report/mcp-budget-20261019/template-prompt.txt)。

| 项目 | 实际值 |
| --- | --- |
| 执行器 / 模型 | Gemini App 中 Antigravity；界面确认 Gemini 3.8 Flash High |
| 界面运行时长 | 31 分钟 |
| Conversation | `541c8d56-858d-40b3-b7e0-1504a3a8cf51` |
| 组织 | 数禾 `1SggWCFqHbS4RipBHnqVqY` |
| 新建 workspace | 海外 `uy3veTP81SUayBzinXxbjx` |
| 新建项目 | REQ075 全链路模板回归 Gemini38Flash 20261019，`7CLpNFKYKnkNvNK1ENMCsF` |
| 候选资源 | version 0.1.4；release `3daef1a1641441eb3f3efa535ae15fb733acdb826c6477ee3c915d2c8faf6535`；CLI 0.1.1 |
| Desktop | 0.1.17，本地构建；具体 source/renderer/desktop fingerprints 保留在 capture.json |

Plasmic bootstrap SKILL.md 保持原样。隔离工作目录的 AGENTS 指定候选本地 feed/cache 及不改其他业务项目、不复用历史生成物等测试约束；生产资源打包、下载和哈希校验均真实执行。线上已发布 bundle 仍是旧协议，所以本轮证明的是本地候选资源和本机 MCP 的组合，不是线上发布验收。执行目录为 `/tmp/plasmic-req075-template-20261019`，原始输出已复制至 [template-output](../../../desktop/desktop-report/mcp-budget-20261019/template-output)。

## 链路结果

| 阶段 | 实际结果 | 判断 |
| --- | --- | --- |
| 目标定位与创建 | 正确解析数禾；海外原先不存在；创建 workspace、正确父级的新项目并打开 | 通过 |
| 资源与依赖 | bootstrap 和候选资源校验通过；Admin Templates 的 Antd6 1.12.0 依赖与目标 1.18.0 冲突 | 模板导入失败，不能声称导入成功 |
| 结构生成 | 四条 `/audiences` 路由、原生注册组件和可编辑节点存在 | 结构存在，业务不完整 |
| 输入与纠错 | 观测到 8 次 MCP 错误：模板依赖、execute envelope、Slot/Prop、queryData literal、query/read/get_app_state 参数等 | 额外回合与整页重发 |
| 自动化报告 | evidence、structure、forms、descriptions、overlays、shell_height 通过；slots 被模型自行设为 N/A | 不等于“六项门禁全部通过”；该 N/A 不满足本任务的适用性条件 |
| 后台静态截图 | 四张成功，单次 711–828ms；无超时 | 本轮未复现超时，不证明历史超时已修复 |
| 实际 Preview | 独立复核列表与常规 SQL；SQL 在 1440×1024、1440×720 检查；非法 SQL 校验/预跑和新建入口无反馈 | 失败 |
| 保存与真正重开 | 独立 MCP save 得到 revision 20 / saved=true；退出至 workspace 后进入新 editor session；完整四页模型相同 | 持久化通过，保存的是尚不符合业务的模型 |

[模型原报告](../../../desktop/desktop-report/mcp-budget-20261019/template-output/final-report.md)宣称业务通过，但它的 [自动化报告](../../../desktop/desktop-report/mcp-budget-20261019/template-output/verification-run-1/report.json) 明确排除 source interpretation、Preview interactions/scrolling、save/reopen persistence，且 Slot 检查被豁免。不能采信其“整体完成”的结论。

独立保存前 session 为 `PJmsg2qKkPW2`，真正重开后为 `hRHNAcA5ecvu`，revision 均为 20；完整模型 canonical SHA-256 相同。[持久化证据](../../../desktop/desktop-report/mcp-budget-20261019/independent-persistence.json)。`changeCounter` 是会话内的编辑计数，不能据其非零推断未保存；保存前为 19，新 session 为 0。

## 实际缺陷与优化优先级

| 优先级 | 问题与证据 | 可行方案 / 能力边界 |
| --- | --- | --- |
| P0 | 四页 `interactions=[]`，节点 props 无 onX handler；实际非法 SQL 校验、提交预跑、新建入口均无反馈 | 依据需求冻结业务动作和断言，逐区完成 State/Event 再验收。静态存在按钮不能算功能完成。 |
| P0 | 四个 Form 均未设置 advanced mode，运行时显示默认 Name / Message / Submit；当前 Form gate 仍按 children 中隐藏的字段判通过 | 在注册契约/示例中写清模式；Form gate 必须核对有效模式与真实字段来源。源码：`registerForm.tsx` 默认 simplified，`SchemaForm.tsx` 简化模式渲染 formItems；`verify_forms.py` 当前直接扫描 children。不能降低字段要求。 |
| P0 | 七个 Table 都没有 data；列表显示“共4个”却 No data，分页为 10 而非需求默认20/50/100；角色/App 隔离没有业务绑定 | 保留真实 queryData 类型，给出 `{data: ...}` 原生表达式绑定实例，实际校验行与总量、角色/App 及分页。不用删除 data 来消除输入错误。 |
| P0 | 模型自行编写验收清单、豁免 Slot、将未检查的运行时/重开汇报为通过 | 独立源需求清单和业务断言作为判定依据；输出 passed/failed/unverified 与覆盖范围。完整任务不得自行免除 Slot；notChecked 不可折算为通过。 |
| P1 | Select.placeholder、Card/Drawer/Modal.title、Form.Item.label 被当作普通 prop；Table.data literal 报 unsupported queryData；因此重发大片 HTML | 写入前批量读取实际用到的组件完整 contract，明确 Slot 与复杂数据类型，分区插入。现有动态表达式路径可用；如扩展 literal，须实现真实类型，不能改为 any 或忽略错误。 |
| P1 | MCP 外层 `{name,input}` 与原生输入混淆，随后出现 componentId、外层 depth、错误 get_app_state/query 参数 | 保持严格校验；错误应列工具名、具体错误字段和短的正确 envelope 示例。不增加自动猜测/兼容解析。 |
| P1 | Admin Templates 依赖 Antd6 1.12.0，目标先安装1.18.0 | 安装前核对模板真实依赖，配套发布和验收。参考重建与真正模板导入要分别报告，不把版本冲突当成返回体问题。 |
| P1 | importedProjects 一页仍嵌套依赖的完整组件/Token 等清单；旧四页只读回放为131,199 bytes、29次发现/引用调用 | 默认依赖身份/版本/计数；按依赖、名称/类型查询与分页资源，再按 UUID 读取完整 contract。full 保留，避免纯分页遍历整个资源树。 |
| P1 | 原生50操作完整 get_app_state 为96,683 bytes；50个 inputSchema 值合计48,685 bytes（不含包装）。所选10操作46,175 bytes，其中原生 executeBatch 定义25,110 bytes | MCP execute_batch 已有批次结构，只另取本批使用的操作契约，避免读取包含所有操作的原生 batch union；可评估输入/完整 schema 分层。不能删所用操作的必要约束。 |
| P1 | 创建4页、4次根样式是8次单调用；主 trace 未使用 execute_batch；createState/copyElement 描述仍说返回完整 component | 直接使用已有 as/$name/$name.root 批次机制并读取实际 created IDs；同步旧描述。当前机制无需新模型即可减少回合。 |
| P1 | 默认演示内容仍在：Card title、Alert title/description、Show modal；详情保留源需求禁止的编辑/刷新/导出按钮；App 为 PAKORA、说明却固定 TACO；模型保留414×736手机画板，未配置要求的PC尺寸 | 保留 Slot gate，核对 source-derived 页/字段/动作与实际 Preview；清除未用默认 Slot，配置实际 App 与视口，不只替换文字标签。 |
| P1 | 静态图为1366×900，sourceViewport却1366×768，resized=false | `desktop/src/canvas.cjs:339` 离屏窗口初始固定900；未给height时从该窗口测contentHeight，100vh随之改变。先保持源画板视口再裁取/压缩，不能把输出像素或2048上限当成CSS视口。 |
| P2 | 单次有64KiB上限，任务仍触发1次 compaction；完整数据转引用后再全部拉回依然进入上下文 | 按页/区批量选择节点、contract/context；保留完整证据本地，读精确失败项。阶段账本保留需求、IDs、构建/会话、契约和未验收项，压缩后定点复读。 |
| P2 | 主代理只记录到64个相关MCP调用；脚本/本地RPC、文件读取、shell stdout未全量记录；总token不能准确归因于某个工具 | 下一轮在客户端或RPC入口同时记录所有工具返回与原始调用，关联请求级 usage/峰值；不得把64当成全链路调用总数。 |

原生模型和完整读取能力仍保留；本轮不能推出“只是增加工具调用，不影响生成”。真实问题还包括输入复杂度、契约发现、默认组件运行模式、模型遗漏事件/数据，以及验收结论失真。

## 主测试的实际 token 与体积

| 指标 | 实测值 |
| --- | ---: |
| 累计 input（已含 cache） | 22,631,005 tokens |
| 其中 cached input | 21,768,219 tokens |
| input减cache | 862,786 tokens |
| 内容/工具参数输出 candidates | 83,796 tokens |
| thoughts | 71,136 tokens |
| 输出合计 candidates + thoughts | 154,932 tokens |
| 记录到的 compaction | 1 |
| 单请求上下文峰值（后续只读 transcript 复核） | 239,715 tokens；206 次 provider 请求 |
| 客户端压缩阈值 / 实际账单 | unavailable |
| 关联到该conversation的MCP调用 | 64，8次错误；这是已捕获子集 |
| 这些MCP的arguments | 80,850 bytes |
| 这些MCP的text输出合计 | 200,577 bytes |
| 这些MCP的decoded image合计 | 148,014 bytes |
| 这些MCP的wire响应合计 | 429,862 bytes |
| 最大普通JSON回包（含JSON-RPC包装） | 51,677 bytes |
| 最大含图wire回包 | 60,174 bytes |

[usage副本采样](../../../desktop/desktop-report/mcp-budget-20261019/) 和 [MCP汇总](../../../desktop/desktop-report/mcp-budget-20261019/template-mcp-summary.json) 保留原始证据。主模型自然结束后没有再发送纠错提示，独立复核不计入这组模型 usage。完整输入包含其他工具/资料及客户端指令，不能把它全部归因于MCP的200KB文字返回。

**本样本确实发生了上下文压缩，未观察到显式 context_length_exceeded。** 累计输入2263万不是当前窗口2263万。Gemini 3.8 Flash 的API输入上限为1,048,576，但不能据此假定Antigravity会等到该阈值才压缩；也不能把缓存命中当成不占上下文。[官方模型说明](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash)。这只是一个需求在一个模型/客户端上的测试，不能外推所有Flash模型。

## 只读 MCP 回放（与主测试分离）

73 次真实 MCP，四页原项目 editorContext 前后相同。无普通 JSON 超过 64KiB，完整值经 ResultReference/read_result 可恢复。

| 场景 | 实测 |
| --- | ---: |
| 项目概要 | 298 bytes text |
| 四页浅读合计 | 2,844 bytes text |
| 四页节点身份合计 | 5,926 bytes text |
| 四页完整模型 | 275,523 bytes；24 次恢复调用；回包 text 合计 280,502 bytes |
| 导入资源 | 131,199 bytes；29 次发现/恢复调用；text 合计 153,750 bytes |
| 五个组件 contract | 15,656 bytes text |
| 四页 layout summary | 1,685 bytes text |
| 1440×1024 截图 | WebP 91,396 bytes，image block 加 base64 wire 共 122,201 bytes；text 201 bytes；未放大 |
| MCP tools/list | 29 tools，21,359 bytes |

图片不在 JSON 64KiB 上限内。WebP 不保证任何内容都小于 100KB；编码体积也不等于视觉 token。native image block 与把 base64 打印到 text 的情形必须区分。

## 真实模型的受控文字探针（不是整轮质量验收）

同模型、相同指令模板、独立 CLI 会话，空 DATA 基线 input=14,395、cache=0。下列是 provider usage 相对基线的差值，不能冒充纯 tokenizer API 或主测试峰值。

| DATA | UTF-8 bytes | input 差值 |
| --- | ---: | ---: |
| 项目概要 | 298 | 86 |
| 10 个所选完整 schema | 46,175 | 11,504 |
| 四页完整模型 | 275,523 | 60,726 |

导入资源探针两次返回空正文、零 duration/usage，即使 CLI status 为 SUCCESS 也不记为有效测量；标记 unavailable。

## 计数口径

- MCP JSON-RPC 原始请求/响应按 UTF-8 计 bytes；text 与解码后 image 分列。按 conversation_id 过滤，同一缓存 stdio server 可被多会话复用，不能按 PID 归属。
- 只读 SQLite online backup 包括已提交 WAL；官方 Google Antigravity SDK 只打开副本、不发 chat，读取 persisted total_usage。已用独立 CLI 控制对照验证：14,381 input + 1 visible + 60 thoughts = 14,442 total。
- prompt_token_count 已含 cached_content_token_count；两者不能相加。candidates 与 thoughts 分列，CLI output_tokens 则包含二者。
- 累计 input 不是当前上下文。后续从客户端 transcript 的 input_tokens（不含 cache）与 cache_read_tokens 相加取得每请求 prompt；206 次合计与 SDK 完全一致，峰值239,715。未获得客户端压缩阈值，保持 unavailable。COMPACTION 事件不等于 context_length_exceeded，也不足以证明后来错误由压缩导致。
- 不根据这些计数计算 Antigravity 实际账单或所有 Flash 模型的稳定性。

## 本次校正与验证

- 修正旧 fixture/replay 读取 compact created receipt，并显式收集 full/depth=all；真实fixture生成与编辑回放各1项通过。
- 清除 local-edit 指令中“不支持同批新ID”的矛盾；相关 Studio 两个测试文件23项通过。
- MCP结果/图片/模型契约相关7项通过；资源生产打包执行151个Python测试并通过哈希校验。
- REQ075 forms inventory 从旧UUID改为同路由定位，字段/规则未改；使用正确原项目身份回放历史完整证据，evidence + 六项gate通过。故意传入错误项目身份被拒绝。历史通过不是本轮业务通过。
- 第一轮辅助排障曾复用历史intent并出现未close的MCP脚本；其业务验收失败，不作主测试的生成成功证据。
- 独立复核只保存、真正重开、检查完整模型、执行Preview和截图，没有修复业务模型。临时全局MCP接入和本地feed在测试结束后恢复/停止；新测试项目保留。

[独立观察](../../../desktop/desktop-report/mcp-budget-20261019/independent-observations.json)、[保存重开证据](../../../desktop/desktop-report/mcp-budget-20261019/independent-persistence.json)、[原报告与截图](../../../desktop/desktop-report/mcp-budget-20261019/template-output)。
