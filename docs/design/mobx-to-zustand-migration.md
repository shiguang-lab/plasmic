# Studio 原生状态与模型订阅

MobX → Zustand 迁移的源码、测试和工具配置引用已归零，依赖声明与锁文件已移除 MobX。本轮订阅、更新与生命周期复审已完成修复：完整 Studio 测试 842 个文件通过，5,596 项通过、4 项既有跳过，无未处理异常；WAB 类型检查通过，本轮 96 个源码文件的 ESLint 为 0 错误、9 条既有警告。具体范围和源码快照见[复审验证记录](mobx-to-zustand-migration/review-verification.json)。此前交接结果见[交接记录](mobx-to-zustand-migration/handoff.md)。

## 1. 范围与可复现清单

迁移覆盖 `platform/wab` 的 UI、ctx、画布、派生查询和文档模型录制。仓库级扫描同时检查测试、工具配置和各包的依赖声明。

```sh
node docs/design/mobx-to-zustand-migration/inventory.mjs --write
node docs/design/mobx-to-zustand-migration/inventory.mjs --check
node docs/upgrades/react-19/state-inventory.mjs
node docs/upgrades/react-19/state-inventory.mjs --check
```

[baseline.json](mobx-to-zustand-migration/baseline.json) 记录 WAB 的生产源码计数；[state-inventory.json](../upgrades/react-19/state-inventory.json) 使用 TypeScript AST 检查全仓库的直接及已删除包装模块引用。两份清单都必须保持最新。ESLint 禁止生产代码重新引入 MobX，没有迁移豁免清单。

## 2. UI 状态

UI 状态由 ctx 实例拥有的 Zustand vanilla store 发布，React 通过显式 selector 订阅。使用原有领域 owner，例如 selection、variants、viewport、arena、comments、multiplayer、inspector 和 UI environment；不要再建一套平行状态。

- selector 返回稳定的原值或快照；组合值使用适当的浅比较。
- 保留 `observer` 原有的浅比较语义：函数组件和 `forwardRef` 外层使用 `React.memo`。自身 store 或 context 的变化仍可刷新；子组件自己读取的模型字段必须自己订阅。
- 临时界面状态与可保存的文档模型分离，文档修改仍走原 Studio/View command。
- 注册组件、自定义函数和代码库的更新由真实 registry revision 发布，消费者比较实际选中的契约。

## 3. 可变文档模型与录制

文档模型继续使用原始对象身份、模型类和可变容器。`shared/core/model-mutations.ts` 只记录写操作：共享的模型字段描述符和容器 Proxy 把字段更新、数组 splice 和字典增删交给 `observable-model.ts`。

`ChangeRecorder` 继续负责变更记录、弱引用检查、回滚、undo 与增量保存。它不自动追踪读取。原始数组/字典每次独立赋值使用独立容器；显式复用已录制容器则保留身份。

`shared/model-query.ts` 为纯模型查询提供按真实同步写版本失效的缓存，包括尚未结束的 command 与 rollback。缓存由第一个被录制的模型参数拥有；未录制的普通参数不缓存。输出比较只在查询确实需要稳定结果身份时使用。

## 4. 有限模型输入与画布

`ModelSnapshots` 提供已声明字段的稳定快照和原始模型引用。领域输入源明确列出所读字段，在实际字段改变时重新计算、重新绑定依赖，并只发布发生变化的结果。

画布使用 `CanvasRenderOwner`、有限模型 capsule、selection/variant/runtime 输入和原生样式 cells。工厂缓存由 view/render owner 管理，提交、命中和废弃 render 的 lease 决定资源存活期。带 Hooks 的 canvas observer 保留稳定外层生命周期边界，退役时卸载内层 Fiber。

ValNode 与 ValComponent 的 env、props、contents、invalidArgs 使用原生运行时输入。一次 Fiber 提交先安装完整值，再统一发布通知，订阅者不能看到半次提交。

