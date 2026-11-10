# Desktop 定向性能诊断

`canvas-startup.cjs <privateFixtureDirectory> <runId>` 复用 `real-project-open.cjs` 和 `PERF_BUILD_ROOT` 的离线载荷、独立 profile，在真实求值器中仅重置首渲染就绪标记，将空闲回调延后 1000ms，验证活动画板首次求值不会等待空闲且模型未变化。结果写入原报告的 `schedulingQualification`。这是受控调度验证，不代表普通项目打开节省一秒；同机普通打开的对照与失败路径说明见 [画布启动诊断](../../../docs/performance/2026-11-10/canvas-startup.md)。

隐藏 SVG 与 Worker 候选的完整四组交叉对照、CSS 原生阻塞验证、回归及撤回决定见 [优化执行验证](../../../docs/performance/2026-11-04/loading-priority-optimization-validation.md)。不以后台可播放、单项中位数或减少 DOM 节点代替整体加载验收。

加载展示的净影响应使用实际历史骨架卡片作基线，保持同一业务初始化与离线载荷；“关闭动画后的 Logo”和“更早的 SVG Logo”均不等同于原骨架。恢复范围、首屏资格检查及同轮结果见 [骨架基线验证](../../../docs/performance/2026-11-04/loading-skeleton-baseline-validation.md)。

`PERF_BLOCK_PHYSICAL_INPUT=1` 可为 `real-project-open.cjs` 的自动计时窗口阻止真实键鼠、粘贴和拖放，并记录阻断计数，脚本交互继续执行。默认关闭，需真实输入的功能探针不要启用。相同对照各侧应使用相同设置；意外业务写入或 renderer error 应使该轮失败。动画重复播放的定位及同轮结果见 [宿主动画验证](../../../docs/performance/2026-11-04/loading-animation-ownership-validation.md)。

`electron desktop/tests/performance/brand-loading-native.cjs <privateOutput> <rendererDirectory> <animationSource>` 在可见隔离窗口读取实际构建 HTML，并通过本地 HTTP 提供其中的静态资源。它分别在构造和流光阶段主动阻塞 renderer 主线程 1200ms，从浏览器进程捕获画面，检查构造填充继续推进、长等待、重复播放、卸载、减少动态效果切换；`PERF_LOADING_THEME=dark` 另验深色线框。输出 Document TaskDuration、JS 帧/属性写入、进程工作集快照和截图。不能与项目计时、构建、测试并行；画面变化不是显示 FPS，TaskDuration 不是整机 CPU。当前实现及取舍见 [构造阶段对照](../../../docs/performance/2026-11-04/loading-construction-compositing.md)，上轮流光见 [流光对照](../../../docs/performance/2026-11-04/loading-animation-compositing.md)。

`electron-startup.cjs <privateFixture> <newOutputDirectory>` 从全新隔离 profile 启动生产 Desktop main/preload，使用同目录格式的离线项目夹具。父进程须在启动 Electron 前立即把 Unix 毫秒时间写入 `PERF_LAUNCHED_AT`。输出 `startup.json` 中的 Electron 版本、app ready、shell started 和项目卡片 DOM 就绪时间；不测量合成器呈现，不控制操作系统文件缓存，不访问正常用户 profile。两个 Electron 版本须使用相同源码及 renderer，串行交错运行；项目打开另用 `real-project-open.cjs`，前两次预热、后四次统计。

仅在开发用 Electron 和独立 profile 运行；不修改发布 fuses、manifest 或生产调试配置。完整结果与边界见 `docs/performance/2026-10-31/main-memory-draft-implementation.md`。

