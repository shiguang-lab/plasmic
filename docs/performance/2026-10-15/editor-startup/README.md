# 编辑器启动优化与前后实测（2026-10-15）

代码已落地，正式 A/B 共 40 次打开全部成功。主要收益来自切断加载界面的重依赖、合并启动元信息、提前请求模型，以及取消隐藏 Host 引导图片的下载。画布运行时的同步执行和首次 React 渲染仍然形成长任务，本轮没有消除这一瓶颈。

## 结果

下表为从开始导航/创建编辑窗口到目标画板**可编辑**的时间。每个客户端、每个版本各 5 轮，每轮包含新配置目录首次打开和同目录再次打开。顺序交替为 AB、BA、AB、BA、AB。单位为秒。

| 场景 | 优化前 P50 | 优化后 P50 | 改善 | 优化前 P95 | 优化后 P95 |
|---|---:|---:|---:|---:|---:|
| 桌面首次打开 | 5.014 | 3.675 | 26.7% | 6.078 | 3.992 |
| 桌面再次打开 | 3.541 | 3.258 | 8.0% | 4.335 | 3.661 |
| 浏览器首次打开 | 17.027 | 12.747 | 25.1% | 17.791 | 14.011 |
| 浏览器再次打开 | 4.065 | 3.469 | 14.7% | 4.266 | 4.239 |

P95 使用 nearest-rank；每格只有 5 个样本，因此这里的 P95 等于最大值，仅用于观察，不能作为线上尾延迟承诺。浏览器再次打开的尾延迟基本未变。另一批桌面默认系统语言实验中，首次打开 P50 为 4.122→3.532 秒，再次打开为 3.245→2.936 秒；环境与语言条件影响收益幅度，不能把 26.7% 视为固定收益。该批次保存在 `desktop-system-locale-supplement.json`，未混入主表。

| 指标 | 优化前 | 优化后 |
|---|---:|---:|
| HTML 直接引用 JS 数量 | 45 | 16 |
| 这些 JS 的原始体积 | 14,134,959 B | 4,551,422 B（减少 67.8%） |
| 同一批 JS 的 gzip level 5 体积 | 3,976,929 B | 1,284,201 B |
| 浏览器首次打开受控响应体 P50 | 9.548 MB | 7.230 MB |
| 隐藏 Host 引导图片 | 1,417,243 B | 0 B |
| 桌面首次可见前启动的 API 请求 P50 | 27 | 20 |
| 浏览器首次可见前启动的 API 请求 P50 | 36 | 27 |
| 浏览器重开可见前启动的 API 请求 P50 | 29 | 24 |

“入口 JS”是 HTML 直接引用的脚本，并非编辑器最终使用的全部脚本；首包缩小不能直接解释为同等比例的启动加速。响应体统计只覆盖受控 Studio/canvas/API 域名，不含第三方 CDN；按请求发起时间截取，并统计其完整响应体，部分响应可能在首屏之后完成。已有 gzip 和 immutable 缓存策略在两边一致，不计为本轮新增优化。

[完整汇总和逐次数据](analysis.json)、[20 次独立运行报告](samples/)、[入口源码映射证据](entry-evidence.json)。数据包含 revision、目标画板、恢复后的视口、网络请求、阶段耗时和长任务。没有保存 Cookie 或认证请求头。

## 已实现的改动

