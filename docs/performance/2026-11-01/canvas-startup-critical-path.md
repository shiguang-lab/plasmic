# 缓存命中后的画布启动关键路径

实施结果见[语法高亮验收](lazy-renderers-validation.md)：资源复验后仅保留代码展示按需加载，Markdown 拆分未保留。以下为实施前的热点分析，不代表最终收益。

## 结论

当前最明确、可独立实施的优化方向是：把 AI Markdown 渲染及代码展示的语法高亮依赖移出 Studio 首次导入链，按实际展示需求加载。保留 Agent 输入框立即挂载，不等待画布、消息渲染器或高亮模块。保留现有语言覆盖、公式、流式消息、节点引用、复制及主题能力。

不能把 Host 文档阶段全算作网络或 iframe 创建成本，也不能把模型取得阶段全算作后端响应时间。首次渲染包含 React/MobX 求值、编辑器 Fiber/ValNode/DOM 映射及后处理。当前证据不足以安全移除这些工作，或承诺把约两秒等待降至某个固定值。

## 本轮验证与边界

两个真实模型分别在新隔离 Electron profile 中串行打开三次，补采 Chromium trace 和 CPU 样本，检查最后一次暖打开。使用此前功能验收的 `retained-small` 诊断构建，renderer SHA-256 为 `9270d0f34d207503b54e441f62d38b4294dd02f56266ae6942b6b6837c2a9075`。它不是发布版 0.5.33 的线上成绩。AiMarkdown、CodeDisplay、CanvasFrame 和 studio-bundles 四个相关源码与当前工作区逐字节一致。

HTTP/WebSocket 限定于原有离线 fixture；没有访问业务项目、认证或真实保存。每轮三个打开样本均完成，画布 renderer error 为零、被阻断的写请求为零。两轮各有四项既有 Dashboard 缩略图错误，未计作画布错误，未宣称缩略图功能通过。本轮没有修改生产实现，也没有执行新的功能 A/B。

CPU 采样与正常墙钟计时分开解释。开启 trace 会改变耗时；下表只能定位工作所在，不能直接当成线上耗时或可节省时间。调用栈包含递归和嵌套，inclusive 数值不可相加。

## 发现一：首屏导入执行了非首屏必需的语法注册

| 最后一次暖打开的诊断阶段 | GP | 复杂模型 |
| --- | ---: | ---: |
| Studio 模块导入墙钟时间（开启 trace） | 132.0ms | 123.9ms |
| 该阶段主要模块 EvaluateScript 事件 | 121.9ms | 119.2ms |
| Refractor prism-core clone 函数 self CPU 样本 | 57.2ms | 59.4ms |

源映射指向 `refractor/lib/prism-core.js:277`，另有 `prism-react-renderer/prism/index.js` 的语言定义处理。不是等待服务器或正在高亮一段可见代码。

源码路径：

- `AiMarkdown.tsx` 静态导入 XMarkdown 与 Highlighter；依赖的 Highlighter 静态导入 `refractor/all` 和 `react-syntax-highlighter` 的 Prism。
- `AiResponse.tsx`、`AiExecutionProgress.tsx` 静态依赖 AiMarkdown；是否真的渲染消息，不影响模块初始化。
- `CodeDisplay.tsx` 静态导入另一套 `prism-react-renderer`，由 CodePreviewPanel、PlasmicImgModal 等使用。仅把 DocsPortal 延后加载不够。

实施边界：在消息 Markdown 渲染和 CodeDisplay 叶组件建立异步模块边界；审计所有静态入口，避免其他调用方重新把重依赖带回启动 chunk。输入框、会话状态和发送动作继续独立初始化。已有消息需要渲染时立即请求模块；短暂 fallback 的尺寸、滚动和加载失败恢复应有实际检查。不能为减少导入量而删语言或替换现有 Markdown 能力。

验收：生产构建确认首次画布路径不再执行高亮语言注册；两模型 A/B/B/A 无采样计时；单独验证空会话、有历史、首次回复、流式代码块、公式、节点定位、复制、主题，以及代码面板和图片代码弹窗。首次使用消息/代码面板的加载成本也要记录，不能只把等待移到用户操作时而不报告。

## 发现二：模型取得阶段存在显著的跨 frame 处理

补采的模型取得阶段分别为 184.1ms、157.6ms；其中 Comlink 接收处理器 self CPU 样本分别为 156.0ms、137.3ms。API 由离线数据返回，故不能用这两个阶段时长证明接口慢；采样也不能独立证明全部时间都是 structured clone。

模型预取与 Host 启动已经并行。之前的模型传输候选虽有约 0.15 秒量级首画板改善，但快速重开内存峰值门槛未通过，已撤回。此方向属于次级研究项：先归因复制和临时分配，并同步检查连续重开内存；没有通过资源门槛的新方案前，不恢复原型，不跳过鉴权、摘要校验或精确版本选择。

## 发现三：首次渲染是同步 CPU 工作的重要部分

本轮 GP 首次渲染阶段 420.4ms，其中一个来自画布 sub runtime 的 FunctionCall 事件为 364.1ms；复杂模型分别为 176.3ms、141.4ms。React/MobX 求值和 Fiber 提交映射均出现在调用栈中。`renderState.shouldAcceptAsMappedDomNode`、环境比较及对象复制也有 self 样本。

这是热点范围，不是可直接删除的冗余。Fiber/ValNode/DOM 映射负责选择、Slot、重复实例和编辑状态；不能通过跳过映射或提前声明 ready 来缩短指标。此前已保留上下文复制的局部优化；跳过祖先计算样式读取的候选没有稳定整体收益，已经撤回。

可继续验证的方向是同次同步提交内的重复计算去重，必须先取得调用次数及输入相等证据，明确状态与 DOM 变化时的失效边界，再做独立实验。当前尚未确认一个可直接落地的新渲染改动。

## Host 与 loading 条件

CanvasFrame 读取预取的 Host HTML，写入新 Document，等 `readyState === "complete"` 后继续。内置 Host 中配置图片为 `data-src`，实际脚本包含画布 sub runtime。因此没有“明确等待一批无关图片”的证据。Host 文档阶段同时可观察到外层 Studio 的主题、滚动容器、组件注册和 Comlink 处理；它不是 iframe 本身的独占 CPU 计时。

不直接改成 DOMContentLoaded：需要区分内置与自定义 Host 的脚本和 user body 就绪契约，当前未证明提前放行有稳定收益。

整体 loading 等待初始化器结束、目标画板首次渲染及视口准备完成，不等待所有画板。初始化器还等待组件同步；已有无采样暖打开记录里组件同步只有约 3–5ms，两个样本的应用用户初始化为 0ms，不是这组模型的主要瓶颈。启用应用认证的其他项目需要单独计时，不能直接外推。

## 优化顺序

1. 先验证消息 Markdown 与代码展示的异步拆分。这是目前源码和两个模型 CPU 样本共同支持、能保持业务模型与画板隔离的方向。
2. 接着分析首次渲染的重复计算；有实际重复输入证据后再选小范围候选。
3. 模型跨 frame 传输作为有内存风险的次级方向，不能绕过先前的回退证据。

不优先继续增加文件缓存、预热整个隐藏编辑器、增加画板并发或提前解除 loading。当前 NAS 公网和实际用户会话尚未采集线上端到端 trace，不能精确分摊用户观察到的约两秒。
