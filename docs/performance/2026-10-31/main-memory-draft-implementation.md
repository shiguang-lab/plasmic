# 主进程延迟初始化、对象保留与草稿传输验收

状态：源码改造和以下定向验证已完成，未发布；全库 typecheck 和 Preview 原生超时脚本的后续修复验收均已通过。真实业务项目的全量内存 A/B、低端设备收益和 App 总启动收益仍未知。

环境为 macOS arm64、Electron 44.5.1。保留工作区原有修改。MCP 工具、组件库发布/自动升级、账号隔离、完整性校验、缓存预算、HTTP 请求方式和正式包调试配置均未改动。MemLab 2.0.6 安装在临时诊断目录，没有进入生产依赖。

## 1. 主进程依赖延迟初始化

成功条件：导入 main 不加载 MCP SDK、AJV、sharp；工具/路由契约一致；首次及并发使用可用；分别测量导入和首次使用。

- `mcp-contract.cjs` 持有工具清单、编辑器方法和路由校验，controller 不再导入服务端实现。服务端仍使用原 AJV 校验器和 stdio/RPC 生命周期。
- `design-reference-contract.cjs` 持有参考字段。客户端 SDK 在真实连接、配置校验通过后加载，原连接 Promise 去重和失败重试保留。
- sharp 在 `encodeImagePreview()` 首次调用时加载，编码、透明度、尺寸限制和错误处理未改动。没有新增通用延迟加载框架或旧导出别名。

相同 Module._load 包装方法、三个新 Electron 进程，仅计 `require(main.cjs)`：

| 指标 | 本轮修改前 | 修改后 |
| --- | --- | --- |
| 三次耗时 ms | 216.98 / 78.94 / 78.93 | 20.27 / 19.00 / 19.28 |
| 中位数 ms | 78.94 | 19.28（减少 59.65ms，约 75.6%） |
| 加载模块数 | 458 | 184 |
| 导入后 SDK / AJV / sharp | 已加载 | 均未加载 |

已有 132.07 / 74.23 / 73.34ms 基线仅作参考，不混入本轮统计。计时不含进程启动、bootstrap、窗口、认证或项目；未清空 OS 文件缓存，嵌套模块耗时不能相加。

41 个工具的 JSON SHA-256 前后一致，方法清单一致，见 [契约比较](mcp-contract-comparison.json)。[导入前](main-import-before.json)、[导入后](main-import-after.json)、[源码摘要](performance-source-hashes.json)保留原始证据。

首次使用三次中位数：

| 场景 | 修改前 | 修改后 | 边界 |
| --- | --- | --- | --- |
| 两个并发图片预览 | 1.97ms | 10.81ms | 1×1 PNG，冷 sharp 初始化迁到这里；暖调用 0.49→0.55ms |
| 图片探针主进程循环最大延迟 | 1.98ms | 10.70ms | 1ms perf_hooks 探针，不能代表低端机或大图 |
| 两个并发参考读取 | 82.10ms | 112.70ms | 真实 SDK/stdio，确定性参考服务，包含子进程启动；新增约 30.60ms |
| 暖参考读取 | 0.24ms | 0.21ms | 非真实 Pen 启动时间 |

未在这些局部探针中观察到超过 50ms 的循环延迟；不据此保证首次真实 Pen/大图操作无卡顿。服务端 SDK/校验初始化约 53–55ms 在独立 MCP stdio 进程发生，不是主窗口的首次图片开销。[图片原始值](first-use.json)、[参考读取原始值](reference-first-use.json)。

## 2. 对象保留

成功条件：先用 CDP 堆快照和 MemLab 确认路径，再验证关闭后的条目/Model/最后参数释放；另一活跃画板、另一编辑器和撤销仍可用，不清空共享缓存或缩减撤销历史。

诊断运行真实 React、Monaco、MobX、DeepMap、DocsPortalEditor 源码；getEnvId 的源代码块直接抽取，RenderingCtx 和业务代码生成使用确定性 fixture。**这是定向生命周期场景，不是完整 Studio 画布的堆验收。** 预热一次，取 baseline/target/final 三份快照，再做十次打开/关闭。诊断 GC 不用于生产，也不参与耗时测量。

确认的路径及修复：

| 对象 | 快照路径与大小 | 修复与归属 |
| --- | --- | --- |
| 环境映射 | 全局 Map → ID/字符串键/WeakRef；final 中 envIdToEnvs 的保留图约 7.6KB。值是弱引用，不能称为强持有整棵画布 | 按 FrameState 记录 ID 与键；通过 FinalizationRegistry 在目标回收后清理，frame.dispose 确定清理。完整键加 frame uid，删除时核对最新 ID，保留其他画板和替换实例 |
| Monaco Model | ModelService → `_models` → TextModel2；单次 target 后新增 7 个 Model，MemLab 的该类保留量约 49.5KB | 每个 DocsPortalEditor 使用自己的 URI 目录、Model 集合和 extra-lib disposables；卸载时解绑 editor、释放自己创建的模型和声明。不会释放其他编辑器的模型 |
| DeepMap 最后参数 | DeepMap → last → args → 参数对象；fixture 参数约 40.1KB，store 已为空 | delete 后清空参数数组并释放 closest 的旧分支。保留活跃条目和原有失效检查；真实 RenderingCtx 的 retained size 未测出 |

