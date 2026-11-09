# React 19 升级与性能优化实施方案

状态：实施中，阶段结果见 [实施记录](implementation-report.md)。编写日期：2026-11-04；完整性复核：2026-11-05（Asia/Shanghai）。

当前主工作区的根、platform、sub、live-frame、react-web-bundle 已统一安装 React/ReactDOM 19.3.1、React 类型 19.3.0。MobX 替换和依赖清理已完成，见[原生状态验收](../../design/mobx-to-zustand-migration/handoff.md)。Studio／Canvas／react-web SDK 运行链已按 `infer` 严格合同完成候选零跳过审计、生产构建和完整测试加修后逐项复验，三个必需捕错 class 单独计数；精确范围和证据见 [Compiler 接入](compiler-rollout.md)。邮件 SSR 和邮件 Host 也已接入同一严格 Compiler 合同；最终 SDK／CLI／CPA、独立 Preview／原生 renderer 和 Desktop 的验收范围、入口与证据见[最终运行链验收](release-verification.md)。这不是全仓零跳过声明；正式性能对照和发布仍需分别签收。接手说明见[迁移交接](./migration-handoff.md)；源码 commit 不代表实际性能制品，比较时必须同时核对源码、renderer 和依赖闭包身份。

用户确认无消费者的 Rich Components、Sortable、Quill、Rive、YouTube 已退役，连同仅供 Rich Components 使用的 Pro 和 Pro Form 替身一并清理。Studio 内置拖拽、Slate 富文本、筛选器、表单及数据源保留；公开组件发布计划现为 59 个包。

## 1. 使用方式与交付目标

- [执行清单](execution-checklist.md)：按 U0–U6 实施 React 19 基础升级，按 C0–C3 独立实施 Compiler 试点。
- [检查清单](verification-checklist.md)：依赖、功能、状态订阅正确性、性能和发布检查，包含已核对的命令与证据记录格式。
- [完整范围与审核矩阵](coverage-matrix.md)：S01–S10 全部相关运行链、联动框架升级、具名依赖缺口及关闭条件；[机器可核查范围](scope-inventory.json)覆盖 138 个 manifest、93 个直接相关项及 38 个 workspace／锁文件。
- [Zustand 迁移方案](zustand-migration.md)：状态拆分、更新合同、完整执行步骤和性能验收；这是本轮交付范围。
- 本文维护决策、范围和阶段门槛；执行状态只在执行清单勾选，检查结果只在检查清单记录，避免三份文档状态不一致。

基础交付目标：仓库控制的 Studio、内置 Host、Canvas、live-frame Preview、独立 Next.js Preview 服务、react-renderer、全部维护 SDK／组件包／框架适配／脚手架与测试消费者、发布 hydration 与 Desktop 制品使用匹配的 React 19 运行链，保持组件契约、模型数据、编辑和保存语义正确。最终交付必须完成 Zustand 替换并保持 Compiler 开启。每个相关对象必须升级、验证已满足或完整退役，不能只完成主应用后宣称全仓完成。

性能交付目标：分别测出版本升级、Compiler 和其它优化的结果。Compiler 只有在独立通过正确性与性能门槛后才扩大范围；不以它的收益作为 React 19 基础升级的完成条件。

后续执行者先读取根目录 [CLAUDE.md](../../../CLAUDE.md)；修改 Studio 前读取 [platform/wab/CLAUDE.md](../../../platform/wab/CLAUDE.md)。

## 2. 已核实的版本与目标

下表是方案输入，不是安装完成记录。执行 U0 时再次核对 registry 与锁文件，并把最终精确版本记入执行清单。

