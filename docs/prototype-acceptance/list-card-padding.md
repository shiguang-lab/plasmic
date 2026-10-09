# Tabs 列表 Card 上下间距验收

2026-10-05。「REQ075 客群列表」的 listCard body padding 已设为 `0 20px`；保存 revision **150**，重载后模型与保存前完全一致。只修改 Card 的 body padding；Tabs、Table、状态、交互及业务节点未改动。

## 原因与规范

上次 Card 替换把普通信息卡片的 `16px 20px` 错误地应用到了 Tabs 列表，并移除了原生成源的上下 0 覆盖。现有 admin-design 已有“Tabs 自带顶部间距时移除外层顶部 padding”的规则，这次没有遵循它。

来源 [Tabs 规范](/Users/yanxianliang/overseas/pen-antd-kit/pen-prototype-platform/standards/patterns/tabs.md:18) 要求顶部只保留组件自身间距，并在 Card、包装层和 Tabs 各层检查位置；[Table 规范](/Users/yanxianliang/overseas/pen-antd-kit/pen-prototype-platform/standards/patterns/table-data.md:27) 要求分页底部留白由 Table 单独承担，外层不再叠加。问题是迁移时忽略组合规则，随后补写的通用 Card 默认值又没有明确组合规则优先级。

[Card 规范](../../ai/plasmic/references/design/layout.md#card-ownership)、两个 Skill 入口及重生成规范现在明确：Tabs-first / Table-last 卡片在组件已承担对应间距时使用 body padding `0 20px`，所有中间包装层不加垂直 padding、margin 或位置偏移；普通信息、表单、指标卡片保留自身的 `16px 20px`。不能通过修改 Tabs 内部标签 padding 或分页 margin 抵消外层错误。

任务生成器已给列表和详情 Tabs 卡片显式配置 `0 20px`，其余信息卡片保持 `16px 20px`。Slot 校验增加 planned Card body padding 的比对；保存后仍必须做实际几何检查。相关规范及校验脚本已同步到已安装的 plasmic-prototype 技能。

## 验证

- [模型验证](list-card-padding/validation.json)：无 errors/warnings；[保存](list-card-padding/save.json) revision 150；重载后 readback 完全一致。
- [保存后的几何](list-card-padding/geometry-checks.json)：body → 包装层 → Tabs 顶部偏移均为 0；Tabs 底边与 body 底边相同；分页底边距 body 底边 16px；左右内边距均为 20px；总 Card 高度由 1519px 减为 1487px，减少 32px。外层 1px 边框不计入内边距。
- [结构校验](list-card-padding/structure-checks.json)：旧 `16px 20px` 被拒绝，重开后的 `0 20px` 通过。
- `test_verify_slots.py`：8/8 通过，新增 Tabs 卡片误用信息卡片 padding 的反例及普通信息卡片保留 padding 的正例。
- [生成源检查](list-card-padding/generator-checks.json)：五类页面共 25 个 Card，3 个 Tabs 卡片上下为 0，22 个信息卡片保留 16px；`node --check` 通过。没有重建其它业务页面。
- 仓库主 Skill、已安装副本和旧浏览器入口的 quick_validate 均通过。

[重开后的 1440×1024 截图](list-card-padding/reopened.png) 确认为客群列表：查询区与 Card 的 16px 块间距保持，Tabs 标签栏紧随 Card 内部上边缘，没有第二层顶部留白；表格左右仍对齐 Card 的 20px 内边距。完整分页在视口下方随 AppShell 内容滚动；底部间距用实际布局测量，不从未显示分页的顶部截图推断。
