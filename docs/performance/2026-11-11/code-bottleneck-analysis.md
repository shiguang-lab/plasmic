# 代码级性能瓶颈分析报告

> 审核日期：2026-11-11
>
> 范围：Plasmic Studio 的模型查询、编辑事务、Outline、画布环境和 Live Preview。本文讨论编辑与预览路径。项目启动数据见[真实项目打开画布对照](canvas-open.md)。

原报告列出了 10 项问题。复核后，StyleToken 环和组件引用闭包爆栈已修复，并增加了 9 个回归用例。其余 8 项保留为性能候选，优先级需要结合真实编辑路径的调用频次和耗时确定。下面记录触发条件、测试证据和待测影响。大数据量补充排查及六项优化结果见「实现调整与复测」。

| 项目 | 当前结论 |
| --- | --- |
| 1. 根尺寸级联 | 有逐组件查询实例的成本。健康模型中，单起点的根实例传播不存在菱形汇合。 |
| 2. StyleToken 自引用 | 已修复。批量替换入口可制造自环，保存校验跟随该环时会挂起。 |
| 3. 组件引用闭包 | 已修复。构造的循环模型可使原递归抛出 `RangeError`。常规插入已有查环。 |
| 4. 模型查询失效 | 未声明依赖的查询在模型版本变化后的下一次读取才重算。调用方可以避开无关提交。 |
| 5. 事务变更汇总 | 非空事务最多走初始汇总加 9 次修补后汇总。重复汇总与全站引用图重建应分别计数。 |
| 6. Issues 面板 Lint | 面板在 React 渲染期间同步调用 Lint。是否执行 Choice 表达式及实际耗时取决于输入。 |
| 7. Outline 通知 | 共享快照改变会通知当前订阅者。React 提交、DOM 更新和耗时需要分别测量。 |
| 8. 画布环境克隆 | 默认路径深拷贝识别出的状态代理。普通查询数据可保留原引用。 |
| 9. Live Preview 项目配置 | 受影响的预览重新生成模块时会重建项目配置。代码生成与 Worker 转译分开计时。 |
| 10. 树路径复制 | 路径元素累计复制量随深度增长。GC 停顿需要独立验证。 |

## 已修复的稳定性缺陷

### StyleToken 自引用和基础别名环

