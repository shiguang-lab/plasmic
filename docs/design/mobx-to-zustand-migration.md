# MobX → Zustand 全面迁移方案

> 状态：设计评估（未实施）
> 范围：`platform/wab`（Studio）。`packages/`、`plasmicpkgs/`、`desktop/` 无 MobX 依赖，不在范围内。
> 结论一句话：**UI/Store 层的迁移是可行的、可分波的；文档模型层的 MobX 是自定义的响应式内核，必须单独设计替换，否则"迁移到 zustand"只完成了一半。**

---

## 0. 结论（TL;DR）

1. `observer` 只是露出水面的部分。真正的工作量在三层：**组件订阅层（342 文件）→ ctx 状态层（~150 个 observable 字段 + 106 个 computed + 69 个 autorun/reaction）→ 文档模型反应式层（`observable-model.ts`，1990 行，用了 `mobx._getGlobalState()` 私有 API）**。
2. 文档模型不能用 zustand 表达。zustand 是"不可变快照 + 显式 selector"，而 Studio 的模型是"可变对象 + 字段级自动追踪 + 变更录制驱动 undo/增量保存"。强行改成不可变模型等于重写编辑器内核。
3. **推荐架构**：zustand 接管 UI/ctx 状态；文档模型保留可变对象，但把"字段级自动追踪"换成**显式修订索引（revision index）**——复用现有 change recorder 已经算出的脏节点集合来推进版本号，组件按实体/元素粒度订阅。精度从"字段级"降到"实体级"，用脏键推导表 + 双跑验证来兜底。
4. 迁移必须走 **facade 双写期**：先把状态搬进 store，`StudioCtx` 的 getter/setter 转发过去，消费端零改动；再逐个把消费端换成 hook；最后删 facade。否则 171 个消费文件 + 342 个 observer 文件无法并行推进。
5. 粗估：**单人 7–9 个月，3 人并行 ~4 个月**。其中文档模型层占 40% 工作量、80% 风险。

---

## 1. 现状测绘

### 1.1 依赖面

| 项 | 数值 |
|---|---|
| `observer` 出现 | 888 处 / 342 个文件（340 个在 `src/wab/client`） |
| `from "mobx-react"` | 283 处 |
| `observable.box/array/map/set/ref` 声明 | 229 处（181 box / 16 array / 19 map / 7 set / 5 ref / 1 shallow，全 client） |
| computed getter（`get xxx()`） | StudioCtx 66 + ViewCtx 24 + 其他 ≈ 106 |
| `autorun` / `reaction` | 49 / 20 |
| `maybeComputedFn`/`computedFn`/`keyedComputedFn` | 54 处在 `cached-selectors.ts`（1115 行），共 17 个文件使用 |
| `<Observer>` render-prop | 13 处真实使用 |
| `useObserver` | 11 处（多为 canvas 测试里同名的本地 hook） |
| 引用 `useStudioCtx`/`withStudioCtx` 的文件 | 171 |
| `mobx` 相关测试文件 | 63 |
| React | 18.3.1（zustand v5 可用） |

### 1.2 四层耦合

```
┌─────────────────────────────────────────────────────────┐
│ L1 组件订阅层     observer(342) / Observer(13)           │
│                  useStudioCtx/useViewCtx(171)            │
├─────────────────────────────────────────────────────────┤
│ L2 ctx 状态层     StudioCtx(9250行,~640成员)             │
│                  ViewCtx(3197行,~265成员)                │
│                  ViewportCtx / CanvasCtx / CommentsCtx   │
│                  computed(106) + autorun/reaction(69)    │
├─────────────────────────────────────────────────────────┤
│ L3 派生缓存层     cached-selectors(1115行, 54 个 fn)     │
│                  maybeComputedFn / keyedComputedFn       │
├─────────────────────────────────────────────────────────┤
│ L4 文档模型层     observable-model.ts(1990行)            │
│                  字段级 atom + 变更录制 + undo           │
└─────────────────────────────────────────────────────────┘
```

### 1.3 关键发现：文档模型是自定义 MobX 内核

`src/wab/shared/core/observable-model.ts` 并不是"给对象套一个 observable"那么简单：

- 用 `mobx._getGlobalState()`（私有 API）、`mobx.$mobx` 符号、`IObservableValue`/`IDerivation` 内部类型；
- 为每个 `ObjInst` 安装自定义 `ObservableInstAdmin`，每个字段一个 atom（`admin.__atoms[f.name].reportObserved()` / `reportChanged()`）；
- 通过 `getHandlers(clazz, allFields)` 生成 prototype 上的字段 descriptor，`get` 时报 observed、`set` 时报 changed；
- 同一套上报同时喂给两套系统：**MobX 响应式（驱动 React 重渲染）** 和 **变更事件系统（驱动 undo / 增量保存 / 冲突合并）**。

后果两条，都很重：

1. 它已经是 MobX 的"半私有 fork"。MobX 7 的破坏性升级会直接打断它——这本身是迁移的正当理由。
2. 删掉 mobx 意味着要同时接管"响应式"和"变更录制"两条链路。后者还有 `ChangeRecorder`、`undo-util`、`site-diffs/merge-*` 依赖。

另外 `src/wab/client/utils/mobx-client-util.ts` 重写了 `observer`，在组件体里调 `dependOnGlobalObservable()`，用一个全局 observable 做兜底失效——这是"跨组件失效"的补丁，迁移时要一并处理。

### 1.4 规模数据（拆分依据）

| 类 | 行数 | 成员 | getter | observable 字段 | 性质 |
|---|---|---|---|---|---|
| `StudioCtx` | 9250 | ~640 | 66 | 76（66 box + 3 array + 5 map + 1 set + 1 ref） | 状态 + 服务 + 业务动作混合 |
| `ViewCtx` | 3197 | ~265 | 24 | 25（24 box + 1 array） | 每个 ArenaFrame 一个实例 |
| `CanvasCtx` | 848 | ~72 | — | 3（2 box + 1 set） | **几乎全是服务**（jQuery/iframe/ResizeObserver） |
| `ViewportCtx` | 396 | — | — | 9 | zoom/pan/scroll |
| `CommentsCtx` | 663 | — | — | 8 | 网络 + UI 混合 |
| `MultiplayerCtx` | 182 | — | — | 3 | websocket + 状态 |

