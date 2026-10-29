# 审核：Intel Mac 卡顿分析报告

日期：2026-10-29  
审核对象：[intel-mac-dashboard-latency-analysis.md](intel-mac-dashboard-latency-analysis.md)  
基线：`d4d6c3044`（0.5.8）加工作区未提交修改。仅做源码审查，未在 Intel 真机上录制 trace；下文排序是基于代码的推断。

## 1. 总体判断

原报告的事实陈述基本正确，表述也很谨慎。主要问题有三处：

1. **它把用户问题收窄成了“列表点击慢”**。用户反馈的是“整体卡顿”，报告完全没有覆盖编辑器和画布。本次发现 0.3.6（10-27）引入的本地草稿备份，会在每次编辑后对整个站点和全部依赖库做一次全量 bundle，并在 Electron 主进程里对同样大小的数据做多遍 JSON 解析和序列化。这很可能是编辑器卡顿的首要怀疑对象。
2. **低估了 F5 和 F3**。缩略图 iframe 每个项目都会新建一个 realm，因此 F5 的脚本初始化成本是每张缩略图都要付一次，而不只发生在启动时。另外 `ENV.COMMITHASH` 每次发版都会变，而近期一天会发好几版。所以每次升级后，所有缩略图必然重新生成，这是常态，不是偶发。
3. **漏掉了几个可以直接确认的放大因素**：骨架屏动画持续重绘、同一项目内重复做代码生成、canvas 运行时重复注入、字体素材按画板重复内联。

## 2. 逐项核对

| 原编号 | 结论 | 说明 |
| --- | --- | --- |
| F1 | 正确，且应加强 | 同源 iframe 和 Dashboard 共用一个渲染进程、同一条主线程，README 也承认这一点。另外，每个根组件调用 `buildPreviewModules` 时都传入新的上下文对象（[renderer.ts:129](../../../platform/wab/src/wab/client/components/dashboard/preview/renderer.ts)），而 `createComponentOutput` 的 `computedFn` 以这个上下文作为缓存键。因此多个画板共享的子组件会重复生成代码。 |
| F2 | 正确，有遗漏 | `snapshot()` 的素材缓存 `assets` 只在单次调用内有效（[snapshot.ts:78](../../../platform/wab/src/wab/client/components/dashboard/preview/snapshot.ts)），所以字体和图片会按画板重复下载并转成 base64。每个画板还要把全部样式表规则序列化一遍（第 222 行），再用 XMLSerializer 序列化整棵 DOM（第 246 行）。SVG foreignObject 图片在 Blink 里由主线程做排版和绘制，等于把整页再渲染一次。中文 Web 字体可达数 MB，会进一步放大这部分成本。 |
| F3 | 正确，但影响被低估 | [client.ts:119](../../../platform/wab/src/wab/client/components/dashboard/preview/client.ts) 把构建哈希作为缓存是否有效的条件。10-22 至 10-29 之间有 29 个以 “Release” 开头的提交，每次升级后首次浏览都会让所有可见卡片在后台串行重新生成。缓存上限 64 张，项目超过 64 个时会持续淘汰。 |
| F4 | 正确 | 补充：`ProjectListItem` 没有 memo。页面上任何状态变化都会让全部卡片重新渲染，包括 SWR 默认的“窗口聚焦时重新拉取”（全局没有 SWRConfig）。每次渲染都会新建 `Intl.DateTimeFormat`（第 417 行）。 |
| F5 | 结论需修正 | 原报告说它“主要解释启动、冷加载”，这不对。每个项目一个新 realm，每次都要执行约 4.2MB 直接引用的脚本，再加上以 `textContent` 注入的 react-web（0.22MB）、canvas-packages（2.07MB）和组件库包。内联脚本拿不到 V8 基于资源 URL 的代码缓存。此外，canvas 运行时在 [renderer.ts:211](../../../platform/wab/src/wab/client/components/dashboard/preview/renderer.ts) 已经注入一次，[studio-bundles.ts:131](../../../platform/wab/src/wab/client/components/studio/studio-bundles.ts) 又把同样 2MB 的源码包在 `if (!window.__CanvasPkgs)` 里拼到第一个组件库模块前面。这段代码不会执行，但仍要被解析。 |
| F6 | 正确，触发频率被低估 | SWR 会在窗口聚焦时（节流 5 秒）和徽标重新挂载时再次请求列表，每次都要解析全部草稿。更严重的是写入路径（见 §3 E1），原报告没有覆盖。 |
| F7 | 正确，次要 | 补充：`checkVisibility({checkVisibilityCSS:true})`（[update-ui.js:230](../../../desktop/src/update-ui.js)）需要最新样式，因此每批 DOM 变化都可能强制做一次样式计算。 |
| §4 | 同意 | island 的定时器只在 island 模式下运行；5 秒一次的 workspace 检查调用的 `getEditorContext` 成本很低。 |

