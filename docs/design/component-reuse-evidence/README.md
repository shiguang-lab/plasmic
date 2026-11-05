# 组件复用检索初筛证据

日期：2026-11-04，补测至 2026-11-05。当前质量基准为 EmbeddingGemma 2 纯文本 ONNX q4；低内存客户端优先继续验证下述 GGUF 路线。不是生产验收，也不证明它在所有项目最优。[主方案](../component-reuse-advisory.md)给出输入协议、扫描与等待边界。

2026-11-05 的 [低内存候选实测](low-memory/README.md) 补充 Bekko-static 128/256 维 INT8、BGE-small-zh INT8、Granite 97M multilingual INT8 的质量和三次独立进程资源数据。四者均未证明能在显著减少内存的同时保持现有质量基准，暂不更换工程首选。

同日的 [Go 运行方式实测](go-probe/README.md)比较 Hugot + ONNX Runtime 与 go-potion：Hugot + Granite 查询 RSS 约 446 MiB、前三 30/37；go-potion 多语言查询 RSS 约 118 MiB、前三 20/37。包含三次资源测量、分词/向量对照及当前兼容边界，不是生产接入。

同日的 [Gemma 原生运行实测](native-gemma/README.md)比较 LiteRT 与 llama.cpp GGUF：查询 RSS 约 384 / 360 MiB，前三 30 / 33，短查询 P95 约 34 ms。GGUF 是当前更值得继续验证的低内存客户端候选，但首位命中低于原 ONNX q4；LiteRT 曾测到 556 MiB 峰值。包含两次质量评测、六次资源进程及 GGUF 全部 142 条 token IDs 对照，不代表整进程低于 200 MiB 或 Studio 已通过验收。

## 数据与结果

[data.json](data.json)冻结 101 份仓库组件文档片段及源文件哈希、41 条手工编写/标注的摘要和模型 revision。37 条有可接受候选，4 条无候选或不适用。文档取注册名和前 1800 字符；不是当前项目的完整运行时契约。标注没有独立复核，也没有最终独立留出验收集。

各模型采用自己的查询/文档前缀、512-token 上限及 L2 归一化，按余弦排序；没有加入 BM25 或 reranker，也没有校准建议阈值。4 条负例只保存排名，不能宣称已控制误提示。

| 结果文件 | 首位命中 / 37 | 前三命中 / 37 | MRR |
| --- | ---: | ---: | ---: |
| [E5-small q8](e5-results.json) | 9 | 15 | 0.3724 |
| [Qwen3 q8](qwen-results.json) | 22 | 31 | 0.7244 |
| [Gemma 2 文本 q8](gemma-results.json) | 20 | 30 | 0.6942 |
| [Gemma 2 文本 q4](gemma-q4-results.json) | 24 | 34 | 0.7568 |

q4 在本样本更好，不代表量化通常提升精度。E5/Gemma q8 结果的 source 文本使用排除前 103 份文档的描述；实际 documentCount、输入和计分均为 101 份。

## 资源探针

Apple M4、24 GiB RAM，macOS arm64，Node v24.20.0，Transformers.js 4.3.2，ONNX Runtime Node 1.30.0，CPU，intra-op 2 线程、inter-op 1 线程。新进程使用本地缓存，未清理操作系统磁盘缓存，不计网络下载。

每次先运行首条、再预热一条，然后重复十条正例摘要共 30 次。计时包含摘要格式化、tokenization、模型前向和 pooling/normalize，不是完整检索或 MCP/Studio 测试。RSS 包含 Node、运行库、tokenizer 和模型。

| 文件 | 本地模型加载（不含运行库 import） | 预热 P50 / P95 | 查询后 RSS |
| --- | ---: | ---: | ---: |
| [Qwen3 q8](selected-resources.json) | 594 ms | 72 / 79 ms | 1651 MiB |
| [Gemma 2 文本 q8](gemma-q8-resources.json) | 550 ms | 101 / 110 ms | 840 MiB |
| [Gemma 2 文本 q4](gemma-q4-resources.json) | 515 ms | 54 / 63 ms | 617 MiB |

运行库 import 单列在原始文件。q4 本轮采样峰值接近查询后 RSS；没有测量整库索引构建、长文档批次或真实 Studio 并行操作。样机数据不构成其他平台的保证。

## 复现

将 data.json、evaluate.mjs、benchmark-selected.mjs 复制到临时目录后执行：

~~~sh
npm install --save-exact @huggingface/transformers@4.3.2 onnxruntime-node@1.30.0
node evaluate.mjs gemma q4
node --expose-gc benchmark-selected.mjs gemma q4
~~~

质量脚本首次下载固定 revision 的公开模型文件，不向外部推理 API 发送查询；资源脚本禁止远程加载，必须先准备缓存。大文件下载曾在本机网络中断，本轮用分段下载和 Hugging Face LFS SHA-256 核验恢复；网络时间不计为本地推理时间。

示例安装未冻结所有传递依赖，复现须核对实际版本。摘要由手工编写，不能证明长对话 Agent 能正确生成必填参数。[evidence-index.json](evidence-index.json)记录归档文件哈希；不归档模型权重、缓存或 node_modules。
