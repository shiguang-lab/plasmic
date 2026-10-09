# Plasmic skill、CLI 与资源发布

统一的 `plasmic` skill 支持产品原型设计和开发代码生成。薄 skill 随 CLI 安装包发布；工作流、组件规范、MCP 契约和验收脚本由 CLI 在任务开始时从 NAS 检查和下载。

## 目录与事实源

```text
packages/plasmic-cli/skill/plasmic/SKILL.md  薄入口的唯一维护源
packages/plasmic-cli/src/                  CLI 运行代码，无外部运行依赖
packages/plasmic-cli/scripts/publish.mjs   tag / npm 版本与完整性检查、发布
ai/plasmic/references/guide.md             资源总入口
ai/plasmic/references/workflows/           inspect / prototype / codegen 工作流
ai/plasmic/references/model-reading.md     只读解读与 coding 共用的模型读取契约
ai/plasmic/references/codegen/             项目工程、交互与验收规范
ai/plasmic/references/design/              按受影响区域选读的后台设计规则
ai/plasmic/references/engineering/         仅平台/组件实现任务使用的验证规则
ai/plasmic/references/                     设计规范与 MCP 契约
ai/plasmic/references/admin-templates.md    管理后台模板选择、组合与绑定规范
ai/plasmic/references/templates/admin/     素材库目录和官方 UiConfig 的唯一维护源
ai/plasmic/scripts/                        结构、Slot、模型比较检查
scripts/build-plasmic-resources.mjs        构建资源与同版本 CLI 安装包
.github/workflows/publish-plasmic-cli.yml  新 tag 自动发布 npm 并打包资源
```

根目录不再放置 `skills/`。CLI 直接读取包内 `skill/plasmic/SKILL.md` 安装，无生成副本或复制构建步骤。`docs/search-form.md` 是组件契约的源文件，构建时进入 `references/search-form.md`；测试脚本不进入资源 bundle。

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

`version check` 查询 NAS 当前发布清单，返回正在运行的 `cliVersion`、NAS 发布的 `latestCliVersion`、资源最低要求 `minCliVersion`、`cliUpdateAvailable`、`cliCompatible` 和可直接安装的 `cliUrl`。`references check` 同时返回资源差异与 CLI 版本结果。CLI 低于最低版本时，`update` / `context resolve` 返回升级信息并停止；兼容的旧 CLI 可以加载新 references，同时报告有可用升级。薄 skill 的 `npx …@latest` 入口自动选择 npm 最新 CLI。

`context resolve` 每次读取 NAS 的 `latest.json`，更新并验证全部缓存文件，返回 `releaseId`、`version`、`resourceRoot`、`referencePath` 和该模式的 `mustRead` 绝对路径。inspect 模式返回只读解读流程和共用模型读取契约；prototype 模式返回原型工作流，通过后台索引按受影响区域选读；codegen 模式返回模型读取、工程与验收规范，数据/交互规范在涉及对应行为时读取。解释模板和设计审查不要求编辑权限，不安装库或保存设计。

缓存默认位于 `~/.cache/plasmic/`：`releases/<releaseId>/` 保存版本，`current.json` 原子切换当前版本。`PLASMIC_RESOURCE_HOME` / `--home` 设置缓存目录；`PLASMIC_RESOURCE_URL` / `--feed` 设置资源源（HTTPS；loopback 测试允许 HTTP）。`path` 仅供显式离线检查，不能证明缓存最新。NAS 不可达或校验失败时停止依赖任务。更新以目录锁防止交叉写入；异常退出留下 `.update-lock` 时，确认没有更新进程后删除锁再执行。

## 管理后台模板规范

原型 workflow 要求在组合后台页面前读取 [模板规范](references/admin-templates.md) 和 [素材库目录](references/templates/admin/catalog.json)。目录提供 Admin Templates 的真实项目、十个组合组件、适用场景、Slots、版本和组合规则；AI 按需求选型，通过 Desktop MCP 核对实时模型和目标项目契约，再复用或参考结构组合。布局优先使用现有 Antd Flex、Row/Col、Space 和 Card，业务状态、事件和路由由目标项目绑定。

模板规范、目录和 [UiConfig](references/templates/admin/ui-config.json) 均由资源构建器自动纳入 bundle，不依赖目标项目存在本仓库的 `examples/` 目录。`examples/admin-templates/` 保存素材库生成函数、使用说明和验收证据；目录和配置只在 `references/templates/admin/` 维护。发布新素材库版本后核对实时 UUID、Slots、依赖和缩略图，更新目录并同步 UiConfig。

素材库的 `publishedVersion` 与 skill 资源发布版本独立。规范发布使外部 AI 可以发现素材库，不会应用组织 UiConfig，也不会接入 Studio 内置 AI 检索。配置是否启用、目标用户是否有素材库访问权限，都需要通过当前系统核对。

### Reference 更新发布

仅修改 references 时无需修改薄 `SKILL.md`、CLI 运行代码或最低 CLI 版本。资源版本仍必须使用一个未发布的新数字 tag；相同版本不能覆盖不同内容。先在仓库根目录完成本地打包检查，例如：

```sh
node scripts/build-plasmic-resources.mjs --version 0.0.59 --output /tmp/plasmic-resources-0.0.59
```

版本号是示例，发布前检查 npm 和 NAS 当前版本，选择更大的未发布版本。本地构建会运行验收脚本单测并验证资源 manifest、文件哈希和安装包；不会发布或切换 NAS 清单。检查 manifest 包含 `references/admin-templates.md`、`references/templates/admin/catalog.json` 和 `references/templates/admin/ui-config.json`。

