# Desktop 后台计算与存储优化验收

后续核查发现本轮页面准备脚本会意外向宿主返回整份 JSON，影响空闲内存比较；本报告数字保留为该次采集记录。修正后的同口径比较、线程原生驻留归因与当前隔离进程实现见[后台内存验证](../background-memory/report.md)。

已落地图形后台计算、草稿字节传输与后台持久化、二进制缓存及 Node RPC 累积修正。MCP STDIO 和工具输入输出、页面公开草稿 API 保持原有行为；图形算法和计算结果沿用原实现。

实测收益集中在主进程响应性、缓存读写与诊断 RPC。后台化也有明确成本：大草稿的完整写入耗时增加，活跃以及本轮空闲采样时的主进程 footprint 高于基线。下面分别记录收益和成本。

## 当前实现

- Desktop controller 拥有一个按需启动的串行图形 Worker，继续调用原 PNG/ImageTracer 和 Paper.js 算法。取消正在计算的任务时终止该 Worker；队列中的未执行任务可继续在新 Worker 运行。错误不重放当前任务；插入前再次检查编辑器会话，避免计算期间切换项目后写入其他会话。
- 每个草稿 store 拥有一个存储 Worker；正常 App 创建一个 store。页面公开的 write(handle, draftJson) 仍接收字符串，preload 在页面侧编码为 UTF-8。主进程转移字节，后台校验、序列化、fsync 和原子落盘，只返回小回执；读取以字节送到页面后再解析为原有对象。字面量未配对 UTF-16 surrogate 先按 JSON 规则转义，避免 UTF-8 编码改变内容。
- 草稿文件名称、canonical JSON、配额、序号保护、previous 检查点恢复及账号/项目权限保持原有行为。摘要缓存随 inode、大小和 mtime 校验，小元数据跨 Worker 回收保留；退出前存储 owner 等待已接收的队列。
- 两类 Worker 都在 15 秒空闲后退出，下次任务按需启动，数量由 App owner 管理，与 MCP 连接数无关；新增的是进程内线程，没有新增常驻 Node 服务或 HTTP 端口。
- 缓存采用 4 字节元数据长度、小 JSON 头和原始二进制正文，仍验证身份、版本及完整性。旧 JSON/base64 缓存在命中时迁移，成功提交前保留旧文件；迁移失败时继续提供已授权的离线正文。
- Node requestRpc 客户端按块累计字节数，最后一次合并，继续保留 32MiB 响应上限、Unicode、取消和失败执行状态。生产 Go MCP 客户端已经使用另一条有界读取路径；此项主要改善诊断脚本。
- Sharp、代码导出、普通 PDF 合并、下载网络与 Electron 控制层沿用现有实现。

## 宿主阶段性能

环境：Apple M4、macOS arm64、Node 24.20.0。优化前源码在修改前冻结，位置及所有 CJS 哈希记录在 [原始数据](benchmark.json)。每场景按 before/after/after/before 启动 4 个独立进程，各一次冷调用和三次暖调用；表内是每侧 6 次暖调用的中位数，单位 ms。13 场景共 208 次调用的输出摘要校验通过；写入还校验 canonical 落盘字节，图形保持完整 SVG 摘要一致。

主线程阻塞用已启动的 1ms 心跳估算，正向控制确认能捕捉约 100ms 同步阻塞。它是操作期间的最大调度延迟，不是 UI 帧率。草稿宿主阶段不包含页面侧编码、页面解析与 contextBridge 对象转换，公开 API 完整往返另测。没有强制 GC；文件系统缓存和正常桌面后台负载未受控。

| 场景 | 耗时，前 → 后 | 主进程延迟，前 → 后 |
| --- | ---: | ---: |
| PNG 描摹，256² | 19.8 → 18.6 | 19.5 → 0.4 |
| PNG 描摹，1024² | 278.9 → 277.4 | 278.6 → 0.3 |
| 矢量 unite，2 路径 | 1.2 → 1.3 | 1.4 → 0.3 |
| 矢量 unite，64 路径 | 18.7 → 16.6 | 18.3 → 0.2 |
| 草稿写入，13.22MiB | 73.9 → 80.0 | 14.0 → 0.5 |
| 草稿读取，13.22MiB | 39.2 → 17.0 | 12.4 → 0.5 |
| 8 份草稿，暖目录 | 0.3 → 0.4 | 0.3 → 0.5 |
| 缓存写入，8MiB | 23.1 → 6.0 | 14.9 → 3.3 |
| 缓存读取，8MiB | 16.5 → 4.2 | 13.6 → 2.5 |
| 缓存写入，32MiB | 89.8 → 26.7 | 57.0 → 11.0 |
| 缓存读取，32MiB | 62.6 → 15.5 | 53.1 → 10.6 |
| Node RPC，小响应 | 0.5 → 0.4 | 0.7 → 0.5 |
| Node RPC，8MiB 响应 | 846.6 → 16.8 | 4.5 → 5.4 |

1MP 描摹的计算总耗时基本相当，连续主进程阻塞降至约 0.3ms。该项的主要收益是窗口所属主进程可以继续处理事件。暖草稿目录保留摘要缓存，前后都低于 1ms；空闲后重建 Worker 也保留该摘要。

