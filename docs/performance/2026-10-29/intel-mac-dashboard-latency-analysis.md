# Intel Mac 桌面 App 列表点击延迟分析（待审核）

日期：2026-10-29（Asia/Shanghai）  
分析对象：Plasmic Desktop 的启动、项目列表及相关后台工作  
源码基线：`d4d6c30445543ad6867499c9e3664aac87cdc92a` 加当前工作区未提交修改  
状态：源码审查与本地构建产物统计；尚未进行受影响 Intel Mac 的性能录制

## 1. 问题与结论

用户反馈 Intel 芯片 Mac 使用 App 很卡，不仅发生在画布，进入前面的列表就存在问题；进一步确认主要表现为“点击反应慢”。机器型号、内存、macOS、实际安装版本、项目数量和单项目复杂度尚未提供。

**优先怀疑列表缩略图生成造成渲染器主线程长任务，其次是全量列表渲染和重复计算。** 当前缩略图实现会在浏览列表时加载完整项目模型、生成代码、渲染画板并截图。使用临时同源 iframe 和串行队列控制生命周期与并发，但没有将这些工作移出客户端主线程。

以上是基于实现的因果假设，不是已确认的真机根因。仍需区分：

- 点击事件迟迟未开始处理：主线程被其他任务占用。
- 点击已处理，但页面反馈迟缓：事件处理、React 渲染、布局或绘制耗时。
- 点击后立即出现反馈，但目标内容加载慢：路由模块、接口或项目初始化耗时。

不能仅凭现有信息将问题归因于 Intel、GPU、Electron 版本或网络。

## 2. 证据范围

已完成：

- 阅读项目列表、缩略图引擎、缓存、权限计算、桌面草稿、更新入口与窗口配置。
- 检查当前本地 Desktop 与 Studio 构建中的 HTML 直接引用脚本体积。
- 检查仓库现有预览性能探针的能力和运行前提。

未完成：

- Intel 真机复现、CPU profile、点击延迟和长任务测量。
- 受影响安装包与当前源码的版本一致性确认。
- 真实账户的项目量、缓存命中率、草稿体积及接口耗时统计。
- 本次未运行性能探针或功能测试，未修改业务代码。

分析环境的 `uname -m` 为 `arm64`。当前 `desktop/package.json` 版本为 `0.5.8`，不能据此认定用户安装版本。工作区原有未提交修改，因此仅凭 HEAD 不能完整复现本次分析对象。

下文文件链接以仓库相对路径提供，行号指分析时的工作区版本。

## 3. 问题清单与优先级

这里的优先级表示验证顺序，不是已测出的耗时排名。

| 编号 | 问题 | 已确认的事实 | 对点击延迟的判断 |
| --- | --- | --- | --- |
| F1 | 列表预览执行模型解析和代码生成 | 同步重计算存在，预览默认开启 | 最优先验证；与事件处理被阻塞高度吻合 |
| F2 | 为小缩略图渲染多个完整画板并截图 | 逐画板渲染、DOM/CSS 遍历存在 | 复杂项目可能明显放大 F1 |
| F3 | 可见性、缓存失效导致反复检查或生成 | 离屏取消、构建版本校验、缓存容量限制存在 | 影响重计算发生频率，须测命中率 |
| F4 | 列表全量挂载及重复计算 | 无列表虚拟化，权限扫描和标题测量存在 | 项目/权限较多时可能显著 |
| F5 | 初始脚本和预览运行时初始化成本 | 本地产物有明确脚本字节统计 | 主要解释启动、冷加载，不能单独解释持续卡顿 |
| F6 | 桌面草稿列表解析完整文件 | 摘要查询读取完整草稿并 JSON.parse | 大草稿场景下可能阻塞 Electron 主进程 |
| F7 | 更新入口全局 DOM 观察 | DOM 变化触发全局插槽查询和可见性检查 | 次级放大因素，尚无耗时证据 |

### F1：列表预览占用主线程

执行链路：

```text
卡片进入视口
  → 读取预览缓存、查询项目版本
  → 缺失/过期时排队创建同源 iframe
  → 下载项目及依赖数据
  → JSON.parse → unbundleSite → deepTrackComponents
  → buildPreviewModules
  → 加载运行时、渲染、截图
  → 写入 PNG 缓存、销毁 iframe
```

关键证据：

