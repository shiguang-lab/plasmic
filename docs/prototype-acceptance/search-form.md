# SearchForm 本地验收

实现契约见 [Overseas SearchForm](../search-form.md)。参考源为 `/Users/yanxianliang/overseas/fintechgrowthui/src/components/search-form.tsx`。

## 已验证

- `pnpm --filter @shiguang-lab/plasmic-overseas typecheck` 通过。
- `pnpm --filter @shiguang-lab/plasmic-overseas test` 通过，8 项（包含 2 项 AppShell 回归）。覆盖注册、Slot、事件/状态/actions、栅格、默认值、Slot 节点遍历、折叠保留字段、编辑器与交互预览的显示差异。
- 新增三个 src 文件的 ESLint 通过，无警告。
- `pnpm --filter @shiguang-lab/plasmic-overseas build` 通过，包含两套 skinny 注册入口和类型声明。
- canvas-packages 的 Overseas / Overseas-v2 客户端及服务端构建通过。
- `node plasmicpkgs/overseas/preview/verify-search-form.mjs` 浏览器验收通过。覆盖查询/重置、折叠值保留与提交、Select.clearValue、Checkbox、Antd6 日期 ISO 值、原有控件事件、额外操作 Slot、三个 ref actions、字段插入/修改/删除、自定义 selectedKey/onSelectKey 控件绑定、可见字段校验及折叠区错误自动展开。无 pageerror。
- 1440×1024 截图已检查：`desktop/desktop-report/search-form/runtime.png`。预览入口：`http://127.0.0.1:3106/?search-form`。

## App 接入状态

当前 Desktop 的 MCP `get_app_state` / `identify` / `read` 确认项目 `b1VPmGnbGvyKc4rnA2xLVv` 可编辑，Overseas imported project ID 为 `f3f4ju424PVNTAQPkwovrE`，目录只有 AppShell，尚无 SearchForm 定义。

本地组件、画布资源和生成规则已准备。需要发布正式 NAS 镜像、运行原生 hostless 组件库发布，再通过 MCP upgradeLibrary 更新项目的 Overseas 契约并保存。新增组件的 Studio 插入、MCP 节点编辑与保存/重开验收须在发布后执行；当前本地浏览器验收不替代这部分验收。
