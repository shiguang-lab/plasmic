# 下一轮 App 内存、CPU、卡顿和画布加载优化

日期：2026-10-31。依据当前工作区源码、既有真实项目 trace/启动报告，以及两个新增的定向源码探针。本轮只分析与诊断，没有修改生产逻辑；探针文件运行后已删除。[机器可读证据](remaining-performance-review-evidence.json)。

后续状态已更新：样式缓存治理及最近 50 步历史已完成。当前剩余项的源码核对、方法探针及优先级见[50 步历史之后的评估](../2026-11-01/next-priorities-after-history-limit.md)；本文保留当时的分析与试验记录，撤回状态和优先级以各后续验收为准。

## 结论与优先级

剩余的大空间主要在 renderer 的对象保留、隐藏画板的无效刷新、多画板独立初始化和启动关键路径。建议先处理有归属边界的缓存及渲染工作，再评估缓存画布的内存预算。不能据源码承诺“内存减半”或固定秒数收益。

| 顺序 | 工作 | 主要目标 | 证据与把握 | 成本 |
| --- | --- | --- | --- | --- |
| P0-1 | Preview/Docs/派生缓存按会话和模型生命周期释放 | 长时间编辑内存、GC | 6 个模块级 keepAlive 代码生成缓存；定向探针确认旧配置仍命中。真实 retained size 待测 | 中 |
| P0-2 | 隐藏画板的局部 observer 更新遵守渲染激活状态 | CPU、输入卡顿 | 实际 ViewCtx 方法探针：inactive 且同步队列 paused，仍发生一次 React 刷新和一次后处理 | 中 |
| 暂缓 | 撤销的视图快照存可恢复的身份，避免持有运行时树 | 长时间编辑内存 | 11-01 原型已测：直接路径消失后仍有其他保留路径，5/5 旧 Val 存活；独立收益未确认，冷恢复未通过，原型撤回 | 中至高 |
| P1-1 | 非活跃 arena 缓存从数量上限改为有保护的内存预算 | 多页面切换后的内存 | 当前 liveArenas=6，单位是 arena，单个 arena 可以有很多 iframe；不是 6 个画板 | 中至高，依赖前述释放治理 |
| P1-2 | 缩短入口→Host→模型→首帧关键路径，优化每画板重复执行 | 首次可编辑、加载时长、多画板 CPU | 已有分段数据；运行时/库仍逐 Document 执行。实际提速须新构建复测 | 中至高 |
| P1-3 | 缩略图尽量复用已产出的图，减少 App 端重新生成 | 列表峰值 CPU/RAM、耗电 | 独立进程已解决列表主线程竞争，生成本身仍需模型、codegen、逐画板截图；旧量级实测较大 | 高，涉及产物和服务端设计 |
| 可穿插 | 更新按钮收窄 DOM 观察和可见性检查 | 加载/编辑时布局开销 | 旧诊断 trace 中原生 checkVisibility 叶节点采样约 139ms，调用栈落到 update-ui.place | 低至中；规模小于前面架构项 |

以上按之前约束评估：保留组件库独立发布、自动升级、账号隔离、资源校验和缓存预算；不缩短撤销历史，不卸载当前/活跃画板，不改变业务状态，不默认引入 worker/进程池。页面模型按需加载、组件库分包注册和构建工具迁移不列为当前路线。

## 1. 有生命周期归属的代码生成和派生缓存

`components/live/preview-codegen.ts` 的 `createProjectOutput`、`createComponentOutput`、图标、全局变体、自定义函数、项目模块等六处 `computedFn(...keepAlive:true)` 都在模块作用域。当前 `maybeComputedFn` 也采用 keepAlive，需区分 Site/Component 级可复用数据与 ViewCtx/Preview 会话级临时数据。

本轮实际调用 `buildPreviewModules`：同一 fixture Site 依次使用 13 个项目名生成配置，再切回原名，取得原来的同一个 ProjectConfig 对象。这确认旧参数项仍在缓存中；不是已经测出 13 份完整 Site 被复制或真实项目泄漏了多少 MB。`loadVersion()` 会在相同 Studio 会话中替换 Site，Preview/Docs 关闭也不等于销毁整个 JavaScript realm，应检查这些边界上的旧参数、旧生成代码及旧模型是否继续存活。

