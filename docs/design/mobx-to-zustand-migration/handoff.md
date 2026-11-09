# MobX → Zustand 迁移验收

当前分支：`codex/react-19-upgrade`。源码替换、原生模型录制与依赖清理已完成并验收。采用完整运行后修复失败项、再覆盖相关影响域的方式验证；没有把原始失败运行改写为一次全绿。

## 当前清单

- WAB 生产源码：`observer`、`observable`、`autorun`、`reaction`、`computedFn` 和 MobX imports 均为 0。
- 全仓库 AST 清单：生产、测试、工具配置引用均为 0；package.json 的 MobX 依赖声明为 0。
- `platform/pnpm-lock.yaml` 已移除 MobX、mobx-react、mobx-react-lite、mobx-utils 的 importer、package 和 snapshot 条目，已验证 YAML 可解析。
- 已删除旧 MobX 包装模块、类型增补、纯库行为测试及 ESLint 迁移豁免清单；保留原生实现后的画布缓存与渲染生命周期接口。
- 没有重装依赖、重建数据库、提交或推送。

当前架构与订阅规则见[设计说明](../mobx-to-zustand-migration.md)。

## 已验证的关键行为

- 原生写录制、回滚、模型合并与同步查询缓存；相同原始容器的独立赋值不会互相污染。
- Val 运行时多字段先安装后发布；Inspector 在选择切换期间暂停旧快照，退役后旧回调拒绝编辑。
- 画布工厂与 env 资源由实际 render lease 管理；含 Hooks 的渲染边界退役时卸载内层 Fiber。
- 真实样式、token、图片、响应式、参数、查询、交互、画布与图层树输入使用有限字段和实际 registry 契约，保持原模型命令对象。
- 服务端持久化窄测 `projects-save`、`project-revision-routing`、`dependency-model-resources`：3 文件、17 项通过。

最终验证记录见 [verification.json](verification.json)。

| 检查 | 实际结果 |
| --- | --- |
| WAB 本地类型检查 | 通过 |
| 集中 ESLint | 506 文件，0 错误，168 警告 |
| 完整 Studio 原始运行 | 833 文件：817 通过、16 失败；5542 项通过、22 项失败、4 项原有跳过；3 个未捕获错误 |
| 修复后影响域复验 | 70 文件、376 项全部通过，0 未捕获错误；包含全部 16 个原失败文件及 Figma 清理回归 |
| 服务端保存回归 | 3 文件、17 项通过 |
| 两份 inventory 与 diff 检查 | 通过；生产、测试、工具和依赖声明的 MobX 引用均为 0 |

修复覆盖：真实模型的准入与录制、旧 world 的显示冻结和写入拒绝、标题闭包的显式订阅、维度与反向布局的真实 CSS 指标、SDK/SWR 的同实例 React 解析，以及测试 fixture 的原生 owner 和清理合同。没有通过增加超时、忽略异常、替换真实 Hooks 或撤销原命令断言来通过检查。

70 文件复验期间，受检的 5324 个源码与配置文件哈希未变化。不同批次有重叠，不能把用例数直接相加；4 项原有跳过保留。当前没有已知未修复的迁移失败。

## 测试夹具与运行约束

fakeStudio 保留真实懒录制和选择发布语义：非活跃组件需通过 `studio.observeComponents()` 取得树录制；编辑 provider 应在 `isSelectionPending` 变为 false 后创建；View 退役应走 `studio.disposeViewCtx()`，避免注册表仍保留已释放对象。DOM 观察器需要真实 Node。

检查在 `platform/wab` 中使用其本地 `node_modules/.bin/vitest` 和 `node_modules/.bin/tsc`，不通过 `pnpm exec` 触发依赖同步。根目录的 Vitest、jsdom 与 WAB 属于不同依赖树；混用会使 jest-dom 断言注册到另一测试实例，不能把这种运行结果当作产品回归。带类型的 ESLint、TypeScript 和完整 Studio 测试串行运行，避免并发类型图造成内存换页。Studio 测试使用现有测试数据库，数据库与容器保持运行。

```sh
# 工作目录 platform/wab
WAB_TEST_SUPER_DATABASE_URI=postgresql://superwab@127.0.0.1:55436/postgres \
WAB_TEST_DATABASE_URI=postgresql://wab@127.0.0.1:55436/postgres \
node_modules/.bin/vitest run --project studio --maxWorkers 2
NODE_OPTIONS=--max-old-space-size=16384 node_modules/.bin/tsc --incremental
```

两份 inventory 的 `--check` 和 `git diff --check` 已通过，清单与实际文件一致。
