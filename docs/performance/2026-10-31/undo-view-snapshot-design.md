# 撤销视图快照：运行时引用解耦方案

状态：下文为方案分析。2026-11-01 已完成原型与实际 Studio A/B，未确认独立内存收益，嵌套冷恢复未通过，生产原型已撤回。当前结论以[验证报告](../2026-11-01/undo-snapshot-validation.md)为准；此文的可行性探针不能作为交付验收。原分析数据见 [undo-view-snapshot-design-evidence.json](undo-view-snapshot-design-evidence.json)。

## 结论

建议保留现有模型变更撤销机制，只将视图快照中的选中项和组件编辑上下文转为模型引用与实例身份。保留 arena/frame/Tpl/Param/Variant 模型引用和现有变体栈 clone，不把整个撤销系统改成 UUID 序列化。

这能切断快照直接持有 Val/Fiber/env 的路径，理论上有助于退出画布后的 JS 对象回收。实际释放量未知；不是画布首次加载优化，也不能承诺 CPU 或 RSS 按比例下降。功能可以按现有语义设计，但冷恢复存在必须先做原型验证的顺序约束，当前不能宣称“改后功能已正常”。

## 先定义成功条件

1. `UndoRecord.view` 不再通过选中项或组件上下文持有 ValNode、Fiber、DOM、CanvasEnv、ViewCtx 或捕获这些对象的闭包；允许保存撤销所需的模型对象。
2. 全部模型编辑、撤销/重做、冲突处理、选择变化覆盖最近快照及 redo 保留规则不变；不减少历史步数。
3. 选中的具体重复实例、Slot、组件编辑上下文、目标/固定变体和多画板选择按现有语义恢复。无渲染实例时保留可编辑模型焦点，不误选另一个重复实例。
4. 已有目标 Val 的常见恢复不额外安排 eval；目标未渲染时只准备相关 frame，不为所有画板重新求值。冷恢复的额外渲染和长任务必须单独测量。
5. 真实项目在相同步骤及 GC 条件下，已退出画布的旧运行时经撤销视图保留的路径消失；其他活跃画板、后台 MCP、保存和 Preview 保持正常。总 retained bytes 是否下降由实测决定，不能把共享对象大小重复相加。

## 当前调用链和保留边界

- `StudioCtx.currentViewState()` 把 `focusedSelectable` 和 `currentComponentCtx` 直接放入快照，同时克隆 `vcComponentStack`。
- `ComponentCtx` 强持有 ValComponent。选中项为 ValNode 时直接持有运行时；SlotSelection 的 `val` 也持有 ValComponent。
- ValNode 有 `fibers`、`parent`、`valOwner` 和 env/wrappingEnv；ValComponent 还持有 contents、slotArgs、slotCanvasEnvs 和代码组件 props。它们可能连到同一画布的较大运行时图。
- `RenderState.recomputeCachedVal()` 会复用弱缓存中尚存活的 Val，并通过 `copy()` 更新。探针确认替换注册后可以得到同一个缓存对象及最新 props。因此不能把每条历史记录都算成一份独立旧渲染树，也不能假设每次渲染都留下旧 Fiber。
- Root/TransientComponentVariantFrame 的 clone 保存模型和变体状态，本次没有发现其直接持有 Val。保留它们能避免改动根变体持久化与私有变体临时状态的既有语义。
- 模型变更记录本来就需要保留被删模型以支持撤销。这些模型不是本次要强制清空的“泄漏”。Site/Studio 销毁和切换版本仍使用现有清理边界。

上述是源码引用路径与定向探针；尚未用真实 Studio 堆快照证明撤销路径独占保留多少内存。

## 推荐的最小数据变化

| 内容 | 快照保留内容 | 原因 |
| --- | --- | --- |
| arena/frame、多画板选择、frame/content 焦点 | 原有模型引用、数组和布尔值 | 删除/撤销可以沿用模型对象身份；无需增加全项目 UUID 索引 |
| 普通选中项 | Tpl 模型、Val key、完整 fullKey、原 clone key | Tpl 相同不代表同一重复实例；key 还用于现有视图等价判断 |
| Slot 选中项 | 拥有者 TplComponent、Param 模型、有值时的 owner key/fullKey、原 clone key | 区分纯 Tpl Slot 与已渲染 Slot，也区分不同 owner 实例 |
| 组件编辑上下文 | TplComponent、实例 key/fullKey，以及对应 owner 链的模型与身份 | 恢复 spotlight 和变体栈时需要确定具体调用实例及各层 owner |
| 待渲染/隐藏节点 | 原有 nextFocusedTpl 模型 | 当前已有模型焦点先行、渲染后补 Val 的语义 |
| 组件变体栈 | 原有 clone | 不扩大此次改造范围，保持目标变体、pins、私有变体语义 |

