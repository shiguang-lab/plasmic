# 从项目列表打开真实项目的等待分析

缓存有效，但缓存后的模型交接、Host 启动、每个画板的组件注册和渲染仍然执行。多画板还有逐个加载的队列。因此“库资源全命中”不等于“编辑器立即可用”。本次没有修改产品加载行为或发布 App。

原始结果、完整阶段时间和资源命中统计见 [JSON](/Users/yanxianliang/shiguang/plasmic/docs/performance/2026-11-01/project-list-open.json)，复测入口为 [real-project-open.cjs](/Users/yanxianliang/shiguang/plasmic/desktop/tests/performance/real-project-open.cjs)。

**测试范围必须区分。**

- 在正常登录的真实 App 中，通过项目列表实际打开「客服平台 · GP评论查询」和「Admin Templates」，核验业务画布、图层交互和多画板按需渲染。
- 以下精确耗时来自隔离 Electron 中的真实内容回放：使用已安装 App 0.5.30 的原始 renderer，SHA-256 `756dad50e884bd24477b4c2c807d2fa54af4165b1c442032611558147e2ef9b2`，机器为 Apple M4。通过真实项目卡片的点击处理器进入，使用 history 返回列表，未用整页 reload 代替。
- GP 使用真实保存修订 158：1,407 个主模型对象，5 个精确依赖；连同依赖共 22,883 个模型对象。
- 复杂样本使用 Admin Templates 3.0.0 的真实发布 Site：4,644 个主模型对象、13 个组件、22 个画板，当前总览组为 10 个画板。只解开发布包的 ProjectDependency 外壳，Site 内容不变。接口外壳为诊断数据，修订 0 是占位值；**不能冒充线上项目修订 113 的完整响应录制**。
- API 即时返回本地数据，库资源经过实际 Desktop 文件缓存及摘要校验。没有线上接口、登录恢复、WebSocket、原生草稿桥和正常 App 保存相机的耗时。回放采用全览相机。**这些结果不是线上端到端成绩，也不是 Intel Mac 成绩。**
- 每组为首次打开一次、暖重开三次，两个样本顺序运行；正式计时批次未开启 CPU profiler。浏览器 UA 试跑、并发试跑均不用于下表；额外 CPU trace 单独用于定位。

**暖缓存结果**（点击为零点；单位秒）：

| 内容 | 首画板 reveal 标记，中位数（范围） | 初始画板全部 rendered 标记，中位数（范围） | 每次资源访问 |
| --- | --- | --- | --- |
| GP 评论查询，1 个画板 | 1.674（1.605–1.791） | 1.703（1.630–1.821） | 18 hit，0 miss |
| Admin Templates 发布 Site，总览 10 个画板 | 1.574（1.488–1.783） | 4.555（4.488–5.198） | 53 hit，0 miss |

GP 的 18 次包括 5 个项目依赖模型、12 次库代码读取和稍后加载的 Plume 模型。模板的 53 次包括 4 个依赖模型、48 次库代码读取和 Plume 模型。同一库可被不同画板请求；这些不是 53 个不同下载文件，也不是 53 次实际公网下载。代表样本的单次缓存处理最大耗时分别为 19.72ms / 12.42ms，不能把并行读取的耗时相加。

首次打开仍是本地 API 回放、不能视为真实冷启动：GP reveal 2.261 秒；模板 reveal 2.060 秒、全部画板 rendered 6.120 秒。

`reveal` 是程序的显示标记，`rendered` 也是内部阶段标记，均不等于屏幕已经呈现或首次输入一定立即响应。检测到 activeCanvasReady 和 initialViewportReady 的轮询中位数分别为 1.907 秒 / 1.803 秒，它们只是带轮询及调度开销的上界。本次没有伪称获得精确的“可操作瞬间”。

**复杂样本的实际时间排列。** 以下为第二次暖重开的单个样本，不是把各阶段中位数拼接成的虚拟时间线：

| 点击后的时间 | 发生的工作 |
| --- | --- |
| 0.030s | 项目元信息、权限和可信 Host 列表并行请求 |
| 0.052s | 项目模型 GET 开始；随后读取精确依赖，与 Host 启动重叠 |
| 0.376–0.509s | Host 内的 Studio 模块导入 |
| 0.540–0.662s | Host 等待 getSiteInfo 结果；含跨 frame 交接，并非等价的 HTTP 耗时 |
| 0.662–0.759s | 模型 unbundle，构建编辑器对象图 |
| 0.775–0.962s | Studio 上下文、初始路由、注册表及初始化收尾；内部阶段有重叠 |
| 1.008s | 第一个画板开始加载 |
| 1.034–1.195s | 第一个画板的 Host 文档阶段 |
| 1.207–1.235s | 第一个画板 runtime 阶段 |
| 1.235–1.311s | 第一个画板组件包阶段 |
| 1.322–1.546s | 第一个画板首次渲染 |
| 1.574s | 首画板 reveal 标记 |
| 1.805s | 第二个画板开始加载 |
| 2.191 / 2.429 / 2.692s | 第三、四、五个画板开始加载 |
| 3.006 / 3.315 / 3.735s | 第六、七、八个画板开始加载 |
| 4.087 / 4.292s | 第九、十个画板开始加载 |
| 4.488s | 十个画板全部达到 rendered 标记 |

