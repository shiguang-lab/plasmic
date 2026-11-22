# Desktop 与 Studio 代码审核

2026-11-22 · `master` · 基线 `ae1dc31dc`，含审核时工作区的未提交改动。

全项目的后端、前端、SDK、组件库、部署与验证结果见[全仓代码审核](repository-audit-2026-11-22.md)。

**建议优先修复桌面端的 `.plasmic` 导出。** 两个独立问题都能生成外观正常的文件。带组件库的项目会把依赖模型写成 `null`；在工作分支上导出，则会取回主分支内容。两者可以同时发生。现有导出测试使用空依赖，也没有设置分支，因此可以在这两种缺陷存在时通过。

本次从未提交的封面订阅、组件动作同步及其测试出发，沿调用链抽查了快照服务、交互面板、桌面最近项目，以及项目导出和导入接口。以下 6 项均核对了实际代码，并用本地受控输入观察了异常结果。覆盖范围限于这些路径。

## 功能缺陷

### 1. 高优先级 · 有依赖的项目导出后无法完整导入

项目读取接口会把依赖模型替换成 `modelResourceId`。桌面菜单直接读取 `info.model`，得到的 `undefined` 在数组里被 JSON 序列化为 `null`。本地调用真实导出菜单，提供一个带资源 ID 的依赖，磁盘文件中的依赖条目为 `["pkg", null]`。导入端随后会读取 `dep.map[dep.root]`，文件内已缺少所需模型。[桌面导出](../desktop/src/workspace.cjs#L554) · [项目接口](../platform/wab/src/wab/server/AppServer.ts#L1380) · [依赖响应](../platform/wab/src/wab/server/routes/dependency-model-resources.ts#L60) · [导入读取点](../platform/wab/src/wab/server/db/imported-hostless-deps.ts#L16)

**修正与验收。** 导出前按现有模型读取契约解析每个资源 ID，保留依赖包 ID 和原顺序，全部成功后再写文件。用包含一个已注册组件库的项目做导出、导入往返，确认组件实例和属性仍能打开。再令一项依赖读取失败，确认导出报错且原有目标文件完整。[已有模型读取逻辑](../platform/wab/src/wab/shared/SharedApi.ts#L407) · [现有导出测试](../desktop/tests/workspace.test.cjs#L325)

### 2. 高优先级 · 在工作分支导出会得到主分支内容

菜单先保存当前编辑器，再通过裸 `projectId` 请求模型。服务端从请求路径解析 `branchId`，裸项目 ID 会读取主分支的最新修订。本地给主分支和工作分支设置不同的根节点标记，令编辑器处于分支 `b`。菜单只请求了 `/api/v1/projects/p`，导出文件中读到的是 `main`。[导出请求](../desktop/src/workspace.cjs#L519) · [编辑上下文中的分支 ID](../platform/wab/src/wab/client/copilot/index.ts#L2794) · [服务端修订选择](../platform/wab/src/wab/server/routes/projects.ts#L1702)

**修正与验收。** 从点击导出时的编辑上下文读取项目和分支，按现有 `projectId@branchId` 契约选择修订。用没有依赖、两个分支页面内容不同的项目分别导出，直接断言文件内的页面内容。此用例可以独立验证分支修复。[分支路径契约](../platform/wab/src/wab/shared/ApiSchemaUtil.ts#L45)

### 3. 中优先级 · 最近项目的旧查询会删掉刚记录的模板入口

打开「文件」菜单会并行捕获编辑器状态并异步刷新最近项目。刷新开始时复制旧条目，但返回时仅按项目 ID 从最新列表中删除。普通项目和已发布模板可以共用项目 ID，读取入口和可用性判断却不同。本地让普通项目查询等待，期间记录同 ID 的已发布模板，再让旧查询返回空项目列表。内存列表和重新从磁盘读取的列表都变成了空数组。[菜单触发点](../desktop/src/main.cjs#L932) · [记录条目](../desktop/src/workspace.cjs#L66) · [异步刷新与删除](../desktop/src/workspace.cjs#L226)

**修正与验收。** 将不可用结果绑定到本次实际查询的条目，只在该条目仍对应当前记录时删除。用可控 Promise 分别验证两个结果：被新模板入口替换的记录保留，一直未变且确已失效的记录删除。两种情况都重新打开工作区核对持久化结果。

### 4. 中优先级 · 封面服务丢失图片后，返回列表可能无法触发重建

重新挂载的卡片会立即显示缓存封面。服务端返回修订号 `0` 明确表示用户可读取项目、服务端尚无图片。客户端仅在发布修订号大于已显示修订号时请求图片，而可见性回调也会因已有缓存而跳过读取。本地先缓存修订 5，再让服务端报告 0，观察到一次修订查询、零次封面 GET，卡片持续显示旧图。对早于快照服务安装、且没有新保存的项目，封面 GET 正是触发首次生成的入口。[缓存恢复](../platform/wab/src/wab/client/components/dashboard/preview/cover-subscriptions.ts#L290) · [修订比较与读取条件](../platform/wab/src/wab/client/components/dashboard/preview/cover-subscriptions.ts#L196) · [修订 0 的契约](../platform/wab/src/wab/server/routes/project-covers.ts#L100) · [快照扫描与按需生成](../deploy/canvas-snapshot/covers.cjs#L128)

**修正与验收。** 当可见卡片收到明确的修订 0 且已有缓存时，保留旧图，并发起一次可触发重建的 GET。收到 202 后等待发布事件；同修订重建完成时也应能结束恢复状态。相同的有效修订应继续复用缓存。用“缓存 5 → 服务端 0 → GET 返回 202 → 发布 5”覆盖完整过程。

### 5. 中优先级 · 动作参数顺序改变后，已移除的组件动作会漏清理

交互模型使用带名字的 `NameArg`，运行时也按 `tplRef`、`action`、`args` 取值。同步代码却假定前两项依次是元素和动作。本地把同一个交互的参数顺序改为 `[action, tplRef]`，再移除注册动作，清理函数成功返回，但旧动作和目标仍在模型中。编辑面板的参数控件随后可能访问已经不存在的动作定义。[参数模型](../platform/wab/src/wab/shared/model/model-schema.ts#L459) · [位置解构](../platform/wab/src/wab/shared/code-components/code-components.ts#L1430) · [运行时取参](../platform/wab/src/wab/shared/core/states.ts#L1322) · [编辑面板读取](../platform/wab/src/wab/client/state-management/interactions-meta.ts#L618)

**修正与验收。** 通过 `NameArg.name` 查找并保留实际的 `tplRef` 参数。针对同一交互交换前两项，分别覆盖“另有可选动作”和“最后一个动作被移除”。两种排列应产生相同的清理结果。

### 6. 中优先级 · 最后一个动作移除后，空注册表仍让交互保留目标

组件库可以用 `refActions: {}` 表达空动作集合。同步代码正确识别了已移除的动作，写回阶段却按对象真值决定是否保留元素。本地从仅有 `focus` 的注册表切换到空对象，交互仍有 `tplRef`；现有测试使用 `undefined`，断言得到空参数数组。对使用者，两者都没有可选动作。[清理分支](../platform/wab/src/wab/shared/code-components/code-components.ts#L1473) · [面板选项来源](../platform/wab/src/wab/client/state-management/interactions-meta.ts#L542) · [现有测试输入](../platform/wab/src/wab/shared/code-components/code-components.test.ts#L69)

**修正与验收。** 按剩余动作数量决定是否保留目标，并核对注册与元数据刷新阶段的 `hasRef` 语义。以缺省值、空对象、仍含另一个动作三种注册表验证。前两种应清空参数，第三种应保留元素并允许重新选择动作。[元数据刷新](../platform/wab/src/wab/shared/code-components/code-components.ts#L1583) · [初次注册](../platform/wab/src/wab/shared/code-components/code-components.ts#L3671)

## 保持行为的简化

| 位置 | 可以删掉的重复实现 | 等价条件 |
| --- | --- | --- |
| [组件变体同步](../platform/wab/src/wab/shared/code-components/code-components.ts#L1341) | 同一个分支同时维护“组件与被移除选择器”和“组件”两个数组。只收集前者，在调用观察接口处取组件列，修复时直接遍历同一批记录。 | 保持顺序、确认时机以及原有事务选项。 |
| [画板导出菜单](../desktop/src/workspace.cjs#L460) · [菜单状态刷新](../desktop/src/workspace.cjs#L590) | 菜单初始化、点击、状态刷新各写一次“已就绪、编辑模式、有选中画板”。仿照同文件的 `canImportIntoDesign`，提取一个局部判定函数。 | 点击时仍重新读取状态。保留“菜单打开后取消选中画板”的保护。 |
| [组件动作同步](../platform/wab/src/wab/shared/code-components/code-components.ts#L1419) | 每个事件处理器都分配一个以组件命名的待清理对象，同一组件有多个命中时还会被重复提交给观察接口。把收集对象移到所属组件循环，仅在有命中时加入一次。 | 保留所有处理器的命中交互、遍历顺序、无命中提前返回，以及单次无撤销记录事务。 |

## 实际验证

| 检查 | 结果 |
| --- | --- |
| 仓库根目录运行 `node --test desktop/tests/workspace.test.cjs desktop/tests/studio-window.test.cjs` | 43 项通过 |
| 仓库根目录运行 `node --test deploy/canvas-snapshot/covers.test.cjs` | 3 项通过 |
| 在 `platform/wab` 用本包 Vitest 运行 `cover-subscriptions.test.ts`、`code-components.test.ts`、`dependency-model-response.test.ts` | 分别两次执行，前两份合计 36 项通过，最后一份 4 项通过 |
| 桌面端本地样本 | 调用真实菜单和 `DesktopWorkspace`，模拟会话响应，读回临时导出文件和工作区文件，观察到第 1–3 项结果 |
| WAB 本地样本 | 复用现有测试夹具，分别输入封面修订 0、颠倒的命名参数、空动作注册表，观察到第 4–6 项结果 |

上述复现核对的是当前异常行为。修正与验收部分列出的是修复后的预期。此次仅新增审核文档；真实 Electron 窗口、数据库导入往返和全仓测试未执行。
