# REQ075 海外客群管理平台 P0 — 可编辑原型交付报告（定稿）

定稿时间：2026-10-25　范围决定：本期不做 .pen 视觉对照（用户确认）

## 1. 交付物
- 组织 数禾 / workspace 海外 / 项目「REQ075 发布后完整回归 20261020_DS」
  projectId `uSwwgCkC1ujK3EVVPvmHdW`，canvas「页面总览」，revision 75，saved，`validate` valid（4 pages / 4 components）
- 页面
  | 路由 | 名称 | componentUuid |
  |---|---|---|
  | /groups | 客群列表 | eYMR4owU-V6_ |
  | /groups/selector | 客群圈选器 | YW4MQIakrQnt |
  | /groups/onetime-create | 新建一次性客群 | cVcKW-ucQxXU |
  | /groups/detail | 客群详情 | NisuOsxUy7dG |
- 组件库：antd6 2.1.0、overseas 1.9.0、react-ui 0.1.0、antd-icons 0.1.0（均为真实注册件）
- 模板：Admin Templates `TabsTableSection` 实测模型 → 列表页 reference 还原（Card body `0 20px` → Tabs → TabItem → Table → 固定右操作列）

## 2. 需求覆盖（REQ v1.36 §5/§6 + PRD v0.17 §4，P0）
- 页面：客群列表、客群圈选器（SQL 模式）、一次性客群建群、客群详情（含圈选记录 / 刷新记录 / 应用记录 Tab 与应用详情抽屉）
- 业务规则落到界面：客群级状态机（初始化/圈选中/圈选失败/启用/停用）驱动的行操作显隐与二次确认、状态流转；
  数据保存天数（3/7/30/60/180/长期）与产出截止时间（时分秒）；预跑三态弹窗；SQL 六项校验；一次性有效期 14 天（上限 365）
- App 上下文：页面 state `appSource` → AppShell 绑定 + 变更回写，四张数据表按 App 过滤（TACO 21 / PESO 3 等）

## 3. Stage 门禁（整项目，一次跑通；含 save+reopen 后复跑）
`work/run-r23/report.json`（revision 75）：
| 门禁 | 结果 |
|---|---|
| evidence / model / rendering | passed |
| structure / page_layout | passed |
| forms / descriptions / overlays / slots | passed |
| shell_height | passed |
| references | not_applicable（本期不做 .pen 对照） |

清单：`structure-expectation.json`、`forms-inventory.json`、`description-inventory.json`、`overlay-inventory.json`、`intent-*.html`、`suite.json`

## 4. Preview 运行时
正式证据（`runtime-manifest.json` + `trace.jsonl` + `runtime-report.json`）：
```
caseCount 96 | passed 6 | failed 0 | invalid_evidence 0 | unexecuted 90
```
已通过：/groups all-page-change-1、all-page-change-2、all-page-size-1、mine-page-change-1；
　　　　/groups/selector preview-page-change-1、context-data-selector。

人工 Preview 复核（未纳入 manifest，属"已观察未取证"）：
- 列表：关键字查询、重置、新建客群悬停菜单与跳转、行操作 Message、上线二次确认、详情跳转
- 圈选器：表单值（3天/T+1动态/常规/18:00:00）、提交→预跑弹窗
- 建群页：步骤条、6 项基本信息、来源写SQL、有效期 14、提交→预跑弹窗
- 详情：档案三组、Tab 切换、应用记录 20 行、行详情→应用抽屉 + Message

## 5. 已知偏差（设计取舍，非缺陷）
1. 新建一次性客群的「基本信息弹窗」改为菜单直达建群页（平台单事件仅一个动作，无法同时条件导航+开弹窗）；基本信息由建群页只读组承载。
2. 详情页未设独立「基本信息」Tab，档案信息以页面级三组 Descriptions 呈现，避免重复档案。
3. 详情页非 record 页（无 `:id` 路由参数），行操作「详情」为静态跳转，不携带记录上下文。
4. 演示数据为按需求的模拟数据（含 App 来源分布，用于验证上下文过滤）。

## 6. 验收缺口（需知悉）
1. **视觉保真未验证**：`.pen` 未做对照（用户本期决定不做；pen.dev 免费计划用量上限同时阻断了 Pen MCP）。界面依据 PRD §4 文字线框实现。
2. **90 条运行时用例未执行**（清单见 runtime-report.json 中 `unexecuted`）：详情页各 Tab 分页、建群页分页、
   两个查询表单 query/reset、全部行操作 permission/confirm/state-transition（后者需角色夹具）。
3. 键盘/焦点、跨页返回导航未专项验证。

## 7. 复现与续做
- 续做只需本目录：`suite.json` + `structure-expectation.json` + 三份 inventory + `intent-*.html` + `trace.jsonl`/manifest。
- 铁律（已多次踩坑）：① 模型任何改动会让旧 trace 全批失效，必须重采；② 重采前先删 `runtime-manifest.json`
  并整表清空 `assertLine`；③ 断言必须与计划 `checks` 逐字一致，否则判 invalid_evidence；
  ④ 分页断言用"行身份文本"而非 `role:row` 计数（页面内 Descriptions 也是 table，会污染计数）。
