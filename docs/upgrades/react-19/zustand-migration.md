# Studio Zustand 迁移方案与验收

状态：已按用户要求恢复迁移；同类改动批量执行，重验收累计50～100文件。目标版本 Zustand **5.0.16**；React Compiler **1.0.0** 默认启用，编译范围随显式订阅迁移扩大。最终交付移除 Studio 的 MobX、mobx-react、mobx-react-lite、mobx-utils 直接依赖、订阅器和专用构建配置。迁移期间按模块完成替换，不能把阶段性共存算作完成。

## 当前验收范围

当前已验收并暂停的是冻结的 L 批次：[验收摘要](state-verification-u35l.json)；[续做记录](migration-handoff.md)保存工作区、剩余范围及未接入的私有草稿。28 文件覆盖覆盖层状态／消费者、简化模式、分支面板与主分支保护字段、必要生命周期和测试 fixture，以及冗余阴影面板包装器。三个子代理和 DeepSeek 已停止，没有自动开展下一批。

完整非增量类型检查通过；10 文件 60 项集成测试及另 1 文件 14 项 Preview codegen 测试通过。原 26 文件和补充 2 文件的 lint 均无错误，分别保留 7、2 条既有警告。生产构建、资源准备和归档通过。GP 5 项、复杂项目 6 项、两者保存重开及 7 项视口检查通过；GP 草稿弹窗及 Docs Codegen／Loader 各 50 个依赖模型校验通过，渲染／预览错误均为 0。所有检查及回放完成后源码身份保持一致。

Frame hash 和完整样式读取链的私有下一批尚未接入，不能计入已验收迁移。最近一次完整 Studio 运行仍是 F 的 636 文件通过、13 文件失败；原失败套件已分组修正定向复验，不等同最新源码全量通过。整项迁移未完成，性能对比暂停；恢复须等待用户新指令。

## 状态边界与更新合同

| 所有者／生命周期 | 状态及订阅边界 | 更新与释放要求 |
| --- | --- | --- |
| 编辑器实例 | Desktop 本地草稿状态 | 状态提示订阅稳定 status，弹窗只订阅 enabled/dialogOpen/drafts；项目 bundle、IPC 队列、定时器不进入 UI store |
| 浏览器 frame | 是否有弹窗打开 | 首个打开／最后一个关闭才通知；嵌套数量是内部资源计数，effect 清理平衡 |
| 编辑器实例／调用者 | AI 活动、光标与扫描区域 | 光标与区域按各自失效条件发布；非当前调用者更新不刷新当前光标；按区域保留引用 |
| 编辑器实例 | 选区、属性面板提交目标 | 即时画布选区与已提交 Inspector 选区分开；选择失效立即撤销写权限；仅最终选择提交昂贵计算 |
| 项目连接／玩家 | 多人协作身份、光标、选框与跟随 | 集合只订阅玩家 ID；行按 ID 与字段订阅；等值包不发布，保持未变玩家／子字段引用；跟随不订阅光标或选框 |
| 编辑器实例 | 选择／平移工具、撤销／重做可用性 | 工具按钮与菜单分离；命令历史不进入 UI store，可用性不变不发布；重复工具命令仍执行绘制与平移清理 |
| Docs 页面／组件／图标／示例 | 导航、代码、控件选择与示例输入 | 逐资源分配与订阅；文本更新不重复生成 Monaco 依赖；同时核对控件与代码输出后才判定无变化 |
| ViewCtx／画板 | 缩放、平移、拖拽、临时交互状态 | 与持久模型分离；高频坐标不传入项目 store；只订阅实际使用坐标或节点的组件 |
| 项目模型／事务 | 实体、字段、子树关系及变更记录 | 实体按现有 UUID／IID 规范化并按组件／业务域分层；完成的事务一次发布；未变实体与字段保持引用；不得每次编辑复制全项目 Map；撤销、重做、合并沿同一事务路径 |
| 异步请求／资源所有者 | 加载、错误、结果与缓存 | 由当前请求身份接受结果；取消和卸载释放订阅；不把 SWR／Loader 的数据复制到全局 store |
| Canvas iframe | 已提交模型视图与本地会话 | 使用该 iframe 的 React 接入原生 external-store 订阅，避免混用 React 实例；变更只失效相关画板／节点 |