身份应在目标 ArenaFrame 对应的新 ViewCtx/RenderState 中解析；不把旧运行时 frameUid 当成跨重建身份。不同 frame 可以出现相同 fullKey，不能全局只按 fullKey 查找。

`UndoLog.isViewEquivalent()` 必须同步改成身份比较，保持目前 key/clone key、pending Tpl 与已渲染项等价、Slot 和纯选择覆盖规则。不能用 JSON.stringify 比较整个快照，或把所有 fullKey 差异都转成新撤销步骤。

## 恢复流程：快速路径与冷路径

当前 `restoreUndoRecordInternal()` 的顺序为：应用模型撤销、清理失效 ViewCtx/Tpl、切换 arena、等待 frame ViewCtx、恢复视图、修正变体与 Chrome、汇总变更，最后安排 eval。`restoreViewState()` 明确允许暂时装入旧 Val，之后由 `updateCtxPostChange()` 重匹配。

去掉旧 Val 后不能照抄这个流程：

- 撤销删除时，模型已经恢复，新的 Val 仍不存在。
- `buildViewCtxPinMaps()` 对组件变体栈与运行时 owner 栈做 `strictZip`；先恢复嵌套栈、把 context 留空等 postEval，会发生长度不匹配。探针已确认此断言。
- 变体激活读取当前 Fiber props；默认 Slot 内容的求值也会沿组件 owner 取 key。只保存 Tpl UUID 或伪造一个空 Val 都不能代替这些数据。

推荐保留现有活跃 ComponentCtx/Val API，只在撤销边界转换身份，不把全项目的 ComponentCtx 改造成通用延迟解析器。

1. **快速路径**：模型撤销并确定目标 ViewCtx 后，如果所需 owner/上下文已能从当前 registry 找到，则用当前 Val 建立临时活跃 ComponentCtx，恢复 cloned 变体栈和模型焦点；新渲染完成后再次按身份确认选中实例。快照始终只存身份。
2. **冷路径原型**：目标上下文尚不存在时，以已解析且栈长度匹配的最长 owner 前缀准备目标 frame；从 root 或缺失祖先逐层生成所需实例，再恢复目标 context/变体栈及选择。每次准备必须保持变体栈与运行时 owner 栈一致；不能一次装入完整嵌套栈再空等。前缀准备时，保留原默认 Slot 策略，不让进入/退出临时 context 重置它。目标只在祖先临时变体、默认 Slot 中存在的场景是原型必测项。
3. **最后确认**：新 RenderState 就绪后解析完整实例身份。实例确实不存在时，沿现有行为保留所属上下文内的 Tpl/Slot 模型焦点或清理失效焦点；不能拿同 Tpl 的第一个实例冒充原实例。
4. **异步边界**：准备工作不能长时间占用模型事务；中间状态不能生成额外 undo/草稿模型变更。快速连续 undo/redo、用户重新选择、ViewCtx dispose 或 Site 替换应让旧恢复请求失效，防止较早的 postEval 覆盖较新的操作。需与 `fixupChrome()`/模型变更汇总顺序一起验证。

冷路径是候选实现设计，尚未验证可以在所有 Slot/变体条件下用限定次数的准备完成。不能将其写成已经解决的功能保证。应先做此路径的窄原型，再决定最终改动；若它显著增加复杂性或 undo p95，需缩小范围或调整方案，而不是丢弃上下文来让测试通过。

不采用 WeakRef 保存历史 Val：回收时机不能决定撤销正确性。不深拷贝或裁剪原 Val：容易保留 Fiber/env 或制造不完整运行时。也不清空共享缓存、不缩短 undo 历史、不默认引入 worker。

## 功能回归矩阵

