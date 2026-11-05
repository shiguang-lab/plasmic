# 内存分阶段诊断

2026-11-05，在同一 Apple M4 和相同缓存、运行库版本、CPU 线程数下补测。每个配置一个全新进程，数值只用于定位增长阶段，不替代此前的三次资源统计。相邻阶段 RSS 差值不是各对象精确的所有权归因。

| 阶段，累计进程 RSS MiB | BGE INT8 | Bekko-static 128 INT8 | Bekko-static 256 INT8 | Granite INT8 |
| --- | ---: | ---: | ---: | ---: |
| Node 和探针数据已加载 | 45.0 | 45.0 | 45.0 | 44.9 |
| 推理/分词运行库已导入 | 86.8 | 86.8 | 86.8 | 86.8 |
| 分词器已加载 | 103.8 | 204.3 | 204.0 | 393.5 |
| 模型会话已加载 | 166.0 | 265.5 | 358.1 | 622.4 |
| 短查询结束 | 168.0 | 267.8 | 360.7 | 623.9 |
| batch=4 的 101 文档索引结束 | 453.0 | 291.5 | 384.5 | 831.4 |
| 索引后强制 JS GC | 453.1 | 275.3 | 367.8 | 832.3 |

阶段记录说明：

- 空进程与运行库已有固定开销；此前“模型占用”表实际包含整个工作进程，应继续称为进程 RSS。
- 分词器文件解析后是词表、匹配结构、字符串等运行时对象。Bekko 分词器加载后 heapUsed 约 100 MiB；Granite 约 168 MiB。这些是阶段值，包含其他 JS 对象，不等于分词器全部持久内存。JSON 文件大小不能代表运行时数据结构大小。
- 模型会话加载阶段有显著原生内存增长；RSS 包含权重、执行结构、可能的复制/预处理与分配器保留页。此次阶段测量无法把这些项逐字节分开，因此不声称全部权重被恢复为 FP32，也不把全部差额归因于权重复制。
- 批量长文本处理比短查询需要更多临时空间。JS GC 后 BGE/Granite 的 RSS 没明显下降，说明只回收 JS 对象不足以归还这些进程驻留页；不能仅凭这一点判断内存泄漏。
- 同时关闭 enableCpuMemArena / enableMemPattern 的对照，没有明显降低这几个模型的 RSS：索引结束分别约 BGE 452、Bekko 256 387、Granite 897 MiB。关闭图优化的 Bekko 256 约 384 MiB，也未明显下降。各配置仅一次，不能断言开关在所有平台无用；它们没有证明高内存由单一 ONNX arena 或图优化造成。
- release 会话及清空 tokenizer 引用、强制 GC 后进程 RSS 仍较高。原生分配器保留、尚存引用或回收生命周期的具体比例未定位，不能把 release 调用等同于立即归还全部 RSS。按需进程退出与操作系统回收应另做生命周期验证。

运行时指标定义见 [Node memoryUsage](https://nodejs.org/api/process.html#processmemoryusage)，其中 arrayBuffers 已包含在 external 内，不能重复相加；原生分配不一定完整反映在 JS heapUsed/external 中。ONNX 的 [allocator 说明](https://onnxruntime.ai/docs/get-started/with-c.html#features)解释了 arena 与预处理权重可能带来的额外占用，但不是本轮精确归因的证据。

使用 [diagnose-memory.mjs](diagnose-memory.mjs) 复现，模型和依赖准备方式见 [README](README.md)：

~~~sh
node --expose-gc low-memory/diagnose-memory.mjs bge default
node --expose-gc low-memory/diagnose-memory.mjs bekko128 default
node --expose-gc low-memory/diagnose-memory.mjs bekko256 default
node --expose-gc low-memory/diagnose-memory.mjs granite default
node --expose-gc low-memory/diagnose-memory.mjs bge no-arena
node --expose-gc low-memory/diagnose-memory.mjs bekko256 no-arena
node --expose-gc low-memory/diagnose-memory.mjs granite no-arena
node --expose-gc low-memory/diagnose-memory.mjs bekko256 no-opt
~~~

`*-memory-stages-*.json` 保存各阶段 rss、heapUsed、external、arrayBuffers 和操作系统 maxRSS。没有测延迟/质量对照，不将诊断开关作为产品优化方案。没有修改产品运行时代码或接入配置。