## 3. 原报告遗漏的项目

### E1（高，编辑器）：每次编辑都触发全量草稿备份

- [StudioCtx.tsx:1705](../../../platform/wab/src/wab/client/studio-ctx/StudioCtx.tsx)：每条变更记录都会调用 `desktopDraft.changed()`。之后最多每 500ms 执行一次 `flush()`。自动保存每 2 秒才执行一次（第 760 行），所以几乎每一组编辑都会先触发一次草稿写入。
- [StudioCtx.tsx:6378–6420](../../../platform/wab/src/wab/client/studio-ctx/StudioCtx.tsx)：草稿内容通过 `bundler.bundle()` 对**站点和每一个依赖库**做全量遍历。保存路径本身用的是增量 `fastBundle`，草稿没有用。依赖库在同一版本下不会变化，却每次都重新 bundle。
- 数据从 Studio iframe 经 postMessage 传到顶层 frame，再经 IPC 传到主进程，中间做了两次结构化克隆。
- [drafts.cjs:66–79](../../../desktop/src/drafts.cjs)：主进程会读取并 `JSON.parse` 上一版草稿，然后对它 `JSON.stringify` 两次（一次算字节数，一次写 `.previous`），再序列化新草稿。也就是每次编辑要对 MB 级数据做 4 遍完整的 JSON 处理。

**为什么会表现为“点击慢”**：在 macOS 上，Electron 主进程的 JS 运行在浏览器 UI 线程，所有鼠标和键盘事件都要先经过这条线程才会转发给页面。主进程被 JSON 处理占住时，整个窗口的输入都会排队。这个时间线和反馈也吻合：草稿功能是 10-27 上线的。

### E2（中，列表）：骨架屏动画持续重绘

[ProjectPreview.tsx:86](../../../platform/wab/src/wab/client/components/dashboard/preview/ProjectPreview.tsx)：缩略图没有就绪的卡片会显示 `active` 骨架屏。antd 6.6.5 的这个动画改变的是 `background-position`，无法交给合成器处理，需要主线程每帧重绘。队列是串行的，后面的卡片可能等几十秒，期间多张卡片同时以 60fps 重绘。Retina 屏下像素量较大，Intel 核显受影响更明显。

### E3（低）：`before-mouse-event` 监听

[main.cjs:358](../../../desktop/src/main.cjs) 只关心 mouseDown 和 mouseWheel，但这个监听会对每一次 mouseMove 都进入主进程 JS。单次成本很低，主要会在主进程本来就繁忙时叠加延迟。

## 4. 影响排序（推断，待 trace 确认）

| 排名 | 场景 | 问题 | 理由 |
| --- | --- | --- | --- |
| 1 | 列表 | 缩略图生成占用主线程（F1+F2+F5） | 每个项目都要初始化运行时、生成代码、渲染并截图，按画板数成倍增加，并持续到所有可见卡片处理完 |
| 2 | 编辑器、全局 | E1 草稿全量备份 | 每次编辑触发，同时占用 Studio 主线程和 Electron 主进程，后者会阻塞整个窗口的输入 |
| 3 | 列表 | F3 构建哈希导致升级后全部重新生成 | 发版频繁，使排名 1 从“首次一次”变成“几乎每天都发生” |
| 4 | 列表 | E2 骨架屏重绘 | 与排名 1 同时存在，持续时间长 |
| 5 | 列表 | F6 草稿列表解析 | 只在存在草稿时有影响；每次窗口聚焦都会触发 |
| 6 | 列表 | F4 全量渲染 | 取决于项目数量 |
| 7 | 全局 | F7 和 E3 | 次要放大因素 |

## 5. 解决方案

### 5.1 不改变功能行为

| 编号 | 改动 | 针对 |
| --- | --- | --- |
| S1 | 在 `prepare()` 中让所有根组件共用同一个上下文对象，使 `computedFn` 能命中缓存 | F1 |
| S2 | 把 `assets` 缓存提升到 `generate()` 层级，在同一项目的各画板间复用 | F2 |
| S3 | 预览路径已经注入了 canvas 运行时，就不再把它拼到第一个组件库模块前面（只是去掉那段不会执行的代码） | F5 |
| S4 | 草稿：依赖库的 bundle 按（依赖 id、版本、bundle 版本）缓存 | E1 |
| S5 | 草稿主进程：在内存中缓存每个文件的 sequence、baseRevision、needsAttention 和字节数（所有写入都经过同一个队列）；`.previous` 改为 `copyFile`/`rename` 原文件，不再解析后重新序列化；字节数改用 `stat`。读取时如果回退到了 `.previous`，要保持原有语义 | E1 |
| S6 | 草稿列表：按（文件、mtime、size）缓存摘要，文件没变就不再解析 | F6 |
| S7 | `ProjectListItem` 加 `React.memo`；`Intl.DateTimeFormat` 按 locale 缓存；`onUpdate` 保持稳定引用 | F4 |
| S8 | update-ui：先检查变化记录是否涉及插槽，再执行查询和 `checkVisibility` | F7 |
| S9 | Desktop：在独立的 offscreen BrowserWindow（独立渲染进程，共享 session）里生成缩略图，通过 IPC 返回 PNG。浏览器版保持现状。这是根本解法，但需要做像素对比，确认输出一致 | F1/F2/F5 |

