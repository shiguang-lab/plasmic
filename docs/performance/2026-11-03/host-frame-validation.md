# Host 启动与首画板准备优化验证

本轮保留两项改动：TopFrame 弹窗按首次请求加载；画板基础运行时按 Host 是否提供原生 Antd6 决定是否加载备用实现。Dashboard 常驻、Studio 离开即销毁，未增加常驻编辑器进程。脱敏逐组数据见 [测量数据](./host-frame-measurements.json)。

## 瓶颈归因

使用当前安装版的独立 Chromium trace、CPU profile、匹配 source map、资源时序和实际运行时导入链。Profiler 与正式计时分开运行，以下 CPU 绝对数值仅用于归因。

1. **未打开的 TopFrame 弹窗提前导入了编辑器。** DataSourcePicker → DataSourceModal → sidebar-helpers → DefinedIndicator → tpl-tree → view-ops；ShareModal → ShareDialogContent → PermissionsTab → StudioCtx → view-ops；合并和教程也有相同的重依赖链。一个约 539ms 的 Host / 桥接诊断窗口内，同一编辑器公共 chunk 在外层和 Host 内层分别执行约 128ms、94ms。主线程还运行 React、主题样式、布局和桥接，不能把整段算成进程创建或网络等待。
2. **每个画板和隐藏的组件注册 iframe 都执行了未使用的 Antd6 备用实现。** 内置 Host 已有 `__Sub.Antd6`，但基础画板 bundle 仍静态导入 `nativeAntd6`；`??` 分支没有使用备用对象，不会阻止模块初始化。trace 中首画板等待 Host user body 时，隐藏注册 iframe 的两次同步脚本执行各约 36–37ms；画板自己的基础 runtime 另约 35ms。它们共用渲染主线程，会相互阻塞。
3. **精确版本组件库注册和首次真实渲染仍有必要成本。** 注册阶段约 120–135ms，首次 React / 模型求值约 180–210ms。内置 Host 客户端脚本资源时序约 14ms，不能把 100ms 以上的 document / ready 阶段全归为下载。跨域 Resource Timing 的 decodedBodySize 为 0 不代表没有下载。

`scriptExec()` 在目标 Document 中插入并移除同步 inline script；本轮没有将它改为共享跨 iframe 对象或外链脚本。各画板继续使用其 Host 提供的 React，Slate、Element、组件注册与 DOM 初始化仍针对目标 frame；未共享整个 `__CanvasPkgs`。

## 实现与取舍

- `TopFrameDialogs` 仅在弹窗、持续发布或 onboarding tour 被请求时导入完整内容。首次请求后保持挂载，关闭不丢失表单与发布状态；异步加载使用最新 props，取消不会重新打开旧弹窗。原来的弹窗 JSX、原生 Modal、权限、保存及 tour 契约保留。
- `client` 基础画板包从 1,698,467 bytes 降为 236,108 bytes（诊断产物）。内置 Host 直接使用本 frame 的原生 Antd6；没有该实现的自定义 Host 并行下载独立 `antd6-runtime`，执行基础包后初始化，再允许组件注册。按 Document 去重、失败重试、超时取消与导航守卫保留。
- 弹窗延迟加载会把一部分必要编辑器导入从 Host 前置阶段移入 Studio module import。正式合并对照中 Host / 桥接段约 458→312ms，Studio import 约 125→195ms；这些阶段移动不能当成独立、可相加的净收益。
- 分享弹窗独立首次使用探针：首个可见外框约 58→104ms，内容准备约 86→159ms，再次打开约 51→51ms。未产生额外 renderer 错误。离线后端按真实 API 契约为 access-rules 回放空数组；最初错误地回放对象的探针结果已剔除。这里是每个候选一次探针，不能当成分位数。

没有采用预热池、手动 GC 或跨 frame 共享整个运行时。当前明确证据支持先减少重复执行；保留空白 renderer 无法省掉这些实际模块、模型和画板准备工作，完整预热编辑器则会占用退出后需要回收的内存。

## 对照方法与诊断结果

macOS arm64、Electron 44.5.1；同一冻结源树、同一十画板真实模型、精确依赖版本。A 为基线，H 为弹窗延迟加载，F 为备用运行时拆分，C 为合并。每个独立 Electron 进程六次打开，前两次预热，后四次测量。候选筛选顺序 A/H/H/A/F/A/F；正式合并顺序 A/C/C/A，每臂 8 个测量样本。构建、profile、内存采样和正式计时分开。

| 正式诊断指标，中位数 | A | C |
| --- | ---: | ---: |
| 首画板内部揭示 | 1,716ms | 1,592ms |
| 外部轮询观察到就绪 | 1,913ms | 1,770ms |
| 十个画板全部渲染 | 4,498ms | 4,136ms |
| 画板基础运行时执行，各组中位数 | 36–37ms | 7–8ms |

首画板净改善约 124ms / 7.2%。阶段有重叠与移动，不能把 H、F 筛选中的改善相加。首画板内部标记不是 compositor 呈现时间；外部观察通常还包含约 180–200ms 的轮询延迟。两组独立进程、单机离线夹具不构成线上 SLA 或跨机器结论。

## 内存与功能