组件必须使用显式 selector。返回多个字段的 selector 使用 `useShallow`，或在 store 更新时保持派生结果引用稳定；不能每次返回新数组／对象后依赖深比较。读取完整集合只用于真正展示整个集合的列表容器；行、节点及属性编辑器按 ID／字段读取。写入前判断实际变化，无变化返回原状态。不得使用全局 revision、复制整个 Site、监听全部变更后刷新所有画板，或把 MobX observer 改名包装成 Zustand。

模型的命令对象和持久格式仍保持现有 UUID、组件注册、属性／事件、序列化和保存合同。模型写事件用于记录事务、撤销和构建不可变快照；不能重造一套隐式读取跟踪引擎。Compiler 的输入必须是不可变快照或普通值，不能从稳定类实例中读取隐藏的可变字段并期待编译器自行失效。

外部 store 更新受 React `useSyncExternalStore` 合同约束。不能把 `setState` 放进 `startTransition` 就声称高频更新成为可中断工作；应先减少发布范围和必要计算。

同值动作必须保留领域语义，不能只比较一个输入字段就跳过命令。控件值未变但示例代码已被手动修改时，仍须修复代码；切换工具时仍须清理临时绘制和平移。仅在所有相关输出都未变时跳过发布，未变的 Map／数组和代码格式保持引用或文本稳定。

## 执行顺序

1. **Z0：范围与基线。** 核对全部直接／间接 MobX 引用，按模型、缓存、控制器、React、Canvas、测试和配置登记；保留 React 18、React 19 + MobX 的独立制品。记录既有选区／拖拽／属性编辑／保存／撤销测试和提交计数。
2. **Z1：独立状态域。** 草稿、弹窗、AI 活动等每个模块同时迁移生产读写、UI 订阅、生命周期和测试；模块内部不保留 MobX。实际写入和 selector 的无效更新检查先通过，再继续扩大。
3. **Z2：ViewCtx 与选区。** 迁移视口、拖拽与交互状态，接入属性面板选择快照；覆盖连续选择、暂停／恢复、跨画板和卸载；检查临时 reveal 不改业务属性、不进入保存／撤销。
4. **Z3：模型事务与缓存。** 替换 observable-model 的 MobX atom／私有管理对象，实现原生写事件与实体快照；先跑所有模型、序列化、撤销、合并测试。缓存按真正输入和所有者生命周期失效，删除 computedFn 和全局失效机制。
5. **Z4：Studio／Canvas 全链。** 更新全部 observer、reaction、autorun、when 及 iframe 订阅；保留原提交／重试／销毁语义，清除旧包装器和依赖。异步取数、注册变化、主题／语言必须经过实际消费者验证。
6. **Z5：Compiler 与生产回归。** 标准构建保持 Compiler 开启；验证实际参与转换的函数及 runtime 导入，执行现有 GP／复杂项目、Preview、发布 hydration、组件库、保存重开、API 变更测试和内存循环。
7. **Z6：完整清理与性能签收。** 生产、测试、manifest、锁文件、bundler／Vitest 别名中没有被替换路径；完成下表及主升级清单，才能称升级完成。

## 检查清单

- [ ] 范围扫描覆盖直接 import、require、re-export、自有 MobX 工具及私有 API；所有调用方具名关闭。
- [ ] 各 store 的所有者、初始化／销毁时机、订阅字段明确；不同编辑器／画板互不污染。
- [ ] 相同值写入保持状态和选中快照引用；无通知、无额外 React commit。
- [ ] 不相关字段更新不提交消费者；实体／列表只替换真实改变的项。
- [ ] 合并同一逻辑事务；高频拖拽不触发不相关面板计算或全模型快照。
- [ ] 并发相同请求／备份不重复序列化、计算或写盘；较新编辑和旧确认不丢失。
- [ ] StrictMode、Suspense、放弃渲染、切换所有者、异步乱序和卸载后的订阅／定时器正确释放。
- [ ] 选区、临时 reveal、业务输入、事件、撤销重做、远程合并、保存重开和导出合同不变。
- [ ] 模型写事件和不可变 UI 快照一致，无“需要额外点击或刷新才更新”。
- [ ] 生产 Compiler 转换通过；无稳定可变实例、Proxy 或 getter 穿透编译边界。
- [ ] 类型检查、针对性测试、完整生产构建及真实项目回归通过。
- [ ] 独立计量 React 19、Zustand、Compiler 的收益，包含提交次数、median／p95 交互耗时、主线程时间和内存；不把不同依赖／源码混在一个对照中。
- [ ] 20 轮切页／Preview／重开后订阅、计时器、store、模型及 iframe 的保留对象没有持续增长。