首画板 ready 检测时只有 1 个 ViewCtx、1 个已渲染画板；总览完整结果为 10 个 ViewCtx。后续约 3 秒来自逐步初始化、渲染和调度，不是继续等待没有命中的依赖文件。

**源码与 trace 对应的解释。**

1. [项目卡片](/Users/yanxianliang/shiguang/plasmic/platform/wab/src/wab/client/components/ProjectListItem.tsx:205) 只执行路由跳转，没有等待缩略图生成。[StudioFrame](/Users/yanxianliang/shiguang/plasmic/platform/wab/src/wab/client/components/studio/studio-frame.tsx:140) 先读取元信息和可信 Host；然后 [TopFrameCtxProvider](/Users/yanxianliang/shiguang/plasmic/platform/wab/src/wab/client/frame-ctx/top-frame-ctx.tsx:63) 并行预取模型和启动 Host。列表打开与初始整页项目启动的路径不同。
2. 缓存保存不可变库资源的字节。[模型补齐](/Users/yanxianliang/shiguang/plasmic/platform/wab/src/wab/shared/SharedApi.ts:399) 之后仍要交给 Host、unbundle；[runtime](/Users/yanxianliang/shiguang/plasmic/platform/wab/src/wab/client/components/studio/studio-bundles.ts:80) 和注册表属于各自 Document。重新打开项目会建立新的编辑环境，磁盘命中不会保留旧 iframe 的 JS 堆或已渲染页面。
3. 单独的 GP CPU trace 中，Comlink 接收消息任务持续约 140ms，其中约 131ms 的 CPU 样本位于接收处理器；首轮渲染任务约 301ms。trace 能定位批量消息处理，尚不能独立证明其中每一毫秒都是 structured clone，更不能承诺完整节省 140ms。
4. 同一 trace 在 1.480 秒记录 reveal，之后还有约 120ms 的渲染任务；第一次后续顶层 Paint 在 1.629 秒。过早把 reveal 当作用户已看到页面，会低估体感等待。
5. [画板队列](/Users/yanxianliang/shiguang/plasmic/platform/wab/src/wab/client/studio-ctx/StudioCtx.tsx:8531) 优先目标画板，其余工作通过 idle callback 调度，并发数为 1。把并发改大不代表 CPU 能并行，可能增加主线程争抢与内存；本次没有把并发数本身判定为 bug。

**真实 App 的功能核验。** GP 从列表打开后业务表格存在，图层面板正常展开。Admin Templates 修订 113 的当前组有 10 个画板，在原相机下 6 个视口外画板仍显示加载；执行“缩放以显示全部”后加载数为 0。这证明该现象至少包含按需渲染，不能直接判定为卡死。测试结束恢复相机 scale=0.3226、scroll=(1327,665)，读回一致；项目修订仍为 113，changeCounter=0。

**后续优化的判定边界。** 优先验证同次打开的大对象跨 frame 传输，以及画板初始化、首次渲染和 idle 调度的具体开销。保持各 Document 的正确注册、鉴权、保存、编辑和重试语义后，必须做真实内容 A/B 才能定性为可修复问题并报告收益。当前证据不支持删掉权限/版本读取、共享不同画板的业务状态、取消隔离或简单提高队列并发。首画板等待与全览剩余画板等待应分别验收。

**额外限制。** 原生 Dashboard 预览进程在两个回放中均返回 `Cannot read properties of undefined (reading 'map')`；完整记录保留于 JSON。回放提供了实际的 modelResourceId 依赖引用，而当前预览 prepare 直接 unbundle、未补齐引用。这里没有把响应改成内联模型来掩盖错误，也没有把缩略图生成宣称为通过；正常 App 的真实缓存未清空，因此线上缩略图 cache miss 情况尚未验证，该项不计入已确认的画布等待根因。项目编辑器自身的 8 次打开均完成，库资源无缺失、内容 changeCounter 均为 0。

实际执行了 `node --check desktop/tests/performance/real-project-open.cjs`，以及该入口对两个私有数据目录分别运行 `final` 模式。原始模型、账号数据和 trace 保留在私有临时目录；报告仅保存摘要和时间数据。前述后台资源修复与本次前台启动路径不是同一项收益，当前已安装 App 仍为 0.5.30。
