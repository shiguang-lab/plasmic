# WebContents 交互与启动验收

常驻 Dashboard 的后续实现、最终安装和前台返回计时见 [Dashboard 复用验收](./dashboard-retention-validation.md)。下文保留对应构建的测量范围。

当前实现保持一个活动 Studio view；退出或切换项目时销毁旧 view，同项目 Preview 复用。Dashboard 弹窗不跨原生 view 覆盖，升级弹窗属于当前 Studio contents。没有引入预热池、多项目后台进程或全局按键转发器。

## 弹窗焦点修复

原生实测发现：升级 HTML dialog 关闭时，浏览器只恢复到外层 Host iframe，Studio 的内层编辑器 iframe 没有恢复焦点。即使窗口和 WebContents 都显示 focused，实际 Cmd+Z 仍无法撤销。离线 GP 项目中，画板 left 从 0 改为 17，关闭弹窗后 Cmd+Z 保持 17；修复后回到 0。

`createUpdateDialog` 在首次打开时捕获精确 focusedFrame，收到当前 contents 主 frame 的 close IPC 后恢复它。重复打开保留原始焦点；窗口不活跃、frame 已分离或已不属于当前 contents 时不抢焦点；contents 销毁时解除监听。renderer 使用 dialog 的 close 事件统一通知主进程。

单元测试覆盖可信 sender、重复打开、后台窗口、失效 frame 和销毁清理。原生跨域双层 iframe 测试验证两个 renderer 中按钮和真实 Electron Escape 输入的关闭、焦点恢复，以及监听器从 1 回到 0。

在线手动验收确认另一处 Esc 问题：`TopFrameChrome.ForwardShortcuts` 在页面 body 绑定 Studio 快捷键，Esc 会被 Mousetrap preventDefault 后转发到画布。升级弹窗位于顶层 Shadow DOM，键盘事件仍可冒泡到 body，使浏览器原生 dialog 的 Esc 取消失效。弹窗现在隔离 keydown / keypress / keyup 的冒泡，保留默认行为和安装期间的 cancel 保护；没有新增全局按键路由。新增 JSDOM 测试验证底层处理器收不到事件、defaultPrevented 保持 false。原生 fixture 加入与 Studio 等价的 body Esc 取消处理器：修复前在 Escape 关闭断言超时，修复后两个 renderer 的按钮 / Escape 四种情况均通过，底层 Esc 处理器调用为 0。

## 原生键盘与交互

macOS arm64，Electron 44.5.1，生产 Desktop main/menu/preload/controller，独立 profile 和真实 GP 项目离线 fixture。网络保存接管到隔离 HTTP fixture，不写线上项目。真实 OS 按键由本机 UI 驱动发送；设置测试状态和读取模型由命名测试动作完成。

| 场景 | 结果 |
| --- | --- |
| Cmd+Z / Shift+Cmd+Z | 画板位置 17→0→17 |
| Cmd+S | 完整保存成功，fixture revision 158→159，状态已同步 |
| 输入框原生撤销 | 输入 abc 后 Cmd+Z 清空输入，画板仍为 17 |
| 升级弹窗关闭后 Cmd+Z | 修复后恢复内层 frame，画板回到 0 |
| 参考浏览器关闭后 Cmd+Z | 恢复编辑器并撤销到 0 |
| 另一原生窗口关闭 | 主窗口和当前 Studio contents 重新聚焦 |
| 退出并重新进入项目 | 新 PID；Cmd+Z 34→17，重做 17→34，Cmd+S 保存至 fixture revision 160 |
| Space+拖拽 | Electron 原生输入：scroll (1205.5,800)→(1155.5,770)，模型计数不变；松开后 Space/panning 均关闭 |

键盘验证没有广播事件到多个 contents。线上原项目仅做无模型修改的安装回归。此轮没有验证 Windows/Linux 的系统快捷键。

## 启动与 V8 缓存对照

同一复杂十画板 fixture、同一 renderer build，四个独立 App 进程按 code / bypass / bypass / code 顺序运行，每次进入六轮，共 24 次。后两次分别复用同策略已有 profile 和 persistent partition。未连接 debugger，未调用诊断 GC。数据见[脱敏测量](./webcontents-experience-measurements.json)。

下表为每次运行后五轮的中位数，首轮单列保存在 JSON，未混入后续轮次。

| 策略 / 运行 | 首次捕获非空内容 | 首个画布可用 | 全部初始画板完成 |
| --- | ---: | ---: | ---: |
| code | 203 ms | 2016 ms | 4482 ms |
| bypassHeatCheck | 209 ms | 2036 ms | 4524 ms |
| bypassHeatCheck，重启 | 205 ms | 2024 ms | 4541 ms |
| code，重启 | 209 ms | 2008 ms | 4435 ms |

捕获图已确认是启动骨架屏。50ms 轮询加 capturePage 的时间只代表首次捕获的上界，不能当作 compositor FCP；本环境 Paint Timing 没有提供 FCP 事件。首个画布可用由轮询观察，全画板完成采用 Studio performance mark。离线结果排除了真实鉴权、网络和业务接口延迟，不能把这些数值直接作为线上 SLA，也没有测得“新增进程固定增加 300–800ms”的因果量。

