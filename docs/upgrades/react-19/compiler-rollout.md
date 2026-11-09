# Studio／Canvas／SDK Compiler 接入

当前验收合同是 **Studio／Canvas／SDK 运行链内的自有函数组件和 Hooks 零跳过**。已完成冻结源码候选审计、严格制品构建，以及完整 Studio 测试加修后逐项复验；不把本合同表述为全仓零跳过。

## 安装

主工作区根、platform、sub、live-frame、react-web-bundle 使用 pnpm 11.10.0。实际检查的 React／ReactDOM 为 19.3.1，类型为 19.3.0，Compiler 为 1.0.0。独立安装根分别验证，不能以根 workspace override 代替 iframe 构建根的解析身份检查。

以下命令从仓库根执行。新增构建依赖只更新所属安装根的必要 importer／依赖闭包；冻结安装前后应比较锁文件哈希，保留工作区既有变更。

```sh
pnpm install --frozen-lockfile
pnpm --dir platform install --frozen-lockfile
pnpm --dir platform/sub install --frozen-lockfile
pnpm --dir platform/live-frame install --frozen-lockfile
pnpm --dir platform/react-web-bundle install --frozen-lockfile
```

WAB 的浏览器预览将 `@babel/core@7.29.7`、`babel-plugin-react-compiler@1.0.0`、`sucrase` 作为实际运行依赖，并声明 `path-browserify@1.0.1`、`assert@2.1.0` 的浏览器能力。新增依赖更新所属 importer 后，platform 全部 12 个项目的冻结安装退出 0，证据为 `preview-compiler-platform-frozen-final.log`。

本轮安装日志、锁文件哈希和实际解析身份保存在 `/tmp/plasmic-react19-full-20261108/`；文件名为 `final-frozen-install-*.log`、`final-frozen-install-lock-hashes-*.json` 和 `final-installed-react-compiler-versions.json`。这些是定向检查证据，最终 manifest／锁文件仍需与冻结制品对应。

## 构建合同

- `platform/wab/tools/react-compiler.mjs` 统一维护 `infer`、React 19 target 和 `all_errors`。范围包括 Studio 前端、canvas-packages、Sub、react-web-bundle、live-frame 和 react-web 源码；测试、Storybook 用例及类型声明不作为产品组件计数。
- Studio、Dashboard Preview、Storybook 的 Rsbuild 转换与 WAB Vitest 使用同一范围和选项。Canvas esbuild、Sub webpack、SDK／iframe Rollup 各自在实际构建入口运行严格 Compiler。
- react-web 的公开声明由 `build-types.mjs` 从原始 TypeScript 独立生成；Compiler 降低后的运行时代码不决定公开参数和返回类型。
- react-web 使用无参 `useDollarState()` 持有稳定命令身份，渲染读取 `useDollarStateSnapshot(commands, renderEnv, specs)`；`StateInitializer` 在提交阶段持有初始化声明，事件命令读取即时环境和值。渲染不通过 Proxy 隐藏读取或跨 fiber 写初始化状态。
- 命名组件 ref 是命令资源。`usePlasmicRefs()` 只提供稳定的 `registerRef` 和 `getRefs`；注册变化不触发拥有者重新渲染。事件实际执行时读取普通命令登记表，跨异步等待再次取属性时仍得到当前句柄。渲染显示值和状态初始化输入不包含 ref 句柄；Canvas 通过私有 symbol 元数据传递稳定命令能力，不将它暴露为表达式变量或数据选择器条目。状态变更 helper 仅在命令执行时读取。外部组件每次提交产生新 imperative handle 是合法行为。
- `react-compiler-audit.mjs` 独立盘点组件／Hook 候选、继承 React 的类及实际转换结果，检查嵌套函数、包装器与工厂。诊断、解析错误、未转换候选或扫描期间源码变化均阻断验收。审计收集模式不是产品构建配置。
- 空生成 Hook 可以使用正向 `"use memo"` 显式要求实际转换，不添加虚假 Hook；关闭指令不能作为验收方案。
- React、Hooks、Context 和 Compiler runtime 必须属于同一 renderer。iframe 使用自己的 React；live-frame 的 `react` 外部映射为 `__Sub.React`，其模块运行时注册同一 iframe 的 `react/compiler-runtime`。
- 渲染消费真实不可变显示值／原生 store 投影。稳定模型、控制器和 Proxy 可保留命令身份，不能靠丢弃订阅结果后读取可变字段、revision 或额外 memo 依赖刷新界面。
- 图层树投影同时跟踪当前画板和模型生命周期。离开画板后只保留画板切换信号并返回固定空快照，切回后恢复动态订阅；卸载或模型失效时完整释放。子图层上下文先批量摘除，再发布一次状态变化并销毁，不能在活 Map 迭代中同步通知可重建节点的订阅者。
- 业务表达式保持原模型代码不变。函数局部 `var` 在原作用域中规范化以保留提升和循环闭包语义；含逻辑运算的三元条件使用 `(0, TEST)` 保留求值顺序、短路与词法作用域，适配 Compiler 1.0.0 的条件块限制，不增加绕过编译的业务函数。
- 生成代码的预览链先经过 Babel／严格 Compiler 和独立候选覆盖检查，再由 Sucrase 处理 TypeScript／JSX pragma／模块；未访问的业务组件和关闭指令也会被拒绝。不能仅以静态 live-frame 外壳通过构建签收。
- 浏览器使用 Babel 的 browser entry 并关闭文件配置发现。`preview-compiler-resolve.cjs` 的 path／assert 浏览器能力仅作用于 Babel／Compiler 依赖，未使用的 fs／os／tty／crypto 路径不提供；应用代码不获得全局 Node fallback。源码编辑会驱逐模块及其导入者并重新挂载，不使用 Fast Refresh 源码哈希路径。