| 项目              | 当前已核实                                                            | 本方案目标／处理方式                                                                 |
| ----------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| React / ReactDOM  | 主应用与根 catalog 为 18.3.1；sub 声明 ^18.2.0                        | 目标均为 **19.3.1**，2026-11-04 已通过 npm registry 核实可获取；两者锁定相同精确版本 |
| React 类型        | 根 18.3.27 / 18.3.7；Studio DOM 类型 18.3.5；部分辅助包仍为 16.x 类型 | 选择与目标兼容的 19.x 精确版本，统一跨包类型身份；不把旧类型声明误认为旧运行时       |
| MobX              | 6.13.6                                                                | 按用户确定的范围迁移到 Zustand 5.0.16，包含模型／画布／缓存，不保留兼容层                                    |
| mobx-react        | 7.6.0，peer 未覆盖 19                                                 | 迁移完成后移除绑定及所有 observer／Reaction 调用；阶段共存不算验收完成   |
| React Compiler    | 未接入                                                                | 1.0.0 为独立试点候选；2026-11-04 已核实 registry 版本                                |
| Hooks ESLint 插件 | ^4.6.0                                                                | 7.1.1 为候选；核实其与现有 ESLint 配置的规则接入，不同时迁移整套 ESLint 架构         |
| Studio UI         | antd 6.6.5                                                            | 保留，验证组件交互和实际运行路径                                                     |
| 画布旧组件库      | 注册包包含 antd v4；platform overrides 仍固定 v4 4.19.5、v5 5.12.8    | 先建立引用与能力矩阵，再决定移除或迁移；不能据仓库存在入口声称所有设计都用了 v4      |
| 构建／桌面运行时  | Rsbuild 1.7.6、Electron 45.2.1                                        | 本轮保持；避免把构建工具、浏览器版本和 React 收益混在一起                            |

Next 是必要的联动升级：本轮采用 Next 16.4.5。用户确认没有 Gatsby 消费者，退役其 SDK、模板、示例、集成测试、发布入口和代码生成分支；不再维护 Gatsby 运行链。完整关联文件、Node engines、旧 fixture 和替代路线见范围矩阵第 3 节。最终精确依赖必须逐项验证，不能把“其余依赖”作为未完成的泛指任务。

### 2.1 支持边界

默认目标是仓库控制的运行链全部升级到 React 19，不新增 React 18/19 双实现、API shim、伪造 peer 范围或 ReactDOM 兼容层。迁移完成后删除因该边界失效的旧挂载分支、配置、测试和文档。

公开 SDK 的现有 peer 范围和外部自定义 Host 是显式合同：U0 必须决定新发布版本是否要求 React 19，并列出需升级的调用方和发布顺序。默认方案按 React 19 新基线规划；若仍要求支持 React 18，需先修订支持矩阵与验收范围，不能静默收窄公开合同，也不能保留未验证的广泛 peer 范围。当前在隔离工作区实施，尚未对外发布 SDK 或合入原工作区。

旧组件的持久化名称、UUID、props、slots、默认值和事件签名不能因更换依赖而改变。无法保持语义的迁移必须作为具名业务迁移设计，不能用全局 antd override 直接替换。

## 3. 工作包与关键代码范围

以下是核查入口，实施时重新搜索调用方；不是声称只有这些文件需要改动。

