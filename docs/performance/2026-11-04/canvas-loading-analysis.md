# 0.6.6 画布加载耗时与优化方向

后续实际动画、Studio 导入与 GP 渲染候选的实施和对照结果见 [优化与回归验收](canvas-loading-optimization-validation.md)。

2026-11-04。结论：**先解决加载动画自身的主线程竞争，再优化 Studio 导入、Host 启动和首画板求值。** 当前最大的已验证机会是加载反馈本身；不能把各阶段包含的排队时间当成该模块的纯计算成本。完整逐轮数字见 [脱敏测量](canvas-loading-analysis.json)。本轮只新增分析文档和数据，没有修改产品逻辑。

## 测量对象和边界

- MCP 确认运行客户端为 **0.6.6**，release revision `cc50fd519d0df382f0657afbfe6b977528155898`，rendererHash `c725805d8298e08cbff7b6819304e5e95df5ac069cecb72cd6d04a843b88aae0`。从实际 `/Applications/Plasmic.app/Contents/Resources/app.asar` 提取 renderer，manifest 与 MCP 一致。
- Electron 45.2.1、macOS arm64；GP 单画板、复杂十画板真实项目的既有冻结离线载荷，依赖精确版本保持一致。生产 `StudioWindow` 加诊断 preload，独立 profile，从 Dashboard 卡片进入，返回时销毁旧 Studio，保留 Dashboard。
- 原版和静态 Logo 诊断版，每项目各一个独立进程、六次打开，前两次预热、后四次计时。共 **24 次打开、16 个计时样本**。顺序为 GP 原版、十画板原版、独立 GP trace、GP 静态版、十画板静态版；没有随机化或 ABBA，系统缓存和其它 App 负载未受控，不声明统计显著性或普遍速度比例。
- 正式计时没有 debugger、trace、强制 GC 或定时内存采样。单独的 GP trace 仅用于归因，不进入正式成绩。正常退出时的进程采样及诊断快照发生在就绪之后。
- 不包含线上 HTTP/IAM 延迟、原生草稿桥接、WebSocket 和业务后端；不是线上用户加载 SLO。首画布揭示是 Studio 内部标记，不是 compositor 呈现或 OS 输入响应。外部观察额外包含轮询延迟。
- 四个计时组 renderer error 均为零。每组有 7 次已有缩略图离线 fixture 的 `undefined.map` 错误，单列保留，不作为缩略图功能通过。没有保存线上项目。

## 当前安装版的时间明细

单位 ms，中位数。下表采用相邻绝对时刻分段，各段中位数之和未必等于总时长中位数。

| 顺序与边界 | GP 单画板 | 十画板 |
| --- | ---: | ---: |
| 点击 → 外层入口执行 | 196 | 209 |
| 外层入口 → 启动上下文就绪 | 185 | 221 |
| 上下文就绪 → Host/桥接完成并开始 Studio 导入 | 812 | 976 |
| Studio 模块导入 | 284 | 311 |
| 编辑器初始化 | 666 | 746 |
| 首画板任务调度 | 14 | 39 |
| 首画板上下文准备 | 816 | 881 |
| 首次求值、渲染及揭示门控 | 530 | 307 |
| **首画布揭示** | **3497** | **3715** |
| 外部轮询观察到首画布就绪 | 3673 | 3925 |
| 全部初始画板渲染标记 | 3518 | 6846 |

进一步查看内部阶段：

| 内部阶段 | GP | 十画板 | 解释 |
| --- | ---: | ---: | --- |
| 偏好读取 | 105 | 112 | 包含跨 frame RPC 与主线程排队，不能据此认定 localStorage 读盘慢 |
| 项目响应交接 | 140 | 152 | 已有 JSON 字符串传输；不等于服务端 GET 或纯解析时间 |
| 模型解包 | 69 | 96 | 构建实际模型对象图 |
| 首画板 Host document | 140 | 229 | 包含文档执行、调度及其它 frame 竞争 |
| 等待 Host user body | 95 | 87 | 不能全部算作网络 |
| 基础 runtime | 7 | 9 | 前轮 runtime 拆分已生效，不是当前主要瓶颈 |
| 组件库准备 | 495 | 470 | 包含取源码、RPC、执行/注册和线程竞争 |
| 首次 render 内部段 | 493 | 283 | 与揭示阶段嵌套，不能再次累加 |

暖打开的托管库请求全部命中本地资源缓存，GP 单个库资源处理最大约 5.9ms，十画板最大约 9.8ms。源码仍会在隐藏注册 iframe 和各画板 Document 执行。因此“资源零远程下载”与“注册/初始化免费”是两个问题。

## 已定位：加载动画反过来拖慢加载