React 的后代错误捕获仍需要原生 class 生命周期。以下三个最薄捕错边界单独计数，不计为函数转换成功，也不将业务 class 加入此例外：

| 文件 | class | 职责 |
| --- | --- | --- |
| `platform/canvas-packages/src/canvas-error.tsx` | `CanvasErrorBoundary` | Canvas 后代错误捕获及所属运行生命周期内的恢复 |
| `platform/canvas-packages/src/error-boundary.tsx` | `GenericErrorBoundary` | 原生后代错误捕获及 fallback |
| `platform/live-frame/src/render.tsx` | `PreviewErrorBoundary` | Preview 后代错误捕获、诊断归属及输入变化后的恢复 |

服务端邮件 SSR 和邮件 Host 使用同一严格 Compiler 合同。后端通过 `tools/backend-register.cjs` 的 Node 公共 `module.registerHooks` 在 esbuild 前编译 `server/emails`；其它后端模块沿用 esbuild。后端 React／ReactDOM 在 CJS、ESM 和链接 SDK 中解析到 WAB 的同一物理安装，Node 最低版本为 22.15.0。邮件 Host 的 Vite 构建编译相同业务组件并去重 React。邮件生成 CLI 使用同一后端入口；本地验收只生成 HTML，不发送邮件。定向回归及最终运行链证据见[最终运行链验收](release-verification.md)。

## 可复验入口

Canvas 安装入口从真实 manifest links 发现 SDK／hostless 前置项目，并按 workspace 拓扑构建，随后安装 platform、生成类型并构建全部 Canvas 入口；不能删入口或 externalize 缺失包来取得成功。

```sh
pnpm setup:canvas-packages
pnpm --dir platform/sub build
pnpm --dir platform/react-web-bundle build
pnpm --dir platform/live-frame test:runtime
pnpm --dir platform/canvas-packages test:canvas-runtime
pnpm --dir platform/wab exec node tools/react-compiler-audit.mjs /tmp/react-compiler-audit.json
pnpm --dir platform/wab test --project studio --maxWorkers=1 src/wab/client/components/live/preview-sync.test.tsx src/wab/client/components/live/live-runtime.test.ts
```

`live-frame test:runtime` 先运行严格生产构建，再加载正式 Sub、SDK-native 和 live-frame 制品验证两个独立 iframe；因此先完成前置 Sub／SDK-native 构建。覆盖原生更新、生成组件的 Compiler runtime、组件状态保留和错误恢复。源码级预览测试另覆盖首次 fiber 渲染前的命令、StrictMode、Suspense、诊断与卸载。

Studio／Dashboard Preview 构建需要真实部署环境变量。以下使用已有 self-hosted 配置进行本地生产制品验证，Compiler 合同保持不变；Storybook 脚本虽设 `NODE_ENV=development`，仍使用严格 Compiler。

```sh
PLASMIC_SELF_HOSTED=1 STATIC_URL=http://localhost:3003 PUBLIC_URL=http://localhost:3003 NODE_OPTIONS=--max-old-space-size=12288 pnpm --dir platform/wab build
pnpm --dir platform/wab storybook:build
```