1. `StudioContexts.tsx` 承载轻量上下文与 hook；`StudioCtx` / `ViewCtx` 使用类型导入。所有调用点改用同一上下文定义。加载界面使用独立顶栏/加载组件，路由占位、定价表单等按需加载。入口源码映射已不包含 `StudioCtx`；`PricingModal` 仅保留轻量判断与异步入口，Stripe/BillingForm 在计费操作时加载。
2. UI JSON 语言包按选择加载，首次渲染等待当前包；下载去重、已加载缓存和快速切换时的最新选择保护覆盖顶层与 Host。业务内容和组件注册契约不随 UI 语言改写。
3. Antd5 表单名称、枚举和推导元信息独立为 `@plasmicpkgs/antd5/form-meta`，调用方不再通过组件注册总入口获取常量；包构建和类型出口同步更新。
4. 新增 `GET /api/v1/editor-bootstrap/:projectId`，并行调用现有用户、配置、组织、项目权限、可信 Host 与分支读取。模型保持独立请求，响应 `no-store`。桌面复用同一次访问检查，限定可信主 frame、同一项目、30 秒内且只能消费一次。
5. Root 获得项目/分支后提前获取模型，与编辑器 chunk 和 Host 启动重叠；桥接按项目、分支和最新版本语义消费一次。刷新、其他修订、其他项目和重试仍走新请求。未取消 Host 信任检查。
6. 普通评论、发布信息、依赖更新/Host 提示和 AI 能力探测等延至目标画板与视口就绪。评论深链接提前加载，评论请求按分支去重。AI 会话恢复、当前编辑状态和锁保持启动连接。完整 AppCtx 团队/工作区集合保留现有导航、成员和计费契约。
7. 项目接口在授权通过后并行执行独立修订、权限、依赖、版本、所有者和应用鉴权读取；补充 `Server-Timing`。浏览器增加入口、Shell、bootstrap 和画布阶段 performance marks。
8. Host 引导说明图仅在独立引导页分配 `src`；编辑器、画布与预览文档不再下载隐藏图片。独立引导页仍正常显示图片。

当前启动契约见 [studio-loading.md](../../../../platform/wab/src/wab/client/studio-ctx/studio-loading.md)。

## 测量条件与边界

- Apple M4，24 GiB；Electron 44.5.1；Playwright Chromium 148.0.7778.96。窗口/浏览器视口为 1512×887 CSS px，DPR 2。
- 固定项目 `iqBeCQWLFWvGwftodkcHbN`，主分支 revision **18**，4 个画板；所有运行断言修订一致。每个客户端内的 arena、缩放、滚动位置一致。桌面检查保存视口恢复；浏览器检查同一默认视口。
- 主表固定英语。桌面通过测试进程的系统语言输入与加载后 `document.lang` 断言固定语言；浏览器在 document-start 设置相同语言。各场景的前后版本使用相同设置。补充批次使用桌面默认系统语言，单独报告。
- 真实 NAS PostgreSQL、真实 IAM、现有镜像依赖。修改前后服务器源码、生产前端构建分别放在独立测试容器，走各自网关与 Nginx gzip 代理。未部署或重启生产服务。
- 本机 HTTPS CONNECT 代理保留真实 Studio/canvas Origin、Cookie 和 iframe 行为，将两个受测域名导向所选测试网关。正式运行均断言请求进入指定网关，优化后断言实际调用 bootstrap。浏览器只豁免本次测试证书的 SPKI，保留正常缓存行为；不关闭缓存。
- **测试经过 NAS tailnet 链路，未经过公开 Seoul Caddy 边缘入口。表中绝对秒数不代表线上公网耗时。** 对照两边使用同一链路。历史的约 3 秒连接超时不在本次实验的验证范围，不能据此宣称已解决。
- 开始计时前浏览器/Electron 进程已就绪、测试会话已注入。桌面计时包含保存项目访问检查与创建编辑窗口，浏览器计时从导航开始；不含进程启动或交互登录。新配置目录首次打开不等于清空操作系统/NAS 缓存。
- 可见时间要求目标画板与顶层加载遮罩均已完成；可编辑时间还要求目标 ViewCtx 同步完成。探针等到其他 frame context 创建后收集数据，但使用最早就绪时间，不把额外等待计入目标耗时。
- 暂停自动保存并阻断项目写请求，所有正式运行和功能验证均未尝试保存设计。复用隔离登录会话，不修改当前编辑项目。

## 功能与代码验证

[功能验证结果](functional-checks.json)：桌面与浏览器均完成选择元素、修改真实注册的 `productName` 属性、检查画布渲染、撤销后逐字节比较模型、验证撤销渲染、打开实际 Preview 并检查业务内容、返回编辑器确认模型不变。另验证桌面冷打开后直接 Preview。Preview 探针按路由识别 iframe，避免受本地化标题影响。

