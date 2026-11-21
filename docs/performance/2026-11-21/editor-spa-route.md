# Desktop 普通前端路由的打开速度和退出内存

2026-11-21。在同一个顶层文档里从项目列表进入编辑器，暖开首画布中位数为 **776 ms**，当前 Desktop 为 **1,250 ms**。诊断堆快照中，返回列表后找不到标记的旧编辑器对象。连续进出时，渲染进程仍会保留大量驻留内存。分支保留了可复现的路由实验，生产导航继续使用原实现。

## 对照条件

- macOS 26.6.2，Apple M4，24 GiB，Electron 45.2.1。两侧使用同一套已安装 0.9.13 的发布渲染资源（`00255c46e`）、同一窗口尺寸和独立临时 profile。当前分支从 `4f2aa36e3` 建立。
- 从本地 Material UI 33 页发布快照提取原 Site，保留模型和组件库，使用合成的项目、所有者和权限，按普通可编辑项目接口回放。项目有 9,862 个本地对象，初始分组有 9 张画板。图片来自本地快照。服务请求使用离线回放，WebSocket 断开，覆盖事件流使用空响应；没有登录、线上保存或真实网络延迟。
- A 使用 Desktop 的 `StudioWindow` 和原生导航桥。B 使用 Electron 的单一页面和应用现有的前端路由，测试启动时省去负责切换原生视图的导航桥。两侧均点击真正的项目卡片和编辑器返回链接。逐次检查首画板已经渲染、视口就绪、9 张初始画板最终完成、回到列表后没有子 frame。B 还逐次检查列表、编辑器、返回后的顶层文档有同一个 `performance.timeOrigin`。
- 这些是项目打开和返回实验。Desktop 草稿保护、原生菜单、跨账号导航和发布模板需要单独集成。实验过程中未修改安装包。普通路由从已挂载的列表进项目会读取项目元信息和可信 Host，再读模型。A 在新文档中走合并启动请求。因此线上 RTT 会改变两者的差值。

## 打开速度

独立进程按 A / B / B / A 顺序串行，每进程打开 5 次。排除每个进程第 1 次，各侧 8 个暖样本全部计入。首画布取点击至 `canvas-revealed`，响应画板和视口的外部观察另列。各项均为中位数，单位 ms。

| 项目 | 独立编辑器 A | 普通路由 B |
| --- | ---: | ---: |
| 首画布揭示 | 1,250 | 776 |
| 外部观察到画板和视口就绪 | 1,279 | 828 |
| 9 张画板全部渲染 | 2,700 | 2,039 |
| 4 倍 CPU 降速下的首画布揭示 | 4,645 | 3,089 |

CPU 降速单独执行，每侧 1 个进程，排除首次后各 2 个样本，仅用于看方向。该设置作用于 Chromium 渲染目标，不能模拟低内存或整台低配电脑。首画布揭示也不等于真实键鼠输入延迟。

## 对象是否释放

在单独的普通路由进程里连续进出 4 次。每次给该会话的 StudioCtx、Site、编辑器 Document 和 9 个 ViewCtx 加上独有的诊断属性，核对编辑器与顶部文档位于同一渲染进程。堆快照按对象的属性边计数，避开标记字符串自身带来的误报。

| GC 后的堆快照 | 带会话标记的对象 | JS 存活堆 | Document 数 |
| --- | ---: | ---: | ---: |
| 首次进入，9 张画板就绪 | 12 | 172.6 MiB | 15 |
| 第 4 次退出回到列表 | 0（所有 4 次标记） | 32.5 MiB | 2 |

另一个 8 轮进程只读堆与 DOM 计数，全程无主动 GC。初始列表有 2 个 Document。最后返回 5 秒时有 87 个，30 秒时自然降回 2 个，JS 已用堆从 542 降至 62 MiB。这支持旧页面可自然回收。标记覆盖指定的对象，无法单凭这些对象排除其他缓存或原生分配。

## 退出后的自然驻留

每次等所有初始画板渲染完成，点击编辑器内的返回链接，在项目卡片出现约 500 ms 后采样。连续 20 次回放中没有主动 GC、堆快照或调试器。下表是当前可见渲染进程的工作集，单位 MiB。独立视图组每次都验证旧编辑器 PID 已退出；普通路由组始终使用同一顶层文档。

| 使用原始 HTML 的 20 轮 | 初始列表 | 第 1 次返回 | 第 10 次返回 | 第 20 次返回 | 最后静置 5 秒 | 最后静置 30 秒 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 独立编辑器 | 243 | 243 | 227 | 228 | 228 | 228 |
| 普通路由 | 240 | 773 | 2,524 | 3,399 | 3,375 | 1,246 |

另一轮保留诊断 HTML 观察器的普通路由同样连续进出 20 次，最后返回时 2,500 MiB，静置 30 秒后 1,099 MiB。单轮绝对读数有波动。再把使用节奏改成**每次返回都停 30 秒**，普通路由 5 次静置后分别为 503、528、540、710、559 MiB，初始列表为 240 MiB。快速切换时的峰值和慢节奏时的稳态应分开看。这里的进程工作集可能含共享页；所有进程的工作集之和另记在逐轮数据中。

