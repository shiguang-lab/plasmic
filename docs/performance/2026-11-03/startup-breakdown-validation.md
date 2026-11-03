# 首画布启动耗时拆分与传输优化

本次只保留预取模型的 Comlink JSON 字符串传输。Dashboard 常驻、Studio 销毁和缓存策略保持原实现；没有编辑器预热池，也没有保留 Markdown 延迟加载候选。逐轮汇总见[脱敏数据](./startup-breakdown-measurements.json)。

## 约两秒包含什么

之前的 `firstCanvasReadyMs` 是外部脚本轮询观察值。正式回放中，轮询通常比 Studio 的 `canvas-revealed` 内部标记晚约 200ms，不能把这部分观察延迟算作应用正在加载。内部标记也不是 compositor 已呈现或真实 OS 输入可用时刻。

下表选取同条件基线 A2 四次暖打开的阶段中位数。阶段按绝对时间边界分段，未把重叠的 route / viewport 或 frame-initialization / first-render 相加。各段中位数之和不保证严格等于总耗时中位数。

| 阶段 | 基线 A2 | 具体工作 |
| --- | ---: | --- |
| 点击到外层入口执行 | 154ms | 新 WebContents 导航、HTML / 资源及入口脚本初始化，无法单独归为进程创建 |
| 外层启动数据就绪 | 91ms | 启动 GET 的离线回放和外层上下文初始化 |
| Host / 桥接到 Studio 导入开始 | 470ms | Host 文档与嵌套应用启动、跨 iframe 连接和上下文准备 |
| Studio 模块导入 | 129ms | 模块执行，包括未使用消息展示时仍执行的全语言高亮初始化 |
| 编辑器初始化 | 403ms | 偏好、模型接收、解包、StudioCtx、初始路由及组件同步；其中模型接收 113ms，解包约数十毫秒 |
| 首画板任务调度与上下文准备 | 403ms | 约 33ms 调度，再约 370ms 加载 Host 文档、等待 user body、注入 runtime 和注册组件库 |
| 首次求值、React 渲染与揭示 | 208ms | 首画板的真实模型求值、DOM / 样式提交及显示门控 |

该运行首画布揭示中位数为 1863ms，外部观察为 2059ms。这里没有一个独占两秒的步骤；空白进程预热不能消除模型交接、解包、组件注册和实际渲染。

独立安装版 trace 和对应 source map 给出两项可归因工作，未将 profiler 时间作为正式 A/B 成绩：

- `project-fetch` 诊断段约 141ms，Comlink 消息处理函数自采样约 125ms；预取已完成的依赖模型仍以大对象图跨 iframe 结构化克隆。
- `studio-module-import` 诊断段约 139ms；Refractor / Prism 全语言注册占有明显 CPU，单个递归处理函数自采样约 56ms，另有注册、类型检查等工作。当前 AI Markdown 静态导入该模块，即使尚未显示 AI 消息也执行。

Host / 桥接段仍是较大的连续阶段；本次没有把它全部归为 JavaScript 解析，也没有测出纯进程创建 / V8 初始化的独立成本。

## 候选对照与选择

macOS arm64、Electron 44.5.1；同一冻结 WAB 源码、匹配 runtime、未改动的十画板真实 fixture 和精确版本依赖。每个独立 Electron 进程打开六次，前两次预热，后四次统计。顺序为 A / T / M / A / T / M / A：A 为基线、T 为模型传输、M 为 Markdown 延迟加载。所有构建和测试串行；正式计时无 debugger、无 trace、无内存轮询或强制 GC。用户留出前台窗口时间。

| 独立运行 | 首画布揭示，中位数 | 外部观察可用，中位数 | 十画板全部渲染，中位数 |
| --- | ---: | ---: | ---: |
| A1 | 2005ms | 2212ms | 5172ms |
| T1 | 1702ms | 1906ms | 4563ms |
| M1 | 1668ms | 1850ms | 4524ms |
| A2 | 1863ms | 2059ms | 4760ms |
| T2 | 1780ms | 1995ms | 4724ms |
| M2 | 1753ms | 1966ms | 4695ms |
| A3 | 2025ms | 2220ms | 5203ms |

基线存在明显运行间漂移，不能将 A1→T1 的全部 302ms 都归因于代码改动。更直接可归因的结果是：A 的模型接收段中位数为 113–139ms，T 为 34–37ms；A2→T2 的整个编辑器初始化段约 403→317ms，首画布约 1863→1780ms。两轮 T 都快于三个基线运行，但独立进程样本较少、未随机化或控制系统缓存，不宣称统计显著性或普遍速度百分比。全部画板耗时也有波动，不承诺固定提速。

