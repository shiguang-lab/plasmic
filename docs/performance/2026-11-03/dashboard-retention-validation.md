# Dashboard 常驻与 Studio 销毁验收

本地 App 已采用一个常驻 Dashboard WebContentsView，加至多一个临时 Studio WebContentsView。返回 Dashboard 直接显示原页面，保留搜索和列表状态；草稿保护完成后关闭 Studio contents。原生窗口大小同步覆盖两个 View，只有活动 View 挂在可见内容层。当前没有编辑器预热池或多项目后台常驻。

## 生命周期与复用边界

- Dashboard 隐藏时从原生内容层移除，页面设为 inactive / inert，取消属于它的排队及运行中缩略图任务，暂停缩略图订阅。重新激活后恢复订阅，并在保留列表的同时刷新元数据。Dashboard 使用后台节流，Studio 保持原有不节流设置。
- 每次进入项目创建 Studio，退出或切换项目销毁旧 Studio；同项目 Preview 沿用当前编辑器。直接打开项目时，在后台准备一次 Dashboard，避免首次返回重新启动整个应用。
- 草稿、MCP、参考浏览器等修改操作继续只信任活动 contents。隐藏 Dashboard 仅允许启动所需的只读状态访问；账号切换使缓存 Dashboard 失效，避免显示上个账号的数据。
- 窗口导航、恢复和标题监听捕获各自 contents。更新弹窗按 contents 注册并随销毁清理；菜单按当前活动 contents 选择弹窗。后台 View 关闭弹窗时不能抢走编辑器焦点。
- 继续使用当前 Chromium / V8 的默认 code cache 和既有不可变依赖磁盘缓存。此前 bypassHeatCheck 对照没有稳定收益，未修改该策略，也未增加强制 GC。

