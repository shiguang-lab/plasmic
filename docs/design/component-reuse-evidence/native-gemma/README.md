# EmbeddingGemma 2 原生运行方式实测

2026-11-05，Apple M4 / 24 GiB / macOS 26.6.2 arm64，纯 CPU、2 线程。比较 LiteRT 的纯文本 INT4 与 llama.cpp 的 GGUF UD-Q4_K_XL；没有修改产品代码或项目依赖。

## 结果

复用同一 [冻结语料](../data.json)：101 份组件文档、37 条有候选查询、4 条无候选或不适用查询。新配置分别做一次完整质量评测、三次独立进程资源测量，串行执行。资源表取三次指标的中位数；P95 为三个单次 P95 的中位数，不是合并样本 P95。

| 配置 | 首位 / 37 | 前三 / 37 | 前五 / 37 | 查询后 RSS | 短查询 P95 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 原 Node / ONNX q4 对照 | 24 | 34 | 34 | 616.6 MiB | 63.13 ms |
| Python API / LiteRT INT4 | 22 | 30 | 33 | 383.5 MiB | 33.51 ms |
| 原生 llama.cpp / GGUF Q4 | 20 | 33 | 34 | 360.3 MiB | 34.38 ms |

GGUF 的查询 RSS 相比旧 Node 探针降低约 42%，且比本轮 LiteRT 更低；前三命中接近原基准，但首位命中也从 24 降至 20，不能称为精度不变。当前更值得继续验证的客户端低内存候选是 GGUF；ONNX q4 保留为质量参考，不把这次测试直接变成产品接入决定。没有证明进程占用低于 200 MiB 并保持原召回水平。

| 新配置 | 本地加载 | 首次查询 | 预热 P50 | 101 文档索引 | 资源测试含索引峰值 RSS |
| --- | ---: | ---: | ---: | ---: | ---: |
| LiteRT | 87.4 ms | 38.3 ms | 33.1 ms | 10.78 秒 | 483.3 MiB |
| GGUF | 437.4 ms | 36.6 ms | 29.8 ms | 35.00 秒 | 409.2 MiB |

LiteRT 的库 import 另计，三次中位数为 12.6 ms；加载不含 Python 启动。GGUF 加载包含启动 native server、动态库和模型加载，直到本机 HTTP health ready，禁用预热。两者不是完全相同的初始化计时边界。本地文件已经存在，没有清理 OS 磁盘缓存，不计下载。

必须保留额外波动：LiteRT 首次质量运行的加载为 1673 ms、含索引峰值为 **555.9 MiB**，高于后续三次资源进程的 483.2–484.6 MiB；质量运行先建索引再查全部摘要，资源运行先查短摘要再建索引，尚未隔离分配器、页面缓存和顺序各自的影响。不能把 483 MiB 当作内存上限。GGUF 质量运行峰值为 410.9 MiB，资源进程为 409.1–409.2 MiB。LiteRT 三次 P95 为 33.48–38.08 ms，GGUF 为 34.29–34.38 ms。

整库索引不能放进每次编辑扫描：本轮 11 / 35 秒已经超过提案等待预算，必须提前准备并按实际组件内容/版本缓存。短摘要计算时间不能代表整个 MCP 检查耗时，也没有证明 Studio 并行操作不受影响。

## 测量与正确性边界