当 Token B 引用 A 时，通过 Studio 的「替换此 Token 的全部用法」把 A 替换成 B，旧实现会把 B 自身的值改成 B。如果组件样式原本引用 A，它也会被改为引用 B。启用模型不变量校验时，保存路径会从组件样式跟随别名。旧收集函数只向集合添加引用，没有在重复引用处停止。普通 Token 编辑已有查环逻辑，批量替换是另一条写入路径。相关代码见[批量替换菜单](../../../platform/wab/src/wab/client/components/sidebar/StyleTokenRow.tsx#L188)、[保存校验](../../../platform/wab/src/wab/client/studio-ctx/StudioCtx.tsx#L7339)和[组件 Token 引用检查](../../../platform/wab/src/wab/shared/site-invariants.ts#L557)。

现在，批量替换先检查计划写入的值。会形成自引用或基础别名环的操作会在改写前被拒绝，Studio 终止这笔事务并显示本地化提示。读取已有循环时，收集函数在再次遇到同一个 Token 后退出，并返回已收集的引用。回归覆盖直接自环、间接基础别名环、变体值和注册 Token 覆盖值中的自引用、正常替换、Studio 提示，以及读取自环与双 Token 环。见[替换校验](../../../platform/wab/src/wab/shared/TplMgr.ts#L2940)、[Studio 命令](../../../platform/wab/src/wab/client/components/canvas/site-ops.tsx#L1862)、[收集函数](../../../platform/wab/src/wab/shared/core/site-style-tokens.ts#L276)。

### 组件引用闭包爆栈

旧实现先递归计算所有直接引用者的闭包，再写缓存。对有环的组件模型，先前已用实际 selector 复现 `RangeError`。常规组件插入会拦截包含关系的循环。模型中带环的输入已经在构造用例里验证，正常编辑如何产生这种模型仍未复现。见[插入校验](../../../platform/wab/src/wab/client/operations/insert-tpl.ts#L182)。

当前实现从变更集合出发迭代遍历直接反向引用图，每个可达组件只进入队列一次。回归覆盖自环、互相引用、可达环的入口节点，以及从环通向无环链的路径。仅用调用栈集合截断递归会漏算，例如反向引用图中 A 与 B 互相引用且 A 指向 C 时，从 A 开始递归可能把 B 的闭包提前缓存为只有 A。见[闭包实现](../../../platform/wab/src/wab/shared/cached-selectors.ts#L410)和[回归用例](../../../platform/wab/src/wab/shared/cached-selectors.topology.test.ts)。

### 回归结果

- 修复轮运行 6 个 Vitest 文件，48 项通过，其中 9 项为本次新增用例。WAB TypeScript 检查和 `git diff --check` 通过。
- 报告复核轮运行 13 个 Vitest 文件，92 项通过，包含上述 48 项及 fixup、Outline、Preview 代码生成和缓存、Choice Lint、画布环境和 Inspector 选择回归。
- 核心用例位于 [TplMgr.test.ts](../../../platform/wab/src/wab/shared/TplMgr.test.ts)、[site-style-tokens.test.ts](../../../platform/wab/src/wab/shared/core/site-style-tokens.test.ts)、[cached-selectors.topology.test.ts](../../../platform/wab/src/wab/shared/cached-selectors.topology.test.ts) 和 [StyleTokenRow.test.tsx](../../../platform/wab/src/wab/client/components/sidebar/StyleTokenRow.test.tsx)。

## 其余性能候选

### 1. 根尺寸级联

`seenComps` 只读未写。递归只在实例具有特殊尺寸值且是另一个组件的根时继续。每个组件只有一个根，因此无环的根实例关系从单个起点可以分叉，但不能汇合成菱形；深度本身无法推出指数级重复访问。每个不同组件第一次读取 `componentToTplComponents(site, comp)` 时，该查询会遍历站点中的组件及其模板节点。多个起点各自执行的传播也可能重叠。见[尺寸传播](../../../platform/wab/src/wab/shared/model/model-change-util.ts#L541)和[实例查询](../../../platform/wab/src/wab/shared/cached-selectors.ts#L694)。

### 4. 模型查询失效

对有模型所有者的查询，模型变更会更新全局版本。未声明 `dependencies` 的查询在下一次读取时重算，同一版本内重复读取可以命中。语法树统计显示 `cached-selectors.ts` 有 52 处 `memoizeModelQuery` 调用，其中 30 处显式接收 `Site`，只有 1 处声明了 `dependencies`。参数中含 `Site` 与全站扫描是两回事。表达式搜索现有回归在 100 和 1,000 表达式夹具中验证，无关样式提交触发的全站表达式收集次数为 0。见[查询缓存](../../../platform/wab/src/wab/shared/model-query.ts#L18)、[拓扑依赖](../../../platform/wab/src/wab/shared/cached-selectors.ts#L131)和[表达式搜索回归](../../../platform/wab/src/wab/client/components/canvas/remaining-risk.performance.test.tsx#L123)。

### 5. 事务变更汇总

`fixupForChanges` 先汇总一次。非空变更走 7 个模型修补、1 个更新时间修补和 1 个视图修补，共 10 次 `summarizeChanges`，即使修补没有录到子变更也会重新汇总。同一个模型版本可以复用引用图；没有受影响的组件时也可能不读取该图。阶段之间依赖更新后的汇总，例如虚拟 Slot 修补会产生新内容，后续阶段通过 `newTrees` 和 `updatedNodes` 决定处理范围。后续可验证跳过无子变更汇总的收益，测试应覆盖虚拟 Slot、Grid、状态和根替换。见[事务修补](../../../platform/wab/src/wab/client/fixes-post-change.ts#L71)和[受影响组件查询](../../../platform/wab/src/wab/shared/model/model-change-util.ts#L885)。

### 6. Issues 面板 Lint

面板在 React 渲染期间同步调用 `lintSite` 和 `lintUnprotectedDataQueries`。Choice Lint 需要有聚焦视图，并且只有具备选项和有效表达式的参数才调用 `tryEvalExpr`。求值先尝试 JSON 解析，再走动态求值。现有回归中，画板坐标移动触发 0 次 Lint，节点可见性编辑触发 1 次。报告原有的每键 100–500 ms 缺少浏览器采样。若后续调度 Lint，要保留焦点、注册信息、画布和角色变化的刷新条件。空闲回调仍在主线程执行。见[Issues 面板](../../../platform/wab/src/wab/client/components/sidebar/LeftLintIssuesPanel.tsx#L99)、[文档订阅](../../../platform/wab/src/wab/client/linting/lint-document-inputs.ts#L30)、[Choice 筛选](../../../platform/wab/src/wab/shared/linting/lint-choice-prop-values.ts#L75)和[表达式求值](../../../platform/wab/src/wab/shared/eval.ts#L210)。

### 7. Outline 通知

同一视图中已挂载的行共享 `useOutlineModelSnapshot`。单节点锁定导致快照变化时，订阅者都会收到通知，样式 Provider 只适用于非文本的标签节点。现有测试验证了锁定和模型变化触发通知，以及某些分支展开或选中场景可复用结果。视口挂载行数由实际布局和虚拟列表决定。见[订阅来源](../../../platform/wab/src/wab/client/components/sidebar-tabs/outline-model-inputs.ts#L121)、[行渲染](../../../platform/wab/src/wab/client/components/sidebar-tabs/tpl-tree.tsx#L847)和[Outline 回归](../../../platform/wab/src/wab/client/components/sidebar-tabs/outline-model-inputs.test.ts)。

### 8. 画布环境克隆

`getCanvasEnvForTpl` 默认浅构造环境容器，并对识别为 Plasmic 状态代理或 Valtio 代理的顶层值执行 `cloneDeep`，以隔离画布外求值。普通对象保留引用，`keep$StateRef` 返回原环境。大数据需要先确认由状态代理持有，再按调用次数和代理实际大小测量拷贝成本。当前没有该路径的真实项目堆分配或 GC 停顿数据。见[环境读取](../../../platform/wab/src/wab/client/studio-ctx/view-ctx.ts#L1707)和[代理判断](../../../packages/react-web/src/states/helpers.ts#L84)。

### 9. Live Preview 项目配置

组件变更进入 `dirtyRoots` 或存在项目级变更时，项目配置缓存被置空。缓存失效与触发预览重建是两步。只有相关根订阅者会被通知，并在下次生成模块时重建项目及依赖配置。导出配置实际调用 `extractUsedFontsFromComponents(site, site.components, ...)`，并生成项目级 CSS 和 Token 变量。配置重建与模块生成在调用端执行，转译由 Worker 处理。现有测试确认渲染依赖的编辑会通知相关根，同时复用无关根的组件输出。见[Preview 失效条件](../../../platform/wab/src/wab/client/components/live/preview-codegen.ts#L262)、[依赖项目配置](../../../platform/wab/src/wab/client/components/live/preview-codegen.ts#L849)、[字体和项目配置](../../../platform/wab/src/wab/shared/codegen/react-p/index.ts#L401)和[Worker 编译](../../../platform/wab/src/wab/client/components/live/preview-compiler.ts#L38)。

### 10. 树路径复制

`walkTplsAndArgs` 对每个继续遍历的节点构造一份 `[...path, node]`，同一个父节点的子项共享该路径。若节点数为 N、最大深度为 D，累计复制的**元素数**为 `Σ(depth + 1)`，上界为 `O(N·D)`；路径数组数量为 `O(N)`。树深度和调用频次决定实际成本，GC 影响需要在包含真实调用方的分配采样里确认。见[遍历实现](../../../platform/wab/src/wab/shared/core/tpls.ts#L1124)。

## 本轮候选项测量

本轮使用 ARM64、Node 24.20.0 和 WAB Vitest 4.1.10。12 个临时探针全部通过。每组计时执行 12 次，舍弃前 3 次预热，取其余 9 次的中位数。计时包含探针的少量断言和计数开销。下表为合成模型、实际代码路径的局部测量，范围不含浏览器绘制、真实输入延迟和 GC 暂停。

| 候选项 | 夹具、操作及结果 |
| --- | --- |
| 根尺寸级联 | 固定 256 个组件，修改链首组件的根宽度。16 / 64 / 128 层根实例分别触发 **17 / 65 / 129** 次实例查询，访问的组件均不同，汇总 p50 为 **1.73 / 4.93 / 9.73 ms**。该夹具验证逐组件查找实例的增长。 |
| 模型查询失效 | 100 / 500 个单节点组件，写入一个颜色字段后显式读反向引用图和站点表达式。两者都返回新结果，同一版本内重复读反向图命中，组件拓扑仍复用。写入并读取 p50 为 **0.40 / 1.94 ms**。表达式搜索的订阅路径另外确认了无关编辑的 **0 次**全站收集。 |
| 事务变更汇总 | 同样的 100 / 500 组件颜色编辑，直接运行 `fixupForChanges`。每次 **10 次汇总、2 份不同的闭包结果**，修补 p50 为 **0.53 / 1.76 ms**。包含同版本缓存命中。 |
| Issues 面板 Lint | 在无 Choice 参数的 100 / 1,000 个普通节点上，样式写入后调用 `lintSite`，p50 为 **0.61 / 5.24 ms**。在 100 / 1,000 个符合条件的 Choice 参数上，用简单动态字符串表达式，实测 **100 / 1,000 次** `tryEvalExpr`，p50 为 **1.75 / 19.97 ms**。该计时不含面板渲染、DOM 检查或未受保护的数据查询检查。 |
| Outline 通知 | 100 / 1,000 个节点，同一视图安装 60 个订阅者，单独发布一个节点的锁定字段。两组均收到 **60 次回调**。这些回调计数不代表实际行渲染或 DOM 更新次数。 |
| 画布环境克隆 | 用带 Plasmic 状态代理标记的测试代理承载 100 / 1,000 条含嵌套字段的记录，并在同一环境中放入普通查询数据。状态记录及其嵌套对象被复制，查询对象保持原引用。默认读取 p50 为 **0.12 / 0.58 ms**，`keep$StateRef` 读取低于 **0.01 ms**。测量只替换了环境来源，走实际代理识别和拷贝分支。 |
| Live Preview 项目配置 | 预览根和一个无关组件各有 100 / 1,000 个子节点，共 202 / 2,002 个节点。给预览根里的一个节点改颜色并发布提交，12 次都通知当前预览并重建项目配置，发布加代码生成 p50 为 **2.65 / 14.76 ms**。无关组件提交未通知当前预览，随即读出的预览结果仍复用。这里未计 Worker 转译、预览渲染或额外依赖项目。 |
| 树路径复制 | 两种树各 600 个节点，分别是宽度为 599 的浅树与单链。两者都构造 **600 份路径数组**，累计复制 **1,199 / 180,300 个元素**，遍历 p50 为 **0.08 / 0.18 ms**。没有测量 GC。 |

现有测试可以从 `platform/wab` 用 `node_modules/.bin/vitest run` 复跑。性能相关入口包括[表达式搜索和 Lint 订阅](../../../platform/wab/src/wab/client/components/canvas/remaining-risk.performance.test.tsx)、[事务修补](../../../platform/wab/src/wab/client/fixes-post-change.test.ts)、[Outline](../../../platform/wab/src/wab/client/components/sidebar-tabs/outline-model-inputs.test.ts)、[Preview 缓存](../../../platform/wab/src/wab/client/components/live/preview-codegen.test.ts)和[Preview 跨页面复用](../../../platform/wab/src/wab/client/components/live/preview.performance.test.ts)。

若要给候选项排序，先在同一冻结业务项目回放单节点样式编辑、打开和关闭 Issues 面板后编辑、单节点锁定、Live Preview 刷新。记录交互到下一帧、React 提交和主线程调用栈，分别归因于汇总、查询、Lint、Outline 和预览。根尺寸级联、环境克隆与路径复制同时记录真实触发次数、模型形状及分配量，再判断是否值得改动。

## 大数据量与大量节点补充排查

优化前基线使用 14 个临时 Vitest 探针，最终全部通过。计时在 Node / jsdom 中执行，每组 8 次取后 5 次中位数。探针覆盖真实的画布元素构建、数据选择器、样式同步、引用闭包和框选入口。报告分别列出元素构建耗时、DOM 挂载数量和执行计数。浏览器样式重算、布局、绘制和真实项目交互延迟需要单独采样。

### 11. 画布数据重复一次构建并挂载全部项，默认键去重按平方增长

Studio 的 `renderReppable` 在缓存未命中时对完整集合执行 `map`，为每项构造环境并渲染。没有指定键的普通标签默认使用相同的 `ctx.valKey`。画布随后给重复键加后缀，每次从 2 重新寻找。N 项共用一个键时，后缀检查为 N(N−1)/2。嵌套重复还会把内外集合规模相乘。Live Preview 和导出代码也默认对完整集合执行 `map`，其默认重复项键使用索引，因此这里测得的后缀搜索开销归于 Studio 画布。见[画布重复与去重](../../../platform/wab/src/wab/client/components/canvas/canvas-rendering.ts#L1175)、[标签默认键](../../../platform/wab/src/wab/client/components/canvas/canvas-rendering.ts#L2330)和[预览及导出生成](../../../platform/wab/src/wab/shared/codegen/react-p/data-reps/index.ts#L46)。

| 重复项 | 默认键后缀检查 | 构建 p50，默认键 / 显式唯一键 | 实际挂载的输入框 |
| ---: | ---: | ---: | ---: |
| 100 | 4,950 | 3.50 / 3.00 ms | 100 |
| 1,000 | 499,500 | 73.24 / 23.47 ms | 1,000 |
| 2,000 | 1,999,000 | 236.85 / 49.31 ms | 2,000 |

显式唯一键的后缀检查均为 0，两个分组的 DOM 数相同。每次计时前更换集合内容以触发缓存未命中，计时截止于 React 元素构建完成。随后用 jsdom 验证实际挂载数。集合不变的下一次读取验证了缓存命中。

### 12. 画布命中渲染缓存时仍遍历全部实例订阅

在活动渲染批次中，`CanvasRenderOwner.render` 为每个命中的实例遍历整个 `modelSubscriptions`，筛选需要继续保留的后代和环境引用。设一次批次触及 H 个命中实例，画布拥有 S 条实例订阅，这一段的检查量为 H×S。根整体命中时只扫描一次。根失效、很多兄弟节点仍命中时，扫描次数会随兄弟节点数增加。见[缓存命中分支](../../../platform/wab/src/wab/client/components/canvas/canvas-cache.ts#L797)和[渲染批次入口](../../../platform/wab/src/wab/client/components/canvas/canvas-observer.ts#L50)。

探针直接使根缓存失效，保留 100 / 1,000 个兄弟节点的元素引用。两组全部子节点仍命中缓存，实际检查 **10,100 / 1,001,000** 条订阅记录，带计数的元素构建 p50 约 **1.15 / 54.68 ms**。这是局部失效后的工作量，实际交互的触发频次和幅度仍待采样。

### 13. 数据选择器搜索遍历整支数据，数据列与搜索结果会批量挂载

搜索在非空查询的渲染路径上，从当前列递归检查可浏览数据。在判断路径是否匹配前，每个支持的叶子已执行预览求值和序列化。搜索结果会排序并全部映射为组件。普通数据列也将所有可显示项映射为组件，滚动容器只负责滚动。见[搜索遍历](../../../platform/wab/src/wab/client/components/sidebar-tabs/DataBinding/DataPicker.tsx#L225)、[结果挂载](../../../platform/wab/src/wab/client/components/sidebar-tabs/DataBinding/DataPicker.tsx#L600)、[数据列渲染](../../../platform/wab/src/wab/client/components/sidebar-tabs/DataBinding/DataPickerColumn.tsx#L138)和[预览求值](../../../platform/wab/src/wab/client/components/sidebar-tabs/DataBinding/DataPickerUtil.ts#L253)。

在每条记录有两个叶子字段的 100 / 1,000 条记录夹具中，一个零命中查询仍对记录字段求值 **200 / 2,000 次**，输入事件至 React 更新 p50 约 **3.74 / 20.94 ms**。搜索一个每条记录都有的字段时，实际挂载 **100 / 1,000 条结果**。单独打开同规模标量数组列，也挂载 **100 / 1,000 行**。jsdom 中用空的 `IntersectionObserver` 替代浏览器观察器。

### 14. 单节点样式编辑会重新写入多张未改变的画板样式表

规则生成可以从改动的 VariantSetting 开始，但随后会拼接脏组件的整份样式文本。画板同步遍历该画板所需的组件、直接依赖、基础样式和变量表，对它们重新写入 `style.textContent`，再把这些节点附加到文档头部。这里会写版本号，但写入前没有比较版本。Studio 为有样式变更的视图安排样式同步，实际同时执行的画板数量取决于调度及视图状态。见[组件样式拼接](../../../platform/wab/src/wab/client/style-mgr.ts#L457)、[画板样式写入](../../../platform/wab/src/wab/client/style-mgr.ts#L352)和[视图调度](../../../platform/wab/src/wab/client/studio-ctx/StudioCtx.tsx#L2020)。

4 份画板文档共享同一组件和一个被引用组件。单节点改色后，同步 4 份文档共写 **20 次**，其中 **16 次**与原有文本相同。组件中带样式的子节点从 100 增至 1,000 时，单份脏组件的 CSS 从 **4,699** 增至 **46,999** 字符，4 份文档合计写入从 **163,684** 增至 **332,884** 字符。这组探针验证写入范围，未测量 Chromium 的 CSS 解析和样式重算成本。

### 15. 密集组件依赖会增加闭包构造成本

引用闭包现在可以安全处理环，但仍为整个站点的每个组件构造可达集合。无环链的集合总大小可以达到 V(V−1)/2。密集无环图会反复合并大量重叠集合，最坏达到立方级合并量。直接反向图还有逐边的 `site.components.includes()` 成员检查。见[直接反向图和闭包](../../../platform/wab/src/wab/shared/cached-selectors.ts#L392)。

同为 120 个组件，无依赖 / 单链 / 密集无环图的直接边数分别为 **0 / 119 / 7,140**，闭包总条目为 **0 / 7,140 / 7,140**，对应无环分支遍历子闭包的元素总数为 **0 / 7,021 / 280,840**。无缓存读取 p50 约 **0.16 / 0.38 / 5.88 ms**。密集夹具自身也有更多模板实例节点，耗时包含直接反向图构造。合并次数和真实项目依赖密度应分别记录。

### 16. 大范围框选在松手时扫描实际画布节点并逐个加入选择

框选从当前编辑范围枚举 Val 后代，对候选节点解析 DOM、判断可见性与裁剪，然后过滤被选容器覆盖的子节点。选择结果按项调用聚焦操作，期间重复检查当前已选集合。全量路径发生在鼠标松开时。单次操作的几何快照会复用共享元素和祖先的读取结果。见[选择候选与提交](../../../platform/wab/src/wab/client/components/canvas/marquee-selection.ts#L15)和[鼠标松开入口](../../../platform/wab/src/wab/client/components/studio/view-editor.tsx#L1711)。

100 / 1,000 个可选兄弟节点全被框中时，两组分别触发 **100 / 1,000 次**候选 DOM 查询、边界读取及聚焦调用。夹具用模拟矩形和选择更新，入口 p50 约 **2.72 / 20.67 ms**。实际布局和 Inspector 更新会影响真实耗时。

### 待补浏览器采样的路径

画板提交后的 Val 树索引会处理新挂载和变化的 Fiber，复用不变子树，同时可能为复用子树重放 Slot 参数计数。CanvasActions 在渲染且画布浮层可见时会遍历 Val 树查找无效参数。大量重复项会扩大这些路径的输入。本轮确认了入口，尚未隔离它们的独立耗时。见[Fiber 提交遍历](../../../platform/wab/src/wab/client/react-global-hook/globalHook.ts#L940)和[CanvasActions 扫描](../../../platform/wab/src/wab/client/components/canvas/CanvasActions/CanvasActions.tsx#L169)。

按本轮证据，先验证重复列表冷构建、宽画板局部更新、数据选择器搜索这三个真实交互。对应的二次增长或批量挂载已能复现。样式同步应使用多个画板记录 CSS 重算。框选和闭包优先采集真实的候选节点数与引用密度。

## 实现调整与复测

| 路径 | 采用的方案 | 同规模验证 |
| --- | --- | --- |
| 画布重复项 | 每种键只向前查找未占用的后缀。渲染项一次克隆，同时写入原集合索引和最终键。Fragment 直接接收数组。 | 2,000 项的后缀检查 **1,999,000 → 1,999**，元素构建 p50 **236.85 → 29.95 ms**。重复键顺序与索引保留。 |
| 画布局部更新 | 缓存命中只登记需要保留的子树。渲染结束时一次性按画板监听者和 Slot 实例归集订阅与环境。 | 1,000 个缓存命中的兄弟节点，订阅检查 **1,001,000 → 1,001**，带计数构建 p50 **54.68 → 10.29 ms**。 |
| 数据选择器 | 广度优先搜索按时间片调度，新查询取消旧扫描。只为虚拟窗口中的匹配项求值和构建预览。数据列也用共享 Scrollbar 的虚拟列表，键盘选中项会滚入窗口。 | 1,000 条记录的零命中搜索不求值记录字段。回归验证只挂载结果窗口，并可从首行滚到第 1,000 行。 |
| 画板样式同步 | 保留已安装样式文本，只有文本变化才写入 DOM。按实际位置补齐级联顺序，已在正确位置的样式表保持挂载。 | 4 份画板、1,000 个样式节点，写入 **20 → 4 次**，重复写入 **16 → 0 次**，总写入 **332,884 → 187,996 字符**。 |
| 组件引用更新 | 直接反向图用 Map 判定站点成员。从当前变更集合做一次多起点遍历，共用访问集合。 | 120 个组件的密集夹具，传递阶段从合并 **280,840 个子闭包条目**变为检查 **7,140 条边**。同一夹具无缓存读取 p50 **5.88 → 2.33 ms**。回归保留环和环外依赖。 |
| 框选 | 按当前编辑范围解析可选层，通过全键去重，一次提交完整选择。 | 回归验证批量替换和 Shift 追加都只发布一次选择，已有首选项和克隆标识保留。 |

优化后 14 个相关 Vitest 文件共 147 项通过，WAB TypeScript 检查和 `git diff --check` 通过。10 个复测探针通过。上述结果测的是实现工作量和局部耗时。通用画布重复项保留完整输出，任意模板可能参与 Grid、Flex 或组件插槽布局。大范围框选仍需一次几何检查，以保留裁剪和多 DOM 根的选择规则。样式同步仍为改动组件拼接完整样式文本。浏览器布局、样式重算和交互到下一帧的收益需用真实项目测量。
