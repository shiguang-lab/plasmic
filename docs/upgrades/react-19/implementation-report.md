# React 19 实施记录

状态：实施中。隔离工作区已切换 React/ReactDOM 19.3.1、类型 19.3.0；尚未满足全范围功能、发布或性能验收条件。

## 工作区与证据

- 实施分支：`codex/react-19-implementation`；隔离工作区为 `/Users/yanxianliang/.codex/worktrees/react-19-upgrade/plasmic`。原工作区的用户并行变更保留，最终合并前需要重新核对。
- A0 HEAD：`32df7af09a1df7d119143b546f14a81b6d876c83`；开始时仅升级方案文档有未提交变更。
- 本机：macOS、Node 24.20.0、pnpm 11.10.0、npm 11.19.0、Electron 45.2.1。
- 私有原始证据：`/tmp/plasmic-react19-20261105`，含冻结源码、构建日志、依赖元数据和离线 fixture。项目模型与原始报告不提交仓库。
- A0 renderer hash：`9b5e6666b350c07aaa4f20d1342901cf5e2eb09312a9d3f16dcef6faa1e7f862`。
- A0 source hash：`05e37bde48def31231166d4dec89aff4fade871c55a5577f57e01c289ac623a6`。

## 已执行验证

| 证据文件（均位于私有目录 logs/） | 结果与边界 |
| --- | --- |
| baseline-studio-tests.log | React 18 基线：7 文件、56 测试，54 通过、2 失败；夹具缺少 CanvasSessionState 和 frame 注册。 |
| baseline-build.log | `PLASMIC_SELF_HOSTED=1` 加实际静态域名运行 `node scripts/build-studio.mjs`，退出 0。该入口未重新构建全部画布组件，后续必须补齐完整闭包构建。 |
| baseline-assets.log | 从本地 Studio build 准备 Desktop assets，退出 0；已归档 renderer-a0。 |
| u1-regression.log | React 18 下 11 文件、80 测试通过；保留菜单主题测试，新增 root 清理与 SVG 坐标测试；修正上述两处夹具，保留原断言。 |
| u1-shell.log | 主界面和 Host frame 的唯一根、重复 main() 保留状态：2 测试通过。尚未执行热更新浏览器回归。 |
| u1-typecheck.log / u1-typecheck-2.log | 首次发现两个新增 Effect 缺少显式返回分支；修复后完整 Studio typecheck 退出 0。 |
| u2-install-1.log | 首批依赖准备安装退出 0；仍有 peer 缺口，未据此认定兼容。 |
| u2-regression-1.log | 首次依赖检查：5 文件无法加载，原因是 react-use 内部组件路径变更，随后修复。 |
| u2-typecheck-1.log / u2-typecheck-2.log | 发现 Inspector 发布/类型接口、GraphiQL 导出及 DnD 可空 handle 的实际变化；按调用方修复，后续复验。 |
| u2-regression-2.log / u2-regression-3.log | 新 GraphiQL 的 exports 禁止旧 CSS 深层路径，修复后 3 文件、25 测试通过。 |
| u3-original-canvas-baseline-react18.log | 原工作区 React 18.3.1：两个画布测试文件共 6 个测试全部通过。修复夹具的 CanvasSessionState 和 frame 注册，未弱化断言。 |
| u3-canvas-draggable-react18.log | 官方 react-draggable 4.7.2 的 4 个真实 HTML/SVG 拖动、已有 ref、阈值和 Escape 用例通过；两个画布测试文件因本地 SDK 快照缺少构建输出而未加载，不能记为通过。 |
| u3-sdk-react18-build-2.log | 依赖闭包的 SDK 构建退出 0；现代 JSX 的声明导出另在 u3-reactweb-types-build-2.log 复验通过。 |
| u3-components-react18-build.log | 65 个组件包首次现代 JSX 构建：57 通过、8 失败。保留全部失败，后续定向修复。 |
| u3-components-fixes-react18-2.log | Antd5 注册元数据推断和可变 slot 数组的类型修复后构建通过；Commerce 的旧插件类型解析缺陷另行处理。 |
| u3-components-fixes-react18.log | react-quill-new 3.8.3 的 wrapper 构建通过；其 Props 类型从默认导出推导，无运行时服务端导入。 |
| u3-quill-new18-saved-forwarded.log | Chromium、React 18.3.1、react-quill-new 3.8.3：旧版实际保存 HTML 的完整 Delta、空行与格式一致；受控/非受控编辑、工具栏、外部赋值、只读、选区/焦点、PRE、ref 和卸载检查通过，page errors 为 0。 |
| u3-components-all-modern-builder-react18.log | 65/65 组件包全部构建通过。TSDX 内使用官方 rollup-plugin-typescript2 0.37，既有 canvas focus/overlay/slider 行为补丁按安装边界保留。 |
| u3-react18-studio-typecheck-4.log | 官方 react-draggable 4.7.2 API 与事件类型改造后，完整 Studio typecheck 退出 0；未屏蔽诊断。 |
| u3-react18-core-regression.log | 升级依赖后的隔离工作区，5 文件共 15 测试通过，包含两个画布文件、MobX、拖拽及列表排序。 |
| u3-quill-new18-ssr.log | 构建后的 CJS wrapper 在没有 document 的 Node 服务端正常导入、renderToString 返回既有空输出，退出 0。 |
| u3-react18-regression-final.log | 12 文件、50 测试通过，覆盖临时根、主界面、画布恢复/生命周期、MobX、排序和拖拽。 |
| u3-swell-module-contract.log / u3-swell-default-build-2.log | 真实 ESM/CJS 默认 API 的九项导出合同验证及修正后的 Swell wrapper 构建均退出 0。 |
| u3-canvas-packages-build18-2.log | 刷新全部本地 SDK/组件后，画布类型生成、完整 tsc 和生产 esbuild 构建退出 0。 |

`window.computedStyle(elt, pseudoElt)` 是 jsdom 对 Antd 测量的环境诊断；异常恢复测试有故意抛错的控制台输出。原始日志全部保留，浏览器验收另行检查真实错误，不据此过滤新增错误。