- 模型均为 EmbeddingGemma **2 的 270M 纯文本部分**，不加载视觉/音频编码器。文件、固定 revision、字节和 LFS SHA-256 见 [models.json](models.json)。LiteRT 模型文件为 157.0 MiB，GGUF 为 167.5 MiB；文件大小不是运行内存。
- LiteRT 使用 `litert-lm-api==0.19.0` 的 `EmbeddingEngine`，直接 Python ctypes API，CPU 2 线程，512-token signature，768 维输出，L2 归一化，原生 TRUNCATE。只安装该 wheel，没有 MediaPipe、PyTorch、NumPy。Python 3.11.15。查询 RSS 包含 Python、tokenizer、模型和原生库。
- llama.cpp v0.9.0，commit `cd959bae99ff4bed22bef2604f45241c09bbb8c8`，Release，编译关闭 Metal，启用 CPU Accelerate；`--gpu-layers 0`，推理与批次均 2 线程，`VECLIB_MAXIMUM_THREADS=2`，mean pooling，768 维 L2。查询 RSS 是完整 native server 及动态库，不含 Python HTTP/计分观察器。没有完整客户端的内存数据。
- GGUF 计时包含持久连接上的本机 `/tokenize`、明确截取前 512 个 tokens、`/v1/embeddings`、JSON/IPC 和归一化；不是远程服务时延，也不是纯模型前向。LiteRT 计时是直接 API，口径不同。资源查询来自原有十条正例，首条、另一次预热之后重复 30 次。
- 文档 batch=4，查询 batch=1；查询前缀为 `task: search result | query: `，文档为 `title: {name} | text: {text}`，与原 ONNX 对照一致。不加 BM25、reranker，不截短维度。每个新配置另做两个输入的混合 batch/单条一致性检查，最大逐元素差均为 0。
- GGUF 与 ONNX q4 的 **142/142 条截断后 token IDs 完全一致**。最长未截断输入 526 tokens，1 份输入超限；当前差异不来自这组文本的分词/截断。LiteRT API 未暴露内部 token IDs，本轮未验证其与 ONNX 分词完全一致。
- 对同一 4 份文档与 10 条查询，GGUF 对 ONNX q4 的向量余弦最低 0.9735、平均 0.9823；LiteRT 最低 0.9659、平均 0.9761。不同量化产物和推理实现的输出并不相等；这些检查不能单独确定排名变化源于量化还是算子实现。详见 [summary.json](summary.json) 的逐条差异与 [onnx-reference.json](onnx-reference.json)。
- 外部观察器通过 macOS `proc_pidinfo(PROC_PIDTASKINFO)` 每 20 ms 和阶段边界取子进程 RSS。LiteRT 在阶段握手时暂停，记录 Darwin `getrusage` maxRSS；GGUF 在唯一子进程退出后读取 `RUSAGE_CHILDREN` maxRSS。峰值表使用 OS maxRSS，字节统一换算为 MiB。RSS 不等于私有物理 footprint，也不包含 Studio/Electron。
- 旧 Node 对照只有一次短查询资源探针，没有索引峰值，不能据此声称生命周期峰值也降低 42%。新模型的全部质量排名、阶段 RSS 和 30 条原始耗时均保存于 `*-quality.json`、`*-resources-{1,2,3}.json`。
- 数据为手工标注的小型初筛，没有独立复核/留出集；4 条负例仅保存排名，未校准拒绝阈值。未验证 Agent 会读取 skill、正确替换/保留组件，未验证真实扫描效果、取消、超时或其他平台。

## 复现

在临时目录复制本目录的脚本、models.json；先按父目录说明准备原 Node 探针及固定版本模型缓存。需要 Python 3.11、uv、CMake、Ninja、C/C++ 编译器。以下 `DATA_PATH` 是冻结 data.json 的绝对路径，`NODE_PROBE_PATH` 是原 Node 探针目录。

~~~sh
uv venv --python python3.11 pyenv
uv pip install --python pyenv/bin/python litert-lm-api==0.19.0
python3 download.py
git clone --depth 1 --branch v0.9.0 https://github.com/ggml-org/llama.cpp.git llama.cpp
git -C llama.cpp rev-parse HEAD
cmake -S llama.cpp -B build -G Ninja -DCMAKE_BUILD_TYPE=Release -DGGML_METAL=OFF -DGGML_ACCELERATE=ON -DLLAMA_BUILD_TESTS=OFF -DLLAMA_BUILD_EXAMPLES=OFF -DLLAMA_BUILD_SERVER=ON -DLLAMA_OPENSSL=OFF -DLLAMA_CURL=OFF
cmake --build build --target llama-server -j4
python3 observe-litert.py quality --data DATA_PATH
python3 llama-probe.py quality --data DATA_PATH
python3 observe-litert.py resources --data DATA_PATH --repeat 1
python3 llama-probe.py resources --data DATA_PATH --repeat 1
node onnx-reference.mjs NODE_PROBE_PATH onnx-reference.json
~~~

资源命令分别串行运行 repeat=1、2、3；不要与其他重计算同时运行。脚本默认 180 秒安全截止，正式推理不联网。`summarize.py --baseline BASELINE_EVIDENCE_PATH` 从原始结果重算汇总和输入对照；默认使用父目录旧 ONNX 结果。`verify.py` 重新检查样本、排名、百分位、摘要和归档哈希。

[environment.json](environment.json) 保存 wheel、原生库与 llama-server/动态库的 SHA-256、编译选项和环境。当前 llama-server 及自带动态库合计 19.0 MiB，不含模型；LiteRT wheel 为 16.4 MiB，展开原生库 48.2 MiB，不含 Python。不是最终跨平台分发包大小。归档保留编译/安装/运行日志，不保存模型、二进制、源码 checkout、venv、下载分片或缓存。

接口与前缀依据：[LiteRT Embedding API](https://developers.google.com/edge/litert-lm/embedding_models)、[Google 模型卡](https://huggingface.co/google/embeddinggemma-2)、[LiteRT 文本产物](https://huggingface.co/litert-community/embeddinggemma-2-text-270m-litert-lm)、[GGUF 产物](https://huggingface.co/unsloth/embeddinggemma-2-GGUF)、[llama.cpp v0.9.0](https://github.com/ggml-org/llama.cpp/releases/tag/v0.9.0)。官方权重/移动设备内存数字不能代替本机完整进程 RSS。
