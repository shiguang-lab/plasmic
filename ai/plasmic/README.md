# Plasmic skill、CLI 与资源发布

统一的 `plasmic` skill 支持产品原型设计和开发代码生成。薄 skill 随 CLI 安装包发布；工作流、组件规范、MCP 契约和验收脚本由 CLI 在任务开始时从公开资源服务检查和下载。

## 目录与事实源

```text
packages/plasmic-cli/skill/plasmic/SKILL.md  薄入口的唯一维护源
packages/plasmic-cli/src/                  CLI 运行代码，无外部运行依赖
packages/plasmic-cli/scripts/publish.mjs   CLI 内容比较、资源构建与按需 npm 发布
ai/plasmic/references/guide.md             资源总入口
ai/plasmic/references/workflows/           inspect / prototype / codegen 工作流
ai/plasmic/references/model-reading.md     只读解读与 coding 共用的模型读取契约
ai/plasmic/references/codegen/             项目工程、交互与验收规范
ai/plasmic/references/design/              通用布局、键盘焦点、命名和图标选择规则
ai/plasmic/references/libraries/index.md   按项目真实组件库和 API 版本选择规范
ai/plasmic/references/libraries/*/rules.json  注册 → 规范文档、plan 决策项、门禁检查锚点的唯一机器可读映射
ai/plasmic/references/gate-rules.json      门禁、通用诊断、页面级 plan 决策、规则卡的项目/页面组合文档与页面类型骨架
ai/plasmic/references/design/page-structure.md  需求到页面区域结构、布局推导、模板核对与逐页评审
ai/plasmic/references/planning.md          Page plan 脚手架、决策、规则卡、读取台账与修复循环
ai/plasmic/references/libraries/antd_v6/   Ant Design 6 的组件与组合规范
ai/plasmic/references/libraries/antd_v5/   Ant Design 5 已注册组件的独立规范
ai/plasmic/references/libraries/overseas/  Overseas 组件库规范
ai/plasmic/references/libraries/react_ui/  React UI 组件库规范
ai/plasmic/references/libraries/antd_icons/  Ant Design Icons 组件库规范
ai/plasmic/references/engineering/         仅平台/组件实现任务使用的通用验证规则
ai/plasmic/references/                     设计规范与 MCP 契约
ai/plasmic/references/admin-templates.md    管理后台模板选择、组合与绑定规范
ai/plasmic/references/templates/admin/     素材库目录和官方 UiConfig 的唯一维护源
ai/plasmic/scripts/                        结构、Slot、模型比较检查
scripts/build-plasmic-resources.mjs        构建资源与独立版本的 CLI 安装包
.github/workflows/publish-images.yml       统一 tag，按需发布或全发布，并汇总 GitHub Release
.github/workflows/publish-plasmic-cli.yml  被统一发布流程调用，发布选中的 CLI 到 npm
```

根目录不再放置 `skills/`。CLI 直接读取包内 `skill/plasmic/SKILL.md` 安装，无生成副本或复制构建步骤。通过 `references/libraries/index.md` 先匹配项目真实组件库和 API 版本，再读该库的组件索引。每个库/API 范围独立维护 `components/` 与适用的 `compositions/`；Antd 按官方主组件维度维护文档，Form.Item、RangePicker、Descriptions.Item、列、分组等子组件和变体放入父组件小节，不另建文件。标题使用库的主组件名称，文档和索引保留覆盖的 Studio 注册名称及 key。业务组件沿用这一粒度，SearchForm.Item 在 SearchForm 文档内维护。构建器直接打包 references，无组件文档生成副本；测试脚本不进入资源 bundle。

设计前通过 MCP 核对 imported project、注册 key、importPath 和可确认的实现版本；Studio 发布版本、wrapper npm 版本和底层 UI 版本分别记录。组合规范声明参与库，静态检查脚本只用于其已支持的库契约。没有匹配规范时依据真实实现、注册和通用设计规则完成可确认部分，明确缺少的规范覆盖；不回退套用 Antd 6，也不为适配模板切换目标组件库。组件库使用 `antd_v6`、`antd_v5`、`overseas`、`react_ui`、`antd_icons` 这样的单层目录名。目录标识注册组件库，底层依赖版本记入库索引的依赖说明，不追加到目录名。新增组件库时增加独立目录和索引、验证对应组件及依赖后接入总索引；不创建空版本占位或版本间重定向。

