# 下一批性能优化与 Electron 工具评估

当前实施结果见 [主进程、对象保留与草稿传输验收](main-memory-draft-implementation.md)：主进程导入中位数 78.94→19.28ms；定向内存场景的三条保留链已处理；草稿传输 15 次样本中位数 140.60→72.40ms。完整 Studio 内存收益和 App 总启动收益未知。

后续五项已按顺序评估，见 [实施与对比](five-optimizations-validation.md)：保留项目 GET 优化及静态排队骨架屏；撤回手势期间暂停后台初始化、浏览器 MobX 替换和降低画板保留数量。另修复环境索引在 React 提交前被删除的竞态。相关源码及定向验证完成，未发布。

以下保留候选项的评估依据：源码、[灵动岛收益对照](island-state-lifecycle-benefits.md)、[项目启动 GET 调查](project-startup-get-investigation.md)及官方工具资料；后续状态以实施验收为准。

## 值得做的工作

| 项目 | 目标 | 证据与建议 | 优先级/成本 |
| --- | --- | --- | --- |
| Electron 主进程启动依赖延迟初始化 | 进程启动、基础内存 | 主窗口因路由常量和工具描述提前引入 MCP 服务端 SDK；图片辅助模块提前引入 sharp。梳理实际入口，把重依赖留到首次需要的功能；不是组件库分包，不改版本升级策略 | 先做，低至中 |
| 项目 GET 的重复 JSON 处理、权限去重键修正 | 画布打开等待 | 已实施；服务端副本请求中位数 294.62→210.72ms，数据库命令 94→89，响应字节一致。不是 App 整体打开计时 | 已验证，待发布 |
| 环境映射、Monaco Model、DeepMap 最后键的生命周期 | 长期编辑内存 | 前两项有清理缺口；DeepMap 在 store 为空后仍持有最后 entry 的参数已复现。先用堆快照确认保留量和多画板归属，再定向清理 | 先验证并修，中 |
| Desktop 磁盘资源缓存的 JSON/base64 路径 | 暖开、主进程卡顿、临时内存 | `library-cache.cjs` 每次命中仍解析 JSON、解 base64，再序列化 base64 相关数据以验摘要。磁盘命中不代表没有 CPU。先测真实 5 个库的读取/校验；若有长任务，再改原始正文存储或把纯计算移出主线程 | 第二批，中；尚无耗时 A/B |
| 草稿的项目 bundle、跨 frame/IPC 复制、最终序列化 | 编辑时偶发卡顿 | 依赖 bundle 缓存、摘要缓存、旧检查点直接复制已经实现。当前仍生成项目 bundle，发送包含依赖的数据，并在主进程 stringify。只测剩余部分，不重复实施旧报告已经完成的优化 | 第二批，中；先录制编辑 trace |
| 首屏产物的重复依赖、意外进入首屏的模块 | Web 冷开、App 解析执行 | 当前是 Rsbuild/Rspack，可用 Rsdoctor 看真实导入图和产物。保留已有 runtime 去重与缓存，不做本轮排除的页面按需和组件库分包注册 | 第二批，先分析产物 |

撤销视图状态轻量化保留为后续项目：历史记录有运行时对象保留链，但实际 retained size 需测；需要保证重复实例、Slot、多画板和组件编辑上下文恢复。不要通过减少撤销步数冒充无损优化。

悬停几何读取也只在 trace 确认热点后处理。同一祖先的重复读取可在单次测量内复用，不能把读取次数直接当作重排次数，也不应长期缓存会随滚动/变体变化的几何。

## 新增主进程导入采样

在 3 个新 Electron 44.5.1 进程中，对 `require(main.cjs)` 及嵌套模块加载计时：

- 总计 **132.07、74.23、73.34ms**，中位数 **74.23ms**；各次加载模块数均为 458。
- MCP 模块链包含服务端 SDK、协议校验等；`controller.cjs` 引用 `mcp.cjs` 的方法清单/路由检查，却同时加载服务端依赖。
- `prototype-mcp.cjs` 为读取 `REFERENCE_FIELDS` 引用 `design-reference.cjs`，又带入客户端 SDK 和图像辅助依赖；后者在模块顶层引入 sharp。
- sharp 导入为 7.3～11.3ms；MCP 模块链为 57.7～94.1ms。它们与总计重叠，不能相加，也不是可全部省掉的时间。

原始数据见 [JSON](desktop-main-import-profile.json)。这是本地源码导入阶段，不含 Electron 进程启动、`bootstrap()`、窗口创建、认证和画布加载；没有测出将它延迟后 App 总启动能快多少。操作系统文件缓存和引擎缓存未清空，不称为整机冷启动。

## 工具与库的选择

### 优先用已有运行时和诊断工具