**保留 T。** 只将经过项目权限检查、用于首次匹配项目/分支/最新模型的预取响应标记给 Comlink 自定义 transfer handler，在线路上传输 JSON 字符串，接收端还原正常对象。避免大对象图的结构化克隆；不是零拷贝。使用 [Comlink 官方 transfer handler](https://github.com/GoogleChromeLabs/comlink#transfer-handlers-and-event-listeners) 机制，两端注册同一协议。HTTP API、模型结构、依赖读取/摘要校验和后续刷新路径不变。WeakSet 只标记这一个响应，序列化时删除标记，不缓存模型正文或增加后台编辑器。

**不保留 M。** 它确实将 Studio 导入约 127–142ms 降至 29–30ms，但成本转到首次消息显示。原生首次使用探针中，Markdown 首次显示从基线约 104ms 变成 196ms，暖使用约 40 / 38ms。探针包含实际 Markdown、公式、表格和代码高亮的渲染及 16ms 观察，不是纯模块执行时间；每侧一次，不能视作普遍固定差值。候选通过了安全、表格、公式、节点定位、复制、全屏和流式内容探针，但引入异步消息布局；本次选择改动范围更小、保留现有聊天体验的 T。未将此前单进程模式下的 Markdown 内存回退冒充本轮双 View 下的新证据，本轮也未完成 M 的 20 轮内存验收。

## 内存与功能

内存另起进程，不与计时混用。无 debugger 和强制 GC，100ms 采样各进程 working set 总和。基线六轮、T 二十轮；比较相同前六轮的“打开至全部画板采样”峰值，分别约 1791 / 1614MiB，该字段不包含其后的截图和返回。两个进程的整体峰值约 1979 / 1822MiB，但轮数不同，不能据此声称总峰值降低固定比例。RSS / working set 可能重复计算共享页，也不是活动监视器 footprint 或存活 JS 堆。

T 的 20 次返回均要求旧编辑器 PID 消失，Dashboard contents、PID、搜索条件和页面 token 保持不变，全部通过。Dashboard renderer 冷启动约 259MiB，第一轮返回约 180MiB，第六轮约 184MiB，第 20 轮约 190MiB。未观察到原来的 GiB 级编辑器累积；单轮内存对照不能证明所有机器和项目的峰值等价或下降。

- 相关五个前端测试文件 37/37 通过，含真实 MessageChannel / Comlink wire 传输、正常刷新仍使用 RAW wire、启动预取一次性消费、项目/分支匹配及失败重试。
- 完整 `tsc --noEmit --incremental false` 通过。相关 ESLint 无错误，TopFrameCtx 中保留三条既有空函数警告。
- T 在复杂模型与 GP 分别通过编辑、重命名、实际 DOM 样式、画板位置、撤销/重做、完整客户端保存和文档重开；复杂模型另通过冷画板撤销/选择/样式恢复，GP 通过 Preview 业务分页及返回。保存仅由隔离 fixture 确认，不写线上项目。
- 正式七组计时、两组内存和两个候选的首次使用探针均无未处理的测试失败。缩略图 fixture 的既有 undefined.map 问题仍单列，不把它算作缩略图功能通过。

独立构建最初缺少被 gitignore 的生成样式和模型类，补齐冻结源码所需的生成产物后全部候选构建成功。没有改生产依赖或用不完整源码做有效 A/B。

## 最终产物

`node desktop/scripts/package-local.mjs` 已完成完整构建、runtime 验证和本地签名。最终产物与私有候选的差别仅包含导入路径规范化及不进入产品入口的诊断探针。最终 renderer 已另外在复杂模型和 GP 上完成上述全部功能场景，包括完整保存重开、冷恢复和 Preview 分页；未将候选的绝对耗时冒充安装版成绩。

已更新 `/Applications/Plasmic.app`，0.6.4，构建时间 `2026-11-03T08:28:09.080Z`。安装工具验签并核对运行中 App 与 manifest：

- rendererHash：`531d001bb11f5d034fb18397775053313355b3a923d114695b6adc6b49771cc7`
- desktopHash：`8af3fcd201b466eb68da1fefc44afc70be92209b7c0b45165e822b2c5ff9d8b4`
- sourceHash：`061fa5406684fb2ef5b390f80238ebc5d35a15aee8b704c48f4b902d1ccd8edb`

前版 App 备份在 `~/Library/Caches/Plasmic-local-backups/2026-11-03T08-36-05.741Z/Plasmic.app`。打包结束后只补充验收报告，产品源码未改变。

已安装 App 保留登录，完成线上原项目两轮正常打开和返回。Dashboard PID 始终为 76045，编辑器 PID 76126 / 76386 均退出。Dashboard RSS 冷启动约 224.9MiB，两次返回约 197.4 / 179.5MiB；采样为驻留量，未强制 GC，不是峰值或物理内存。第一次返回还包含一个约 156MiB 的预览进程，该进程在第二次进入画布时消失；整套 App 的逐进程采样保留在 JSON 中，未将它混同于 Dashboard renderer。

线上第一次读取 revision 750，第二次为 751，两次本地 changeCounter 都为 0。发现修订变化后，另以只读方式检查服务器日志和修订记录：2026-11-03 16:39–16:40（北京时间）的 751–754 来自另一个账号、User-Agent 为 Plasmic/0.6.0 的客户端，内容包含业务文案及节点增删。审计窗口 16:37–16:43 内，本次 Plasmic/0.6.4 客户端没有项目保存请求。因此线上修订变化有独立来源，没有把“修订始终为 750”作为通过结论。没有回退或覆盖这些业务编辑；模型正文、账号、日志原文仅保存在私有目录，仓库只记录客户端版本及账号是否相同的布尔结果。

App 当前停在正常完整 Dashboard。本轮没有验证 Windows/Linux 原生行为，也没有部署 NAS 或发布在线更新。

原始 trace、source map 归因、冻结源码、各组逐轮报告、测试和构建日志保存在 `/tmp/plasmic-startup-breakdown-20261103/`；fixture 原文继续位于私有目录，仓库只记录脱敏指标。

后续 Host 与首画板阶段的独立归因、生产对照及当前安装版验证见 [Host 与首画板优化](./host-frame-validation.md)。
