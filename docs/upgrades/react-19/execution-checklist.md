# React 19 升级执行清单

状态：实施中，证据见 [实施记录](implementation-report.md)；2026-11-05 完整性复核后扩充。主方案见 [README](README.md)，范围见 [S01–S10 覆盖矩阵](coverage-matrix.md)，验证要求见 [检查清单](verification-checklist.md)。

仅在实际执行并附证据后勾选；任务编号跨文档保持稳定。失败时记录原因和下一步，不删除失败记录或把未执行写成通过。

## 执行记录

| 字段                                        | 实施时填写                  |
| ------------------------------------------- | --------------------------- |
| 执行人／审阅人                              | 待填写                      |
| 分支／工作区                                | 待填写，默认分支前缀 codex/ |
| A0 源码 commit + 工作区摘要 + artifact hash | 待填写                      |
| A1 / B / C 源码与制品身份                   | 待填写                      |
| 最终 React / DOM / types / Zustand 版本    | 待填写                      |
| Compiler / runtime / lint 精确版本          | 待填写；不启用也明确记录    |
| 支持的消费者／Host／发布平台                | 待填写                      |
| 日志／脱敏报告／私有原始证据目录            | 待填写                      |

## U0：冻结范围、输入和基线

- [x] **U0.1** 读取适用 CLAUDE.md；重新检查 git status、HEAD 与相关 diff。保留已有修改，不自动 stash、commit、reset；根据被选定的完整源码准备独立实现工作区。
- [ ] **U0.2** 确定 A0 源码与制品身份。重新核对动画、Markdown、Fiber 等代码变更是否已合入或仍在并行进行，保证所有对照组采用相同非 React 改动。
- [ ] **U0.3** 列出根、platform、sub、live-frame、react-web-bundle、Playwright／loader 测试根及 Desktop 的安装边界和锁文件；记录实际 Node、pnpm、npm、Electron 与构建配置。
- [ ] **U0.4** 核对计划版本；固定 React/DOM 19.3.1 或复核后选定的同一补丁版本、types 精确版本、Zustand 精确版本和补丁列表。记录 registry 输出，不用 latest 作为可复现配置。
- [ ] **U0.5** 定义公开 SDK、codegen、内置／外部 Host、发布页面的目标版本合同。默认 React 19 单一新基线；若消费者仍需 18，先修订方案和验收矩阵，不静默改 peer。
- [ ] **U0.6** 建立旧组件和依赖处置表：包、版本、peer、注册名、模型引用、执行入口、补丁、替代方案、消费者、验证结果。核实实际设计是否引用 antd v4/v5，不按包存在推断使用。
- [ ] **U0.7** 准备 GP、复杂十画板、重复实例／Slot、旧组件、富文本、发布 hydration 等隔离 fixture；确认编辑／保存只落入隔离服务，记录项目修订与依赖摘要。
- [ ] **U0.8** 运行现状定向测试与生产构建，记录既有失败及 A0 性能。基线错误须具名，不能在后续过滤浏览器错误或吞掉新增失败。
- [ ] **U0.9** 固定主方案性能门槛和采样顺序；记录基线波动、平台覆盖及执行者具名职责。
- [ ] **U0.10** 运行 inventory.mjs --check，逐条处置全部相关 manifest 与 S01–S10 消费链；覆盖独立 Preview／react-renderer／host-test、全部维护 SDK、59 个公开组件发布项、CPA 11 套生成输出、全部相关示例和 fixture。范围差异先评审再刷新快照，未决项阻断完成。
- [ ] **U0.11** 审核所有安装根的实际直接／传递 React peer、react-is、外部 store、catalog／override／patch、公开类型与可执行入口；列出每项最终精确版本、调用方、升级／验证／完整退役决定。补查 package exports 导致未解析的 react-aria，不把解析失败当成无依赖。
- [ ] **U0.12** 确定 Next 的联动目标并完整退役 Gatsby及 Node engines／CI 镜像；记录 platform/preview、适配包、CPA 源与输出、示例和测试矩阵各自的最终框架版本。对目标 19 的发布不再默认调用旧 Next 12/13/14 或 React 17/18 fixture。

退出证据：版本表、消费者矩阵、依赖处置表、A0 制品、基线报告、隔离数据摘要。缺任一关键输入不进入切换阶段。

## U1：在 React 18 上完成必要 API 迁移