Node 基准的 Paper.js 解析路径可能加载开发依赖 jsdom，因此首次模块耗时不能直接代表发布 App 启动。真实 Electron 内存场景使用仅含生产图形依赖的 ASAR；ASAR 在父进程预先准备，打包分配不计入被测宿主。

## 真实 Electron 公开草稿 API

[完整原始数据](native-series.json) 来自四个全新隔离 profile，顺序同为 ABBA。每次在真实 sandboxed preload、contextBridge 和 IPC 上执行四轮 41,944 节点草稿写入/读取，校验序号、节点数和中文文本。下面每侧是 6 次暖调用中位数，包含页面侧 UTF-8 编码、解析和公开 bridge 转换。

| 操作 | 完整往返，前 → 后 | 主进程延迟，前 → 后 |
| --- | ---: | ---: |
| 写入 | 69.2 → 85.3ms | 24.1 → 2.0ms |
| 读取 | 80.1 → 61.9ms | 16.4 → 0.8ms |

写入的端到端延迟上升，主进程阻塞明显减少；读取的端到端耗时和主进程延迟均下降。这是大载荷微基准，不能推断每个项目的打开速度或渲染器帧率。

## 内存与磁盘

以下是宿主 Node 基准末轮的进程 RSS，两次独立进程的中位数；包含 Worker，单位 MiB。没有诊断 GC，存活堆、分配历史与回收时机会影响 RSS。该指标不等于物理 footprint，也不能当成整套 App 的净节省。

| 场景 | RSS，优化前 | RSS，优化后 |
| --- | ---: | ---: |
| PNG 描摹，1024² | 238.9 | 292.4 |
| 矢量 unite，64 路径 | 187.4 | 203.5 |
| 草稿写入，13.22MiB | 238.8 | 312.1 |
| 草稿读取，13.22MiB | 214.3 | 278.0 |
| 缓存写入，32MiB | 421.5 | 122.9 |
| 缓存读取，32MiB | 574.0 | 219.1 |

32MiB 正文的缓存文件由 44,739,360 字节降为 33,554,542 字节，约减少 25%；文件仍包含完整正文、元数据和校验信息。

真实 Electron 的混合负载在草稿操作后，再执行三轮 1MP 描摹和矢量运算。表内是两个独立进程的中位数；footprint 包括该主进程内的 Worker，渲染器 RSS 单列。它只覆盖最小隔离窗口，不是完整 Studio 或已安装 App 总内存。

| 阶段 | 主进程 footprint，前 → 后 | 渲染器 RSS，前 → 后 |
| --- | ---: | ---: |
| 公开 bridge 打开后 | 40.0 → 48.0MiB | 118.9 → 118.8MiB |
| 所有任务执行后，Worker 尚活跃 | 263.8 → 386.3MiB | 283.1 → 287.8MiB |
| 再闲置 16.5 秒 | 160.7 → 271.6MiB | 283.1 → 287.8MiB |

两次优化后回放均验证 Worker owner 已在空闲期释放句柄。空闲后的实际 footprint 仍高于基线，不能将线程退出等同于进程占用全部归还。当前证据没有给额外驻留分配作精确归因；不据此声称存在泄漏，也不把缓存场景的节省与此场景直接相加。

footprint 读取 vmmap 的 Physical footprint 汇总行；部分采样伴随 Electron Framework 的 malloc zone 路径分析告警，报告不使用其分区分类明细。RSS、footprint 与观察阶段均在原始 JSON 中保留。

## 验证与交付范围

- npm test --prefix desktop：Go 单元测试和 562 项 JavaScript 测试通过，0 失败。新增覆盖 Worker 复用/回收/退出/取消/重建、跨会话禁止插入、草稿持久化与恢复、缓存迁移/损坏/配额，以及大 RPC Unicode 与大小限制。
- node desktop/tests/background-native.cjs：真实 Electron + Go MCP STDIO 的图形工具往返、read_result SVG 源码、原页面草稿 API、未配对 UTF-16 surrogate、检查点恢复和账号切换拒绝通过；图形及草稿 Worker 均在 ASAR 内实际执行。父进程在 Electron 退出后清理私有 profile。
- electron desktop/tests/library-cache-native.cjs：原生资源命中、重启、gzip、权限/失败响应、去重与原项目写入行为验证通过。
- 原图形算法、MCP 注册表及 Go 协议实现未改。没有新生产依赖。macOS 发布流程已加入后台 Worker 原生验收；本机实际执行为 arm64，其他平台的原生回放尚未执行。
- 本轮改动位于源码、测试和文档；没有替换或重启已安装的 Plasmic.app，没有读取/修改正常项目或登录 profile。

## 复现

需要修改前冻结的 Desktop 源码和匹配依赖；本轮的冻结目录为 /var/folders/by/mz1s49k13p3d7xvfr357w1kw0000gn/T/plasmic-node-before-4Q38fb，源文件校验值在 benchmark.json。性能采集与构建、测试分轮串行执行。

```sh
node desktop/tests/performance/node-optimizations.cjs <beforeDesktopRoot> /tmp/host-ab.json
node desktop/tests/performance/node-optimization-native-series.cjs <beforeDesktopRoot> /tmp/native-ab
npm run test:background --prefix desktop
```
