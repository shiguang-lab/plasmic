# Compiler 代码展示组件的生产制品实验

记录日期：2026-11-06。白名单 Compiler 能避免代码展示的重复高亮工作。以下结果只适用于受控组件实验，整个编辑器的启动、交互和内存验收仍待完成。

两个制品均由相同源码 `cb44ec91fa9aa965fc3d506b5fc98215a02e383f02c38f4b9d358f4ed893d73e` 构建，React／ReactDOM 19.3.1、Compiler 1.0.0、Electron 相同，仅改变 `PLASMIC_REACT_COMPILER`。实际编译日志确认只有 `CodeDisplayContent` 参与，10 个 memo slots、3 个 memo blocks。

| 制品 | renderer hash |
| --- | --- |
| Z：Compiler 关闭 | `1a7efa83be3c16e86c0996f01f5518adf7483580c75e3cfd67c55e118b3c3973` |
| C：白名单 Compiler 开启 | `b1244e73ccaa1cd562dab128ef8faca356835f224ac8943629547e48ab6673e2` |

## 方法与结果

在隔离 GP 项目中通过已有 `codePreview` devflag 打开真实代码展示，使用实际生成的 **107,087 字符**代码。每个进程预热 5 次、测量 30 次；通过已挂载 `Loadable` 的公开 `forceUpdate()` 触发相同输入更新，统计原生 Highlight 实例的 `render()` 调用，并等待 React 提交回调、重建 DOM 行文本验证内容。计时包含提交等待和 DOM 文本校验，不是独立 CPU 时间或屏幕呈现时间。

关闭 debugger，没有并行构建或 CPU／堆采集。按 Z→C→C→Z 顺序运行，每种模式两个独立进程：

| 运行 | Highlight render 次数／30 次更新 | 中位耗时 ms | p95 ms |
| --- | ---: | ---: | ---: |
| Z4 | 30 | 32.10 | 33.20 |
| C1 | 0 | 0.90 | 1.00 |
| C2 | 0 | 1.00 | 1.10 |
| Z5 | 30 | 32.80 | 34.60 |

每个进程另外修改真实输入并恢复，DOM 内容均正确；接着执行 GP 的编辑、撤销重做、Preview 分页、保存重开，全部通过，无 renderer／Preview 错误。将实验整理成仓库工具后，Z/C 再各运行一次，分别为 30/0 次 Highlight render，内容正确并保存重开通过。该工具 hash 与所有采样见 [原始汇总](performance-code-display.json)。

这证明白名单缓存能跳过实际高亮子树的重复工作。测试主动制造相同输入重绘，不代表正常用户必然触发相同频率；首次代码生成、Prettier、首次高亮及整个编辑器的收益没有由此测出。两个进程／模式也未达到主升级方案的完整性能签收采样门槛。该历史实验使用当时的关闭默认值；当前源码已改为默认开启，扩大范围仍须完成正确性检查。性能对比按用户要求暂停。

## 重跑

以下回放使用上面已经归档的历史 Z/C 制品；其旧源码曾使用 `PLASMIC_REACT_COMPILER=1` 区分。当前源码已删除该开关，普通构建默认开启 Compiler，不能用这条旧环境变量生成当前的关闭对照。回放只使用私有离线 fixture 和独立 profile：

```sh
PERF_CODE_DISPLAY=1 PERF_NO_DEBUG=1 PERF_OPEN_SESSIONS=1 PERF_OPENS=1 \
PERF_RETAIN_DASHBOARD=1 PERF_RETURN_TIMING=1 PERF_OPEN_FUNCTIONAL=1 \
PERF_BUILD_ROOT=/absolute/path/to/archived/renderer \
PERF_PROFILE_KEY=unique-profile-key \
desktop/node_modules/.bin/electron desktop/tests/performance/real-project-open.cjs \
/absolute/path/to/private/gp-fixture unique-run-name
```

`PERF_CODE_DISPLAY` 仅为本实验在进程内的 fixture 开启已有 devflag，不修改保存的项目模型。工具验证输入变化和恢复，记录辅助脚本 hash；保存发生在离线回放后端。生产制品、正式配置和真实项目不启用该参数。