| 编号 | 工作包                   | 已核实的入口与要解决的问题                                                                                                                                                                                                                                                                                                                                                                                           |
| ---- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R01  | 依赖根与产物             | 根、platform、sub、live-frame、react-web-bundle 各自的 package.json／workspace／锁文件；Desktop 有独立 npm 锁文件。根 catalog 不控制所有安装根                                                                                                                                                                                                                                                                       |
| R02  | 根节点与临时根           | [Shell.tsx](../../../platform/wab/src/wab/client/components/Shell.tsx)、[ContextMenu.tsx](../../../platform/wab/src/wab/client/components/ContextMenu.tsx)、[quick-modals.tsx](../../../platform/wab/src/wab/client/components/quick-modals.tsx)、[serialize-docs-preview.ts](../../../platform/wab/src/wab/client/components/docs/serialize-docs-preview.ts) 仍有旧挂载／卸载 API；自定义属性与动作编辑器还有旧分支 |
| R03  | DOM 引用                 | [view-common.tsx](../../../platform/wab/src/wab/client/components/view-common.tsx)、[EllipseControl.tsx](../../../platform/wab/src/wab/client/components/EllipseControl.tsx) 使用 findDOMNode；沿调用方改为明确 DOM ref                                                                                                                                                                                              |
| R04  | Fiber 与选择             | [react-global-hook](../../../platform/wab/src/wab/client/react-global-hook/globalHook.ts)、[fiber.ts](../../../platform/wab/src/wab/client/react-global-hook/fiber.ts)、[studio-canvas-util.tsx](../../../platform/wab/src/wab/client/components/canvas/studio-canvas-util.tsx) 依赖私有结构；验证遍历、Suspense、提交／卸载与 DOM→Val 映射，不能只修类型                                                            |
| R05  | MobX 与自定义调度        | [mobx-client-util.ts](../../../platform/wab/src/wab/client/utils/mobx-client-util.ts)、[canvas-observer.ts](../../../platform/wab/src/wab/client/components/canvas/canvas-observer.ts)、[view-ctx.ts](../../../platform/wab/src/wab/client/studio-ctx/view-ctx.ts)、[InspectorSelection](../../../platform/wab/src/wab/client/studio-ctx/inspector-selection.ts)；验证 Reaction 跟踪、放弃渲染、暂停／恢复及清理     |
| R06  | React / JSX runtime 归属 | [Host 全局导出](../../../packages/host/src/index.ts)、[Canvas 打包](../../../platform/canvas-packages/esbuild.js)、[Loader 内置模块](../../../packages/loader-react/src/loader-client.ts)、[共享构建配置](../../../platform/wab/tools/webpack/sharedRsbuildConfig.ts)；同一 renderer 的 React、ReactDOM、JSX runtime 必须匹配，不跨 window 共享运行状态                                                              |
| R07  | SSR 与发布 hydration     | [query dispatcher](../../../packages/query/src/react-utils.ts)、[loader dispatcher](../../../packages/loader-react/src/react-utils.ts)、[prepass](../../../packages/prepass/src/index.tsx)、[HTML 生成](../../../platform/wab/src/wab/server/loader/gen-html-bundle.ts)、[hydration 构建](../../../scripts/build-html-hydrate.mjs)；既有 19 分支和宽 peer 不等于实际通过                                             |
| R08  | 类型、测试、生成代码     | React.JSX、ReactElement.props、useRef 初值、ref callback 返回值、测试 act；同时核查 codegen 模板和生成后的可执行代码                                                                                                                                                                                              |
| R09  | 组件生态                 | react-beautiful-dnd 13.0.0、react-spring 9.5.5、react-joyride 2.9.3 及旧 antd、react-aria 补丁、富文本组件、SSR prepass；逐项验证实际 API，不通过强制 peer 安装绕过                                                                                                                                                                                                                                                  |

| 编号 | 补充工作包       | 必须纳入的入口与任务                                                                                                                                                                 |
| ---- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R10  | 独立服务         | platform/preview 的 Next／adapter／Node 联动升级；platform/react-renderer 独立锁文件、旧 loader SDK、SSR／原生构建与部署回滚，区别于 live-frame                                      |
| R11  | SDK 状态与 JSX   | react-web-runtime 的 JSX shim／类型入口；auth-react、data-sources、data-sources-context、Valtio／proxy-compare／use-sync-external-store 的状态／认证／订阅与服务端路径               |
| R12  | 框架适配与生成器 | loader-nextjs、deprecated nextjs-app-router 的升级或完整退役；CLI、CPA 策略及其 11 套已跟踪输出、全部维护输出，不能仅改生成产物                                       |
| R13  | 测试与工具       | React 17 CRA、Next 12/13/14、loader-tests/env 与 setup 默认版本、host-test 的旧 Host alias、dashboard-preview-probe/fidelity 的旧 root；目标 19 消费者与真实部署矩阵 |
| R14  | 全组件闭包       | 全部维护中的 plasmicpkgs manifests、vendor／plasmicpkgs-dev；GraphiQL 家族、Refine、TinyMCE、Monaco、inspector、react-use、auto-sizer、motion 等具名缺口见范围矩阵      |
| R15  | CI／SSR 附属产物 | 包发布、路径触发、cache key／版本身份、Docker／Node engines、API／d.ts、邮件 SSR、metadata／CSP／useId 行为；回滚覆盖所有服务与包消费者                                              |