- `main-import.cjs <desktopRoot> [output.json]`：新进程 require(main)，不 bootstrap。
- `seven-issues.cjs reference|hidden|capture|lease <output.json>`（Electron）：隔离的原生资源与功能对照；`dashboard <output.json> <privateFixture>` 使用实际 bundled 引擎。`seven-processes.cjs fixed-mcp|images <output.json>`（Node）做独立新进程对照；`seven-studio.cjs <privateFixture> <output.json>`（Electron）复用匹配 `build-baseline` 的离线 Studio fixture，自动新建私有目录。只输出指标，不修改生产行为；边界及结果见[七项实测](../../../docs/performance/2026-11-01/seven-issues-analysis.md)。
- 修复后的对照直接运行生产实现：`PLASMIC_PERF_DESKTOP=<beforeDesktopRoot>` 指向保留的基线源码，省略时使用当前实现；`PLASMIC_PERF_CANVAS=webgl` 验证 WebGL（默认 2D）。`seven-processes.cjs fixed-mcp <output.json>` 要求提供该基线路径，并比较旧 Electron transport 与 `build:mcp` 生成的实际 SEA helper。各性能场景串行执行，禁止同时运行构建或测试；结果见[修复收益](../../../docs/performance/2026-11-01/resource-fixes.md)。
- `first-use.cjs <desktopRoot> <output.json> image`：首次/并发图片与循环延迟。
- `reference-first-use.cjs <desktopRoot> <output.json> <absoluteNodeBinary>`：真实 SDK/stdio fixture，非真实 Pen 启动。
- `retention-build.cjs current|<sourceDirectory> <fixtureOutput>`：真实 DocsPortalEditor/Monaco、DeepMap 与抽取的 getEnvId，使用 React 19 root 和当前 Monaco Workers；业务生成、RenderingCtx 和环境持有者为 fixture。
- `retention.cjs <fixtureOutput> <reportDirectory> [--verify] [--summary-only]`：CDP 三快照和十次循环；verify 检查关闭一编辑器后另一编辑器输入/undo。快照交给 MemLab 离线分析。
- `cache-pipeline.cjs <desktopRoot> <inventory.json> <reportDirectory>`：inventory 是 `{file,key,diskBytes}` 数组，指向正常 JSON/base64 缓存的只读副本。只处理真实正文，按原格式写入独立缓存，禁止远端补下载。
- `studio-pipeline.cjs <extractedInstalledAppDirectory> <diagnosticProfile> <existingProjectId> <reportDirectory> [serialized]`：使用提取的匹配 renderer 和已独立登录的诊断 profile；阻止项目写入。先用 `PLASMIC_DESKTOP_PROFILE=<diagnosticProfile>` 启动开发 App，正常登录并打开目标项目，再退出 App 后运行诊断。脚本拒绝默认正常 App profile，并取得诊断 profile 的单实例锁；不读取其他 profile 的凭据，不在结束时删除诊断 profile。serialized 在旧 renderer 的草稿 API 边界注入当前源码的 JSON 字符串传输，使用当前实际 preload/主进程。普通新 renderer 无需此注入。
- `node --test desktop/tests/performance/react19-rendering.browser.cjs`：构建并在 Chromium 验证上述两个 fixture 的挂载、更新、卸载、编辑器隔离与资源清理；不运行性能计时。
- `skeleton-performance.cjs <privateOutputDirectory>`：生产 Ant Design Skeleton，12 个可见预览的动态/静态 2 秒窗口对照，另有单个动画的正向控制。测量主线程 TaskDuration，不是项目打开耗时。
- `studio-optimization-fixture.cjs <privateFixtureDirectory> <buildVariant>`：从 `build-<buildVariant>` 运行生产 Studio，所有 HTTP(S) 使用离线响应、WebSocket 阻断；独立 profile。`PERF_FUNCTIONAL=1` 验证公开重命名操作及撤销/重做，`PERF_ENV_GC=1` 执行 20 轮编辑/撤销与诊断 GC；`PERF_KEEP_ALIVE=6|3|2` 比较六个内存画板的返回与进程 RSS。`PERF_RUN_ID` 为新 profile 添加区分，禁止指定正常 App 的 userData。完整边界见 [五项结果](../../../docs/performance/2026-10-31/five-optimizations-validation.md)。
- `PERF_PREVIEW_CACHE=1` 调用 `preview-cache.cjs`：隔离构建额外入口必须包含 `preview-cache-entry.ts`，发布构建不得包含。复用私有 fixture 的五份模型/资源 JSON，实际保存并恢复 12 次（`PERF_PREVIEW_CACHE_CYCLES=36` 可延长），检查 Live/Docs 模块、保护消费者、暖缓存和弱引用；`PERF_PREVIEW_CACHE_SNAPSHOTS=1` 另轮采三快照。`PERF_FRAME_INTERACTIONS=1` 在该已创建的混合画布上执行双 Document 的销毁/保护/撤销重建行为验证，`PERF_FUNCTIONAL=1` 再检查模型编辑/undo/redo。正式 A/B 与构建、测试、MemLab 分轮串行执行。结果见 [缓存与画布生命周期验证](../../../docs/performance/2026-11-01/preview-cache-lifecycle-validation.md)。

