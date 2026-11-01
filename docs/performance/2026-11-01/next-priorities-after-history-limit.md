# 50 步历史之后的性能优先级

2026-11-01。只核对源码、已有测量及运行一个当前方法级探针，没有修改生产逻辑，没有新的整 App 性能 A/B。

已排除重复实施：主进程依赖延迟初始化、环境索引/Monaco/DeepMap 清理、草稿字符串传输、项目 GET 重复处理、静态排队骨架屏、静止镜像重复采集、参考浏览器隐藏轮询、MCP Node helper、删除样式缓存清理、最近 50 步撤销。这些项的证据分别见之前的验收报告，不把已有收益算作未来收益。

## 建议顺序

| 优先级 | 问题与目标 | 当前证据 | 最小处理方向 |
| --- | --- | --- | --- |
| P0：CPU/输入响应 | 隐藏画板的局部视觉刷新绕过暂停 | `view-ctx.ts` 的 `scheduleObserverRefresh` 检查队列 idle、是否存在模型事务，但不检查 `isRenderActive`。本次提取当前方法体，在 active=false、queue.paused=true 的受控 fixture 中，仍调用 flush 和 post 各一次，active 检查为 0 次。 | 只合并并延后不可见且无显式后台需求的视觉刷新；恢复激活或显式 `awaitSync` 时排空。业务状态、保存、后台 MCP、镜像与 Preview 不暂停。 |
| P0：长期内存/GC | Preview/Docs 代码生成缓存的所有权 | `preview-codegen.ts` 六个模块级 `computedFn` 使用 keepAlive；`createComponentOutput` 参数含上下文、Component 和 ProjectConfig。实际 Preview 调用传入完整 StudioCtx。本机 mobx-utils 实现以 DeepMap/Map 按参数记忆，不是弱键。PreviewCtx.dispose 只执行自身 disposals，没有释放这些模块缓存的入口。 | 先取 Preview→切换版本/恢复草稿→再次 Preview 的堆快照；按当前模型/会话归属释放失效项，删除组件时清除其专属条目。同一活跃模型和共享依赖的必要命中保留。 |
| P1：首帧/多画板加载 | 各 Document 的重复脚本初始化 | canvas-ctx 对每个画板 window 执行组件库；scriptExec 将正文放进 script.text 同步插入。已有 installedHostLessPkgs 只避免同一个 Document 内重复执行。 | 先用当前匹配构建测解析、编译、执行、注册及入口依赖链。再评估精确版本制品 URL/编译复用、共同计算复用和非首帧依赖解耦；保留各画板独立注册及运行状态，不做库分包或页面按需模型。 |
| 专项：大图导出峰值 | 普通路径先捕获完整位图，再裁剪 | `canvas.cjs` 的普通 offscreen 分支先 paintWindow(width,height)，之后 bitmap.crop(rect)。大画布上的小区域也经过完整位图。 | 验证直接区域捕获或分区路径，减少全尺寸 bitmap、PNG/base64/NativeImage 中间副本；保持原布局、DPR 和输出像素，保留隐藏 surface 捕获失败的有效回退路径，不通过降分辨率取收益。 |

方法级探针输出：

```json
{"active":false,"queuePaused":true,"flush":1,"post":1,"activeChecks":0}
```

探针只说明调度路径存在，不说明真实项目有多少次隐藏刷新，也不是 React 全链路或整 App CPU 测量。需要在多个缓存画板发生共享变化时计数并单独 A/B；无状态变化时不能据此推断仍有持续渲染。

功能风险补充：这条队列不只是绘制，它通过 forceUpdate 触发 React 重渲染，并运行更新 Val/DOM/选择引用的 `updateCtxPostChange`。组件的 props/effect 和交互变体状态也可能随渲染变化，不能将整个 observer 队列默认视为无副作用的视觉工作。仅增加 `!isRenderActive()` 返回还不够：激活时如果 syncQueue 为空，单纯 resume 不会主动排空已积累的局部刷新，可能留下旧画面。必须验证激活唤醒、显式 awaitSync、镜像及后台工具同步，并判断是否有必须保留即时更新的组件场景。尚未实现或证明功能等价，不能据方法探针声称此项改动无功能风险。

Preview 缓存需要重点测量模型替换、组件删除和配置身份变化。单纯反复开关同一个 Preview、参数完全相同，可能只是必要的缓存命中，不能当作泄漏。当前结构能保留参数和输出，但真实 retained size、是否连到旧 Studio/模型图及修复收益尚未测出。[MobX 官方文档](https://mobx.js.org/computeds.html#tips)也说明强制 keepAlive 有泄漏风险；不能因此一概关闭缓存。

## 验收与边界

- CPU 项比较隐藏视觉刷新次数、renderer TaskDuration、输入尾部延迟与全部画板完成时间；当前画板、后台 MCP/镜像、预览、保存和重新进入均须正常。不沿用曾被撤回的“拖动期间整体暂停后台初始化”。
- 内存项比较 GC 后保留对象及 dominator 路径，保护另一个活跃画板和 Preview/Docs 会话；不能清空共享缓存、缩短 50 步历史或卸载活跃画板来制造收益。
- 加载项的磁盘/网络命中不等于执行免费；也不能假设改成 URL 就免除每个 Document 的注册。只有 parse/compile 被证明占比足够大，才调整资源执行方式。当前端到端首帧收益未知，旧 0.5.29 的约 2.33 秒暖开不是当前构建的成绩。
- 导出项先测大图/小区域组合下的 renderer、主进程、原生/GPU 峰值和像素摘要。只在该场景成立，不宣传为空闲内存收益。

小项可以穿插更新按钮的 DOM 观察收窄：当前仍观察整个 document 子树，每帧查找锚点并 checkVisibility。旧 trace 有累计开销线索，但不是一次百毫秒卡顿，优先级低于前两项。

暂不优先：磁盘资源缓存改格式或上 worker（此前本机循环阻塞证据不足）；草稿传输重做（已改字符串）；直接把 liveArenas 从 6 减到 3/2（已有回开变慢、内存收益不稳定的反例）；统一后台节流、禁用 sharp 缓存、常驻截图窗口池。没有功能完整且收益明确的新证据，不重新推广。

[Electron 官方性能建议](https://www.electronjs.org/docs/latest/tutorial/performance)强调对实际工作负载反复分析和测量。这里的优先级表示值得进入验证，不表示已获得固定 MB、秒数或 CPU 百分比收益。