独立内存轮次：A 六次，C 二十次，100ms 采样 App working-set sum；无调试器、无强制 GC。比较相同前六轮：A 打开期间峰值 1,743MiB，C 1,618MiB；包含截图和返回工作的进程级峰值为 1,934 / 1,810MiB（C 的进程运行二十轮）。采样峰值可能遗漏极短尖峰，working-set sum 也不是进程私有或系统物理内存。

C 的 Dashboard renderer 冷启动 251MiB，第一次返回 252MiB，第六次 198MiB，第二十次 184MiB。第二十次返回整套 App working-set sum 约 869MiB，包含浏览器主进程、GPU、Utility 和独立缩略图进程，不能把 renderer 的 184MiB 当成整套 App 内存。二十次旧编辑器 PID 在返回采样中均消失，之后另用 OS signal 0 检查二十个 PID 均不存在。Dashboard WebContents、PID、搜索条件及页面 token 全程保留。

- 85 项相关 Vitest 通过：运行时初始化/重试/导航、弹窗延迟加载与状态保留、分享与发布、预览、组件库安装升级及保存重开。
- WAB 使用其锁定的 TypeScript 7 工具链完整 noEmit 检查通过；改动 WAB 文件 ESLint 无错误或警告。Canvas 包类型检查通过。
- 五项实际 browser IIFE runtime 检查通过，覆盖内置 Host / 缺少 Antd6 的自定义 Host、两种 JSX runtime、主题、语言包与账号状态切换。
- 复杂模型和 GP 隔离模型均通过实际 DOM 样式、画板位置、重命名、撤销重做、完整客户端保存及重开；复杂模型另通过冷画板选择/样式/撤销恢复，GP 通过 Preview 业务分页和返回。仅保存隔离夹具，不写线上项目。
- 冷画板压力路径有一条既有 `null.valState` 异常：旧生产版同一夹具及本轮候选均记录该错误，最终恢复、DOM、撤销和保存断言通过；没有把它计为零错误。基线和候选的缩略图夹具仍有既有 undefined.map 数据缺失报错，单列统计，没有据此声称缩略图生成测试通过。

## 完整产物复验

`node desktop/scripts/package-local.mjs` 完成 SDK / 组件 / Host / Studio 全构建、五项实际 runtime 验证、资源准备、签名、DMG 与 zip 打包。生产包含独立 `antd6-runtime` 资源，基础包为 235,201 bytes。产品代码与诊断合并候选仅有格式及注释差异；最终资源另做实际回放，不沿用诊断绝对耗时。

旧安装版 renderer 与新生产 renderer 再按 A/C/C/A 独立换序，每进程六次打开、前两次预热，每臂八个测量样本，无调试器或 GC：

| 生产资源指标，中位数 | 旧版 | 新版 |
| --- | ---: | ---: |
| 首画板内部揭示 | 1,819ms | 1,682ms |
| 外部观察首画板就绪 | 2,018ms | 1,870ms |
| 十画板全部渲染 | 4,736ms | 4,281ms |

首画板约快 7.5%，十画板约快 9.6%。生产复验的两个独立候选进程中位数为 1,683 / 1,682ms；基线为 1,813 / 1,820ms。计时轮次无 renderer 错误，返回 Dashboard 的运行时与搜索状态均保留。

生产包又在复杂模型、GP 上通过完整功能、保存和重开；复杂模型的既有冷画板 `null.valState` 错误与旧生产版相同，未隐藏或计为零错误。单独六轮无 GC 内存复验，打开期间采样峰值 1,641MiB，包含截图/返回的整体峰值 1,853MiB；第六次返回 Dashboard renderer 226MiB，六个旧编辑器 PID 均退出，无 renderer 错误。

已安装 `/Applications/Plasmic.app`，版本 0.6.4，构建时间 `2026-11-03T09:47:28.546Z`。安装工具验签并验证运行 App 的 renderer / desktop 哈希：

- rendererHash：`f7bf6e4787a973cc6528592a68be00ae6be02f6856855ea629c6e643b901eb67`
- desktopHash：`8af3fcd201b466eb68da1fefc44afc70be92209b7c0b45165e822b2c5ff9d8b4`
- sourceHash：`ba18d99f3055b499931911ce0098736a25480548dc1f5dbb5a824ab32af1dac5`

旧 App 备份：`~/Library/Caches/Plasmic-local-backups/2026-11-03T09-56-16.810Z/Plasmic.app`。打包完成后仅补充报告和数据，产品源码未改变。

实际安装 App 保留登录，通过原生界面打开 GP 画布、首次打开分享弹窗、原生 Esc 关闭和返回 Dashboard。打开时 changeCounter 为 0，只进行了这些只读界面动作。Dashboard renderer PID 11794 保留，冷启动约 232MiB，返回约 187MiB；编辑器 PID 11857 已退出，未触发 GC。这里是 ps 驻留量采样，不是性能计时或峰值。当前 App 停在正常 Dashboard。


原始 trace、匹配 source map、导入链、冻结源码、各次报告、构建日志及探针保存在 `/tmp/plasmic-host-frame-20261103/`。仓库仅保留脱敏指标与 fixture 的 SHA-256，不包含模型正文、账号或凭据。未部署 NAS、未推送或发布更新，未验证 Windows/Linux 原生行为。

冷恢复回放中单列的 `null.valState` 异常已进一步定位到 Studio 整体卸载时的失效焦点引用；修复与生产回归见 [冷画板卸载修复](./cold-frame-disposal-validation.md)。