Preview 诊断构建使用私有 Rsbuild config 继承 `platform/wab/rsbuild.config.ts`，仅覆盖 `source.entry.index` 为源码 `platform/wab/src/wab/client/main.tsx` 与 `desktop/tests/performance/preview-cache-entry.ts` 两个绝对路径，以及 `output.distPath.root` 为私有目录的 `build-<variant>`。不得覆盖资源版本校验。运行 `PERF_PREVIEW_CACHE=1 PERF_RUN_ID=<freshId> desktop/node_modules/.bin/electron desktop/tests/performance/studio-optimization-fixture.cjs <privateFixtureDirectory> <variant>`。三快照可交给 MemLab `find-leaks --baseline <baseline> --target <target> --final <final> --work-dir <privateAnalysisDirectory> --leak-filter <repo>/desktop/tests/performance/preview-cache-leak-filter.cjs`；过滤器专门查看被标记旧 Site 的强保留路径，不把 WeakMap ephemeron pair 本身认作普通强引用。
- `PERF_UNDO=1` 在同一离线 harness 中执行 `undo-studio.cjs`：使用独立项目 fixture，创建十个临时 arena、各做两次模型编辑，再执行 20 次 undo/redo。`PERF_UNDO_ROUNDS=0` 只做保留测量；`PERF_UNDO_SNAPSHOTS=1` 保存三快照；`PERF_UNDO_GC_CONTROL=1` 使用诊断专用 `--expose-gc` 并在场景前断开 CDP，不能与快照模式同时开启。`PERF_UNDO_FUNCTIONAL=1` 要求隔离构建入口提供 `__undoFunctional()`；不会给发布入口添加该能力。冷恢复失败、console error 或超时均不能算通过。结果与原型处置见[撤销快照验证](../../../docs/performance/2026-11-01/undo-snapshot-validation.md)。
- `PERF_UNDO_GROWTH=small|text|subtree|grouped|drag` 执行 `undo-history-growth.cjs`，要求隔离入口提供 `__undoGrowth`。分别测 5,000 次独立小修改、1,000 次 16,384 字符整段替换、300 轮 121 节点子树添加/深删、5,000 次按每 50 次分组的输入更新；drag 使用已有 startUnlogged/stopUnlogged 边界，每 50 次边距更新是一手势。使用 `PERF_RUN_ID=r1` 区分新 profile 和结果。每点检查历史数、两轮 GC 后 JS 堆；最后验证一次 undo/redo，再移除诊断根做归因。待保存缓冲清理不等于真实保存，根移除不属于产品行为，分组对照也不能用于合并独立用户操作。不与 `PERF_UNDO` 等其他场景混跑。结果和可复现构建位置见[操作次数与内存](../../../docs/performance/2026-11-01/undo-history-growth.md)。
- `PERF_UNDO_RETAIN=1` 执行 `undo-retention.cjs`：121 节点子树反复添加/深删，执行完整客户端保存并由离线 HTTP fixture 确认。`PERF_RETAIN_OPERATIONS=100|600` 控制正偶数命令数；`PERF_RETAIN_SNAPSHOTS=1` 取基线、目标及诊断历史释放后的三快照。`PERF_RETAIN_CPU=1` 记录原生 Performance 指标，`PERF_RETAIN_LATENCY=1` 做 20 组 undo/redo 就绪采样；`PERF_RETAIN_FULL_UNDO=1` 遍历所有历史再重做。快照、计时和并行构建分轮；不能将本地确认说成真实后端保存。原型、门槛及撤回处置见[候选验证](../../../docs/performance/2026-11-01/undo-candidates-validation.md)。
- `PERF_UNDO_COLD_COST=1` 执行 `undo-cold-cost.cjs`，隔离入口须提供 `__undoColdEncode` / `__undoColdDecode`。仅测 300 棵已删除子树的 bundle/JSON、IPC 返回、gzip、临时写入、解析和反序列化成本；保留真实 UndoLog，仅在受保护诊断目录写压缩载荷。不实现冷历史回放、生产落盘或账号存储。载荷体积与临时持有态不是已实现的 App 内存收益。

