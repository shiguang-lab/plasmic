# 升级范围覆盖矩阵与文档审核

审核日期：2026-11-05。源码基准：`32df7af09a1df7d119143b546f14a81b6d876c83`。实施状态与已运行证据见 implementation-report.md；本矩阵定义验收范围，不代表全部通过。

原方案覆盖了 Studio 主链，但遗漏独立 Preview 服务、渲染服务、JSX runtime、框架适配、脚手架／示例、测试版本矩阵和若干 UI 依赖。以下范围全部纳入 U0–U6，不再仅以“实施时搜索”代替具名任务。Compiler 与 O1–O4 性能实验仍独立验收；“包含全部相关升级”不表示把所有新 API 或无关依赖都升级到最新。

## 1. 完整性基线

[scope-inventory.json](scope-inventory.json)记录本次扫描的全部 144 个 package.json，其中 98 个直接声明 React／类型／相关运行时／Next；还记录所有检索到的 workspace／锁文件及其摘要。范围涵盖根、platform、packages、plasmicpkgs、plasmicpkgs-dev和 vendor，不仅是 pnpm 根工作区成员。

```sh
node docs/upgrades/react-19/inventory.mjs --check
```

安装／声明变化后先审核差异及本矩阵，再用 `--write` 刷新快照。命令只核查源码覆盖，不等于 peer 兼容或运行通过。它包含没有直接 React 声明的工具包，便于追踪脚手架、发布和代码生成依赖闭包。pnpm YAML 的 catalog／override／patch 仍须按 U0.11 人工分析，文件摘要本身不能解释语义。

完整升级的条件：每个直接相关 manifest、实际执行的消费者以及 React peer 依赖都有“升级／已满足但验证／移除并清理调用方”之一的处置及证据。未决项目算阻塞，不能笼统排除旧 SDK 或旧组件后声称全仓完成。examples 已按用户确认完整退役，并清理活跃引用；当前 Admin Templates 维护资料迁入 ai/plasmic/admin-templates。没有直接 React 的独立后端／非 React 示例不强制升级其框架，但共享产物变化仍需检查。

Rich Components、Sortable、Quill、Rive、YouTube 按用户确认完整退役，相关专用入口、依赖、Pro 替身与专属测试已清理；数据源和表单夹具迁至维护组件。历史 bundle migration 文件仍须保留其版本序列。

## 2. 按运行链覆盖

| 范围 ID | 全部相关对象／入口                                                                                                                                                                                                       | 必须交付                                                                                                                                                                                      | 对应检查         |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| S01     | Studio、sub、live-frame、react-web-bundle、canvas-packages、loader-html-hydrate、loader-bundle-env 及内部打包包                                                                                                          | 所有安装根、JSX／server／client 导出、局部 root、注册脚本与 hash 一致；包含 Dev/Prod/Storybook／诊断工具                                                                                      | I01–I08、Q01–Q18 |
| S02     | [platform/preview](../../../platform/preview/package.json) Next 服务；与 live-frame Preview 不同                                                                                                                         | Next 14.2.35 升到经验证支持 React 19 的版本，匹配 loader-nextjs、React／类型、Node；验证动态预览、SSR、导航、参数与缓存                                                                       | I09、Q19         |
| S03     | [platform/react-renderer](../../../platform/react-renderer/package.json) 独立服务／锁文件／原生构建                                                                                                                      | 更新 React 18 和 loader-react ^1.0.174 的消费链；验证进程隔离、超时、prepass、SSR 输出及 hydration，不能直接启动生产配置                                                                      | I09、Q20         |
| S04     | 核心 SDK 的 10 个直接相关包：host、react-web、react-web-runtime、query、prepass、auth-react、data-sources、data-sources-context、loader-react、loader-nextjs；其余发布依赖闭包在快照中 | 逐包 peer／dev/runtime／types／exports／API 声明；维护的全部消费者转 19。用户已确认没有 Gatsby 或旧 RSC 仓库外消费者；已退役 Gatsby、deprecated nextjs-app-router、旧 client-reference 回调与模拟 prepass 渲染，删除其配置及源码；普通 loader 保留原生 SSR 取数和服务端查询                 | I10、Q14/Q21     |
| S05     | [react-web-runtime](../../../packages/react-web-runtime/src/util.ts) 自定义 JSX shim 与 codegen；[canComponentTakeRef](../../../platform/wab/src/wab/shared/react-utils.ts)／组件注册                                    | 检查 Fragment、key、children、ref、cloneElement、元素／Context 符号与类型识别；ref 成为 prop 不代表所有函数组件都会转发 DOM；生成代码和组件注册元数据同时正确                                 | I10、Q22         |
| S06     | 全部维护中的 plasmicpkgs manifests，含 commerce-providers；特别是 antd4/5/6、react-ui、overseas、antd-icons、react-aria、tiptap、framer-motion、Radix               | 每个包有具名处置，不只测 antd6；同时核对 canvas 和 loader-bundle-env、skinny/full 产物及其实际安装版本。overseas 的本地 React／types 精确声明不受“根 catalog 已改”自动覆盖                    | I11、Q10/Q23     |
| S07     | [create-plasmic-app](../../../packages/create-plasmic-app/package.json)、其 run-cpa、src 策略和已跟踪 cpa-out 的 11 套输出；[CLI](../../../packages/cli/package.json) 的 init／sync／codegen／RSC                        | 同时升级生成源和重新生成的结果；纯 React 的 create-vite@9.3.4、create-next-app@16.3.1 不能继续产生与新 SDK 冲突的 React 范围。JS/TS、Pages/App、loader/codegen、TanStack 按提供的能力全覆盖 | I12、Q24         |
| S08     | platform/host-test、loader-tests 下 CRA／Next／HTML 独立 fixture、platform/integration-tests、wab/playwright                                                                                                     | 改默认 Next 14 和旧 12/13／React 17 fixture；移除只测旧版本的限制。用户确认退役的五组可选集成同步删除专属测试；保留 auth、数据源和表单覆盖。HTML fixture 无 React 声明也消费 hydration              | I12、Q21/Q23     |
| S09 | plasmicpkgs-dev、vendor/react-ui；历史 examples 按用户确认退役 | 验证当前 vendor UI 的生产分发和组件合同；移除全部旧示例、依赖锁、lint 入口与支持文档。Admin Templates 维护资料保留在 ai/plasmic/admin-templates，SDK／CPA 输出继续维护 | I12、Q21/Q24 |
| S10     | CI／Docker／发布脚本／release-plan、包发布闭包、Desktop 资源、WAB 邮件 SSR                                                                                                                                               | CI 真正触发全部相关路径；锁文件与产物缓存失效正确；邮件可实际生成。Node engines 与部署镜像满足所选 Next／原生构建要求，发布顺序包含独立 Preview／renderer 服务                                | P09–P10          |