另做了单画板对照：在离线模型中只移除首个分组的另外 8 个画板成员引用，保留 33 页和完整组件库。普通路由每次实际挂载 1 张画板，20 次返回后约 2,429 MiB，最后静置 30 秒为 1,018 MiB。减少初始画板有帮助，这一项单独调整仍不能让列表恢复到初始的 241 MiB。该对照只有一轮且改变了首屏内容。

### 哪些内存还在

另起普通路由进程，用 Chromium 的详细内存转储检查 4 次进出。按同一渲染 PID 读取分配器报告的 `size`（MiB）。这些是 Chromium 内部分类，涵盖堆容量、对象、图像资源和底层分配器，存在重叠，不能相加解释 RSS。

| Chromium 计数 | 初始列表 | 第 4 次返回 | 该次返回后 30 秒 |
| --- | ---: | ---: | ---: |
| V8 主堆容量 | 47 | 489 | 204 |
| 合成器图片内存 | 1 | 107 | 107 |
| 合成器图块内存 | 75 | 186 | 27 |
| Blink GC 内存 | 10 | 119 | 57 |
| malloc | 44 | 211 | 183 |
| PartitionAlloc | 45 | 293 | 143 |

应用已断开对被测旧页面对象的引用。图块内存能自然下降；图片资源计数仍约 107 MiB，V8 也保留了大于初始列表的堆容量。这个样本能定位需要继续调查的资源类别，无法把全部剩余占用归因于某一行 JS。未发现可以通过再删一个旧 StudioCtx 引用就让进程回到初始大小的证据。

## 编辑与恢复检查

另起普通路由运行，使用 `PERF_ROUTE_EDIT=1 PERF_OPENS=2`。第一次打开后，重命名页面、撤销、重做，执行完整保存（离线回放接收一次）。通过编辑器返回链接回到列表，再点项目卡片，核对保存的页面名和修订号一致，顶层文档保持同一个。另以 `PERF_OPEN_NATIVE=empty PERF_OPENS=2` 检查真实本地草稿 IPC 和保存视口，空草稿目录初始化成功，第二次打开的视口偏差为 0。两组均无渲染错误和意外写入。这些回归不覆盖未保存草稿离开保护或真实服务端保存。

**分支结论。** 普通前端路由满足本样本的打开速度和旧业务对象可回收目标；连续打开后，退出时的渲染进程工作集明显高于当前方案。若低配电脑需要返回列表后快速释放这一部分内存，当前实验还不能替代独立编辑器视图。进一步减量应针对实际的图片缓存和各画板运行时分配做单项对照。

## 复现

使用 [Desktop 离线回放的 fixture 格式](../../../desktop/tests/performance/README.md)；可在 fixture 的 `images/` 中按资源文件名提供项目图片。每组使用不同的运行名和 profile。原始报告、截图、快照含项目数据，请保存在私有目录。仓库中的 [逐轮测量](editor-spa-route.json) 仅记录构建、模型摘要、计时和内存数据。

```sh
export PERF_BUILD_ROOT=/path/to/renderer
export PERF_NO_DEBUG=1 PERF_ROUTE_STUDY=1 PERF_BLOCK_PHYSICAL_INPUT=1
runner=desktop/tests/performance/real-project-open.cjs
electron=desktop/node_modules/.bin/electron
fixture=/path/to/private-fixture

PERF_OPEN_SESSIONS=1 PERF_OPENS=5 "$electron" "$runner" "$fixture" desktop-a1
PERF_OPEN_SESSIONS=0 PERF_OPENS=5 "$electron" "$runner" "$fixture" spa-b1
PERF_OPEN_SESSIONS=0 PERF_OPENS=5 "$electron" "$runner" "$fixture" spa-b2
PERF_OPEN_SESSIONS=1 PERF_OPENS=5 "$electron" "$runner" "$fixture" desktop-a2

PERF_OPEN_SESSIONS=0 PERF_OPENS=20 PERF_ROUTE_CLEAN=1 PERF_ROUTE_SETTLE=1 \
  "$electron" "$runner" "$fixture" spa-memory
PERF_OPEN_SESSIONS=0 PERF_OPENS=4 PERF_ROUTE_HEAP=1 \
  "$electron" "$runner" "$fixture" spa-heap
python3 desktop/tests/performance/route-heap-markers.py \
  "$fixture/spa-heap-active.heapsnapshot" "$fixture/spa-heap-returned.heapsnapshot"
```

`PERF_ROUTE_SETTLE=each` 在每次返回后等待 30 秒。`PERF_ROUTE_COUNTERS=1` 在单独轮次读取 JS 堆及文档数。`PERF_ROUTE_CLEAN=1` 保留原始 HTML，省去诊断脚本注入。`PERF_ROUTE_CPU_RATE=4` 使用 CDP 降速。在独立轮次加上 `PERF_ROUTE_MEMORY_DUMP=1 PERF_ROUTE_SETTLE=1`，可生成冷列表、最后一次画布和返回前后的 Chromium trace，以 Perfetto 的 `traceconv json` 转换并读取渲染 PID 的分配器计数。正式计时与强制 GC、堆快照、降速或内存分析分别执行。