## 首批依赖处置

目前运行时仍为 React 18.3.1。以下候选已经安装，完整交互验收尚未完成：

| 依赖 | 当前候选 | 实际修改 |
| --- | --- | --- |
| mobx-react | 9.2.0 | 迁移过渡期依赖；普通/class observer、同引用变更和动态依赖测试已通过；最终按 Zustand 方案移除。 |
| react-beautiful-dnd | 替换为 @hello-pangea/dnd 18.0.1 | 全部实际类型及实现导入迁移，使用包内类型；可空 dragHandleProps 明确转换为现有可选合同。键盘、鼠标、虚拟列表和滚动仍需全部验收。 |
| react-spring | 替换为 @react-spring/web 10.1.0 | 调用方只使用 DOM 动画，直接使用 web 入口，移除未使用的 native/three 等 renderer 依赖入口。 |
| react-use | 17.6.1 | UseKey 从 comps 迁至 component；异步 Hook 类型迁至 misc/types，行为须回归。 |
| react-inspector | 9.0.0 | 8.0.0 发布包缺少 dist，弃用该候选；9 使用内置类型和具名 ObjectInspector；保留树节点回调所需字段合同。 |
| auto-sizer | 1.0.26 | 保留原有 children render 接口，不切换到 2.x。 |
| TinyMCE React | 6.3.1 | 保留 TinyMCE 6，尚需编辑、选区和卸载回归。 |
| Monaco React / Monaco | 0.59.0 / 0.52.2 | 同步 wrapper 声明的 editor peer，尚需 worker 与完整编辑器回归。 |
| GraphiQL 家族 | graphiql 4.0.0、@graphiql/react 0.30.0、plugin-explorer 4.0.0 | 该组合支持 React 19 且保留现有 Context/CodeMirror API；改用具名 GraphiQL 和公开 CSS 导出。仍需 schema、执行、变量及插件实际交互回归。 |
| Refine | 移除 @pankod/refine-core | 全项目仅使用排序类型。将等价 `{ field, order: 'asc' \| 'desc' }[]` 合同置于现有 data-sources 模块，客户端及两个后端调用方统一引用，移除未用 React 框架。 |

Joyride、Quill、旧 Antd、Motion、prepass、框架适配和其余安装根仍待完成。以上表格不能代表 S01–S10 已通过。

## 性能采样状态

A0 每项目目前只有一个独立进程、6 次打开；前 2 次预热、后 4 次计时。未达到正式 ABBA 样本要求，仅用于确认工具及样本可用。

| 离线项目 | 暖首画布中位数 | 暖全部画板中位数 |
| --- | ---: | ---: |
| GP 单画板 | 1688.0 ms | 1687.6 ms |
| 复杂十画板 | 1562.5 ms | 3989.6 ms |

两组进程均退出 0，打开测试报告无 renderer errors。Dashboard 缩略图 IPC 另有既存 `undefined.map` 错误，原始日志具名保留；必须检查 fixture/缩略图链，不能把此结果视为全功能验收。首画布检测轮询与 timing mark 的口径不同，表中不足 1ms 的先后差不表示视觉时序倒置。

尚无 B/C 数据，不能判断 React 19 或 Compiler 的性能收益。完成安装闭包、功能回归和正式交替采样后更新本报告。

## 本次继续实施的边界

- react-draggable 使用官方 4.7.2 和官方 nodeRef API；HTML/SVG 均测试。上游 nodeRef 的声明只列 HTMLElement，本地在唯一调用边界表达其实际 SVG 行为；未修改该库、peer 或 React API。
- Quill 已撤回自维护兼容分支，改用 react-quill-new 3.8.3 + Quill 2。旧版列表导入会自动添加空行，新版不再添加。以旧版实际保存 HTML 验证，文本/完整 Delta 保留；DOM 与输出 HTML 仍需覆盖全部注册格式、预览及导出。
- Quill 的自定义编辑子组件必须将 ref 转交给原生编辑 DOM。旧的 class 实例 ref 在替代库中实测超时失败（u3-quill-new18-saved.log）；新测试明确验证通过原生 ref 渲染的 class，没有将旧失败记为通过。当前 Plasmic 注册未暴露 children slot；仍需将该 API 差异纳入消费者检查。
- 本地受控 SDK 改为 link 引用：现有 hydration 构建明确要求 local SDK 的 realpath；file 快照既不符合该检查，也会保留旧 dist。必须同步核查两个安装根的已有第三方补丁，不能因链接变更丢失行为修复。
- 全部范围仍未完成；React 19 已在隔离安装根启用，Compiler 关闭。没有新版性能收益结论。

- 完整画布首轮构建发现 Swell CJS/ESM 导出不一致，撤回 namespace 导入，保留实际默认 API；补充其官方 3.24.5 已发布类型中遗漏的 default 声明，未修改运行时。此前单包构建记录不能代表画布打包通过。

## A1 真实运行与加载层修正