- [ ] **U1.1** 迁移 Shell 主根与 Host frame 根，保持每个容器唯一 root；HMR／重入复用或正确销毁，避免重复 createRoot。
- [ ] **U1.2** 迁移 ContextMenu、quick-modals、Docs preview 临时根，使用 root.unmount 并清理 DOM、事件、焦点和未完成 Promise。
- [ ] **U1.3** 统一 ComponentActionsSection、CustomPropEditor 等受控宿主路径的 ReactDOMClient 使用；目标合同明确后删除失效旧分支，不新增兜底 shim。
- [ ] **U1.4** 替换 findDOMNode。核查 view-common 调用方、EllipseControl、颜色／关键帧控件的真实 DOM ref 类型、生命周期和定位。
- [ ] **U1.5** 审查挂载后立即读取 DOM、依赖同步 setState、旧 render 回调和卸载返回布尔值的假设。优先用 commit/layout effect 或明确完成协议；仅对有证据的同步要求使用 flushSync。
- [ ] **U1.6** 增补根迁移的必要行为测试，运行检查清单的定向命令和真实菜单／弹窗／选择交互；不得只做快照替换。
- [ ] **U1.7** 保存 React 18 的准备制品；记录 A0/A1 差异。U2 若继续改变准备制品，更新 A1 身份并重测受影响指标。
- [ ] **U1.8** 将旧 root／ref 搜索扩展到工具、示例、fixture 和生成源；具名迁移 dashboard-preview-probe/fidelity.tsx、CRA template/split 的入口与回调完成协议。替换构建工具时保留原测试行为覆盖。

退出条件：相关功能在 18 上正确，根／ref／清理检查通过，无新增泄漏；尚未声称通过 React 19。

## U2：依赖生态、旧组件与类型准备

- [ ] **U2.1** 按 [Zustand 迁移方案](zustand-migration.md) Z0–Z6 替换全部 MobX 状态、订阅、缓存和 Canvas 接入，执行其性能检查清单；删除旧依赖与测试 alias。
- [ ] **U2.2** 为 react-beautiful-dnd 建立实际替换方案，核对虚拟列表、键盘、跨容器、拖拽取消和自动滚动 API；更新类型、样式和调用方并移除旧依赖。不能只改包名或 peer。
- [ ] **U2.3** 对 react-spring、react-joyride、旧 antd、react-aria、富文本、prepass 及其传递依赖逐项选择精确候选，验证实际运行路径与补丁。标明只能在 U3 完成的部分。
- [ ] **U2.4** 旧组件无有效引用时，完整移除依赖、注册／导出、构建入口、目录配置及失效测试。存在引用时提供保持模型身份与语义的迁移及重开验证；不能直接全局替换 antd 版本。
- [ ] **U2.5** 搜索旧 React API、element.ref、字符串 ref、Legacy Context、函数 defaultProps／propTypes、react-dom/test-utils；区分 class defaultProps 和注册元数据，不机械删除。
- [ ] **U2.6** 列出 19 类型修复点：React.JSX、useRef 初值、ref callback 返回值、ReactElement props 默认 unknown、Context／子节点类型、act 环境；涉及 codegen 时同时修模板并运行生成代码。
- [ ] **U2.7** 审查 SDK peer 和外部 Host 合同；按 U0 决策更新包版本、示例和使用文档，不保留未经验证的支持声明。
- [ ] **U2.8** 更新 A1 的变更记录与必要回归。所有未决依赖有具名负责人／处置，未通过不进入可发布状态。
- [ ] **U2.9** 配套升级 GraphiQL／@graphiql/react／plugin-explorer、Refine、TinyMCE、react-monaco-editor、react-inspector、react-use、auto-sizer、framer-motion 等已发现的 peer 缺口；每组实际 API 与交互验收，不能合并为“其它依赖后续处理”。
- [ ] **U2.10** 单独核查 react-web 的 Valtio／proxy-compare／use-sync-external-store，验证代理 snapshot、派生状态、输入重置和 SSR；宽 peer 的版本先验证，不默认迁移 Valtio 大版本或把它与 MobX 合并。
- [ ] **U2.11** 完成所有组件包／vendor UI／plasmicpkgs-dev 的依赖处置；覆盖 React Aria/Stately、Antd rc-*、Tiptap/Slate、Radix、图表／支付／AI SDK／邮件／高亮／元素展平工具。Chakra 集成按用户确认完整退役，核对其源码、注册、依赖与构建产物均已移除。升级有补丁的家族时重审补丁归属，不遗失现有功能修复。
- [ ] **U2.12** 升级 Next 14/13/12 路线并改造 adapter 的实际 API；按用户确认完整退役 Gatsby 与 deprecated nextjs-app-router 并清理调用方，不隐式新增双实现。
- [ ] **U2.13** 审核 React 19 ref prop、Context／元素符号、Fragment 和 useId 行为，更新 canComponentTakeRef 及注册模型的判断方案；函数接收 ref 不等于实现实际转发 DOM，不能直接把所有函数判为可定位。
- [ ] **U2.14** 同步必要的工具链、types／API 快照、tsconfig／JSX／Babel／SWC、Storybook 和 Hooks lint 配置；保留无关工具版本，既有 skipLibCheck 之外用真实 consumer 编译验证公开 d.ts。

