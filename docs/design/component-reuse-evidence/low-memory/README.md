# 低内存 embedding 候选实测

日期：2026-11-05（Asia/Shanghai，原始结果时间为 UTC）。本轮完整测试四个候选；不修改产品运行时或项目依赖。

[内存分阶段诊断](memory-breakdown.md)补充运行库、分词器、模型会话、长文档索引及回收阶段的数据，并记录禁用内存池/图优化的单次对照。RSS 是当前运行方式的实际占用，不是模型理论最低内存。

## 结果

沿用 [data.json](../data.json) 的 101 份组件文档和全部 41 条查询，其中 37 条有标注候选、4 条无候选或不适用。原始数据 SHA-256 未改变。没有增加提示词翻译、BM25、混合召回或 reranker。

Apple M4、24 GiB RAM、macOS arm64；Node v24.20.0、Transformers.js 4.3.2、ONNX Runtime Node 1.30.0，纯 CPU，intra-op 2、inter-op 1。每模型单独执行质量评测，另开三个独立进程测量资源，串行运行；资源表为三个进程各项指标的中位数。P95 为三个单次 P95 的中位数，不是合并样本的 P95。

| 模型 | 首位 / 37 | 前三 / 37 | 前五 / 37 | MRR | 文件合计 MiB | 查询后 RSS MiB | 含索引峰值 MiB |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Bekko-static 128d INT8 | 7 | 15 | 18 | 0.3214 | 30.0 | 267.8 | 291.9 |
| Bekko-static 256d INT8 | 10 | 19 | 22 | 0.4258 | 54.5 | 361.8 | 384.8 |
| BGE-small-zh-v1.5 INT8 | 7 | 15 | 18 | 0.3367 | 23.3 | 167.5 | 448.3 |
| Granite 97M multilingual INT8 | 20 | 30 | 33 | 0.6979 | 117.5 | 616.6 | 822.6 |

文件合计包括选中 ONNX、分词器及所需配置，不包括运行库。MiB = 1,048,576 字节。RSS 包含整个独立 Node 进程，不是权重内存，也不是 Studio 总内存；索引峰值使用操作系统累计 maxRSS，覆盖加载、短查询和随后 batch=4 的 101 文档索引。查询后 RSS 是当时值，不代表查询期间最大值。12 次测量中含索引峰值范围分别为 291.7–292.1、384.2–385.0、448.2–448.4、822.1–830.7 MiB。

| 模型 | 运行库 import | 本地模型加载 | 首次查询 | 预热 P50 / P95 | 101 文档索引 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Bekko-static 128d INT8 | 45 ms | 155 ms | 2.0 ms | 0.070 / 0.139 ms | 29 ms |
| Bekko-static 256d INT8 | 44 ms | 156 ms | 1.9 ms | 0.078 / 0.178 ms | 32 ms |
| BGE-small-zh-v1.5 INT8 | 45 ms | 51 ms | 5.1 ms | 2.54 / 2.96 ms | 2586 ms |
| Granite 97M multilingual INT8 | 45 ms | 433 ms | 24.2 ms | 3.42 / 4.51 ms | 5239 ms |

本地加载不含运行库 import。每个资源进程先执行首次查询，再预热一条，再重复原来十条短中文摘要共 30 次。计时包括分词、模型执行、pooling 和 L2 归一化，不包括网络、子进程启动、BM25/向量融合、契约核查或 MCP/Studio。未清理 OS 磁盘缓存，因此是“新进程本地加载”，不是冷磁盘启动。

## 判断

- 小权重文件不等于小进程内存。本轮没有找到整进程低于 100 MiB 且保持现有召回水平的替代模型，也不能据此证明所有运行方式都做不到。
- Bekko-static 查询极快，但本样本的前三命中只有 15/37 和 19/37；不能因为通用榜单接近某个大模型就假定组件检索也接近。128/256 维使用专用小权重文件，没有加载 1024 维后仅截短输出。
- BGE 的查询 RSS 最小，但当前中英混合组件文档上的前三命中为 15/37；batch=4 构建索引仍有约 448 MiB 峰值。此结果不能外推为纯中文检索差。
- Granite 的前三命中为 30/37，查询很快，但查询 RSS 约 617 MiB，没有实现相对于现有 Gemma 2 文本 q4 探针的显著内存下降。
- 既有 Gemma 2 文本 q4 初筛为 34/37、查询后 RSS 617 MiB、P95 63 ms。旧探针只测短查询，没有索引峰值，不能把旧 617 MiB 和本轮含索引峰值直接比较；旧探针也只执行一个资源进程。
- 暂不以这四个模型替换现有质量基准；这些结论是离线初筛，不是生产模型验收。尤其是 4 条负例没有校准阈值，不能报告误提示率已达标。

## 接口和正确性

通过本地 ONNX Runtime Node 直接执行所选文件，分词使用同版本 Transformers.js，避免为静态模型错误套用通用 Transformer pipeline。

- Bekko：依照作者的 [backend 实现](https://huggingface.co/hotchpotch/bekko-static-embedding-v1/blob/c18167b8f244c1bc6de21ce9b710bac8a29c4615/bekko_static_backend.py)，不添加 CLS/SEP，输入 input_ids / attention_mask，取模型 sentence_embedding，最后 L2 归一化。无查询前缀。
- BGE：查询加 `为这个句子生成表示以用于检索相关文章：`，文档不加前缀，使用 CLS pooling 和 L2 归一化。[原模型说明](https://huggingface.co/BAAI/bge-small-zh-v1.5)
- Granite：查询/文档均无前缀，CLS pooling 和 L2 归一化。[原模型说明](https://huggingface.co/ibm-granite/granite-embedding-97m-multilingual-r2)

所有模型使用同一 512-token 上限、同一原始文档片段。质量脚本检查输出维度、有限非零向量，并对两条长短不同的文本比较 batch/单条编码，静态模型差值为 0、BGE/Granite 最大差值约 0.0033；量化 Transformer 的 batch 数值会有差异。这不是与原始 FP32 模型的精度等价证明。

结果没有独立标注复核、独立留出集，也不包含实际安装版本契约、Agent 二次评估行为、Electron 打包、并行画布操作或其他目标机器。本节只报告 Node 基线，[Go 运行与分词对照](../go-probe/README.md)另列；批量大小和图优化尚未系统调优，不能把 RSS 视为模型理论最低内存。

## 原始证据与复现

[models.json](models.json) 固定三个模型仓库的 commit、四个选中模型文件及全部资产 SHA-256；[summary.json](summary.json) 保存汇总和三次范围。`*-quality.json` 保存全部 41 条查询的前五排名；`*-resources-{1,2,3}.json` 保存逐次查询计时、内存阶段和硬件信息。权重、缓存和 node_modules 不归档。

把父目录 data.json 和本目录复制到临时目录，保持层级，依赖装在父目录，执行：

~~~sh
npm install --save-exact @huggingface/transformers@4.3.2 onnxruntime-node@1.30.0
python3 low-memory/download.py
node low-memory/run.mjs bekko128 quality
node low-memory/run.mjs bekko128 resources 1
~~~

替换 key 为 bekko256、bge、granite，资源 repeat 分别为 1、2、3；按顺序串行运行，避免相互争用。下载脚本只访问固定 revision 的公开模型文件，核对大小和 LFS SHA-256，并记录小配置文件 SHA-256；推理阶段禁止远程加载，不向外部推理 API 发送查询。依赖示例没有冻结所有传递依赖，复现须核对记录版本。