| 场景 | 本轮能确认的内容 | 实施后的必要验收 |
| --- | --- | --- |
| 属性编辑、纯选择、undo 后导航再 redo | 现有 selection-change 测试通过 | 相同模型结果、历史条数、redo 可用性 |
| 相同 Tpl 的多个重复实例 | 实际 registry 可按 fullKey 分开解析 | 深层重复、删除/插入/数据顺序变化，clone key 精确恢复 |
| Slot 选中 | 实际选择解析支持 owner fullKey + Param | Slot 参数/默认内容、重复 owner、Slot 转换后撤销 |
| 删除节点/组件再撤销 | 注册前查不到 Val，注册后可查到 | 冷恢复、隐藏节点模型焦点、组件实例上下文恢复 |
| 嵌套组件与目标/pinned/private 变体 | 栈匹配约束与 clone 隔离已验证 | owner 前缀恢复、默认 Slot、依赖 props 激活的变体 |
| 多画板 | frame 内 registry 能隔离相同 fullKey；现有 frame-selection 测试通过 | 切页、frame 被回收后重建、删除 frame/arena 再撤销，活跃邻板不受影响 |
| 文本编辑 | 现有 Slate undo-batching 测试通过 | Studio/Slate 两套撤销焦点交接；本次不改变文本历史机制 |
| 多节点选择 | 当前 ViewStateSnapshot 只存单个 focusedSelectable | 保持当前行为；不能把多 frame 测试宣称为完整多节点撤销覆盖 |
| 保存/草稿/Preview/MCP | 本轮未做新端到端验收 | 运行时解析不写模型；完整集成回归 |

## 实际执行的验证

- `pnpm --dir platform/wab exec vitest run src/wab/client/studio-ctx/selection-change.test.ts src/wab/client/studio-ctx/frame-selection.test.ts src/wab/client/studio-ctx/view-ctx.test.ts src/wab/shared/core/selection.test.ts src/wab/client/components/canvas/undo-batching.test.ts`：5 文件、37/37 通过。
- 临时 Vitest 探针调用真实 RenderState、ViewCtx 选择解析、ComponentCtx、buildViewCtxPinMaps 与变体 clone：7/7 通过。覆盖 fullKey、Slot、缓存 Val 更新、延迟注册、frame 隔离、嵌套栈断言和 clone 独立性。临时测试文件已删除；重现脚本与日志留在本机诊断目录。
- 探针初次 fixture 错把只读 `renderState` getter 当成可写字段；改为经 frameState 注入。另一个初始断言假设重新注册必然产生新缓存对象，被实际测试否定；最终测试验证同一对象的当前 props 更新。没有为使探针通过改业务代码。
- 没有运行优化后构建、全量 E2E、Electron A/B、堆快照或 MemLab；本轮没有生产代码修改。37 项是现状基线，7 项是 API 假设验证，均不能替代“改后功能正常”的验收。

## 内存与交互 A/B 的边界

使用当前匹配 renderer/Desktop 的隔离诊断构建和独立 profile；沿用现有 Electron/CDP 工具。`retention.cjs` 的旧 Docs/env/DeepMap fixture 不能直接证明整个 Studio 的 Undo 保留已解决，需增加实际 Studio 场景。

同一真实项目依次编辑多个页面/组件，包含重复实例和 Slot，累计固定数量模型编辑，再切走并等待对应 iframe/ViewCtx 确实销毁。仅 display:none 的 cached arena 仍是活跃缓存工作集，不应要求它被回收。保持 undo 全历史，再采集同等 GC 条件下的 baseline/target/final 快照，交给 MemLab 辅助找候选，按 dominator/retainer 核实 UndoRecord 路径和 frame 归属。

同时检查其他根（渲染 registry、全局派生缓存、诊断 console 对 record 的引用等）；切断一个引用不保证整个图都可回收。内存统计分开记录 JS heap/retained objects、原生/GPU 和各进程 RSS。trace、堆快照与交互计时分轮。

交互轮分别记录常见 undo/redo 和已回收 frame/嵌套上下文冷恢复的完成 p50/p95、长任务、eval 次数；不能用常见路径的平均值掩盖冷路径卡顿。没有测到实际释放量或延迟改善前，收益保持未知。