退出证据：依赖处置表每行有结果；19 类型修复有文件范围；React 18 可运行的准备项已验证。只验证元数据的依赖不得标记“运行兼容”。

## U3：切换 React 19 运行链

- [ ] **U3.1** 同步所有控制范围的 React、ReactDOM、19 类型声明、catalog、override 和独立锁文件；检查间接引用 SDK 是否使用本次本地／新版本制品。
- [ ] **U3.2** 安装并核查实际解析版本，清楚区分各安装根；保留安装日志。不得用 --force、伪造 peer、忽略不兼容警告或 skipLibCheck 来宣称修复。
- [ ] **U3.3** 核对 Studio、sub、react-web-bundle、live-frame、组件包、SDK、SSR 和 codegen 的 JSX 转换与产物。React.createElement 仍合法，不为升级强行重写动态渲染器。
- [ ] **U3.4** 同一 renderer 验证 React／DOM／JSX runtime 归属；检查 __Sub、Loader builtinModules、external/global 映射和别名。不同 window 独立运行，不共享整个 React 状态。
- [ ] **U3.5** 核对目标 React Fiber 结构及遍历分支，验证 Suspense／隐藏／恢复／卸载、alternate、DOM→Fiber→Val 及重复实例身份。不得仅扩大类型 union 或吞异常。
- [ ] **U3.6** 调整 dispatcher／prepass 对目标 19 的读取和执行；按支持矩阵清理失效的 <=18 分支，验证并发请求、数据预取与 Context 隔离。
- [ ] **U3.7** 验证自定义 Reaction 的创建、commit、放弃渲染、延迟恢复、StrictMode 清理和 ViewCtx.dispose；React 内部 GC 优化不能替代这些检查。
- [ ] **U3.8** 修复 19 类型和测试 API，保持断言强度；渲染错误接入 onCaughtError／onUncaughtError／onRecoverableError 或现有等价流程，验证不漏报、不重复归档。
- [ ] **U3.9** 运行定向测试、完整 typecheck、SDK／画布／Preview／hydration／Studio 生产构建；保存 B 制品。Compiler 保持开启并验证实际编译产物；Activity、PPR 和新性能实验暂不开展。
- [ ] **U3.10** 升级独立 platform/preview 的 Next／loader-nextjs／React／类型与配置，验证异步请求 API、params/searchParams、缓存、路由、预览鉴权与 react-server 条件导出；不把 live-frame 已构建算作该服务通过。
- [ ] **U3.11** 升级 platform/react-renderer 的独立声明、锁文件和旧 loader SDK，完成其原生构建／隔离渲染／prepass／SSR 到 hydration 的闭环；不得用 start-prod 或关闭隔离机制来替代测试。
- [ ] **U3.12** 对 10 个直接相关 SDK 及发布依赖闭包逐包处理 peer／类型／导出；补建 react-web-runtime 并验证自定义 JSX shim、ref/key/children、JS/TS codegen，认证和数据状态路径覆盖 CJS/ESM/server/edge 消费者。
- [ ] **U3.13** 更新 CPA 生成策略后重新生成其 11 套跟踪输出，examples 按用户确认完整退役并清理调用方，验证全部框架 fixture；改 loader-tests/env.ts、nextjs-setup 默认值及强制安装版本，避免 runner 运行时重新降级。Quill 等五组可选集成按用户确认完整退役；保留并迁移 auth／数据源／表单夹具，专属测试同步删除。
- [ ] **U3.14** 同步 CI 路径过滤、构建／发布闭包、cache key／hash 输入、Docker／Node engines、独立锁与资源拷贝，运行诊断工具与邮件 SSR 入口；保存覆盖全部服务及消费者的 B 产物清单。