安装版 HTML 和 React BrandLoading 都有逐帧 SVG 构造：每条轨迹创建 56 个碎片，每个碎片每帧读取 4 次 `getPointAtLength()`，并重写路径、颜色、透明度。多个加载 surface 与真正的启动工作竞争同一渲染主线程。

独立 trace 的热点直接落在两处动画函数：HTML 的 `animateStartupLogo` 和 `static/js/index~0.24440492.js` 中的轨迹循环。后者 column 334297 附近是 `pieces.forEach` 和 `getPointAtLength`。这次安装包不含匹配 source map，因此使用实际产物位置和函数正文核对，没有借用其它构建的 map。

诊断版只让这两处函数看到 `reducedMotion.matches=true`，保留可见静态 Logo；没有全局模拟 reduced-motion，没有修改其它动画、模型、依赖、队列或 API。诊断资源修改后仍保留原 manifest，**不能视作原 release 的完整性身份或可发布产物**。

| 同条件中位数 | 安装版 | 静态 Logo 诊断版 | 差值 |
| --- | ---: | ---: | ---: |
| GP 首画布揭示 | 3497 | 1920 | -1577 |
| 十画板首画布揭示 | 3715 | 1695 | -2020 |
| 十画板全部渲染 | 6846 | 4454 | -2392 |
| GP 偏好读取 | 105 | 2 | -103 |
| GP 项目交接 | 140 | 38 | -102 |
| GP 组件库准备 | 495 | 125 | -370 |
| 十画板组件库准备 | 470 | 122 | -348 |

这些阶段的共同下降支持主线程竞争的因果判断；差值仍包含顺序及机器负载影响，不能保证每次能节省相同秒数。静态对照只估计消除该动画成本的空间，**不证明有动画的改进实现也能达到相同成绩**。