**重要推论：状态面远小于类面。** 全 client 只有 229 处 observable 声明，其中 `StudioCtx` 76、`ViewCtx` 25、`CanvasCtx` 3。真正要进 store 的是其中「被组件直接读」的子集（估 120–150 个），其余是内部缓存或服务句柄。`CanvasCtx` 的 72 个成员里只有 3 个是状态，其余全是服务——这些绝不能进 store。

---

## 2. 迁移的硬约束

| # | 约束 | 影响 |
|---|---|---|
| C1 | 文档模型必须保持可变异步、原地修改 | 排除"整体改成不可变树"的路线（会重写全部编辑逻辑 + undo + 增量保存） |
| C2 | undo/增量保存依赖字段级变更流 | 新方案必须继续产出 `RecordedChanges`，不能只做渲染 |
| C3 | `ViewCtx`/`CanvasCtx` 按 ArenaFrame 实例化 | 必须用 `createStore` + Context，不能用模块级 `create` |
| C4 | 大量动作在 React 之外调用（快捷键、DnD、canvas bridge、websocket） | store 必须支持 `getState()/setState()`，不能只暴露 hooks |
| C5 | canvas 目录有高频交互（hover/pointer/resize/60fps） | 必须有瞬态通道，不能每帧 setState |
| C6 | 63 个测试文件依赖 `when()/autorun` 等待语义 | 需要等价测试工具，否则测试大面积重写 |
| C7 | 性能敏感，`docs/performance/` 有基线 | 每一步都要过性能门禁 |

---

## 3. 目标架构

### 3.1 核心分类规则：四类成员，只有一类进 store

现状把所有东西塞在一个类里。迁移第一步是分类，不是搬迁。

| 类别 | 判定 | 归属 | 例子 |
|---|---|---|---|
| **State** | 被组件读取 + 变化需要重渲染 | zustand store | `leftPanel`、`canvasTool`、`focusedTpls`、`isSaving` |
| **Derived** | 纯函数、由 state/model 算出 | 选择器函数（不进 store） | `focusedTpl()`、`currentComponent()`、`activeCanvasFrame()` |
| **Service** | 持有句柄/连接/调度器，方法有副作用 | 普通类实例，**非响应式** | `CanvasCtx`、`DndManager`、`Bundler`、`AsyncSaver` |
| **Model** | 文档数据（Site/Component/TplNode…） | 可变对象 + 修订索引 | `site`、`tplTree`、`styleTokens` |

判据（写进 lint/评审清单）：

- 存进 store 的值必须**可序列化或至少可替换**；jQuery、iframe、`ResizeObserver`、WebSocket 一律不算 state。
- 只读一次就不变的东西（bundler、registry）不算 state。
- 能从别的 state 纯算出来的不存（避免双份真相）。

### 3.2 store 拓扑

#### 全局单例（`create`，模块级）

| Store | 职责 | 主要字段来源 |
|---|---|---|
| `studioShellStore` | 面板/对话框/布局 | `_leftPanel`、`_leftTabGroup`、`_xRightTabKey`、`_xLeftPaneWidth`、`_panelsHidden`、`_navigationPanel`、`_showVariantsDrawer`、`_pageSettings*`、`_isShortcutsModalOpen`、`_presetsModalComponent`、`_presetDrawerState`、`_saveAsPresetState`、`_forceOpen*`、`_findReferences*`、`alertBannerState`、`_onboardingTourState`、`_screenshotting`、`_isResizingFocusedArenaFrame` |
| `studioCanvasStore` | 画布工具/拖拽/显示开关 | `_canvasTool`、`_isInteractiveMode`、`_isAutoOpenMode`、`_freestyleState`、`_dragInsertState`、`_isDraggingObject/Resize`、`_isTransformingObject`、`_fullPageHeight*`、`canvasOverviewViewport`、`cursorLocation`、`_showSlotPlaceholder`、`_showContainerPlaceholder`、`_showStackOfParents`、`_showAncestorsHoverBoxes`、`_showCommentsOverlay`、`_showMultiplayerSelections` |
| `studioArenaStore` | arena 导航与焦点 | `_currentArena`、`_recentArenas`、`arenaViewStates`、`pinnedBackgroundArena`、`_xFocusedFrames`、`_xFocusedViewCtx`、`focusPreference` |
| `studioPersistenceStore` | 保存/加载/脏状态 | `_changeCounter`、`_savedChangeCounter`、`saveErrorState`、`isSaving`、`_saveFailedCounter`、`_isUnlogged`、`_isAtTip`、`desktopDraft`、`_isRefreshing`、`_isRestoring`、`canvasLoadError`、`initialRouteLoaded`、`initialViewportLoaded`、`releases`、`revisions`、`installedHostLessPkgs` |
| `studioSelectionStore` | 检查器选中与重命名 | `committedInspectorSelection`、`selectionPending`、`_renamingFocused`、`_renamingOnPanel` |
| `studioCopilotStore` | AI 面板 | `_copilotHistory`、`_copilotFeedbackByInteractionId`、`aiSessionId`、`_preferredAiOutputFormat`、`chatCopilotEnabled` |
| `studioCollabStore` | 多人/评论/用户 | `_watchPlayerId`、`_currentAppUserCtx`、`_showCommentsPanel`、multiplayer players、comments 面板态 |

#### 每实例（`createStore` + Context）

| Store | 粒度 | 主要字段 |
|---|---|---|
| `viewFocusStore` | 每 ViewCtx | `_xFocusedTpls`、`_xFocusedSelectables`、`_xFocusedDomElts`、`_focusedCloneKeys`、`_nextFocusedTpl`、`_focusedComponentPart`、`_xHighlightedAdoptees`、`_hoveredSelectable` |
| `viewEditingStore` | 每 ViewCtx | `_editingTextContext`、`draftText`、`_triggerEditingTextDataPicker`、`_triggerCreatingTextDataToken`、`_isEditingNonBaseVariant` |
| `viewDndStore` | 每 ViewCtx | `_dndTentativeInsertion`、`_dndDraggedNode` |
| `viewSyncStore` | 每 ViewCtx | `canvasDomRevision`、`_canvasMirrorTarget`、`_initialRenderReady`、`viewMode`、`pinnedVariants`、`_showDefaultSlotContents`、`autoOpenedUuid` |
| `viewportStore` | 每 ViewportCtx | zoom / pan / scroll / size / mode |

#### 不进 store（服务层）

