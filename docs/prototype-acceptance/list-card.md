# 列表 Card 与生成规则验收

2026-10-05。项目 `2DdvqnozKTQgbqsQAu4c4X` 的「REQ075 客群列表」已将列表业务区域替换为 Antd6 Card；Card 替换阶段保存 revision **149**，重载后读取结果与修改后的模型完全一致。当前上下间距已进一步修正为 0，revision **150**，以 [间距验收](list-card-padding.md) 为准。

## 原因

这是生成规范、实现和验收共同遗漏，不是 Card 组件或 MCP 不支持。

- 桌面主 [Skill](../../skills/plasmic-prototype/SKILL.md) 的组件使用清单遗漏 Card，而旧浏览器版 [Skill](../../ai/skills/plasmic-prototype/SKILL.md) 已泛泛要求卡片使用 Antd6，两个入口的规则不一致。
- [Admin 规范](../../skills/plasmic-prototype/references/admin-design.md#card-ownership) 原来只描述卡片背景、边框、圆角和内边距，没有约束实际组件类型、children 所有权和验收方式。
- 本地任务生成器 [generate.cjs](../../desktop/desktop-report/req075-regeneration/generate.cjs) 的 `box()` 统一输出带卡片样式的原生 section，列表、SQL、详情和指标面板都使用该函数。原验收 `check.py` 检查布局、Table、ActionGroup、默认 Slot 等，没有检查 Card 类型；原 Slot 校验也没有检查同名组件的真实类型或 Card 内容归属。因此旧检查通过不代表使用了 Card。

## 当前实现与规则

列表结构为 `listCard (plasmicAntd6Card) → children → listContent → scopeTabs`。Table 仍属于相应 Tab 的 children，新建入口仍属于 Tabs 的右侧操作 Slot。Card 使用 medium / outlined，当前 styles.body 提供 `0 20px` 内边距；布局子容器仅提供 flex、gap、min-width。原生 listSection 已删除。

两个 Skill 入口已明确业务卡片使用注册的 `plasmic-antd6-card`；普通布局容器继续使用原生元素，SearchForm/AppShell 保留自身表面。详细规则涵盖列表、分组表单、详情面板和指标卡片，要求读取实际契约、把内容放进 children、避免重复背景和内边距，并检查保存后的结构。

任务生成器已用 Card 构建这些业务面板；删除原生卡片构建函数及其 padding 覆盖。生成器引用的已删除图标目录也改为当前项目已安装的独立注册图标。仅验证五类生成输出，没有重建或覆盖当前项目的其它页面。

[verify_slots.py](../../skills/plasmic-prototype/scripts/verify_slots.py) 增加同名组件身份、空 Card、Card 内容位于 Slot 外的检查；`--allow-defaults` 仅容许检查阶段的示例内容，不会容许结构错误。仓库规范和校验脚本已同步到 `/Users/yanxianliang/.codex/skills/plasmic-prototype/`。

## 验证

- [迁移检查](list-card/migration-checks.json)：scopeTabs 整个业务子树、状态和交互逐项一致，原生 section 已移除。
- [结构检查](list-card/structure-checks.json)：旧 section 模型被新规则拒绝；修改后与重开后均通过，无缺失、错误组件、空 Card、游离内容或示例 Slot。
- [模型验证](list-card/validation.json)：valid=true，无 errors/warnings。[保存](list-card/save.json) revision 149；重载后 [readback](list-card/reopened.json) 与修改后模型完全一致。
- `python3 skills/plasmic-prototype/scripts/test_verify_slots.py`：6/6 通过，包含原生替代、错误组件、空卡片加同级内容、错误 Slot 和意外示例等反例。
- `quick_validate.py`：仓库主 Skill、已安装副本、旧浏览器入口均通过。
- `node --check desktop/desktop-report/req075-regeneration/generate.cjs` 通过。[五类生成输出](list-card/generator-checks.json)：列表 1 个 Card，两类 SQL 各 3 个，两类详情各 9 个，没有原生 section 卡片。
- 实际 App 预览：全部客群 63 条；切换我负责的为 32 条；滚动后分页可达，下一页显示 1041、1043 等后续记录。验证后返回编辑器并重载项目。

## Card 替换阶段的视觉记录

[重开后的 1440×1024 列表截图](list-card/reopened.png) 确认为客群列表：搜索区与列表 Card 为两个独立白色表面，间距 16px；Tabs、新建入口和 Table 位于同一 Card，左右内边距 20px，无空 section 占位。该截图上内边距 16px 是后续用户指出的间距错误，已在 [间距验收](list-card-padding.md) 修正；不再作为当前间距的合格证据。固定操作列及既有列宽保持不变。20 行表格自然增长，截图下方内容需滚动 AppShell 业务区查看；实际预览已滚动到底部并验证分页，未引入 Table 内部垂直滚动。业务接口仍为原型模拟。