### 5.2 会改变行为 ⚠️（需要你决定）

| 编号 | 改动 | 行为变化 |
| --- | --- | --- |
| B1 | 缩略图在用户空闲时才开始生成（例如 1 秒内没有输入），有输入时在画板之间暂停 | ⚠️ 缩略图出现得更晚 |
| B2 | 只有已缓存但过期的缩略图降低优先级，排在缺失的之后 | ⚠️ 升级后旧图会显示更久 |
| B3 | 缓存键不再用 `COMMITHASH`，改用“预览渲染器版本”，只在渲染、代码生成或运行时变化时提升 | ⚠️ 组件库运行时有变化但没有提升版本时，旧图不会刷新 |
| B4 | 排队中的卡片使用静态骨架，只有正在生成的那张显示动画 | ⚠️ 视觉变化：大部分骨架不再闪动 |
| B5 | 提高缓存上限（64 张、16MiB） | ⚠️ 本地占用更大 |
| B6 | 草稿备份间隔从 500ms 放宽（例如 2s 或空闲时） | ⚠️ 崩溃时最多丢失的编辑窗口变长 |

## 6. 建议顺序

1. 先做 S1、S3、S4、S5。改动小，行为不变，覆盖排名 1 和 2。
2. 同时做一个诊断构建，开启 DevTools 或 contentTracing（正式包屏蔽了 `--remote-debugging-port`）。在 Intel 真机上对比：关闭 `dashboardCanvasPreview` 前后的列表点击延迟；编辑时主进程的长任务。
3. 根据 trace 决定是否做 S9，以及 B 类改动。

## 7. 实施状态（2026-10-29）

已实施 §5.1 中不改变行为的 S1–S8：

| 编号 | 文件 | 改动 |
| --- | --- | --- |
| S1 | `platform/wab/src/wab/client/components/dashboard/preview/renderer.ts` | 所有根组件共用同一个代码生成上下文 |
| S2 | `preview/engine.ts`、`preview/snapshot.ts` | 素材 data URL 缓存在同一项目的各画板间共享 |
| S3 | `components/studio/studio-bundles.ts`、`preview/renderer.ts` | 新增 `canvasRuntimeLoaded` 选项，预览路径不再附带那份不会执行的运行时副本；Studio 画布路径不受影响 |
| S4 | `client/studio-ctx/StudioCtx.tsx` | 草稿中的依赖库 bundle 按（依赖对象、bundler、id、bundle 版本）缓存 |
| S5/S6 | `desktop/src/drafts.cjs` | 摘要按（inode、size、mtime）缓存；`.previous` 改为原样复制文件字节；字节数改用 `stat` |
| S7 | `ProjectListItem.tsx`、`useProjectsFilter.ts`、`AllProjectsPage.tsx`、`WorkspacePage.tsx`、`TeamPage.tsx` | 卡片使用 `React.memo`，AppCtx 中的 `selfInfo` 和 `personalWorkspace` 显式作为 props 传入；Matcher 按 query 缓存；`onUpdate` 保持稳定引用；日期格式化器按 locale 缓存 |
| S8 | `desktop/src/update-ui.js` | `place()` 每帧最多执行一次，在绘制前完成；没有 rAF 的环境下保持同步执行 |

验证：

- 草稿存储：新旧实现执行同一组 800 个随机操作（写入、删除、列表、读取、损坏恢复、存储已满），结果和磁盘上的文件字节完全一致。
- 主进程实测（10.85MB 草稿，Apple Silicon）：单次写入最长事件循环阻塞从 110ms 降到 29ms，总耗时从 274ms 降到 127ms；文件未变化时，列表耗时从 65ms 降到 0ms。
- Studio 侧实测（同一份数据，11 个 bundle）：每次备份的打包耗时从 134ms 降到 18ms，只剩项目本身。跨进程复制的数据量没有变化，这一步仍约 60ms。
- `pnpm typecheck` 通过。相关 vitest（36 个文件、242 个测试）中，只有 `preview-codegen.test.ts` 的 6 个快照不一致。原因是 10-22 的提交改了生成的 `box-sizing` CSS，而快照最后更新于 10-20，与本次改动无关。
- 现有 `desktop/tests/drafts.test.cjs` 和 `update-ui.test.cjs` 全部通过；`update-ui` 测试另在带 rAF 的 JSDOM 中运行，也全部通过。

