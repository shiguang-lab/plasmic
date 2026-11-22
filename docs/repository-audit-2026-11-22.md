# Plasmic 代码问题与优化清单

2026-11-22 · `master` `ae1dc31dc` 及工作区未提交改动。复现记录见[桌面与 Studio 专项](code-review-2026-11-22.md)，覆盖范围与失败用例原始记录见[覆盖清单](repository-audit-2026-11-22-coverage.md)。

优先级：**P1** 立即修复；**合入前** 阻塞对应未提交改动的提交；**P2** 排期修复；**P3** 低优先级。优先级已综合影响面、是否进入交付产物及线上数据考虑。

## 一、功能问题

### P1

| 编号 | 问题 | 修复与验收 |
| --- | --- | --- |
| P1-1 · 桌面导出丢失组件库模型 | 项目接口把依赖模型替换成 `modelResourceId`，菜单直接序列化 `info.model`，依赖条目写成 `["pkg", null]`，文件导入时缺少依赖模型。[桌面导出](../desktop/src/workspace.cjs#L554) · [导入读取点](../platform/wab/src/wab/server/db/imported-hostless-deps.ts#L16) | 写文件前按现有模型读取契约解析每个资源 ID，全部成功后再落盘。用带组件库的项目做导出→导入往返，组件实例和属性完整；依赖读取失败时导出报错且不覆盖目标文件。 |
| P1-2 · 工作分支导出成主分支 | 菜单用裸 `projectId` 请求 `/api/v1/projects/:id`，服务端因此返回主分支修订。[导出请求](../desktop/src/workspace.cjs#L529) · [修订选择](../platform/wab/src/wab/server/routes/projects.ts#L1702) | 按 `projectId@branchId` 契约传入点击时的分支。两条分支页面内容不同，分别导出并断言文件内容。可与 P1-1 一起修。 |
| P1-3 · 用户信息服务临时出错即清除登录态 | `auth-api` 把所有 ≥400 响应都当作 Invalid token，`auth-react` 收到错误就删除已保存的 token。上游一次 503 就会让生成站点的所有终端用户掉登录。该包经 `loader-bundle-env`、`react-web` 进入交付产物。[SDK](../packages/auth-api/src/api.ts#L38) · [清理](../packages/auth-react/src/hooks.ts#L115) | 返回可区分的错误类型，仅在明确凭据失效（401/403）时清理。分别验证失效、429、503 三种情况：后两种保留会话并可重试恢复。 |
| P1-4 · 发布回滚失败仍停止候选服务 | `finally` 中先恢复旧网关配置再停服务；恢复失败抛错时仍执行 `compose stop`，可能停掉正在承载流量的槽。需要健康检查与恢复连续失败，属于低概率高影响。[rollout.py](../deploy/rollout.py#L102-L113) · [现有用例](../deploy/test_rollout.py#L63) | 确认流量已回到旧槽后才停止候选服务；恢复失败时保留两槽并报告回滚错误。新增双故障用例断言没有 stop，保留正常回滚只停候选槽的断言。 |

### 合入前

| 编号 | 问题 | 修复与验收 |
| --- | --- | --- |
| M-1 · 丢失的封面不再重建 | 未提交改动新增卸载卡片后的 `recent` 封面缓存。恢复缓存后 `displayed=5`，服务端报告修订 0 时 `published` 仍为 0，不会发起触发重建的 GET，卡片一直显示旧图。`master` 无此问题。[封面订阅](../platform/wab/src/wab/client/components/dashboard/preview/cover-subscriptions.ts#L196) | 可见卡片收到修订 0 且已有缓存时，保留旧图并发一次 GET；收到 202 后等待发布事件。覆盖"缓存 5 → 服务端 0 → GET 202 → 发布 5"：只发一次请求并结束恢复状态。 |

### P2

| 编号 | 问题 | 修复与验收 |
| --- | --- | --- |
| P2-1 · 组件动作参数重排后漏清理 | `checkCodeComponentRefActions` 按位置解构 `[firstArg, secondArg]`，参数顺序为 `[action, tplRef]` 时跳过清理，留下失效交互。[位置解构](../platform/wab/src/wab/shared/code-components/code-components.ts#L1430) | 按 `NameArg.name` 查找 `tplRef` 与 `action`。同一交互两种参数排列的清理结果相同。 |
| P2-2 · 清空组件动作后仍保留目标 | 写回时以 `if (meta?.refActions)` 判断，`refActions: {}` 为真值，交互保留了无可选动作的 `tplRef`。[判断](../platform/wab/src/wab/shared/code-components/code-components.ts#L1473) | 按剩余动作数量判断。缺省与 `{}` 都清空参数；仍有其他动作时保留元素。 |
| P2-3 · Query 重复退订移除其他监听者 | 清理函数执行 `splice(indexOf(listener), 1)`，第二次调用时索引为 -1，删掉末尾的其他监听者。WAB 与 `loader-bundle-env` 均使用。[监听 API](../packages/query/src/query-data.tsx#L260) | 清理函数幂等，保留同一回调注册两次的语义。订阅 A、B 后两次退订 A，B 仍收到 true/false。 |
| P2-4 · 资源授权抽屉在交互画布忽略关闭状态 | 未注入 `getState` 时，回退分支把"组件被选中"当成打开，`open=false` 仍显示 dialog。已有 2 条失败测试。[回退分支](../plasmicpkgs/antd6/src/canvas-overlay.ts#L46) · [授权组件](../plasmicpkgs/react-ui/src/registerResourceAuthorization.tsx#L34) · [失败断言](../plasmicpkgs/react-ui/tests/resource-authorization.test.tsx#L258) | 修正该分支的受控语义：关闭时不挂载抽屉，显式打开后再加载。同时跑通"切换模式保留已揭示 Tooltip"的现有用例。[Tooltip 契约](../plasmicpkgs/antd6/tests/canvas-overlay.test.tsx#L47) |
| P2-5 · 最近项目误删新入口 | 刷新开始时复制旧条目，返回后按项目 ID 删除；期间记录的同 ID 已发布模板被一并移除。[最近项目](../desktop/src/workspace.cjs#L226) | 清理时核对查询开始时的具体条目。重启后新模板仍在。 |
| P2-6 · CMS 多语言 OBJECT 字段写入后默认值多一层 | `normalizeCmsData` 处理默认语言时，语言映射本身满足 OBJECT 类型校验，整个映射被写成默认值。只影响多语言 OBJECT 字段；线上目前没有这种字段，也没有受损数据（2026-11-22 只读查询 NAS 库），属于预防性修复，任何表启用该字段前必须修好。[默认值判断](../platform/wab/src/wab/server/util/cms-util.ts#L494) · [写入入口](../platform/wab/src/wab/server/routes/cms.ts#L251) | 依据字段 `localized` 区分语言映射与普通对象。创建、更新后读回，覆盖多语言对象、普通对象、部分语言更新和显式清空。 |
| P2-7 · CMS `includeArchived=false` 仍返回归档表 | 路由只做 `as boolean`，字符串 `"false"` 为真值，跳过归档过滤。[路由](../platform/wab/src/wab/server/routes/cmse.ts#L58) · [过滤](../platform/wab/src/wab/server/db/DbMgr.ts#L6945) | 在路由边界解析布尔值。省略、false、true 三种请求中只有 true 返回归档表。 |
| P2-8 · Supabase 签名失败被当作空结果 | `getSignedFileUrl` 不检查 `res.error`，直接返回 `null`，错误信息和状态丢失。[签名](../platform/wab/src/wab/server/data-sources/supabase-fetcher.ts#L41-L53) | 与上传一致抛出 `DataSourceError`。成功返回签名数据，失败进入调用方错误分支并保留状态码。 |

### P3

以下除 P3-1 外都不在交付路径上（未被部署镜像、`canvas-packages` 或 `loader-bundle-env` 引用，本仓也不向 npm 发布这些 `@plasmicapp/*` 包）。若之后纳入交付，需要重新定级。

| 编号 | 问题 | 修复与验收 |
| --- | --- | --- |
| P3-1 · 模板操作失败直接展示底层错误 | 模板中心与顶栏发布捕获 Error 后直接显示 `message`，绕过本地化文案；仓库自己的文案检查已失败。[模板中心](../platform/wab/src/wab/client/components/dashboard/TemplateCenter.tsx#L112) · [发布按钮](../platform/wab/src/wab/client/components/top-bar/PublishButton.tsx#L191) | 已知业务错误走现有展示逻辑，未知错误显示"模板操作失败"，细节写日志。[文案检查](../platform/wab/src/wab/client/i18n/audit-business-errors.test.ts#L46) 通过。 |
| P3-2 · CLI 缓冲写入后重命名丢更新 | 先写再改名时，缓冲内容移动后仍排入磁盘 rename：源文件已存在则目标仍是旧内容；源文件不存在则报 ENOENT。[缓冲重命名](../packages/cli/src/utils/file-utils.ts#L518) | 区分源路径在磁盘上与仅在缓冲中两种情况。临时目录断言源消失、目标为新内容、执行成功。 |
| P3-3 · React Renderer 大模型无法启动子进程 | 整个 JSON 作为命令行参数传给子进程，超过系统 argv 上限报 `E2BIG`。[子进程](../platform/react-renderer/src/server.ts#L106) | 改用标准输入传 JSON，保留隔离和超时。 |
| P3-4 · Keen Slider 每张幻灯片渲染两次 | clone 一份后又渲染原 `children`，且 clone 用父级 className 覆盖子项类名。[渲染](../plasmicpkgs/keen-slider/src/index.tsx#L307) | 只渲染一次，合并 slide 类与子项类名。 |
| P3-5 · Watcher 同步订阅两次遗留连接 | `ensureWatch` 在给 `this.socket` 赋值前 `await`，同步两次订阅建立两条连接，退订后遗留一条。[连接赋值](../packages/watcher/src/watcher.ts#L72) | 同步创建并记录 socket。连续订阅只有一个连接，最后退订后无遗留。 |
| P3-6 · Edge 个性化路由截断特征值 | `elem.split("=")` 只取前两段，`campaign=source=mail` 读回为 `source`。[解码](../packages/loader-edge/src/variation.ts#L17) | 使用可逆编码，补充含 `=` 与分隔符的往返测试。 |
| P3-7 · 脚手架从分享链接提取出 `https` | URL 正则要求 ID 后为 `/` 或结尾，带查询串时失败，退回裸 ID 正则匹配出 `https`。[解析](../packages/create-plasmic-app/src/lib.ts#L243) | 用 `URL.pathname` 提取，裸 ID 校验整串匹配。覆盖查询串、fragment、尾斜杠。 |
| P3-8 · GIF 搜索改写输入并硬编码 API key | 查询值去掉空格且未编码，`rock & roll` 变为 `rock`；Giphy API key 写在源码中。[请求构造](../plasmicpkgs/plasmic-giphy/src/hooks/useFetch.ts#L12) | 用 `URLSearchParams` 构造查询；key 改为配置项。 |

## 二、测试与夹具问题

这些失败来自测试本身或运行环境，不代表产品缺陷，但会掩盖真实回归，需要修正。

| 位置 | 问题 | 修正 |
| --- | --- | --- |
| [DraggableInsertable.test.tsx](../platform/wab/src/wab/client/components/studio/add-drawer/DraggableInsertable.test.tsx#L60)（13 条） | StudioCtx mock 缺 `isPublishedTemplate`，设计模式门禁提前退出 | 普通可编辑夹具显式设为 false，另保留只读模板禁止拖放的用例 |
| [cseval-first-content.test.ts](../platform/wab/src/wab/client/cseval-first-content.test.ts#L83)（4 条） | ViewCtx 替身的 `componentStackFrames()` 返回 undefined | 替身返回空数组的根组件栈 |
| [newly-added-query.test.tsx](../platform/wab/src/wab/client/components/sidebar-tabs/newly-added-query.test.tsx)（4 条） | 缺少 `BottomModalsProvider` | 补齐渲染环境后再判断查询行为 |
| [locales.test.ts](../platform/wab/src/wab/client/i18n/locales.test.ts#L35) | 把消息键当英文模板比较占位符 | 对照英文消息值比较占位符，键集合单独比较 |
| [PosControls.native.test.tsx](../platform/wab/src/wab/client/components/style-controls/PosControls.native.test.tsx#L90) | 仍查找已移除的 left 触发器 | 改用 Horizontal/Vertical 控件完成 20px→35px 编辑后断言写回 |
| [CmsEntryDetails.integration.test.tsx](../platform/wab/src/wab/client/components/cms/CmsEntryDetails.integration.test.tsx#L82) | Studio 套件使用默认数据库地址 | 指向隔离测试数据库 |
| [DbMgr.spec.ts](../platform/wab/src/wab/server/db/DbMgr.spec.ts#L1773)（2 条） | 夹具未注册 `migration-pool` 连接 | 在临时库注册所需连接池，或只准备团队与套餐数据 |
| [email-compiler.test.ts](../platform/wab/tools/webpack/email-compiler.test.ts#L43)（2 条） | 写死带日期的临时目录，ENOENT | 移除落盘，或由用例创建并清理独有目录 |
| [shiguang-migration.test.ts](../platform/wab/src/wab/server/db/shiguang-migration.test.ts#L142) | 无时区时间受会话时区影响 | 夹具插入带偏移量的时间 |
| [slate-runtime.test.cjs](../platform/canvas-packages/slate-runtime.test.cjs#L272)（2 条） | 生产模式下卸载释放记录为空、悬停状态仍为 false | 定位是运行时缺陷还是断言过时 |
| [REQ075 回归夹具](../ai/plasmic/evals/req075-regression/test_verify_evidence.py#L18)（2 失败、14 错误） | 基础夹具在项目身份、断点、页面读回校验处即失败 | 先更新合法基础夹具，再逐个检查负例 |

以下 Studio 失败尚未归因，需逐个判断是产品问题还是测试过时：[canvas-lifecycle](../platform/wab/src/wab/client/components/canvas/canvas-lifecycle.test.ts#L42)（2）、[CopilotChatDialog](../platform/wab/src/wab/client/components/copilot/CopilotChatDialog.test.tsx#L162)（2）、[selection-change](../platform/wab/src/wab/client/studio-ctx/selection-change.test.ts#L178)（2，重复选择多触发 `scheduleSync`）、[GridControls](../platform/wab/src/wab/client/components/sidebar-tabs/GridControls.native.test.tsx#L57)、[MixinsSection](../platform/wab/src/wab/client/components/sidebar-tabs/MixinsSection.test.tsx#L156)、[MultiSelectionPanel](../platform/wab/src/wab/client/components/sidebar-tabs/MultiSelectionPanel.native.test.tsx)、[NavigationDropdown](../platform/wab/src/wab/client/components/sidebar-tabs/ProjectPanel/NavigationDropdown.test.tsx#L195)、[PropValueEditor](../platform/wab/src/wab/client/components/sidebar-tabs/PropValueEditor.test.tsx#L385)、[LeftSplitsPanel](../platform/wab/src/wab/client/components/sidebar/LeftSplitsPanel.test.tsx#L64)、[SidebarModal](../platform/wab/src/wab/client/components/sidebar/SidebarModal.test.tsx#L84)、[ThemePanels](../platform/wab/src/wab/client/components/sidebar/ThemePanels.native.test.tsx#L45)、[IFrameAwareDropdownMenu](../platform/wab/src/wab/client/components/widgets/IFrameAwareDropdownMenu.test.tsx#L161)、[editor-captions](../platform/wab/src/wab/client/i18n/editor-captions.test.tsx)、[model-util 快照](../platform/wab/src/wab/shared/model/model-util.test.ts#L22)，以及全量运行时 [CmsEntriesList](../platform/wab/src/wab/client/components/cms/CmsEntriesList.test.tsx) 的 2 个未捕获异步错误（单跑不复现）。

## 三、类型检查诊断

| 项目 | 问题 | 修正 |
| --- | --- | --- |
| Antd 5（12 条） | 1 条 TS6059 来自跨包导入 Antd 6 测试 setup；11 条未使用的导入或形参。[跨包引用](../plasmicpkgs/antd5/src/react19-contracts.test.tsx#L2) | 测试与构建源码范围一致，删除多余导入 |
| Commercetools、Swell（各 1 条） | Set 展开与编译目标不匹配（TS2802）。[Commercetools](../plasmicpkgs/commerce-providers/commercetools/src/utils/common.ts#L4) · [Swell](../plasmicpkgs/commerce-providers/swell/src/utils/get-vendors.ts#L22) | 改用 `Array.from` |
| React Aria（2 条） | Popover story 缺 children；TextField story 克隆元素未收窄 props。[Popover](../plasmicpkgs/react-aria/src/registerPopover.stories.tsx#L55) · [TextField](../plasmicpkgs/react-aria/src/registerTextField-common-stories.tsx#L213) | 示例与控件签名对齐 |
| 组件包开发宿主（2 条） | Loader 注册函数签名与本地 Registerable 不匹配。[初始化](../plasmicpkgs-dev/plasmic-init-client.tsx#L22) | 沿 `registerFunction` 类型来源对齐 |
| Live Frame（1 条） | 直接导入相邻包源文件，超出 rootDir。[引用](../platform/live-frame/src/preview.tsx#L2) | 通过共享包正式导出引用 |

## 四、应做的优化

均为保持行为不变的简化或规范对齐，修改时按"验证"列做前后对照。

| 位置 | 优化 | 验证 |
| --- | --- | --- |
| [查询面板基类](../platform/wab/src/wab/client/components/sidebar-tabs/ServerQuery/server-query-inputs.tsx#L19) · [变量面板基类](../platform/wab/src/wab/client/studio-ctx/state-management-inputs.tsx#L18) | 两个基类的订阅、发布、快照重算、闲置解绑和关停逻辑重复，合并为一处，两个入口各自保留归属校验 | 首次订阅、最后退订、字段变化、模型世界替换、重新订阅 |
| [HTTP](../platform/wab/src/wab/server/data-sources/http-fetcher.ts#L120) · [GraphQL](../platform/wab/src/wab/server/data-sources/graphql-fetcher.ts#L180) 数据源 | 两个 `processResult` 的解析、错误提取、状态码与响应头组装相同，抽为共享函数 | JSON、文本、空响应、错误状态四种输入结果一致 |
| [CMS 取行](../platform/wab/src/wab/server/db/DbMgr.ts#L7392) · [计数](../platform/wab/src/wab/server/db/DbMgr.ts#L7452) | 鉴权、软删除、发布态、where 转换重复，抽为私有查询构造函数 | 草稿、已发布、软删除、无权限下总数一致 |
| [增量修订合并](../platform/wab/src/wab/server/routes/projects.ts#L1263) | 每个修订都复制整个累计 map，复杂度随修订数平方增长；改用请求内单个累加 map | 完整响应一致，缓存原对象未被改写 |
| [MixinsSection 排序](../platform/wab/src/wab/client/components/sidebar-tabs/MixinsSection.tsx#L234) | `toIndex < fromIndex ? toIndex : toIndex` 两侧相同，直接传 `toIndex` | 前移、后移、原位拖动顺序不变 |
| [Loader React 变体收集](../packages/loader-react/src/variation.ts#L28) | 两层 `map` 只用来 push，改为 `for…of` | 多分组、未知 ID 下结果与顺序不变 |
| [组件变体同步](../platform/wab/src/wab/shared/code-components/code-components.ts#L1341) | 同时维护"组件+被移除选择器"和"组件"两个数组，只保留前者 | 顺序、确认时机和事务选项不变 |
| [组件动作同步](../platform/wab/src/wab/shared/code-components/code-components.ts#L1419) | 每个事件处理器都新建待清理对象，同一组件会重复提交给观察接口；改为每个组件只收集一次 | 命中交互、遍历顺序、单次无撤销事务不变。可与 P2-1、P2-2 一起改 |
| [桌面画板导出菜单](../desktop/src/workspace.cjs#L460) · [状态刷新](../desktop/src/workspace.cjs#L590) | "已就绪、编辑模式、有选中画板"判断写了三次，提取局部判定函数 | 点击时仍重新读取状态 |
| [桌面更新弹窗](../desktop/src/update-dialog.js#L21) · [MCP 设置](../desktop/src/mcp-settings.html#L78) | 使用 `overflow-y: auto` 自行滚动，不符合共享 `Scrollbar` 规范；参照[已有接入](../desktop/src/reference-browser-scroll.jsx#L14)改造 | 长内容、键盘滚动、窗口缩放、底部按钮可达，只有一个滚动视口 |
