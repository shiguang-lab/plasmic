# 根工具链 peer 验证

状态：本范围已关闭。验证日期：2026-11-06（Asia/Shanghai）。

实施目录：`/Users/yanxianliang/.codex/worktrees/react-19-upgrade/plasmic`；分支：`codex/react-19-implementation`。Node **24.20.0**，pnpm **11.10.0**。原工作区未修改，未提交、合入或发布外部包。

## 根因与最小修复

根 workspace 既有 `jest: catalog:` override 将 TSDX 自带的 Jest 25 解析为 **29.7.0**。完整来源为：

```text
37 个组件包的 devDependencies → tsdx@0.14.1
  ├─ babel-plugin-macros@2.8.0（TSDX 声明 ^2.6.1，默认 Babel 构建插件）
  └─ jest@29.7.0 → jest-cli/@jest/core → jest-config
       → jest-circus@29.7.0 → dedent@1.7.2
            → optional peer babel-plugin-macros ^3.1.0
```

`dedent` 的可选 peer 在 TSDX 上下文中实际解析到 2.8.0，因此根 `pnpm peers check` 退出 1；platform 检查通过。此冲突属于构建工具链。

仅在根 `pnpm-workspace.yaml` 增加有父包及版本限制的 override，并同步真实锁文件：

```yaml
overrides:
  # TSDX loads this plugin in its builds; Jest 29 dedent requires macros 3.
  "tsdx@0.14.1>babel-plugin-macros": "3.1.0"
```

TSDX 的 `dist/babelPluginTsdx.js` 默认插件列表直接使用该包；它是实际构建依赖。[官方 3.0 发布说明](https://github.com/kentcdodds/babel-plugin-macros/releases/tag/v3.0.0)的破坏性变更是要求 Node 10，已被 TSDX 自己的 Node >=10 合同覆盖；[3.1](https://github.com/kentcdodds/babel-plugin-macros/releases/tag/v3.1.0)增加可解析的宏文件扩展名。已比对官方 2.8.0/3.1.0 tarball 的实现并验证配置加载、宏执行及输出。

官方 registry 中 0.14.1 后的正式版本为 [TSDX 2.0](https://www.npmjs.com/package/tsdx)，构建改用 bunchee，测试与 lint 命令也改换工具；为修复本项迁移整个构建管线会扩大范围。采用官方宏插件 3.1.0 的局部升级，保留原有 TSDX 命令和包输出合同。

本项锁文件增量只移除 `babel-plugin-macros@2.8.0`、`cosmiconfig@6.0.0` 及对应旧 peer snapshots；没有新增包、没有改变其他包记录或 importer。最终共享锁文件另含其他会话的 commerce/swell 变更，已保留。包声明证据：[TSDX 0.14.1](https://registry.npmjs.org/tsdx/0.14.1)、[dedent 1.7.2](https://registry.npmjs.org/dedent/1.7.2)、[宏插件 3.1.0](https://registry.npmjs.org/babel-plugin-macros/3.1.0)。

## 验证结果

所有成功命令的退出码为 **0**，精确参数、cwd、各包退出码和日志路径记录于 [toolchain-peer-verification.json](toolchain-peer-verification.json)。原始日志与验证脚本保留于 `/tmp/plasmic-react19-toolchain-20261106`。

| 检查                                                                                                      | 结果                                                                                                                             |
| --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 根 / platform 的 `pnpm peers check`                                                                       | 均无 peer 问题                                                                                                                   |
| 从空 node_modules 执行 `pnpm install --frozen-lockfile --strict-peer-dependencies --reporter append-only` | 本项锁文件及最终组合锁文件各通过；未跳过安装脚本                                                                                 |
| 最终共享工作区执行同一 frozen/strict 安装                                                                 | 通过；安装前确认无共享构建、测试进程                                                                                             |
| 带 `--config.verify-deps-before-run=error` 读取真实 TSDX 依赖                                             | macros 3.1.0、Jest 29.7.0、TypeScript 5.9.3、Rollup 1.32.1、rollup-plugin-typescript2 0.37.0                                     |
| 宏验证                                                                                                    | ESM import、CJS require、配置文件、dedent 宏、非法宏诊断；TSDX dev/prod CJS、ESM 和声明生成及执行均通过                          |
| 实际包构建                                                                                                | 36 个 `tsdx build` 包及 query、host 两个 SDK，共 38 个命令通过；构建前移除各自 dist，确认 main/module/types/typings 实际存在     |
| 最终并行变更组合                                                                                          | 重新安装最终锁文件；重建 commerce、swell 均通过                                                                                  |
| 打包                                                                                                      | query、host、basic-components、tabs、embed-css、commerce-local 共 6 包通过；入口名称与字节一致，workspace/catalog 引用已正确替换 |
| tarball 消费者                                                                                            | 5 个未修改的 SDK/组件 tarball，经临时回环 registry 安装；严格 peer、`tsc --noEmit` 且 `skipLibCheck: false` 均通过               |
| React 19.3.1 运行验证                                                                                     | 已安装 tarball 的 CJS/ESM 在 development/production 均通过 SSR、组件注册元数据和 Tabs 注册检查                                   |

所有实际包构建命令均为 `pnpm --config.verify-deps-before-run=error --filter <具名包> build`，具名清单和完整参数见 JSON。37 个包声明 TSDX devDependency，其中 tiptap 实际使用 Rollup；本项未改动它的构建工具。SDK 中没有 TSDX 调用点，额外构建 query/host 用于验证组件的真实 SDK 边界。

同一沙箱、相同源代码的修复前后对比，共 **97** 个 JS、声明、映射等产物 SHA-256 完全一致：

| 包                                      | 对比产物数 | 全部一致 |
| --------------------------------------- | ---------- | -------- |
| `@plasmicapp/query`                     | 5          | 是       |
| `@plasmicapp/host`                      | 35         | 是       |
| `@plasmicpkgs/plasmic-basic-components` | 20         | 是       |
| `@plasmicpkgs/plasmic-tabs`             | 9          | 是       |
| `@plasmicpkgs/commerce-local`           | 28         | 是       |

## 诊断与边界

构建日志完整保留既有 Rollup <2.60 类型文件提示、plugin-replace 的 preventAssignment 提示，以及 commerce 的 provider/fetcher 循环依赖；SDK 构建无诊断。macOS seccomp 安装脚本保留既有 C++ 函数指针转换告警，安装退出 0。未屏蔽诊断或放宽检查。

初始沙箱漏拷 vendor/react-ui（退出 254）后已补齐重跑；直接访问公共 registry 的消费测试因未发布的 query 0.2.0 失败（退出 1），最终改为提供原样 tarball 的本地临时 registry。中间 workspace 模拟产生的 dev-bin 告警未作为成功消费者结果。其他会话移除 swell patch 后，依赖校验曾明确拒绝旧安装；待其共享测试结束后重新冻结安装，最终校验通过。这些日志在 JSON 中具名保留。

根 YAML 原有 EOF 空行仍会被相对于仓库 HEAD 的 `git diff --check` 提示；本项两行插入相对实施前快照没有新增空白诊断。

本报告覆盖工具链冲突及上述构建/API/宏验证，不代表每个业务组件交互均已验收。未修改 Studio 状态实现、Compiler 配置或其他会话的声明修复，也未更新它们的阶段报告。