撤销功能验收使用 `undo-build.config.ts`，显式加入 `undo-functional-entry.ts` 和 `undo-growth-entry.ts`；必须提供私有的 `PERF_BUILD_OUT`。正式入口不引用这些文件。先用相同功能修复基线分别构建两侧，运行 `PERF_UNDO=1 PERF_UNDO_FUNCTIONAL=1 PERF_UNDO_ROUNDS=0`，通过后另起进程计时。功能脚本检查合法模型、冷恢复、真实 UI/MCP 删除及撤销选择、双画板样式和实际 DOM computed color；等待模型队列和相关 frame 同步，不能用活动 frame 的就绪替代所有异步工作完成。

`PERF_UNDO_REOPEN=1` 在完整功能轮后执行一次全量客户端保存，再重新加载 Studio，核对组件、Slot/变体/节点身份和画板位置。仅此模式会把离线保存请求的完整 bundle 作为下一次启动数据；不写真实服务端或 fixture 源文件。与 `PERF_UNDO_RETAIN=1 PERF_RETAIN_FULL_UNDO=1` 合用可先遍历被测构建保留的全部撤销/重做步骤，再运行复杂功能场景、保存及重开。全历史轮和计时轮分开。归档的无限历史构建曾验收 600 次撤销及 600 次重做，结果见[功能通过后的对照](../../../docs/performance/2026-11-01/undo-functional-qualified-ab.md)。

当前源码保留最近 50 个步骤。`undo-retention.cjs` 和 `undo-history-growth.cjs` 的期望上限默认是 50；`PERF_RETAIN_HISTORY_STEPS` 只声明被测构建的期望行为，不修改生产限制。复测旧无限历史构建的 600 命令场景时显式设置为 600。`PERF_RETAIN_FULL_UNDO=1` 遍历实际预期保留的全部步骤，并检查最旧边界和最终记录数；当前构建是 50 次 undo/50 次 redo，内部记录 51 条。旧冷历史载荷探针要求归档的无限历史构建和 300 个删除根，不能直接用当前 50 步构建复现。

`PERF_UNDO_BOUND=1` 在复杂功能场景的重复实例、Slot 和嵌套上下文中分别追加 120 次编辑，再验证原有真实编辑的撤销恢复。`PERF_UNDO_VERSION_RESTORE=1` 与 `PERF_UNDO_REOPEN=1` 合用：离线服务暂存完整修订，实际客户端保存检查点后继续编辑 125 步，再通过修订列表及 `StudioCtx.revertTo` 恢复超出 50 步窗口的检查点。候选同时设置 `PERF_RETAIN_HISTORY_STEPS=50` 以断言边界；这不是线上数据库或权限验收。记录和测量边界见[50 步历史验收](../../../docs/performance/2026-11-01/undo-history-50.md)。