- `pnpm typecheck`：通过。
- WAB 相关回归：58 个文件，348 项通过；另 1 项失败为原有的“缺省外观应为 system”断言，而实现默认 dark。在修改前源码快照上单独运行，同样 12 项通过、该 1 项失败。未修改该测试或产品默认值。
- 画布队列、视口恢复、初始化与加载遮罩：4 个文件，14 项通过。
- Desktop：208 项通过，包含离线/登录失效、项目删除、一次性启动数据、过期与项目隔离检查。
- Antd5 `pnpm build`：通过（Rollup 与声明文件生成）。
- WAB/Desktop 变更文件 ESLint：0 error。Antd5 包仍有修改前已存在的 4 个 `no-shadow` 报错：2 个 TS enum 核心规则误报、2 个 `values` 遮蔽；枚举拆出后前两个报错随定义移动，没有新增报错。保留了前后 lint 诊断。
- 生产前端构建通过。桌面打包使用同一份已缓存字体：Google Fonts 重试下载发生 TLS 失败，复用了两边完全相同的字体文件与 CSS，仍由正式 assets 脚本完成来源和产物哈希校验。该处理仅用于构建/测量，不修改产品下载逻辑。

## 剩余 CPU 成本

[CPU profile 汇总](cpu-analysis.json) 来自单独的冷打开采样，未并入延迟表。Source map 定位到 `dom-utils.ts` 的 `scriptExec`、内置 Host 的 Antd6 client、MobX/Comlink 和 Canvas React 求值。单次 renderer 活跃采样约 3717→3596 ms；`scriptExec` 自身约 360→353 ms，内置 Host client 约 417→435 ms。这些是整段采样的 self time，不是可相加的启动阶段耗时，也不是稳定收益估计。

正式样本中，Host 最大长任务中位数：桌面冷打开 408→385 ms，浏览器冷打开 **507→573 ms**，浏览器再次打开 460→483 ms。首包和网络优化没有消除同步运行时/组件执行的停顿，浏览器长任务还有退化，不能声称首次渲染 CPU 已优化。拆分注册或更改同步求值会涉及 Canvas 运行时契约；本轮保留其语义，没有引入 Worker、按组件名称的特殊分支或第二套注册实现。

## 复测

可复用的 [探针与分析脚本](scripts/) 不创建/发布生产资源。预先提供两套隔离的 HTTP 网关、对应前后构建与源码运行时、独立测试账号会话，以及本报告的项目修订。设置：

```sh
export PROBE_REPO=/absolute/path/to/plasmic
export PROBE_OUTPUT_ROOT=/absolute/path/to/new-empty-benchmark-directory
export PROBE_UPSTREAM_HOST=your-isolated-test-nas-address
```

在输出目录放置 `before/build`、`before/desktop`、`after/build`、`after/native-build`、`after/desktop`，以及本目录的 `workspace-seed.json`。Desktop 运行目录需要配置、assets 和其 node_modules；所有构建需要 `studio-build.json`，原生构建还需要正式 assets 元信息。Cookie 用 Electron cookies 格式写入 `seed-cookies.json`，权限设为 0600，禁止入库。准备仅用于该测试的 TLS 证书：

```sh
openssl req -x509 -newkey rsa:2048 -nodes -days 1 \
  -keyout "$PROBE_OUTPUT_ROOT/proxy-key.pem" \
  -out "$PROBE_OUTPUT_ROOT/proxy-cert.pem" \
  -subj /CN=studio.plasmic.shiguanglab.com
node docs/performance/2026-10-15/editor-startup/scripts/run-series.cjs
node docs/performance/2026-10-15/editor-startup/scripts/analyze.cjs
```

脚本当前使用隔离网关端口 before=4400、after=4401，本地测试代理使用 3443/3444。使用新目录运行以保证 cold profile 没有旧缓存；每次运行结束会删除配置目录。功能验证可单独设置 `PROBE_EDIT=1`，CPU trace 设置 `PROBE_TRACE=1`；这些诊断不计入正式 A/B。

本次冻结的完整构建/源码保留在本机 `/tmp/plasmic-load-20261015/{before,after}`。基线从修改前工作区快照构建，并非仅用 Git HEAD 重建；其 manifest 的时间字段是快照标注，完整来源见 [provenance.json](provenance.json)。长期复测应另存这些冻结产物。认证材料、配置目录和临时测试容器在测试后清理，正式测量 JSON 与必要截图保存在本目录。
