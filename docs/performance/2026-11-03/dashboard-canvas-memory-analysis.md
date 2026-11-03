# Dashboard / 画布往返内存分析

日期：2026-11-03。本文记录修复前的分析与隔离诊断。当前实现和已安装 App 的验收结果见[修复报告](./dashboard-canvas-memory-fix.md)。分析阶段没有修改线上服务或用户模型。

## 结论

已确认的主要问题是 **父页面持有的 WebSocket 拉取队列在离开编辑器时没有关闭，跨 iframe RPC 的异步清理消息丢失，导致上一套编辑器执行环境继续存活**。此外，同一个 renderer 曾经分配的工作集不会随着 JS 对象回收立刻恢复到启动水平。这两者共同解释“返回 Dashboard 仍接近 1GB，再进画布峰值更高”的现象。

在本次复杂十画板样本中，第一次、第三次退出并诊断 GC 后的 JS 堆分别为 221.5 / 223.1MiB。证据支持“上一套编辑器被保留 + 多轮临时分配未及时回收”，不支持“每打开一次就永久再泄漏完整一套编辑器”的判断。其他项目或更长时间的趋势仍须另测。

## 方法与边界

- 从本机 `/Applications/Plasmic.app` 只读提取实际 0.6.4 renderer。构建时间 `2026-11-03T02:33:00.786Z`；renderer hash `962f0825582e0aa263a3bd0df9980399a7b6df63331eb7064d3eadde568809db`。编译产物包含 `dispose:async`、`Failed to dispose studioCtx`、`pagehide` / `unload` 清理，确认测到的是包含本轮清理的安装资源。
- Electron 44.5.1，独立诊断 profile；复用既有真实复杂项目离线 fixture，十个初始画板。通过原生 Dashboard 项目卡片进入，再通过 history.back 返回。画布就绪后等待所有初始画板渲染。
- 所有 HTTP(S) 请求由离线 fixture 接管，WebSocket 阻断，不访问或写入用户项目。运行当前 Desktop asset-handler / dashboard-preview。不是原有用户进程的在线堆采样，也不能逐 MB 对应用户截图。
- 使用 Runtime.getHeapUsage、Memory.getDOMCounters、app.getAppMetrics；另取退出后的主 renderer 堆快照。工作集为特定主 renderer 的 workingSetSize，不是所有进程之和，不等同于 macOS 活动监视器的内存列。JS heap、backing storage 和 native memory 口径不混加。
- GC 仅为诊断变量，未添加到产品。快照与采样、代码和原始日志保存在本机 `/tmp/plasmic-dashboard-memory-20261103/`；不提交用户模型或快照正文。
- Dashboard 缩略图 fixture 沿用既有 `undefined.map` 失败；未把缩略图功能宣称为通过。重建窗口对照未重绑缩略图 trustedSender，出现预期 sender 拒绝；不影响其 Dashboard 加载和 renderer PID / 堆测量，但该对照不是完整 Desktop 功能验收。

## 复现结果

首次三次往返，单位 MiB；“自然”表示该点未主动 GC，但第一次退出后做过诊断 GC：

| 采样点 | JS used heap | 主 renderer 工作集 | Document 数 |
| --- | ---: | ---: | ---: |
| 初始 Dashboard，GC 后 | 25.6 | 225.7 | 1 |
| 第一次画布，自然 | 343.8 | 947.9 | 33 |
| 第一次返回，自然 | 351.4 | 963.8 | 33 |
| 第一次返回，GC 后 | 221.5 | 729.9 | 17 |
| 第二次画布，自然 | 681.9 | 1454.1 | 63 |
| 第二次返回，自然 | 687.9 | 1471.8 | 63 |
| 第三次画布，自然 | 762.6 | 1793.8 | 87 |
| 第三次返回，自然 | 769.5 | 1745.6 | 87 |
| 第三次返回，GC 后 | 223.1 | 923.5 | 17 |

Document 计数包含引擎中仍存活的文档，不等于当前 DOM 中 iframe 个数。返回后主 WebFrame 树只有 Dashboard，但 GC 后仍有 17 个 Document。

## 根因与因果验证

堆快照中的一条有效强保留路径（排除 weak edge 和 WeakMap 的条件 ephemeron shortcut）：