离线项目 fixture 目录须私有，包含 `project-response.json`（正常所有者的项目启动 GET）、`model-resources.json` 与 `plume-resources.json`（路径映射至 `{body,headers}`）、`plume-opening.json`（真实 Plume 包响应）、`code-resources.json`（完整明确版本 URL 映射至缓存 `{key,body,headers,digest}`，body 为 base64）及对应生产构建。使用只读导出或一次性数据库副本生成，正文、凭据、缓存和生成 profile 不得提交。辅助评论/AI 状态/角色为空 fixture，依赖元信息固定在项目版本；该脚本不验收认证、自动升级、真实保存/发布或 Plume 插入 UI。报告原始文件也留在私有目录，仅将脱敏指标整理入仓库。

`PLASMIC_PERF_DESKTOP` 可指定保存的 Desktop 基线源码；`PLASMIC_PERF_TRACE=0` 用于墙钟对照。trace 模式与计时分轮，禁止并行跑 A/B。脚本不会写业务项目，但本地草稿、认证和缓存均须使用真实账号的正常规则；报告不输出凭据或模型正文。

准备离线 fixture 时使用已有授权的只读导出。不要复制或跨进程共用正常 App 的刷新凭据：重复兑换旧令牌会触发 IAM 重放检测，撤销整条设备授权及其 Cookie。在线诊断必须独立登录并使用自己的 profile。离线场景本身不需要刷新凭据。

MemLab 为临时诊断工具，未加入 package.json。示例：

```sh
PUPPETEER_SKIP_DOWNLOAD=1 npm install --prefix /tmp/plasmic-memlab-diagnostic memlab@2.0.6 --no-audit --no-fund
/tmp/plasmic-memlab-diagnostic/node_modules/.bin/memlab find-leaks \
  --baseline /tmp/retention/baseline.heapsnapshot \
  --target /tmp/retention/target.heapsnapshot \
  --final /tmp/retention/final.heapsnapshot \
  --work-dir /tmp/retention/memlab --trace-all-objects
```

MemLab 候选数不是已确认泄漏数。JS heap、原生/GPU 和 RSS 必须分别解释。保存的压缩 trace/快照仅在本机 `desktop/desktop-report/performance-2026-10-31/`，不纳入发布资源。

从列表打开项目的候选对照使用 `real-project-open.cjs <privateFixtureDirectory> <runId>`。`PERF_BUILD_ROOT` 显式选择构建；使用 `PERF_OPENS=6`，前两次用于填充缓存及预热，其余四次计时。所有候选与基线必须串行执行，不能并行构建或分析。`open-build.config.ts` 要求提供独立的 `PERF_SOURCE_ROOT` 和 `PERF_BUILD_OUT`；从同一冻结源码建立基线和每个独立候选，并在冻结源码的 `platform/wab` 目录构建。`prepare-open-build.cjs <output> <matchingInstalledAssets> <frozenSourceRoot> <variant>` 仅补齐未生成且确认未变更的 runtime 资产，写入诊断构建身份与指纹；不能把它称为发布包。

`PERF_OPEN_FUNCTIONAL=1 PERF_OPENS=1` 执行真实模型的编辑、撤销/重做、完整客户端保存和重新加载，保存仅由进程内 fixture 确认；`PERF_OPEN_COLD=1` 在复杂样本中额外检查销毁画板后的恢复。GP 样本另检查真实 Preview 表格分页。`PERF_OPEN_MEMORY=final` 在六次自然打开后返回列表，末尾才执行诊断 GC；RSS 为进程 working set 之和，不能视作实际物理内存。`PERF_OPEN_INPUT=1` 测 Layers 控件事件处理及两次 rAF 的往返时间，只是响应代理指标，不是操作系统输入延迟。功能、计时、响应代理和内存分轮运行。五项候选的保留/撤回及完整验收见 [画布打开候选结果](../../../docs/performance/2026-11-01/canvas-open-candidates.md)。