分别只启用一项修复，再做组合对照，十次循环后的结果：

| 版本 | 环境 ID | Monaco Model | 已删除 entry 的参数数 |
| --- | --- | --- | --- |
| 修改前 | 1,200 | 84 | 1 |
| 仅环境修复 | 0 | 84 | 1 |
| 仅 DeepMap 修复 | 1,200 | 84 | 0 |
| 仅 Monaco 修复 | 1,200 | 0 | 1 |
| 全部修复 | 0 | 0 | 0 |

修复后关闭 A 编辑器，B 仍保留 5 个模型和 3 份声明，输入/undo 成功。单测覆盖相同完整键的两个画板、重新渲染、关闭一个画板、未跟踪的错误显示环境及重复 frame uid；活跃画板数据仍可读。上述堆数据采集早于环境清理竞态修正；当前真实项目的编辑/撤销及 20 轮 GC 复验见 [五项优化结果](five-optimizations-validation.md#验收发现并修复的环境索引竞态)，不能用旧 fixture 结果代替当前全量内存验收。

该 fixture 的 GC 后 JS heap 从预热到第十轮增长为 3,622,140→1,682,600 B，后者后半段趋稳。这是一次定向运行，不能直接换算真实项目节省的内存。MemLab trace-all 仍报告 33 组候选，包含 Monaco/浏览器缓存、形状和最近 URI；没有宣称零泄漏。修复后 TextModel2 和测试参数对象的目标保留链消失，DeepMapEntry 本身仍有一个有界实例。

证据：[分项 A/B](retention-ab.json)、[MemLab 前](retention-memlab-before.txt)、[MemLab 后](retention-memlab-after.txt)。使用 [MemLab 官方 CLI 的三快照输入](https://facebook.github.io/memlab/docs/cli/CLI-commands/)分析 CDP 快照。JS heap、原生/GPU 和 RSS 分开记录；没有把 renderer 重开时的 RSS 增长判定为泄漏。

## 3. 缓存与草稿链路

成功条件：用 contentTracing/V8 时间线、主进程事件循环和 renderer 长任务确认热点；只改确认的瓶颈；正文、依赖、鉴权、两检查点和恢复行为一致；高开销 trace 与最终墙钟 A/B 分轮。

### 磁盘资源缓存

使用本机真实正文的独立副本：4 种组件库代码（本机没有第五种代码资源）和 5 个模型资源，共约 8.81MB。顺序/并发各六轮均为磁盘命中，正文 SHA-256 一致，无远端资源请求。

整批 20.16–27.52ms，循环最大延迟不超过 6.22ms。JSON parse/stringify 和 base64 decode 确有 CPU 成本，但本机没有录到需要更换存储格式或启用 worker 的阻塞证据。真实项目重开也全部命中：每次 17 次资源访问，磁盘读取/校验单次最大 29.05ms（异步区间有重叠，不相加）。**没有修改 library-cache.cjs，也没有为此报告缓存提速。** [缓存原始数据](cache-pipeline.json)。

### 草稿热点与改动

实际「客服平台 · GP评论查询」修订 158，5 个依赖；窗口内容 1512×887。按已有流程从正式 0.5.30 App 提取未改动的 renderer，配当前 Desktop 源码和独立 profile，保留真实 manifest 匹配检查。没有使用本地不匹配的 0.5.27 renderer，没有改变生产调试入口。

contentTracing/V8 采样定位到 Comlink/postMessage、IPC 和序列化路径。首轮 trace 中项目 bundle 仅 10–16ms、主进程 stringify 约 13–16ms；对象跨 frame 至写入完成达 161–271ms，伴随 87–166ms renderer 长任务。已有依赖 bundle 缓存、摘要缓存和旧检查点复制均保留。

改动仅为：DesktopDraftController 在发送前将草稿转为 JSON 字符串，通过相同 Comlink API 和 Electron IPC 传递；主进程先验证 sender、会话和账号，再解析，交原 DesktopDraftStore 校验、预算检查和原子写入。三个写入入口（正常备份、冲突标记、初始化冲突标记）均采用同一契约。未增加对象缓存、worker、utilityProcess 或线程池。主进程依然会 stringify 写磁盘，没有声称消除了这部分成本。

最终墙钟对照关闭 contentTracing；每侧三个新 Electron 进程，各强制五次本地备份，服务器自动保存关闭，项目写请求拦截。诊断通过偏移草稿序列触发备份，不修改业务模型。原 renderer 的发送边界注入与源码相同的 JSON.stringify，运行当前实际主进程解码和落盘代码；**尚未构建包含本次所有前端改动的完整 renderer 包。**

| 15 次写入 | 对象传输 | JSON 字符串传输 |
| --- | --- | --- |
| 发送边界→写入完成中位数 | 140.60ms | 72.40ms（减少 68.20ms，约 48.5%） |
| 范围 | 125.60–194.20ms | 62.40–96.00ms |
| 与写入重叠的 renderer 长任务 | 三轮分别 5 / 5 / 6 个，最大 85 / 87 / 97ms | 三轮均未观察到 |
| 项目 bundle 中位数 | 10.10ms | 9.10ms（此路径没有优化，不归为收益） |
| 每次写入主进程 p95 的中位数 | 1.268ms | 1.360ms |
| 每次写入主进程 p99 的中位数 | 8.348ms | 8.430ms（未改善） |
| 每次写入循环 max 的中位数 | 33.47ms | 26.71ms；范围重叠 |

发送计时包含修改后约 15–17ms 的 JSON 编码，不含更早的项目 bundle；不是完整编辑交互耗时。每个样本的事件循环窗口另有 50ms 排空等待，不能用样本外层 durationMs 直接当保存延迟。三个 iframe 对同一主线程长任务的重复观察不叠加；表中使用实际发送 frame 的观察。

所有进程的 renderer/磁盘 bundle+依赖 SHA-256 均为 `4bb60f883c4ab51554219b538ba939abbbf6d34f7b1295f4f5ef9cadb07081d4`；保留 5 个依赖和 2 个检查点。修订 158、修改计数 0，未出现项目写请求或运行时错误。源码单测覆盖磁盘满、损坏恢复、并发更新、账号/会话隔离、离线保护和冲突标记。

[最终不录 trace 的 A/B](draft-transport-ab.json)、[定位 trace 前侧数据](draft-traced-before.json)、[当前解码器 trace 数据](draft-traced-after.json)。75MB 级原始 trace 不加入源码；压缩 trace、堆快照和基线源码位于本机 `desktop/desktop-report/performance-2026-10-31/`，诊断脚本见 `desktop/tests/performance/`。

## 验证与未解决项

| 实际执行 | 结果 |
| --- | --- |
| `node --test desktop/tests/*.test.cjs` | 519/519 通过 |
| 七个相关 Vitest 文件 | 45/45 通过；覆盖环境、frame、DeepMap、DocsPortalCtx、草稿和保存状态 |
| canvas-lifecycle.test.ts | 3/3 通过；fixture 补齐现有 ViewCtx.dispose 使用的 contentEditor |
| `pnpm --dir platform/wab typecheck` | 通过；导航测试改为监听 `StyleMgr.prototype`，保留私有成员可见性；arena-navigation.test.ts 的 4 项测试通过 |
| 原生 MCP lifecycle（匹配资源隔离副本） | quit/crash/reopen，每轮 3 客户端退出、离线拒绝通过 |
| 原生后台 MCP | 无 GUI 窗口、未加载 main、Dock 不显示，通过 |
| 原生 library-cache | gzip、持久磁盘命中、真实协议和无摘要库存上传通过 |
| 原生 reference-browser | 25 组通过，包括图片、导入、选择、受限 CDP、重开和复制反馈。旧断言要求显示原始异常，已改为严格匹配当前语言包的用户提示；生产浏览器代码未改 |
| 原生 preview-errors | renderer 异常、遮挡/禁用/过期目标经 Electron/RPC/MCP 传递，同一轮可继续，通过 |
| 原生 preview-navigation | 通过：缺失路由、真实挂起两项场景均验证队列恢复。挂起场景在强制 GC 后仍按 30 秒期限返回 `PREVIEW_TIMEOUT`（实测 30,024ms），随后排队的 close/read 完成；日志无未处理拒绝 |
| 静态语法与差异检查 | 修改的 CJS/诊断脚本 `node --check` 及 `git diff --check` 通过 |

脚本 fixture 的挂起参数改为 query，确保 HTTP 服务实际启用挂起；假定时器保留回调，避免 Chromium GC 提前回收待处理的 Promise；同时观察断言和排队恢复两个 Promise 的拒绝，避免失败清理时出现未处理拒绝。挂起期间使用 CDP 强制 GC，保留原 29–35 秒期限与队列释放断言。生产 Preview 运行逻辑未改。另复跑 controller/preview-runtime/preview-errors 相关单测，50/50 通过。机器可读结果见 [最终校验](performance-validation.json)。

仍未知：完整 Studio 重复开关画布/文档后的 retained size 与真实用户内存收益；原生/GPU 内存的长期趋势；App 总启动时间；真实 Pen 首次启动与低端机表现；正常编辑、网络故障恢复的整机耗时 A/B；完整新 renderer 构建后的最终业务验收。没有以 RSS、减少撤销步数或卸载活跃画板替代这些验证。
