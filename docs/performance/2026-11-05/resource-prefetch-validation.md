# 画布资源纯预取：实现与功能验证

2026-11-05。本报告记录纯资源预取的独立集成与验证；直接编辑器的正式集成另见 [功能验证](direct-studio-validation.md)。没有合入提前创建/接管画板原型，没有替换已安装 App 或发布部署。此阶段的源码指纹与脱敏结果见 [JSON](resource-prefetch-validation.json)。

## 当前实现

- `StudioInitializer.init()` 在偏好读取和项目模型初始化之前发起基础 canvas bundle 与 ReactWeb 源码预取。使用原 `getCanvasPkgs()`、`getReactWebBundle()` 缓存 Promise；正常初始化消费同一 Promise。删除 `Studio.componentDidMount()` 中较晚的两处预取调用。
- `StudioCtx` 的 Host HTML 加载器仍是唯一所有者，只将同一段初始化移到数据库上下文赋值之后、hostless 注册与其余启动工作之前。首画板消费原预取 Promise；不可变 Host 的复用、自定义 Host 的刷新、headers 与 redirect 规则保留。
- 预取只读取源码文本，脚本执行、注册、画板创建、初始 hash 和视口恢复继续使用原路径。不创建占位 iframe，不移动 Document，不派发补偿 hash 事件。
- 预取失败不会产生未处理拒绝；ReactWeb 的 HTTP、网络及正文读取失败会清除失败 Promise，实际消费者可重新请求。基础 canvas 源码沿用已有失败淘汰和重试。

## 验证

- 五个相关 Vitest 文件、52 项测试通过，无未处理错误。覆盖并发读取共享 Promise、源码读取不执行脚本、消费者正常执行、预取网络/HTTP/正文失败后的重试、Host 首次读取复用与自定义 Host 后续刷新、编辑器加载、首画板及视口恢复。
- 完整 `tsc --noEmit --incremental false` 通过。相关文件 ESLint 为零错误，保留原初始化器测试的三项空函数警告；`git diff --check` 通过。
- 初次扩大验证时，两个原视口测试的 Desktop API mock 对 `componentReuse` 返回 `undefined`，与其 Promise 契约不符。该错误在未改动的基线源树上同样复现；只为这两份测试补齐有效的异步不可用响应，未改生产实现、停用功能或忽略错误。
- 生产模式隔离构建成功。四份生产源码与实际构建源逐字节一致，rendererHash 为 `50e94f4902da7d075e212b1acd8e5f07ae8b263469517ff8766165a4fdf4e518`。
- GP 单画板与十画板真实冻结项目分别完成：画板切换、重命名、真实 DOM 样式和画板位置修改、撤销重做、完整客户端保存及重开后模型/修订一致。GP 额外通过真实 Preview 分页与返回；十画板额外通过冷画板销毁后的撤销、重做、选择和样式恢复。
- 两份有效功能报告 renderer error 均为零、意外写入阻断为零；完整注册均为 981 项。实际检查确认没有直接编辑器标记、预备画板标记或接管后的 Document。

这次按明确的源码读取复用与功能等价范围集成，没有用单次功能轮耗时宣传提速，也没有承诺一秒可编辑。HTTP/WebSocket 和保存由独立离线夹具处理，不替代线上权限、草稿 IPC、后端保存或安装验收。每个功能进程的一项既有 Dashboard 缩略图 `undefined.map` 夹具错误仍单列保留，不计为缩略图通过。

构建、单测、完整类型检查、lint 和功能回放的日志与私有夹具位于 `/tmp/plasmic-startup-experiments-20261105/`。复现构建使用该目录的 `source/platform/wab/perf.config.ts` 与 `build-prefetch`；功能入口为 `run.py prefetch gp qual-prefetch-gp`、`run.py prefetch complex qual-prefetch-complex`。