在含精确 `antd-icons` 依赖、原生内容容器的 GP 回放中，加 `PERF_OPEN_HOSTLESS=1` 验证启动时未安装图标库、插入条件分支后加载、条件及插入撤销/重做、真实图标 DOM，以及保留新增引用后的完整保存和重开。加 `PERF_OPEN_CUSTOM_HOST=1` 使用隔离自定义 Host：它注册按名称动态查找图标的组件，模型不直接引用该图标，验收全量库加载和动态组件的编辑、撤销/重做及保存重开。此 Host 只由回放协议提供，所有保存仍在进程内；两个标记仅用于功能轮。

`PERF_OPEN_COUNT_STYLES=1` 仅诊断轮统计各 Document 的计算样式调用，不与无采样计时混用。`PERF_OPEN_NATIVE=empty|restore|conflict PERF_OPENS=2` 启用 `open-native-bridge.cjs`，经原生 Electron IPC 执行生产草稿/工作区实现并恢复非默认视口；身份使用 fixture，仍不验收真实 IAM。恢复/冲突场景完整 reload 文档；加 `PERF_OPEN_FUNCTIONAL=1` 可在恢复后再执行原有编辑、Preview 和保存重开。`PERF_OPEN_NATIVE_OTHER=12` 在私有目录准备其他项目草稿；`PERF_DESKTOP_ROOT=<baselineDesktopSrc>` 可选择冻结的 Desktop 基线，省略时使用当前源码。

Markdown/代码高亮的启动与首次使用对照使用 `lazy-renderers-build.config.ts`，沿用 `PERF_SOURCE_ROOT`、`PERF_BUILD_OUT` 的私有冻结源码约束。额外诊断入口只安装一个动态导入函数，不在启动时导入消息渲染器。`PERF_OPEN_RENDERERS=1 PERF_OPENS=1` 在画布就绪后挂载真实 AiMarkdown、CodeDisplay 和 CodeSnippet，验证表格、公式、不执行原始 HTML、不加载外部图片、代码高亮、节点定位、复制选区、全屏、流式更新、主题、共享 Scrollbar 及重开，并记录首次/暖使用耗时。复制命令在该隔离 Document 中拦截，不写系统剪贴板；验证结束卸载探针并恢复主题。共享 Scrollbar 默认延迟初始化，脚本等待真实滚动组件就绪，不以 token 出现作为其就绪条件。

首次使用与无采样打开计时分轮。`PERF_OPEN_MEMORY=final PERF_OPENS=6 PERF_OPEN_RENDERERS=1` 在六次自然打开的最后一次显示消息和代码，返回列表后才做诊断 GC；工作集总和包含共享页重复计数，不能当作系统实际物理内存。`trace` 模式与对应 source map 可用于检查启动实际请求/执行的 chunk 是否包含高亮语言注册；不能把开启 trace 的墙钟时间作为正式 A/B 成绩。

`PERF_OPEN_MEMORY_SETTLE=1` 在回收后再等待一秒和五秒记录工作集，并在第二次诊断 GC 后再次记录，用于区分存活堆与工作集释放时机。结果见[语法高亮验收](../../../docs/performance/2026-11-01/lazy-renderers-validation.md)；最终产品仅保留代码展示按需加载。

`node desktop/tests/performance/draft-directory.cjs <baselineDesktopSrc> <privateFixture> <privateOutput>` 用真实项目/依赖载荷构造分项目草稿并独立比较目录读取。各次摘要缓存为空，系统文件缓存未受控；方法耗时不能当作画布端到端收益。候选对照和最终保留边界见[逐项优化验收](../../../docs/performance/2026-11-01/canvas-display-optimization-validation.md)。