组件与组合文档统一使用阶段模板：开头为标题、库、注册表和可选的 **Hard constraints**（只认这一英文标记，构建拒绝其他写法，以免约束摘要漏读）；随后依次是 `## Plan decisions`（仅当 rules.json 声明本文档的决策项）、`## Generation rules`（必需）、可选的 `## Conditional rules` 和 `## Acceptance checks`，原主题小节降为 `###`。规则卡按阶段取节：编排读 Plan decisions + Generation rules，验收读全文；不再为单个组件维护必读章节清单。新增组件时写入模板文档并在 rules.json 增加一条，构建会校验模板、目录、决策表和锚点一致。决策项可由共享文档拥有（如 `design/scale.md` 的尺寸基线），此时该文档维护 Plan decisions 表。

Page plan 的步骤、命令和读取台账见 [规划](references/planning.md)，逐页编排与恢复见 [原型工作流](references/workflows/prototype.md)，最终验收见 [统一验证](references/verification.md) 和 [规则评审](references/review-mode.md#rule-review)。`rules.json` 维护注册与组件决策的映射，`gate-rules.json` 维护项目/页面规则路由；脚手架、规则卡和门禁从这两处读取，README 不另维护执行流程。

没有设计稿时，间距、宽度、组件大小、字号和密度统一取 `design/scale.md` 的默认值（按钮、输入、选择、Tabs、Segmented、日期区间和 Table 的尺寸及 Table 分页 20/50/100 由门禁检查）；先按 `design/page-structure.md` 推导涉及页面的区域关系与布局，再以 `design/page-types.md` 的页面类型选择起始骨架；模板与实时组件契约核对后定稿，逐页细化，预检按 `gate-rules.json` 的 `pageRules.pageType` 提供相应布局规则，实际内容按需求清单验收，不按页面类型强制组件数量；常用组件文档的第一节 Design defaults 写明何时用、放在哪、默认配置和相邻关系。按页面类型的回归用例在 `evals/page-types/`。通用布局维护尺寸与伸缩、对齐、间距归属、内容溢出、响应式范围、吸附和滚动原则；各库的 Flex/Grid/Space/Layout 等文档维护真实 Props/Slots。组合文件维护实际区域关系和跨组件交互，不重复父组件或通用布局规则。

在已准备依赖的仓库根目录运行 `node scripts/validate-plasmic-component-coverage.mjs`，通过各库真实 `registerAll` 核对主组件归属、全部注册 key、最终显示名及图标目录。资源构建会额外检查组件文档与库索引的一致性，再校验链接、标题锚点、可达性和阅读预算。源码覆盖检查不替代组件运行或设计交付验收。

## 规范维护边界

新增规则先确定唯一维护位置；薄 SKILL 仅保留资源加载、模式选择、参考模板和组件优先等稳定通用原则。具体组件规范、业务权限呈现、布局参数和验收流程由对应 reference 唯一维护，入口负责引导读取，不再复制这些细则。保留组件特有的可观测行为；通用“保存/重开/截图不等于通过”由工作流与验收文档定义，组件可简短引用。规则区分能力事实、产品缺省约定、明确强制项和示例；任务个例不直接升级为全局要求。

| 内容 | 维护位置 |
| --- | --- |
| 资源加载、模式选择、客户端实现访问边界、参考模板与组件优先原则 | 薄 SKILL |
| 组件库/API 匹配与按角色选型 | libraries/index |
| 任务步骤、受支持范围 | workflows；Pen 证据格式在 design-references |
| 工具上下文/恢复、渲染、资源操作 | desktop-context / inspection / media |
| 需求优先级、范围与验收声明含义 | requirement-alignment |
| 组件 Props/Slots 使用与特有行为 | 匹配库的 components（统一阶段模板） |
| 注册归属、plan 决策项、诊断锚点 | 各库 `rules.json`、`gate-rules.json`；组件文档的 Plan decisions 表与之一致 |
| 证据完整性（不改期望、不自评、不省略检查） | verification 的 Evidence integrity，其它文档只链接 |
| 跨组件区域关系与动作位置 | 匹配库的 compositions |
| 脚本输入、证据、复用与通过条件 | verification；格式以公开 plan_schema 为准 |
| 平台工程验证 | engineering；发布维护说明留在本 README |

修改时检查所有入链、相邻组合及跨模式影响；删除被取代的表述，避免在多个层级追加同一条事故修复。以只读审查、局部编辑、完整生成、不同组件库、缺契约恢复、代码生成等实际场景走读。运行链接/锚点/覆盖/预算及相关行为检查；这些静态检查不能证明模型一定遵守规范。唯一源码是仓库入口和 references，安装副本由 CLI 更新；本地编辑不代表已发布或已安装。

## 安装和使用

需要 Node.js 22.12 或更高版本，以及当前客户端 PATH 中可调用的 Python 3.9+（`python3`）。本地和发布版 context resolver 都先检查 Python；失败时报告环境缺口，不会把资源就绪当成流程可执行。npm 发布完成后：

```sh
npx -y --prefer-online @plasmickit/cli@latest skill install
npx -y --prefer-online @plasmickit/cli@latest context resolve --mode inspect
npx -y --prefer-online @plasmickit/cli@latest context resolve --mode prototype
npx -y --prefer-online @plasmickit/cli@latest context resolve --mode codegen
```

`skill install` 非交互地检测本机受支持的 Agent CLI、桌面应用、IDE 扩展和用户配置目录，为所有检测到的客户端安装包内同一份 `plasmic/SKILL.md`，无需选择客户端或输入安装路径。CLI 检测检查 PATH 中的可执行文件，不启动客户端。应用检测使用 macOS 系统/用户 Applications、Windows 开始菜单快捷方式、Linux XDG 桌面入口；IDE 扩展检测包含 VS Code、VS Code Insiders、Cursor 和 Windsurf 的扩展目录。配置目录是安装线索，可能属于尚未卸载干净的客户端；检测依据随结果返回。

默认使用用户级 Skill 目录，不修改当前项目。共用目录按真实路径合并处理；本地开发配置与入口符号链接跳过。内容相同返回 `unchanged`；更新通过临时文件原子替换 `SKILL.md`，保留其他 Skill 与用户附加文件。未发现受支持客户端时不写入并返回非零退出码；某个安装位置失败时继续其他位置，结果逐项报告错误并返回非零退出码。

首次安装后，CLI 的 `context resolve` 在请求 resources 前自动同步已检测客户端中已安装的 `SKILL.md`，不需要重复运行 `skill install`。同步使用正在执行的 CLI 包，和 resources 的版本、缓存或网络结果无关；`--prefer-online` 让 npm 检查最新包信息，仍可复用缓存内容。没有安装 Skill 的客户端不会自动安装；`local-source.json`、Skill 目录自身或 `SKILL.md` 的符号链接均跳过，保留本地开发来源。共享父目录的符号链接仍按真实路径去重。

安装文件末尾的 CLI 版本注释随正文一起原子写入；旧的无版本入口在首次同步时补齐，较旧 CLI 不覆盖较新入口。每个安装目录用 `.plasmickit-skill-lock` 串行更新，等待最多 5 秒；进程异常退出遗留锁时，只在确认没有更新进程后删除。同步结果通过 `skillUpdate` 单独返回，包含更新、未变化、跳过原因或失败；入口同步失败不阻止可用资源加载，下次执行重试，资源失败仍按原规则阻止依赖工作。新入口在客户端重新加载技能后采用，不保证当前会话立即刷新；未触发 Skill、未执行 CLI 时不会后台更新。

只检查检测结果和安装位置，不写文件：

```sh
npx -y @plasmickit/cli@latest skill install --dry-run
```

### 受支持的本地客户端

| 客户端 | 用户级 Skill 位置 |
| --- | --- |
| Codex、Cursor、Gemini CLI、OpenCode、GitHub Copilot、Cline、Droid、Pi、Zed | `~/.agents/skills` |
| Claude Code（CLI / Desktop Code 本地会话） | `${CLAUDE_CONFIG_DIR:-~/.claude}/skills` |
| DeepSeek Harness（`dsh` CLI） | `${DSH_AGENTS_HOME:-~/.agents}/skills` |
| Antigravity / Antigravity IDE | `~/.gemini/config/skills` |
| Antigravity CLI | `~/.gemini/antigravity-cli/skills` |
| Windsurf | `~/.codeium/windsurf/skills` |
| Roo Code、Continue、Kilo Code、Kiro、Trae、Qwen Code、OpenClaw、ZCode | 各自的 `~/.roo/skills`、`~/.continue/skills`、`~/.kilo/skills`、`~/.kiro/skills`、`~/.trae/skills`、`~/.qwen/skills`、`~/.openclaw/skills`、`~/.zcode/skills` |
| Trae CN | `~/.trae-cn/skills` |
| Amp、Goose | `${XDG_CONFIG_HOME:-~/.config}/agents/skills`、`${XDG_CONFIG_HOME:-~/.config}/goose/skills` |

`agy`、`codex`、`claude`、`dsh` 等 CLI 可单独通过 PATH 检测，无需安装桌面 App 或先生成配置。`dsh` 是官方 `@deepseek-ai/dsh` 包提供的命令；DeepSeek Harness 与 Codex 默认共用 `~/.agents/skills`，安装器只写一次。

`CODEX_HOME` 用于发现 Codex 配置，Codex 用户 Skill 使用官方的 `~/.agents/skills`。`DSH_HOME` 用于发现 Harness 配置，`DSH_AGENTS_HOME` 决定其共享 Skill 目录。`CLAUDE_CONFIG_DIR`、`XDG_CONFIG_HOME` 等现有客户端环境变量按其规则解析。桌面应用和对应 CLI 共用同一份用户 Skill，不重复安装。不支持本地目录发现的网页/云端会话不计入安装成功；Claude Cowork 与云端会话需要其账号/插件安装机制，不读取本地 `~/.claude/skills`。

这里的“支持”指安装与资源入口，不能据此声称所有模型都已验证或一定遵守规范。只有 MCP、没有安装 Skill 的客户端，通过服务连接说明和 `read_skill` 进入同一资源工作流；当前任务/模式已 resolve 并读完必需文件时复用，不重复加载。执行原型设计还需客户端能读取本轮资源、运行 Node/Python 校验并保留证据，且具备登录后的 Desktop、截图和 Preview 访问。缺少能力时按工作流报告未完成项；子代理和主动压缩属于可选能力，替代路径见 [review-mode](references/review-mode.md) 和 [Page 工作集](references/workflows/prototype.md#complete-one-page-at-a-time)。客户端配置测试、规则门禁测试与真实模型设计评测分别记录，具体模型是否遵守以 [evals](evals/README.md) 中的实际结果为准。

DeepSeek Harness 的 CLI 和目录契约依据：[CLI 包定义](https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/cli/package.json)、[Skill 文件系统发现规则](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/skill/skill-filesystem/README.md)。

目录规则依据：[Agent Skills 发现约定](https://agentskills.io/client-implementation/adding-skills-support)、[Codex](https://learn.chatgpt.com/docs/build-skills#where-codex-loads-local-skills)、[Claude Code](https://code.claude.com/docs/en/skills)、[Cursor](https://cursor.com/docs/skills)、[Gemini CLI](https://geminicli.com/docs/cli/using-agent-skills/)、[OpenCode](https://opencode.ai/docs/skills/)、[Copilot](https://docs.github.com/en/copilot/concepts/agents/about-agent-skills)、[Antigravity](https://antigravity.google/docs/skills)、[其他客户端的 Skills 安装器注册表](https://github.com/vercel-labs/skills/blob/main/src/agents.ts)。检测注册表在 `packages/plasmic-cli/src/agents.mjs`；增加客户端时同时核对目录契约并添加检测用例。

也可以全局安装；每个任务先检查版本：

```sh
npm install -g @plasmickit/cli@latest
plasmickit skill install
plasmickit version check
plasmickit references check
plasmickit references update
plasmickit context resolve --mode inspect
plasmickit context resolve --mode prototype
plasmickit context resolve --mode codegen
plasmickit references path
```

`version check` 查询公开资源服务的当前发布清单；清单的 `version` 是资源版本，`cliVersion` 是所附 npm 包版本。CLI 升级判断只比较 `cliVersion`。命令返回正在运行的 `cliVersion`、公开清单中的 `latestCliVersion`、资源最低要求 `minCliVersion`、`cliUpdateAvailable`、`cliCompatible` 和可直接安装的 `cliUrl`。`references check` 同时返回资源差异与 CLI 版本结果。CLI 低于最低版本时，`update` / `context resolve` 返回升级信息并停止；兼容的旧 CLI 可以加载新 references，同时报告有可用升级。薄 skill 的 `npx …@latest` 入口自动选择 npm 最新 CLI。

`context resolve` 每次读取公开资源服务的 `latest.json`，更新并验证全部缓存文件，返回 `releaseId`、`version`、`resourceRoot`、`referencePath` 和该模式的 `mustRead` 绝对路径。inspect 模式返回只读解读流程和共用模型读取契约；prototype 模式返回原型工作流，通过后台索引按受影响区域选读；codegen 模式返回模型读取、工程与验收规范，数据/交互规范在涉及对应行为时读取。解释模板和设计审查不要求编辑权限，不安装库或保存设计。

资源命令在 stderr 实时输出友好的阶段提示，版本检查显示当前版本和最新版本，资源无需更新且缓存完整时直接提示当前已是最新版本；需要加载时显示下载与哈希校验进度。正常加载不展示缓存保存、更新协调和工作流入口等内部步骤。下载显示已接收字节与实际进度，阶段持续超过两秒时定期显示等待时长；失败提示标明当前阶段。stdout 仅输出最终 JSON，阶段内失败时，错误 JSON 包含失败阶段 `stage`。AI 应使用运行工具的增量输出能力转述阶段变化；工具若只在退出后返回日志，CLI 无法保证中途显示，AI 应说明仍在等待，不能编造进度。工作流入口就绪只代表文件可供阅读，Agent 仍需读取返回的 `mustRead`。

缓存默认位于 `~/.cache/plasmic/`：`releases/<releaseId>/` 保存版本，`current.json` 原子切换当前版本。`PLASMIC_RESOURCE_HOME` / `--home` 设置缓存目录；`PLASMIC_RESOURCE_URL` / `--feed` 设置资源源（HTTPS；loopback 测试允许 HTTP）。`path` 仅供显式离线检查，不能证明缓存最新。公开资源服务不可达或校验失败时停止依赖任务。更新以目录锁防止交叉写入；异常退出留下 `.update-lock` 时，确认没有更新进程后删除锁再执行。

## 管理后台模板规范

原型 workflow 要求在组合后台页面前读取 [模板规范](references/admin-templates.md) 和 [素材库目录](references/templates/admin/catalog.json)。目录提供 Admin Templates 的真实项目、十个组合组件、适用场景、Slots、版本和组合规则；AI 按需求选型，通过 Desktop MCP 核对实时模型和目标项目契约，再复用或参考结构组合。布局优先使用现有 Antd Flex、Row/Col、Space 和 Card，业务状态、事件和路由由目标项目绑定。

模板规范、目录和 [UiConfig](references/templates/admin/ui-config.json) 均由资源构建器自动纳入 bundle，不依赖目标项目存在本仓库的 `examples/` 目录。`examples/admin-templates/` 保存素材库生成函数、使用说明和验收证据；目录和配置只在 `references/templates/admin/` 维护。发布新素材库版本后核对实时 UUID、Slots、依赖和缩略图，更新目录并同步 UiConfig。

素材库的 `publishedVersion` 与 skill 资源发布版本独立。规范发布使外部 AI 可以发现素材库，不会应用组织 UiConfig，也不会接入 Studio 内置 AI 检索。配置是否启用、目标用户是否有素材库访问权限，都需要通过当前系统核对。

### Reference 更新发布

仅修改 references 时无需修改薄 `SKILL.md`、CLI 运行代码或最低 CLI 版本。资源版本使用统一的未发布数字 `<版本>` tag；相同版本不能覆盖不同内容。先在仓库根目录完成本地打包检查，例如：

```sh
node scripts/build-plasmic-resources.mjs --version 0.0.59 --output /tmp/plasmic-resources-0.0.59
```

版本号是示例，发布前检查 npm 和 GitHub Release 当前版本，选择更大的未发布版本。本地构建会运行验收脚本单测并验证资源 manifest、文件哈希和安装包；CLI 使用源码 package.json 的独立版本。它不会发布或切换公开清单，也不替代正式发布的 npm 内容比较。检查 manifest 包含 `references/admin-templates.md`、`references/templates/admin/catalog.json` 和 `references/templates/admin/ui-config.json`。

正式发布沿用下文的统一 tag 流程：提交规范，推送数字 `<版本>` tag，等待 workflow 成功。仅 references 或资源脚本变化的小版本只构建资源，复用 npm 最新 CLI 的版本和原始安装包；薄 SKILL 或 CLI 发生变化时，同一流程先发布 CLI，再构建引用该版本的资源。统一发布器将校验后的资源上传 GitHub Release。

GitHub Release 发布成功后，客户端执行：

```sh
npx -y @plasmickit/cli@latest context resolve --mode prototype
```

核对返回的 `version`、`releaseId`，以及返回 `resourceRoot` 下的模板规范和目录。原型 workflow 会引导读取这些文件。已有兼容 CLI 可以下载新的 references；无需重新安装 skill 或 Desktop App。更新只影响下一次规范加载，已运行任务应重新 resolve/read 后使用新规则。

## 代码生成规范

流程为：读取目标项目 → 读取真实 Plasmic 页面/状态/交互 → 核对当前组件实现与目标 API → 按工程规范实现项目代码 → 在真实入口验证。生成由 Agent 执行，CLI 提供最新 references；不调用 `export_code` 或官方 Plasmic CLI。

- [页面读取与实现依据](references/model-reading.md)：读取隐藏分支、实际组件信息、数据和资产，依据当前两端实现决定代码。
- [项目代码规范](references/codegen/project-code.md)：目录职责、组件拆分、类型边界、主题样式、宿主与独立应用、国际化和权限。
- [数据与交互规范](references/codegen/interactions.md)：状态所有权、查询分页、请求竞态、表单校验、弹层生命周期与防重提交。
- [Service 与模拟数据](references/codegen/services.md)：分散接口资料发现、缺口确认与临时契约、网络 mock/本地数据流程及验收边界。
- [代码验收规范](references/codegen/acceptance.md)：类型/构建检查、真实入口行为和视觉验证、交付证据。

提炼依据是 pen-antd-kit 的设计规范（`pen-prototype-platform/standards/patterns/`、`states/feedback-permissions.md`、`quality/review-checklist.md`）与 fintechgrowthui 的 `docs/standards/code-architecture.md`、`interaction-and-validation.md`、`design.md`。pen-antd-kit 的 Pencil 组件映射契约不进入本规范；fintechgrowthui 的特定宿主、接口签名、依赖版本和组件 API 也不作为跨项目规则。Plasmic 组件到目标代码的具体转换需根据当前注册信息、真实实现和目标项目类型确认。

## Tag 自动发布

只推送一个数字版本 tag，例如 `0.4.3`。`.github/workflows/publish-images.yml` 统一判断范围，其他发布 workflow 仅由它调用：

| 版本规则或变更 | 发布范围 |
| --- | --- |
| 主版本或次版本升级 | Studio、Desktop、CLI、资源全部发布 |
| 补丁版本：后端变化 | Studio 镜像 |
| 补丁版本：前端或共享 renderer 变化 | Studio 镜像和 Desktop |
| 补丁版本：Desktop 自身变化 | Desktop，复用已有 Studio 镜像 |
| 补丁版本：CLI 或薄 Skill 变化 | CLI 和引用该 npm 包的资源 |
| 补丁版本：references 或资源脚本变化 | 资源，复用 npm latest CLI |
| 仅文档、测试或 workflow 变化 | 不发布，不创建 Release |
| 手动 workflow dispatch 勾选 `force-all` | 所有产物，包含内容未变的补丁版本 |

发布范围取变更集合；例如同时修改后端和 references，就发布 Studio 和资源。资源始终在选中的 CLI 发布成功后构建，校验 npm 版本与完整性，复用原始安装包。只有资源变化时无需发布新 CLI。全发布和实际发布的 CLI/资源版本来自统一 tag；未发布的产物保留现有版本。源码 package.json 的 CLI 版本用于开发。

发布前运行 `node scripts/release-plan.mjs <tag>` 检查范围，设置 `RELEASE_FORCE_ALL=true` 检查强制全发布。选中 Desktop 时，其 package/lockfile 版本必须等于 tag，并有五语言发布说明；同时构建 Studio 时 `webImage` 指向该 tag，仅发布 Desktop 时指向已有镜像。校验失败则不开始构建。

所有选中的任务成功后才公开同一个 GitHub Release。CLI/资源资产包含 `plasmic-cli.tgz`、`resources.json.gz`、`plasmic-latest.json` 和 `plasmic-manifest.json`；薄 Skill 已包含在 CLI 包中。每个实际发布的数字版本都包含六份公开 latest 清单，未更新产品沿用此前清单的原始字节、版本和下载地址。资产上传后按大小和 SHA-256 验证，失败保留草稿供重跑；全部就绪后才推进 GitHub latest。资源 artifact 仍包含原始 `latest.json` 和 `releases/<releaseId>/`，供发布校验使用。固定首尔代理会自动跟随 latest，发布不修改代理配置或部署 NAS 服务。

`MIN_CLI_VERSION` 位于 `src/protocol.mjs`，不得高于资源清单的 `cliVersion`。资源目录使用内容哈希 `releaseId`，记录所有文件和安装包的 SHA-256 与大小。

### CI 必要配置

- npm：需要有 `@plasmickit` scope 发布权限、启用 Bypass 2FA 的 granular `NPM_TOKEN` secret，或已登记该包的 Trusted Publisher。OIDC 配置填写 GitHub owner `shiguang-lab`、repo `plasmic`、调用方 workflow `publish-images.yml`；workflow 已声明 `id-token: write` 并安装最新版 npm。参考 [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/)。

统一的 Actions 按计划调用 npm 发布、Studio 镜像、Desktop 和资源构建任务，并汇总 Release。Studio 服务的 NAS 部署在本机单独执行；客户端下载和资源由 GitHub Release 托管。

## 部署公开资源下载

公开 CLI/Skill 资源与 Desktop 下载由首尔 Caddy 从 GitHub Release 获取，客户端继续使用原有 `/desktop-updates/plasmic/` 地址。一次性安装固定规则：

```sh
node scripts/release-downloads.mjs /absolute/path/to/current/Caddyfile
```

latest 固定转发至 GitHub latest。资源按内容哈希存入固定的 `plasmic-resources` Release，文件名为 `<releaseId>-manifest.json`、`<releaseId>-plasmic-cli.tgz` 和 `<releaseId>-resources.json.gz`，已有哈希只读，新版本只追加；该 Release 永不设为 latest。发布器会补齐历史数字版本的资源。首次启用固定规则前，用当前发布器补齐最新数字 Release 的六份清单及资源；之后发布无需修改或重载 Caddy。GitHub 的两次跳转都在服务端处理。校验、部署位置、回滚和验证要求见 [下载路由](../../deploy/README.md#release-download-routing)。

## 本地构建与发布检查

同一构建进程内复用已通过的完整验收脚本单测，失败后可重试；每个资源产物仍独立检查 references、manifest 与文件哈希。正式发布进程必须先通过完整单测。

```sh
node packages/plasmic-cli/src/index.mjs skill install --dry-run
node scripts/build-plasmic-resources.mjs --version 0.0.59
# 默认只对 npm 做 dry-run（会查询真实 registry，不上传）：
node packages/plasmic-cli/scripts/publish.mjs --tag 0.4.3
# 资源仅使用已经发布并校验的 CLI：
node scripts/release-resources.mjs --tag 0.4.3
```

统一版本主/次版本升级或强制全发布会发布当前 CLI 包内容；补丁版本按需比较实际包内容，要求 npm 版本递增。上传 npm 需要显式加 `--execute`；统一 CI 会自动传入，全发布另传 `RELEASE_FORCE_ALL=true`。

资源使用以下公开下载路径，由首尔从 GitHub Release 获取：

```text
/desktop-updates/plasmic/latest.json              no-store 当前清单
/desktop-updates/plasmic/releases/<releaseId>/
  manifest.json                                 immutable 清单
  resources.json.gz                             references + scripts
  plasmic-cli.tgz                               CLI + 薄 skill
```

发布后检查公开清单的缓存策略和安装文件的哈希。

## 本地开发资源

本机测试使用当前 checkout 时，运行 `node scripts/install-local-plasmic-skill.mjs` 安装 DS（默认 `~/.agents`），用 `--target ~/.codex/skills/plasmic` 同步 Codex。入口链接到同一份 SKILL；`local-source.json` 指定本地 resolver，下一次 resolve 即读取当前内容和哈希，不访问公开资源服务，也不需要发布。

resolver 在用户缓存目录提供仅含正式 references/scripts 的内容寻址快照，排除 eval、历史答案和测试文件。文件为普通文件，递归搜索不会因软链接而漏读；下一次 resolve 获取当前源码的新增、删除和修改，无需发布。本轮快照保持不变，便于版本复现。资源范围不等于文件系统权限隔离，生成任务仍只读取本轮来源和运行资源。`node --test scripts/plasmic-local-context.test.mjs` 检查快照稳定、最新内容解析、递归搜索、资源范围及幂等安装。

App/MCP 使用同一个本地构建：`pnpm --dir desktop run package:local -- --install`。它重建 SDK、组件、Canvas 和 Studio，再签名安装；只更新 Skill 无法替换已运行 App 内的组件代码。安装后通过 `get_build_info` 核对实际本地 renderer/desktop 哈希。此流程不发布 npm 或 GitHub Release。

## 验证

项目原型的自动门禁统一入口为 [verify_all.py](scripts/verify_all.py)，当前门禁范围、配置和在线采集/离线重放见[统一验收规范](references/verification.md)。表单清单可按页面 path 跨项目复用；需求清单必须独立审核，不能从生成结果反推。此入口汇总自动检查，Preview 交互和保存重开仍需单独验证。

```sh
npm --prefix packages/plasmic-cli test
node --test desktop/tests/plasmic-resources.test.cjs desktop/tests/mcp-skill.test.cjs
python3 ai/plasmic/scripts/test_verify_slots.py
python3 ai/plasmic/scripts/test_verify_structure.py
```

行为评测见 [evals](evals/README.md)：用独立上下文覆盖只读解读、局部原型修改、现有代码更新、官方 CLI 和跨项目保存副作用，并对生成代码与修改计划做独立验证。fixture 评测与真实 Desktop 的 Preview、保存、重开验收分别记录。

## 渐进式资源检查

构建器直接检查维护中的 references：本地链接、标题锚点、从 guide 的可达性以及注册组件目录覆盖；不生成或注入文档副本。guide 和 Desktop 核心契约各不超过 4 KiB，工作流各不超过 6 KiB，单份场景 reference 不超过 20 KiB，每个模式的 mustRead 总量不超过 24 KiB。mustRead 只覆盖入口；构建另外统计每个工作流的点名阅读量（mustRead 加工作流直接链接的文档，上限 208 KiB），实际每页负载以规则卡的 `totalBytes` 衡量，`readingBudgetExceeded` 为真表示阅读预算压力，按[逐页上下文处理](references/workflows/prototype.md#complete-one-page-at-a-time)选择实际可用的分工、压缩或分节读取路径，不能跳读规则。约束标记只认 `**Hard constraints**`，`gate-rules.json` 的项目/页面规则路径、`pageRules.pageType` 与页面类型章节由构建校验一致。超限应按真实场景拆分或去重，不能仅提高预算绕过检查。预算衡量 UTF-8 文本量，不代表模型 token 数或行为正确率。

官方 `@plasmicapp/cli` 与资源 CLI 分工见 [工具选择](references/guide.md#tool-choice) 和 [官方 CLI](references/official-cli.md)。MCP 完整组件读取包含配置的现代/旧查询定义及注册 import 身份；集成设置和源码不随模型读取下载，未知参数或未核对的迁移条件必须明确。