| 工具 | 能解决什么 | 本项目用法 |
| --- | --- | --- |
| Electron `contentTracing` + Perfetto | 把多个进程的脚本、布局、绘制、调度放到同一时间线上 | 进入画布、连续编辑、列表缩略图生成分别录制，找输入等待由哪个进程造成；不是仅看平均 CPU |
| Chromium DevTools Performance / Memory | 函数热点、长任务、分配、Detached DOM 和对象保留链 | 检查画布/文档往返后哪些实例仍存活；JS 堆不能替代 GPU/原生内存统计 |
| `app.getAppMetrics()` + Node `perf_hooks` | 进程 CPU/RSS、主线程事件循环延迟 | 与输入延迟、项目 GET、首帧、可编辑时间一起记录；避免把 RSS 之和当独占物理内存 |
| MemLab | 自动比较操作前、操作后、退出后的堆，追踪未释放对象 | 复用现有 Electron 测试与 CDP 快照，不必重建一套 Puppeteer 操作链；按画布、文档、灵动岛分别建场景 |
| Rsdoctor | 首屏模块来源、重复包、打包前后变化 | 匹配当前 Rsbuild/Rspack；检查被全量导入的 SDK、polyfill、编辑工具依赖；构建耗时优化与运行时收益分开验收 |

来源：[Electron 跨进程 trace](https://www.electronjs.org/docs/latest/api/content-tracing)、[进程指标](https://www.electronjs.org/docs/latest/api/app#appgetappmetrics)、[Node 事件循环测量](https://nodejs.org/api/perf_hooks.html)、[MemLab 接入现有测试](https://facebook.github.io/memlab/docs/guides/integrate-with-e2e-frameworks/)、[Rsdoctor](https://rsdoctor.rs/guide/start/intro)。这些工具帮助定位和复测，实际释放或提速仍来自业务实现的修改。

MemLab 适合 JS 对象与 DOM 保留问题，不能单独解释全部 RSS、图片解码内存或 GPU 占用。对主进程和不同 renderer 分别取证，采样时避免控制台/调试扩展自己保留对象。

### 有明确热点后再采用的运行库

- **`worker_threads`**：同一进程内把纯 CPU 工作放到独立线程。适用于经测量确认的序列化、摘要、矢量处理等；异步 I/O 本身不需要再包一层线程。对象复制和新增 V8 堆也有成本，不能直接搬整棵 MobX/DOM 树。[Node 官方说明](https://nodejs.org/api/worker_threads.html)
- **Electron `utilityProcess`**：给需要独立生命周期/故障隔离的 Node 任务一个进程，不需要再创建 BrowserWindow。适合已确认需要隔离的纯 Node 处理；不能替代需要 DOM/Blink 的截图 renderer。[Electron 官方说明](https://www.electronjs.org/docs/latest/api/utility-process)
- **Piscina**：管理多个 Node Worker 的任务队列、并发和背压。当前若只确认一个串行热点，先用单 worker 验证；有批量任务后再考虑池，不默认启动多个线程耗内存。[官方文档](https://piscinajs.dev/getting-started/Managing%20Worker%20Threads/)
- **Playwright Electron API**：可自动化稳定的性能场景，但仍标记为实验支持。项目已有真实 Electron 验收，应复用；正式包关闭了 Node inspect fuse 和远程调试入口，不能假定直接 attach 正式 App 或为测试改变其发布配置。[Playwright 文档](https://playwright.dev/docs/api/class-electron)

### 暂不采用的路线

- 不为“提速”先迁移 electron-vite：它是构建工具，当前前端已有 Rsbuild/Rspack、Desktop 已有 esbuild，迁移成本不等于运行时收益。[electron-vite 定位](https://electron-vite.org/guide/)
- 不先引入字节码/快照缓存库：先减少实际没用到的初始化。缓存编译结果不等于免除模块执行、模型构造和渲染；也不会解决保留引用。
- 不依赖定时强制 GC、放大 V8 堆上限来处理泄漏。先找保留链；采样用 GC 与生产运行策略分开。
- 不统一开启后台节流、减少撤销步数、自动卸载活跃画板或恢复常驻截图窗口池。本轮没有新的证据改变这些项的功能边界和收益判断。

Electron 官方同样把延迟不必要的初始化、避免主进程阻塞和实际测量作为核心方向，见 [性能建议](https://www.electronjs.org/docs/latest/tutorial/performance)。对本项目，先缩小启动依赖和修复已确认生命周期，再决定是否需要新的线程/进程架构。

## 验证条件

每项单独 A/B，保持相同 renderer/desktop 构建、项目修订、依赖版本、窗口/DPR 和缓存状态，报告中位数与尾部延迟。固定记录首帧/可编辑时间、点击/输入延迟、主进程事件循环 p95/p99、GC 后保留对象与各进程 RSS。堆快照和高开销 trace 与墙钟测量分轮运行。

延迟加载要检查首次调用与并发初始化；缓存/草稿改动要检查账号隔离、资源完整性、磁盘满、崩溃恢复和离线恢复；内存清理要检查活跃画板、撤销和重新进入。工具不常驻录制，也不改变生产包的调试策略。
