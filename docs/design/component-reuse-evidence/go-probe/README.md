# Go embedding 运行方式实测

2026-11-05，Apple M4 / 24 GiB / macOS arm64。测试 Hugot v0.8.5 和 go-potion v0.1.2（commit c3ca68d3e5dfcc54226acc597c19ddbcc8caef9f），编译器 Go 1.27.0。只新增离线探针和证据，没有更改产品代码或项目依赖。

## 结果

使用同一 [冻结语料](../data.json)：101 份组件文档、37 条有候选查询、4 条无候选或不适用查询。每个配置先执行质量评测，再用三个独立进程串行测资源。表格取各项三次中位数；P95 是三个单次 P95 的中位数，不是合并样本 P95。

| Go 配置 | 首位 / 37 | 前三 / 37 | 查询后 RSS | 含索引峰值 RSS | 预热查询 P95 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Hugot + BGE-small-zh INT8 + ORT | 7 | 15 | 106.1 MiB | 465.7 MiB | 2.77 ms |
| Hugot + Granite 97M multilingual INT8 + ORT | 20 | 30 | 445.8 MiB | 746.8 MiB | 4.98 ms |
| go-potion + potion-base-8M F32 | 4 | 7 | 16.8 MiB | 33.4 MiB | 0.037 ms |
| go-potion + potion-multilingual-128M F32 | 13 | 20 | 117.9 MiB | 153.2 MiB | 0.086 ms |

Hugot 使用与 [Node 低内存探针](../low-memory/README.md)完全相同的 BGE/Granite ONNX 文件和同一个 ONNX Runtime 1.30.0 dylib，CPU intra-op=2、inter-op=1；Go 调度 GOMAXPROCS=2。分词使用 go-huggingface v0.4.17 的纯 Go 实现。

Node 对照的 BGE/Granite 查询 RSS 为 167.5 / 616.6 MiB，Go 降低约 37% / 28%。含索引峰值的 Node 对照为 448.3 / 822.6 MiB：Go BGE 的峰值没有降低，Granite 有所下降。因此不能把查询阶段的节省比例外推到整个生命周期。

| Go 配置 | 本地初始化 | 首次查询 | 预热 P50 | 101 文档索引 |
| --- | ---: | ---: | ---: | ---: |
| Hugot + BGE INT8 | 43.6 ms | 3.03 ms | 2.40 ms | 2848 ms |
| Hugot + Granite INT8 | 476 ms | 5.49 ms | 3.75 ms | 5342 ms |
| go-potion 8M | 7.39 ms | 0.070 ms | 0.007 ms | 2.54 ms |
| go-potion multilingual 128M | 352 ms | 0.187 ms | 0.036 ms | 503 ms |

本地初始化包含库自己的 session/分词器/模型加载，不包括编译、下载、子进程启动和进程包级 init；与 Node 单列运行库 import 的口径不同。使用本地缓存，未清空 OS 文件缓存。每个进程先跑首次查询、预热一条，再重复原先十条短中文摘要共 30 次；之后 batch=4 建 101 文档向量。不是 MCP 总检查或 Studio 扫描耗时。

波动必须保留：Go BGE 的索引峰值三次为 465.7–501.6 MiB，Granite 为 717.5–752.3 MiB；go-potion 多语言的单次 P95 范围是 0.075–2.290 ms，8M 的索引耗时范围是 2.16–49.39 ms。样本太少，不能据中位数承诺所有调用稳定在该值。

## 正确性与兼容边界

### Hugot

- 复用相同模型 revision、权重 SHA-256 和 CPU 动态库。默认 FeatureExtraction 的均值池化不适用于 BGE/Granite；探针使用 Hugot 公开的 tokenize/create-tensor/run-session 接口，明确取 CLS 并 L2 归一化，没有修改 Hugot 源码。
- go-huggingface v0.4.17 的 EncodeWithAnnotations 没有落实 MaxLen 选项，BGE 初次试跑出现 611-token 输入超过 512 的错误。正式探针在 token 层截取前 512 项，匹配 Transformers.js 4.3.2 实际截断结果；这只存在于探针，不是已经完成的产品接入。
- BGE：全部 142 条文档/查询的 token IDs 与 Node 一致；14 个抽样向量最大逐元素差约 2.3e-8，前三命中同为 15/37。
- Granite：135/142 条 token IDs 一致，7 份文档不同；14 个抽样向量最大差约 3.4e-8，但这些向量不覆盖所有有分词差异的文档。前三同为 30/37，不能据此认定分词和输出全等。差异位置见 [validation.json](validation.json)，Node token/vector 原始输出为 `node-parity-*.json`。
- 现有 Gemma 2 q4 导出在 Hugot 未修改的加载器报 `input video_features not recognized`，没有完成直接运行，不伪造 Gemma 的 Go 资源数据。[错误输出](hugot-gemma-quality.stderr.log)
- 额外探索了 Hugot/GoMLX 的纯 Go 后端：BGE 质量试跑 207 秒仍未完成，停止时 RSS 约 645 MiB。没有取得完整质量/延迟结果，不列入正式表格。这次探索的截断末尾 token 处理与正式对照不同；不能当作对所有纯 Go 后端的评判。

