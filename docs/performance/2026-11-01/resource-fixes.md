# Desktop 资源问题修复与实测收益

2026-11-01。三个确认范围已修复：静止 canvas 的重复镜像采集、关闭参考浏览器后的宿主轮询，以及注册 MCP 客户端的 Electron transport 成本。没有修改主窗口后台节流、十分钟展示租期、sharp 缓存或 Dashboard 渲染策略。

本轮测的是最终生产实现，不使用上一轮诊断候选覆盖生产函数。[汇总、逐轮结果和源码/二进制哈希](resource-fixes.json)。测试机器为 macOS 26.6.2、Apple M4 arm64、Electron 44.5.1；helper 使用随包封装的 Node 24.21.0。

## 收益

| 场景 | 修复前 | 修复后 | 收益 |
| --- | ---: | ---: | --- |
| 静止 2D canvas：一次采集的总耗时 | 81.59ms | 1.84ms | **减少 97.7%** |
| 静止 WebGL canvas：一次采集的总耗时 | 85.81ms | 1.71ms | **减少 98.0%** |
| 上述 canvas 空闲轮中的完整 DOM 快照 | 每轮 8 次 | 每轮 0 次 | 不再重复复制约 2.23MB HTML |
| 参考浏览器关闭后约 3 秒的网页调用 | 17 次 | 0 次 | **消除隐藏后持续轮询** |
| MCP transport 的进程树 RSS 合计 | 236.85MiB | 87.34MiB | **少 149.51MiB，减少 63.1%** |
| MCP transport 进程数 | 3 | 1 | 不再启动 Electron GPU、网络子进程 |
| MCP 初始化完成耗时 | 205.13ms | 106.17ms | 减少 48.2% |

每个数字取对应两个独立进程样本的平均值。canvas、参考浏览器和 MCP 均按修复前/后/后/前串行执行，没有与构建、其他自有性能实验或单元测试重叠。RSS 包含共享页，不能当作独占物理内存或部署到其他机器后的固定节省量。

canvas fixture 为 1,000 个文本节点和一个 640×300 canvas，画板为 900×650；分别测试真实 2D 与 WebGL 上下文。每次采集后等待 500ms，所以较慢基线每轮观测 8 次，修复后每轮 9 次；这是每次采集耗时和工作量的比较，不是严格固定 2Hz 的累计 CPU 实验。实际产品的 500ms 定时器未改变。这也不是主线程阻塞时长或整个 Studio 任意页面的通用加速倍数。

参考浏览器全进程树 CPU 在基线两轮为 1.19% / 1.22%，修复后为 0.58% / 0.62%（单核百分比）。该值还包括其他 UI 活动，因此确定的收益以隐藏网页调用从 17 次降到 0 次为准；没有通过销毁网页来回收其内存。

## 实现及功能边界

**canvas。** 编辑镜像检查当前 canvas 的完整像素表示，只有变化时强制重新生成镜像；同一次检查的像素供 `snapshotDocument()` 复用，避免一次采集读两次 canvas。WeakMap 不阻止已移除 canvas 被回收。连续 DOM 更新保持即时刷新，不等待静态防抖；视频、运行中的 CSS 动画、不可读取像素沿用实时路径。Preview 不读取 canvas 像素，仍使用合成器截图；常规导出也不读取镜像缓存。

四轮 2D 与四轮 WebGL 的静态 JPEG 摘要全部一致。每轮均验证文本修改、单次绘图、连续 DOM 更新和 60ms 周期的动态绘图能刷新；修复后空闲每 tick 只读一次像素，不做整页快照。单元测试补充验证不可读取像素会丢弃旧缓存，以及正常导出读取最新像素。WebGL 原生场景使用 `preserveDrawingBuffer:true`；未对所有 WebGL 配置或大型高熵画布承诺相同收益。

**参考浏览器。** 隐藏时停止宿主定时器；用轮询代次防止关闭前的响应覆盖重新打开后的状态或恢复定时器。重新打开会恢复轮询，显式 `get_state` 仍读取一次，隐藏时不会启动循环。保留网页、会话、未提交表单、按钮状态和选择；不改变外部网页自己的脚本、网络和动画策略。

