# Desktop 七项资源问题实测

2026-11-01。按“有可验证收益，并存在保留现有功能的替代方案”判定，列入待修复的是 **2 的静止 canvas 子场景、4 的隐藏后轮询、5 的 MCP transport 运行时成本**。1、3、6、7 本轮不列为问题。没有修改生产实现、提交或替换安装包。

原始指标、源码哈希和构建身份见 [汇总 JSON](seven-issues-analysis.json)。CPU 是单核百分比；RSS 是进程 working set 之和，包含共享页，不能当作独占物理内存或承诺的节省量。

| 原编号 | 判定 | 实测与功能门槛 |
| --- | --- | --- |
| 1：隐藏主窗口关闭后台节流 | 不列入 | 动画 fixture 关闭节流时约 11.4% / 16.3% CPU、3 秒约 361 次 rAF；开启节流约 0.12%、rAF 为 0。隐藏的真实 Studio renderer 中，两帧等待也只在关闭节流时完成。因此不能直接改为后台节流；当前未验证既保留动态画布与隐藏操作又节省资源的完整调度方案。 |
| 2：500ms 采集 | **仅静止 canvas 子场景待修复** | 普通静态 Studio 连续 10 次采集，0 次 DOM 快照、0 字节 HTML 重传，平均 1.93ms。静止 canvas + 1,000 文本节点 fixture，每轮 8 次空闲采集仍做 8 次快照，传出约 2.23MB HTML；两次基线平均每次 81.32 / 81.60ms。像素比对候选每轮 9 次空闲采集均为 0 次快照，每次 1.60 / 1.78ms；静态 JPEG 内容完全相同，DOM、canvas 和连续 DOM 更新均能触发更新。 |
| 3：10 分钟空闲展开 | 不列入 | 操作结束后实测 6 秒内保持展开，0 个活动操作、12 次状态刷新、0 次新增像素采集，剩余租期约 593 秒；主动收起后也无新增像素采集。缩短展示时间或取消实时内容会改变交互，未建立等价替代方案。 |
| 4：关闭参考浏览器后继续轮询 | **隐藏后轮询待修复** | 关闭后约 3 秒仍有 16 次网页隔离世界调用；候选暂停后为 0。全进程树 CPU 从约 2.05% 降到 0.83%，但该值包含其他 UI 活动，主要确定证据是调用数归零。重开仍保留同一个网页、未提交输入、按钮状态和选择，截图通过；5 轮关闭/重开与在途轮询检查通过。**不将保留网页内存列为问题**：销毁 view 会丢失任意外部网页状态。 |
| 5：每个 MCP stdio transport 使用 Electron | **运行时成本待修复** | Electron / Node / Node / Electron 的 4 个新进程对照：Electron 进程树 236.37 / 240.09MiB，Node 86.42 / 86.58MiB。Electron 每份有主进程、GPU 和网络子进程，Node 每份只有一个进程。相同的 41 项工具契约、RPC、结果分页、单次 mutation、错误和图片响应均通过；宿主断开时两种 transport 均自然退出。不是“仅注册配置就产生进程”，也不是每份固定预留 64MiB 结果缓存。 |
| 6：sharp 默认 50MB 缓存 | 不列入 | 新进程 default / disabled / disabled / default，每进程编码 12 张确定性 1600×1000 图片，输出摘要全部相同。默认缓存最终 RSS 107.69 / 108.02MiB，禁用缓存 109.59 / 106.45MiB；默认缓存统计 current=0、high=9–10、max=50。没有稳定的内存或速度收益，不能把 50MB 上限算成常驻占用。 |
| 7：Dashboard 独立预览 renderer | 不列入 | 使用实际 bundled 预览引擎，串行生成 12 次真实 640×360 缩略图，输出像素摘要一致。每次只多一个窗口；完成后均只剩父窗口，预览进程均退出。后段 RSS 有回落，6 秒空闲后的全树均值约 331MiB，未呈现逐次常驻 renderer 积累。不能根据单份理论 RGBA 大小判定泄漏；尚无经过同等功能验证的更低成本实现。 |

## 三项待修复的范围

**静止 canvas 的镜像失效判断。** 当前 `inspectVisualState()` 只要发现 canvas 就返回 dynamic，实际像素不变也会重建整页。诊断候选比较当前完整像素表示，仅在像素变化时强制刷新；复用本 tick 的像素给快照，避免再读一次 canvas。连续 DOM 更新仍沿用实时采集，video、运行中的 CSS 动画与不可读取像素仍保留原路径。无需缩短 500ms 刷新时效或关闭实时预览。