### go-potion

- 模型与 Hugot/Bekko 不同，不能把质量或内存差异全部归因于 Go。8M 为英文模型路线；多语言型号包含中英文。
- 使用指定 revision 的 F32 safetensors 和分词器。原始文件合计约 30.9 MB / 531.0 MB；库通过 mmap 按访问触及权重页面，低 RSS 不代表整个模型只有 118 MiB，也不保证覆盖更多词汇后仍保持同样占用。映射中的驻留页已计入本轮 RSS，未访问页面不计入。
- 库会把 safetensors header 对齐到 4096 字节，配置中的源文件哈希和加载后哈希分别记录在 [potion-models.json](potion-models.json)；对齐不改变向量数值。
- 库没有公开 token 上限选项，因此用相同原文片段、不按 512 tokens 截断。8M 有 1 份、多语言有 4 份文档超过 512 tokens，最长分别为 558 / 571。不能称为与 Transformer 组完全相同的 token 预算；这种差异不影响 Hugot/Node 的同模型对照。
- 上游 Go module 未携带 `validation/samples/*.json`，选定两个型号的上游参考测试因缺失文件失败，原始日志保留在 [potion-reference-tests.jsonl](potion-reference-tests.jsonl)。随后独立使用官方 model2vec 0.8.2、Rust tokenizers、NumPy 与相同本地权重验证：两个型号各 142 条 token IDs 全部相同，14 个向量最大差均小于 3.3e-8。[参考结果](potion-python-parity.json)

## 内存测量

[run-one.py](run-one.py) 从父进程调用 macOS proc_pidinfo(PROC_PIDTASKINFO)，每 20 ms 采样子进程 RSS；在 baseline/loaded/queried/indexed 等阶段握手暂停子进程，再记录阶段 RSS。Python 观察器内存不计入。含索引峰值来自子进程 Darwin getrusage 的 maxRSS（字节）；不能与 Node 的 maxRSS KiB 原值直接比较。Go heap/sys 另列，不冒充整个进程占用。

资源摘要、范围及原始阶段见 [summary.json](summary.json) 和 `*-resources-{1,2,3}.json`；全部查询排名、token IDs 和抽样向量在 `*-quality.json`。没有控制真实 Studio 并行操作、评估其他平台、校准负例提示阈值或验证 Agent 处理建议。不是生产验收。

当前结论：Go 可以减少部分运行和分词开销，Hugot + Granite 值得继续验证；尚未证明“几十 MiB 进程占用并保持 Gemma q4 34/37 的召回基准”。Gemma 的现有导出兼容、Granite 分词差异及 Go helper 的打包/生命周期仍需单独验证，暂不改变产品架构。

## 复现

Go 依赖固定在 [go.mod](go.mod) / [go.sum](go.sum)，需要 Go 1.27；本机自动工具链下载与全部依赖均在临时目录或开发工具缓存，不改项目依赖。权重、二进制、虚拟环境和下载分片不归档。Hugot 二进制约 24 MiB、go-potion 约 9.9 MiB，均不含模型；每次结果记录实际二进制 SHA-256。

先按父目录和 low-memory 目录的复现说明准备同一 Node 模型目录，再在本目录的临时副本中执行：

~~~sh
go build -tags ORT -o hugot-probe ./cmd/hugot
go build -o potion-probe ./cmd/potion
python3 download-potion.py
~~~

在本目录建立 `ort-lib/libonnxruntime.dylib`，指向 Node 依赖中 `onnxruntime-node/bin/napi-v6/darwin/arm64/libonnxruntime.1.30.0.dylib` 的真实路径。下面的 NODE_PROBE_PATH 替换为已准备的 Node 探针绝对路径：

~~~sh
python3 run-one.py hugot bge quality --node-root NODE_PROBE_PATH
python3 run-one.py hugot granite quality --node-root NODE_PROBE_PATH
python3 run-one.py potion potion8 quality --node-root NODE_PROBE_PATH
python3 run-one.py potion potionMulti quality --node-root NODE_PROBE_PATH
python3 run-one.py hugot granite resources --repeat 1 --node-root NODE_PROBE_PATH
~~~

对四个配置分别运行 repeat=1、2、3，串行执行。run-one.py 默认 180 秒安全截止，不在正式测量中联网下载模型。go-potion 下载脚本固定 revision、核验原始 LFS SHA-256，首轮加载会对齐缓存 header；对齐后的校验值参照 manifest 中的 preparedFiles。若再次执行下载脚本，会重新按源文件准备缓存，再由库对齐。

一致性检查：`node node-parity.mjs NODE_PROBE_PATH bge node-parity-bge.json`，Granite 同理。Python 参考使用 CPython 3.11、model2vec 0.8.2，脚本为 [potion-parity.py](potion-parity.py)，执行时传父目录 data.json 的真实路径；其余 Python 参考依赖实际版本记录在结果 JSON 中。Go 探针通过 `go test ./internal/probe ./cmd/hugot ./cmd/potion` 编译检查，这些包没有单独单元测试，正确性证据来自实际查询和跨实现对照。
