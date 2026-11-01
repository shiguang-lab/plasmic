# 撤销视图快照原型：功能、堆快照与 A/B

日期：2026-11-01。结论：**不保留此次生产原型**。它切断了撤销视图直接持有 Val 的路径，但在本轮完整 Studio 场景中没有确认独立的内存收益，嵌套组件冷恢复也没有通过。原有三个生产文件已按实验前副本逐字节恢复，原型新增文件/测试已移出工作区。诊断工具和结果保留；没有提交、发布或替换安装包。

[机器可读结果、全部有效样本和保留路径](undo-snapshot-validation.json)。此前将这项列为高价值候选，依据还不足以支持直接实施；本轮结果将它降为待证明的联合治理项。

更多操作次数的扩展诊断见[操作次数、撤销历史与内存增长](undo-history-growth.md)：另外 12 个新进程比较小修改、大文本和子树增删；这不改变本报告原型撤回及冷恢复未通过的结论。

## 成功条件与实际结果

| 条件 | 结果 |
| --- | --- |
| 撤销视图不直接持有 Val/Fiber/env | 原型做到；堆路径中原来的直接引用消失 |
| 同等历史和画布操作下，结束生命周期的运行时实际释放 | 未达到；两侧均有 5 个已回收画板的选中 Val 存活 |
| 常规撤销/重做保持模型与选择正确 | 每侧三个新进程，各 20 次 undo + 20 次 redo，最终模型一致、22 条记录、无画布错误 |
| 重复实例、Slot、嵌套变体恢复 | 三组暖恢复检查两侧均通过 |
| 画板回收后嵌套上下文冷恢复 | 未通过：原版断言报错并超时，原型也超时；不能宣称完整功能验收成功 |
| 可确认的内存/延迟收益 | 未确认，差异小于进程间波动，且就绪轮询限制了计时解释 |

## 测量场景与边界

运行完整生产模式 Studio renderer，使用开发 Electron、独立 profile、离线 HTTP 响应，阻止 WebSocket 和外部业务写入。两侧组件库/运行时配置相同，没有改变正式包 fuses、manifest、调试入口或缓存预算。构建采用 `NODE_ENV=production / PLASMIC_SELF_HOSTED=1`，不等于正式安装包验收。

项目是通过实际 Site/TplMgr/Bundler 生成的独立集成 fixture：一个页面、120 个文本子节点，随后创建十个混合 arena，每个放置同一页面的一个画板。各画板选择根节点、做两次模型编辑，再切回页面 arena。沿用 `liveArenas=6`，最后五个测试画板已退出 ViewCtx 列表；补充读回确认这些 ViewCtx 的 `isDisposed=true`。使用 WeakRef 标记 Val、ViewCtx、Document，没有为了测量增加强引用。测量保留全部撤销历史。

这不是原先真实业务项目的完整 A/B。该项目有一份明确版本依赖未在当前账号缓存中找到；补读所用的隔离认证刷新失败。没有用另一版本资源或伪造 manifest 来补齐。以下 MiB 不能外推为真实大型组件库项目的节省量。

计时与堆快照分轮。正式计时按 before/after/after/before/before/after 交错，每侧三个新进程，每进程 40 次操作；一轮 after 与类型检查重叠，被排除并用独立新进程 `ab8-clean` 替换。两侧各 120 次操作，但独立进程样本量各只有 3，不能把 120 次当成 120 个独立进程。

## 前后数据

| 指标 | 原版 | 身份快照原型 | 解释 |
| --- | ---: | ---: | --- |
| GC 后 JS heap，中位数 | 162.90 MiB | 162.75 MiB | 差 0.15 MiB / 0.09%，不能确认为收益 |
| JS heap 进程间范围 | 162.88–167.12 MiB | 162.25–162.80 MiB | 差值小于观察到的波动 |
| undo/redo 至 Studio 就绪，各进程中位数的中位数 | 110.60 ms | 109.30 ms | 差 1.30 ms，不能确认为提速 |
| 上述中位数的进程间范围 | 109.60–112.65 ms | 108.80–110.55 ms | 范围有重叠 |
| 合并操作 p95 | 273.20 ms | 272.00 ms | 同样没有稳定改善证据 |
| 已回收画板中仍存活的选中 Val | 5/5 | 5/5 | 没有达到实际释放条件 |
| 断开 CDP 后的独立 GC 对照 | 5/5 存活 | 5/5 存活 | 此处只比较对象存活，非精确堆字节 |

就绪计时包含 `awaitStudioReady()` 的 50/100ms 轮询，不是纯撤销 JS 执行时间、真实输入延迟或 CPU 利用率。没有据这组数值宣称降低主线程长任务、主进程事件循环延迟或画布首次加载时间。

JS heap 来自 Studio/画布所在共享 isolate 的 `Runtime.getHeapUsage`，不是单个 iframe 的私有堆。另存各进程 RSS/working set，但没有把它们相加当作独占物理内存，也没有用 RSS 变化判定泄漏。原生/GPU 内存收益未知。

## 堆快照和 MemLab

