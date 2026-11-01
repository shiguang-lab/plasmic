# Gemini 性能报告审核

审核基线：`390772252` 的实施前源码。审核对象为同目录的 [性能报告](performance-bottlenecks-and-memory-analysis.md)，其中第 6.4、7 节包含 Electron 优化方案；`docs/performance/performance-bottlenecks-and-memory-analysis.md` 与它内容完全相同。灵动岛首项的当前实现和本地验收见 [实施文档](island-state-lifecycle-optimization.md)。

结论：部分生命周期问题成立，但报告把源码风险写成了已测量的严重故障，且有两处明确误判。不能按原路线图直接实施，也不能承诺零功能变化、内存减半或提速两三倍。审核阶段未修改业务代码。

## 需要修正的主要问题

### 1. 后台节流方案没有覆盖现有后台功能（高）

报告第 6.4 节建议开启 `backgroundThrottling`，并用 `powerSaveBlocker` 保护 MCP，不能直接照做。

- `desktop/src/island.cjs:205` 在动态岛模式主动关闭主窗口节流，再隐藏主窗口；隐藏的 Studio 仍承担自动化执行和预览。
- 离屏缩略图窗口也必须在不可见时完成渲染。不能统一开启节流，假定所有隐藏页面都可暂停。
- `powerSaveBlocker` 控制系统休眠，不是恢复页面定时器和动画帧频率的开关。两者职责不同，见 [Electron 电源阻止器文档](https://www.electronjs.org/docs/latest/api/power-save-blocker) 与 [WebPreferences](https://www.electronjs.org/docs/latest/api/structures/web-preferences)。
- 改 `main.cjs` 的默认配置还不够，动态岛路径会再次调用 `setBackgroundThrottling(false)`。

可保留的方向：测量普通窗口闲置、最小化、动态岛闲置、动态岛执行任务等状态的实际 CPU，再设计按状态节流。必须验证隐藏窗口中的 MCP、保存、导航、截图和超时，不能承诺 CPU 接近零。

### 2. 缩略图“瞬时多窗口并发”的判断错误（高）

- `desktop/src/dashboard-preview.cjs:13` 已有 Promise 队列，窗口在 `queue.then()` 内创建，同一个管理器中的任务串行执行。
- `platform/wab/src/wab/client/components/dashboard/preview/queue.ts` 还有客户端串行队列。
- `ProjectPreview.tsx:69` 已有 IntersectionObserver，隐藏页面会取消订阅；视口懒加载不是待实施功能。
- 每次任务的完成、异常、取消、超时都会走 `finish()` 销毁窗口，并移除监听器。不能将正常创建/销毁等同于窗口泄漏。
- 加载的是专用 `preview-host.html` / `canvas-preview`，不是完整 Studio 编辑器入口。

窗口复用可能节省启动和运行时初始化，但会增加常驻内存，也会失去当前“销毁整个进程以清理代码生成缓存、运行时和定时器”的边界。应先比较单张生成耗时、峰值内存和任务结束后的回落，再决定是否复用。原方案不能作为“消除并发”的修复。

### 3. “每次 Commit 全量遍历”与当前实现不符（高）

`globalHook.ts:956` 区分首次挂载与更新；更新调用 `traverseUpdates()`。`traverseFiber.ts:75` 会根据当前/旧 Fiber 的 child 是否相同跳过未更新子树，另有 Suspense 分支处理。

字符串拼接和遍历仍可能耗时，但“把全量改成增量”不是当前缺失的功能。仅按 `flags/subtreeFlags` 再过滤，可能遗漏选择树需要的 clone 计数、Slot 连接等更新，不能作为简单低风险改动。先打点现有遍历，再决定热点优化。

### 4. 撤销的内存风险成立，但原方案会改变功能（高）

`undo-log.ts` 没有步数上限，`StudioCtx.currentViewState()` 保存真实 Selectable；ValNode 有 Fiber 引用。这条保留链成立，但尚未测出每步保留量或长期内存斜率，不能称为已证实的 GB 级泄漏。

- 限制为 40～50 步会减少可撤销范围，不能与“100% 保持功能”同时成立。
- 只替换 `focusedSelectable` 不完整；`currentComponentCtx` 和 `vcComponentStack` 也需检查。
- `{valKey, tplUuid}` 不足以恢复所有多画板、重复实例、Slot 选择与组件编辑上下文。现有恢复还使用 frame、clone key 和组件栈。
- 不能清空活跃 ValNode 上的 fibers 来减内存；画布选择、几何定位等仍依赖它。

建议先尝试把历史视图状态从运行时对象引用改成可恢复的轻量标识，保留当前撤销范围；这属于中等风险改动，需覆盖撤销/重做、删除后恢复、多画板、重复实例、Slot 和组件内编辑，不应列为最简单的首项。

### 5. Canvas 缓存有风险，但“所有 iframe 永不回收”没有证据（中）

报告指出的模块级强引用 Map 存在，但忽略了已有清理链的作用：

- `canvas-cache.ts:289` 的 `deleteEntry` 会删除失去观察者的 computed，DeepMap 会递归删除空子 Map。
- `ViewCtx.dispose()` 释放观察者；`CanvasCtx.dispose():766` 使用 `flushSync` 卸载 React 根节点，并释放 frame state。不能仅因没有公开 clear 方法，就断定卸载不触发清理。

另发现一个更具体的保留点：`deep-map.ts:86` 的 `last` 在 entry 删除后仍保留该 entry 的 args。对当前 DeepMap 源码做内存内转译和直接运行，删除后 `store.size === 0`，但 `last.args[0]` 仍等于原始对象。这证明最后一次访问的键仍被持有；不证明所有历史画板都被缓存无限保留。

按 ViewCtx 隔离缓存是候选，但先用重复进入/离开画布后的堆快照确认保留路径。不能未经测量直接全局清空缓存，破坏其他活跃画板的缓存和清理回调。

### 6. Map 清理缺口成立，但清理方案缺少归属规则（中）

`getEnvId()` 每次产生新 id，写入 `envIdToEnvs`；没有找到对应的 delete/clear。`fullKeyToEnvId`、`valKeyToOwnerKey` 也缺少清理，报告发现方向正确。

但 Map 值是字符串或 WeakRef，不能据此说它们强引用了整个环境对象或整个 iframe。WeakRef 的目标可回收，残留的 key/WeakRef 条目仍会占空间。

当前 `computeFullKey()` 不包含 frameUid，因此不能在一个画板销毁时无条件删除同 key 的全局映射。实施前需明确多画板共用 key 的所有权；清理旧 env id 还要保护当前 Fiber/DOM 仍在使用的 id。建议优先记录条目增长和实际活跃引用，再做有归属依据的清理。

### 7. DocsPortalEditor 的 Model 释放缺口基本成立（中）

`DocsPortalEditor.tsx:68`、`:112` 创建目标和依赖 Model，`:167` 清理只处理 autorun 和监听器，没有释放这些 Model。当前 react-monaco-editor 包的卸载清理释放 Editor 与订阅，不负责释放此处创建的所有 Model。

这是值得处理的明确生命周期缺口，但局限于文档/代码预览路径；不能据此认定普通画布启动一定存在 TS Worker 内存问题。5.6MB 文件体积不等于 Worker 已启动或占用 150～300MB。

方案应明确 Model 的会话归属和共享关系，在不再使用时释放目标、依赖和额外类型声明；不能在任意组件 effect 清理中直接释放其他编辑器仍在使用的 Model。通用 `useMonacoEditor()` 已把自己的 Model 加入 disposables，不应把全部代码编辑器描述成未清理。

### 8. DOM 读取、GPU 与硬件结论缺少实际证据（中）

沿祖先读取样式与几何存在开销，但 10 次读取不等于 10 次重排；需结合布局是否失效及读写交错判断，见 [Chrome 团队关于布局颠簸的说明](https://web.dev/articles/avoid-large-complex-layouts-and-layout-thrashing)。`inspectCanvas()` 是显式审查工具路径，不能直接当作持续 mousemove 的成本。

可试一次测量内复用祖先样式/几何结果，不能跨变体、滚动、缩放、样式变化长期缓存而无失效规则。

透明窗口不等于一定关闭硬件合成。报告未提供 GPU feature status 或 Windows/Linux 实机 trace；改成不透明也会改变动态岛视觉。[Electron 透明窗口说明](https://www.electronjs.org/docs/latest/tutorial/custom-window-styles#transparent-windows) 没有给出报告承诺的这种普遍结论。

同样，iframe 执行上下文不能直接等同于独立 Chromium 进程和独立 V8 堆，不能按每个 iframe 100～200MB 简单相加估算进程常驻内存。

## Electron 首项：状态/图片传输去重及退出停用

### 退出灵动岛后，哪些已停止，哪些还在执行

这里的“退出”指切回普通窗口或全屏，不是仅把灵动岛卡片收起，也不是退出整个应用。

| 逻辑 | 退出后的当前行为 | 判断 |
| --- | --- | --- |
| 500ms Studio 状态轮询 | `changeMode()` 调用 `stop()`，清除定时器；`refresh()` 也检查 mode | 已停止 |
| 500ms 截图轮询、40ms 鼠标命中检测 | 对应定时器清除，函数还有 mode 条件 | 已停止 |
| 进行中的截图任务、截图合成窗口 | `mirror.close()` abort 等待链并销毁 surface，退出后的结果不能发布；已提交给页面的 JS 不因此被强制抢占 | 已有退出清理 |
| 进行中的 Studio 状态读取 | 不取消底层读取，但返回后检查 mode/epoch，丢弃旧结果 | 不再周期发起，可能还有一次收尾 |
| 灵动岛自身的 BrowserWindow | `window.hide()`，没有 destroy；`backgroundThrottling` 仍为 false | 窗口及渲染上下文继续常驻 |
| 活动、语言、外观、更新和身份事件 | 订阅保留，`publish()` 不检查 mode/可见性，仍向隐藏窗口发送完整 snapshot | 仍有事件驱动的 IPC 和页面处理 |
| 路由变化触发账户摘要 | `attach().invalidate()` 无 mode 判断，调用 `updateContext(..., true)`，可能执行 `account.refresh()` | 普通窗口导航仍可触发灵动岛专用请求 |
| 截图像素缓存 | 外层 `image` 清空，但 `createIslandCapture()` 的 `cached` 未在 close 时清空 | 最后一份图片缓存仍保留，规模有限 |

退出后的账户请求不是持续轮询：没有请求进行中、身份有效时，导航强制刷新可能读取 `app-ctx`、项目列表；存在选中工作区时还可能读取工作区详情。退出前已经开始的账户请求也没有在 `stop()` 中取消。普通窗口每 5 秒的工作区记录是另一条应用功能链，不应误删。

源码诊断使用模拟 Electron、可控定时器、模拟接口执行真实 `createIsland()`：进入后有 3 个 interval，切回 window 后为 0；灵动岛隐藏但未销毁；退出后一次 activity 通知仍产生 1 次隐藏窗口状态推送；一次普通窗口导航调用了 2 个模拟账户接口，新增 Studio 状态读取为 0。诊断未启动真实 Electron 窗口、未发网络请求，也不代表已测出 CPU/RAM 收益。

另外执行 `node --test tests/island-capture.test.cjs`，10/10 通过，覆盖截图资源释放与进行中任务取消；它不覆盖隐藏灵动岛窗口的实际 GPU/CPU 占用。

### 方案与验收范围

第一项应同时包含运行时去重与退出停用，而不是只比较 snapshot：

1. 灵动岛启用时，状态未变不重复推送，图片未变不重复携带 base64；反馈区域、保存状态和任务进度等独立变化仍及时更新。
2. 退出后停止灵动岛专用状态 IPC 和账户摘要刷新，防止退出前的异步结果继续产生 UI 工作；身份失效等必要状态可记录失效标记，重新进入时刷新。
3. 明确隐藏窗口和最后图片缓存的释放策略。优先比较退出时销毁与短时保留的内存及重新进入延迟，不能把 hide 当作内存已释放，也不能未经测量承诺销毁能省固定内存。
4. 保留主窗口、MCP、保存、更新和工作区记录的正常行为。再次进入时先同步最新上下文，避免显示旧项目、旧账户或旧截图。

验收需覆盖退出前后空闲、导航、MCP 执行、主题/语言变化、更新事件，以及截图/账户请求进行中退出和快速反复切换。检查退出后无灵动岛周期任务和专用账户新请求、不再发送隐藏页面状态，重新进入能恢复最新画面。

### 必须保持的退出与开启行为

此项优化以功能恢复正确为前提；仅证明退出后开销下降不算完成。

| 场景 | 必须满足的行为 |
| --- | --- |
| 显示主窗口 / 显式退出灵动岛 | 保留两者已有的关闭偏好差异；主窗口、焦点、macOS Dock/应用激活状态正确，不退出应用、不丢编辑内容 |
| 重新开启 | 状态订阅和轮询只恢复一份；账户、当前项目/页面、主题、语言和更新状态重新同步；未就绪时显示加载状态，不显示旧项目截图 |
| 退出期间切换项目或账户 | 再开启显示新的项目/账户；退出前未完成的旧请求不得覆盖新状态 |
| MCP 或保存进行中退出/开启 | 只停用灵动岛专用 UI 工作，不取消用户的实际任务、保存或预览；任务进度与结果重新开启后正确展示 |
| 截图/摘要读取中退出 | 旧结果不能重新打开浮窗或覆盖新画面，下一次开启不被旧 reading/capturing 标记卡住 |
| 连续快速切换普通窗口、全屏、灵动岛 | 最终模式与最后一次操作一致，窗口显示和持久化偏好一致；不累积窗口、定时器或监听器 |
| 关闭主窗口后再进入、应用重启 | 保持记住/不记住关闭选择及启动模式恢复，普通窗口和灵动岛启动均可用 |

若采用退出时销毁浮窗，重新开启必须重建 preload/IPC、事件订阅及首次状态同步，不能复用已销毁的窗口；销毁资源也不能意外触发“用户退出模式”的回调或改变关闭偏好。

实施验收已在隔离配置的真实 Electron 中运行 `tests/island-native.cjs`、`tests/close-mode-native.cjs`，并补充退出后 IPC/账户请求计数、在途任务退出和反复重开的检查。具体测试结果、静态资源来源和 fixture 边界见 [实施文档](island-state-lifecycle-optimization.md)。

以上为实施前的调查与验收要求；该首项已实现并通过本地验收，当前行为及测试边界见 [实施文档](island-state-lifecycle-optimization.md)。

## 建议保留和调整的路线

| 顺序 | 工作 | 当前判断 |
| --- | --- | --- |
| 1 | 定量检查 env 映射增长、DocsPortal Model 数量，并明确归属后清理 | 源码缺口明确，优先验证和处理 |
| 2 | 核查 DeepMap 最后 entry 引用及卸载后的实际对象保留 | 已有具体复现点，避免先重构整套缓存 |
| 3 | 撤销视图状态轻量化 | 有价值，但恢复语义复杂，单独实施和验证 |
| 4 | 动态岛闲置状态、metadata 轮询合并/事件化 | 可评估；不应只盯住每 5 秒菜单检查 |
| 5 | 几何读取热点与截图窗口复用 | 先录制 CPU/内存证据，再决定 |
| 暂缓 | 统一后台节流、自动减少撤销步数、自动卸载视口外画板、不透明动态岛 | 可能改变功能或执行时序，不能直接纳入无损优化 |

`main.cjs` 的 5 秒 capture 有进行中任务去重，菜单只在工作区记录发生变化时重建；它还承担最近项目和视图恢复记录。动态岛模式另有 500ms 状态刷新，以及仅在展开、允许捕获等条件满足时执行的截图。事件化是合理方向，但需覆盖最近项目/视图持久化、保存和活动上下文，不能只删定时器。

保留 Electron、优先修具体资源生命周期是合理的当前方向；报告没有提供替换框架的功能原型或对照性能，不能支持迁移收益估算或“只有 Electron 才能实现所有能力”的绝对判断。

## 验证边界

审核阶段完成源码和调用链审核、两份报告一致性核对，以及 DeepMap 删除后键保留的最小复现。未录制低端机 CPU trace、堆快照、GC/Swap/GPU/温控数据，也未执行性能 A/B；报告中的 70/30 归因、固定 RAM/FPS/GC 数字及 50%/70% 收益均不能作为验收指标。灵动岛首项后续的功能修改与本地验收单独记录在实施文档中，尚未发布。
