# Go MCP 桥接迁移与对比

日期：2026-11-04。测量平台：macOS arm64。Node 基线为上一轮已完成按需校验、断线重连和缓存过期优化的 SEA 可执行文件；Go 与其使用相同产品版本 0.6.6、同一工具契约和隔离的本地 RPC 夹具。

| 指标 | 优化后的 Node SEA | Go | 降幅 |
|---|---:|---:|---:|
| 初始化后物理内存，中位数 | 35.70 MiB | 8.52 MiB | 76.1% |
| 首次工具调用后物理内存，中位数 | 39.15 MiB | 8.79 MiB | 77.5% |
| 启动 + initialize + tools/list，中位数 | 76.38 ms | 8.07 ms | 89.4% |
| 启动 + initialize + tools/list，P95 | 93.29 ms | 10.09 ms | 89.2% |
| 首次夹具工具调用，中位数 | 9.03 ms | 1.27 ms | 85.9% |
| 11 连接物理内存合计 | 442.90 MiB | 100.47 MiB | 77.3% |
| 桥接程序原始大小 | 116.51 MiB | 7.91 MiB | 93.2% |
| 桥接程序 gzip -9 大小 | 36.88 MiB | 3.02 MiB | 91.8% |


## 实现

- 生产桥接由 `desktop/mcp/` 的 Go 实现承担；删除 Node 桥接、结果缓存实现及 SEA 构建配置。Node 基线只作为本地测试产物保留，不随应用发布。
- 使用官方 Go MCP SDK v1.8.0；JSON Schema draft-7 校验保留现有 dependencies、additionalProperties、枚举和范围等契约。macOS/Linux 使用 Unix socket，Windows 使用 named pipe；不新增 TCP 监听端口。
- `build:mcp` 从现有 `mcp-contract.cjs`、样式、bootstrap 说明和 package/config 生成嵌入清单，工具定义仍只有一份来源。JavaScript SDK 移为构建/测试依赖。
- 保留离线初始化、按调用重连、调用者隔离、取消、64 KiB 文本预算、UTF-16 分页、16 项/64 MiB 快照预算和 10 分钟未读取过期。单个超大结果保留的规则不变；过期释放引用，物理内存回落由运行时回收机制决定。
- 桌面连接中断不会重放写操作；已发送请求的结果不确定时 `operationExecuted:null`，建立桌面连接失败时为 `false`。关闭 STDIO 退出桥接。
- 构建/打包沿用 `mcp/plasmic-mcp[.exe]` 入口，发布 Go 和依赖许可；构建来源校验及 CI 纳入 Go 源码、模块锁和工具链。

## 验证

- `npm test`：549 个 JavaScript 桌面测试通过，且在测试前构建实际 Go 可执行文件并运行 Go 单元测试。原有 MCP 客户端回归改为直接调用 Go。
- `go -C mcp test -race ./...`、`go -C mcp vet ./...` 通过。覆盖并发分页、过期、UTF-16、JSON 整数拼写、结果顺序、握手取消等。
- [协议对照原始结果](protocol-parity.json)：41 个工具及 schema 属性顺序、instructions、5 个已有协议版本、未知版本协商、未提供方法的错误码、图片、路由恢复、桌面异常、13 个 Unicode 分页偏移和 120 个导出文件分页均通过。
- JSON 内容按解析后的值比较，允许对象键的编码顺序不同。桥接自身的堆栈使用 Go 帧；SDK 的 method-not-found 说明文字不同，错误码和请求 ID 一致。桌面端返回的原始异常栈精确比较。
- `node tests/mcp-lifecycle.cjs`：同一批 3 个桥接进程经历真实 Electron 正常退出、崩溃和重启后仍可调用；STDIO EOF 正常退出。
- `node tests/mcp-background-native.cjs`：桥接没有 GUI/GPU/网络服务子进程，桌面端离线后可以恢复。
- darwin arm64/x64、linux x64/arm64、win32 x64/arm64 共 6 个目标构建通过。实际运行验证为 macOS arm64；其余为交叉编译，Windows/Linux 原生运行已接入 CI，本次未运行远程 CI。

## 方法与边界

每个版本启动 10 个新进程，按 ABBA 顺序交替采样；操作系统文件缓存保持自然暖态，不做系统清缓存或强制 GC。计时区间不包含 vmmap 采样。随后各运行 11 个独立连接，全部先调用一次 get_app_state，再由其中 2 个以约 100 ms 间隔连续读取 30 秒，另 9 个保持空闲。物理内存来自 vmmap；RSS 单独保留于 [原始测量](benchmark.json)。合计为各进程测量之和，不等于整机内存。

包体列仅衡量桥接可执行文件及其 gzip 大小，不是完整 Electron 安装包。本次未替换已安装应用，也未重启用户正在运行的桌面应用。夹具不访问 NAS、真实项目、登录凭据或保存设计；结果不代表真实画布渲染性能或长期设计工作负载。

Node：24.21.0；Go：go1.26.5。

- Node SHA-256：`6269080e64a8f71d2b39e55b6b1d4d93f0d879a5744c00aa9dda8e6a4dca7957`
- Go SHA-256：`2420c3d0fd80a2bc4b190cec96aff9454f3f6364c751c16468e948603321b4bd`

复现（从 desktop 目录运行，先保存对应 Node 基线，再构建 Go；性能轮不要与构建或测试并行）：

```sh
npm run build:mcp
node tests/mcp-parity.cjs mcp-bin/node-baseline/plasmic-mcp /tmp/mcp-parity.json
node tests/performance/mcp-bridge.cjs mcp-bin/node-baseline/plasmic-mcp /tmp/mcp-benchmark.json
```