这 10 个范围均为基础升级范围。功能不再维护时可以退役，但必须清理入口、依赖、模板、CI 和支持文档，并记录调用方处置；只跳过失败用例不能关闭范围项。

## 3. 框架与工具的联动升级

2026-11-05 已查询精确版本 registry 元数据：

| 对象                                              | 当前事实                                                                           | 方案处置                                                                                                                                                  |
| ------------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Next 14.2.35                                      | peer React／DOM 为 ^18.2.0，当前 platform/preview 使用它                           | 必须联动升级，不能只把 React override 成 19                                                                                                               |
| Next 16.3.1                                       | peer 覆盖 ^19.0.0，Node >=20.9.0；仓库部分 CPA 输出已经使用                        | 可作为统一候选；审查 Next 15/16 的异步 request APIs、路由参数、缓存、Link／Image／router／middleware、构建／lint 与 RSC 条件导出；不要只检查 package.json |
| Next 15.5.14                                      | peer 覆盖 ^19.0.0，允许 Node ^18.18／^19.8／>=20                                   | 仅在实际支持矩阵需要此路线时作为具名候选，不新增仅为兼容旧 React 的双框架实现；不同消费者可以有经验证的框架版本                                           |
| CRA fixture                                       | React 17 类型和运行时，入口仍 ReactDOM.render                                      | 维护则升级测试消费者与构建工具；若改为 Vite fixture，保留原行为覆盖并同步测试 runner，不能只删除旧测试                                                    |
| TypeScript／ESLint／Storybook／Babel／SWC／Rollup | 各安装根版本不同；类型检查采用 skipLibCheck: true；根／Studio Storybook 不同版本 | 只做 React 19／Compiler 所需升级和配置调整，保留构建入口；用真实 consumer 检查自有声明及 API 使用，第三方声明内部检查不列为升级验收项 |

不强求所有工具统一最新版本。框架版本、engines、CI 镜像、对应 types 和 adapter 的联动是本轮必须处理的依赖闭包。

框架自带的 vendored React／RSC 编译器运行时由目标框架管理，不通过全局 alias 或 override 强行改写其内部私有包；核对应用 React／DOM 配对、框架合同和条件导出的真实行为。Node 下限按执行者角色核对：例如 CPA 需要运行所选 create-next-app，不能只看 CPA 自身旧 engines；不因此统一抬高无关 SDK 的 Node 下限。

选择 Next 16 时同时处理默认 Turbopack 与现有 webpack 插件／loader 配置的关系、移除的 next lint、middleware/proxy 约定及浏览器下限；沿对应消费者选择一个明确构建路径，不能把 Studio 的 Rsbuild 配置套到 Next。上述变化按目标版本文档逐条核实，不要求为 React 升级额外启用 PPR 或 Compiler。

## 4. 组件生态的具名阻塞项

以下是读取当前已安装包的 React／DOM peer 范围后发现的缺口，不等于这些包已被实际证明运行崩溃。R09 必须分别选择支持 19 的精确候选或完成最小替换；最终版本与行为证据在 U2 记录。

