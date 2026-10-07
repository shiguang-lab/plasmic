# Plasmic skill、CLI 与资源发布

统一的 `plasmic` skill 支持产品原型设计和开发代码生成。薄 skill 随 CLI 安装包发布；工作流、组件规范、MCP 契约和验收脚本由 CLI 在任务开始时从 NAS 检查和下载。

## 目录与事实源

```text
packages/plasmic-cli/skill/plasmic/SKILL.md  薄入口的唯一维护源
packages/plasmic-cli/src/                  CLI 运行代码，无外部运行依赖
packages/plasmic-cli/scripts/publish.mjs   tag / npm 版本与完整性检查、发布
ai/plasmic/references/guide.md             资源总入口
ai/plasmic/references/workflows/           prototype / codegen 工作流
ai/plasmic/references/codegen/             页面读取、项目工程、交互与验收规范
ai/plasmic/references/                     设计规范与 MCP 契约
ai/plasmic/scripts/                        结构、Slot、模型比较检查
scripts/build-plasmic-resources.mjs        构建资源与同版本 CLI 安装包
.github/workflows/publish-plasmic-cli.yml  新 tag 自动发布 npm + NAS
```

根目录不再放置 `skills/`。CLI 直接读取包内 `skill/plasmic/SKILL.md` 安装，无生成副本或复制构建步骤。`docs/search-form.md` 是组件契约的源文件，构建时进入 `references/search-form.md`；测试脚本不进入资源 bundle。

## 安装和使用

需要 Node.js 22.12 或更高版本。npm 发布完成后：

```sh
npx -y @plasmickit/cli@latest skill install --target ~/.codex/skills
npx -y @plasmickit/cli@latest context resolve --mode prototype
npx -y @plasmickit/cli@latest context resolve --mode codegen
```

其他客户端将 `--target` 换成其 skills 根目录。移走旧 `plasmic-prototype` 安装目录，避免两个入口同时匹配。安装只更新 `plasmic/SKILL.md`，不删除其他 skills 或用户文件。

也可以全局安装；每个任务先检查版本：

```sh
npm install -g @plasmickit/cli@latest
plasmickit version check
plasmickit references check
plasmickit references update
plasmickit context resolve --mode prototype
plasmickit context resolve --mode codegen
plasmickit references path
```

`version check` 查询 NAS 当前发布清单，返回正在运行的 `cliVersion`、NAS 发布的 `latestCliVersion`、资源最低要求 `minCliVersion`、`cliUpdateAvailable`、`cliCompatible` 和可直接安装的 `cliUrl`。`references check` 同时返回资源差异与 CLI 版本结果。CLI 低于最低版本时，`update` / `context resolve` 返回升级信息并停止；兼容的旧 CLI 可以加载新 references，同时报告有可用升级。薄 skill 的 `npx …@latest` 入口自动选择 npm 最新 CLI。

`context resolve` 每次读取 NAS 的 `latest.json`，更新并验证全部缓存文件，返回 `releaseId`、`version`、`resourceRoot`、`referencePath` 和该模式的 `mustRead` 绝对路径。prototype 模式返回原型工作流；codegen 模式额外返回四份代码规范，Agent 读取页面模型与当前组件实现后编写目标项目代码。

缓存默认位于 `~/.cache/plasmic/`：`releases/<releaseId>/` 保存版本，`current.json` 原子切换当前版本。`PLASMIC_RESOURCE_HOME` / `--home` 设置缓存目录；`PLASMIC_RESOURCE_URL` / `--feed` 设置资源源（HTTPS；loopback 测试允许 HTTP）。`path` 仅供显式离线检查，不能证明缓存最新。NAS 不可达或校验失败时停止依赖任务。更新以目录锁防止交叉写入；异常退出留下 `.update-lock` 时，确认没有更新进程后删除锁再执行。

## 代码生成规范

流程为：读取目标项目 → 读取真实 Plasmic 页面/状态/交互 → 核对当前组件实现与目标 API → 按工程规范实现项目代码 → 在真实入口验证。生成由 Agent 执行，CLI 提供最新 references；不调用 `export_code` 或官方 Plasmic CLI。

- [页面读取与实现依据](references/codegen/page-reading.md)：读取隐藏分支、实际组件信息、数据和资产，依据当前两端实现决定代码。
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
5. 后续 NAS job 下载该 artifact，配置 SSH 并更新 nginx/只读更新卷，保证 `latest.json` 使用 `no-store`。
6. 上传并校验产物，发布不可变目录，最后原子切换清单。NAS 同样拒绝回退或同版本不同内容。npm 成功、NAS 失败时可以重跑：npm 跳过相同已发布产物，继续 NAS 发布。

CLI 和资源清单的 `version` 都等于 release tag；源码 package.json 的版本用于本地开发，不要求每次 tag 手工修改。`MIN_CLI_VERSION` 位于 `src/protocol.mjs`，只在资源协议或运行能力需要新 CLI 时提高，避免纯 reference 更新强迫升级。资源目录仍使用内容哈希 `releaseId`，记录所有文件/安装包的 SHA-256 和大小。

### CI 必要配置

- npm：首次发布需要有 `@plasmickit` scope 发布权限的 `NPM_TOKEN` secret，或已登记该包的 Trusted Publisher。OIDC 配置填写 GitHub owner `shiguang-lab`、repo `plasmic`、workflow `publish-plasmic-cli.yml`；workflow 已声明 `id-token: write` 并安装最新版 npm。参考 [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/)。
- `NAS_SSH_HOST` secret：GitHub runner 可访问的 `user@hostname`，不能使用本机 SSH 别名 `ugreen-nas`。
- `NAS_SSH_KEY` secret：对应私钥。
- `NAS_SSH_KNOWN_HOSTS` secret：已核对的目标主机指纹；自定义端口需包含 `[host]:port`。
- 可选变量 `NAS_SSH_PORT`（默认 22）、`NAS_DEPLOY_DIR`（默认 desktop 配置的 NAS 目录）。目标 SSH 账号需要现有 Docker/Compose 部署权限。GitHub runner 必须可以连接该 SSH 地址。

npm 和 NAS 分别运行；缺少 NAS secrets 会使 NAS job 失败，不阻止 npm job，也不静默跳过 NAS。首次 npm 身份和 NAS 配置必须在实际推送发布 tag 前完成；本地测试不证明这些外部权限已经配置。

## 本地构建与发布检查

```sh
node packages/plasmic-cli/src/index.mjs skill install --target /absolute/test-skills
node scripts/build-plasmic-resources.mjs --version 0.0.35
# 默认只对 npm 做 dry-run（会查询真实 registry，不上传）：
node packages/plasmic-cli/scripts/publish.mjs --tag 0.0.35
# 手动发布 NAS 时必须显式指定同一 release 版本：
npm --prefix desktop run publish:resources -- --version 0.0.35
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