`PERF_OPEN_SESSIONS=1 PERF_OPENS=20` runs `real-project-open.cjs` through the production `StudioWindow` owner and the bundled frontend's Desktop navigation bridge. Dashboard card entry and the actual brand return link cross a WebContents boundary. `sessionMemory` records cold/returned Dashboard RSS, heap, DOM counters and renderer PIDs, and rejects any old editor PID that survives return. This mode never calls diagnostic GC. It still uses isolated fixtures and does not validate live authentication or server saves. Run alone after rebuilding the frontend. `studio-window-native.cjs` separately verifies 20 real renderer process exits, draft failure preservation, resize and native-window destruction with local pages.

Startup/cache comparison uses `PERF_OPEN_SESSIONS=1 PERF_OPENS=6 PERF_NO_DEBUG=1 PERF_PRESENTATION=1 PERF_PERSIST_CACHE=1 PERF_V8_CACHE=code` (or `bypassHeatCheck`). Select `PERF_PROFILE_KEY` to reuse a policy's persistent profile across process restarts; the report mode remains unique. Run policies in ABBA order with the same renderer. `firstCapturedContentMs` is a 50ms sampled capture upper bound, not compositor FCP; first-canvas readiness is polled and all-frame readiness comes from Studio's mark. No-debug mode leaves heap/DOM counters null. Cache-file generation alone does not prove consumption. Results: [WebContents experience validation](../../../docs/performance/2026-11-03/webcontents-experience-validation.md).

`electron desktop/tests/performance/native-studio-experience.cjs <privateOutput> <privateFixture>` launches production Desktop main/menu/preload against offline GP fixtures. Use `node desktop/tests/performance/native-experience-command.cjs <privateOutput> <action>` for named setup/state actions and drive real OS shortcuts through the native UI. `prepare` edits a fixture artboard and requires full saves; `prepare-input`/`remove-input` isolate text undo; `pan` sends native Space/mouse events; `browser-open`/`browser-close`, `aux-open`/`aux-close` cover focus return; `finish` writes the report and exits. This harness never targets the normal profile or online project writes. The separate `electron desktop/tests/update-dialog-focus-native.cjs` checks native Escape isolation from page shortcuts, nested-frame focus restoration and listener disposal across renderer replacements; actual OS shortcut delivery is a separate acceptance check.

`PERF_RETURN_TIMING=1 PERF_OPEN_SESSIONS=1 PERF_RETAIN_DASHBOARD=1 PERF_NO_DEBUG=1 PERF_OPENS=20` records DOM-card and double-rAF return latency and asserts the Dashboard WebContents, OS PID, search and page token survive every return. The test activates its native window before entry/return; keep it foreground throughout, because hidden/occluded windows may pause rendering. Card polling is 5ms in both comparison arms; all-artboard readiness is still required. Compare the same renderer with an explicitly frozen previous owner, not two unrelated frontend builds. It does not measure compositor presentation or OS input latency. Results and installed-App regression: [Dashboard retention](../../../docs/performance/2026-11-03/dashboard-retention-validation.md).

Startup reports also include `canvasRevealedMs` / `firstFrameRenderedMs` from the host's own marks. `firstCanvasReadyMs` is the later external polling observation; do not attribute that detection delay to the application. For isolated-session memory rounds, `PERF_OPEN_MEMORY=final` records a 100ms sampled App working-set sum and each open's `peakWorkingSetSumKiB` up to sample collection, without diagnostic GC. That per-open field excludes later screenshot/return work; the process-wide peak includes it. Keep these memory-sampling rounds separate from timing. Attribution, rejected Markdown first-use tradeoff, retained transport and final build validation: [Startup breakdown](../../../docs/performance/2026-11-03/startup-breakdown-validation.md).