| 依赖组           | 已安装版本／缺口                                                                                    | 关键验证                                                                                                  |
| ---------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| MobX 绑定        | mobx-react 7.6.0 未声明 19                                                                          | 按 [Zustand 迁移方案](zustand-migration.md) 完整替换；模型、缓存、class、延迟 commit 和 iframe 均须验收                                 |
| 拖拽／动画／引导 | react-beautiful-dnd 13.0.0、react-spring 9.5.5、react-joyride 2.9.3、framer-motion 7.10.3 未声明 19 | 虚拟列表／键盘／取消／Portal／动画卸载；不能只重命名包                                                    |
| GraphQL 编辑器   | graphiql 3.7.0、@graphiql/react 0.26.2、@graphiql/plugin-explorer 3.2.3 未声明 19                   | 查询编辑／Explorer／Provider／弹层和主题，按配套版本升级                                                  |
| 数据与富文本     | @pankod/refine-core 3.58.1、@tinymce/tinymce-react 4.3.2 未声明 19；Quill 已按用户确认退役               | 数据源交互、编辑输入／焦点／选区、受控值、卸载；Tiptap 2.1.x 固定家族、Slate、ProseMirror 同步审核        |
| 编辑器／检查器   | react-monaco-editor 0.55.0、react-inspector 5.1.1 未声明 19                                         | 编辑器创建／销毁、实例 ref、对象展开、异步加载，Monaco worker 不重复                                      |
| Hooks／尺寸      | react-use 15.3.8、react-virtualized-auto-sizer 1.0.2 未声明 19                                      | 实际调用 Hook 的清理／订阅／ref／尺寸；react-window 1.8.11 已有 19 peer，仍验真实虚拟列表与共享 Scrollbar |
| SSR prepass      | @plasmicapp/react-ssr-prepass 2.0.9 peer 未声明 19，实现有 19 分支                                  | dispatcher、Context、异步数据、并发请求隔离，不仅修改 peer                                                |

还必须检查未列为 peer 缺口的运行依赖：Valtio／proxy-compare／use-sync-external-store、react-is／元素展平工具、react-draggable、Helmet、prism-react-renderer、旧 react-icons、React Aria/Stately、Antd 传递 rc-*、Radix、图表／支付／AI SDK／邮件组件和 vendor UI。**没有 peer 冲突不是兼容证明。**

Valtio 位于 react-web 的实际业务状态链，与编辑器 MobX 是两套机制；其订阅、Proxy snapshot、派生状态、重置和服务端读取必须单独验收。当前 ^1.6.4 可解析到宽 peer 的版本，因此先取锁定实际版本及行为证据，不默认强制升 Valtio 2 或重写状态层。

平台直接依赖审计中 @plasmicpkgs/react-aria 的 package 解析未完成；它是待补查项，不可视为未使用。实施时从锁文件、实际构建解析或 package exports 定位完整依赖闭包。读取 node_modules 仅为定位现有安装元数据，不代表已重装或重建。

## 5. 不能遗漏的 React 19 行为检查

- 自定义 JSX shim、元素 $$typeof／Context provider/consumer／ref 识别与注册：以目标版本实际行为为准，支持 React 19 ref prop，同时不能假设任意函数都提供 DOM ref。
- 资源与 markup：title/meta/style/script 的提升、去重、precedence、CSP nonce、useId／aria 关联、表单 action/reset。对已有页面验证差异；新 Actions／Activity／ViewTransition 等能力不强制改造所有业务。
- 开发与诊断：dashboard-preview-probe/fidelity.tsx 仍有旧 render/unmount；根迁移必须覆盖工具、fixture、示例和模板，不只 platform/wab/src。
- 服务端：server-only／react-server 条件导出、Next adapter mock／内部导入路径、Node/edge、prepass dispatcher、错误边界／序列化和邮件输出，分别使用实际消费者验证。
- 构建与发布：生成后代码不含旧 root 或内嵌不匹配 runtime；所有受维护包进入构建／pack／consumer 测试，完整旧发布集合可回滚，不能只恢复 Desktop。

## 6. 审核结论与关闭条件

原方案不能直接宣称覆盖全仓，修订后以 S01–S10 和完整快照作为范围基线。审核完整性已通过不等于技术升级通过；所有实施项仍为未执行。

U0/U2 关闭前必须完成全量依赖闭包的处置表和精确版本选择。U4/U6 关闭前必须具备每个维护消费者／组件家族的实际构建、交互及发布证据。只通过 Studio 冒烟、根 pnpm test 或元数据扫描均不足以关闭整个方案。

依据：[React 升级指南](https://react.dev/blog/2024/04/25/react-19-upgrade-guide)、[Next 15 升级指南](https://nextjs.org/docs/app/guides/upgrading/version-15)、[Next 16 升级指南](https://nextjs.org/docs/app/guides/upgrading/version-16)、[Gatsby 官方 package 元数据](https://github.com/gatsbyjs/gatsby/blob/master/packages/gatsby/package.json)。精确版本的 peer／engines 另由本次 npm view 读取；执行前复核，不把元数据接受当作运行通过。
