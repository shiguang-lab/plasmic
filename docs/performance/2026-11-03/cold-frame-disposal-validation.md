# 冷画板压力测试中的失效焦点引用修复

`null.valState` 来自压力测试完成后保存重开时的 **Studio 整体卸载**。冷画板恢复留下元素选区；销毁后仍存在的焦点引用触发内容编辑工具条重渲染。修复在 `StudioCtx.dispose()` 中，先用同一个 MobX action 解除顶层画布焦点引用与 committed inspector selection，再执行原有资源销毁。逐项结果见 [脱敏数据](./cold-frame-disposal-measurements.json)。

## 根因证据

旧生产资源稳定复现，源映射对应运行中的 bundle。私有只读探针在 `ViewCtx.valState()` 入口检查 evaluator，捕获当时状态：

- `viewCtx.isDisposed === true`；
- `studioCtx.viewCtxs.includes(viewCtx) === false`；
- `studioCtx.focusedViewCtx() === viewCtx`；
- 内容编辑模式并未开启，工具条只是寻找可进入内容编辑的目标。

调用链为：

```
CanvasContentEditorControls
  → getContentEditorTarget
  → ViewCtx.maybeTpl2ValsInContext
  → ViewCtx.valState
  → this.csEvaluator.valState()
```

`ViewCtx.dispose()` 最后将 `csEvaluator` 置空。原来的 `StudioCtx.dispose()` 释放所有 ViewCtx 并清空 observable 列表，却保留 `_xFocusedViewCtx`；列表变化唤醒尚未卸载的 observer，它回退到这个焦点，访问已销毁的 evaluator。测试仍能完成保存与重开，是因为 React 记录了错误，而测试之前没有据 renderer 错误日志判失败。

新增回归单测使用真实 StudioCtx / ViewCtx 和实际 `getContentEditorTarget()`，通过 MobX autorun 模拟工具条的依赖。旧代码的整体卸载分支得到同一条 TypeError；单画板释放分支是正向对照。修复后两个分支均通过，焦点、ViewCtx 列表与 inspector 清理断言通过。`valState()` 和内容目标查询的访问契约没有改变。

卸载直接解除顶层引用，保留 ViewCtx 原有的未提交部件文本取消行为。普通焦点切换接口会调用文本编辑器的默认提交；新增真实文本编辑器回归验证卸载不会提交草稿，并移除临时输入、恢复原标签。

## 回归内容

端到端测试增强为：任何 renderer error 日志使功能回放失败；缩略图夹具错误继续独立统计。冷画板场景增加重做：

1. 切换三个不同画板，检查真实 DOM；执行页面重命名、样式、画板位置修改及撤销重做。
2. 选中元素并修改样式，切换七个组件画板，验证原 ViewCtx 已销毁。
3. 撤销，验证新 ViewCtx、原选区和真实 DOM 样式恢复。
4. 再淘汰恢复后的画板，重做；按当前 undo view 契约显式重访被编辑画板，验证新 ViewCtx 和真实 DOM 样式；最终撤销恢复原样。
5. 保持元素选中，完整客户端保存后重载 Studio，逐字比较重开后的序列化模型和修订。
6. GP 场景另验证真实 Preview 的业务分页和返回。

所有模型写入都在隔离 fixture 后端，真实项目不参与修改。前后使用同一增强脚本：旧诊断基线通过模型/DOM/保存断言，但记录 `null.valState` 并以非零状态退出；最终修复候选通过增强复杂模型回放，renderer 错误为零；生产产物另外复验。

相关单测共 85 项，84 通过；目标选区卸载与文本草稿测试所在文件 16 项全部通过。剩余一项是 `arena-navigation.test.ts:117` 的同画板评论导航交互模式断言；在冻结的旧 StudioCtx 上单独运行同样失败。该导航代码与断言保持原样，作为既有测试问题单列。新增目标回归及冷恢复、内容编辑、选区、undo log、草稿和初始化清理测试通过。WAB 完整 TypeScript 检查、改动 TypeScript 文件 ESLint、两个 CJS 脚本语法检查通过。

