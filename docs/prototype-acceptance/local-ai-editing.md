# Web AI 编辑验收

## 登录态保存、重开和撤销

2026-10-12 在已登录的 Chrome Web 中，使用内置 AI 对话和真实服务模型 `gemini-3.8-flash` 验收。项目为 [AI Web Acceptance 20261012](https://studio.plasmic.shiguanglab.com/projects/f1Z6sEJ9WnC7QuDScTMQ8E)，页面 `LocalEditAcceptance`。

- AI 修改标题并确认保存 revision 6；重开后文本为 `Saved Web Acceptance`。
- 重开后再次修改并确认保存 revision 7；通过 AI 修改记录撤销，确认保存 revision 8。
- 再次重开后文本恢复为 `Saved Web Acceptance`，节点 UUID 保持不变。

证据：[实际工具结果及读回记录](local-ai-editing/web-authenticated-verification.json)、[撤销后的 Web 截图](local-ai-editing/web-authenticated-undo.png)。此前 `verification.json` 的浏览器夹具结果保留，仅代表早期受控测试。

## 整页生成执行契约

内置 AI 与 App MCP 共用画布活动反馈。实际读写扫描从活动开始至少播放 1.6 秒，超过该时长的操作在完成时结束动画；动画结束后静态结果保留 0.4 秒。工具完成或失败状态立即更新，动画展示不延迟工具返回、模型下一步、Studio 事务或保存。Studio 关闭时清理所有活动定时器，减少动态效果的系统偏好仍禁用动画。

本地 Web 的真实只读任务确认：工具已完成时画布仍播放扫描，随后扫描区域自动消失；停止后修改记录为零。读写成功、失败、长操作、连续调用和清理的 2 个测试文件共 16 项通过，完整 WAB 类型检查与相关文件 ESLint 通过。证据见 [扫描验证记录](ai-existing-page-editing/minimum-scan-web.json) 与 [Web 扫描截图](ai-existing-page-editing/minimum-scan-web.jpg)。

内置对话使用统一输入区，无需选择编辑或生成模式。启用新页生成时，服务端模型先从用户描述判断目标；当前页修改和模糊意图默认编辑当前范围，明确请求独立新页时生成英文 PascalCase 页面名称与路由。意图结果经过结构校验后，通过 Studio 的原生 createComponent 创建一个新页面，再将工具执行绑定到该页面。意图判断支持停止，尚未确定目标时不执行设计修改。模型不能创建第二个页面、安装库、修改全局资源或发布项目。

已有页编辑和新页生成共用原生节点修改、插入、删除、复制、移动及交互创建、修改和删除工具。已有事件步骤按实际 UUID 更新，保留事件参数和步骤身份；节点读回包含所属子树的事件步骤。已有页未聚焦画布时，从当前页面工作区获取页面绑定。选区任务只允许修改选区子树，状态增删改与 viewport 修改要求绑定整个组件。两种模式都能读取已安装库的组件和模板契约，不能修改导入组件或读取其他本地页面的完整模型。所有模型修改通过 Studio 的事务、范围检查、修改计数、撤销和保存流程执行。停止会终止未开始的调用，已经提交的事务保留在修改记录中。新页导航后重新读取上下文；画布尚未挂载时省略旧页面选区。两种模式均将工具拒绝结果回传给模型，最多允许三次修正，前提是权限、项目、分支、会话和设计计数均未改变；不自动重设绑定，也不放宽工具参数校验。重复失败的调用不会再次执行。

新页生成同时要求前后端 `enableLocalAiPageGeneration` devflag；默认关闭。AI 配置保留在服务端，Web 只读取可用状态和模型名称。选区任务最多 12 轮、3 分钟；已有完整组件编辑和新页生成最多 48 轮、12 分钟。执行进度保留工具拒绝的具体错误，模型只能按实际错误修正。工具读取沿用现有 MCP 模型和组件契约，包含注册 ref 动作的名称及可用的参数签名，以及事件与 render slot 的原生参数。

验收场景为查询表格、新建抽屉及详情抽屉。复用已安装的 Admin Templates、Ant Design 6、Overseas 和 React UI。Form 负责字段值和校验；列表使用原型内存数据。模型结构校验和保存成功不代表 Preview 的视觉或交互验收成功，实际运行证据另行记录。

## 可重复执行的 Web 验收

`deploy/verify-local-ai-web.cjs` 使用浏览器内置入口和公开 Studio 工具，可通过 `PLASMIC_VERIFY_PAGE_GENERATION=1` 追加整页场景。需提供 `STUDIO_ORIGIN`、独立验收项目 `PLASMIC_PROJECT_ID` 和私有 IAM `SG_SESSION` 或 `PLASMIC_STORAGE_STATE`；使用现有服务器的 AI 配置。脚本创建独立测试页面并复用模板库，报告及截图输出到 `PLASMIC_REPORT_DIR`。不要提交登录态文件或密钥。脚本不能用受控 API/编辑器响应替代真实运行结果。

模型 step 响应仍为一个 JSON 文档。服务在等待期间每 10 秒写入合法 JSON 空白，并关闭代理缓冲与压缩转换，避免空闲连接超时。权限及请求校验在保活前完成；客户端断开后取消模型并清理定时器。已经发送响应头后的服务失败使用 JSON error，Web 会检查响应体错误。选区模型请求最长 90 秒，完整组件编辑和整页生成请求最长 240 秒；Web 同时执行每项任务的整体时限。

模型服务使用 SDK 流式响应读取，完整消费后才向 Web 返回最终文本和工具调用。网络中断、停止、请求超时及输出长度截断会使整个 step 失败，未完成的工具参数不会执行。服务日志仅记录错误类型、状态码和原因类型，不记录服务错误正文或凭证。

本地源码联调入口为 `pnpm dev:web`，配置与使用方法见 [本地 Web 开发](../../deploy/local-web.md)。本地验收使用独立数据库中的原生个人 API 凭证，由现有 IAM 目录确认身份；线上共享登录态验收证据仍见上文。

## 本地整页场景验收

实际服务生成并保存 `RecordsWebAcceptancePage`（revision 37）。在登录态 Web Preview 中，查询草稿与提交筛选、重置回第一页、20/50/100 分页、详情切换、必填/纯空格校验、有效创建、取消/X/Esc 不提交及重开空白均已操作验证。创建只加入一条记录，显示首行且详情一致；原型使用内存数据，重开回到 60 条初始记录。成功提交调用 SearchForm 原生 `reset`，同时清空查询控件与已应用条件。

业务 Flex 的重复 20px padding 已通过内置 AI 去除并保存；最终 revision 39 原生接口读回确认 53 个节点、11 个交互和全部状态的身份保留。1440×1024 Preview 实测 AppShell 外层三边各 16px，业务容器 padding 0、查询与列表间隔 16px，文档不滚动，AppShell 内容区负责垂直滚动。整页生成指令明确这些间距归属；模板验收规范要求保存重开后量测。

全屏 Preview 在实际业务框架报告 rendered/error 后通知顶层就绪，消除直接打开或重开预览时遮罩持续覆盖页面的问题。普通 Preview 仍由编辑器报告就绪。实际记录见 [本地 Web 验收](ai-page-generation/local-web-verification.json) 与 [原生模型读回](ai-page-generation/local-saved-model.json)，视觉证据见 [修正后的页面](ai-page-generation/local-spacing-fixed.jpg)。

最终项目保存为 revision 42，已清理失败生成的空白页。Web 原生撤销恢复该草稿并保存，重做再次清理后保存；原生读回确认正式场景页的模型图完全保留。分页 100→20 已重新选择并核验为 60→20 行和 3 页。从新标签页重开编辑器显示已保存，并保留两阶段验收页。

## 旧标签页宿主恢复

浏览器可能暂停后台标签页中嵌套宿主 iframe 的初始化。宿主加载超时只在前台计时；切回前台后给予完整 10 秒，切入后台时清除提示。真正超时提供“重新加载”，沿用 Studio 的 refreshStudio 重建宿主与通信连接；查看者也能重试，修改宿主 URL 仍要求编辑权限。连接成功或离开页面时清理提示、计时器和可见性监听。

原始旧标签页已实际恢复，并通过短暂停住本地宿主服务复现超时、点击重载按钮、恢复服务的验证。画布显示 20 条记录且加载遮罩消失；该旧页 Preview 的查询、详情抽屉、新建抽屉取消与重置正常。返回编辑器显示已保存。原生读回仍为 revision 42，场景页引用的 810 个模型对象与恢复前一致。证据见 [宿主恢复验收](ai-page-generation/local-host-recovery.json) 和 [恢复后的原始编辑器](ai-page-generation/local-host-recovered.jpg)。

高度随内容伸展的画布根容器使用纵向 flex，并沿横轴拉伸。全局 Context 引入 DOM 包装时，包装仍占满画板宽度，保留业务页面原本的尺寸、上下文与 CSS 变量作用域；不需要修改已安装的组件库版本。

## 已有页完整编辑：本地 Web 验收

2026-10-12 使用本地登录态 Web、内置 AI 对话和真实模型修改 `RecordsWebAcceptancePage`。新增类别筛选、类别表格列、新建类别字段及详情类别展示；复用现有组件、状态和事件。原有记录按“未分类”兜底，新建可选“重点”或“普通”。原有 53 个节点和 11 个交互 UUID 全部保留，最终 63 个节点、11 个交互；60 条初始数据及 `LocalEditAcceptance` 页面模型未变。

Preview 实测类别草稿不立即筛选，查询才生效并回到首页；重置清空条件。新建类别必填，名称必填、禁止纯空白、长度 2–40。空值、1 字符、41 字符及缺失类别被拦截，合法创建只新增一条并去除名称首尾空格；类别查询仅返回该新记录，详情显示正确。取消、X、Esc 不提交，表单重新打开为空。原型运行数据保留在内存中，重开恢复 60 条初始记录。

首次模型写入的 `ruleType: "length"` 没有运行效果，未计为验收成功；已按组件实际 `min/max` 配合 `length` 的契约通过 AI 修正，模型指令也说明该形状及插入节点时的样式约束。记录见 [首次表单工具结果](ai-existing-page-editing/create-form-ai-task.json)、[修正后的工具结果](ai-existing-page-editing/corrected-form-ai-task.json) 和 [真实运行验证](ai-existing-page-editing/web-runtime-verification.json)。

同一任务可从 AI 修改记录连续撤销。每次成功撤销仅以原生返回的计数更新同任务上一笔的撤销检查，保留原始修改绑定；之后发生人工编辑仍拒绝过期撤销。三笔修改分别撤销并保存为 revision 61、62、63；revision 63 与仅类别查询修改的 revision 51 模型完全一致，独立 Web 重开确认新建类别字段已移除。原生重做后的 revision 64 与已验收的 revision 60 模型完全一致。随后通过单次 AI executeBatch 重置两个新增 Select 的空 suffixIcon 覆盖，恢复原生下拉箭头，最终保存为 revision 65；重开后两个箭头存在，初始抽屉关闭、数据恢复 60 条。证据见 [连续撤销](ai-existing-page-editing/ai-consecutive-undo.json)、[撤销重开](ai-existing-page-editing/undo-reopen-verification.json)、[默认插槽重置](ai-existing-page-editing/select-defaults-ai-task.json)、[最终重开](ai-existing-page-editing/final-icons-reopen-verification.json) 和 [最终原生模型检查](ai-existing-page-editing/final-model-check.json)。

相关 6 个测试文件共 93 项通过；后续请求指令与撤销测试修正另跑 30 项通过。完整 WAB 类型检查通过，涉及文件 ESLint 无错误，保留 3 项原有测试空函数警告。所有代码均未提交、打 tag 或部署。

助手输入区的模型下拉框从 AI 服务的 `/models` 接口获取可用模型，保留服务端默认模型。模型列表在服务端缓存五分钟；不支持模型发现的服务只显示配置的默认模型，也可通过 `PLASMIC_AI_MODELS`（逗号分隔）或 `localAiEditing.models` 指定可选列表。指定列表时不调用模型发现接口。服务端验证所选模型属于可用列表，意图判断及任务全部编辑步骤使用同一模型。选择在当前浏览器的项目会话内保留，任务执行期间不可切换。