退出条件：所有基础产物可复现，I01–I12 通过；Q01–Q26 尚需 U4 的真实场景证据。准备清单不能替代独立服务和框架消费者的构建。

## U4：完整功能回归

- [ ] **U4.1** 执行 Q01–Q09：路由、临时根、属性、Slot／重复实例、选择、变体、撤销重做、保存重开。
- [ ] **U4.2** 执行 Q10–Q13：旧库／注册契约、组件状态／事件、Preview／Docs、冷画板恢复与后台 MCP。
- [ ] **U4.3** 执行 Q14–Q18：SDK／codegen、SSR／hydration、错误上报、Desktop、共享 Scrollbar 与语言主题。
- [ ] **U4.4** 使用实际 B 制品执行相关 Playwright、Desktop 和发布 hydration 测试。对只覆盖某个平台或某个 fixture 的结果注明边界。
- [ ] **U4.5** 对预期生成差异逐项检查 props、slots、事件、CSS 和执行行为，再决定更新快照；不得整体接受快照后跳过语义检查。
- [ ] **U4.6** 汇总所有失败／跳过／未覆盖项。功能性阻塞修复后只复跑受影响集；发布前完成检查清单要求的完整回归。
- [ ] **U4.7** 执行 Q19–Q26：独立 Preview／渲染服务、框架与自定义 Host、JSX／ref 注册、全组件家族、CPA／示例、Valtio／认证／数据、邮件和 HTML 资源行为。
- [ ] **U4.8** 按全部维护的 Pages/App、React/TanStack、loader/codegen、JS/TS 和 Node/edge 组合测试本次本地／私有 registry 包；公开 latest、旧远程 SDK 或沿用旧产物的成功不能证明新包通过。
- [ ] **U4.9** 审核完整范围快照、CI 实际触发与测试覆盖，确认无被旧版本矩阵／skip／路径过滤排除的失败组件，I12 的逐包处置有可追溯结果。

退出条件：全部必需功能检查有制品身份与证据；不能用类型检查替代真实编辑／保存／运行验证。

## U5：性能与生命周期

- [ ] **U5.1** 按主方案冻结 A1/B，列清依赖和构建差异；重新核对源码与制品 manifest。
- [ ] **U5.2** 分别执行 GP、十画板、属性选择／修改、首个 AI 消息／代码面板、Preview、发布 hydration 的交替顺序计时。
- [ ] **U5.3** 分轮采集 CPU trace、长任务、React 更新和布局／样式成本。时间段嵌套不相加，采样 self/inclusive 不混用。
- [ ] **U5.4** 20 轮切页／Preview／编辑重开后检查 GC 工作集、旧 ViewCtx／Reaction／Fiber 保留路径以及 renderer／主进程 RSS 和峰值。
- [ ] **U5.5** 比较压缩后资源体积、重复运行时、组件包执行、首次功能使用和构建时长。缓存命中不等于免执行。
- [ ] **U5.6** 按门槛给出通过／失败；写明基础升级是否仅无退化。所有超门槛问题复现定位后再推进，不事后改变标准。

## U6：发布准备与回滚

- [ ] **U6.1** 确认 SDK／Host 最低版本、公开包语义版本及消费者升级顺序，核查 web 与 Desktop 使用同一目标制品集合。
- [ ] **U6.2** 锁文件冻结安装和从源码重建通过；验证 hydration-build.json、renderer／Desktop manifest、拷贝制品 hash 与输入一致。
- [ ] **U6.3** 完成 P01–P10 发布检查；保存完整旧制品和精确依赖，实际执行一次隔离回滚演练。
- [ ] **U6.4** 合并／发布描述只报告实际变化、测试与限制；交付前完成 Compiler 验收并保持开启，其它新 API 必须分别验收。
- [ ] **U6.5** 依据已有授权与发布流程执行实际发布；未发布时明确写“发布准备完成”，不勾选发布完成。
- [ ] **U6.6** 发布后按隔离／授权场景观察错误、首画布、输入、内存与 hydration；触发门槛即恢复完整旧制品并记录结果。
- [ ] **U6.7** 发布和回滚顺序显式覆盖 SDK／组件包、Next Preview、react-renderer、Host、Web 与 Desktop；演练旧服务器／客户端资源交接，避免缓存继续返回内嵌旧 React／JSX runtime 的模块。只恢复主应用不算完整回滚。