该候选仅存在于诊断模块加载器中。已验证 2D canvas 与文本内容；大型画布、WebGL、污染画布、多画板和真实业务组件仍需正式实现时验收。本轮结果支持把明确的重复工作列为待修复，不代表候选已达到发布门槛。

**参考浏览器隐藏后的宿主轮询。** 保留 WebContents 和网页会话；隐藏时取消 timer，处理在途 poll 完成后重新安排 timer 的竞态，重开时恢复。不要为了回收内存直接销毁任意外部网页，也不要顺带改变其脚本、网络或动画语义。候选没有改变网页自身执行策略。

**MCP transport 运行时。** `serveMcp()` 的同一实现可由 Node 运行，协议与业务 RPC 路径无需变化。A/B 使用本机 Node 24.20.0；发布应随包提供受控 helper，不能新增“用户必须装 Node”的要求，也不能开启正式 Electron 的 RunAsNode fuse。打包、运行安全、各系统架构、更新与卸载仍需集成验收。236–240MiB 与 86MiB 是本机新进程的 RSS 合计，不能承诺部署后每连接节省同样多的物理内存。

## 测量边界与验证

- macOS 26.6.2、Apple M4 arm64，Electron 44.5.1。所有实验串行运行，使用独立 profile、离线协议响应和合成业务数据；未操作正常应用的凭据、项目或 profile。
- 原生窗口、ReferenceBrowser、island、MCP 和图片处理使用当前工作区 Desktop 源码。Studio 使用现有生产模式诊断构建和 120 文本节点合成项目，并非重新构建整个工作区；Dashboard 使用 `desktop/renderer` 的实际 bundled 引擎，构建身份保存在汇总 JSON。没有把合成项目数据外推为真实大型项目的收益。
- canvas 为一个原生 Electron 进程内的基线/候选/候选/基线对照，每次采集后等待 500ms，所以每轮观测到 8 或 9 次；这不是严格固定 2Hz 的累计负载估计。每次耗时直接计量，不按 10 分钟外推。普通静态 fixture 还放置了 16 个隐藏 iframe，未访问目标场景之后的这些 frame；真实 Studio 的 4 个 frame 每 tick 只做 3 次场景检查。
- sharp 和 MCP 使用各 4 个独立新进程；未将单个进程内的多次操作当成多个独立进程样本。sharp 最终有效轮独立于单元测试运行。Dashboard scale=1 的样本只证明本项目输出相同，不能证明所有业务组件都能降低 DPR，因此不建议直接降采样。
- 10 分钟租期没有实际等待十分钟：原生实验观测其结束后 6 秒的状态与剩余租期；现有单元测试验证单调时钟的完整到期、并发队列及主动收起行为。
- 相关 5 个测试文件 **30/30 通过**：island activity、capture、visual state、MCP results、image preview。3 个新增诊断脚本均通过 `node --check`。
- 早期无效尝试遇到选择器规范化、未展示窗口无法截图、诊断计数器误匹配、重复脚本词法声明，以及离线字体资源未接入；均修正诊断后重跑，失败样本不计入上述结论。最终八份结果均无 error 字段。未减少业务行为以获得通过。

## 可复现入口

脚本不进入正常启动或默认单元测试路径：

```sh
desktop/node_modules/.bin/electron desktop/tests/performance/seven-issues.cjs reference <output.json>
desktop/node_modules/.bin/electron desktop/tests/performance/seven-issues.cjs hidden <output.json>
desktop/node_modules/.bin/electron desktop/tests/performance/seven-issues.cjs capture <output.json>
desktop/node_modules/.bin/electron desktop/tests/performance/seven-issues.cjs lease <output.json>
desktop/node_modules/.bin/electron desktop/tests/performance/seven-issues.cjs dashboard <output.json> <private-fixture>
desktop/node_modules/.bin/electron desktop/tests/performance/seven-studio.cjs <private-fixture> <output.json>
node desktop/tests/performance/seven-processes.cjs mcp <output.json>
node desktop/tests/performance/seven-processes.cjs images <output.json>
```

Studio 的已有构建和 fixture 必须是同一模型/依赖集合；脚本会新建私有目录，仅读取并链接已有 fixture，不共享其 profile。原始模型、构建、日志和 profile 留在私有目录；仓库结果只含指标和诊断路径。