- A1 完整 Studio/Host/Preview/hydration 构建及 Desktop assets 准备均退出 0（u3-studio-a1-build.log、u3-a1-assets.log）。归档 renderer-a1；sourceHash `f87358adb8af2a36d54d2c664f6e106f84d7b4a780b4da939c72a8500e594f97`，rendererHash `e8b05bc782a36034949338b219712b843153652020c0f7da2a8ade17f8aece6e`。该版不满足功能验收，后续制品将替代它作为正式对照。
- GP 离线保存/重开/预览业务分页的步骤执行完成，但回放捕获 5 条销毁期间读取已释放 evaluator 的错误，进程失败（u3-a1-functional-gp.log）。未将有错误的结果记为通过。
- 在 maybeTpl2ValsInContext 明确返回 disposed frame 的空值集；不保留已销毁 evaluator，不吞掉活动 frame 的异常。新增 2 个回归用例在修复前均失败，修复后画布/恢复/选择共 24 项通过（u3-disposed-env-before.log、u3-disposed-env-after.log）。A1-final GP 保存/重开、撤销重做、样式/画板移动及 Preview 业务分页闭环通过，report.errors 为空（u3-a1-final-functional-gp.log）。该制品仍包含此后被撤回的外层加载提示修改，后续引导修复必须使用新制品验证。
- 调试回放中的大转圈已通过 DOM 和截图复现：`react-joyride__loader`（48px 黑色圆环）和 `react-joyride__overlay`，位于 Studio iframe；不是业务表格的 Antd Spin。触发时 `#proj-nav-button` 不存在（u3-a1-joyride-target.log 对应 report）。Joyride 3 默认等待目标 1000ms，300ms 后展示 loader；官方说明见 https://react-joyride.com/docs/new-in-v3 和 https://react-joyride.com/docs/props/options 。共享引导目标可见性检查现覆盖普通引导和两个教程入口，仅在目标有布局、祖先未隐藏时挂载；目标缺失不记录已读。由应用管理等待，Joyride 使用官方 `targetWaitTimeout: 0`，避免目标检查之间的竞争触发全屏等待。11 项引导/可见性回归已分别通过，完整 Studio typecheck 退出 0。真实浏览器额外验证 5 条引导路径通过，正常打开未捕获 loader。外层全屏操作遮罩保持原实现；已安装正式应用未修改。
- 链接后的 SDK CJS Host 入口和 Aria 外部模块在 Vitest 中绕过 React dedupe，造成真实的重复 React；以同一已构建 ESM Host 入口及 Aria 家族转换修正测试解析，保留所有 UI 断言。该配置不改变生产运行时。
- 原工作区只同步了 disposed 画布保护及测试；引导库升级和其余后续修改仍在隔离工作区。旧加载层探索的 top-view 修改和 3 个对应测试已撤回，不计入当前验收结果。
- Docker 本机可用（Linux aarch64），独立 react-renderer 的 Linux 构建与隔离验证尚未执行。

## 引导等待回归验收

- 当前修复制品为 `renderer-joyride-fixed`，运行时仍为 React 18.3.1，Compiler 关闭；源码归档与 untracked 源一起留存于私有证据目录。sourceHash `49767d658b271a2bc3a5f2a1465edb9eda566d794755d95a70c2de2097bcaa3d`，rendererHash `be40eb8448399293be404e78ec5ba9b898e0ac2161e6d39e6f72803ea8754b8b`。完整 Studio/Host/Preview/hydration 构建和 Desktop assets 准备均退出 0（u3-studio-joyride-build.log、u3-joyride-assets.log）；没有安装或更新正式应用。
- 引导测试使用真实 Joyride 引擎，仅隔离 App/Studio context 与本地 Button。目标缺失、visibility:hidden、祖先 display:none、延迟出现、Got it、Escape、操作信号、已读/匿名用户、目标移除恢复和监听器清理均断言；共享 hook 另验证切换步骤、准备期间暂停、布局与定时器释放。修复前 4 项失败。修复后整组首跑 10/11 通过，剩余项为 jsdom CSS 计算超时；CPU profile 确认耗时位于 nwsapi/style-rules/getComputedStyle，保留断言并给双次挂载用例足够时间后，该项单独通过。没有 mock Joyride 或 Floating UI；测试只模拟 jsdom 缺失的原生目标尺寸。
- 单测证据：u3-joyride-before.log（4/8 失败）、u3-joyride-regression.log（10/11 通过、1 超时）、u3-joyride-disappearance.log（剩余项通过）、u3-joyride-visibility.log（3/3 通过）；u3-joyride-typecheck-3.log 退出 0。以上原始日志均在私有目录的 logs/ 下。
- GP 真实浏览器额外 5 条引导检查全部通过：缺失和隐藏目标无 overlay/loader，延迟目标出现后展示真实 tooltip，目标移除后清除遮罩且不标已读，恢复后可关闭并保存已读状态，设计变更计数不变。原 GP 打开页面截屏已人工核对，圆环和灰色遮罩消失；整个回放没有捕获 Joyride loader。引导测试插入临时 DOM 目标，不更改项目模型；只操作隔离 fixture。
- 同一制品 GP 的画板切换、重命名/样式/位置撤销重做、Preview 业务分页返回、保存重开通过；复杂十画板项目另覆盖冷画板销毁后的撤销、选区/样式恢复及重做，并保存重开。两份 report.errors 均为空。证据为 fixtures/gp/list-open-joyride-fixed-browser.json 与 fixtures/complex/list-open-joyride-fixed-complex.json，对应 u3-joyride-browser.log、u3-joyride-complex.log。
- Dashboard 缩略图 IPC 的既存 `undefined.map` 诊断仍在原始日志中，不属于上述 renderer errors；尚未关闭。以上是功能诊断回放，包含 DOM 探针和临时引导目标，不能用于正式性能对比，也不代表 React 19 全范围升级已经完成。

## React 19 运行链切换与 API 验证

- 根、platform、sub、live-frame、react-web-bundle 实际安装 React/ReactDOM 19.3.1，类型 19.3.0；Next 声明切换至 16.3.1、Gatsby 至 5.16.1，框架消费者构建尚未验收。原工作区仍待合并，不能将隔离工作区的状态等同于当前开发或正式应用。
- SWR 升级至 2.5.1，保持 tuple key fetcher 的位置参数、prefetched cache、mutable loading/error/laggy 数据合同。BoundedCache.keys 改为 SWR 2 要求的迭代器，Studio 对外 getAllDataOpCacheKeys 仍返回数组。
- 修正 React 19 的元素 props、可空 refs、返回值及移除的类型。render slot 的 providesData/render function 组合恢复真正可调用的参数函数，DataCtxReader 在函数调用内渲染，保留每次 slot 调用的标识与环境。
- Markdown 升级至 react-markdown 10.1.0 / remark-gfm 4.0.1，保留外层 class、GFM、外链和 mention URL；普通 URL 继续使用官方安全过滤。发布成功后的 Confetti 改为独立 createRoot，并在实际动画完成后卸载和移除容器。
- 画布 Fiber 遍历新增 React 19 官方工作标签，并处理 Activity 的保留 DOM、隐藏子树、一次假卸载及恢复。没有在产品中新增 Activity 行为。