## 验收状态

冻结源码审计 `compiler-final-frozen-audit.json`／`.log` 已退出 0；报告同时保留逐文件源码哈希。该前端阶段报告不包含服务端邮件。邮件纳入后的当前审计使用 `compiler-final-release-audit.json`；最终逐文件结果和制品对应关系见[最终运行链验收](release-verification.md)。

| 审计项 | 结果 |
| --- | --- |
| 扫描源码文件／有转换的文件 | 3270／2451 |
| 函数组件和 Hook 候选／实际 CompileSuccess | 5926／5926 |
| Compiler 诊断／解析错误／扫描期间源码漂移 | 0／0／0 |
| 未转换候选／未访问候选 | 0／0 |
| 业务 React class | 0 |
| 必需最薄捕错 class／缺失必需边界 | 3／0 |

以下是已实际完成的定向检查与制品验证，完整回归结果另列于表后。日志位于 `/tmp/plasmic-react19-full-20261108/`。

| 检查 | 已核实结果 | 日志 |
| --- | --- | --- |
| react-web SDK 测试 | 8 文件、57 项通过 | `sdk-all-final-tests.log` |
| react-web SDK TypeScript 6 | 退出 0 | `sdk-final-ts6.log` |
| WAB 集成类型检查 | 退出 0 | `wab-final-integration-tsc-2.log` |
| Compiler 范围／候选合同 | 2 文件、16 项通过 | `compiler-final-all-renderer-contract-tests.log` |
| Mixin／DataPickerEditor／AlertBanner drafts／ListStack | 4 文件、7 项通过 | `ui-root-projections-final.log` |
| Preview picker／ShareDialog 样式／image-section | 3 文件、7 项通过 | `build-owner-final-neighbor-suites.log` |
| live-frame／严格预览 Compiler／模块运行时 | 2 文件、29 项通过，含最后 class 别名覆盖检查 | `preview-final-frozen-tests.log`／`.json` |
| 真实 Rspack＋Chromium 浏览器 Compiler | 开发／生产 2 项通过；覆盖状态更新、同源保实例、源码／依赖驱逐、自定义 JSX pragma、CSS、无 Node 全局，以及四类严格拒绝 | `preview-compiler-chromium-final-2.log` |
| live-frame 正式产物双 iframe | 生产构建和 1 项运行测试通过 | `live-frame-production-realms.log` |
| Studio／Dashboard Preview 最终 self-hosted 制品 | 严格生产构建退出 0 | `production-studio-dashboard-final-guard.log` |
| Storybook 最终制品 | 严格构建退出 0 | `storybook-strict-final-frozen.log` |

完整 Studio 运行覆盖 862 文件、5640 项：原始运行退出 1，861 文件通过、1 文件失败；5633 项通过、3 项失败、4 项既有跳过。三项失败均为预览恢复 fixture 在 render 中写 `window.boundaryAttempts`，被新严格 Compiler 拒绝。计数改为测试宿主的 render-thunk spy，保留 data／hide／unmount 恢复、无自动重试及诊断断言，并新增实际编译成功断言；没有放宽产品 Compiler 或修改产品恢复逻辑。

修后最终预览 29 项全部通过。`final-integration-verification.json` 按绝对文件路径和完整测试名核对原始三项失败，3／3 均已通过；完整运行加最新逐项复验合计 **5636 通过、4 个既有测试跳过、零剩余失败**，仍覆盖 862 文件。四个既有跳过分布于 `focus-heuristics.test.ts`、`optimized-branching.test.ts`、`site-diffs/merge.test.ts`，不是产品组件／Hook 的 Compiler 跳过。原始 `studio-final-integration.log`／`.json` 的退出 1 和失败证据保留，不能改称全量运行一次退出 0。

冻结审计后再次核对产品源码哈希和文件 membership，零漂移；最终 Studio／Dashboard Preview／Storybook 构建全部退出 0。Webpack 对 Compiler bundle 中未使用的 Node 配置加载 `require(filepath)`／`require(name)` 仍报告动态依赖警告；未压制告警或增加应用级 Node fallback，开发／生产 Chromium 契约已实际验证浏览器路径。

产品源码继续变化时须重新审计并核对制品。邮件、SDK／CLI／CPA、独立服务及 Desktop 的最终验收见[最终运行链验收](release-verification.md)，性能和发布仍独立签收。
