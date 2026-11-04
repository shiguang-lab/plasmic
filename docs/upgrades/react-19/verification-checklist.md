# React 19 检查与验收清单

状态：未执行。对应 [主方案](README.md)与[执行清单](execution-checklist.md)。

必需检查为 I01–I08、Q01–Q18、P01–P08；Compiler 启用时增加 M01–M10。可选阶段未开展记为“未开展”，不是“通过”。

## 1. 检查与证据约定

- 每项填写源码／制品身份、平台、fixture 修订、命令、退出码或人工步骤、原始证据路径和结论；未执行不勾选。
- 错误与失败保留，标明既有／新增。跳过项说明范围与原因；必需项未覆盖时不能签收整个升级。
- 报告仅存脱敏统计、测试名和摘要；认证、模型正文、trace 中的业务数据存私有目录，不提交仓库。
- 所有命令从仓库根目录执行，除非明确指定 --dir。以下是已核实存在的入口，不表示本方案编写时执行通过。

## 2. 依赖、构建与静态检查

- [ ] **I01** 目标版本和类型身份：每个安装根实际解析 React／DOM 同一目标补丁版本，跨 SDK／Studio 的类型没有重复身份；锁文件与 manifest 一致。
- [ ] **I02** 同 renderer 的 React、ReactDOM、JSX runtime、Context 与 Host 注册一致；无重复 React／无效 Hook／旧元素格式错误，跨 window 保持隔离。
- [ ] **I03** 控制范围内无已删除 React API 的可执行调用；旧分支、依赖、补丁和配置按最终支持合同清理。扫描中的文档／断言／第三方工具辅助函数需人工分类，不能要求文本零匹配后误删。
- [ ] **I04** 19 类型、root 生命周期、ref、act 与错误上报通过；不新增类型压制、吞错或弱化测试掩盖问题。
- [ ] **I05** SDK／codegen、canvas-packages、sub、react-web-bundle、live-frame、hydration、Studio／preview、Storybook 和 Desktop 资产构建通过。
- [ ] **I06** 对目标变更完成定向测试与发布前完整测试；快照差异有语义审核记录，不整体接受未知变化。
- [ ] **I07** 从本次源码生成的 SDK 与平台消费的 SDK 一致，所有静态制品及 hydration hash 校验通过；没有混用旧 build 目录的成功假象。
- [ ] **I08** 所有实际需要的独立安装根 frozen-lockfile 可复现，Desktop 使用 npm ci；没有强制绕过 peer 或静默依赖公开旧包。

### 2.1 只读预检

```sh
git status --short
git rev-parse HEAD
node --version
pnpm --version
npm --version
npm view react@19.3.1 version --json
npm view react-dom@19.3.1 version peerDependencies --json
npm view mobx-react@9.2.0 version peerDependencies --json
```

在每个实际安装根分别运行 `pnpm why react`、`pnpm why react-dom`，并核对消费者的 require.resolve。根 workspace override 不替代平台／sub 的解析验证。诊断输出可能很大，保留日志后摘要。

### 2.2 源码扫描

```sh
rg -n 'ReactDOM\.(render|hydrate|unmountComponentAtNode|findDOMNode)|react-dom/test-utils' platform packages plasmicpkgs --glob '*.{ts,tsx,js}' --glob '!**/node_modules/**'
rg -n '__SECRET_INTERNALS|__CLIENT_INTERNALS|__SERVER_INTERNALS|__reactFiber|__REACT_DEVTOOLS_GLOBAL_HOOK__' platform/wab/src packages --glob '*.{ts,tsx,js}'
rg -n '\bJSX\.|useRef(<[^;]+>)?\(\)|\.defaultProps\s*=|contextTypes|getChildContext' platform packages plasmicpkgs --glob '*.{ts,tsx,js}' --glob '!**/node_modules/**'
rg -n 'react/compiler-runtime|react-compiler-runtime|use memo|use no memo|compilationMode' platform/wab packages platform/canvas-packages build.mjs --glob '*.{ts,tsx,js,mjs,json}'
```

rg 无匹配退出 1 是正常检索结果；扫描无法覆盖解构别名／动态访问或所有生成模板，必须结合类型检查、构建与运行。私有 React 内部接口不是要求清零，而是要求逐处验证目标版本。

### 2.3 定向测试与类型检查