- [devflag-overrides.ts](../../../platform/wab/src/wab/shared/devflag-overrides.ts) 第 4 行：本仓库默认开启 `dashboardCanvasPreview`。
- [renderer.ts](../../../platform/wab/src/wab/client/components/dashboard/preview/renderer.ts) 第 51–133 行：读取项目后同步解析、还原模型、遍历组件，并对选中的根组件调用代码生成。
- [client.ts](../../../platform/wab/src/wab/client/components/dashboard/preview/client.ts)：通过同源 iframe 执行渲染，没有 Worker 或独立后台进程承接上述计算。
- [queue.ts](../../../platform/wab/src/wab/client/components/dashboard/preview/queue.ts) 第 66 行：只在项目之间通过 `setTimeout(..., 200)` 让出执行机会。

机制判断：同步阶段执行时，输入处理可能被延后。外层 Promise、90 秒超时和 AbortController 不会抢占正在执行的同步代码；需要事件循环重新获得控制后，相关回调才能执行。串行化降低并发压力，但不能消除单个项目内部的长任务。

已有保护：视口触发、隐藏页面暂停订阅、串行队列、缓存、取消和 iframe 清理。这些机制有价值，问题不是缺少所有保护，而是没有限制单个主线程任务的连续执行时长。

### F2：缩略图成本随项目复杂度增长

- [renderer.ts](../../../platform/wab/src/wab/client/components/dashboard/preview/renderer.ts) 第 82–95 行：优先取首个非空自由画布的全部画板；无自由画布时取各页面的代表画板。
- [engine.ts](../../../platform/wab/src/wab/client/components/dashboard/preview/engine.ts) 第 17 行起：逐画板按原始 CSS 视口渲染，再合成为 640×360 图片。
- [snapshot.ts](../../../platform/wab/src/wab/client/components/dashboard/preview/snapshot.ts) 第 40 行起：克隆 DOM、逐元素读取计算样式、处理 Canvas、遍历样式表、内嵌字体和图片。

因此成本不仅取决于列表项目数，还取决于画板数、组件依赖、DOM 数量、样式和素材。某些 `await` 只产生微任务或等待资源，不能据此认定每个循环都有输入响应机会。

并非全部截图过程都是同步的，也没有证据表明每次样式读取都会触发强制布局；实际瓶颈需通过 trace 区分脚本、布局、栅格化及资源等待。

### F3：重计算触发与缓存策略

- [ProjectPreview.tsx](../../../platform/wab/src/wab/client/components/dashboard/preview/ProjectPreview.tsx)：离开视口释放 Blob URL、取消订阅并重置状态；重新进入视口再次订阅。
- [client.ts](../../../platform/wab/src/wab/client/components/dashboard/preview/client.ts) 第 119 行：只有项目 revision、`ENV.COMMITHASH` 和 preview format 均匹配才复用缓存而不重新生成。
- [cache.ts](../../../platform/wab/src/wab/client/components/dashboard/preview/cache.ts)：缓存最多 64 项、16MiB；读取时也更新使用时间。

必须准确区分：

- 缓存有效时仍会查版本，但不会重新生成。
- 生成途中离屏取消，再进入时可能从头生成；已完成且有效的缓存不受此推论影响。
- 构建标识发生变化会导致可见预览重新生成，并不等于每次启动或每次升级一定全部重算。
- 超容量淘汰可能导致来回浏览时重新生成，但是否发生取决于实际项目数和图片大小。

“列表视图”仅改变卡片布局，仍使用同一个 [ProjectListItem.tsx](../../../platform/wab/src/wab/client/components/ProjectListItem.tsx) 的 `ProjectPreview`，因此不能作为关闭预览的对照组。

### F4：全量挂载、权限扫描和同步测量

- [AllProjectsPage.tsx](../../../platform/wab/src/wab/client/components/dashboard/AllProjectsPage.tsx) 第 182 行及 [WorkspaceSection.tsx](../../../platform/wab/src/wab/client/components/dashboard/WorkspaceSection.tsx)：对项目全量 `.map()`，没有虚拟化或分页限制挂载数量。
- [useProjectsFilter.ts](../../../platform/wab/src/wab/client/hooks/useProjectsFilter.ts)：每次执行重新创建 Matcher、过滤和排序；搜索输入更新会触发这些工作。
- [ProjectListItem.tsx](../../../platform/wab/src/wab/client/components/ProjectListItem.tsx) 第 125 行起及 [perms.ts](../../../platform/wab/src/wab/shared/perms.ts)：每张卡片计算项目与父级权限，多次过滤传入的权限数组。列表权限计算量随项目数 N 和权限数 P 增长，具有 O(N×P) 的扫描成本。
- `ProjectTitle` 第 48 行起在 `useLayoutEffect` 读取 `scrollWidth/clientWidth`，并为标题建立 ResizeObserver；日期显示每次渲染创建 `Intl.DateTimeFormat`。