R01 的安装根范围同时包含 react-renderer、host-test、integration-tests、wab/playwright、loader-tests 的独立 fixture、示例和 CPA 输出；完整文件由 scope-inventory.json 列出。R09 的生态范围按 R14 展开，不能仅处理表中三个旧库。

## 4. React 19 性能能力的实施归属

| 能力                         | 当前项目受益范围                                                                   | 实施归属                                               |
| ---------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------ |
| JSX 路径优化                 | Studio 的现代 JSX 路径；不能等同于整个动态 createElement 画布求值提速              | U3/U5，基础升级直接对照                                |
| Suspense fallback 与重试优化 | lazy 路由、Preview、挂起恢复；React 内部重试 GC 优化不负责清理自定义 MobX Reaction | U3/U4/U5                                               |
| hydration 调度优化           | SDK、发布页面的真实 hydration 路径，不是 Studio 主界面首画布                       | U4/U5                                                  |
| Compiler                     | 重复更新中的纯组件计算和 JSX 复用，不消除必要首次求值／注册／布局                  | C0–C3，独立试点                                        |
| 预加载与脚本管理             | 资源发现和加载链；现有 scriptExec 不会自动变成 React 声明式脚本                    | O1，另开热点实验                                       |
| useEffectEvent               | 特定订阅因无关依赖反复重建的场景                                                   | O2，先举出实际调用链，不批量改 Effect 依赖             |
| Activity                     | 局部面板状态保留和隐藏调度                                                         | O3，不替换整画板、WebContents 或外部 Reaction 生命周期 |
| PPR / RSC                    | 发布站点的客户端 JS、服务端渲染和缓存                                              | O4，独立架构方案，不阻塞基础升级                       |

已有[加载分析](../../performance/2026-11-04/canvas-loading-analysis.md)和[属性面板优化记录](../../performance/2026-11-02/node-selection-optimization.md)用于定位候选，不作为新构建的验收结果。U0 重新核对动画、Markdown、Fiber 等代码是否已经变化，并在所有组采用相同基线，不能将其差异算作 React 升级收益。

## 5. 阶段计划、依赖与退出条件

| 阶段                     | 任务与交付物                                                               | 进入条件 | 退出条件                                                                    |
| ------------------------ | -------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------- |
| U0 冻结范围与基线        | 源码／构建身份、支持矩阵、版本表、组件引用清单、隔离 fixture、现有失败记录 | 本方案   | S01–S10 全范围、manifest 和依赖闭包具名，制品可复现；没有来源不明的基线差异 |
| U1 React 18 上的必要准备 | 新 root API、DOM refs、临时根清理；保留 18.3.1 以隔离行为变化              | U0       | 18 下相关单测、原生交互及 A0→A1 对照通过                                    |
| U2 生态与类型准备        | MobX 绑定、拖拽等依赖处置；19 类型改动清单；旧组件移除／迁移决策           | U1       | 每个阻塞依赖有实际验证的候选或完整替换方案，无未决旧库合同                  |
| U3 React 19 运行链切换   | 所有安装根与制品同步；现代 JSX；内部 dispatcher／Fiber；错误上报与类型修复 | U2       | 定向测试、类型检查、全部相关生产构建通过，Compiler 开启并验证实际转换                     |
| U4 功能与产物验收        | S01–S10 全部维护服务、SDK、组件、生成器、示例与消费者的回归证据            | U3       | 检查清单 Q01–Q26、I01–I12 通过；失败不可用刷新快照、弱化断言掩盖            |
| U5 性能与生命周期验收    | A1/B 同条件对照、长任务与保留路径诊断、包体与首次使用成本                  | U4       | 达到第 7 节门槛，结论明确区分“无退化”与“提速”                               |
| U6 发布准备与回滚演练    | 一致制品 manifest、部署顺序、回滚包、检查签收                              | U5       | 发布前检查完成，旧版本恢复后关键场景复验通过；实际发布另按授权执行          |