```sh
pnpm --dir platform/wab test --project studio src/wab/client/react-global-hook/preamble.test.ts src/wab/client/react-global-hook/frame-lifecycle.test.ts src/wab/client/components/canvas/canvas-lifecycle.test.ts src/wab/client/components/canvas/canvas-recovery.test.tsx src/wab/client/studio-ctx/selection-change.test.ts src/wab/client/components/sidebar-tabs/ComponentProps/CustomPropEditor.test.tsx src/wab/client/components/live/preview-sync.test.tsx
pnpm --dir platform/wab typecheck --incremental false
pnpm --filter @plasmicapp/host test
pnpm --filter @plasmicapp/react-web test
pnpm --filter @plasmicapp/loader-react test
pnpm --filter @plasmicapp/query test
pnpm --dir platform/canvas-packages test
pnpm --dir platform/canvas-packages test:preview-runtime
pnpm --dir plasmicpkgs/antd6 test:interactions
```

新增 root／ref／Compiler 测试由对应实施项决定，不虚构已存在的测试文件。host 的 test 同时运行类型测试；query 的入口包含 passWithNoTests，必须记录实际测试数量，零测试不能证明该包行为通过。

发布前执行相关完整套件：`pnpm --dir platform/wab test`、根 `pnpm test`、`npm test --prefix desktop`。ESLint 使用根 `pnpm exec eslint` 后附实际变更文件列表；现有根 lint 脚本带 --fix，不用于只读检查。依赖升级应记录全部受影响包，不只运行直接编辑文件的测试。

### 2.4 安装与构建顺序

版本修改后的第一次安装允许正常更新对应锁文件；完成后再使用 frozen-lockfile 验证。仅在实施工作区执行，命令会更新 node_modules／产物。

```sh
pnpm install
pnpm --dir platform install
pnpm --dir platform/sub install
pnpm --dir platform/react-web-bundle install
pnpm --dir platform/live-frame install
pnpm --filter @plasmicapp/loader-react... build
pnpm --filter @plasmicapp/react-web... build
pnpm --filter @shiguang-lab/plasmic-antd6... build
pnpm --filter @shiguang-lab/plasmic-antd-icons build
pnpm --filter @shiguang-lab/plasmic-react-ui build
pnpm --dir platform install
pnpm setup:loader-html-hydrate
pnpm --dir platform/sub build
pnpm --dir platform/react-web-bundle build
pnpm --dir platform/live-frame build
pnpm --dir platform --filter canvas-packages build
pnpm --dir platform --filter 'loader-bundle-env...' build
pnpm make
pnpm --dir platform/wab build-css
pnpm --dir platform/wab build
pnpm --dir platform/wab storybook:build
```

顺序依据现有根 setup 与 hydration 构建入口；重新安装 platform 用于更新 file／workspace 注入包，pnpm make 生成解析器、模型和静态样式输入，不得因本地遗留产物省略。不要使用 setup-all／bootstrap:platform 代替构建，它们包含数据库迁移或 reset；本方案不需要数据库结构变更。

随后对根、platform、sub、react-web-bundle、live-frame 分别执行 `pnpm install --frozen-lockfile`（相应 --dir），再重建。Playwright／loader-tests 的独立安装按其锁文件执行。Desktop 使用以下本地构建来源，避免资产脚本默认拉取 Docker 镜像而混入其它版本：

```sh
npm ci --prefix desktop
npm run build:mcp --prefix desktop
npm run assets --prefix desktop -- --from "$PWD/platform/wab/build"
```

资产命令会替换实施工作区中的 desktop/renderer，须先归档对照制品；不指向用户安装目录。打包使用现有平台脚本并记录目标，未打包不宣称安装版通过。

### 2.5 集成入口

```sh
pnpm --dir platform/wab test:published-hydration
pnpm --dir platform/wab test:preview-probe
pnpm --dir platform/wab/playwright test-playwright --project chromium e2e/virtual-slots.spec.ts e2e/components.spec.ts e2e/state-management-dependent.spec.ts e2e/hostless-antd.spec.ts
```

Playwright 需要隔离 WAB／数据库／账户 fixture 及 `WAB_HOST`，当前配置不自动启动完整后端；测试会创建／编辑项目，不能指向生产。loader-tests 另需按所选 fixture 准备包注册表／框架测试站点；只运行本轮支持矩阵要求的消费者，并明确旧框架消费者的排除理由。