预览可见性调度不等于列表虚拟化。非可见卡片仍保留 DOM、组件状态和相关订阅。是否构成主要延迟取决于列表规模；少量项目场景不能仅凭这些代码认定严重瓶颈。

### F5：脚本初始化成本

对当前 `desktop/renderer` 与 `platform/wab/build` 的 HTML 直接引用脚本按本地文件大小求和，两个目录结果一致：

| 入口 | 直接引用脚本数 | JS 字节总数 | 约合十进制 MB |
| --- | ---: | ---: | ---: |
| `index.html` | 18 | 4,602,575 | 4.60 |
| `canvas-preview/index.html` | 4 | 4,210,359 | 4.21 |

统计边界：未压缩文件字节，不是网络传输量、内存占用或实测执行耗时；不含后续动态加载/注入的运行时、组件库和业务模块。浏览器缓存可能复用资源和编译结果，但新 iframe 仍有运行时初始化工作。

[root-view.tsx](../../../platform/wab/src/wab/client/components/root-view.tsx) 已对 Dashboard 和编辑器路由使用懒加载，不能将现状描述为“所有编辑器模块都在首页直接加载”。是否还存在可裁减的共享依赖，需要进一步分析 bundle 和启动 trace。

本地资产清单记录 `build.kind=local`，`sourceHash=501c78ebd270bf37f0e11c7cc5020015f884223977e75d21354146d390488915`。这不是受影响用户安装包的取证结果，也未证明产物与所有当前未提交修改一致。

### F6：草稿摘要查询读取完整模型

[DesktopDraftBadge.tsx](../../../platform/wab/src/wab/client/components/dashboard/DesktopDraftBadge.tsx) 使用相同 SWR key 获取当前账户草稿列表；不能误判成每张卡片都会独立读取一次磁盘。

但 [drafts.cjs](../../../desktop/src/drafts.cjs) 第 30–51 行会读取并 `JSON.parse` 每个完整草稿文件，然后才提取摘要。磁盘读取是异步的，JSON 解析仍在 Electron 主进程执行。草稿大或数量多时存在阻塞风险；没有草稿时不应把它列为主因。

### F7：更新入口的全局 DOM 观察

[update-ui.js](../../../desktop/src/update-ui.js) 第 211–249 行观察整个文档的 `childList/subtree` 变化，每次回调重新查询更新按钮插槽并调用可见性检查，没有先过滤变化是否与插槽有关。

大量列表节点更新可能增加这部分开销，但 MutationObserver 会批量交付，不能称为“每个 DOM 节点变化都完整扫描一次”，也没有证据表明存在无限循环。

## 4. 暂不列为列表点击延迟主因的项目

- [main.cjs](../../../desktop/src/main.cjs) 第 297 行设置 `backgroundThrottling: false`。它值得检查后台资源使用，但不能直接解释前台列表点击延迟。
- 桌面工作区状态每 5 秒检查一次；普通列表没有编辑器工具时，不能直接套用画布上下文的计算成本。
- [island.cjs](../../../desktop/src/island.cjs) 的刷新、截图和命中检测有模式条件，普通窗口模式会提前返回，不能把定时器频率直接换算为持续截图负载。
- 尚无 GPU 状态、内存压力、交换空间、热降频或安装包架构的真机证据。
- 点击后接口等待与点击事件本身延迟尚未分离；不能排除路由和服务端耗时。

## 5. 推荐验证方案

### 5.1 首轮 A/B：只隔离缩略图生成

在同一台受影响 Intel Mac、同一代码版本、同一账户/项目集合和窗口尺寸下制作两组诊断构建：

- A：当前预览开启。
- B：通过已有 `dashboardCanvasPreview` 开关关闭预览，保留列表导航和业务数据。

关闭预览会显示现有图标/标题回退 UI，所以这是整条预览路径的粗粒度隔离。若差异明显，再做“显示相同缓存图片但不生成”的细粒度对照，以避免将显示层差异误算成生成成本。