## 生产资源与内存

工作区的完整构建在发布前一致性校验阶段检测到并行文件变化，因而中止。最终从本轮冻结源码快照重建生产前端，复用已完整构建的 SDK / Host 运行时，并核对 2,192 个非 Markdown 运行时源码/配置输入一致。复制的运行时产物再次通过五项真实 browser IIFE 验证，hydration 输入与产物校验通过；前端构建前后 sourceHash 一致，未修改的资源准备及打包脚本进一步校验源码、资源和 Desktop 哈希后完成签名、DMG / zip。产品入口不包含诊断探针。并行的 Dnd 与文档改动未混入快照。

最终生产 renderer 在两个独立进程各完成一次增强复杂模型回放，另在 GP 上完成一次回放：切换、冷淘汰、撤销重做、DOM 样式、选中元素时的整体卸载、完整保存/重开、GP Preview 分页全部通过，renderer error 日志为零。原模型与重开模型逐字一致。

内存使用旧生产资源六轮、新生产资源二十轮，采用全新隔离 profile、同一真实 fixture 与精确依赖、100ms 采样，无调试器和手工 GC。比较相同前六轮的打开期间采样峰值：

| 隔离回放指标 | 旧版 | 修复版 |
| --- | ---: | ---: |
| 前六轮打开期间进程工作集之和峰值 | 1,661MiB | 1,646MiB |
| 第六次返回 Dashboard renderer | 227MiB | 224MiB |
| 第二十次返回 Dashboard renderer | 未运行 | 230MiB |

新版本 Dashboard renderer 冷启动约 258MiB；二十次返回后约 230MiB，未见累积增长。二十轮的进程级整体峰值约 1,873MiB；旧版六轮约 1,852MiB，该字段包括后续截图和返回操作、轮数也不同，不用于直接判断打开峰值改善。每次旧编辑器 PID 从 App metrics 消失，循环后另外用 OS signal 0 验证二十个 PID 均已退出；Dashboard WebContents、PID、搜索和页面 token 保留，renderer error 日志为空。

这些工作集之和包含 fixture 后端所在的主进程、GPU 与缩略图进程，属于隔离回放口径，不是实际安装 App 的私有物理内存。100ms 采样可能遗漏短尖峰。缩略图夹具既有的 undefined.map 缺失数据错误仍独立计数，基线/新版均存在，没有据此声称缩略图生成通过。

最终版本 0.6.4，构建时间 `2026-11-03T10:50:10.316Z`：

- rendererHash：`71f2aa5fd61a253b33698221176e240d697032c72dd96b01cdb45a67e46d536a`
- desktopHash：`8af3fcd201b466eb68da1fefc44afc70be92209b7c0b45165e822b2c5ff9d8b4`
- 冻结快照 sourceHash：`1d099a0b1287526d6da89ffcccbbef8bcae5e99282321f4aeff92c3351e8c284`

签名 App、DMG 与 zip 已同步到当前仓库的 `desktop/dist/0.6.4/darwin-arm64/`，renderer 同步到 `desktop/renderer/`。测试和 App 都使用以上生产资源，产品源码在构建完成后未改变。

## 本地安装

安装前发现当前 App 已打开另一项目，当前会话 changeCounter 为 26。为保留正在进行的编辑，尚未重启 App，已询问合适的重启时间。修复和生产包回归不依赖这次安装。

私有模型、错误探针、原始调用栈、source map 归因、逐轮报告和构建日志位于 `/tmp/plasmic-cold-frame-20261103/`。仓库仅记录聚合指标、匿名化调用关系和 fixture SHA-256，不包含模型正文、账号或凭据。未部署服务器或发布在线更新；未验证 Windows/Linux 原生行为。