## C0–C3：Compiler 必需验收

- [ ] **C0.1** 选择有重复更新成本的纯展示热点，写出当前 render 次数／耗时、输入合同和目标指标。首批不含 MobX 读取、画布内核、SDK／codegen 产物。
- [ ] **C0.2** 明确未编译 observer 容器与编译叶子的边界；确认没有 observable Proxy、类实例、动态 getter／方法或可变数组泄漏为“纯输入”。
- [ ] **C0.3** 固定白名单与被排除的组件／Hook／包装器，检查嵌套函数、render callback 和间接读取；lint 通过不能替代审查。
- [ ] **C1.1** 在独立改动接入锁定版本的 Compiler 与 Hooks lint；使用明确 include 和 annotation 模式。React 18 实验配置 target 18；19 配置 target 19。
- [ ] **C1.2** 保存输出检查：哪些函数实际转换、跳过原因、runtime 导入、chunk 归属、React 实例。不要把编译配置文件存在当作已生效。
- [ ] **C1.3** 验证单测／集成测试使用生产等价 Compiler 转换；至少一个生产构建的真实交互验证。记录测试配置差异。
- [ ] **C1.4** 若扩大到 Host／Loader／SDK，先新增对应 runtime 模块解析与发布合同设计并修订本方案；首批试点不执行该扩展。
- [ ] **C2.1** 执行 M01–M10 正确性检查，特别测试同引用内部变更、动态依赖切换、快速选择与丢弃渲染。
- [ ] **C2.2** 按 B/C 进行同条件性能对照，必要时增加相同 Babel 管线控制组；记录首次渲染、更新、首用、包体、构建和内存成本。
- [ ] **C3.1** 完成正确性、兼容性和生命周期验收；失败时修正状态订阅和输入合同，不以关闭 Compiler 作为交付方案。性能对比按当前用户要求暂停。
- [ ] **C3.2** 每次扩展白名单重新执行 C0–C2；不因一个叶子通过而扩展到整个属性面板或 Canvas。

## O1–O4：后续优化候选

- [ ] **O1** 资源预加载／稳定脚本制品：先定位发现瀑布、parse/compile/执行占比，保留精确版本、顺序和每 Document 注册语义。
- [ ] **O2** useEffectEvent：只处理已确认的无关依赖导致订阅重建，保留真正响应式依赖和清理。
- [ ] **O3** Activity：只评估局部面板；明确隐藏后的 Effects、外部 Reaction、状态保留、内存及恢复行为，不保留整个编辑器来制造启动收益。
- [ ] **O4** PPR／RSC：另写发布页面架构设计与成本对照，不作为本轮升级完成条件。

这些候选尚未实施，不需为了勾完全部可选项阻塞 U6。

## React 私有接口与本地修正审计

- [x] **A1** query 0.2.0 删除 `reactCurrentDispatcher()`、私有 dispatcher 读取及 `isPlasmicPrepass()`，公开 `usePlasmicPrepass()` Hook；LoadingBoundary、PlasmicPageGuard 和测试均已迁移。普通 SSR 返回 false、原生 prepass 返回 true；渲染外代码显式传递模式。真实组件的 SSR、prepass、hydrateRoot、权限与加载变化包含在 4 文件 15 项回归中，SDK 依赖闭包构建通过（`u13-prepass-tests-final.log`、`u13-sdk-closure-build.log`）。这是破坏性 API 变更，不能按旧补丁版本发布。
- [ ] **A2** 处理画布对 Fiber tag／memoizedState 的版本耦合。本次扩展了 React 19 标签及隐藏子树遍历，属于原有架构的私有结构适配；评估显式节点注册／ref 映射，不能归类为完全使用公开 API 的升级。
- [ ] **A3** 审核并处理 react-inspector、swell-js 的本地类型声明补丁及 XDraggable 的 SVG nodeRef 类型断言。它们不修改 React 运行时，但属于必须披露的本地修正。
- [ ] **A4** 保持性能／诊断脚本中的 Fiber 读取、临时 render 包装与产品运行逻辑分离；测试入口别名、依赖去重及版本 overrides 不得替代实际发布包的 peer 和运行合同验证。