至少覆盖以下场景，每个场景建议重复 5 次并交替测试顺序：

| 场景 | 要区分的问题 |
| --- | --- |
| 无预览缓存首次进入列表 | 生成期间是否阻塞输入 |
| 缓存有效再次进入 | 缓存命中后是否仍卡 |
| 图片已显示但缓存构建标识过期 | 后台刷新是否使点击变慢 |
| 来回滚动后立刻打开菜单/切换空间 | 取消与重新订阅的影响 |
| 搜索、切换网格/列表 | 全量列表计算与渲染成本 |
| 少项目与较多项目、简单与复杂项目 | 项目数和项目复杂度分别影响什么 |

测试缓存状态只操作诊断配置目录，保留真实用户本地草稿。记录 CPU、电源模式、后台负载和显示分辨率，避免把环境变化算成代码收益。

### 5.2 采集指标与判定

同时录制主渲染器、预览 iframe 所在线程及必要的 Electron 主进程：

- 点击输入延迟：事件开始至处理开始；区分后续处理和呈现耗时。
- 点击至首次可见反馈，以及点击至目标内容可用的总时长。
- 超过 50ms 的长任务数量、最大时长、总时长及调用栈。
- 生成各阶段耗时：数据读取、模型还原、代码生成、运行时初始化、逐画板渲染与截图。
- React commit、布局/绘制耗时、项目数、权限数、DOM 数。
- 预览缓存命中/失效/取消次数和 revision 请求数量。
- CPU、内存压力；涉及草稿时补充草稿总字节数与主进程解析耗时。

若 B 的输入延迟明显下降，且 A 的长任务调用栈落在预览链路，可支持 F1/F2。若预览关闭后仍卡，优先查看 F4、路由初始化和接口瀑布图；若卡顿集中在本地草稿加载期间，再验证 F6。

建议初始验收目标（待审核确认，不是现有成绩）：代表性列表操作的点击至首次反馈 P95 ≤ 100ms；列表交互期间无预览导致的单次 ≥ 200ms 主线程任务；导航、搜索、草稿提示和预览结果正确。统计 P95 需收集足够多次点击，不能只用 5 次运行推断稳定分位数。

### 5.3 现有探针的使用边界

[dashboard-preview-probe/README.md](../../../platform/wab/tools/dashboard-preview-probe/README.md) 已提供真实渲染、缓存、取消、内存和多浏览器验证方案；`benchmark.cjs` 也采集长任务。

但该工具主要使用两个固定项目，即使挂载 100 张卡片，也不等于测试了 100 个不同项目的生成成本；现有检查不能替代 Intel 真机的点击延迟验证。

本次环境缺少该工具要求的 `/tmp/plasmic-cover-probe` 项目快照，未运行探针，也未引用旧报告作为本次通过证据。正式安装版禁用了部分调试入口，采样需使用受控诊断构建，不应直接改变发布版调试策略。

## 6. 优化方向与审核决策

按验证结果推进，当前不预先承诺架构改动：

1. **确认 F1/F2 后，优先让浏览列表不承担重型同步生成。** 比较保存后生成并复用预览、由独立进程生成等方案；保留旧预览可减小交互影响。模型/代码生成是否可放 Worker 需验证依赖，DOM 渲染和截图不能直接整体移入 Worker。
2. **确认 F3 后，调整生成时机与复用。** 可考虑短暂稳定可见后才启动、交互期间不启动新任务、区分渲染器格式变化与无关构建变化。单纯加长队列间隔无法修复单任务阻塞。
3. **确认 F4 后，按规模优化列表。** 虚拟化或分页、预先建立权限索引、减少不必要重渲染与同步标题测量。新增虚拟化必须复用项目共享 Scrollbar 契约。
4. **确认 F6/F7 后，分别优化草稿摘要读取和观察范围。** 草稿摘要与正文的一致性、异常恢复需保留；更新入口避免响应无关 DOM 变化。

审核重点：

- F1/F2 的证据链是否完整，是否遗漏更直接的列表点击阻塞路径？
- A/B 是否能区分输入阻塞、React 更新和目标页面加载？
- 缩略图新鲜度与交互响应的产品取舍是什么？
- 是否需要支持浏览器版与 Desktop 的不同生成执行位置？
- 初始验收目标和代表项目集合是否合理？

本报告交付的是待验证的问题定位与验证方案，不表示已修复或已确认唯一根因。