Canvas geometry diagnostics compare the current selection query, query-local DOM/style read caching, and the same cache with a scalar WASM rectangle kernel. Use the private frozen build and serial runner in [geometry/README.md](./geometry/README.md); results and metric boundaries are in [geometry query experiment](../../../docs/performance/2026-11-03/geometry-query-experiment.md). These modules are not imported by release entries.

Host / first-artboard attribution, deferred dialog and native-runtime candidates, production A/B, twenty-cycle memory validation and installed-App checks: [Host and first-frame validation](../../../docs/performance/2026-11-03/host-frame-validation.md).

Functional replay now fails on renderer error logs. `PERF_OPEN_COLD=1` also evicts the restored artboard before redo, revisits it to check real DOM style, and reloads Studio with an element selected. Root cause, positive control, text-draft cancellation, final production and memory checks: [Cold-frame teardown validation](../../../docs/performance/2026-11-03/cold-frame-disposal-validation.md).

Spare-renderer diagnostics use `spare-renderer-probe.cjs <off|on> <default|persistent> <plain|arguments> <output.json>` to verify native eligibility with local documents and the production `StudioWindow`. The probe checks whether the next editor PID already existed before navigation and asserts that the previous editor exits after return.

For real-project replay, set `PERF_OPEN_SESSIONS=1 PERF_NO_DEBUG=1 PERF_SPARE_POLICY=off|on`. `PERF_SPARE_ARGUMENTS=production` copies the current system-language `additionalArguments`; `compatible` omits them in the diagnostic preferences only. The compatible arm uses the existing diagnostic preload, not a production language-bootstrap migration. Both policies must use the same argument mode, renderer and immutable offline fixture. Run ABBA in separate processes; exclude the first two opens. `PERF_SPARE_MEMORY=1` additionally samples returned process working sets at 1 and 5 seconds, without diagnostic GC. Unowned renderer PIDs here exclude top-level WebContents owners only and can include subframes; they are diagnostic candidates, not proof of spare ownership; match them to the next editor PID to confirm consumption. These switches are confined to diagnostics and do not enable prewarming in the application.

Spare-renderer qualification, project-open ABBA timing, settled returned-memory samples and the decision to leave production prewarming disabled: [Electron 45 spare-renderer validation](../../../docs/performance/2026-11-03/spare-renderer-validation.md).

`node node-optimizations.cjs <frozenBeforeDesktopRoot> <output.json>` compares the
actual host-side graph, draft, binary-cache and RPC implementations in ABBA order.
The baseline must include its original `src/` and matching dependencies. Draft
host timings exclude page-side UTF-8 encoding; the real public bridge is measured
separately by `node node-optimization-native-series.cjs <frozenBeforeDesktopRoot>
<reportDirectory>`. It owns private profiles, prepares production-only graph ASAR
fixtures before launching Electron, measures public draft write/read and host
footprint, and checks idle worker retirement after 16.5 seconds. Neither runner
forces GC; RSS and physical footprint are different metrics, and these isolated
processes are not the full Studio App. Run performance collection serially, apart
from builds and tests. Implementation, results and memory tradeoffs:
[Node optimization validation](../../../docs/performance/2026-11-04/node-optimizations/report.md).

Background memory follow-up compares the frozen thread implementation with the
current utility-process implementation using the same native-series runner. Its
fixture detects whether the baseline has a background runner and executes that
runner for both graph variants. The page preparation expression explicitly returns
undefined, so a full JSON string is not inadvertently copied into the host. Main
V8/external counters and Electron private memory supplement vmmap, and active
memory includes every named background process. `PERF_BACKGROUND_CYCLES=3`
replays retirement/restart cycles. `PERF_BACKGROUND_PHASE=drafts|graphics` isolates
workloads; `PERF_BACKGROUND_GC_CONTROL=1` adds a diagnostic GC only after all natural
idle samples, never to production or headline timing/memory results. Attribution,
corrected ABBA comparison and lifecycle acceptance:
[Background memory validation](../../../docs/performance/2026-11-04/background-memory/report.md).