B6（放宽草稿备份间隔）不再需要：已改用 S4 和 S5 降低每次备份的成本，备份间隔保持 500ms。S9 已实施，见 §8。

S9 实施后，剩余 B 类项重新评估如下：

- B1 和 B2 的目的是避免缩略图生成占用列表页主线程，S9 已经解决了这个问题，暂不实施。只有 Intel 双核机器实测出现明显的 CPU 竞争时再考虑。
- B4 仍然有效：骨架屏动画由列表页主线程逐帧重绘，与缩略图在哪个进程生成无关。
- B3 和 B5 对响应速度的作用变小，但仍能减少重新生成的次数，从而节省 CPU 和电量。

B3、B4、B5 已实施（确认会改变行为）：

- B3：缓存只按项目 revision 和 `previewFormat` 判断是否有效，不再随每次发版失效。渲染输出有变化时需要手动提升 `previewFormat`（见 `preview/types.ts` 的注释）。
- B4：缩略图等待缓存或排队时显示静态骨架屏，只有正在生成的那张显示动画；已有缓存图片时直接显示图片。
- B5：缓存上限从 64 张、16MiB 提高到 256 张、64MiB；单张图片上限仍为 16MiB。

## 8. S9 实施与实测：Desktop 在独立进程中生成缩略图

实现：

- `desktop/src/dashboard-preview.cjs`：主进程为每个缩略图任务创建一个离屏 BrowserWindow（独立渲染进程，共用 Desktop session），任务串行执行；完成、失败、超时（90 秒）、取消，或列表页刷新/关闭时，销毁该窗口。
- `desktop/src/preview-host.html` 和 `preview-host-preload.cjs`：离屏窗口加载宿主页，用和列表页完全相同的方式嵌入 `/canvas-preview/index.html` 引擎，只把最终 PNG 交回主进程。引擎代码未改。
- `preload.cjs` 暴露 `desktopPreview`；`preview/client.ts` 检测到它时走独立进程，否则（浏览器版）保持原来的 iframe 方式。离屏窗口的 `deviceScaleFactor` 与列表页一致。
- 仅开发版生效的 A/B 开关：`PLASMIC_DESKTOP_PREVIEW_IN_PAGE=1` 恢复页内生成，打包版忽略该开关。

测量方法：同一个本地构建，开发版 Desktop 使用真实账号，打开“所有项目”页（4 张可见卡片）。每轮先清空缩略图缓存再重新加载，在生成全部可见缩略图期间，记录列表页主线程的长任务、事件循环延迟、鼠标事件排队延迟、通过 CDP 发送鼠标事件的往返时间，以及所有渲染进程 RSS 之和的峰值。测试机为 Apple Silicon。

| 指标 | 页内生成（2 轮） | 独立进程（4 轮） |
| --- | --- | --- |
| 列表页长任务 | 13–14 个，合计 1.4–1.5 秒，最长 279–289ms | 0–1 个，最长 52ms |
| 事件循环延迟最大值 | 277–283ms | 5–28ms |
| 鼠标事件排队延迟 p95 / 最大值 | 16–31ms / 98–186ms | 8–14ms / 9–35ms |
| 输入往返 p95 / 最大值 | 32–42ms / 99–258ms | 8–10ms / 10–49ms |
| 4 张缩略图全部完成 | 25.7 秒（首轮冷启动 52.9 秒） | 27.5–30.3 秒 |
| 渲染进程 RSS 峰值合计 | 1488–1627MB | 1233–1280MB |

说明：标签为 `in-page2` 的那一轮，因调试端口被上一实例占用，实际连到了独立进程模式的实例，已按实际模式计入独立进程一列。

像素对比（640×360 缩略图）：4 张中 2 张字节完全一致；另外 2 张有 6–49 个像素不同（不超过 0.02%）。同一模式下两次运行之间的差异也是同一量级（页内 vs 页内：39/42 像素；独立进程 vs 独立进程：33/32 像素），说明这些差异来自每次渲染本身的不确定性，而不是进程切换造成的。

结论：在这台机器上，独立进程让列表页主线程在缩略图生成期间不再出现长任务，输入延迟最大值从 100–260ms 降到 50ms 以内。生成总耗时基本不变（多 1–3 秒，主要是每个任务新建窗口的开销）。按每 1 秒采样一次的数据，内存峰值没有上升。Intel 上收益的大小，以及双核机器上的 CPU 竞争，仍需真机确认。