`CanvasCtx` 的 `$viewport/$doc/$body/_win/_resizeObserver/_mutationObserver`、`DndManager`、`DevCliSvrEvaluator`、`Bundler`、`AsyncSaver`、`ChangeRecorder`、`TplMgr`、`MultiplayerCtx` 的 socket、`CommentsCtx` 的网络层。

### 3.3 拆分 / 合并判据

四条硬规则：

1. **按订阅者切，不按类切。** slice 的边界 = "总在同一批组件里一起被读、总在同一个动作里一起变化"的字段集合。按类 1:1 拆出来的 store 仍然是一个 640 字段的巨型 store，只是换了容器。
2. **高频与低频必须分家。** `hoveredSelectable`（60fps）、`cursorLocation` 与 `leftPanel`（用户点击才变）放在同一 store，会导致任何 selector 比较都变贵，且无法给高频字段开瞬态通道。高频字段单独成 store，并且**默认不进 React 渲染路径**（见 4.4）。
3. **合并判据**：两个字段若 (a) 总被同一 action 原子地一起写，(b) 总被同一组件一起读，则合并；否则拆开。
4. **跨 slice 的原子更新**用组合 action，在一次 `set` 里写完多个 slice，禁止 store A 的 action 里直接 `setState` store B。

```ts
// 反例：跨 store 直接写，破坏单向依赖
export const usePersist = create((set) => ({
  save: async () => {
    const ok = await api.save();
    useShell.getState().setSaveError(null); // ❌ 隐式耦合
  },
}));

// 正例：编排层（service）组合两个 store
// services/save-orchestrator.ts
export async function saveStudio({ shell, persist }: Stores) {
  const ok = await api.save();
  persist.getState().setSaveError(ok ? null : "failed");
  shell.getState().setAlert(ok ? null : { kind: "error" });
}
```

### 3.4 实例化模型

```ts
// 全局单例
export const useStudioShell = create<StudioShellState>()(subscribeWithSelector((set) => ({ ... })));

// 每实例（ViewCtx / ViewportCtx）—— 绝不用模块级 create
export type ViewStore = ReturnType<typeof createViewStore>;

export function createViewStore(init: ViewInit) {
  return createStore<ViewState>()(subscribeWithSelector((set) => ({
    focusedTpls: [], hoveredSelectable: undefined,
    ...init,
  })));
}

const ViewStoreContext = React.createContext<ViewStore | undefined>(undefined);

export function useViewStore<T>(selector: (s: ViewState) => T): T {
  return useStore(ensure(useContext(ViewStoreContext)), selector);
}
```

`useStore(store, selector)` 是 zustand v5 推荐写法，天然支持"每实例 store + 精确 selector"。

### 3.5 依赖方向规则

```
组件 ──▶ hooks ──▶ store ──▶ 纯函数 selector ──▶ model(只读)
  │                  │
  └──▶ service ◀─────┘   （service 可持有 store 引用；store 不持有 service 引用）
```

- store 的 action 需要 service 时，通过 `getServices()` 惰性取，**不要把 service 放进 state**（否则 devtools/序列化/比较全废）。
- 组件不直接调用 service 改状态，改状态一律走 action。
- model 只读；写 model 一律经过 `applyModelMutation`（见 5.2），由它负责 bump 修订号。

---

## 4. Zustand 优化手段

### 4.0 先对齐真实 API（重要）

**zustand 没有 `shadow`，也没有 `useShadow`。** 核验依据：