建议：

- 按当前 Site/Preview 会话拥有缓存；模型替换、会话关闭时释放归属已结束的条目。
- 同一活跃 Site 中保留必要命中；不要把整个共享缓存清空，也不要简单把 keepAlive 全部关闭，否则反复生成代码可能增加 CPU。
- 对变更后不再使用的 ProjectConfig/源码项限制历史保留；对象身份变化不应无限增加缓存项。
- 复用已有 `ownedComputedFn` 的所有权思路，但不要直接将所有公共 selector 改成同一所有者；组件库模型可能被多个活跃画板共享。

[MobX 官方文档](https://mobx.js.org/computeds.html)也提示 keepAlive 有内存泄漏风险。这里的优化对象是明确结束生命周期的缓存；仍然活跃的缓存属于正常工作集。

验收：重复 Preview/Docs 开关、切换修订/恢复草稿、删除并撤销组件后，GC 后旧配置/旧模型数量有界；另一活跃画板和另一 Preview 会话不丢缓存或状态。先测 dominator/retained path，再定修复范围。

## 2. 隐藏画板的局部刷新绕过暂停

`view-ctx.ts` 构造器已根据 `isRenderActive()` 暂停/恢复 `syncQueue`，这部分已有实现，不能再描述为所有隐藏画板都无条件全量求值。

但 `addRerenderObserver()` → `scheduleObserverRefresh()` 走独立 rAF；当同步队列为空，它没有检查 `isRenderActive()`，直接 `flushRerenderQueue()`、`updateCtxPostChange()`。本轮用真实原型方法和确定性 ViewCtx fixture 验证：`active=false / queue.paused=true` 时仍调用渲染更新一次、后处理一次。该探针验证调度路径，不是对真实项目整体 CPU 的 A/B。

建议只合并/推迟隐藏画板的视觉刷新：积累脏标记，恢复可见时一次应用。后台 MCP 的 `awaitSync()`、截图/镜像显式激活必须仍能立即排空。组件的数据状态和必须持续的业务任务不能被一起冻结；不能统一开启 BrowserWindow 后台节流。

验收：多个已缓存页面中触发共享数据变化，隐藏画板的视觉刷新计数下降；当前画板实时更新，后台读取/截图、Preview、保存和重新进入都保持正确；同时记录输入 p95/p99 与后台工作量。

## 3. 撤销保留运行时对象

2026-11-01 更新：完整 Studio 独立 fixture A/B 中，GC 后堆中位数 162.90→162.75MiB，变化小于进程间波动；五个已回收画板的标记 Val 仍全部存活，断开 CDP 的对照相同。原型已撤回，不再按“已确认的大收益”排期。详见[实际验证和边界](../2026-11-01/undo-snapshot-validation.md)。

操作量扩展诊断另跑 12 个新进程：5,000 次独立小修改增长 14.49MiB，1,000 次独立大文本替换增长 21.43MiB，300 轮 121 节点子树增删（600 条命令）增长 296.12MiB。一次性移除全部历史后，子树场景仍高于基线约 197MiB，剩余根未确认，不能全部归因于撤销或泄漏。小修改中全部视图快照的边际释放约 4.75MiB；仅移除 Val/context 引用约 0.01MiB。建议先定位大模型保留根，再独立评估相同变体栈共享、交互内净差分，保持撤销步数和停点。详见[完整方法、边界与竞品源码](../2026-11-01/undo-history-growth.md)。

后续[分项验证](../2026-11-01/undo-candidates-validation.md)已确认 StyleMgr 的规则数组仍持有删除 VS。缓存原型在保留全部历史时，堆约 394.06→375.29MiB、诊断 TaskDuration 约 22.96→12.07s，但关键扩展功能验收不完整，已撤回。快照共享与手势内差分压缩分别仅减少约 4.34MiB、2.48MiB，未达本轮门槛；冷历史只做载荷成本探针，实际 App 收益未知。生产撤销相关文件保持原状，暂不按这些原型宣称已交付优化。

`UndoLog.ViewStateSnapshot` 中仍有 `focusedSelectable`、`currentComponentCtx`、`vcComponentStack`。`ComponentCtx` 强持有 ValComponent；ValNode 强持有 `fibers` 数组和包含 env/wrappingEnv 的 observable box。因此旧撤销视图可能继续连到 React Fiber、props 和已退出画布的运行时图。

当前源码已对纯选择/导航更新覆盖最近视图快照，并在 Studio.dispose 中清理 undo log。两项都应保留，但它们不消除每个真实模型编辑记录中对运行时视图的引用。

较大的优化是只将携带运行时的选中项和组件上下文转换为模型引用与实例身份，保留 arena/frame/Tpl 模型引用及现有变体栈 clone；恢复时在目标 frame 的当前 Val 树重新解析。模型变更记录保留原语义和全部步骤，不通过减少历史条数取得收益。只存 tpl UUID 不够，会丢失重复实例、Slot 或嵌套组件编辑上下文。进一步分析发现，嵌套变体求值要求运行时 owner 栈先匹配，不能仅在 postEval 补回 context；冷恢复仍需原型验证，详见[方案与功能验收边界](undo-view-snapshot-design.md)。

先在真实编辑→切页→撤销/重做场景测出旧 Fiber/Val 的 retained size；这项比普通缓存清理更容易影响正确性，验收需覆盖重复实例、Slot、多画板和组件编辑上下文。

## 4. 非活跃 arena 按预算管理

`liveArenas:6` 和 `CanvasArenaShell` 会让 cached arena 的 iframe/React 树继续挂载，只是 display:none。实际内存是各 arena 下所有 frame 的总和，数量上限无法区分一个轻页面和包含多画板的大页面。

可评估沿用已有 visible/background/cached/dead 状态，只对非活跃 cached arena 使用加权预算与回收策略，继续保护当前画板、编辑会话、后台 MCP 正在读取的 pinned arena。预算可以先以帧数/节点数代理，再由诊断数据校准，避免为测每个 iframe 私有堆而加入生产常驻采样。

先完成缓存/撤销保留治理：如果旧 ViewCtx 卸载后仍被强引用，回收 arena 可能只增加重开耗时，内存并没有明显下降。该项需要实测内存与回开 p95 的交换关系，不建议直接把 6 改为 1。它也不等于把项目模型拆成页面按需下载。

## 5. 加载关键路径和每画板初始化

当前仍是每画板一个 Document，分别初始化 runtime、react-web、组件库注册、React/Val 树。已有 runtime 去重解决的是同一个 Document 内重复注入，不等于不同画板共享一次执行。`scriptExec` 仍将正文作为 script.text 注入。

可分两层推进：

1. **先缩短首帧关键路径。** 既有 0.5.29 App 暖开约 2.33s，其中导航到 Studio 内部计时起点约 1.15s、完整项目 GET 约 0.65–0.67s、首次渲染约 0.25s；它们重叠，不能相加，也不是当前工作区新构建的最新成绩。旧报告把内部消费预取响应的 0.13–0.18s 当完整 GET，会误判优化空间。用当前匹配构建重测入口、Host、初始化偏好/身份、组件同步、模型和首帧；把相互独立且非首帧必需的工作移出依赖链，保留初始化顺序与自动升级语义。
2. **再减少重复编译和长任务。** 评估现有精确版本、完整性校验的不可变代码制品能否使用稳定资源 URL 加载，保留每 Document 注册和回滚语义；用 V8 trace 看 compile/cache consumption，而非仅看下载字节。源码正文缓存与编译缓存不同。[V8 官方说明](https://v8.dev/blog/code-caching-for-devs)指出内联脚本也可能缓存，但依赖 HTML 资源且不跨页面共享，所以不能笼统宣称所有内联代码完全没有缓存。外部 URL 能否在本项目协议/Host/CSP 下受益仍需实测。

`requestIdleCallback` 只决定何时开始，不能把内部同步 React 渲染、注册或求值自动切成短任务。当前已优先目标画板，并等初始画布就绪再做后台加载；下一步应检查每个工作单元的最长阻塞及输入优先级，而不是直接并发初始化所有画板。

`canvas-cache.ts` 还在每个节点的 key 构造中创建数组并序列化变体集合；可以在同一次渲染上下文内验证重复计算是否能复用。此处尚无函数级 A/B，不列为已确认收益，也不增加长期几何/状态缓存。

服务端重复模型 JSON 处理及权限默认参数去重修复已经出现在当前工作区的 `dependency-model-resources.ts` / `DbMgr.ts`，不作为未开始的新方案。其完整端到端收益仍需匹配环境验收。

## 6. 缩略图：减少生成，而非再次隔离进程

当前 Desktop 每个任务启动专用 offscreen BrowserWindow，串行生成，结束后销毁整个 renderer；列表主线程隔离已经完成。当前缓存按 project revision + previewFormat 判断，也已经避免 App 每次发版都使缩略图失效；排队卡片骨架已经静态化。

但生成仍需读取/解包模型、codegen、逐画板渲染、样式/素材序列化和栅格化。旧四卡片实测约 25.7–30.3s、RSS 峰值 1.2–1.6GB 只能作为历史规模证据，不是当前新构建的测量结果；独立进程也不代表整机不消耗 CPU。

较大的方向是利用保存/发布时已经得到的预览产物，或按精确修订与依赖身份生成一次、供授权用户复用，App 缺图时再用当前本地引擎兜底。这涉及持久化产物、访问控制、修订/组件库版本/渲染格式失效规则和接口职责，需要独立设计，不能为了提速随意换请求或上传客户端缓存摘要。

不建议直接恢复常驻截图窗口池：它可能降低重复初始化，但又把全局 codegen 缓存和未知业务状态长期留在进程内。先证明缓存与隔离清理可靠，再比较进程启动、通信和额外内存的总成本。

## 7. 两个有明确场景的辅助项

**更新按钮观察范围。** 离线分析前轮已录制的 0.5.30 真实项目 trace（3 次重开 + 5 次草稿），约 12.7s 的 V8 采样区间内，renderer GC 叶节点采样约 526ms，`checkVisibility` 约 139ms，后者调用栈定位到 `update-ui.js` 的 place/rAF。当前 place 已按帧合并，但仍监听整个 Studio 的 childList/subtree，每次重新查询 header slot 并检查 CSS 可见性；应过滤无关 mutation，稳定持有有效锚点，并在文档/锚点替换时重新定位。不能声称优化后一定省掉 139ms：这是采样估计，不是单次卡顿，也包含样式计算影响；GC 总量也不能单独证明泄漏。匿名压缩函数没有 source map，不做具体业务归因。

**大图导出峰值。** `canvas.cjs` 普通截图路径先创建源尺寸离屏窗口、取得完整 bitmap，再 crop/编码；fullContent 分支已有 20MP 限制，普通路径主要检查高度。可优先避免仅截小元素却先捕获整张大图，评估分区捕获、减少 PNG/base64/NativeImage 的中间副本，保持 CSS 布局和输出像素契约。1440×12000、DPR2 的一份 RGBA 像素理论上约 264MiB，这只是尺寸计算，不是实测峰值。灵动岛的总览 surface 已先缩到 720×400，不能再把它描述成无界全尺寸 surface；此项重点是大图导出，不是 App 日常空闲内存。

## 建议实施顺序与验收

先做隐藏画板刷新和 Preview 缓存的生命周期取证/定向修复。撤销身份快照已做独立原型 A/B，暂缓合入；先定位 frame 销毁后其他运行时保留根，并解决嵌套冷恢复的验收问题，再判断是否需要联合改造。之后评估 cached arena 预算，最后决定更大的运行时制品加载或缩略图产物方案。

验收使用匹配 renderer/Desktop 的隔离构建，固定真实项目修订、窗口/DPR 和账号，至少覆盖：首次打开、暖开、10 次切页、Preview/Docs 往返、持续编辑、缩略图队列、后台 MCP 和大图导出。分别记录首帧/可编辑、输入 p95/p99、各进程 CPU/RSS、GC 后 JS heap/对象归属、原生/GPU 峰值；高开销 trace/快照与计时分轮。

本轮新增结果仅为两个定向探针均通过及已有 trace 的离线分析；没有新实施的性能收益 A/B，没有 Intel 真机数据。诊断脚本和日志保存在本机 `desktop/desktop-report/performance-2026-10-31/remaining-review-*`。共享 JS isolate 中的 Runtime.getHeapUsage 不能直接当成每个 iframe 的私有堆；画板归属需结合对象保留路径和销毁前后对照。