## 已执行证据

范围扫描工具 [state-inventory.mjs](state-inventory.mjs) 覆盖受 Git 管理及未忽略的未跟踪源码，解析 import／re-export／require，结果见 [state-inventory.json](state-inventory.json)。当前工作源码最近扫描还有 257 个旧状态依赖文件（209 个生产源码、47 个测试／测试工具、1 个工具配置），包括自有订阅／缓存工具的消费者；不能据几个模块完成而宣称已移除 MobX。命令：`node docs/upgrades/react-19/state-inventory.mjs --check`。

草稿模块已使用独立 vanilla store，UI 显式 selector；原控制器测试改用普通数据，不依赖 MobX 自动跟踪。2026-11-05 定向运行 4 文件 **35 项通过**，覆盖真实 Studio 保存失败、恢复、冲突及显式切远端。新增验证：连续 100 次编辑只发布首次 pending 变化、不提前序列化；相同版本三个并发 flush 只序列化／写盘一次；不相关弹窗字段不提交状态消费者；StrictMode、控制器切换和卸载释放订阅；不可变快照与多编辑器隔离；销毁取消定时备份且不再发布异步完成。

日志：`/tmp/plasmic-react19-20261105/u7-drafts-tests-3.log`。这些是模块级正确性和提交计数证据，**不是整个编辑器的性能提升结论**。另已迁移 frame 弹窗开关、AI 活动扫描／光标及 ListStack 高度分配；组件提取表单改为局部 React state。弹窗嵌套只发布布尔边界变化；活动区域保持未变项引用；ListSpace 按 ID 订阅，一轮分配原子发布，无变化跳过。

2026-11-05 联合运行 21 文件 **290 项通过**（`u7-zustand-combined-final.log`），包含模型保存恢复、AI 工具事务、画布覆盖层、列表导航及新过滤器 22 项。真实覆盖层证明无关页面操作不提交当前画板、不启动其 DOM 测量；列表 100 次等值重新分配不提交子列表。完整非增量 TypeScript 检查和迁移模块 ESLint 通过（`u7-zustand-typecheck-6.log`、`u7-zustand-lint-3.log`）。模型／核心画布迁移和正式性能采样仍须执行。生产构建及修正静态资源构建域名后的原生回放均已通过，制品证据见下文。

多人协作已迁移为项目连接独立 store，按玩家 ID 规范化并保持子字段引用，所有头像、光标、选框和跟随条接入显式 selector。6 文件 **20 项通过**（`u8-multiplayer-tests-final-3.log`），覆盖等值包 100 次零发布、30 次位置／选区更新头像零提交、光标／选框交叉更新零提交、跟随条只更新身份、200ms 连续跟随、取消连接释放、用户请求去重、连接换号及用户取数期间自身份变化。非增量类型检查和定向 ESLint 通过（`u8-multiplayer-typecheck-final.log`、`u8-multiplayer-lint-final.log`）。跟随导航退出交互模式的已有断言也已修复并通过，未弱化测试。

2026-11-06，Docs Portal 的导航、组件代码／控件、图标代码／控件和独立示例按各自所有者拆分为原生 store。逐资源惰性分配，不为一次输入复制项目全部组件；同值不发布，控件只订阅自身参数，代码输入不提交列表／选择消费者。Monaco 的文本同步与模型依赖代码生成分开，30 次文本更新不重复生成模块；项目模型实际变化仍重新生成。示例格式化移到提交后的 effect，取消与输入校验防止 StrictMode、切换或卸载后的陈旧结果覆盖。新增 false／0／空字符串在 Loader、Codegen 两种输出中的 AST 及原子状态断言。