- 已安装包 `zustand@5.0.15` 与 `zustand@4.5.7` 全量检索字符串 `shadow`，命中 **0** 处；
- [官方 Reference](https://zustand.docs.pmnd.rs/reference/index) 只列出下列 API。

完整清单（v5）：

| 分类 | API | 说明 |
|---|---|---|
| API | `create` | 绑定 React 的 store |
| API | `createStore` | 无 React 的 vanilla store（每实例场景用这个） |
| API | `createWithEqualityFn` | `create` + 自定义相等函数 |
| API | `shallow` | 对象/数组浅比较工具 |
| Hook | `useStore` | 读 vanilla store，支持 selector |
| Hook | `useStoreWithEqualityFn` | 同上 + 自定义相等 |
| Hook | **`useShallow`** | selector 结果做浅比较，**返回稳定引用** |
| 中间件 | `persist` / `devtools` / `redux` / `immer` / `combine` / `subscribeWithSelector` | — |

容易记混的三个名字：

| 你可能记成 | 实际是 | 出处 |
|---|---|---|
| `useShadow` | **`useShallow`** | zustand |
| `shadow` | 无此 API；"shadow state / shadow snapshot" 只是社区叫法 | — |
| `useSnapshot` | 是 **valtio** 的 API，不是 zustand | valtio |

> ⚠️ 导入路径：`createWithEqualityFn` 与 `useStoreWithEqualityFn` **都在 `zustand/traditional`**，不在根入口（根入口只有 `createStore`/`create`/`useStore`）。`traditional` 依赖 `useSyncExternalStoreWithSelector`，需要 optional peer **`use-sync-external-store`**；`platform/wab` 目前没有直接依赖它。**本方案的结论是不采用**（见 4.2「决策」），若将来引入必须显式加依赖。

因此本文后续**不使用 `useShadow` 这个命名**（避免自造一个和上游撞名的 API）。"按帧合并的高频订阅"我们自己的 helper 叫 `useFrameValue`，语义在 4.4 说明。

**优化手段 ↔ 它替代的 MobX 用法**：

| zustand 手段 | 替代 MobX 的什么 |
|---|---|
| 单字段 selector | `observer` 的自动依赖追踪 |
| `useShallow` / `useStoreWithEqualityFn` / `shallow` | `computed` 的等价比较（`{ equals }`、`comparer.structural`） |
| `subscribeWithSelector` | `reaction` |
| `store.subscribe`（无 React） | `autorun` 的命令式副作用 |
| `createStore` + Context | 每实例 ctx（`ViewCtx`/`ViewportCtx`） |
| `useFrameValue`（自建，4.4） | 高频 observable 的 60fps 更新 |
| `getInitialState()`（v5） | 测试间重置 / hot reload |

### 4.1 最小订阅：规范与反例

zustand 的重渲染完全由 selector 的返回值决定。

```ts
// ❌ 返回新对象：每次都重渲染
const { leftPanel, rightTab } = useStudioShell((s) => ({ leftPanel: s.leftPanel, rightTab: s.rightTab }));

// ✅ 一个字段一个 hook（首选，最简单也最快）
const leftPanel = useStudioShell((s) => s.leftPanel);
const rightTab = useStudioShell((s) => s._xRightTabKey);

// ✅ 需要组合时用 useShallow
import { useShallow } from "zustand/react/shallow";
const { leftPanel, rightTab } = useStudioShell(
  useShallow((s) => ({ leftPanel: s.leftPanel, rightTab: s._xRightTabKey })),
);
```

**反例来自当前代码**：`usePlasmicCtx()` 一次返回 `{ studioCtx, viewCtx }` 并在渲染期调 `focusedViewCtx()`。迁移后若原样保留，等于订阅"焦点 view 变化 + 所有 ctx 字段"，必须拆成 `useFocusedViewCtxId()` + 各自 selector。

规范（写进 eslint 规则 + 评审清单）：

1. selector 必须是纯函数，返回原始值或稳定引用；
2. 禁止在 selector 里做 `map/filter/sort`（每次新数组）；要派生就提到 `selectXxx` 并用 4.5 的缓存；
3. 禁止 `useStore((s) => s)`；
4. 一次 `useStudioShell` 最多取 1 个字段；多于 1 个必须 `useShallow` 并注明理由；
5. 高频字段（hover/pointer/cursor）禁止出现在渲染期 selector 里。

### 4.2 `shallow` 与 `useShallow`

#### 为什么需要 equality：订阅粒度变了

这是整个迁移里最容易被忽略的一次"语义降级"：

| | MobX `observer` | zustand |
|---|---|---|
| 订阅对象 | 本次渲染**读到的每个字段**（atom） | **整个 store**（任何字段变化都通知） |
| 粒度来源 | 自动依赖追踪 | selector 的返回值 |
| 过滤手段 | 无（天生精确） | `Object.is` → 不够时靠 **equality** |

也就是说：`observer` 组件读 `tpl.name` 时，`tpl.props` 变化不会让它重渲染，**不需要任何相等函数**。换成 zustand 后，store 里任何字段一变，所有 selector 都会重跑；如果 selector 返回的是新数组/新对象，`Object.is` 必然失败 → 重渲染。

**所以自定义 equality 不是"优化技巧"，而是把丢失的订阅精度重新补回来。** 你现在代码里那 39 处 `equals:`（`comparer.structural` 10、`lintIssuesEquals` 14、`comparer.shallow` 1、其他 14）就是同一个概念在 MobX 里的形态。

#### 两个 API 的区别

| | `shallow(valueA, valueB)` | `useShallow(selector)` |
|---|---|---|
| 形态 | 纯比较函数 | React hook（内部 `useRef`） |
| 导入 | `zustand/shallow` 或 `zustand/vanilla/shallow` | `zustand/react/shallow`（也可从 `zustand/shallow` 一并取） |
| 作用 | 判断两个值是否"浅相等" | selector 结果浅相等时**返回上一次的引用** |
| 使用位置 | `subscribe` 的 `equalityFn`、`createWithEqualityFn`、`useStoreWithEqualityFn` | 组件里一次读多个字段 |
| 解决的问题 | 值比较 | React 边界上的引用稳定性 |

#### 精确语义（依据 v5.0.15 源码 + 实测）

判定顺序：`Object.is` → 任一侧非对象返回 `false` → **原型必须相同** → 可迭代对象走 entries / 元素比较 → 否则比较自身可枚举属性，**只比一层**。

实测结果：

| 输入 A / B | `shallow` | 说明 |
|---|---|---|
| `new Pt(1,2)` / `new Pt(1,2)` | ✅ `true` | 类实例按 own enumerable 字段比 |
| `new Pt(1,2)` / `{x:1,y:2}` | ❌ `false` | 原型不同直接 false |
| `{a:{x:1}}` / `{a:{x:1}}` | ❌ `false` | **只比一层**，嵌套对象比引用 |
| `[1,2]` / `[1,2]` | ✅ `true` | 数组按元素比 |
| `[{x:1}]` / `[{x:1}]` | ❌ `false` | 元素是对象，比引用 |
| `new Map([[1,2]])` ×2 | ✅ `true` | Map 按 entry 比 |
| `new Set([1,2])` ×2 | ✅ `true` | 可迭代按元素比 |
| `new Date(1)` / `new Date(2)` | ⚠️ `true` | 无自有属性，被判定相等 |
| `/a/` / `/b/` | ⚠️ `true` | 同上 |
| 含 `#private` 字段的类实例 | ⚠️ `true` | 私有字段不可枚举 |

最后三行是坑，能避免一类"状态变了但界面不动"的隐蔽 bug。

#### 用法一：组件里读多个字段

```ts
import { useShallow } from "zustand/react/shallow";

const { leftPanel, rightTabKey } = useStudioShell(
  useShallow((s) => ({ leftPanel: s.leftPanel, rightTabKey: s.rightTabKey })),
);
```

#### 用法二：命令式订阅的等价判断

```ts
import { shallow } from "zustand/shallow";

store.subscribe(
  (s) => ({ tpl, box: s.boxOf[tpl.uuid] }),
  (cur, prev) => { /* ... */ },
  { equalityFn: shallow },   // 需要 subscribeWithSelector 中间件
);
```

#### 用法三：整个 store 的默认等价函数

```ts
import { createWithEqualityFn } from "zustand/traditional";
import { shallow } from "zustand/shallow";

export const useStudioCanvas = createWithEqualityFn<CanvasState>()(
  subscribeWithSelector((set) => ({ ... })),
  shallow,   // 所有 selector 默认浅比较
);
```

适合"读多字段、字段都是扁平值"的 store；不适合嵌套结构为主的 store。

#### 用法四：自定义业务等价（`Box` / lint 列表）

`shallow` 只比一层，`Box` 内含 `Pt`、lint issue 含嵌套对象，都不适用。项目里已有 `.equals()` 和 `lintIssuesEquals`：

```ts
import { useStoreWithEqualityFn } from "zustand/traditional";

const boxEquals = (a?: Box, b?: Box) => a === b || (!!a && !!b && a.equals(b));

const box = useStoreWithEqualityFn(viewportStore, (s) => s.focusedBox, boxEquals);
```

#### 性能真相

`useShallow` **不会跳过 selector 执行**。每次 store 通知都会先跑 selector，再做浅比较；相等才复用旧引用、跳过渲染。

所以：

- 能写成单字段 selector 就**不要**用 `useShallow`（省掉一次分配 + 浅比较）；
- 不要用它给过粗的 selector 打补丁（`useShallow((s) => s)` 只是把问题藏起来）；
- selector 每次返回嵌套新对象 → `useShallow` 无效，只能改数据形状或换自定义 equality。

#### 映射到本仓库的 MobX 等价比较（按层，不按名字）

关键事实：全仓库 **37 处 `equals:` 中，没有一处是 React 订阅层的自定义 equality**。原因是 MobX 的 `observer` 按字段追踪，本来就不需要。它们分布在另外三层：

| 层 | 数量 | 现状 | 迁移去向 | 需要 `traditional` 吗 |
|---|---|---|---|---|
| **缓存失效判定** | 17 | `maybeComputedFn(fn, { equals })` | 记忆化 selector 的 revision/key 策略（4.5） | ❌ 不需要 |
| **通知抑制** | ~12 | `observable.box(v, { equals })`（`ViewportCtx._enqueuedTransform`、`StudioCtx._xFocusedFrames` 等） | store action 内部先判等再 `set` | ❌ 不需要 |
| **副作用抑制** | 6 | `reaction`/`computed` 的 `equals` | `subscribe(selector, cb, { equalityFn })` | ❌ 不需要（`shallow` 够） |
| **工具定义** | 1 | `mobx-util.equalsComparer` | 随 `mobx-util.ts` 一起删除 | — |

换句话说：**`useStoreWithEqualityFn` 在这份代码库暂时没有对应需求。** 真正需要等价的 6 处副作用抑制，用 `subscribe` 的 `equalityFn: shallow` 就能覆盖。

#### 决策：不引入 `zustand/traditional`（v1）

基于上面的分层数据，**迁移 v1 不引入 `traditional`，也不加 `use-sync-external-store` 依赖**。理由：

1. 现有 37 处 `equals:` 没有一处落在 React 订阅层；
2. React 边界的多字段读取，`useShallow` 已覆盖；
3. 副作用抑制用 `subscribe(..., { equalityFn: shallow })` 覆盖；
4. 缓存失效判定本来就该由 selector 的记忆化策略处理，与 equality API 无关。

真正需要回头引入的**唯一触发条件**：性能门禁证明某个组件必须选择深嵌套结构，且深比较比重渲染便宜。到那时按单点处理：

```ts
// 只在被门禁证伪的具体位置使用，并写 ADR 说明为何不能扁平化
import { useStoreWithEqualityFn } from "zustand/traditional";
const value = useStoreWithEqualityFn(store, (s) => s.deepNested, deepEquals);
```

判断"必须自定义"的三条，全部满足才引入：

- [ ] selector 无法扁平化（结构由外部协议/组件契约决定）；
- [ ] 深比较的成本 < 重渲染的成本（有测量数据）；
- [ ] 用 `useShallow` + 记忆化 selector 都无法拿到稳定引用。

> 经验判据：`traditional` 用得多，说明状态形状在照搬 MobX 的深层对象，而不是 zustand 期望的扁平快照。把它当重构信号，不是默认选项。

### 4.3 `subscribeWithSelector` 替代 `reaction` / `autorun`

现状 69 处，分布在构造器和组件里。迁移映射：

```ts
// MobX
reaction(() => this.isTransforming(), () => { this.fixRuler(); this.adjustDevEnv(this.zoom); });

// zustand
useStudioCanvas.subscribe(
  (s) => s.isTransformingObject,
  () => { fixRuler(); adjustDevEnv(); },
  { fireImmediately: false },
);
```

`autorun` 的多依赖副作用（如 `observeCurrentArena`）→ 抽成 `effects/` 模块，返回 disposer，由 Studio 初始化时统一 `startEffects(services)`，卸载时统一 dispose：

```ts
// effects/arena-effects.ts
export function startArenaEffects({ arena, services }: Deps): () => void {
  const disposers = [
    arena.subscribe((s) => s.currentArena, () => services.observeCurrentArena(), { fireImmediately: true }),
    arena.subscribe((s) => s.focusedViewCtx, () => services.observeCurrentViewCtx(), { fireImmediately: true }),
  ];
  return () => disposers.forEach((d) => d());
}
```

`when()` → 测试与实践统一用：

```ts
export function waitForStore<T>(store: StoreApi<T>, pred: (s: T) => boolean): Promise<void> {
  return new Promise((resolve) => {
    if (pred(store.getState())) return resolve();
    const unsub = store.subscribe((s) => { if (pred(s)) { unsub(); resolve(); } });
  });
}
```

### 4.4 瞬态更新与按帧合并（`useFrameValue`）

这是这个项目能否达标的关键。Studio 里有一批**每帧都在变、但只有少数 DOM 需要跟着动**的值：`$hoveredDomElt`、`_pointerState`、`cursorLocation`、`_dragInsertState`、`_measureToolDomElt`。它们现在是 MobX observable + overlay 组件 `observer`，等价迁移会变成"每帧 setState → 每帧 React 重渲染"，必然掉帧。

策略：**三级通道**。

**① 瞬态通道（不进 React）** —— 命令式代码直接订阅并操作 DOM：

```ts
// services/hover-channel.ts
export const hoverChannel = createStore<{ hoveredDomElt: JQuery | null }>()(
  subscribeWithSelector(() => ({ hoveredDomElt: null })),
);
// overlay 之外的地方：
hoverChannel.subscribe((s) => s.hoveredDomElt, (elt) => { /* 直接改 jQuery/DOM */ });
```

React 侧完全不参与，等价于现在的 `autorun(() => this.$hoveredDomElt().css(...))`。

**② 按帧合并的 shadow 快照（进 React，但每帧最多一次）** —— 需要渲染时用 `useFrameValue`（名字是我们起的，不是 zustand API）：

```ts
export function useFrameValue<T>(
  store: StoreApi<any>,
  selector: (s: any) => T,
  opts: { equals?: (a: T, b: T) => boolean } = {},
): T {
  const equals = opts.equals ?? Object.is;
  const shadow = useRef<{ value: T } | undefined>(undefined);
  const scheduled = useRef(false);
  const notifyRef = useRef<(() => void) | undefined>(undefined);

  const subscribe = useCallback(
    (notify: () => void) => {
      notifyRef.current = notify;
      return store.subscribe((state) => {
        const next = selector(state);
        const cur = shadow.current;
        // 首次由 getSnapshot 初始化，这里只处理后续变化
        if (cur && equals(cur.value, next)) return;
        if (!shadow.current) shadow.current = { value: next };
        else shadow.current.value = next;      // 同步可见：命令式代码永远读到最新
        if (scheduled.current) return;
        scheduled.current = true;
        requestAnimationFrame(() => {          // 渲染合并到帧
          scheduled.current = false;
          notifyRef.current?.();
        });
      });
    },
    // selector/equals 必须是稳定引用（useCallback 或模块级函数），否则会反复重订阅
    [store, selector, equals],
  );

  const getSnapshot = useCallback(() => {
    // React 会在 subscribe 之前调用 getSnapshot，必须能惰性初始化
    if (!shadow.current) shadow.current = { value: selector(store.getState()) };
    return shadow.current.value;
  }, [store, selector]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
```

关键性质：`getSnapshot` 返回**同一个引用**直到值真的变了（满足 React 的不变式），高频写入最多一帧一次渲染，同时命令式代码通过 ref 拿到最新值。

用法：

```tsx
const hovered = useFrameValue(hoverChannel, (s) => s.hoveredDomElt, { equals: (a, b) => a === b });
```

**③ 普通订阅** —— 低频字段（面板、开关、选中）用 4.1 的常规 hook。

> 命名说明：zustand 官方没有 `useShadow`/`shadow`，所以这里不占用这个名字。若团队更习惯叫“shadow 快照”，可以把它作为该模式的中文别名，但 API 名建议保持 `useFrameValue` 之类的语义化命名。

### 4.5 派生值缓存

> 可直接运行的参考实现见 [`example/`](mobx-to-zustand-migration/example/)（`tsc --strict` 通过，含 6 项语义断言）。

现状：106 个 computed getter + 54 个 `maybeComputedFn`（`cached-selectors.ts` 1115 行）。这些是 Studio 性能的命脉，迁移不能靠 `useMemo` 硬顶。

**分层**：

| 类型 | 方案 |
|---|---|
| 无参数、O(1)/O(n) 便宜 | 纯函数 `selectX(state)`，不缓存 |
| 无参数、O(n) 以上 | `createModelSelector`（依赖修订号缓存，见 5.4） |
| 带参数（按 tpl/component/uuid） | `keyedSelector(fn, keyFn)`，内部 `WeakMap` + 修订号失效 |
| 需要跨组件共享同一实例 | 提到 store 之外的单例缓存，带显式 `dispose()` |

```ts
// derived/memo.ts
const cache = new WeakMap<object, { rev: number; value: unknown }>();

export function createModelSelector<T>(deps: () => number[], fn: () => T): () => T {
  let lastDeps: number[] | undefined;
  let value: T;
  return () => {
    const d = deps();
    if (!lastDeps || d.length !== lastDeps.length || d.some((v, i) => v !== lastDeps![i])) {
      value = fn();
      lastDeps = d;
    }
    return value;
  };
}
```

`computedFn` 的 `keepAlive` 语义在现有代码里已有内存泄漏隐患（`AssertSiteInvariants.ts` 有注释警告）。迁移时用"修订号 + 显式 dispose"替代"永不过期缓存"，顺手修掉。

### 4.6 `immer` 使用边界

- **默认不用**。Studio 的状态多数是扁平字段 + 少量数组，手写不可变更快、更可预测。
- **局部用**。深层嵌套配置（`presetDrawerState`、`arenaViewStates`、`onboardingTourState`）用 `immer` middleware 减少样板；`immer@10` 已在 store 中。
- **禁止**对 model 对象用 immer（model 仍可变，混进来会造成双份真相）。

### 4.7 批处理与稳定性

- 一个用户动作 = 一次 `set`。多字段一起改写在同一个 `set({...})` 里，React 18 自动批处理。
- action 必须稳定引用（`create` 里定义的函数天然稳定），不要把 `useCallback` 包过的 action 塞进 selector 返回对象。
- 异步 action 里 `await` 之后必须重新 `getState()`，不要用闭包里的旧 state。

---

## 5. 文档模型反应式替换（核心难点）

### 5.1 三条路线对比

| 方案 | 做法 | 渲染精度 | 工作量 | 风险 | 结论 |
|---|---|---|---|---|---|
| **A 修订索引**（推荐） | 模型保持可变；写入时收集脏节点 → 推进"实体/元素"修订号；组件订阅修订号 | 实体/元素级（原字段级） | 中 | 漏订阅（可用双跑验证兜底） | ✅ 采用 |
| B 不可变模型 | immer/persistent 结构，写时复制 | 结构共享，天然精确 | 极高（重写编辑/undo/增量保存） | 极高 | ❌ 否决 |
| C 换 Proxy 引擎（valtio 等） | 保留字段级自动追踪，只换库 | 字段级 | 中低 | 中（引入新依赖，不是 zustand） | 备选 |
| D 只换 UI 层 | 模型继续用 mobx | 不变 | 低 | 低 | 不满足"去 mobx"目标 |

**建议 A**，并把 C 作为性能门禁不通过时的备选（`valtio` 已在 `packages/react-web` 的依赖树里，团队不陌生）。

### 5.2 修订索引设计

保留现有 descriptor 安装机制（`getHandlers`），**只替换上报目标**：

```
read  → 不再 reportObserved（无全局追踪）
write → 记录 (inst, field) 到事务脏集合，事务结束统一 flush
```

```ts
// model/revisions.ts
export type ModelKey = string; // "site" | "component:<uuid>" | "tpl:<uuid>" | "variant:<uuid>" | "token:<uuid>"

const revisions = new Map<ModelKey, number>();
let pending = new Set<ModelKey>();
let pendingFlush = false;
const listeners = new Map<ModelKey, Set<() => void>>();
const globalListeners = new Set<() => void>();

export function getRevision(key: ModelKey): number {
  return revisions.get(key) ?? 0;
}

export function markDirty(key: ModelKey) {
  pending.add(key);
  if (!pendingFlush) {
    pendingFlush = true;
    queueMicrotask(flush);
  }
}

function flush() {
  pendingFlush = false;
  const keys = pending; pending = new Set();
  keys.forEach((k) => {
    revisions.set(k, getRevision(k) + 1);
    listeners.get(k)?.forEach((cb) => cb());
  });
  globalListeners.forEach((cb) => cb());
}
```

写在事务里的原子性由现有 `studioCtx.change()` 保证，`flush` 用 microtask 合并同一同步批次的多次写入（等价于 MobX 的 batch）。

### 5.3 脏键推导表（必须写成可测规范）

| 变更字段类型 | 必须 bump 的键 |
|---|---|
| `TplTag.name/codeGenType/props...` | `tpl:<uuid>`、`component:<owner>` |
| `TplTag.parent` / `children` / 布局相关字段（tpl / variants / styles） | `tpl:<uuid>`、`component:<owner>`、`tpl:<祖先链>`（几何依赖） |
| `Component.tplTree` | `component:<uuid>`、`site` |
| `Variant.*` | `variant:<uuid>`、所有引用它的 `component:<uuid>` |
| `StyleToken.*` | `token:<uuid>`、`site` |
| `RuleSet.*` | `site`（样式可能全局生效） |
| `Site.*` | `site` |
| `Arena/PageArena.*` | `site`、`arena:<uuid>` |

**这条表是迁移的主要正确性风险来源。** 实施要求：

1. 表本身写成 `model-dirty-keys.ts` 中的纯函数 + 单测（golden test）；
2. **双跑验证**：在 dev 下同时运行旧 MobX 追踪与新修订索引，对同一批编辑操作比较"哪些组件重渲染"，差异即 bug；
3. 对几何相关消费者（overlay、ruler、measure）保守订阅 `component` 级键。

### 5.4 组件侧 API

```ts
// hooks/useModel.ts
export function useModelRevision(key: ModelKey): number {
  return useSyncExternalStore(
    (cb) => subscribeModelKey(key, cb),
    () => getRevision(key),
    () => getRevision(key),
  );
}

// 派生 + 缓存，替代 computedFn
export function useModelSelector<T>(keys: ModelKey[], fn: () => T, equals = Object.is): T {
  // 单次 useSyncExternalStore 订阅一组键（避免在循环里调用 hook）
  const rev = useSyncExternalStore(
    (cb) => subscribeModelKeys(keys, cb),
    () => keys.map((k) => getRevision(k)).join("."),
    () => keys.map((k) => getRevision(k)).join("."),
  );

  const ref = useRef<{ rev: string; value: T } | undefined>(undefined);
  if (!ref.current || ref.current.rev !== rev) {
    const value = fn();
    if (ref.current && equals(ref.current.value, value)) {
      ref.current.rev = rev;              // 值没变，只更新失效标记，保住引用
    } else {
      ref.current = { rev, value };
    }
  }
  return ref.current.value;
}
```

迁移前后对照：

```tsx
// 迁移前
const Row = observer(function Row({ tpl }: { tpl: TplNode }) {
  return <span>{tpl.name} · {isTplNamable(tpl) ? tpl.name : "—"}</span>;
});

// 迁移后
function Row({ tpl }: { tpl: TplNode }) {
  const name = useModelSelector([tplKey(tpl)], () => (isTplNamable(tpl) ? tpl.name : "—"));
  return <span>{name}</span>;
}
```

### 5.5 精度损失与补偿

**损失**：字段级 → 实体级。同一 tpl 的 `name` 变化会让只读 `props` 的组件也重渲染。

**补偿**：

1. 热路径目录（`components/canvas/`、`tpl-tree`、overlay）允许进一步细分键（`tpl:<uuid>:<fieldGroup>`），只对高频字段（name/text/props）做；
2. selector 内加廉价的 `equals`（返回值多为字符串/数字/数组，成本低）；
3. 布局键与内容键分离，内容编辑不触发几何重算。

### 5.6 双跑验证（迁移期必备）

dev 模式同时启用 MobX 追踪与修订索引，记录"每个组件因何失效"：

- MobX 侧：`observer` shim 记录本次渲染读到的 atom 集合；
- 修订索引侧：记录本次渲染订阅的 key；
- 断言：旧追踪里的每个 atom，都能映射到至少一个已订阅的 key。

不满足时在 dev 控制台报 `[reactivity] X read tpl:<uuid>.name but only subscribed component:<uuid>`，并 fail 对应测试。这是把"漏订阅"从线上事故变成构建期错误的唯一可靠手段。

---

## 6. 替换路线图

原则：**每一波都可独立上线、可回滚；永不同时改 store 与消费端。**

### Wave 0 — 基础设施（2–3 周）
- 引入 `zustand@^5`，加 `devtools`（仅 dev）、`subscribeWithSelector`；
- 建 `src/wab/client/stores/_kit/`：`createSlice`、`resetAllStores`、`waitForStore`、`useFrameValue`、`equality`；
- 定义 ADR 与目录规范、eslint 规则草案；
- 试点 2 个叶子：`desktop-drafts`、`ui-theme`（已有手写 external store，顺带统一）。

**验收**：试点模块单测通过；`resetAllStores` 能在测试间完全隔离。

### Wave 1 — 叶子 UI store（3–4 周）
范围：对话框/引导/查找引用/预设抽屉等，无 model 依赖、消费端 < 10 个组件的模块。
每 PR 交付：一个 store + 其消费组件 + 1 个反应性测试。

**验收**：无 `observer` 残留于新模块；包体积不增。

### Wave 2 — StudioCtx 拆 slice + facade 双写（6–8 周）
- 一次性建好 7 个全局 store（空壳 → 填字段）；
- `StudioCtx` 对应字段改成 getter/setter 转发到 store：

```ts
class StudioCtx {
  get leftPanel() { return studioShellStore.getState().leftPanel; }
  set leftPanel(v: LeftPanel | undefined) { studioShellStore.getState().setLeftPanel(v); }
}
```

- 消费端**零改动**；`observer` 仍然生效（store 写入时 MobX 侧已无 atom，需要过渡期 shim：`observer` 额外订阅"任意 store 变更"的粗粒度 tick）。

**验收**：Studio 功能回归清单全绿；保存/undo 行为不变。

### Wave 3 — ViewCtx / ViewportCtx / CanvasCtx（4–6 周）
- 引入 `ViewStoreContext` / `ViewportStoreContext`，`createViewStore` 与 ViewCtx 同生命周期；
- 先迁低频（focus/editing/dnd），再迁高频（hover/pointer，走 4.4 瞬态通道）；
- `CanvasCtx` 只抽出 3 个状态字段，其余保持服务。

**验收**：多 arena（左右分屏、overview）互不串状态；canvas 交互帧率不低于基线。

### Wave 4 — 派生层（4–6 周）
- `cached-selectors.ts` 1115 行 → `derived/` 目录，逐函数改写成 `createModelSelector` / `keyedSelector`；
- 删 `maybeComputedFn` / `keyedComputedFn` / `ownedComputedFn`；
- 用 `docs/performance/` 的基线跑对照。

**验收**：首屏、大 page（>1000 tpl）编辑延迟不回退；内存不增长。

### Wave 5 — 文档模型反应式（8–12 周）
- 实现 `revisions.ts` + `dirty-keys.ts` + `useModelRevision/useModelSelector`；
- 双跑验证上线（5.6）；
- 按目录灰度替换 `observer` → `useModel*`：`canvas/` → `sidebar-tabs/` → 其余；
- 每个目录完成后删除该目录的 `observer` 兼容 shim，并加入 eslint 禁入清单。

**验收**：双跑零差异运行 2 周；性能基线达标；undo/增量保存/golden 测试全绿。

### Wave 6 — 收尾（2–3 周）
删除清单：

- [ ] `mobx`、`mobx-react`、`mobx-utils` 依赖
- [ ] `src/wab/shared/import-mobx.ts`（强制 dev build 的 shim，随包体积一起消失）
- [ ] `mobx-client-util.ts` 的自定义 `observer`
- [ ] `mobx-util.ts` 的 `computedFn`/`getter`/`setter`/`makeGlobalObservable`
- [ ] `hackyMobxUtils()` 与 `ObservableInstAdmin`（只保留变更录制部分）
- [ ] 63 个测试文件里的 mobx 等待逻辑 → `waitForStore`
- [ ] eslint `no-restricted-imports: ["mobx", "mobx-react", "mobx-utils"]`
- [ ] `knip:deps` 确认无残留

---

## 7. 机械改造工具链

342 个文件靠手工不现实。工具按优先级：

1. **eslint 规则**（自研，最重要）
   - `no-mobx-import`：分目录白名单，迁移完一个目录就加黑；
   - `no-object-selector`：禁止 selector 返回对象字面量（除非包 `useShallow`）；
   - `no-service-in-state`：禁止把 `CanvasCtx`/jQuery 类型放进 `create` 初值。
2. **codemod**（jscodeshift）
   - `observer(X)` → `X` + 根据文件内容生成待办注释（不自动补 selector，避免猜错）；
   - `studioCtx.foo` → `useStudioStore(s => s.foo)`（仅在函数组件顶层、且 foo 已知是 state 时）。
3. **反应性测试模板**：每个迁移组件一个 8 行测试，断言"依赖变化 → 重渲染；非依赖变化 → 不重渲染"。这是防止漏订阅的主力。
4. **inventory 脚本**：扫描类成员并归类 state/derived/service/model，产出待迁移清单（Wave 2 前置）。

---

## 8. 验收与性能门禁

| 门禁 | 指标 | 来源 |
|---|---|---|
| 首屏 | Time to interactive 不回退 > 5% | `docs/performance/` 基线 |
| 大页面编辑 | 选中/拖拽/输入延迟不回退 > 10% | 同上 |
| 内存 | 30 分钟会话不增长 > 10% | 现有分析报告 |
| 功能 | undo/redo、增量保存、冲突合并 golden 测试全绿 | `site-diffs/`、`undo-log` |
| 反应性 | 双跑零差异；反应性测试 100% 覆盖迁移组件 | 5.6 |
| 包体积 | 移除 mobx/mobx-react/mobx-utils 后净减 | `build.mjs` 产物 |

---

## 9. 风险登记册

| # | 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|---|
| R1 | 漏订阅导致静默不更新 | 高 | 严重 | 双跑验证 + 反应性测试 + 分目录灰度 |
| R2 | 修订键推导不全（尤其几何/祖先依赖） | 高 | 严重 | 脏键推导表 + golden test；几何消费者保守订阅 component 级 |
| R3 | 高频状态迁入 React 导致掉帧 | 中 | 高 | 三级通道 + `useFrameValue`；高频字段禁入渲染期 selector |
| R4 | 派生缓存失效策略错误 → 脏读 | 中 | 高 | 修订号驱动，禁止"永不过期"缓存 |
| R5 | facade 双写期出现双份真相 | 中 | 中 | facade 只做转发，不留第二份副本；加测试断言 |
| R6 | 每 arena 实例 store 串状态 | 中 | 中 | 一律 `createStore` + Context，eslint 禁模块级 create 于 view 层 |
| R7 | 测试大面积重写拖慢进度 | 高 | 中 | 先建 `waitForStore`/`resetAllStores`，Wave 0 就位 |
| R8 | 迁移期两套系统性能叠加 | 中 | 中 | 双跑只在 dev；生产单系统 |
| R9 | 团队对 zustand 语义不熟 | 中 | 中 | ADR + 模板 + 评审清单；Wave 0 试点定型 |

---

## 10. 工作量估算（粗略，单人）

| 波次 | 工作量 | 累计 |
|---|---|---|
| Wave 0 基础设施 | 2–3 周 | 3 |
| Wave 1 叶子 store | 3–4 周 | 7 |
| Wave 2 StudioCtx 切片 | 6–8 周 | 15 |
| Wave 3 View/Canvas | 4–6 周 | 21 |
| Wave 4 派生层 | 4–6 周 | 27 |
| Wave 5 模型反应式 | 8–12 周 | 39 |
| Wave 6 收尾 | 2–3 周 | 42 |

≈ **8–10 个月单人**；3 人按波次并行（Wave 1/3 可前置）约 **4–5 个月**。假设：不改变现有编辑语义、不重写 undo、不引入不可变模型。

---

## 11. 立即可以做的三件事

1. **跑 inventory 脚本**，把 StudioCtx/ViewCtx 的 640/265 个成员标注为 state/derived/service/model——这是 Wave 2 的输入，也是工作量估算的校准依据。
2. **Wave 0 试点 `desktop-drafts`**，用真实模块验证 slice 规范、`useFrameValue`、测试工具，产出一份可复制的迁移模板。
3. **先做脏键推导表与 golden test**（5.3），它决定 Wave 5 能否成立；这是整个方案里唯一"做错了要返工全部"的部分。