U1、U2 可以按依赖拆分多个小 PR；U2 中需要 React 19 才能验证的部分在 U3 联合验收。不要把“准备项已列出”当成候选依赖已经通过。

Compiler 阶段：C0 定义纯组件边界和目标指标 → C1 接入受控编译 → C2 正确性及 B/C 性能对照 → C3 关闭兼容性与正确性问题并扩大编译范围。C0/C1 的 React 18 隔离实验可与基础升级准备并行开展；19 上的保留结论必须重跑 C2。最终交付必须通过 C3，不能以关闭 Compiler 规避兼容性问题。

每个 PR 只解决对应阶段，附变更文件、实际运行命令、退出码、报告路径及未覆盖项。未完成项保留空勾选，不用“预计通过”替代证据。

## 6. Zustand 与 Compiler 的实施规则

### 6.1 全量推断与输入合同

Compiler 对 `src/wab` 下全部前端 JS／TS 源码启用 `compilationMode: 'infer'`，自动识别函数组件和 Hooks；排除服务端、测试、Storybook 用例及类型声明。没有文件白名单或关闭指令；空生成 Hook 使用正向 `"use memo"` 显式要求实际编译，不添加虚假 Hook。原生状态合同见[迁移方案](zustand-migration.md)。

组件必须消费订阅返回的不可变快照或普通值。仅调用订阅 Hook 后从稳定模型实例重新读取可变字段，不能表达 Compiler 缓存的失效输入。模型对象保留领域命令身份，渲染数据通过原生 selector 提供；不使用全局 revision 或增加通用 schema 转换层。

### 6.2 构建与诊断

- 配置由 [react-compiler.mjs](../../../platform/wab/tools/react-compiler.mjs) 统一维护，目标 React 19。共享 Rsbuild 配置覆盖 Studio、Dashboard Preview 和 Storybook；Vitest 使用相同转换配置。
- 使用 `panicThreshold: 'all_errors'`，诊断阻断构建；不增加关闭指令或通过安全跳过签收。Canvas 的 Hooks 和 Compiler runtime 必须归属同一个 iframe renderer。
- 在 `platform/wab` 运行 `node tools/react-compiler-audit.mjs /tmp/compiler-audit.json`，按当前源码生成参与文件、实际转换函数、诊断及源码哈希。扫描独立使用收集模式以保留全部诊断，发现诊断或解析错误时退出 1；该扫描不是性能或功能验收。
- 保留 SWC、现有别名和每个 renderer 的 React 归属。react-web 发布产物、Sub／Canvas／live-frame 使用各自严格构建入口，并处理 `react/compiler-runtime` 的 external、Host 全局与模块解析；精确源码范围、三个必需捕错 class 和验证入口见 [Compiler 接入](compiler-rollout.md)。运行时生成业务模块的浏览器 Compiler 链已完成开发／生产 Rspack＋Chromium 契约复验。

### 6.3 必须证明的正确性

模型对象引用不变而字段变化、动态分支切换订阅、选择快速变更、暂停／恢复、卸载重开、放弃渲染、主题／语言变化和异步结果乱序均有检查项。测试必须执行与生产相同范围、相同选项的 Compiler 转换；仅运行原源码单测不能验收编译产物。

若通过 useSyncExternalStore 改善某处订阅，仍须提供正确的不可变 snapshot 与失效规则；它不是给整个 MobX 图加一层包装的理由。外部 store 更新也不能仅用 startTransition 包住就认定变成可中断工作。

## 7. 性能实验与规划门槛

### 7.1 构建组