本批 7 文件 **52 项通过**：`u9-docs-tests-final.log`；完整非增量类型检查退出 0：`u9-docs-typecheck-5.log`。定向 ESLint 退出 0（仍列 9 条警告，`u9-docs-lint-2.log`）。测试包含 Monaco 模型／类型库释放、示例隔离、原生订阅合并、既有完整模块生成及转译测试；实际生产 Docs 编辑／worker 和整页回归已按下文通过。模型读取暂由原有 MobX 层负责，不能将 Docs 控制器迁移等同于项目模型迁移完成。

### 已验证的生产制品

- Compiler 关闭的多人协作批次：`/tmp/plasmic-react19-20261105/renderer-react19-zustand-multiplayer`。源码 `cb44ec91fa9aa965fc3d506b5fc98215a02e383f02c38f4b9d358f4ed893d73e`，renderer `1a7efa83be3c16e86c0996f01f5518adf7483580c75e3cfd67c55e118b3c3973`。GP 5 项与复杂画布 8 项、保存重开、业务分页通过；GP 另通过 5 项引导和缩略图回放。原生日志 `u8-zustand-native-gp.log`、`u8-zustand-native-complex.log`，错误数组均为空。
- 同源码 Compiler 白名单开启制品：`renderer-react19-zustand-compiler`，renderer `b1244e73ccaa1cd562dab128ef8faca356835f224ac8943629547e48ab6673e2`。实际转换 CodeDisplayContent；[受控 CodeDisplay 采样](performance-code-display.md)验证输入改变／恢复正确，并测得同输入重复更新跳过高亮。该局部合成测量不能代表整个编辑器性能；该批制品采用当时的关闭默认值，当前源码已改为默认开启。
- 以上两份制品不包含本批 Docs Portal 变更；后续源码必须重新构建与回归。

## 隔离运行的构建参数

生产回放使用与 Desktop 资源处理器一致的域名，不能直接使用上游默认站点域名：

```sh
PLASMIC_SELF_HOSTED=1 PUBLIC_URL=https://plasmic-studio.shiguanglab.com STATIC_URL=https://plasmic-studio.shiguanglab.com node scripts/build-studio.mjs
node desktop/scripts/prepare-assets.mjs --from platform/wab/build
```

构建到资源准备完成期间冻结源码，立即归档 renderer、源码补丁和未跟踪源码，再继续修改。回放只使用归档制品和隔离项目 fixture，记录源码／renderer／Desktop hash。以上不是正式包安装或发布步骤。

## 官方依据

