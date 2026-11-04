# 后台计算空闲内存归因与优化验收

已将线程后台计算改为 App 所有、按需启动的 Electron utility process。保持图形算法、草稿持久化、MCP STDIO 和页面公开 API。空闲占用降下来，同时保留计算脱离主进程的响应性。

修正测量口径后，宿主与全部计算进程的 footprint 之和从 220.3MiB 降到 105.5MiB，约减少 52.1%。三轮自然回收后的占用依次为 105.8MiB、43.6MiB、42.5MiB；每轮计算进程数均回到零。没有用强制 GC 改善这些结果。

## 为什么上轮空闲占用仍高

1. **上轮基准脚本有误。** 准备下一轮时，executeJavaScript 的最后一个表达式是给 draftJson 赋值，这会把整份 JSON 返回宿主；虽然未使用返回值，仍产生约 28MiB 主进程 JS 堆及额外临时分配。现已显式返回 undefined，并对修改前后的实现使用同一修正。上轮约 272MiB 与本轮 220MiB 不能直接作实现收益比较；实现收益以本轮同口径 ABBA 为准。
2. **真实残留主要不在主进程存活 JS 对象。** 修改前版本的拆分试验中，混合负载自然空闲后 footprint 为 278.4MiB；仅在诊断阶段执行 GC 后仍有 230.6MiB，而主进程堆已从 33.6MiB 降到 5.5MiB。图形单独运行时，GC 后堆约 5.4MiB，footprint 仍约 144.9MiB，初始约 48MiB。草稿单独运行也复现。线程已退出，进程级运行时/分配驻留仍存在；仅缩短线程空闲时间不能让这些空间随地址空间消失。未把残留全部归因给某一个 malloc/V8 分类，也没有据此宣称业务对象泄漏。

这些归因试验保留在 [混合负载](attribution/both.json)、[草稿](attribution/drafts.json)、[图形](attribution/graphics.json)。其中 afterDiagnosticGc 仅用于排查，未混入下文自然空闲及计时结果。vmmap 汇总与 Electron getProcessMemoryInfo 的 private 值相互核对；不引用 vmmap 对 Electron Framework 报警的 malloc zone 分类明细。

## 落地修改

- 图形和草稿各用一个串行 utility process，正常 App 最多两个，与 MCP 连接数无关。没有新增 HTTP/TCP 服务，也不要求客户端主动释放。
- 仍按 15 秒空闲回收，下次调用自动启动。进程退出可以回收该进程的重计算堆和原生分配；主进程保留小摘要，并在重启后校验文件身份。
- 等待旧进程真正退出后才启动替代进程；支持启动中取消、排队取消、异常退出后重新调用、owner 关闭。完成任务后清除输入、回调和信号引用；当前失败任务不会被自动重放。
- 草稿串行、原子替换、fsync、previous 恢复、配额、账号/项目权限与序号保护继续使用同一后端。页面仍写 JSON 字符串、读原对象，中文、emoji 和未配对 UTF-16 surrogate 的回归保留。
- MCP 工具及 Go 协议实现未修改。utility process 使用 Electron 私有 IPC；UTF-8 字节仍保持内容，跨进程复制成本计入计时。

## 同口径性能与内存对照

Apple M4、macOS arm64、Electron 45.2.1。优化前为本次修改前冻结的线程版本，优化后为隔离进程版本；[源码校验值](source-hashes.json)。四个全新 profile 按 before/after/after/before 串行运行。每个 profile 对 41,944 节点草稿执行一冷三暖读写，再做三轮相同 1MP 描摹与矢量计算。草稿序号、节点数、文本及完整 SVG 摘要均一致。

原始数据：[ABBA 合集](native-series.json)。内存包括主进程和所有命名计算进程的 footprint 之和，避免把占用转到子进程后只测主进程；各进程值、主进程堆/external 和渲染器 RSS 分开保留。这个和不是整套 Studio/系统内存，也不是活跃峰值。

| 阶段 | 线程版本 | 隔离进程版本 |
| --- | ---: | ---: |
| 初始 bridge 打开后 | 48.3MiB | 55.0MiB |
| 任务结束、后台尚活跃 | 336.7MiB | 397.1MiB |
| 再闲置 16.5 秒 | 220.3MiB | 105.5MiB |

活跃时合计增加约 60.4MiB（17.9%），是额外运行时及 IPC 隔离的成本。空闲后不再有计算进程；不是通过漏算子进程得到的下降。

| 操作 | 完整往返，前 → 后 | 主进程最大调度延迟，前 → 后 |
| --- | ---: | ---: |
| 草稿写入 | 99.7 → 104.2ms | 2.5 → 8.7ms |
| 草稿读取 | 77.2 → 80.6ms | 2.7 → 3.9ms |
| 1MP 描摹＋矢量计算 | 353.5 → 291.7ms | 5.1 → 3.6ms |

草稿每侧取六次暖调用中位数，图形每侧取四次暖调用中位数。隔离进程增加了草稿往返和复制成本，但主进程延迟仍为几毫秒，保留了大幅低于最初同步实现的收益。图形此轮更快，样本较少且系统负载不受控，不承诺所有图像都同幅加速。没有强制 GC，不使用计时外的诊断 GC 数字作改善结论；不是画布帧率或完整项目打开计时。

## 连续回收与重新拉起

[三轮回放](repeat/native-series.json) 在同一个宿主中重复完整负载和 16.5 秒自然空闲。每轮写入使用更高序号，验证真实文件继续可读；每轮先观察到两个计算进程，再回到零。

| 轮次 | 空闲 footprint（宿主＋计算进程） | 计算进程数 |
| --- | ---: | ---: |
| 1 | 105.8MiB | 0 |
| 2 | 43.6MiB | 0 |
| 3 | 42.5MiB | 0 |

第二轮后主进程的小量临时分配也自然回落。三轮内没有观察到逐轮增长；这个有限回放不等同于长期运行泄漏证明。

## 验证与边界

- npm test --prefix desktop：Go 单元测试及 562 项 JavaScript 测试通过。Node 单元测试使用只存在于 tests/fixtures 的 Electron 进程 API 替身；实际生产只使用 utilityProcess，没有保留线程双实现。
- node desktop/tests/background-native.cjs：真实 Electron 中的 Go STDIO 图形往返、read_result SVG、原公开草稿 API、Unicode、检查点恢复、账号切换、ASAR 内实际执行、启动中关闭和取消后重新拉起均通过。
- node desktop/tests/background-packaged.cjs：临时 ad-hoc 签名 ASAR 应用、生产 fuses、Node 环境注入禁用均通过。正常退出以及对 owner 直接 SIGKILL 后，图形、草稿两个 PID 均不再存活。该检查已加入 macOS 发布流程。
- 原缓存二进制格式和 Node RPC 优化保留；没有新生产依赖，没有改图形算法或公开协议。
- 本机原生及打包实测为 macOS arm64；其他平台原生运行尚未实测。没有替换或重启已安装 App，也没有修改正常用户 profile。

## 复现

需要修改前冻结的 Desktop 源码和依赖，根路径及校验值见 source-hashes.json。性能采集与构建/测试分轮串行执行。

```sh
node desktop/tests/performance/node-optimization-native-series.cjs <threadDesktopRoot> /tmp/memory-ab
PERF_BACKGROUND_CYCLES=3 node desktop/tests/performance/node-optimization-native-series.cjs <threadDesktopRoot> /tmp/memory-repeat after-only
npm run test:background --prefix desktop
npm run test:background-packaged --prefix desktop
```