每侧采集 baseline/target/final 三快照，再用诊断依赖 MemLab 2.0.6 离线处理。过滤器只检查五个已回收画板的选中 Val，两个实验均为一组、五个相似候选；这不是整个 Studio 的总泄漏数。其独占保留量显示约 3.9KB，不能按五份画布大小估算。

原版存在这条直接强引用路径：

```text
StudioCtx → undoLog → _log → record.view → focusedSelectable → Val
```

身份快照原型中，同一批标记 Val 仍能通过另一条路径到达：

```text
__REACT_DEVTOOLS_GLOBAL_HOOK__ → onCommitFiberUnmount closure
  → fiberToValSubtrees WeakMap → entry.cached → Val
```

WeakMap 的这条路径需要进一步分析 key 的真正存活根。MemLab 的展开包含 Fiber、文本 handle、绑定的状态更新函数和相互引用；**不能仅据 WeakMap 路径认定 WeakMap 本身泄漏**，也不能直接清空共享表。实际对象仍存活、且总堆没有确认下降，足以说明此次单独切断撤销引用尚未达到目标。

为排除仅由 CDP 连接造成的存活，另各启动一个进程，在初始化后断开 debugger，使用诊断专用 `--expose-gc` 做两轮 GC。两侧仍为 5/5。该轮 `performance.memory` 字节是粗粒度值，不与 CDP 精确堆大小混用。

快照轮使用初版原型，后续只收窄了撤销恢复的快速路径；创建身份快照的逻辑相同。主表计时使用修订后的原型，不能将堆轮和计时轮说成同一次实验。

## 功能与测试

- 原型相关单测：6 文件、44/44 通过，含新增身份快照/owner 前缀探针。探针不等于完整 React 集成。
- 原版及原型的原生 Studio 暖恢复均通过：同 Tpl 的第二个重复实例及 clone key、Slot owner/Param、嵌套组件上下文、目标变体/pins、默认 Slot 状态。
- 正式计时轮中每侧 120 次 undo/redo 均完成，最终根节点名 `Edited9_1`、22 条历史、无画布错误；没有减少撤销步数。
- 冷恢复：进入嵌套组件、做两次编辑，切换十个 arena 让原画板销毁，再撤销返回。修正诊断脚本的 MobX 导航批处理后，原版进入目标 arena 时出现断言，原型也没有完成；两侧最终均触发 60 秒功能场景超时。后续删除节点、frame 选择检查未执行，不能算通过。没有压低超时或吞掉错误来通过验收。
- 原型初次全量类型检查在 `DbMgr.ts:5611` 报 `AnonUser` 无法赋给 `never`，该文件不是本实验改动；不把这次检查算通过。撤回后 `pnpm --dir platform/wab typecheck` 通过。
- 撤回后原有 5 文件、37/37 单测再次通过；两个诊断脚本 `node --check` 通过。

最早的直接导航脚本在“切走”时就报 `getComponentFrame`，尚未测试冷撤销。修正测试调用后才进入真正的冷恢复；前者没有当作撤销原型新增回归。

未验收的部分仍包括真实保存/发布、自动升级、原业务项目的大组件库、私有变体的完整冷恢复、条件隐藏实例、多节点选择等。当前不能保证这项改造后所有功能正常。

## 最终处置与下一步

`undo-log.ts`、`StudioCtx.tsx`、`view-ctx.ts` 均与实验前副本字节相同，哈希记录在 JSON。新增生产 helper 和对应原型测试已移除，用户原有未提交修改保留。只新增诊断脚本入口及性能报告；诊断工具不进入生产常驻路径。

后续应先证明并修复 frame dispose 后运行时还被哪些根持有，区分共享缓存工作集、闭包/观察器生命周期及 WeakMap key 的保留；保持活跃画板和共享缓存正确。待其他根可回收后，再判断身份快照是否成为释放旧运行时所必需的一环。嵌套冷恢复是独立的正确性门槛，未通过前不合入。

## 复现和诊断事故

复用 [Electron 离线 harness](../../../desktop/tests/performance/README.md)。本机受保护诊断目录在 JSON 的 `localArtifacts`：包含前后源码、原型补丁、隔离构建配置/入口、项目生成器、样本和快照。原始业务导出、profile、堆快照不提交仓库；构建仅通过诊断 loader 替换三个实验源文件，未改发布配置。

```sh
PERF_UNDO=1 PERF_UNDO_ROUNDS=20 PERF_RUN_ID=sample \
  desktop/node_modules/.bin/electron \
  desktop/tests/performance/studio-optimization-fixture.cjs <private-fixture> before

PERF_UNDO=1 PERF_UNDO_SNAPSHOTS=1 PERF_UNDO_ROUNDS=0 PERF_RUN_ID=heap \
  desktop/node_modules/.bin/electron \
  desktop/tests/performance/studio-optimization-fixture.cjs <private-fixture> before
```

认证处理发生过不当操作：将正常 App 的刷新凭据复制到诊断 profile 并使用，之后诊断刷新和正常 API 读取失败。已删除副本及认证导出脚本，通过正常浏览器登录流程恢复同一账号，正常账号 API 再次成功，并回到原项目；修订前后均为 113、修改计数 0。没有绕过认证。恢复后的账号信息和凭据不写入报告。今后离线导出不使用这种凭据复制/刷新方式。