| 日志（私有 logs/） | 实际结果 |
| --- | --- |
| u3-react19-sdk-build-3.log | loader-react 的 8 包依赖闭包构建通过；这不证明旧 SSR prepass 已兼容。 |
| u3-react19-react-web-build-4.log / u3-react19-react-web-typecheck-4.log | ReactWeb 完整构建和非增量源码类型检查均退出 0。 |
| u3-react19-react-web-tests.log | 4 文件、36 项通过。 |
| u3-react19-core-regression-1.log | 6 文件、22 项通过，覆盖 MobX、原生拖拽、临时根和 Confetti 清理等。 |
| u3-react19-query-regression-2.log | 4 项 SWR 2 实际请求与缓存行为通过。 |
| u3-react19-render-api-regression-4.log | 3 文件、26 项通过，含 17 项画布渲染、3 项 Markdown 和 6 项缓存测试。 |
| u3-react19-fiber-after-2.log | 3 文件、8 项通过，使用真正 React 19 Activity/Suspense commit 验证。 |
| u3-react19-lifecycle-regression.log | 7 文件、34 项全部通过，含完整 Joyride 与目标可见性测试。 |
| u3-react19-typecheck-clean.log / u3-react19-typecheck-clean-2.log | 完整 Studio 类型检查，显式关闭增量，均退出 0。SDK 变更后旧增量缓存曾返回过期诊断，不能将该旧输出解释为现源码失败。 |
| u3-react19-overseas-tests.log | 12 项表单、slot、布局、导航和注册合同测试通过。 |
| u3-react19-components-build-3.log / u3-react19-commerce-typecheck-2.log | Antd5、Radix、Commerce 定向构建及 Commerce 类型检查通过；全部组件包再次构建中。 |

未关闭的发布条件：旧 Antd 与 Pro 迁移、SSR/RSC prepass、GraphiQL explorer、Query Builder 的 Redux 传递 peer、Twitter、Storybook、Gatsby 传递依赖，以及全部框架/生成器消费者、Docker 运行闭包、React 19 原生编辑器和发布 hydration。安装 overrides 会改写锁文件 peer，必须读取实际安装包的发布 manifest 审计，不能凭 pnpm peers check 宣称兼容。Compiler 仍关闭，正式 A1/B/C 性能尚未完成。

- 全组件复建 u3-react19-components-build-4.log 为 64 通过、Antd6 1 失败；修复 Antd6 的元素 props 声明，Collapse 不把 React 19 元素 ref 转成原生 items 的 ref，Breadcrumb 将实际内容留在 title，不误传到 items.children。u3-react19-antd6-build-4.log 退出 0，至此 65 个组件包分别完成本轮构建。
- Antd6 交互首轮 262/264 通过，两个 iframe 样式测试失败。根因是测试别名将 Antd6 的 StyleProvider 错指到 Antd5 的 cssinjs 1.x，组件实际使用 2.x；测试解析改为 Antd6 本身的官方依赖，与实际 sub 安装一致。没有改变生产样式逻辑或弱化断言。u3-react19-antd6-interactions-2.log 为 27 文件、264 项全部通过；jsdom 仍输出其不支持的新 CSS 语法提示，需原生浏览器验收。
- React 19 根错误上报使用 onUncaughtError 接入现有 handleError，保留 devflag 的原生 reportError 调试语义；不接管已有 ErrorBoundary 的 caught error。真实调度器下未捕获渲染失败一次上报、主/Host 唯一根复用共 3 项通过（u3-react19-root-errors-2.log）。React.act 会主动重新抛错，首轮测试因此失败，后续验证使用实际调度提交而非调用回调的模拟断言。
- u3-react19-typecheck-clean-3.log 完整非增量 Studio 类型检查退出 0；u3-react19-react-web-bundle.log 和 u3-react19-canvas-packages-build-1.log 分别构建通过。Antd6 最后修复后再次刷新画布打包，再生成完整 Studio 制品；该制品尚未用于功能/性能验收。

## 原生 SSR 与废弃路径退役

- 用户明确确认：没有仓库外消费者，按现有方案退役 @plasmicapp/nextjs-app-router 和 prepass 的 onClientComponentRef 参数。该包及其 API、源码和 platform override 已删除；loader/react-server 的 760 行模拟 React/context/prepass 环境移除，保留 native RSC loader 的 bundle 获取、模块注册及服务端查询功能。相关破坏性 SDK 合同必须随 React 19 新基线发布，不可作为旧版本补丁发布。
- @plasmicapp/prepass 不再依赖 react-ssr-prepass，改为 React 19 官方 react-dom/static.prerender，完成后释放未使用的 HTML stream。查询在请求自己的 pending/cache 上通过 React.use 等待；SWR 2 状态 envelope 与导出的原始 queryData 分开，保留位置参数、禁用/依赖 key、查询错误返回、过滤和 JSON 安全语义。query 0.2.0 已删除私有 dispatcher 探针与 isPlasmicPrepass 导出，组件使用公开 usePlasmicPrepass Hook；非渲染代码显式传入模式。没有全局伪造 dispatcher、Hook、ReactDOM render 或跨请求 context。
- u3-react19-prepass-contract-before.log：React 19 / SWR 2 下旧实现报 Fallback data is required，返回空缓存且 fetch 次数 0。替换后同一调用返回预期数据、fetch 次数 1，见 u3-react19-prepass-contract-after.log。
- u3-react19-native-prepass-sdk-build-1.log：SDK 完整 loader-react 依赖闭包构建退出 0。u3-react19-native-prepass-tests-2.log：2 文件、6 项通过，包含异步依赖/重复去重、失败/零值、并发同 key 请求隔离、React.use/useActionState/useOptimistic/useEffectEvent、useSyncExternalStore 的 server snapshot、metadata/过滤，以及真实 hydrateRoot 无重复请求/恢复错误。u3-react19-native-query-client-regression.log：既有客户端查询 4 项通过；u3-react19-native-loader-tests-1.log：loader 5 文件、12 项通过。
- u3-react19-native-rsc-entry-2.log 使用 node --conditions=react-server 和真正 React server export（createContext 不存在），native loader 创建和注册服务端函数执行通过。此前首次探针错误使用相对路径导入 React，未触发 exports 条件，已明确保留日志并纠正，不能作为 RSC 验收证据。