这是按资源生命周期选择复用边界。[VS Code 的进程复用实践](https://code.visualstudio.com/blogs/2022/11/28/vscode-sandbox)说明复用可减少初始化，但并不意味着应长期保留重型编辑器堆。Electron 要求显式关闭 WebContentsView 的 contents，否则原生窗口关闭后仍可能留存资源，见[官方资源管理说明](https://www.electronjs.org/docs/latest/api/base-window#resource-management)。本实现复用 Dashboard 的页面和运行时，编辑器的释放仍由销毁边界保障，未指定或依赖任意 Chromium PID 复用。

[Figma 的动态页面加载](https://www.figma.com/blog/speeding-up-file-load-times-one-page-at-a-time/)是减少打开项目工作量的参考，不能作为“Figma 使用同样双 View 架构或固定预热池”的证据。本次没有改动模型加载边界；先保留已测得有效的 Dashboard 复用，后续画布按需加载需要单独评估依赖、编辑和保存正确性。

## 返回耗时与进入项目

macOS arm64，Electron 44.5.1，同一个最终 renderer、同一个未修改的十画板复杂 fixture 和不可变依赖。先运行旧 owner 6 轮，再运行常驻 Dashboard owner 20 轮。旧 owner 从前一版已签名 App 提取，其 SHA256 与逐轮结果见[脱敏数据](./dashboard-retention-measurements.json)。正式轮次无 debugger、无 trace、无强制 GC；两组均使用 5ms 卡片轮询，并在每次进出时激活原生测试窗口。

| 指标 | 每次重建 Dashboard，6 轮 | 常驻 Dashboard，前 6 轮 | 常驻 Dashboard，全部 20 轮 |
| --- | ---: | ---: | ---: |
| 返回到项目卡片 DOM，中位数 | 476.1 ms | 21.8 ms | 21.1 ms |
| 返回到 Dashboard 两次 rAF，中位数 | 489.9 ms | 32.4 ms | 32.3 ms |
| 返回到 Dashboard 两次 rAF，P95 | 样本较少，不作比较 | 样本较少，不作比较 | 36.5 ms |
| 进入到首画布可用，中位数 | 2011.8 ms | 1992.2 ms | 另见逐轮数据 |
| 进入到十画板全部渲染，中位数 | 4431.8 ms | 4405.3 ms | 20 轮全部完成 |

返回耗时明显降低；进入画布的两组时间接近，不能把这次改动称为画布加载提速。DOM / 双 rAF 是可复查的代理指标，不是 OS 输入延迟或 compositor 已呈现时间，不能宣称 0ms。离线结果排除真实网络、鉴权、生产草稿备份和业务接口延迟；两组串行，未做随机化或本轮 ABBA，也未控制系统文件缓存，不能推广成线上 SLA。

正式测试前，旧版和新版都出现过全部画板等待超时；另一次返回的双 rAF 未完成。诊断记录显示测试窗口失去焦点，返回后的 Dashboard document 为 hidden。后台 rAF 暂停会使前台耗时测试无效；它不能证明两个 View 的节流设置存在因果故障。Dashboard 节流开/关的独立诊断均完成十画板加载，因此没有据此更改产品节流或画板调度器。用户留出前台测试时间后，正式 6+20 轮全部完成；此前的超时和中止日志保留在私有目录，未计入成功计时。

正式两组 renderer console error 均为 0。缩略图离线 fixture 分别有 7 / 21 次既有 undefined.map 错误，不能将其计为缩略图端到端验收通过；线上完整 Dashboard 的缩略图另作可见性回归。

## 20 轮内存与进程检查

每轮均要求旧编辑器 PID 在返回后采样时消失，Dashboard WebContents、PID、页面 token 和搜索条件保持不变。20 轮全部通过，Dashboard PID 始终为 35970；没有后台编辑器累积。

| 采样点 | Dashboard renderer RSS | App 各进程 working set 总和 |
| --- | ---: | ---: |
| 冷启动 Dashboard | 261.7 MiB | 667.5 MiB |
| 第 1 轮返回 | 184.8 MiB | 757.1 MiB |
| 第 10 轮返回 | 191.2 MiB | 807.4 MiB |
| 第 20 轮返回 | 193.2 MiB | 846.2 MiB |

20 次返回的 Dashboard renderer RSS 范围为 184.8–198.5 MiB。第 1 轮画布编辑器为 947.7 MiB，同时保留的 Dashboard 为 168.7 MiB；常驻 Dashboard 会增加编辑期间的驻留成本，这是返回速度的代价。

App 总和包含主进程、GPU、Utility 和缩略图 worker，仍有波动及增长；最后一轮包含约 159.6 MiB 的缩略图进程，主进程从冷启动 258.0 到 317.1 MiB，GPU 从 100.4 到 133.7 MiB。因此这里只确认编辑器释放及 Dashboard 无 GiB 级累积，不宣称整套 App 恒定 200MiB 或所有内存 100% 回收。RSS / working set 也不是活动监视器 footprint 或系统实际物理内存，可能重复计数共享页，不能将较低驻留值解释为存活 JS 堆减少。

## 验证、安装与真实项目回归

- Desktop Node：`node --test desktop/tests/*.test.cjs`，548/548 通过。
- 前端 Desktop navigation、ProjectPreview、preview client：3 个文件，18/18 测试通过；WAB typecheck 和相关 ESLint 通过。
- `studio-window-native.cjs`：20 轮真实 renderer 退出、草稿失败保留、窗口 resize / 销毁通过。
- `update-dialog-focus-native.cjs`：两个 contents 的按钮 / Escape、精确 frame 焦点恢复和 listener 清理通过。参考浏览器原生脚本通过；驱动修正为先激活窗口，再传真实屏幕坐标，没有改产品拖拽逻辑。
- 生产 main/menu/preload 的隔离 GP fixture：真实 Cmd+Z 17→0，Shift+Cmd+Z 后回到 17，Cmd+S 完整保存到 revision 159；返回原 Dashboard，GP 搜索仍保留。该轮不写线上模型。
- `node desktop/scripts/package-local.mjs` 构建、签名完成；安装工具验签并核对运行中 App 的 rendererHash / desktopHash。

安装位置 `/Applications/Plasmic.app`，0.6.4，构建时间 `2026-11-03T07:02:15.644Z`：

- rendererHash：`5fa190c6ba7ff38775e9c18886e6f721d3ed212fbe0e6e91ed7d747f32439542`
- desktopHash：`8af3fcd201b466eb68da1fefc44afc70be92209b7c0b45165e822b2c5ff9d8b4`
- sourceHash：`47601b839ad133f975ee550accd953e61c91ab00f9dea24719693ed8d854a673`

构建完成后只修改测试驱动及验收报告，产品代码未改变。前一版 App 备份在 `~/Library/Caches/Plasmic-local-backups/2026-11-03T07-33-20.299Z/Plasmic.app`。

已安装 App 使用保留的登录完成线上原项目两轮进出，两轮 session 不同，revision 均为 750、changeCounter 均为 0。Dashboard PID 始终为 35735，编辑器 PID 36205 / 36784 均退出；搜索“用户信息”两轮保留。Studio 和复用 Dashboard 的更新弹窗均通过真实原生 Escape 关闭。

| 已安装 App 采样点 | Dashboard RSS | 活动编辑器 RSS | App RSS 总和 |
| --- | ---: | ---: | ---: |
| 冷启动 Dashboard | 210.0 MiB | — | 792.4 MiB |
| 第一轮画布 | 159.2 MiB | 1110.8 MiB | 1823.9 MiB |
| 第一轮返回 | 156.5 MiB | 已退出 | 672.1 MiB |
| 第二轮画布 | 172.9 MiB | 1215.4 MiB | 1957.7 MiB |
| 第二轮返回 | 161.5 MiB | 已退出 | 709.2 MiB |

这是无强制 GC 的驻留采样，不是峰值。测试搜索已清除，App 停在正常完整 Dashboard。未验证 Windows/Linux 的原生窗口行为，也未重跑此前未整体通过的宽范围 `updates-native.cjs`；不能将独立弹窗测试替代整套更新测试。

打包前曾发现根 package.json 被工作区另一份 Pen 清单替换，已将异常文件保存在私有目录，并恢复本任务开始时未修改的 Plasmic 清单；`pnpm install --frozen-lockfile` 后重新构建成功，没有改锁文件或回退其他工作区修改。原始报告、安装日志、前台计时失败记录保存在 `/tmp/plasmic-webcontents-experience-20261103/` 和 `/tmp/plasmic-dashboard-memory-20261103/`。