Desktop 按受影响范围执行现有 `test:preview-navigation`、`test:preview-errors`、`test:session-lifecycle`、`test:runtime-security`、`test:library-cache`、`test:resource-cache-web`、`test:mcp-lifecycle` 及真实发布平台的原生回归，命令格式为 `npm run <现有脚本名> --prefix desktop`。会使用本机账户／线上服务的入口先配置隔离环境，不在普通用户 profile 运行。

## 3. 功能检查

- [ ] **Q01** Dashboard→Studio、未登录／已登录路由、lazy fallback、失败重试、退出重入和多语言入口正常；fallback 更早出现不误标“加载完成”。
- [ ] **Q02** 右键菜单、临时弹窗、Docs、自定义属性／动作编辑器反复开关；定位、焦点、提交／取消、销毁及 Promise 结束正确，无重复 root。
- [ ] **Q03** DOM ref 相关椭圆、颜色渐变、关键帧控制实际定位与拖拽正确；卸载后不再访问旧 DOM。
- [ ] **Q04** 单选、多选、快速切换／清空、重复实例 clone key、组件编辑上下文和 DOM→Val 映射正确；旧面板回调不能写新目标。
- [ ] **Q05** Slot 内容、嵌套组件、条件显示、重复列表、Portal、Suspense 及隐藏恢复后选择身份与 props 正确。
- [ ] **Q06** 属性表单、受控／非受控值、注册默认值、事件参数和回调顺序一致；显式用户修改进入正常保存／撤销链。
- [ ] **Q07** 变体切换、交互状态、初始值与编辑临时显示分离；选择／导航不重写运行时初始 props。
- [ ] **Q08** 单／多对象拖拽、跨画板落点、键盘重排、自动滚动、Escape、鼠标移出与取消；撤销重做后模型和位置一致。
- [ ] **Q09** 修改→撤销→重做→隔离保存→完整重开；模型摘要、节点 UUID、props／slots／事件／路由一致，无需求外格式变化。
- [ ] **Q10** 引用矩阵中的所有旧／新组件库，以及表格、表单、Modal、Dropdown、消息、动画、引导、富文本、日期和虚拟列表完成交互，不只验证静态显示。
- [ ] **Q11** 当前／后台／缓存／冷画板、镜像／截图、MCP 显式同步和恢复正常；不可通过冻结业务状态或减少画板来取得性能收益。
- [ ] **Q12** Preview／Docs 首次打开、重复打开、实时同步、页面导航、数据／Context、错误恢复和卸载正常。
- [ ] **Q13** 自定义 Host 使用目标 React／SDK 合同；不同 window 的 Context、注册表、业务状态不串用；不支持的旧 Host 有明确升级要求。
- [ ] **Q14** SDK ESM／CJS／react-server、codegen 模板及生成代码、导出 CSS／事件可实际执行；公开 peer 与包体事实一致。
- [ ] **Q15** SSR prepass、数据缓存、请求隔离、useId、真实 hydration、表单输入、发布导航与事件正常，无新增 mismatch／全量客户端重渲染；相关测试未依靠 suppressHydrationWarning 隐藏错误。
- [ ] **Q16** render／异步／组件包执行错误正确进入已有反馈和上报；Boundary 恢复、重复告警去重和 uncaught／recoverable 分类正确。
- [ ] **Q17** Desktop 启动、会话、StudioWindow 关闭释放、Preview、缩略图、镜像／截图与 MCP；安装版使用本次资源而非旧 dev-build。
- [ ] **Q18** 语言／主题切换、键盘／焦点和共享 Scrollbar 正常；高度有界、flex sizing 正确、滚动由共享组件拥有，无嵌套原生滚动容器。

## 4. MobX／Compiler 正确性检查

M01–M04、M07–M09 也用于基础升级的自定义 Reaction 回归；只有 Compiler 实验可不开展 M05／M06／M10。