## 首个 React 19 编辑器制品

- u3-react19-studio-build-1.log / u3-react19-assets-1.log 均退出 0；归档 renderer-react19-first，sourceHash 60a092f05ee7e1fd783119782aa4acb72a58aa4d58d475476fcdf7ed1ce56f8c，rendererHash 7bbdd6cb2b728ebaae2d4140f21014d518ab87aaeb3140dd27c75fb672778be7。该制品早于原生 SSR、Storybook 和 Fragment 修复，后续需要重建。
- GP 真实编辑器的 5 项编辑/撤销/预览分页及保存重开通过，renderer errors 为空（u3-react19-first-functional-gp.log）。复杂十画板首轮失败：旧 react-keyed-flatten-children 1.3 使用旧 react-is，React 19 Fragment 未展平，样式按钮组报错，不能记为通过。
- 官方 react-keyed-flatten-children 5.1.4 + 与 React 匹配的 react-is 19.3.1 替换旧依赖。u3-react19-fragments-before.log 中嵌套 Fragment 用例失败；升级后同样断言通过，另保留非法子控件的拒绝断言，2 项通过（u3-react19-fragments-after.log）。原生复杂项目尚待新制品复验。
- Storybook 移除不支持 19 的 storybook-addon-mock 5 和专用 shim pins，复用现有 MSW 2 / msw-storybook-addon 2。保留 Form stories 的 getRow/schema POST 行为，真实 fetch 拦截 2 项通过，生产 Storybook 构建退出 0，见 u3-react19-storybook-msw-tests.log / u3-react19-storybook-build.log。MSW worker 通过既有 msw:update 对应命令生成。
- Dashboard 缩略图既存 map 错误已在相同离线项目单独复现到 unbundleSite：预览绕过共享 model hydration，把 modelResourceId 元数据当成内联 model。正在复用 resolveProjectModel 修复并补测资源加载/错误链；不能修改 fixture 伪造已内联响应来掩盖错误。该非 React 修复需要同步 A1 或单列联合变化，不能算作 React 19 性能收益。

- 缩略图改造后的 u3-react19-thumbnail-resources-after.log：3 文件、14 项全部通过，包含实际依赖资源解析、资源失败不隐藏、权限拒绝、过期 revision、页面上下文及原生渲染初始化。u3-react19-typecheck-native-ssr-2.log 完整非增量类型检查退出 0。loader-bundle-env 的最后一条旧 react-ssr-prepass 直接依赖也已移除并重新安装。下一版制品必须复验缩略图和复杂画板，不能沿用首个制品的结果。


## 2026-11-05 本轮依赖迁移与扩大回归

- 用户确认统一 Antd 6，采用官方 Pro 3 beta；旧 Antd、Antd5 包保留原注册合同，实际依赖统一 antd 6.6.5、icons 6.3.4、Pro 3.1.15-9。删除旧 Antd CSS、打包文本补丁和内部模块导出映射，画布 bundle 复用共享原生 Antd 6。旧组件合同 7 项、Antd5 合同 12 项、Pro Table 4 项定向通过；新的实际 IIFE 测试加载旧 Antd、Antd5、Rich Components、Antd6、Overseas 和 React UI，覆盖两种 JSX 产物及 host/canvas 两种 runtime 的主题与 Pro 行选择，5 项通过（u4-antd6-pro3-bundle-contracts-1.log）。
- GraphiQL 6.0.0 使用官方 Query Builder 1.0.1 接替已停用的 Explorer；Monaco 0.57.0、monaco-graphql 2.0.1、Webpack plugin 7.1.1 及官方 React wrapper 4.7.0 联动升级。使用原生 worker 工厂、TypeScript namespace 和受控查询同步，保留原后台数据源执行入口。GET/POST、变量 JSON、认证头、HTTP/GraphQL 错误、取消与 worker 路由共 7 项通过；完整编辑器的浏览器回归待执行。
- react-helmet-async 3.0.0 替换 react-helmet，原生 React 19 metadata 与 body class、样式表生命周期及 root 错误上报共 5 项通过。
- Twitter 三个既有组件直接使用官方 widgets.js。移除不支持 19 的 React wrapper；注册名、属性和业务合同保持。SDK 单文档去重、iframe 隔离、更新、延迟完成/卸载、脚本失败重试与原生 SSR 共 6 项通过（u4-twitter-tests-2.log），组件构建退出 0。
- 用户确认无 Gatsby 消费者：退役 SDK、CPA 策略及 4 套输出、示例、loader/integration 测试场景、平台合同、发布选择与探测、页面代码生成和专用 canvas service-worker patch。保留 11 套维护的 CPA 输出；生成器固定 create-vite 9.3.4 与 create-next-app 16.3.1。CPA lint/build 通过，发布入口和页面 metadata 等 17 项定向测试通过；完整生成消费者构建待执行。范围快照刷新为 179 个 manifest、132 个直接相关项、76 个配置文件。
- 扩大 data-sources 原有 104 项回归发现 7 项失败：旧查询依赖链直接读取 SWR 2 cache envelope，误作业务数据。修正为原生 data/error 状态合同后原有断言全通过。另修复旧 data-op 的 $swr$ 错误键、首次 commit 的自动错误重试，以及多个 Suspense timer 导致的重复请求；保留显式 mutate 重试。新增 6 项覆盖零/假/空/null/对象的并发 cache 发布和失败恢复。data-sources、query、prepass 共 10 文件 120 项全部通过（u4-native-data-query-prepass-tests.log），data-sources 构建退出 0。移除不再存在的 React.isRSC 模拟路径。
- 新 React 18 对照基线已独立完整构建并归档，含相同的缩略图资源解析修复。sourceHash b6b71b3d2ba562a8b29fb84aa4933a6f90774ea63d695f7334342d3537ea7f20，rendererHash 7846e7b84d54af1b08a44674e0e98ba3a90cd3d70778ef8c5aab0b50b5f08b17。真实 GP 项目的 5 项编辑/预览/保存重开、5 项引导及 55132 字节实际缩略图通过，errors/previewErrors 为空（u4-react18-verified-native-gp.log 及私有对应 JSON）。这次功能运行与构建并行，不能用其时间作为正式性能数据。