`ModelFieldSelector` 复用已声明的字段 store，按实际引用重新绑定字段，只发布发生变化的选择结果。首次订阅连接、末次退订释放，原模型 owner 退役后不再读取字段。项目目录、依赖名称、画布网格和坐标、Inspector 标题及函数声明分别订阅自己的有限输入；顶部栏按实际权限、菜单和预览状态订阅。

样式面板复用真实 StyleInputs/StyleCells、token 引用与原模型命令。不要为了触发刷新添加虚假 CSS 属性，也不要用整个 site 的版本代替有限属性订阅。

## 5. 修订索引、身份与生命周期

`model-change-keys.ts`、`ModelRevisions`、`ModelSnapshots` 和领域输入源把完成的录制变更转为显式通知。`ModelRevisions` 由每个 Studio 独立拥有，模型替换时推进 epoch 并释放旧 key，Studio 销毁时清理订阅和待发布任务；不同编辑器不会共享 site 或组件版本。一次发布先安装全部 key 的版本，再对同一订阅通知一次。只有实际需要扫描整棵组件结构的查询才订阅该组件的结构键；普通字段、样式和标签读取应使用有限输入。

模型 prop 属于首次收到它的 model world。更换 Studio、site、模型 owner 或 view 后，旧输入源必须退役，不能把旧模型重新登记到新 owner。组件仍可展示期间保留的菜单、异步回调和编辑命令也必须检查原 owner 是否仍有效。

Inspector 延迟到绘制后发布新选择。等待期间旧选择暂停读取，编辑命令拒绝提交；新选择建立后再恢复。测试应等待真实选择发布，再创建绑定该选择的编辑 provider。

所有按需订阅在第一个消费者挂载时连接，最后一个消费者卸载时释放；world/view 退役也会断开。需要缓存的值和 env 必须在相关 render lease 存活期间保持可达。

依赖列表直接读取当前命令数据，画布目录排序和函数声明缓存使用同步模型写版本，不能等待异步 UI revision 才失效。组件预设转换缓存由 Studio 和组件共同拥有，并核对当前 Site、安装状态及宿主注册表版本；宿主更新不会继续返回旧模板，其他编辑器不能复用当前 Site 生成的模板对象。

预设 Hook 在没有目标组件时不连接订阅，原 owner 退役时立即断开。模型退出统一清理预设、页面设置、引用搜索和概览中的旧模型引用；页面设置内容由原页面的 world 控制挂载，关闭和替换不会把旧页面登记到新模型 owner。

命令式 selector 订阅先连接再执行即时回调，回调内的写入仍可被观察。`useFrameValue` 仅合并通知；渲染和挂载一致性检查始终读取当前 store／selector，更换 owner 或卸载会取消旧帧任务。

## 6. 验证方式

核心录制、撤销、模型合并、运行时原子发布、旧 world 退役和真实编辑目标使用必要窄测。组件回归应尽量使用真实 fakeStudio/ViewCtx、原始模型对象和实际领域源，只 mock 不相关的外部或展示边界。

订阅与性能回归通过计数断言验证：相同选择结果不刷新、无关字段不重新计算、相同 UI 命令不发布、父级相同 props 不重绘画布帧，最后一个消费者退出和模型退役均释放订阅。这些断言覆盖重复工作与正确性；本轮没有采集真实浏览器 FPS、交互延迟或堆内存基准。

重验收按较大批次集中执行。带类型检查的 ESLint、WAB TypeScript 和完整 Studio 测试串行运行，避免同时加载多份完整类型图造成内存换页。

```sh
# 在 platform/wab 中执行；使用已安装工具，不触发安装
node_modules/.bin/vitest run --project studio --maxWorkers 2
NODE_OPTIONS=--max-old-space-size=16384 node_modules/.bin/tsc --incremental
```

服务端持久化窄测使用既有本地测试数据库。依赖安装、数据库重建、提交和推送不属于本轮操作。