正式发布沿用下文的 tag 流程：提交本次规范文件，推送新数字 tag，等待 CLI workflow 成功，从该次 workflow 下载同版本 `plasmic-resources-<tag>` artifact，再通过 `publish:resources --from ... --version ...` 部署到 NAS。该数字 tag 还会触发现有 server/web 镜像 workflow；它不是仅触发 references 的专用 tag。NAS 部署必须使用该次 CI 产物，不要重新构建并覆盖已发布版本。

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

沿用仓库的数字版本 tag，例如 `0.0.35`，不增加另一套 `cli-v*` tag。推送稳定版本 tag 同时触发现有 server/web 镜像 workflow 和新的 CLI/resources workflow；CLI 发布不需要等待镜像构建。

新的 workflow 使用 GitHub-hosted Node 24 runner，顺序执行：

1. 校验 tag 是无 `v` 前缀的稳定 SemVer，运行 CLI、安装包和 NAS promotion 测试。
2. 在临时包目录把 CLI `package.json.version` 设置为 tag，再构建 CLI 和资源清单。仓库文件不被改写。
3. 查询 npm 包版本、`latest` 和 `dist.integrity`；拒绝回退、tag 与产物版本不一致，以及同版本不同内容。相同版本、相同完整性且已为 latest 时幂等跳过。
4. 发布同版本 public npm 包，等待 registry 同步并核对版本和完整性，再保存同一份 CLI/资源到 Actions artifact。

CLI 和资源清单的 `version` 都等于 release tag；源码 package.json 的版本用于本地开发，不要求每次 tag 手工修改。`MIN_CLI_VERSION` 位于 `src/protocol.mjs`，只在资源协议或运行能力需要新 CLI 时提高，避免纯 reference 更新强迫升级。资源目录仍使用内容哈希 `releaseId`，记录所有文件/安装包的 SHA-256 和大小。

### CI 必要配置

- npm：需要有 `@plasmickit` scope 发布权限、启用 Bypass 2FA 的 granular `NPM_TOKEN` secret，或已登记该包的 Trusted Publisher。OIDC 配置填写 GitHub owner `shiguang-lab`、repo `plasmic`、workflow `publish-plasmic-cli.yml`；workflow 已声明 `id-token: write` 并安装最新版 npm。参考 [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/)。

Actions 负责发布 npm、构建 server/web 镜像并打包资源。NAS 部署在本机单独执行，使用本机 SSH 配置和已下载的 Actions 产物。

## 单独部署 NAS 资源

从成功的 CLI workflow 下载 `plasmic-resources-<tag>` artifact，解压到一个目录。该目录包含 `latest.json` 和 `releases/<releaseId>/`。部署直接使用这份产物，使 NAS CLI 安装包与 npm 发布包保持相同字节；不要重新打包已经发布的版本。

```sh
# 首次配置 nginx 和只读更新卷：
npm --prefix desktop run setup:nas-updates
# 发布下载并解压的同版本产物：
npm --prefix desktop run publish:resources -- --from /absolute/path/to/plasmic-resources --version 0.0.38
```

`desktop.config.json` 的 `nasHost` 和 `nasDeployDir` 使用本机现有 SSH 别名与部署目录；也可通过 `PLASMIC_NAS_HOST`、`PLASMIC_NAS_DEPLOY_DIR`、`PLASMIC_NAS_SSH_PORT` 指定。部署账号需要现有 Docker/Compose 权限。脚本验证产物版本、哈希、公开 HTTPS 访问与清单 `no-store`，先上传不可变目录，最后原子切换清单；拒绝回退和同版本不同内容。发布失败时保留当前清单，重新执行同一产物部署即可。

## 本地构建与发布检查

```sh
node packages/plasmic-cli/src/index.mjs skill install --dry-run
node scripts/build-plasmic-resources.mjs --version 0.0.59
# 默认只对 npm 做 dry-run（会查询真实 registry，不上传）：
node packages/plasmic-cli/scripts/publish.mjs --tag 0.0.59
```

实际发布 npm 需要显式加 `--execute`；推送 tag 的 CI 会自动传入。Desktop App 使用自己的发布流程；CLI/resources 现在由仓库 release tag 发布，Desktop `publish:nas` 不再另外覆盖该清单。

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

```sh
npm --prefix packages/plasmic-cli test
node --test desktop/tests/plasmic-resources.test.cjs desktop/tests/mcp-skill.test.cjs
python3 ai/plasmic/scripts/test_verify_slots.py
python3 ai/plasmic/scripts/test_verify_structure.py
```

行为评测见 [evals](evals/README.md)：用独立上下文覆盖只读解读、局部原型修改、现有代码更新、官方 CLI 和跨项目保存副作用，并对生成代码与修改计划做独立验证。fixture 评测与真实 Desktop 的 Preview、保存、重开验收分别记录。

## 渐进式资源检查

构建器在打包前检查本地 reference 链接、标题锚点和从 guide 可达性，包括构建时加入的 SearchForm 文档。guide 和 Desktop 核心契约各不超过 4 KiB，工作流各不超过 6 KiB，单份场景 reference 不超过 20 KiB，每个模式的 mustRead 总量不超过 24 KiB。超限应按真实场景拆分或去重，不能仅提高预算绕过检查。预算衡量 UTF-8 文本量，不代表模型 token 数或行为正确率。

官方 `@plasmicapp/cli` 与资源 CLI 分工见 [工具选择](references/guide.md#tool-choice) 和 [官方 CLI](references/official-cli.md)。MCP 完整组件读取包含配置的现代/旧查询定义及注册 import 身份；集成设置和源码不随模型读取下载，未知参数或未核对的迁移条件必须明确。
