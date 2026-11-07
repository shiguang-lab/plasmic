# React 19 适配逻辑审查

日期：2026-11-06。工作区：`codex/react-19-implementation`。这是实现方式审查和 Dropdown API 收敛记录，不是完整功能验收；不对持续变化中的 Zustand 迁移或冻结 U18 制品重新签收。

## 结论

| 项目 | 结论 | 当前处理 |
| --- | --- | --- |
| Dropdown 双 API | 不保留旧参数翻译层 | 实现直接使用原生 Antd 组件；注册、测试和维护中的库 fixture 使用 `open`、`popupRender`、`onOpenChange`。 |
| QueryBuilder | 统一使用 `react-querybuilder` 8.26.0 | 编辑器、Host 配置、持久化树及 SQL/JsonLogic 导出使用同一原生合同；旧 core 和双向树转换层已删除。 |
| Fiber 遍历 | 没有可直接替代当前完整能力的公开 React API | 公开 ref/Fragment API 可承担 DOM 定位、测量和清理；完整替代需要 Canvas 主动登记逻辑节点、属主、Slot 和重复实例身份。 |
| 类型补丁 | 应优先通过上游版本解决，不能转移成 `any` 或本地虚假声明 | Swell 补丁已由依赖修复线移除；Inspector 最新版本仍有公开主题 API 与声明不一致的问题。 |

## Dropdown 当前合同

`plasmicpkgs/antd/src/registerDropdown.tsx` 直接导出原生 `Dropdown` 和 `Dropdown.Button`。项目不再额外接受 `overlay`、`visible`、`onVisibleChange`，也不维护参数优先级或双回调链。

注册元数据使用原生名称：`popupRender` 是带 `menus` 参数的 render slot，`trigger` 是数组，按钮大小使用 `middle`，不再注册 `ghost` 按钮类型。默认弹层内容继续使用已注册的 `AntdMenu`。

`platform/loader-tests/data/plasmic-antd.json` 中对应定义同步使用新的 prop 名称、RenderFuncType 和枚举；既有组件、节点和参数标识保留。测试验证完整 bundle 引用与 Site invariants，以及实际运行时弹层内容和单次 `onOpenChange(open, info)` 回调。

这是一次 API 合同变更。没有添加运行时兼容分支，也没有修改真实项目或数据库中的保存模型。

## QueryBuilder 当前合同

使用 `react-querybuilder`、`@react-querybuilder/antd`、`@react-querybuilder/dnd` 和纯工具包 `@react-querybuilder/core` 8.26.0。React peer 为 `>=18`；Antd 扩展的 peer 为 `>=5.11.0`，覆盖当前 React 19 / Antd 6。

编辑器直接编辑和保存原生 `RuleGroupType`：组是 `combinator/not/rules`，规则是 `field/operator/value`，字段配置使用 `Field[]`。同一个合同贯穿数据源筛选、组件属性、分群和四个 CMS 包。服务器从该树导出 SQL 或 JsonLogic，不保存第二份派生 logic。

SQL/JsonLogic 使用上游公开导出器；需要读回 JsonLogic 的属性与分群编辑器使用上游解析器。解析器通过公开扩展点保留 Studio 表达式和已注册的 regex 运算符，不会把未知条件静默删掉。SQL 动态值继续走参数绑定，数字字符串保留文本类型；范围值分别编辑两个原生端点。

旧依赖、不可变树、旧配置对象、元数据值信封以及双向树转换函数已删除。维护中的项目夹具使用原生结构，没有运行时旧格式回退。2026-11-06 已只读检查 NAS 线上存量，本次上线不安排 QueryBuilder 数据迁移任务；检查范围与结果见下方迁移记录。未改写真实项目数据库。

详见 [QueryBuilder 当前实现与验证](querybuilder-migration.md)。上游提供[扩展说明](https://react-querybuilder.js.org/docs/compat)和[导出说明](https://react-querybuilder.js.org/docs/utils/export)。

## Fiber 的公开 API 替代边界

`globalHook.ts` 当前在 React commit 后重建逻辑 Val 树，计算重复实例身份、组件属主、Slot 内容和上下文；它依赖的并非只有 DOM 位置。

| 需求 | 公开方案 | 能否直接替换当前遍历 |
| --- | --- | --- |
| 单 DOM 节点定位、卸载清理 | DOM ref、ref cleanup | 可替换对应的定位职责 |
| 无额外 wrapper 的多个 DOM 节点测量、焦点、观察 | React 19.3 Fragment ref | 可承担这些 DOM 职责，但不提供组件树或业务节点身份 |
| 已提交的组件属主、Slot、重复 clone 身份 | Canvas 主动登记节点与上下文、为实例分配身份 | 需要改造受控渲染入口及注册合同 |
| 任意第三方组件的内部逻辑树 | 没有对应公开遍历接口 | 无直接替代 |

依据：[Fragment ref API](https://react.dev/reference/react/Fragment)、[Children 的组件渲染结果限制](https://react.dev/reference/react/Children#i-pass-a-custom-component-but-the-children-methods-dont-show-its-render-result)。`Profiler` 提供 commit 时间和性能信息，不提供上述逻辑树；`MutationObserver` 只观察 DOM，也不能恢复 Portal 的 React 属主。

因此本次没有删除 Fiber 遍历或用 DOM 扫描冒充等价实现。长期消除私有结构依赖的方向，是将 Canvas 的逻辑节点登记与 DOM/Fragment ref 登记作为明确合同实现，再替换当前反向推导。

## 补丁处置

- **Swell**：当前工作区使用 `swell-js 5.9.3`，原默认导出声明补丁及配置引用已经移除。这是其他依赖修复会话的结果，本次只核实当前源码和锁文件状态。
- **Inspector**：registry 最新正式版仍为 `react-inspector 9.0.0`。上游[公开说明](https://github.com/storybookjs/react-inspector#theme)支持自定义对象主题，但发布声明将相关 `theme` 参数推断为字符串。当前补丁仅修正 `.d.ts`，没有修改运行时或 React。
- Inspector 使用预设主题字符串可消除补丁，但会失去当前 Antd token 配色和代码字体定制；用类型断言、模块声明覆盖或隐藏在 props spread 中，只会转移声明问题。保留当前主题合同的直接路径是等待上游发布正确声明，或向上游提供声明修复。未经用户授权未提交外部 issue/PR。
- 既有 React Aria、react-slick 和跨 iframe DOM 补丁不属于本次新增的 React 19 模拟逻辑；其中 `@rc-component/util` 的跨窗口判断补丁与原版本逐字节相同。本次没有宣称这些既有问题已被上游解决，也没有无依据移除。

## 已运行的定向验证

私有证据目录：`/tmp/plasmic-react19-20261105/compatibility-review`。

| 检查 | 结果 | 日志 |
| --- | --- | --- |
| Antd 注册及真实交互 | 1 文件、10 项通过 | `dropdown-interactions-final.log` |
| 库 fixture 引用、模型 invariants、原生 render slot | 1 文件、1 项通过 | `dropdown-fixture-corrected.log` |
| QueryBuilder 与 Fiber 既有定向回归 | 3 文件、24 项通过 | `querybuilder-fiber-tests.log` |
| Antd 包 TypeScript | 退出 0 | `dropdown-typecheck-final.log` |
| 本次 TS/配置文件 ESLint | 退出 0 | `dropdown-lint-final.log` |

交互测试中的 jsdom 输出两条 `Could not parse CSS stylesheet`；未过滤这些输出，测试仍完成。测试入口准备期间的失败日志保留，不能算作产品失败或通过。没有运行完整功能验收、性能对比、Studio 新构建或发布。
