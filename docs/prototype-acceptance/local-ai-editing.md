# Web AI 编辑验收

## 登录态保存、重开和撤销

2026-10-12 在已登录的 Chrome Web 中，使用内置 AI 对话和真实服务模型 `gemini-3.8-flash` 验收。项目为 [AI Web Acceptance 20261012](https://studio.plasmic.shiguanglab.com/projects/f1Z6sEJ9WnC7QuDScTMQ8E)，页面 `LocalEditAcceptance`。

- AI 修改标题并确认保存 revision 6；重开后文本为 `Saved Web Acceptance`。
- 重开后再次修改并确认保存 revision 7；通过 AI 修改记录撤销，确认保存 revision 8。
- 再次重开后文本恢复为 `Saved Web Acceptance`，节点 UUID 保持不变。

证据：[实际工具结果及读回记录](local-ai-editing/web-authenticated-verification.json)、[撤销后的 Web 截图](local-ai-editing/web-authenticated-undo.png)。此前 `verification.json` 的浏览器夹具结果保留，仅代表早期受控测试。

## 整页生成执行契约

内置对话提供“编辑当前范围”和“生成新页面”。生成模式要求 PascalCase 页面名称和路由，通过 Studio 的原生 createComponent 创建一个新页面，再将工具执行绑定到该页面。模型不能创建第二个页面、安装库、修改全局资源或发布项目。

局部模式保留原有选区或当前页范围，只允许节点修改、插入和删除。整页模式额外允许原生状态、交互、复制、移动和该页 viewport 工具。所有模型修改通过 Studio 的事务、范围检查、修改计数、撤销和保存流程执行。停止会终止未开始的调用，已经提交的事务保留在修改记录中。新页导航后重新读取上下文；画布尚未挂载时省略旧页面选区。整页任务将工具拒绝结果回传给模型，最多允许三次修正，前提是权限、项目、分支、会话和设计计数均未改变；不自动重设绑定，也不放宽工具参数校验。

整页模式同时要求前后端 `enableLocalAiPageGeneration` devflag；默认关闭。AI 配置保留在服务端，Web 只读取可用状态和模型名称。局部任务最多 12 轮、3 分钟；整页任务最多 48 轮、12 分钟。工具读取沿用现有 MCP 模型和组件契约，包含注册 ref 动作的名称及可用的参数签名，以及事件与 render slot 的原生参数。

验收场景为查询表格、新建抽屉及详情抽屉。复用已安装的 Admin Templates、Ant Design 6、Overseas 和 React UI。Form 负责字段值和校验；列表使用原型内存数据。模型结构校验和保存成功不代表 Preview 的视觉或交互验收成功，实际运行证据另行记录。

## 可重复执行的 Web 验收

`deploy/verify-local-ai-web.cjs` 使用浏览器内置入口和公开 Studio 工具，可通过 `PLASMIC_VERIFY_PAGE_GENERATION=1` 追加整页场景。需提供 `STUDIO_ORIGIN`、独立验收项目 `PLASMIC_PROJECT_ID` 和私有 IAM `SG_SESSION` 或 `PLASMIC_STORAGE_STATE`；使用现有服务器的 AI 配置。脚本创建独立测试页面并复用模板库，报告及截图输出到 `PLASMIC_REPORT_DIR`。不要提交登录态文件或密钥。脚本不能用受控 API/编辑器响应替代真实运行结果。