| 组  | 内容                                                   | 归因用途                                                                  |
| --- | ------------------------------------------------------ | ------------------------------------------------------------------------- |
| A0  | U0 冻结的 React 18 实际基线                            | 现状                                                                      |
| A1  | React 18 + U1/U2 可在 18 运行的准备改动，Compiler 关闭 | A0/A1 区分 root／依赖准备收益                                             |
| B   | React 19 基础升级，Compiler 关闭                       | A1/B 评估实际升级包的影响，列出不可避免的联合依赖变化                     |
| Z   | React 19 + Zustand 迁移，Compiler 关闭 | B/Z 单独评估状态架构变化 |
| C   | 与 Z 相同，仅增加 Compiler 全量 infer                  | Z/C 评估编译成本与收益；必要时增加相同 Babel 管线但关闭 Compiler 的控制组 |

另一个优化不得只出现在其中一组。冻结 Electron、窗口／DPR、项目修订、组件库精确版本、网络 fixture、构建模式及后台负载。旧报告数值不是 A0。

### 7.2 采样方法

- GP 单画板和复杂十画板各自运行，另选发布 hydration 与属性面板／代码展示工作负载。使用本地隔离数据，测试保存发生在隔离服务，不操作线上设计。
- 启动／打开至少两组 ABBA，每版本至少 4 个独立进程；每进程 6 次打开，前 2 次预热、后 4 次计时。冷下载、首进程、暖重开分别记录，不合并成一个平均值。
- 输入场景固定节点及真实输入，每进程至少 30 个有效操作，记录中位数与 p95，保留全部失败与离群样本。样本不足不报告 p99／统计显著性。
- 测首画布、全部画板、首次 AI 消息／代码面板、选择／属性修改、Preview 首次打开、hydration 可交互及长任务。rAF 是绘制机会，不能标成屏幕呈现时间。
- 正式计时不同时运行构建、CPU trace、堆快照、强制 GC。CPU 归因和 GC 后生命周期对照单独执行；20 轮切页／Preview／重开，固定撤销步数和模型规模。

### 7.3 预设验收门槛

以下是本方案的工程门槛，不是官方承诺或已测结果。U0 先记录基线波动；若噪声超过门槛，改善实验条件后重测，不能运行后放宽门槛。

- 基础升级：功能零新增失败；启动／打开／首次使用中位数退化不得超过 `max(基线 × 5%, 30ms)`，输入 p95 退化不得超过 `max(基线 × 5%, 10ms)`。
- 生命周期：GC 后稳定工作集增长不超过 `max(基线 × 5%, 10MiB)`，20 轮后无持续增长或新增旧 ViewCtx／Reaction／Fiber 保留链。RSS／GPU／原生峰值独立报告，不能只用 JS heap 证明整体内存安全。
- Compiler：目标更新场景须同时减少无效 render／重复计算，并在跨进程中位数上改善至少 `max(B × 10%, 5ms)`；其它基础指标仍满足无退化门槛。仅减少 render 次数而耗时无收益，不扩大范围。
- 新增 chunk／运行时、压缩后资源体积、构建时长和首次功能成本逐项报告；未解释的新增重复 React、runtime 或组件库直接阻断，不设“能启动就接受”的例外。
- 未达到提速门槛只可结论为“通过无退化兼容升级”，不得宣传提速；Compiler 未达门槛则撤回试点。

复用 [选择性能工具](../../../platform/wab/tools/selection-performance/README.md)与[Desktop 性能入口](../../../desktop/tests/performance/README.md)。real-project-open.cjs 需要私有 fixture 参数，不提供虚构的通用项目命令；执行前按其源码及既有报告准备实际输入。

## 8. 发布和回滚