```
主页面 Window
  → gAppCtx.api
  → queue
  → waitingResolvers[0]
  → Promise / PromiseReaction
  → Comlink 请求处理闭包
  → windowEndpoint.postMessage 闭包
  → 旧 Host Window
  → studioCtx
```

快照中仍有一个包含 `canvasLoadingDisposed` 属性的 StudioCtx，且该属性已为 true。这说明 dispose 已执行，并不意味着执行环境已经失去所有根引用。旧 Window 还持有运行时代码、模型、样式和画板环境。

相关源码：

- `platform/wab/src/wab/client/api.ts:214`：父页面 Api 持有 socket 和 PushPullQueue。
- `api.ts:226`：listenSocket 返回 queue.pull()；队列无事件时保存 Promise resolver。
- `platform/wab/src/wab/commons/asyncutil.ts:21`：close() 才会唤醒等待者并清空 waitingResolvers。
- `platform/wab/src/wab/client/studio-ctx/StudioCtx.tsx:5360`：Host 通过 Comlink 等待 api.listenSocket。
- `StudioCtx.tsx:2080`：dispose 用 spawn 发起 stopListening；不等待其完成。
- `StudioCtx.tsx:5370`：stopListening 再跨 frame 调父页面 closeSocket。
- `platform/wab/src/wab/client/frame-ctx/top-frame-ctx.tsx:194`：卸载时移除 Comlink expose 的 message listener，没有直接关闭其所拥有的父页面 socket。

第二轮增加诊断计数：监听到四条 closeSocket RPC 请求，但真实 closeSocket 方法仅执行两次，均在进入画布时。两次返回 Dashboard 时都有 closeSocket 请求到达父窗口，但未调用真实方法。退出后 queue.waitingResolvers.length 仍为 1。该结果直接证实卸载后的跨 frame 清理消息没有完成，而不是只凭静态代码推断。

在 Dashboard 直接调用父页面自己的 `gAppCtx.api.closeSocket()`，不走已经拆除的 bridge，再进行同样诊断 GC：

| 对照步骤 | JS heap MiB | 主 renderer 工作集 MiB | Document 数 |
| --- | ---: | ---: | ---: |
| 两次往返，退出后 GC | 221.1 | 836.7 | 17 |
| 父页面直接 closeSocket，再 GC | 30.5 | 500.2 | 2 |
| 再清导航历史，再 GC | 30.5 | 499.9 | 2 |
| 重新加载 Dashboard，再 GC | 25.7 | 486.8 | 2 |
| 新建 Dashboard renderer，销毁旧的，再 GC | 25.6 | 224.2 | 1 |

最后一步确认 PID 从 84297 切换为 84330，旧 PID 不再出现在 App metrics 中。第二次同样的 socket 诊断对照再次得到约 222.0→30.5MiB、17→2 个 Document，复现因果关系。

结论：这条 socket 队列根引用解释本样本中约 191MiB 的退出后 JS 存活堆；不是对象本身只占用 191MiB，也不是所有 native 内存均由这条路径唯一支配。直接 closeSocket 后剩余工作集约 500MiB，reload 后仍约 487MiB；具体 native / allocator 子系统分布未测出。只有销毁旧 renderer 的对照恢复到约 224MiB，因此不能承诺仅修清理函数就让活动监视器回到 200MB。

## 对既有清理改动的评估

方向有作用，但没有建立可靠的生命周期边界：

1. `TopFrameChrome.tsx:174` 在 React passive effect cleanup 才发 dispose RPC；同次卸载移除 iframe 和 bridge，不保证请求/回复仍能完成。
2. `TopFrameObserver.tsx:99` 的 async dispose 调用的是不等待 stopListening 完成的 StudioCtx.dispose，因此即使收到 dispose 返回，也不代表父页面队列已关闭。
3. `StudioInitializer` 的 pagehide / unload 可以触发本地 dispose，但异步跨 frame 请求不能靠 unload 保证完成；缺少初始化取消检查，离开时仍未完成的 init 也需要处理。
4. `StudioFrame.tsx:77` 在 passive cleanup 才读取 iframeRef；DOM 卸载时 ref 通常已经清空。即使设为 about:blank，也不能清掉父页面持有的 resolver 和 Comlink 闭包。
5. 注册位置、语言、AI session 等订阅的释放值得保留，但不能代替队列关闭和 MessagePort 的主动释放。目前桥接代码没有在会话结束时显式使用 Comlink.releaseProxy。
6. Host API dispose 与 Initializer cleanup 均可能执行 StudioCtx.dispose；需要单一所有者和幂等保证，不能把多个入口等同于可靠性。