**MCP。** 注册配置直接使用随包提供的 `plasmic-mcp` 可执行文件，不依赖系统 Node。它封装同一个 `serveMcp()`，业务仍经已有带认证的本地 RPC 交给 GUI。已有选中的自管配置在 GUI 启动时按原有恢复机制更新。应用 `--mcp` 入口保留：POSIX 在浏览器服务启动前替换进程；Windows 由于不能替换运行中的进程，该应用入口继续在原 Electron 进程内运行同一个 `mcp-entry`。**Windows 用户也应使用生成的直接 helper 配置获得较小的运行时；不声称 Windows 应用 `--mcp` 入口有同等内存收益。**

构建固定 Node 版本并检查已提交的 SHA-256；关闭 SEA 的执行参数扩展，保留 Electron 原有 fuses，helper 拒绝 Node eval/inspector 参数。macOS 签名包已验证 helper 位于 Resources、可执行且签名有效。[Node SEA 的执行参数规则](https://nodejs.org/download/release/v24.21.0/docs/api/single-executable-applications.html#execution-argument-extension)说明 `execArgvExtension: none` 会忽略 `NODE_OPTIONS`。原生安全测试也验证恶意 `NODE_OPTIONS` 没有执行，CLI eval/inspector 没有启动。

独立二进制未压缩约 **116.49MiB**，这是新增安装资源成本；本轮没有生成完整发布安装器，所以压缩后的安装包增量未知。打包脚本支持原来的平台/架构目标，但 Windows/Linux 没有在本轮做原生执行验收，不能将 macOS 的测量直接外推。

## 验证结果

| 验证 | 结果 |
| --- | --- |
| Desktop 全量单元测试 | **530/530 通过** |
| 参考浏览器原生验收 | **25 项通过**，含选择、截图、导入、关闭重开、导航、会话和 UI 行为 |
| 灵动岛原生验收 | **16 项通过**，含隐藏更新、多画板、折叠恢复、Preview、任务、登录状态、更新流程 |
| 签名 macOS 包安全验收 | helper 资源/签名、应用入口、直接 helper、Electron fuses、环境注入、eval/inspector 均通过 |
| MCP 生命周期 | 正常退出、崩溃、重开三种 GUI 场景，每次 3 个 stdio 客户端均退出；离线连接拒绝 |
| 独立 helper 后台验收 | 子进程数为 0；宿主断开后自然退出 |
| MCP 前后协议对照 | 41 项工具契约摘要一致；RPC、96KB 结果分页、mutation 只执行一次、错误、图片、样式和 skill bootstrap 均通过 |
| 实际生产模式 Studio renderer | 120 文本节点离线项目，隐藏窗口中改名、undo、redo、恢复和就绪检查通过；10 次静态采集无完整快照，平均 0.70ms |

原生测试使用真实 Electron、签名应用夹具、MCP SDK 以及已有生产模式 Studio renderer，业务数据和 profile 隔离，不是浏览器函数 mock。Studio 使用已有匹配的离线诊断构建，本轮没有重建全仓 Studio，也没有在正常在线项目进行保存/发布。未提交、安装或发布；用户当前安装的应用未替换。

## 复现

开发启动会先构建 helper。直接运行原生测试前先执行：

```sh
cd desktop
npm run build:mcp
node --test tests/*.test.cjs
node tests/mcp-background-native.cjs
node tests/mcp-lifecycle.cjs
node tests/runtime-security-native.cjs
node_modules/.bin/electron tests/reference-browser-native.cjs
node_modules/.bin/electron tests/island-native.cjs
```

前后性能脚本位于 `desktop/tests/performance/`，入口和 fixture 要求见[诊断说明](../../../desktop/tests/performance/README.md)。基线是本轮编辑前复制的完整 Desktop 源码；哈希及私有保留路径在 JSON 中。对应 `resource-fix-reference-*`、`resource-fix-capture-*`、`resource-fix-mcp.json` 和 `resource-fix-studio.json` 均为最终有效结果，没有使用上一轮原型数据代替修复后结果。