1. 保存 A1 与 B 完整制品、SDK 包、精确锁文件、source／artifact hash 和 manifest；回滚单位是完整一致制品，不能只恢复 react package.json 或单个 chunk。
2. 先完成 SDK／Host／组件制品与消费者的依赖可用性，再部署与它们匹配的 Studio 和 Desktop；实际顺序在 U0/U6 按支持矩阵填写。npm 发布版本不可覆盖，回滚消费者到已保存版本。
3. SDK 如调整最低 React peer，使用符合仓库发布策略的版本，并同步示例、文档与受控调用方。没有明确旧版本支持需求不追加兼容分支。
4. 基础发布不含未通过的 Compiler、Activity、PPR 或其它热点实验。已验证的可选行为按现有 devflag／发布机制控制，不保留两套根挂载实现。
5. 出现错误目标写入、保存模型差异、选择映射失效、无法恢复的 hydration 错误、崩溃／泄漏或性能门槛失败时停止推进；恢复完整旧制品并复验打开、编辑、保存重开、Preview 与 hydration。
6. 本文不授权发布、提交真实业务数据或发送通知；本次只创建文档。实际实施保持当前会话授权与仓库发布规则。

发布闭包必须包含独立 Next Preview、react-renderer、框架 adapter、CLI／CPA 和所有维护组件／消费者；CI 路径过滤、安装根、cache／构建身份和镜像 engines 逐项核对。回滚既包含完整客户端资源，也包含匹配的服务端／SDK／组件版本与生成器默认值。对应新增必需检查为 I09–I12、Q19–Q26、P09–P10，不能留作可选优化。

## 9. 尚需实施阶段确认的事项

| 决策                                            | 完成阶段 | 所需证据                                                              |
| ----------------------------------------------- | -------- | --------------------------------------------------------------------- |
| 公开 SDK／外部 Host 的最低 React 与版本发布合同 | U0       | 受控消费者清单、包版本策略、React 19 支持矩阵                         |
| 旧 antd v4/v5 的实际设计引用及迁移路径          | U0/U2    | 模型引用、注册合同、渲染与交互对照；无引用才可移除                    |
| 各第三方库最终精确版本／替代库                  | U2       | peer、实际 API、补丁重放、类型／交互测试，不能只记录 registry 声明    |
| React 19 Fiber 和内部 dispatcher 的目标实现     | U3       | 目标版本源结构核对、挂起／恢复／卸载回归；不能仅凭 tag 常量编译通过   |
| Compiler 实际转换范围、诊断与主指标             | C0       | 更新热点样本、不可变输入边界、编译产物及 B/C 对照设计                 |
| 私有测试数据和发布平台覆盖                      | U0/U6    | 授权隔离 fixture、真实运行环境；缺少 Windows/Linux 等平台不得宣称通过 |

## 10. 官方依据

- [React 19 升级指南](https://react.dev/blog/2024/04/25/react-19-upgrade-guide)：删除 API、现代 JSX、类型和错误处理。
- [React 19.0 发布记录](https://github.com/react/react/releases/tag/v19.0.0)、[19.1 发布记录](https://github.com/react/react/releases/tag/v19.1.0)：Suspense、hydration、GC 与调度。
- [React 19.2](https://react.dev/blog/2025/10/01/react-19-2)、[19.3](https://react.dev/blog/2026/09/09/react-19-3)：新 API 的范围；不构成应用统一提速保证。
- [Compiler 与不兼容库](https://react.dev/reference/eslint-plugin-react-hooks/lints/incompatible-library)：明确列出 MobX observer 风险与 lint 检测缺口。
- [Compiler 渐进接入](https://react.dev/learn/react-compiler/incremental-adoption)、[target](https://react.dev/reference/react-compiler/target)、[use no memo](https://react.dev/reference/react-compiler/directives/use-no-memo)。
- [MobX React 集成](https://mobx.js.org/react-integration.html)、[useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore)：订阅、snapshot 与 Transition 边界。
- [Rsbuild 1.x React／Compiler](https://v1.rsbuild.rs/guide/framework/react)：与当前主应用构建器对应的接入方式。

实施时复核文档适用版本。官方 Compiler 的生产案例数字不能当成本项目收益，也不能归因于单纯升级 React。