## 建议方案

### 首先修复已证实的生命周期缺口

把“退出编辑器”定义为一个有顺序的会话结束操作：

1. 走现有保存 / 草稿保障，结束正在执行的编辑任务；保留用户取消离开的能力。
2. 父页面在 bridge 仍存活时协调 Host 停止 socket 拉取循环、卸载 React 树及清理 Studio / Preview；等待必要的清理完成。正常退出不依赖 unload。
3. **父页面直接关闭自己拥有的 socket / queue**，作为确定的会话释放路径；不能把这一责任交给即将销毁的 iframe 反向 RPC。需要隔离会话身份，防止旧会话的迟到清理关闭新会话 socket；不必新增一套通用资源框架。
4. 注销跨 frame 订阅，主动释放拥有的 Comlink proxies / MessagePorts，最后拆除 message listener 和 iframe。增加初始化取消检查及幂等清理，覆盖加载中离开、异常退出和快速切换。
5. 避免 top-level cleanup 重复调用独立 StudioCtx.dispose，保留一个协调出口。清理现有 dispose/blank/unload 补丁中变得冗余的实现。

这是最小、直接、已有因果证据的第一步。它必须先做，不能用内存压力触发 GC 代替。

### Desktop 的回收边界

如果产品要求“退出画布，Dashboard 进程内存可靠接近启动水平”，应让编辑器使用独立、可销毁的 WebContents，并在安全离开后销毁它。Dashboard / 轻量桌面外壳可以常驻，编辑器通过 WebContentsView 等原生容器挂载。不是每个画板都创建独立 Electron 窗口。

- 同一个 BrowserWindow 中做 SPA 路由切换只移除 UI；reload 可释放文档堆，但本次实测没有恢复 renderer 的启动工作集。
- 只替换普通 iframe 不构成可靠的进程回收边界；本样本所有十个画板和主页面处于同一个 renderer processId。
- 不能只因 URL 不同就假设已有进程隔离；须记录 PID，并确认销毁后旧进程退出。
- 原型对照使用新 BrowserWindow 仅用于验证进程边界的作用，不能直接当成可发布实现。正式实现须复用现有 Desktop shell，核对 controller/preload IPC 的 sender、MCP 会话、draft、workspace、登录、岛屿及 preview 的窗口绑定，先完成保存再切换和销毁。
- 若父页面直接关闭队列后的真实设备内存已满足预算，可以只交付第一步，不必立即承担 WebContents 拆分成本。本次不能用未知收益承诺主动画布从 1.2GB 降到某个数字。

推荐先合入生命周期修复并跑长循环；需要稳定退出到约 200MB 的 Desktop 目标时，再交付独立 WebContents 边界。二者解决不同问题，替换 Electron、减撤销步数、定时强制 GC 或隐藏保活编辑器都不针对本次根因。

## 修复验收条件

- 同项目至少 20 次往返，另测不同项目切换、画布未加载完就离开、编辑后离开和取消离开。
- 每次退出后父页面无旧会话 socket listener、队列等待者或持有 Host 的 RPC；旧 StudioCtx / Site / Window 无可达强引用。观察 GC 后 heap 和 Document 稳态，不能只比较活动监视器截图。
- GC 仅在诊断轮做；正式体验轮记录自然峰值、返回后 1/5/30 秒内存和交互延迟。至少多组独立进程复测，分开看 renderer private memory、工作集和 GPU。
- 独立 WebContents 版本确认旧 PID 退出；新 Dashboard 稳态接近自身冷启动范围。不能给所有项目统一承诺 200MB。
- 编辑、undo/redo、保存、草稿恢复、Preview、MCP、登录和导航功能继续有效。当前隔离原型没有完成这些改造后的功能验收，因此本报告不宣称修复已经交付。

参考：[Electron process memory](https://www.electronjs.org/docs/latest/api/process)、[Chrome memory problems](https://developer.chrome.com/docs/devtools/memory-problems)、[Detached window memory leaks](https://web.dev/articles/detached-window-memory-leaks)。