尚未完成：Query Builder 的 react-redux 8 依赖替换（已选官方支持 19/Antd6 的 react-querybuilder，尚未迁移 UI）、Compiler 白名单试点和测量、更新后完整浏览器编辑器验收、全部维护消费者、Docker 运行闭包及正式 A/B/C 性能报告。实际发布 manifest 审计中五个安装根仅 platform 尚有这条 react-redux 8 缺口（u4-published-peer-audit.log）；这不替代非 React peers 和真实运行验证。全部升级未完成，不得据当前局部通过发布。

## Zustand 状态迁移

新增 [完整迁移方案与检查清单](zustand-migration.md) 和 [源码依赖清单](state-inventory.json)。已迁移独立草稿 store、frame 弹窗开关、AI 扫描／光标两个 store 和按列表 ID 订阅的高度分配；提取组件表单用局部 React state。没有添加全局更新计数或 MobX 到 Zustand 的订阅桥。

联合回归 21 文件 290 项通过，覆盖新模块、实际 Studio 保存／恢复／冲突、AI 工具、画布活动、列表导航与过滤器；完整非增量类型检查、迁移模块 ESLint 通过。模块级计数证明无变化／无关更新不提交消费者；整个编辑器的耗时与内存收益尚未验收。剩余模型、缓存、ViewCtx／StudioCtx、主画布订阅及 MobX 依赖仍在清单中，尚未完成全量替换。

多人协作后续迁移：项目连接独立 store、按玩家 ID／字段订阅；头像／选框／光标／跟随条分别只响应自身必要字段。6 文件 20 项通过，含连接换号、取数与初始化竞争、连续跟随节奏和关闭清理；非增量类型检查及定向 ESLint 通过。此前生产构建通过，但第一次回放因静态资源域名构建参数与隔离环境不符而超时，未作为运行通过证据，继续按正确域名重建。

## Zustand 分域迁移：Docs Portal 批次

2026-11-06：Docs Portal 导航、组件／图标代码和控件、每个示例的输入已改为独立原生 Zustand store。无关输入不提交选区或控件，等值写入不发布；Monaco 文本输入与项目依赖模块生成分开。7 文件 52 项通过，完整非增量类型检查退出 0，定向 ESLint 退出 0（9 条警告）。详见 [Zustand 方案与证据](zustand-migration.md)。当前核心模型及多数画布消费者仍依赖 MobX，完整迁移和正式整机性能验收未完成。

前一多人协作批次的隔离生产回放已通过 GP 5 项、复杂画布 8 项、保存重开、Preview 分页及 GP 引导／缩略图；同源码 Compiler 白名单制品已验证真实转换与局部高亮正确性。受控数据与适用范围见 [CodeDisplay 测量](performance-code-display.md)，不能据该组件结果宣称整体性能提升。上述旧制品不包含当前 Docs 代码。

## 原生状态与更新必要性验证

2026-11-06：新增完成 Docs Portal、选择／平移工具、撤销可用性、跟随玩家选择的原生状态迁移。历史记录不进入 UI store；工具、菜单、玩家数据、跟随选择按更新频率与所有者分开订阅。等值命令仍执行必要的领域操作，只有代码和控件等输出都未变时才跳过发布。

联合回归 32 文件 336 项通过，随后修正等值控件与手动代码的同步问题后，Docs／Preview 7 文件 57 项通过；完整非增量类型检查及对应 lint 通过。最新隔离制品已通过 GP 5 项、复杂画布 8 项、保存重开，以及 Codegen／Loader 编辑、预览和各 50 个依赖模型的 worker 校验，运行错误为空。[脱敏结果与制品标识](state-verification-u12.json)、[方案及验收边界](zustand-migration.md)。

核心模型、视口、Inspector／Canvas 迁移和完整性能验收尚未完成。当前为独立升级工作区的已验证阶段制品，未合入原工作区、安装正式包或发布；不能报告完整升级或整体性能验收通过。

## SDK 发布契约与独立消费者验证

2026-11-06：React 19 的最低版本和公开 prepass API 变更使用独立的新 SDK 版本，包含 Host／Loader 3.0.0、React Web／Prepass／Data Sources 2.0.0、Query 0.2.0、CLI 0.2.0 和 CPA 0.1.0。验证包仅进入隔离的本机 registry，未发布到外部。所有相关安装根显式设置 `minimumReleaseAge: 0`；不要求依赖发布满 72 小时。

独立严格安装发现 Valtio 1 固定依赖不支持 React 19 的旧订阅库，已升级到官方 Valtio 2.3.2，并移除根及 platform 的订阅库 override。可变对象在赋值边界由状态持有副本，已有 Valtio proxy 及声明为 immutable 的值沿用其契约；对象修改不能污染 props 或重置用的初始值。SDK 联合回归 21 文件 177 项通过，另有服务端代码生成查询 3 文件 45 项通过。

11 个维护中的 CPA 输出以新 SDK 独立安装、生产构建并通过 Chromium 回归，覆盖 JS／TS、Next App／Pages、React/Vite 和 TanStack Router。验证包括零值／false／空字符串、服务端预取后 hydration 零重取、原生 RSC 与 React.cache、动态参数及 SHA-256 查询、客户端跳转和返回；浏览器错误为空。Next App 使用 Next 官方内置的 React 渠道，未添加 React alias 或替换框架内部实现。新 Host SDK 三页面的注册、状态回调及交互回归通过。

React/Vite 两个 Loader fixture 的严格安装、生产构建和 lint 通过；六个 Next fixture 严格安装及独立类型检查通过。WAB 完整非增量类型检查通过，platform peer 审计通过。结果与边界见 [consumer-verification-u14.json](consumer-verification-u14.json)。已有输出回归不代表重新生成 CPA 或完整 CLI／后端协议已经验收；本轮 Studio 制品、维护示例的独立构建、完整 Zustand 迁移及整体性能数据仍需完成。

