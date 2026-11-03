# Dashboard / 画布内存修复与验收

当前实现将原生 BrowserWindow 与 Studio WebContentsView 分开。进入项目、离开项目和切换项目时，先保护当前草稿、记录工作区，再关闭旧 WebContents，创建新的 Studio view。同项目的画布和 Preview 路由复用当前 view。登录 Cookie、缓存和草稿保留在现有 Electron session / profile。

## 修复内容

- TopFrame 直接关闭自己拥有的 socket 队列，并按会话隔离迟到调用；清理 locale / appearance / history 订阅和 Comlink proxy。卸载后的反向 RPC 不再承担父页面资源释放。
- Studio 初始化支持加载中卸载；迟到创建的 StudioCtx 会立即释放。Mousetrap reset 后额外解除其注册的原生键盘 listener。
- Desktop 使用可销毁的 StudioWindow owner；原生窗口边界、尺寸、窗口按钮与展示模式继续由 BrowserWindow 管理。替换 renderer 时取消旧 IPC，并让新请求、预览、截图、参考浏览器、登录、升级 UI 和动态岛指向当前 contents。
- 正常跨项目边界由顶层 history.push / replace 委托到受信任 native IPC，在源页面卸载前执行草稿保护。草稿备份失败保留当前编辑器。没有增加产品强制 GC、内存阈值或 reload 回收策略。

根因证据见[分析记录](./dashboard-canvas-memory-analysis.md)。原生工作集的具体 allocator 子系统占比未测出；本次交付依靠已验证的进程退出边界释放这部分资源。

## 隔离验收

Electron 44.5.1，macOS arm64，真实复杂十画板离线 fixture。使用新生产 frontend、生产 StudioWindow owner，从 Dashboard 卡片进入，通过实际品牌返回链接退出。请求全部由私有 fixture 接管，不写线上项目。完整原始文件留在 `/tmp/plasmic-dashboard-memory-20261103/`，仓库只保存[脱敏测量](./dashboard-canvas-memory-fixed.json)。

| 项目 | 结果 |
| --- | --- |
| 冷启动 Dashboard renderer RSS | 252.0 MiB |
| 20 轮画布 renderer RSS | 994.6–1005.7 MiB |
| 20 次返回 Dashboard renderer RSS | 252.8–263.8 MiB |
| 旧编辑器 PID | 每轮退出后均消失 |
| 返回后 Document | 每次均为 1 |
| 强制 GC | 未调用 |
| renderer console error | 0 |

这些是单个 renderer 的 RSS / workingSetSize，不能当作 macOS 活动监视器的 footprint，也不是整套 App 进程之和。画布活动期间仍有约 1 GiB 工作集；本次没有宣称降低复杂画布的运行内存。

另一个纯本地 Electron 页面测试连续销毁 20 次真实进程，并通过草稿失败保留、resize 和原生窗口销毁检查。真实 GP 项目的独立运行通过画板切换、重命名/样式/位置的 undo/redo、Preview 业务分页返回，以及客户端保存后重载（离线 fixture 修订 158→159）；renderer error 为 0。保存结果属于离线 HTTP 接管验收，不是线上服务写入验收。

加载中退出探针已观察到 3 次未完成画板加载时成功退出，旧 PID 消失且返回 1 个 Document；第 4 次探针等待被导航替换的 iframe 评估结果而卡住并人工停止，未把这一整轮五次探针记为通过。

536 项 Desktop Node 单元测试、4 文件 20 项相关 Vitest、WAB typecheck 通过。定向 ESLint 无错误，4 个 no-empty-function 警告（3 处为已结束会话的空订阅 disposer，1 处为 Shell 既有逻辑）。原生登录/取消、五语言切换、窗口按钮与 resize/fullscreen、关闭模式五阶段、动态岛、参考浏览器以及 Preview 超时/恢复测试通过。

离线 Dashboard 缩略图 fixture 仍有既有 `undefined.map` 错误，不计为缩略图功能通过。复杂项目的旧版功能轮已存在 `valState` 空值错误，本次内存循环及 GP 功能轮未出现该错误；未通过吞错或弱化断言处理它。

## 本机安装

本地 0.6.4 构建时间 `2026-11-03T04:08:11.895Z`：

- rendererHash: `84de5af6701c93f187e29550e33181ccb4bd7be744e16737819eb710e716ae91`
- desktopHash: `05cc9c198d861858c828449653428bf8b3a1b82bcee2bc0da54b7e0a7d2b6cdc`

已更新 `/Applications/Plasmic.app`；安装工具验证 Apple Development 签名、bundle 标识，并通过运行中 App RPC 核对两项 hash。旧 App 已备份到 `~/Library/Caches/Plasmic-local-backups/2026-11-03T04-19-56.628Z/Plasmic.app`。

在线原项目本机 UI 验收结果见[原生测量](./dashboard-canvas-memory-native.json)：

| 采样点 | 主 renderer RSS |
| --- | ---: |
| 新 App 冷启动 Dashboard | 243.9 MiB |
| 第一次进入画布 | 1161.2 MiB |
| 第一次返回，约 34 秒后 | 252.0 MiB |
| 第二次进入画布 | 1405.8 MiB |
| 第二次 Preview | 1471.3 MiB |
| 第二次返回，约 45 秒后 | 252.2 MiB |

两次画布 PID 分别为 51682、51750，退出后均已不存在；新会话 ID 不同。原生 Preview UI 与 RPC runtime 状态均正常，退出 Preview 回到编辑器，再返回 Dashboard。登录未丢失，修订始终为 750、changeCounter 为 0。安装前已保存原项目，在线验收没有修改模型。

App 最终停在 Dashboard。该测量针对用户反馈的 renderer；活动画布及 Preview 仍有大工作集，不能把本次修复解释成任意项目的活动内存低于 1 GiB。构建后仅调整性能测试驱动的 iframe 返回链接定位并补充报告，产品源代码和上述产物不变。

后续的焦点修复、启动缓存对照与最新本机产物见 [WebContents 交互验收](./webcontents-experience-validation.md)。
