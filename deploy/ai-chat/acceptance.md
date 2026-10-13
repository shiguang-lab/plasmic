# 本地 AI 共享聊天验收

日期：2026-10-13。环境：当前源码、本地 PostgreSQL 15、Temporal 1.29.1、持久化 SeaweedFS 4.17、独立 Worker、真实 Studio 和 Preview 浏览器。

## 已验证

| 检查 | 结果与证据 |
| --- | --- |
| 相关自动化测试 | 16 个文件、204 项通过，包含真实 PostgreSQL/S3 的 11 项集成测试。见 [测试输出](evidence/related-tests.log)。 |
| 类型与构建 | WAB 声明的 TypeScript 编译器检查通过；Studio 和 Preview 生产构建通过。本次修复后已重新通过类型检查及两项生产构建；涉及文件 ESLint 无错误，保留既有警告。 |
| 真实模型交互页面 | `gemini-3.8-flash` 创建原生数字状态、动态文本和点击交互；Preview 中 Counter 从 0 变为 1。两个独立测试任务分别执行 22 和 25 次原生操作，每个操作均只执行一次。见 [首次任务](evidence/real-model.json)、[最终任务](evidence/real-model-final.json)。 |
| 丢失保存回执 | 浏览器实际中断一次修改后的 ACK；项目修订与执行回执已原子提交，重试未重复执行修改。 |
| 原生撤销与刷新 | 首次任务在原编辑器撤销并保存到修订 9；刷新后撤销状态仍存在，历史记录没有暴露新的原生撤销按钮。Markdown/PNG 原文件可重新读取。 |
| 多账号共享 | 两个浏览器读取同一项目历史，协作者接收实时事件；外部账号历史和文件请求返回 403。撤销协作者权限后其 Socket 断开，历史请求返回 403；测试权限随后恢复。见 [权限报告](evidence/access-report.json)。 |
| 存储与恢复 | 同请求并发去重、连续项目序号、增量事件重建、断线补拉、停止保留输出、执行租约与 fencing、保存事务回滚、不确定修改的显式校验，均已验证。附件使用私有对象引用与校验和；匿名 S3 读取返回 403。 |
| 故障注入 | 使用本地 SSE 模型夹具，真实杀死并重启 Worker，确认部分输出保留且没有新增上游请求；上游断流、离线恢复、显式停止和历史节点定位通过。见 [故障报告](evidence/fault-report.json)。 |

真实交互任务使用真实模型服务。故障注入使用显式本地模型夹具。原 IAM 本地转发服务不可用，因此双账号测试使用 loopback 目录夹具，认证仍使用原生 API token，授权仍经过原生项目权限检查。

测试项目：`9ebuBz8SEDHpNbYDaSjWoT` 与 `qJ7LYLwULwvL8uosN9Mu5G`。所有设计修改均限于这些本地测试项目。历史节点标签通过保存的页面/分支/节点引用导航；定位验证中设计计数器保持 0。

## 全量测试结果

WAB 全量运行耗时 361.67 秒，退出码 0：399 个文件中 398 通过、1 个既有跳过；3405 项测试中 3390 通过、15 项既有跳过，失败为 0。真实 PostgreSQL/S3 的 11 项集成测试已纳入此次全量运行。详见 [全量通过记录](evidence/full-tests-fixed-summary.txt) 和 [可复现命令](README.md)。

同毫秒的组件修改时间戳严格递增；覆盖层按钮使用共享语言包；SSR 子进程使用服务端模块配置，SDK 与 React 解析到同一运行时。测试夹具为子进程提供真实的带认证本地 IAM HTTP 目录，邮件夹具和精确预期保留 IAM 完整显示名。角色与 AI 开关测试按当前合同严格验证，TopBar 测试保留真实操作按钮；SSRF 测试使用两次真实 TCP 重定向，严格验证私网请求被拦截且不新增内部请求。本次未新增跳过项或放宽断言。

最终交互任务的首次 Preview 加载遇到开发前端和生产构建共用输出目录的短暂空入口；完成构建后重新打开 Preview，实际点击验证通过。首次任务的 Preview、同会话撤销及刷新验收均已完成。

## 截图

- [最终真实编辑结果](evidence/interactive-editor-final.png)
- [最终 Preview 点击结果](evidence/interactive-preview-final.png)
- [撤销后的历史](evidence/interactive-history.png)
- [发起者历史](evidence/owner-history.png) 与 [协作者历史](evidence/collab-history.png)
- [历史节点定位](evidence/node-reference.png)

启动、环境变量和可重复测试命令见 [README](README.md)。本次未验证多主机故障切换或生产部署。
