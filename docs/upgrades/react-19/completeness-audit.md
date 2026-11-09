# React 19 升级完整性与实现方式审查

核查日期：2026-11-06。范围：隔离工作区 `codex/react-19-implementation`。当前结论：**尚未全部完成；不能将“没有伪造 React API”表述为“没有任何补丁或内部结构依赖”。** 性能分析与进一步优化已按用户要求暂停，尚未完成回归的 Loadable transition 试验已撤回；恢复后的原有 3 项 Loadable 测试通过。

## 已核实的升级范围

- 升级分支实际安装 React/DOM 19.3.1、React 类型 19.3.0；独立 Preview 声明 Next 16.4.5 和 React/DOM 19.3.1，Antd 主链为 6.7.0。
- 实际安装 react-draggable 4.7.2、react-joyride 3.2.0、react-inspector 9.0.0、@monaco-editor/react 4.7.0。后两类已使用声明支持 React 19 的官方版本；拖拽调用改为官方 nodeRef，未保留 findDOMNode。
- 17 个 SDK、59 个公开组件包列入具名发布计划；独立消费者严格 peer 安装、生产构建、模块实际执行与 ActionGroup 点击通过。这不代表所有组件交互和服务协议已全部验收。
- 用户确认无消费者的 Gatsby、旧 Next RSC 专用路径、Chakra、examples，以及 Rich Components、Sortable、Quill、Rive、YouTube 已退役并清理活跃入口。Pro 及其旧 Form 替身随独占调用方移除。
- 原工作区 `/Users/yanxianliang/shiguang/plasmic` 的 catalog 仍为 React 18.3.1；本轮尚未合入或部署。

## 尚未关闭

| 项目 | 实际状态 |
| --- | --- |
| 完整 Zustand 替换 | 仍有 414 个文件引用 MobX 或项目包装：351 个源码、62 个测试、1 个工具。mobx 6.13.6／mobx-react 9.2.0 仍在使用；后者声明支持 React 19，但不等于 Compiler 安全。Compiler 已改为默认开启，当前安全编译范围为 7 个组件；剩余模型不能因开启配置就记为已完成迁移。 |
| 根工具链 peer | dedent 1.7.2 要求 babel-plugin-macros ^3.1.0，当前检查解析到 2.8.0；root peers check 有 1 项失败。platform peers check 无问题。此项属于工具链，不是 React peer 冲突。 |
| 全范围验证 | 实际 CLI／后端协议、完整消费方交互及部署平台验证尚未全部关闭。普通项目 5 项、复杂画布 8 项及保存重开、Docs 双模式通过，只能代表该覆盖范围。 |
| 发布与合入 | 未对外发布 SDK，未合入原工作区。 |

## 补丁与适配方式

公开类型按 `strict: true`、`skipLibCheck: true` 验收；独立消费者类型检查、生产构建和浏览器执行已通过，见[公开类型验收](public-types-verification.md)。第三方声明内部检查不列为未完成项。

| 位置 | 内容 | 本轮判定 |
| --- | --- | --- |
| platform/patches/react-inspector.patch | 修正官方运行时已接受的 object theme 的 TypeScript 声明 | 本轮新增，仅 .d.ts；不是让 React 18 库伪装支持 19，但仍是需要公开记录的本地补丁。 |
| platform/patches/swell-js.patch | 为既有真实 ESM 默认导出补全类型声明 | 本轮新增，仅 .d.ts；当前官方包仍是旧 3.x，声明问题未完全关闭，应继续优先评估官方更新。 |
| @react-aria/focus、@react-aria/overlays、react-slick patches | 原有焦点、浮层定位及轮播修复 | 与 HEAD 中的补丁逐字节一致；根安装边界新增引用，不能当作没有补丁。 |
| Sub @rc-component/util patch | 通过节点 ownerDocument.defaultView 判断跨 iframe DOM | 原有运行时补丁原样从 1.13.0 迁至 1.14.1；不是新增 React API 模拟。 |
| Studio Fiber／DevTools hook | 画布节点选择、渲染树跟踪 | 原有架构依赖私有 Fiber 结构；本轮更新 WorkTags 和 Activity／Offscreen 遍历。属于真实的 React 版本耦合，不能宣称只使用公开 React API。 |
| 自定义 JSX runtime | Plasmic 节点注入，最终委托真实 React 元素创建 | 既有架构；本轮修正 React.JSX、key／children 和 props 所有权，没有伪造 React element／dispatcher。 |
| prepass | 删除旧私有 prepass 路径，使用 react-dom/static.prerender | 使用官方公开 API；不模拟 dispatcher 或老式 render。 |

对本轮新增源码行的定向检查，未发现伪造 React／ReactDOM 旧 API、写入 React 私有 dispatcher、增加 suppressHydrationWarning 或用 legacy-peer-deps 绕过 React peer 检查。该定向检查不能代替所有实现的语义审查；Fiber、JSX 入口及上述补丁保留具名边界。

本次重新运行 Fiber 遍历／生命周期／注入前言和 XDraggable 共 4 文件、12 项测试通过。后续先关闭升级、声明和实现审查事项；性能工作保持暂停。
