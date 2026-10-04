# SearchForm 验收

实现契约见 [Overseas SearchForm](../search-form.md)。参考源为 `/Users/yanxianliang/overseas/fintechgrowthui/src/components/search-form.tsx`。

## 代码与运行态

- `pnpm --filter @shiguang-lab/plasmic-overseas typecheck` 通过。
- `pnpm --filter @shiguang-lab/plasmic-overseas test` 通过，8 项（包含 2 项 AppShell 回归）。覆盖注册、Slot、事件/状态/actions、栅格、默认值、Slot 节点遍历、折叠保留字段、编辑器与交互预览的显示差异。
- 新增三个 src 文件的 ESLint 通过，无警告。
- `pnpm --filter @shiguang-lab/plasmic-overseas build` 通过，包含两套 skinny 注册入口和类型声明。
- canvas-packages 的 Overseas / Overseas-v2 客户端及服务端构建通过。
- `node plasmicpkgs/overseas/preview/verify-search-form.mjs` 浏览器验收通过。覆盖查询/重置、折叠值保留与提交、Select.clearValue、Checkbox、Antd6 日期 ISO 值、原有控件事件、额外操作 Slot、三个 ref actions、字段插入/修改/删除、自定义 selectedKey/onSelectKey 控件绑定、可见字段校验及折叠区错误自动展开。无 pageerror。
- 1440×1024 截图已检查：`desktop/desktop-report/search-form/runtime.png`。预览入口：`http://127.0.0.1:3106/?search-form`。

## 正式部署

2026-10-04，经用户确认发布 `0.0.27`，源码提交 `d19aca0ce725343f453cfab69f9993337c8af005`。[镜像构建](https://github.com/shiguang-lab/plasmic/actions/runs/37164287558) 的 web/server 均成功。

NAS 部署目录为 `/volume1/docker/plasmic/images`。一致性备份 `/volume1/docker/plasmic/backups/images-20261004T001429Z` 的数据库、存储及部署文件校验和全部通过。migration:run 返回无待执行迁移；nas-antd6 原生目录发布成功，Overseas 注册 AppShell、SearchForm、SearchForm.Item 三个组件。db/storage/server/web 均健康。

正式镜像摘要：

- web：`sha256:8de39089ef656927bda05522999dde83a06505c5f636146e187b3198a40cd404`
- server：`sha256:a83e692f6ea1bf083314ca13cbe3fb8a4024deb2fd898107b5c96c2b3e257bad`

Desktop 已打包并重启，renderer/app.asar 的 assets manifest 为正式 `0.0.27` / `d19aca0ce725343f453cfab69f9993337c8af005`；Overseas 两套画布入口均包含 SearchForm 注册。`node --test desktop/tests/assets.test.cjs` 10 项通过。

## Studio 编辑与持久化

MCP 确认项目 `b1VPmGnbGvyKc4rnA2xLVv`（Untitled Project）可编辑；Overseas imported project `f3f4ju424PVNTAQPkwovrE` 已升级至 `1.1.0`。验收通过公开 MCP 在临时页面完成：

- 插入 SearchForm、四个真实 Item 及 Antd6 Input/Select/Checkbox/DatePicker，展示表单默认值。
- 编辑 label、span、initialValue、clearValue、required、requiredMessage 和实际控件 placeholder。
- 插入地区字段及其 Select 和富文本 labelContent；移动顺序后删除该字段。
- 将 Control Slot 的 Input 替换为 Select；插入自定义标签、help 和 extraActions Slot。
- 创建 applied 状态，将 onSearch(values)/onReset(values) 绑定到状态更新。
- 临时页面 validate 无错误或警告；截图 `studio-inserted.png`、`studio-edited.png` 已检查。
- 保存后正常退出、重启 Desktop，再 read：完整组件内容深度比较一致，字段/控件/Slot/状态/交互 UUID 与属性均保留。重开后的渲染截图 `studio-reopened.png` 已检查。

证据位于 `desktop/desktop-report/search-form/`。临时验收页面完成后删除；原有五个 REQ075 业务页面的 571 个节点 UUID 和顺序保持一致。全项目 validate 无错误，现有 Text Input、TextArea Input、Slider Thumb 三个空子节点警告保留。