### 公开包与运行验证补充

全部 19 个安装根均显式设置 `minimumReleaseAge: 0`。14 个公开包修正后独立打包，只发布到任务的本机 registry；消费方使用独立元数据缓存，逐包核对新 tarball 的 SHA-512、锁文件与安装 manifest。已修复 Menu／Chart 的非公开类型路径、Radix 推导声明泄露、公开类型依赖，以及 Commerce 遗漏的 JSON／schema 产物；YouTube 组件包使用官方 10.1.0。

自定义 JSX runtime 公开 React 的 scoped JSX 类型，保留 `0` 等子节点与 key，并且不修改调用方 props；新增 7 项测试通过。完整根 Vitest 95 文件、734 项通过，Studio 完整非增量类型检查退出 0。独立消费项目实际执行全部模块导出，生产构建和 ActionGroup 点击通过；模块加载不代表全部组件交互已经验收。

用户最终确认没有 Chakra 消费项目，要求直接下线。已删除 Chakra 组件包、Canvas 客户端和服务端注册、Loader 依赖、workspace 映射与旧构建产物，发布计划不再包含该包。根和 platform 锁文件均已清除 Chakra 依赖。历史 bundle migration 保留，避免破坏历史数据解析；字体元数据中的同名词与此组件库无关。当前维护范围为 178 个 manifest、131 个直接相关项，公开组件发布计划为 64 个包。退役前的 65 包证据保留原有身份，退役后使用新消费项目重新验收。

退役后根 Vitest 再次通过 95 文件、734 项，画布及 Sub 生产构建、完整 Studio 类型检查和 platform peer 审计通过。9 项真实 IIFE 产物测试，以及 2 文件 39 项运行时加载顺序测试通过。IIFE 首轮发现测试漏加载原生 Antd 运行时，已按生产 `studio-bundles` 的顺序补齐；没有修改生产初始化或放宽功能断言。

退役后的独立消费项目严格安装、生产构建、64 个模块导出执行及 ActionGroup 点击通过，错误数组为空。严格公开声明检查仍有 25 条第三方问题，继续保留失败日志与逐包计数，不通过全局 JSX 补丁、关闭严格检查或扩大 peer 范围关闭此项。

原生 ARM64 renderer 已通过真实 HTTP GET、并发 HTTPS POST、证书校验、正式 hydration 零重取、点击、禁止系统调用与 30 秒超时回收。证书通过独立 CA 信任链装入，未关闭 TLS 验证。对应镜像、构建身份及日志见 `consumer-verification-u14.json` 的 `rendererTls`；该制品不包含后续公开类型和 JSX runtime 修正。

### 完整 Studio 制品 U14

生产构建、资源准备与归档完成。制品 `renderer-react19-sdk3-u14`：源码 `6211fdc0ddcb3b3f729baa102dad29791eaf369403e60ce2de94e7d3fe38644e`，renderer `1b09d01f9ab78bc85d24c6d4442ac0f7e7fb6607caaa45a428a81403760e6138`，852 个本地资源，共 107,753,139 字节，Compiler 关闭。归档包含对应源码差异及全部未跟踪源文件。

普通项目 5 项、复杂画布 8 项原生功能回归通过；两个项目均验证保存重开，普通项目另通过 Preview 业务分页。Docs Codegen／Loader 两种模式验证实际 Monaco、编辑、预览、恢复、持久模型不变及各 50 个依赖模型的 TypeScript worker。两个报告的错误数组均为空。脱敏证据见 [runtime-verification-u14.json](runtime-verification-u14.json)。

这组运行用于功能验收，不能从单次启动数据推出 React 19 的整体性能提升。剩余工作包含核心 Zustand 迁移、第三方声明与维护示例、真实 CLI／后端协议，以及正式性能和内存比较。

### 维护消费者范围

用户确认历史 examples 没有消费者，要求完整退役。已删除该目录中的 34 个独立应用及其依赖、配置和锁文件，清理仓库 lint、贡献指南和入口说明。当前范围快照为 144 个 manifest、98 个直接相关项及 38 个配置文件；SDK、CPA 生成源、11 套生成输出和框架测试 fixture 继续维护。

当前 Admin Templates 的生成器和验收资料迁到 `ai/plasmic/admin-templates/`，目录及 UiConfig 仍只在 `ai/plasmic/references/templates/admin/` 维护。5 个相对文档链接检查通过，10 项模板验证器测试通过；生成器的 6 个模板和 4 个页面输出与原文件一致，证据文件字节保持不变。仓库 lint 配置和迁移后的生成器检查无错误或警告。该迁移不修改已发布模板、项目 UUID 或业务设计。

## U15：Antd 6.7、五组可选集成退役与 ref 清理

React/DOM 19.3.1、Antd 6.7.0。用户确认 Rich Components、Sortable、Quill、Rive、YouTube 均无消费者，已删除五组源码、注册入口、依赖和专属测试；清理独占的 Pro 及旧 Pro Form 替身。历史 bundle migration 版本序列保留。发布计划现有 59 个公共组件包，范围清单为 138 个 manifest、93 个直接相关项和 38 个配置文件。

保留 auth、数据源和表单测试，移除其废弃依赖。数据源夹具使用原生重复内容和已维护的 Antd 按钮，保留原有增删改交互；表单夹具使用维护中的原生 Table，选中行绑定改为实际的 selectedRowKeys。三个夹具通过引用、字段、模型不变量、代码生成及生成代码类型检查。浏览器以真实 SDK／Antd 和隔离 HTTP 数据操作夹具执行查询、新增、图片绑定、编辑、失效刷新和删除，每个写操作恰好一次，错误数组为空；这不代表 PostgreSQL 后端 E2E 已完成。该测试还发现旧夹具将两个弹窗受控 open 写死为 false，已解除该夹具硬编码，让已有状态交互拥有开关值，未更改生产 Modal API。