- [Zustand：useShallow 与 selector](https://zustand.docs.pmnd.rs/learn/guides/prevent-rerenders-with-use-shallow.html)
- [Zustand：不可变更新与合并](https://pmndrs.github.io/zustand/learn/guides/immutable-state-and-merging)
- [React：useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore)
- [React Compiler：不兼容库与 MobX](https://react.dev/reference/eslint-plugin-react-hooks/lints/incompatible-library#mobx)

## Docs 与工具栏生产验收（2026-11-06）

制品 `/tmp/plasmic-react19-20261105/renderer-react19-zustand-docs-tools`：源码 `9ddd7669f54bbffbbafb2b9c6ea27a42fe1a396719e01c3ca6c77a9bb8ff1ec0`，renderer `b49bbc8d2d267d0dd9aa9812f2db67cafcb63518c7c985e937678d38cee1cf61`，Compiler 关闭。生产构建与资源准备退出 0（`u10-docs-tools-studio-build.log`、`u10-docs-tools-assets.log`）。

- GP 原生回放：Monaco 通过实际 executeEdits 写入选中组件的独立 store，Docs iframe 显示修改；原生 TypeScript worker 校验活动脚本及 50 个依赖模型；恢复代码并返回画布后，业务 Preview 分页及保存重开通过。报告错误数组为空（`u10-docs-tools-native-gp-1.log`；fixture 报告 `list-open-react19-zustand-docs-tools-gp.json`）。
- 复杂十画板：8 项切换、重命名／样式／位置撤销重做、冷画板重建与选区行为、保存重开通过，错误数组为空（`u10-docs-tools-native-complex.log`）。
- 实际运行发现并修正了 Docs 项目入口未解析项目 ID，以及 Monaco 依赖 URI 保留 `/./` 导致 worker 查找源文件失败两处问题。路由解析不改变原有画布地址解析合同；依赖模型 URI 以 URL 标准化后注册。
- 选择／平移工具使用每个编辑器独立的原生 primitive store，按钮组件独立订阅。100 次同工具命令只发布首次状态变化，但仍执行临时绘制与平移清理；切换工具不重算菜单轨。与 Docs／路由联合 11 文件 105 项通过（`u10-docs-tools-combined.log`）；工具与入口的 ESLint 无警告／错误（`u10-canvas-tools-lint-final.log`）。完整非增量类型检查通过（`u10-canvas-tools-typecheck-1.log`）；其后标准化 URI 的定向 2 项通过（`u10-docs-worker-tests-1.log`）。

上述制品尚不包含后续撤销历史迁移。正式整体性能采样、核心模型／画布迁移和全部依赖清理仍未完成。

## 撤销历史的订阅边界（实施中）

`UndoLog` 已移除 MobX，保留自身有界命令历史；UI store 只持有不可变的 `canUndo`／`canRedo`，不会复制模型引用或变更记录。完成记录、合并或恢复后才发布可用性；相同可用性保持快照引用，失败恢复不暴露临时游标。工具栏的历史按钮独立订阅，项目权限仍由现有项目层管理。

5 文件 126 项通过（`u11-history-integration-tests.log`），覆盖历史上限、分支编辑、连续撤销重做、选择快照、AI 操作、样式变更、失败回滚；实际按钮测试中 20 次可用性不变的编辑无额外 React commit，权限变化仍禁用按钮。非增量 TypeScript 与定向 ESLint 退出 0（`u11-history-typecheck-1.log`、`u11-history-lint-2.log`）。

生产构建及资源准备退出 0；制品 `renderer-react19-zustand-history`，源码 `f048d799a705426ebddbbb04d66b5e0b0639e0a4a9da8fa94271af657897f77b`，renderer `33b8bdfd52cadecab69f686ae9be8e36a8f9f390674e76b328b5bfa7693da082`。GP 5 项及复杂画布 8 项、保存重开通过；GP 原生 Docs 同时确认 Codegen／Loader 实际模式、编辑／预览／恢复，并分别通过 50 个依赖模型的 worker 校验。两份报告错误数组为空（`u11-history-native-gp.log`、`u11-history-native-complex.log`）。该制品不包含后续跟随选择迁移。

## 跟随选择（实施中）

跟随玩家 ID 使用独立 primitive store，与多人数据包分离；FollowingPlayer 已去掉 MobX，显式订阅选择及该玩家的名字／颜色。Socket 对跟随选择使用原生订阅；相同选择不重建监听，切换／取消会清理旧玩家的 200ms 任务，连续移动保持原来的有界更新节奏。4 文件 15 项通过（`u12-follow-tests-2.log`），含 100 次相同选择、跨编辑器隔离、无关光标更新、切换与关闭连接；后续联合回归及生产制品待验证。

本批联合回归 32 文件 336 项通过（`u12-state-combined.log`）；随后新增的 Docs 回归捕获了“等值控件跳过手动代码修复”的问题。已改为同时比较代码和控件输出，保留等价 AST 的原有格式、复用未变 Map、不发起多余格式化；多选数组由 store 复制持有。新增两模式共 4 项修复／删除手动参数断言，以及数组所有权测试。核心模型缓存、视口与最终 MobX 清理仍在范围内。

### 本批验证结果

修正后 Docs／Preview 7 文件 57 项通过（`u12-docs-preview-final.log`）；完整非增量类型检查、跟随及 Docs 的定向 lint 均退出 0，无警告（`u12-state-typecheck-exact.log`、`u12-follow-lint-final.log`、`u12-docs-lint-final.log`）。等值控件相关 4 个失败断言保留在修复前日志，未放宽断言。

生产构建及资源准备通过。最新制品 `renderer-react19-zustand-state-u12`：源码 `1688672a8ed749c8f9122ad0ef04fabb087415725b19c4e52d2fbf24e65d6d5c`，renderer `ebb8ff3a8fd218fd4c8ae6e56f90e6bfac12687c428249d5fbec8310f6c5aa3e`，Compiler 关闭。GP 5 项、复杂画布 8 项及两者保存重开通过，错误数组均为空；GP 另验证了 Codegen／Loader 的原生编辑、预览、恢复和各 50 个依赖模型的 TypeScript worker。日志 `u12-state-native-gp.log`、`u12-state-native-complex.log`，脱敏摘要见 [state-verification-u12.json](state-verification-u12.json)。

以上不代表整个升级完成。项目模型、视口、Inspector 与 Canvas 的显式订阅迁移、剩余依赖清理、完整消费方回归及整体性能／内存验收仍待完成；后续交付默认启用 Compiler，编译范围随模块迁移扩大；尚未迁移的隐式可变读取不能纳入安全编译范围。


## 默认开启 Compiler 与新增原生状态边界（U17）

标准 Rsbuild／Vitest 管线始终启用 Compiler，移除了依赖环境变量的开启开关。该批实际转换 4 个函数：CodeDisplayContent、DesktopDraftDialog、FollowingPlayer、SettingsPageContent。仍依赖隐式模型读取的其余组件尚未迁完，不将其记为已编译。设置页的账户显示值通过普通 props 进入编译组件；控制器仅提供稳定的 store 入口和事件命令，渲染值由原生 selector 提供。

Desktop 草稿控制器的所有权也已使用原生 store，异步初始化、更换控制器、停用与销毁不再依赖 MobX observable.ref。提示条、弹窗及横幅均显式订阅该所有权；切换后释放旧控制器订阅。账户令牌缓存移除 MobX，保留原创建／撤销／发放 API，成功后才失效缓存，等值列表保留快照引用；输入数组和日期由缓存持有副本。

字体状态使用每个编辑器独立的 store。字体选项、宿主／本地可用性和缺失提示保持各自引用，UI 只订阅所需字段；可用性变化不提交字体选项消费者。项目字体列表从已完成的编辑事务、撤销／重做、远程合并及项目数据替换显式同步，按变更字段筛选，不引入全局 revision 或隐式读取跟踪。销毁释放宿主监听并阻止异步探测结果发布。

本批联合回归 **21 文件、165 项通过**（u17-native-state-integration-final.log）；完整非增量 TypeScript 退出 0（u17-state-typecheck-final-2.log）。定向 ESLint 退出 0，保留 3 条既有警告（u17-native-state-lint-3.log）。草稿 API 测试覆盖复制、导出依赖、确认丢弃前恢复远端、恢复失败不丢弃、失败重试及原生所有权切换。JSDOM 在真实 Antd 弹窗测量时输出不支持伪元素 computedStyle 的环境诊断，未屏蔽；原生生产回归另行验收。

完整替换仍未完成：范围扫描保留 420 个旧状态依赖文件；项目模型、Viewport、Inspector 与 Canvas 缓存依然需要迁移。性能对比保持暂停。本批生产构建和原生项目回放的制品证据随后单列。


## 评论数据与显式订阅（U18）

评论模块删除 MobX box、autorun、computedFn 和 toJS。每个编辑器持有独立的数据、筛选、弹窗及请求 store；评论按 ID、画布标记按组件／变体组合、统计按节点／组件／变体键、作者与表情按实际使用项订阅。等值响应保留实体及集合引用，修改一条评论不提交另一行或其他变体画板；后台等值刷新不提交未显示加载状态的评论面板。交互标记和输入草稿属于命令层，不修改 UI 快照。

现有模型事务显式同步评论标签、所有权、变体删除与恢复；CSS 颜色编辑不发布评论状态，变体 selector 编辑会更新对应统计键。已删除组件不继续显示为有效位置，撤销恢复位置。模型对象暂只供未完成迁移的模型消费者与命令使用；已编译的 RootComment 读取捕获的 ownerComponentName 等普通值，不从稳定模型实例读取名字。CommentsDialogs 订阅原生弹窗快照。Compiler 默认开启，实际转换范围扩大到 6 个函数，不增加关闭指令。

评论相关联合测试 **11 文件、60 项通过**（u18-comments-integration-final.log），覆盖真实提交／撤销／重做、评论全部写 API 的标识与入参、乐观失败后的重新取数、分支请求乱序、销毁、StrictMode 和所有者替换。非增量 TypeScript 退出 0（u18-comments-typecheck-final.log）。完整 Studio 的上一份冻结源码回归 **554 文件、4577 项通过、4 项既有跳过**（u18-studio-full-suite.log）；该次完整回归发生在评论迁移之前，不作为评论迁移后的全量通过证据。新制品与全量回归另记。

当前范围扫描为 416 个旧状态依赖文件（353 源码、62 测试、1 工具）。模型、Viewport、Inspector 与 Canvas 的完整替换继续执行，性能比较暂停。

## 模型字段快照与 Viewport（U19）

每个 Studio 的 `ModelSnapshots` 按需为实体字段创建原生 store。模型引用归一为不可变身份引用，数组和字典由快照持有；相同最终值不发布，未变条目保留引用。完成事务修复后只处理已订阅的脏字段，先安装整批快照，再通知首个订阅者。命令、序列化与撤销继续使用真实模型身份。项目数据替换释放旧所有者，失败事务不发布中间值。Inspector 名称控件直接订阅字段快照，纳入默认开启的 Compiler；其余模型读取迁移仍未完成。

Viewport 移除 MobX box、computed 和 reaction，几何值使用独立原生 store，变换命令发布完整快照。缩放、滚动、变换中状态与几何消费者分别订阅所需字段；所有权切换清理旧订阅，销毁取消计时器。画板成员变化从完成的模型事务及撤销／重做显式同步。Studio 先更新当前画布，再发布新视口，避免订阅者读到不同导航阶段。覆盖层、拖拽标记、缩放输入、多人光标、可见性队列和多人视口发送已接入显式订阅。

模型／Inspector 联合回归 8 文件、54 项通过；完整类型检查、Compiler 10 项和生产构建通过。归档制品的 GP 5 项、复杂画布 8 项、保存重开、真实缩放控件与无操作引用检查通过，GP 草稿弹窗及 Docs 两种模式通过。完整 Studio 回归与独立 QueryBuilder 依赖同步重叠，552 文件通过、7 文件失败，保留准确失败记录，修复后在 U20 统一重跑；不将该次结果作为冻结源码全量通过证据。[制品验收](state-verification-u19.json)记录独立归档身份。性能对比继续暂停。

### U17 已完成的生产验收

Compiler 开启制品 renderer-react19-zustand-compiler-u17：source ea994430549bda7d17a9c9912756e4ef38df28d8441959a1d6170bd894528350，renderer 97c8153b3d108425ce2ab0b5255bd483d71d2c9df3c4d50fbbc90b0249b90a36。GP 5 项、复杂画布 8 项、两者保存重开，以及 Docs Codegen／Loader 各 50 个依赖模型的 worker 校验通过。实际 IPC 草稿弹窗打开／远端操作关闭、恢复及冲突回放通过，错误数组为空。该制品不包含后续完整测试修正与 U18 评论迁移；[脱敏结果](state-verification-u17.json)保存其准确身份。

## Inspector、Canvas 与 Preview 原生状态（U20）

Inspector 选择拥有按需评价、环境与 DOM 读取资源；完成模型事务、画布更新和指定 context 数据变更显式同步，暂停选择与提交写权限分开。Canvas 使用按实例 Session（稳定发布的浅只读运行时视图，UI 当前仅订阅开关布尔值）、声明式字段胶囊和完成事务后的两阶段发布，保留原 children/type；评价根、render status 和按实例 context 数据改用原生存储。Preview 路由、历史、目标列表及 codegen 失效改为所有者存储和显式模型事件，应用用户与 live mode 消费方订阅原生字段。命令句柄及组件约定的 opaque ccContextData 保留运行时身份，Inspector 负责其余 UI 数据投影；真实已连接 Form 经 context、Inspector 到注册 metadata 的身份及操作回归通过。

本批完整非增量类型检查、Compiler 11 项、根集成 UI 18 项、引导 8 项、生产构建及归档身份校验通过。真实制品 GP 5 项、复杂画布 8 项、保存重开、缩放、Docs 双模式各 50 个依赖模型、草稿弹窗／恢复／冲突通过，渲染与预览错误均为 0。完整 Studio 初跑 561 文件通过、5 文件因旧 mock 合同失败；5 文件修复后窄回归 41 项通过，不将初跑标为全量通过，下一集成批次统一重跑。[脱敏证据](state-verification-u20.json)记录精确结果。当前扫描 400 个旧状态依赖文件（343 源码、56 测试、1 工具），比 416 净减少 16 个；文件内部分迁移不算整个文件完成。Canvas 的 computed/cache Reaction、即时 selection、Docs 模型读取及大量模型消费者仍未迁移，性能比较继续暂停。