- [ ] **M01** 保持同一个 StudioCtx／ViewCtx／模型／observable 数组引用，连续改变内部字段，属性值和画布正确更新；通过更新祖先 props 触发额外刷新不能掩盖漏订阅。
- [ ] **M02** 动态条件从读取 A 切到 B 后，B 能触发更新；不再相关的 A 不造成无效更新。分别验证新增／删除数组项和嵌套字段。
- [ ] **M03** InspectorSelection 暂停／恢复和 canvasDomVersion 失效正确；缓存旧选择不保留编辑权限，连续选择最终只提交最新目标。
- [ ] **M04** 修改→撤销重做→切画板→恢复后数据与显示一致；无需手工刷新页面才能同步。
- [ ] **M05** 编译叶子接收普通不可变输入；无 observable／Proxy、类实例、动态 getter 或可变数组穿透，且变化能反映到叶子输入。
- [ ] **M06** 白名单、嵌套函数、包装器和自定义 Hook 的编译产物与设计一致；已排除的 MobX 组件未因命名推断／导入路径再次参与编译。
- [ ] **M07** StrictMode、Suspense、render throw／放弃、commit 延后和卸载后 Reaction 不丢更新、不重复订阅；超时清理后的恢复能重建跟踪。
- [ ] **M08** ViewCtx.dispose 后定时器、Reaction、待刷新队列及旧 Fiber 关联释放；另一个活跃画板与后台显式同步不受影响。
- [ ] **M09** 主题／语言、Context、异步数据、组件包注册变更及全局失效源正确传播；不得只测局部 useState。
- [ ] **M10** 测试确实经过生产等价 Compiler 转换，并有真实生产制品交互；比较 render／计算次数与实际耗时，缓存命中不能以错误旧值取得。

## 5. 性能检查

主方案第 7 节规定门槛与采样方法，以下为执行证据要求。

- [ ] A0/A1/B/C 实际差异、artifact hash、编译模式、fixture／依赖版本、Electron／DPR 和运行顺序完整。
- [ ] 启动与暖开、首画布与全部画板、首次功能与持续更新、hydrate 完成与可交互分开测量。
- [ ] 中位数／p95、全部样本、失败／离群、环境干扰保留；没有把一段内部计时或 CPU inclusive 样本当成端到端节省。
- [ ] 正常计时、CPU 归因与 GC 生命周期分轮执行，20 轮后无新增持续保留链；RSS／GPU／原生峰值独立报告。
- [ ] Compiler 满足目标更新收益，且首用／包体／构建／内存成本已披露；未达门槛不扩大白名单。
- [ ] 已有动画／属性优化的历史收益未重复计入本轮；基础升级只无退化时报告事实。

## 6. 发布检查

- [ ] **P01** I／Q 必需项及基础 Reaction 检查通过；Compiler 若发布则 M01–M10 通过；平台未覆盖范围明确。
- [ ] **P02** SDK 最低 React、包版本策略、外部 Host 与消费者顺序具名；组件注册合同和保存模型不出现隐式迁移。
- [ ] **P03** frozen 安装和干净重建通过，SDK／Canvas／Host／hydration／Studio／Desktop manifest 与实际字节一致。
- [ ] **P04** 性能和内存门槛通过，原始样本可追溯，宣传措辞与测量范围一致。
- [ ] **P05** 无遗留旧挂载实现、未使用依赖、临时诊断代码或未验收性能开关；必要 flag 使用既有机制。
- [ ] **P06** 完整旧制品、锁文件、SDK 版本和 manifest 可用，隔离回滚后打开、编辑、保存重开、Preview、hydration 复验通过。
- [ ] **P07** 变更说明包含实际测试、风险和未覆盖范围；本轮纯文档创建没有被写成升级完成。
- [ ] **P08** 实际发布符合当前授权与仓库流程，发布后观察和异常恢复结果有记录；未发布保持此项空勾选。

## 7. 验收记录模板

每个实施阶段在本目录新增独立的日期／阶段报告，文件名使用 kebab-case；下表是模板，不是现有报告。证据路径必须可访问或明确标为私有，不能填虚构日志名。

| 字段                                            | 结果   |
| ----------------------------------------------- | ------ |
| 阶段／执行人／日期                              | 待填写 |
| commit／工作区摘要／source hash／artifact hash  | 待填写 |
| React／DOM／types／MobX 绑定／Compiler 精确版本 | 待填写 |
| fixture／依赖身份／平台／构建组                 | 待填写 |
| 命令、退出码、实际测试数、日志路径              | 待填写 |
| I／Q／M／P 各项通过、失败、跳过与原因           | 待填写 |
| 性能样本／中位数／p95／波动／门槛比较           | 待填写 |
| 内存／保留链／资源体积／首用成本                | 待填写 |
| 未覆盖事项／阻塞／下一步                        | 待填写 |
| 结论：未执行／失败／无退化通过／目标优化通过    | 待填写 |

没有日志、制品或可复现步骤的项目保持未验证。报告新增后互相链接，并更新执行清单对应任务，不改写原始失败证据。