React 19 callback ref 清理函数原先被 SDK／Studio 合并工具丢弃；3 个新增回归在修改前失败，修复后 SDK 7 项、Studio 2 项通过。合并逻辑统一到 SDK，覆盖混合对象／旧回调／清理回调、ref 替换、稳定身份及 StrictMode 重放。语义依据 [React 官方 ref 文档](https://react.dev/reference/react-dom/components/common#ref-callback)。

Antd 6.7 的分页由内层链接／按钮接收交互；paginatedUrl 保留真实 href/rel，同时组合原 onClick 并阻止业务点击导航，移除妨碍指针操作的 pointer-events。5 项契约测试和 15 项实际 Chromium 模式回归通过。Sub 中已有的跨 iframe ownerDocument DOM 修复随官方 util 1.14.1 原样更新目标版本；不是新增的 React API 替身。

8 组声明构建改用明确的 tsconfig.build.json，指定入口、rootDir 和输出，解决新 TypeScript 对显式文件参数与目录配置、输出根目录的要求；未使用 ignoreConfig。相关 9 个组件构建通过。依据 [TypeScript 6 官方发布说明](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html)。独立消费者发现 Yotpo 使用的 TSDX 会将 lodash 子路径改写成未声明的 lodash-es，源码改用等价的原生 Array.isArray，移除不再使用的 lodash 依赖并重新打包。

当前验证：根 Vitest 95 文件／738 项通过，WAB 定向 82 项通过，QueryBuilder 与保留夹具 25 项通过，完整 WAB 类型检查和 platform peers 检查退出 0；lint 0 错误、12 项已有警告。59 个组件包独立严格 peer 安装、生产构建、全部模块导出实际执行及 ActionGroup 点击通过。skipLibCheck:false 仍有 3 项上游声明错误：@rc-component/image、@vercel/fetch、swell-js；自有包声明错误为 0，未将上游失败记为通过。详细脱敏证据见 [verification-u15.json](verification-u15.json)。此前 25 项公开声明错误的历史报告保留。

本轮尚未完成全量 MobX 替换、最新完整 Studio 制品回归、CLI／真实后端协议及最终性能／内存对照，不能将本阶段报告作为整个升级完成证明。

### U15 完整制品与性能门槛

最新归档为 `renderer-react19-sdk3-u15`，source `a97630a856dd6b31001f5703e0475234d49c3ad09348bfac0c7e95758b39a220`，renderer `9ee36036e5d77191ab34f46d622284b1a342f8e534e96571a0f9856d1dcc7ab5`，Desktop `41f350907824d9a2275ab1dabaedb277a6848f4f5f0571601e0fbdec46fe0167`。837 个文件、105,450,046 字节，Compiler 关闭。Studio 构建和资源准备成功；外层归档脚本最初误读 metadata 的层级而失败，修正为读取 build 对象后独立验证源码、renderer、Desktop 三项身份并完成归档，未把该外层失败写作成功。source patch 和未跟踪源码归档均已保存。

该完整制品的 GP 5 项、复杂画布 8 项及两者保存重开通过；GP 的 Docs Codegen／Loader 均通过实际 Monaco 编辑、预览、恢复、持久模型不变和各 50 个依赖模型校验。错误数组为空，证据见 [runtime-verification-u15.json](runtime-verification-u15.json)。

已在两个项目上分别完成两轮 ABBA：每版本 4 个独立进程，每进程 6 次打开，前 2 次预热、后 4 次计时。对照为 React 18 A0 与当前混合改造制品，不是单独 React 版本、完整 Zustand 或 Compiler 的因果对照。两组使用相同 Desktop shell、项目修订与本地不可变网络夹具；计时未同时开启 CPU trace 或强制 GC。

首画布和全部画板的跨进程中位数在两个项目上均超过既定退化门槛。保留全部样本，具体值见 [performance-u15.json](performance-u15.json)；CPU 归因另轮执行。当前性能验收失败，不能以功能通过或包体变小宣称升级完成／提速。后续须定位并修复，再使用新制品复测。


## U17：Compiler 默认开启与原生 Zustand 所有权

标准构建删除 Compiler 环境开关，保持 target 19、annotation 和 all_errors，实际转换范围扩大到 4 个已审查组件。没有增加 use no memo、React API 模拟或私有 dispatcher 兼容逻辑。草稿异步命令保留错误处理和 finally 清理，独立于编译渲染；内部命令改名为 restoreRemoteVersion，避免被 Compiler 按 use 前缀识别为 Hook，所有调用方及保存冲突测试同步更新。

草稿控制器所有权、账户令牌缓存、字体资源状态改用原生 store；删除 CodeDisplay 已无调用方的 observe 分支。字体模型变化使用已有事务摘要显式同步，等值状态保持引用。21 文件 165 项联合测试、非增量类型检查通过；定向 lint 无错误，3 条既有警告。细节与边界见 [Zustand 迁移记录](zustand-migration.md#默认开启-compiler-与新增原生状态边界u17)。

原工作区尚未合入；420 个旧状态依赖文件仍在迁移范围内，不能宣称 Zustand 已全部替换。性能对比暂停。本批 Compiler 开启的生产制品和原生回归待下文记录。


## U18：评论 Zustand 状态与完整 Studio 回归

评论 API 数据、筛选、弹窗及请求状态改用独立原生 store，移除该模块 MobX 订阅。稳定实体和细粒度 selector 保留未变引用；评论行、画板、作者、表情及徽标按所需项更新。模型事务同步标签与所有权，覆盖删除、变体 selector、撤销和重做。过期分支请求与销毁后的结果不发布。RootComment 与 CommentsDialogs 加入实际 Compiler 转换，当前共 6 个函数；配置始终开启。

11 文件 60 项定向回归通过，非增量类型检查通过。此前完整 Studio 554 文件／4577 项通过，4 项既有跳过；此全量结果属于评论迁移前的冻结源码。完整测试同时修正了 React 19 root／资源提升断言、React Aria 测试模块实例、加载初始化闭包、真实错误反馈夹具及根节点替换后的所有权注册；代码生成快照只更新已审查的样式差异。CMS SQL 集成使用隔离 PostgreSQL，通过真实发布／取消／重开流程，未接入业务数据库。

当前仍有 416 个旧状态依赖文件，未合入原工作区。性能比较暂停；新批次全量回归及原生制品验收继续执行。
