# Pen 文件直接导入

入口：Studio 左侧「更多」→「从 Pen 导入」，紧邻「从 Figma 导入」。浏览器和 Desktop 共用此入口与实现。

## 使用

- 独立设计：选择 `.pen` 文件。
- 带组件库、图片或脚本的设计：选择包含全部依赖的文件夹，或上传保留相对目录结构的 ZIP。
- 文件夹内有多个设计时先选择设计，再选择顶层画布；每次导入创建独立画板，可单步撤销。
- 支持 2.17–2.21 格式的 JSON/JSONC 文档。缺少依赖、未知版本或不支持的节点会明确报错。

依赖只从用户所选文件读取。导入不使用 MCP、Pen 应用或网络下载外部资源；图片上传仍使用 Studio 既有资源服务。

## 转换

`platform/wab/src/wab/client/pen-importer/` 包含文件读取、节点转换和界面流程。

- `reader.ts` 解析文档、库引用、变量/主题和实例 descendants 覆盖，展开嵌套脚本。
- `scripts.ts` 在 Web Worker 内的 QuickJS/WASM 环境中同步执行脚本，仅提供尺寸和 inputs。每次运行限制 2 秒、64 MiB 内存及 1,000 个输出节点；不暴露主应用、DOM、网络或文件系统接口。
- 脚本头部补充缺失参数的默认值；保留文件中的实例参数，包括比编辑器控件声明更丰富的 JSON 配置值。随机数每次以固定种子初始化。
- `styles.ts` 转换容器、文字、矩形、路径、椭圆、多边形和 Lucide 图标，以及图片、常用背景与阴影。
- `insert.ts` 创建原生 Tpl 节点和资源，在一次 Studio 事务中插入；成功后才切换画布，失败时回滚模型。
- 导入后是当前参数下的可编辑图层。不会继续运行原脚本，也不会自动获得原生 Button/Table 的业务交互。

QuickJS 依赖固定为 0.31.0，匹配当前生产压缩构建。升级此依赖时应重跑下方真实浏览器检查，以验证内嵌 WASM 的加载。

## 边界

当前仅内置 Lucide 图标库。浏览器节点、shader、mesh gradient 及非纯色矢量填充/描边会报错。图片裁剪变换、椭圆弧、外侧/居中描边等会简化并提示。字体样式会保留，源文档的自定义字体文件不会自动安装。脚本使用导入时的可用尺寸生成图层，复杂内容自适应布局和字体替换仍需检查渲染效果。

文件夹导入按需读取所选设计实际引用的文件，不读取无关文件内容，并跳过 `.git`、`node_modules`。实际读取的数据上限为 100 MiB，文件索引上限为 5,000 个；ZIP 展开数据也受大小限制。依赖的相对路径必须留在所选目录内。脚本生成的作者机器绝对路径只能匹配用户明确选择的唯一文件，不会直接访问原路径。

## 验证

在 `platform/wab` 中运行：

```sh
pnpm test src/wab/client/pen-importer src/wab/client/components/studio/LeftTabStrip.test.tsx --project studio --maxWorkers 1
pnpm typecheck
PLASMIC_SELF_HOSTED=1 PUBLIC_URL=http://localhost:3003 STATIC_URL=http://localhost:3003 NODE_OPTIONS=--max-old-space-size=16384 pnpm build
node tools/pen-import-worker-check.cjs
```

浏览器检查使用生产构建产物和真实 Chromium，验证 Worker、库引用覆盖、嵌套脚本、隔离环境及图标资源。检查期间临时监听本机 3003 端口，结束后关闭。

本地真实源文件测试已转换业务设计的 25 个顶层画布，以及带组件库和脚本的模板总览（3,483 个图层、135 个资源）。源文件 SHA-256 与逐画布统计见 [verification.json](verification.json)。这些统计证明解析与展开成功；尚未对真实设计完成整页像素对比，或在已登录 Studio 中完成真实资源上传和 Preview 验收。
