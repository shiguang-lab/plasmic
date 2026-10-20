# Plasmic skill、CLI 与资源发布

统一的 `plasmic` skill 支持产品原型设计和开发代码生成。薄 skill 随 CLI 安装包发布；工作流、组件规范、MCP 契约和验收脚本由 CLI 在任务开始时从 NAS 检查和下载。

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
.github/workflows/publish-plasmic-cli.yml  新 tag 打包资源，CLI 内容变化时发布 npm
```

根目录不再放置 `skills/`。CLI 直接读取包内 `skill/plasmic/SKILL.md` 安装，无生成副本或复制构建步骤。通过 `references/libraries/index.md` 先匹配项目真实组件库和 API 版本，再读该库的组件索引。每个库/API 范围独立维护 `components/` 与适用的 `compositions/`；Antd 按官方主组件维度维护文档，Form.Item、RangePicker、Descriptions.Item、列、分组等子组件和变体放入父组件小节，不另建文件。标题使用库的主组件名称，文档和索引保留覆盖的 Studio 注册名称及 key。业务组件沿用这一粒度，SearchForm.Item 在 SearchForm 文档内维护。构建器直接打包 references，无组件文档生成副本；测试脚本不进入资源 bundle。

设计前通过 MCP 核对 imported project、注册 key、importPath 和可确认的实现版本；Studio 发布版本、wrapper npm 版本和底层 UI 版本分别记录。组合规范声明参与库，静态检查脚本只用于其已支持的库契约。没有匹配规范时依据真实实现、注册和通用设计规则完成可确认部分，明确缺少的规范覆盖；不回退套用 Antd 6，也不为适配模板切换目标组件库。组件库使用 `antd_v6`、`antd_v5`、`overseas`、`react_ui`、`antd_icons` 这样的单层目录名。目录标识注册组件库，底层依赖版本记入库索引的依赖说明，不追加到目录名。新增组件库时增加独立目录和索引、验证对应组件及依赖后接入总索引；不创建空版本占位或版本间重定向。

通用布局维护尺寸与伸缩、对齐、间距归属、内容溢出、响应式范围、吸附和滚动原则；各库的 Flex/Grid/Space/Layout 等文档维护真实 Props/Slots。组合文件维护实际区域关系和跨组件交互，不重复父组件或通用布局规则。

在已准备依赖的仓库根目录运行 `node scripts/validate-plasmic-component-coverage.mjs`，通过各库真实 `registerAll` 核对主组件归属、全部注册 key、最终显示名及图标目录。资源构建会额外检查组件文档与库索引的一致性，再校验链接、标题锚点、可达性和阅读预算。源码覆盖检查不替代组件运行或设计交付验收。

## 规范维护边界

新增规则先确定唯一维护位置；跨设计任务的核心约束维护在薄 SKILL，reference 只保留具体选型、使用和验证细节，并引用核心规范，不重复定义。保留组件特有的可观测行为；通用“保存/重开/截图不等于通过”由工作流与验收文档定义，组件可简短引用。规则区分能力事实、产品缺省约定、明确强制项和示例；任务个例不直接升级为全局要求。

| 内容 | 维护位置 |
| --- | --- |
| 资源加载、模式选择、客户端实现访问边界、组件优先核心规范及自定义例外条件 | 薄 SKILL |
| 组件库/API 匹配与按角色选型 | libraries/index |
| 任务步骤、受支持范围 | workflows；Pen 证据格式在 design-references |
| 工具上下文/恢复、渲染、资源操作 | desktop-context / inspection / media |
| 需求优先级、范围与验收声明含义 | requirement-alignment |
| 组件 Props/Slots 使用与特有行为 | 匹配库的 components |
| 跨组件区域关系与动作位置 | 匹配库的 compositions |
| 脚本输入、证据、复用与通过条件 | verification；格式以公开 plan_schema 为准 |
| 平台工程验证 | engineering；发布维护说明留在本 README |

修改时检查所有入链、相邻组合及跨模式影响；删除被取代的表述，避免在多个层级追加同一条事故修复。以只读审查、局部编辑、完整生成、不同组件库、缺契约恢复、代码生成等实际场景走读。运行链接/锚点/覆盖/预算及相关行为检查；这些静态检查不能证明模型一定遵守规范。唯一源码是仓库入口和 references，安装副本由 CLI 更新；本地编辑不代表已发布或已安装。

## 安装和使用

需要 Node.js 22.12 或更高版本。npm 发布完成后：

```sh
npx -y @plasmickit/cli@latest skill install
npx -y @plasmickit/cli@latest context resolve --mode inspect
npx -y @plasmickit/cli@latest context resolve --mode prototype
npx -y @plasmickit/cli@latest context resolve --mode codegen
```

`skill install` 非交互地检测本机受支持的 Agent CLI、桌面应用、IDE 扩展和用户配置目录，为所有检测到的客户端安装包内同一份 `plasmic/SKILL.md`，无需选择客户端或输入安装路径。CLI 检测检查 PATH 中的可执行文件，不启动客户端。应用检测使用 macOS 系统/用户 Applications、Windows 开始菜单快捷方式、Linux XDG 桌面入口；IDE 扩展检测包含 VS Code、VS Code Insiders、Cursor 和 Windsurf 的扩展目录。配置目录是安装线索，可能属于尚未卸载干净的客户端；检测依据随结果返回。

默认使用用户级 Skill 目录，不修改当前项目。共用目录或已存在的 Skill 目录符号链接会合并为一次安装。内容相同返回 `unchanged`；更新通过临时文件原子替换 `SKILL.md`，保留其他 Skill 与用户附加文件。未发现受支持客户端时不写入并返回非零退出码；某个安装位置失败时继续其他位置，结果逐项报告错误并返回非零退出码。

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

`version check` 查询 NAS 当前发布清单；清单的 `version` 是资源版本，`cliVersion` 是所附 npm 包版本。CLI 升级判断只比较 `cliVersion`。命令返回正在运行的 `cliVersion`、NAS 发布的 `latestCliVersion`、资源最低要求 `minCliVersion`、`cliUpdateAvailable`、`cliCompatible` 和可直接安装的 `cliUrl`。`references check` 同时返回资源差异与 CLI 版本结果。CLI 低于最低版本时，`update` / `context resolve` 返回升级信息并停止；兼容的旧 CLI 可以加载新 references，同时报告有可用升级。薄 skill 的 `npx …@latest` 入口自动选择 npm 最新 CLI。

`context resolve` 每次读取 NAS 的 `latest.json`，更新并验证全部缓存文件，返回 `releaseId`、`version`、`resourceRoot`、`referencePath` 和该模式的 `mustRead` 绝对路径。inspect 模式返回只读解读流程和共用模型读取契约；prototype 模式返回原型工作流，通过后台索引按受影响区域选读；codegen 模式返回模型读取、工程与验收规范，数据/交互规范在涉及对应行为时读取。解释模板和设计审查不要求编辑权限，不安装库或保存设计。

资源命令在 stderr 实时输出友好的阶段提示，版本检查显示当前版本和最新版本，资源无需更新且缓存完整时直接提示当前已是最新版本；需要加载时显示下载与哈希校验进度。正常加载不展示缓存保存、更新协调和工作流入口等内部步骤。下载显示已接收字节与实际进度，阶段持续超过两秒时定期显示等待时长；失败提示标明当前阶段。stdout 仅输出最终 JSON，阶段内失败时，错误 JSON 包含失败阶段 `stage`。AI 应使用运行工具的增量输出能力转述阶段变化；工具若只在退出后返回日志，CLI 无法保证中途显示，AI 应说明仍在等待，不能编造进度。工作流入口就绪只代表文件可供阅读，Agent 仍需读取返回的 `mustRead`。

缓存默认位于 `~/.cache/plasmic/`：`releases/<releaseId>/` 保存版本，`current.json` 原子切换当前版本。`PLASMIC_RESOURCE_HOME` / `--home` 设置缓存目录；`PLASMIC_RESOURCE_URL` / `--feed` 设置资源源（HTTPS；loopback 测试允许 HTTP）。`path` 仅供显式离线检查，不能证明缓存最新。NAS 不可达或校验失败时停止依赖任务。更新以目录锁防止交叉写入；异常退出留下 `.update-lock` 时，确认没有更新进程后删除锁再执行。

## 管理后台模板规范

原型 workflow 要求在组合后台页面前读取 [模板规范](references/admin-templates.md) 和 [素材库目录](references/templates/admin/catalog.json)。目录提供 Admin Templates 的真实项目、十个组合组件、适用场景、Slots、版本和组合规则；AI 按需求选型，通过 Desktop MCP 核对实时模型和目标项目契约，再复用或参考结构组合。布局优先使用现有 Antd Flex、Row/Col、Space 和 Card，业务状态、事件和路由由目标项目绑定。

模板规范、目录和 [UiConfig](references/templates/admin/ui-config.json) 均由资源构建器自动纳入 bundle，不依赖目标项目存在本仓库的 `examples/` 目录。`examples/admin-templates/` 保存素材库生成函数、使用说明和验收证据；目录和配置只在 `references/templates/admin/` 维护。发布新素材库版本后核对实时 UUID、Slots、依赖和缩略图，更新目录并同步 UiConfig。

素材库的 `publishedVersion` 与 skill 资源发布版本独立。规范发布使外部 AI 可以发现素材库，不会应用组织 UiConfig，也不会接入 Studio 内置 AI 检索。配置是否启用、目标用户是否有素材库访问权限，都需要通过当前系统核对。

### Reference 更新发布

仅修改 references 时无需修改薄 `SKILL.md`、CLI 运行代码或最低 CLI 版本。资源版本使用一个未发布的 `resources-v<版本>` tag；相同版本不能覆盖不同内容。先在仓库根目录完成本地打包检查，例如：

```sh
node scripts/build-plasmic-resources.mjs --version 0.0.59 --output /tmp/plasmic-resources-0.0.59
```

版本号是示例，发布前检查 npm 和 NAS 当前版本，选择更大的未发布版本。本地构建会运行验收脚本单测并验证资源 manifest、文件哈希和安装包；CLI 使用源码 package.json 的独立版本。它不会发布或切换 NAS 清单，也不替代正式发布的 npm 内容比较。检查 manifest 包含 `references/admin-templates.md`、`references/templates/admin/catalog.json` 和 `references/templates/admin/ui-config.json`。

正式发布沿用下文的独立 tag 流程：提交规范，推送 `resources-v<版本>`，等待资源 workflow 成功，下载该次资源 artifact，再通过 `publish:resources --from ... --version ...` 部署。仅 references 或资源脚本变化时复用 npm 最新 CLI 的版本和原始安装包；薄 SKILL 发生变化则先发布包含它的 CLI。资源 tag 不触发 Studio/Desktop 发布。NAS 部署必须使用该次 CI 产物，不重新构建覆盖已发布版本。

NAS 部署成功后，客户端执行：

```sh
npx -y @plasmickit/cli@latest context resolve --mode prototype
```

核对返回的 `version`、`releaseId`，以及返回 `resourceRoot` 下的模板规范和目录。原型 workflow 会引导读取这些文件。已有兼容 CLI 可以下载新的 references；无需重新安装 skill 或 Desktop App。更新只影响下一次规范加载，已运行任务应重新 resolve/read 后使用新规则。

## 代码生成规范

流程为：读取目标项目 → 读取真实 Plasmic 页面/状态/交互 → 核对当前组件实现与目标 API → 按工程规范实现项目代码 → 在真实入口验证。生成由 Agent 执行，CLI 提供最新 references；不调用 `export_code` 或官方 Plasmic CLI。

- [页面读取与实现依据](references/model-reading.md)：读取隐藏分支、实际组件信息、数据和资产，依据当前两端实现决定代码。
- [项目代码规范](references/codegen/project-code.md)：目录职责、组件拆分、类型边界、主题样式、宿主与独立应用、国际化和权限。
- [数据与交互规范](references/codegen/interactions.md)：状态所有权、查询分页、请求竞态、表单校验、弹层生命周期与防重提交。
- [代码验收规范](references/codegen/acceptance.md)：类型/构建检查、真实入口行为和视觉验证、交付证据。

提炼依据是 pen-antd-kit 的设计规范（`pen-prototype-platform/standards/patterns/`、`states/feedback-permissions.md`、`quality/review-checklist.md`）与 fintechgrowthui 的 `docs/standards/code-architecture.md`、`interaction-and-validation.md`、`design.md`。pen-antd-kit 的 Pencil 组件映射契约不进入本规范；fintechgrowthui 的特定宿主、接口签名、依赖版本和组件 API 也不作为跨项目规则。Plasmic 组件到目标代码的具体转换需根据当前注册信息、真实实现和目标项目类型确认。

## Tag 自动发布

四种产物使用独立入口和版本：

| 产物 | Tag | 变更判断 |
| --- | --- | --- |
| Studio | `0.1.0` | 主/次版本升级始终发布并联动 Desktop；补丁版本比较生产输入，前端变化联动 Desktop |
| Desktop | `desktop-v0.1.0` | 主/次版本升级始终发布，补丁版本比较生产输入；Studio 联动时自动创建，不重复手工推送 |
| CLI | `cli-v0.1.0` | 主/次版本升级始终发布；补丁版本比较实际 npm 包内容，忽略包版本和归档元数据 |
| 资源 | `resources-v0.1.0` | 主/次版本升级始终发布；补丁版本比较 references、脚本、资源构建和 CLI 包输入 |

资源第一次使用独立 tag 时，以最后一个旧数字 tag 为基线。Studio/纯 Desktop 发布均不发布 CLI 或资源；CLI 发布也不构建资源。资源发布从 npm 下载当前 latest CLI，验证完整性并复用原始字节，不包含尚未发布的本地 CLI 修改。CLI 包变化也视为资源发布输入变化：先发布 CLI，再推送新资源 tag 并部署该次 CI 产物，更新 NAS 清单中的 `cliVersion` 和 CLI 安装包，使版本检查与 npm latest 一致。

CLI 的源码 package.json 版本用于开发，发布版本来自 `cli-v` tag。资源清单的 `version` 来自 `resources-v` tag，`cliVersion` 来自 npm。`MIN_CLI_VERSION` 位于 `src/protocol.mjs`，不得高于资源清单的 `cliVersion`。资源目录使用内容哈希 `releaseId`，记录所有文件和安装包的 SHA-256 与大小。

发布前在提交上运行 `node scripts/release-plan.mjs <tag>` 检查范围。Studio 前端发布或主/次版本升级必须在同一提交中更新 Desktop 版本、五语言发布说明及指向该 Studio tag 的 `webImage`；校验失败则不开始镜像构建。

### CI 必要配置

- npm：需要有 `@plasmickit` scope 发布权限、启用 Bypass 2FA 的 granular `NPM_TOKEN` secret，或已登记该包的 Trusted Publisher。OIDC 配置填写 GitHub owner `shiguang-lab`、repo `plasmic`、workflow `publish-plasmic-cli.yml`；workflow 已声明 `id-token: write` 并安装最新版 npm。参考 [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/)。

各自的 Actions 分别负责发布 npm、构建 Studio 镜像或打包资源。NAS 部署在本机单独执行，使用本机 SSH 配置和已下载的 Actions 产物。

## 单独部署 NAS 资源

从成功的资源 workflow 下载 `plasmic-resources-<tag>` artifact，解压到一个目录。该目录包含 `latest.json` 和 `releases/<releaseId>/`。部署必须通过 `--from` 直接使用这份产物，使 NAS CLI 安装包与 npm 发布包保持相同字节；部署脚本不会本地重新构建。

```sh
# 首次配置 nginx 和只读更新卷：
npm --prefix desktop run setup:nas-updates
# 发布下载并解压的资源版本对应产物：
npm --prefix desktop run publish:resources -- --from /absolute/path/to/plasmic-resources --version 0.0.38
```

`desktop.config.json` 的 `nasHost` 和 `nasDeployDir` 使用本机现有 SSH 别名与部署目录；也可通过 `PLASMIC_NAS_HOST`、`PLASMIC_NAS_DEPLOY_DIR`、`PLASMIC_NAS_SSH_PORT` 指定。部署账号需要现有 Docker/Compose 权限。脚本验证产物版本、哈希、公开 HTTPS 访问与清单 `no-store`，先上传不可变目录，最后原子切换清单；拒绝回退和同版本不同内容。发布失败时保留当前清单，重新执行同一产物部署即可。

## 本地构建与发布检查

```sh
node packages/plasmic-cli/src/index.mjs skill install --dry-run
node scripts/build-plasmic-resources.mjs --version 0.0.59
# 默认只对 npm 做 dry-run（会查询真实 registry，不上传）：
node packages/plasmic-cli/scripts/publish.mjs --tag cli-v0.0.83
# 资源仅使用已经发布并校验的 CLI：
node scripts/release-resources.mjs --tag resources-v0.0.84
```

CLI 主/次版本升级会发布当前包内容；补丁版本仅在实际包内容变化时调用 npm publish，且要求版本递增。上传 npm 需要显式加 `--execute`；CLI tag 的 CI 会自动传入。Desktop `publish:nas` 不覆盖资源清单。

本地构建目录 `dist/plasmic-resources/` 对应 NAS：

```text
/desktop-updates/plasmic/latest.json              no-store 当前清单
/desktop-updates/plasmic/releases/<releaseId>/
  manifest.json                                 immutable 清单
  resources.json.gz                             references + scripts
  plasmic-cli.tgz                               CLI + 薄 skill
```

使用现有 `plasmic-desktop-updates` Docker volume 与 nginx。NAS 发布后检查公开 HTTPS 的清单缓存策略和两个安装文件的哈希。npm 不可用时，可从 NAS 清单给出的 `cliUrl` 安装同一 CLI；更新工具会返回该 URL。

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

构建器直接检查维护中的 references：本地链接、标题锚点、从 guide 的可达性以及注册组件目录覆盖；不生成或注入文档副本。guide 和 Desktop 核心契约各不超过 4 KiB，工作流各不超过 6 KiB，单份场景 reference 不超过 20 KiB，每个模式的 mustRead 总量不超过 24 KiB。超限应按真实场景拆分或去重，不能仅提高预算绕过检查。预算衡量 UTF-8 文本量，不代表模型 token 数或行为正确率。

官方 `@plasmicapp/cli` 与资源 CLI 分工见 [工具选择](references/guide.md#tool-choice) 和 [官方 CLI](references/official-cli.md)。MCP 完整组件读取包含配置的现代/旧查询定义及注册 import 身份；集成设置和源码不随模型读取下载，未知参数或未核对的迁移条件必须明确。