工作区已有另一组未提交的 BrandLoading 修改，改为少量固定路径、Web Animations 和有限时长的 JS 更新；本轮保留原样。这一方向与热点吻合，但没有构建、测试或验证这组修改，不能将本次静态对照当作它的验收。特别是 SVG `strokeDashoffset` 仍可能触发绘制，使用 Web Animations 并不自动等于合成线程零主线程成本。优先使用可合成的 transform/opacity，实际确认 paint 和 CPU。[浏览器动画性能说明](https://web.dev/articles/animations-and-performance/)

## 去掉动画干扰后，剩余时间在哪里

| 相邻边界分段，ms | GP 静态版 | 十画板静态版 |
| --- | ---: | ---: |
| 点击 → 入口 | 148 | 149 |
| 外层启动 | 102 | 111 |
| Host 与桥接 | 326 | 313 |
| Studio import | 214 | 214 |
| 编辑器初始化 | 317 | 319 |
| 首画板任务调度 | 16 | 41 |
| 首画板上下文准备 | 303 | 320 |
| 首次求值、渲染与揭示 | 483 | 225 |

GP 的真实内容首 render 约 449ms，十画板目标首 render 约 202ms。画板数量不能代表单画板复杂度。十画板在首帧后仍约有 2.76 秒到全部渲染；需要同时优化首帧与后续可交互性，避免通过抢占首帧制造全画布更慢。

## 可实施方向与技术选择

| 优先级 | 方向 | 最小实验与验收 |
| --- | --- | --- |
| P0 | 完成轻量加载动画的实际构建验收 | 同 renderer/fixture 做 ABBA；同时测首画布、全部画板、动画 CPU/paint、长期等待和卸载。当前工作区候选需独立验证 |
| P1 | 收窄 Studio import 的非首帧依赖 | 静态对照仍约 214ms。检查 AI Markdown/Highlighter 等静态导入；按首次展示动态导入，并尝试首画布揭示后、可取消的低优先级预载。需要同时测首次 AI 消息，不能照搬前轮已撤回的简单延迟方案 |
| P1 | 拆开 GP 首次求值/React/样式成本 | 对 evaluator、派生 CSS、React commit、`updateCtxPostChange` 分别计时；先减少重复遍历和布局读写，再考虑并行。现有 frame-first-render 是合并段，不能仅据 449ms 指定某个函数重写 |
| P1 | 缩短 Host 桥接与准备依赖链 | 静态对照约 313–326ms；进一步区分 Host 导航、脚本执行、RPC 往返、React 挂载。只在权限与 Host 信任检查完成后并行不相互依赖的准备，不跨 frame 共享整个 React/runtime |
| P2 | 稳定外链脚本与 V8 编译缓存实验 | 当前 `scriptExec` 同步注入源码。比较精确版本/摘要 URL 的脚本执行，验证 code cache 真正消费；保留账号隔离、顺序、注册完整性、错误重试与 Document 导航守卫。注册仍要逐 Document 执行 |
| P2 | 优化后台画板任务的响应性 | 沿现有串行、目标优先队列评估 `scheduler.postTask` / `scheduler.yield`，只在一致性边界让出主线程。报告输入尾延迟与全部画板时长，不能只宣传首帧 |

新技术的适用边界：

- **Web Animations / CSS 动画：当前最贴合的技术。** 消除每帧路径采样与字符串生成，减少 DOM 写入。动画属性是否触发 paint 要实测；不能仅凭调用 `animate()` 判定已移出主线程。
- **Prioritized Task Scheduling：适合减卡顿。** `scheduler.yield()` 把延续移入后续任务，`postTask` 可标记后台工作；不会减少必要工作量，也不能在 MobX transaction、半完成注册表或同步 React commit 中任意插入 await。项目已有 idle 队列，应沿同一队列改，不增加平行调度系统。[Chrome 官方说明](https://developer.chrome.com/blog/use-scheduler-yield)
- **Worker + Transferable：有条件使用。** 适合纯 JSON/字节处理、纯索引或纯代码生成的独立任务。当前解包只有约 72–79ms，且需恢复模型类、引用身份及 MobX；把普通对象从 Worker 传回再构建一次可能更慢。先测 Worker 启动、编码/拷贝、传输、主线程重建的完整链路。Worker 无法直接操作 DOM，不能直接搬走 React render、组件注册和布局测量。[官方性能说明](https://web.dev/articles/off-main-thread)
- **V8 code cache / 外链脚本：值得定向实验。** 缓存减少解析编译，不省模块执行/注册；inline 源码不能直接套用 HTTP 资源关联的磁盘编译缓存，但同 Isolate 仍可能复用编译结果。旧 `bypassHeatCheck` 已无稳定收益且增加磁盘占用，不重新默认启用。[V8 原理](https://v8.dev/blog/code-caching-for-devs)、[已有本项目对照](../2026-11-03/webcontents-experience-validation.md)
- **React Transition / React Compiler：不作为启动主路线。** 当前 React 18.3.1 + MobX；Transition 不会自动切开同步解包或注册函数。Compiler 主要减少重复渲染，初次执行必要工作仍在；React 官方特别指出 MobX 与 memoization 的兼容性问题。可在纯展示组件做小范围实验，不全局开启。[Transition](https://react.dev/reference/react/startTransition)、[Compiler 兼容性](https://react.dev/reference/eslint-plugin-react-hooks/lints/incompatible-library)
- **React Activity：不用于保留整个编辑器。** 隐藏时仍保留状态并执行较低优先级渲染，且清理 Effects；不能代替跨 WebContents 的销毁/隔离语义。仅在未来 React 升级后评估局部面板；不能以启动为由恢复已撤回的常驻编辑器路线。[React Activity](https://react.dev/reference/react/Activity)
- **content-visibility / containment：限局部只读面板实验。** 适合真正离屏、可独立布局的内容；不能直接施加于编辑画板，几何测量、选择、滚动恢复、fixed/portal、截图都需要真实布局。共享 Scrollbar 继续拥有滚动。[浏览器说明](https://web.dev/articles/content-visibility)
- **WASM / OffscreenCanvas / WebGPU：当前不对应加载热点。** WASM 几何内核已有本项目负结果；DOM/React 页面无法直接改用 OffscreenCanvas。只有将来发现足够重的纯计算或自有栅格辅助层才另开实验。[既有 WASM 对照](../2026-11-03/geometry-query-experiment.md)
- **SSR/RSC、Service Worker、构建工具迁移：本轮不优先。** 本地安装资源已有缓存和 Rsbuild，编辑器关键路径包含可编辑模型与动态组件执行；这些方案需要分别证明能消除当前哪一段，而不是迁移工具后推定会提速。页面模型按需加载、组件库分包注册不作为这轮前提。

## 下一步验收目标

先为工作区轻量动画候选做完整构建与同条件对照，确认接近静态控制组且保留动画效果；再单独实验 Studio 非首帧模块与 GP render 热点。每次同时保留内部揭示、外部观察、全部画板、首次功能使用及内存指标；通过编辑、撤销重做、保存重开、Preview、冷画板恢复后才能把候选作为发布优化。

私有 renderer、模型、trace、日志和诊断脚本保存在 `/tmp/plasmic-loading-20261104/`，仓库只保存脱敏数值。复现使用 `desktop/tests/performance/real-project-open.cjs`，本轮设置 `PERF_OPEN_SESSIONS=1 PERF_NO_DEBUG=1 PERF_OPENS=6 PERF_RETURN_TIMING=1 PERF_RETAIN_DASHBOARD=1`，分别通过 `PERF_BUILD_ROOT` 指定原 release 提取资源和静态诊断资源。未运行产品单元测试或类型检查，因为本轮未改产品源码；已有工作区修改的测试状态未知。