bypassHeatCheck 没有显示稳定收益，产品保留默认 code。两策略 profile 均生成 Code Cache 文件；最终目录 code 为 89 文件 / 58,178 bytes，bypass 为 803 文件 / 245,714,018 bytes。这证明生成了缓存文件，未测得 V8 的实际命中/消费；不据此宣称缓存已命中，也不声称统计显著变慢。

24 次返回均通过旧编辑器 PID 消失断言，renderer error 为 0。没有为冷启动牺牲退出后的内存回收目标。此前 20 轮内存测量和已知缩略图 fixture 限制继续见[内存验收](./dashboard-canvas-memory-fix.md)。

## 验证与本机产物

540 项 Desktop Node 单元测试通过。原生 dialog 焦点/销毁测试通过。既有 `updates-native.cjs` 的宽范围测试未整体通过：直接运行缺少可传递依赖 @electron/asar；使用本地 bootstrap 提供该模块后，现有动态 slot 的立即断言与 requestAnimationFrame 放置存在时序失败。临时等待探针通过了首次插槽及五语言断言，但后续 remount 检查仍失败；未保留探针或将该脚本计为通过。此次修改的 dialog 单元测试及独立原生焦点测试均通过。原始对照和原生交互文件保存在本机 `/tmp/plasmic-dashboard-memory-20261103/`、`/tmp/plasmic-webcontents-experience-20261103/`；仓库只保存脱敏汇总。

已更新 `/Applications/Plasmic.app`，版本 0.6.4，构建时间 `2026-11-03T06:10:35.512Z`。签名验证通过，运行中 App RPC 与产物 manifest 的 rendererHash / desktopHash 相同：

- rendererHash: `86528de72bfd0b06532ab537ee9e2e3c0be819711d5882445d75bed01bf2f23b`
- desktopHash: `9ed25cae422409669019b9bccf333574f59b3be406ee7d07fdcaed9580894f1a`

旧 App 备份在 `~/Library/Caches/Plasmic-local-backups/2026-11-03T06-16-04.244Z/Plasmic.app`。构建第一次因工作区并发部署文件变化触发 sourceHash 守卫而中止；按最新源码重建通过，没有回退其他修改。本轮修复弹窗键盘事件冒泡后重新构建、签名和安装；构建后仅补充验收报告，产品源代码未改变。

本次缓存 ABBA 使用前述 JSON 中的 rendererHash；最终重新构建的 renderer 是上面的新 hash，不把 ABBA 绝对耗时冒充最终产物基准。Esc 修复前的前端另行通过真实 OS Escape 后撤销（17→0）、重做与保存（revision 159）、Space 拖拽。首次后台窗口的 pan 探针没有送达输入，已显式断言失败；激活后的后续探针通过，未将它写成每次首次激活都通过。测试驱动在发送 pan 前主动激活原生窗口，并断言拖拽距离、模型计数和松键状态。

Esc 修复前的构建另外完成两轮复杂十画板离线回归：冷启动 renderer 258.2 MiB，画布 969.8 / 969.7 MiB，返回 259.2 / 258.8 MiB；旧 PID 均消失、无强制 GC、renderer console error 为 0。Dashboard 缩略图 fixture 仍有三次既有 undefined.map 错误，不计作缩略图通过。

服务恢复后，Esc 修复前的已安装构建完成两轮在线进出，Dashboard 项目列表均完整显示。两轮编辑器 session 不同，revision 均为 750、changeCounter 均为 0，退出后 PID 86912 / 87516 均消失，无强制 GC。返回时 renderer RSS 分别 225.1 / 289.0 MiB，后续采样分别为 117.5 / 184.4 MiB。用户在该构建手动确认 Esc 不能关闭，作为本次键盘事件冒泡修复的线上失败依据。

最新 Esc 修复版已保留登录，再次打开线上原项目。真实原生按键 Escape 关闭升级弹窗，返回编辑器显示已同步；revision 仍为 750、changeCounter 仍为 0。随后通过实际返回链接回到完整 Dashboard 项目列表，旧编辑器 PID 5443 已消失。该次结果：

| 采样点 | 主 renderer RSS |
| --- | ---: |
| 新 App 冷启动 Dashboard | 265.5 MiB |
| 处理升级弹窗后的可见画布 | 649.4 MiB |
| 返回完整 Dashboard | 294.3 MiB |
| 返回后后续采样 | 253.6 MiB |

未调用强制 GC，App 当前停在正常 Dashboard。表中是 renderer RSS 采样，不是峰值、整套 App 总内存或活动监视器 footprint；系统驻留/换页和后台状态会影响 RSS，不能把较低的驻留值当作新增堆优化收益。网络中断时的失败页面采样没有混入完整 Dashboard 通过结果。

详见[本次安装与测量](./webcontents-experience-installed.json)。
