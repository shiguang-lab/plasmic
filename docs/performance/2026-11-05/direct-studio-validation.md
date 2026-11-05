# 内置编辑器直接启动：实现与功能验证

2026-11-05。正式实现已集成到当前工作区，与纯资源预取同时启用。未创建 Git 提交、替换已安装 App 或部署服务。脱敏结果和实际构建源码指纹见 [JSON](direct-studio-validation.json)。

## 当前实现

- 内置入口从外层应用直接加载 canvas 来源的 `static/studio.<commit>.html`。移除中间 Host Document、空 Host React 挂载及其创建 Studio iframe 的交接；业务画板保留独立 Document。
- 构建器复用内置 Host 的 DevTools preamble 和原运行时地址，在 Studio 模块之前同步初始化。脚本 URL 仍相对 canvas 来源解析，保持原版本和缓存键，不受 Studio 的 `<base>` 影响；React DevTools 的显式开启行为保留。
- `getHostWindow()` 明确运行时所有者。组件/trait 注册、根运行时、字体观察、属性控件和注册 token 读取正确文档；Comlink 连接该 Host 所在窗口的父级 TopFrame。内置编辑器使用自身文档，自定义 Host 使用原父文档。
- 只改写当前部署的内置 Host URL。项目/分支自定义来源、路径、查询参数、非本次构建的 Host 和自定义应用默认 Host 保留原入口，仍经过既有信任检查。
- Web 新入口使用与版本脚本一致的 immutable 缓存策略；Desktop 的现有 HTML 资产打包流程包含它。画板仍消费原 Host HTML，不创建或接管提前准备的 iframe。

## 验证

- 16 个相关 Vitest 文件、112 项测试通过。覆盖 Host 所有权、顶层桥接/路由/语言与加载状态、URL 选择、Host 模板、窗口运行时、属性控件主题和值回写、字体、纯预取、视口及渐进加载。补充 DevTools 条件加载测试后，最终构建器 3 项测试再次通过。
- 完整 TypeScript 检查、相关文件 ESLint、生产构建和 `git diff --check` 通过。17 份相关生产源码与实际构建输入逐字节相同。
- 隔离 Docker Nginx 与部署配置共 5 项测试通过，实际验证 8080/8081 的新 HTML 返回一年 immutable 缓存头。
- 真实冻结单画板项目：切换、重命名、实际 DOM 样式及画板位置修改、撤销重做、Preview 分页返回、完整客户端保存与重开通过。
- 真实冻结十画板项目：全部画板可用；多画板切换、上述编辑操作、冷画板销毁后的撤销/重做/选择与样式恢复、保存重开通过。
- 自定义 Host 夹具保持嵌入式 Studio，重复完成单画板编辑、Preview 和保存重开流程。
- 三份有效原生功能报告均无编辑器 renderer error、无意外写入阻断，注册数量均为 981。内置入口直接以 TopFrame 为父级、无空 Host scaffold，运行时仅请求一次，地址为原 canvas 来源。三份 FontManager 探针均识别正确 Host 文档的字体声明，未下载未使用字体，且通过撤销恢复原模型。
- 已检查单画板和十画板截图，编辑区、工具栏、属性面板与画板正常显示。

本次用于功能验收，没有新增受控性能对照，不能据此宣称一秒内可编辑。离线夹具不覆盖线上权限、草稿 IPC、后端保存和安装验收。三个进程均有一项此前已存在的 Dashboard 缩略图 `undefined.map` 夹具错误，单列保留，不计为缩略图通过。

日志和私有夹具位于 `/tmp/plasmic-startup-experiments-20261105/`。生产构建使用 `source/platform/wab/perf.config.ts`；功能入口为 `run.py direct-formal gp qual-direct-formal-gp`、`run.py direct-formal complex qual-direct-formal-complex`、`run.py direct-custom custom-gp qual-direct-custom-gp`。自定义 Host 夹具仅修改隔离项目的 hosting 元数据，业务模型保持原样。
