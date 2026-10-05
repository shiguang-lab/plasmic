# REQ075 列宽与内容验收

2026-10-04，项目 `b1VPmGnbGvyKc4rnA2xLVv` 的客群列表 `Ne1KXZPJ2Up_`，本地 App 保存 revision **168**。本次未发布 NAS。

依据 pen-antd-kit standards **11.0.1** 的 `patterns/table-columns.md` 和 `quality/review-checklist.md`。源规范目录：`/Users/yanxianliang/overseas/pen-antd-kit/pen-prototype-platform/standards/`。保留本项目约定的 **1440×1024** Desktop；源规范中的 1920px 列宽范围作为内容构图起点。

## 逐列配置

当前访问者为管理员。以原有 63 条演示记录检查字段边界；全部客群和我负责的使用相同列定义。Table 为 large，单元格左右留白各 16px。

| 字段     | 实际列宽 px | 内容依据及显示策略                                                                                                                  |
| -------- | ----------: | ----------------------------------------------------------------------------------------------------------------------------------- |
| 客群 ID  |          96 | 四位 ID 与标题完整显示；保留左侧固定，关闭省略                                                                                      |
| 客群 Key |         280 | 长 Key 保留可辨认前缀；单行省略，title 保留原始完整 Key，详情参数也保留完整值                                                       |
| 名称     |      264 起 | 最长样本“高额度用户精细化经营 · 第 10 期”文字约 230.04px，加留白约 262.04px；不指定 width，由此列承接剩余空间，保留长名称的省略能力 |
| 类型     |          96 | 最长“一次性”48px，加留白 80px；完整显示，关闭省略                                                                                   |
| 场景     |          96 | 客经、贷后、风险、获客、公共均完整显示，关闭省略                                                                                    |
| 状态     |         176 | 最长“重新启用圈选失败”文字 128px，Badge 含状态点及间距为 143px，加留白共 175px；完整显示，关闭省略                                  |
| 更新时间 |         180 | 实际格式 `2026-10-03 10:25:00` 约 146.45px，加留白约 178.45px；保留秒数，关闭省略                                                   |
| 负责人   |         144 | 最长“经营 OS 管理员”约 108.45px，加留白约 140.45px；完整值可达，保留长人员名的省略能力                                              |
| 操作     |         162 | ActionGroup 最宽“详情 / 编辑 / 更多”为 130px，加留白 32px，向上取整为 162px；保留右侧固定，max 统一为 3                             |

基础列宽总和与 `scroll.x` 均为 **1494px**。默认 Table 容器实际宽 **1127px**，保留列宽并横向滚动。名称是唯一未指定 width 的列，其他列宽固定。

## 实测与验收

- [x] 全部客群的 9 个表头及单元格实际宽度与上表一致；操作列实际为 162px，没有同比拉宽。
- [x] 我负责的真实 App 预览使用同一组宽度，操作仍为 ActionGroup；业务状态、数据与交互保持。
- [x] 横向滚动至末端后，最长状态、完整日期时间及负责人可见；左侧 ID 和右侧操作保持固定，边界阴影可辨认。
- [x] App 交互过程中可见横向滚动条，轨道覆盖固定列下方区域；分页仍可见且可操作。
- [x] 长 Key 的 title 与原始值一致。完整值检查使用当前 Table 的原生 title 及详情参数；没有把截断后的显示文本当作原始值。
- [x] 导出同一张表的全列参考图，容器宽度 1494px，保留当前页 20 条记录，覆盖两种类型、五个场景、全部七种状态及相应操作组合。仅放开参考图表体高度；App 页面仍保持固定视口和内部滚动。
- [x] 在导出的静态表体容器中增加可用空间至 1920px，名称列从 264px 增至 690px，其他八列宽度不变。该检查测量表体；正式 App 的表头、表体一致性按 1440px 实际预览复核。
- [x] 正常退出并重启 App、重开项目后，完整页面模型与保存结果一致；重新量测列宽一致，validate 无错误、无警告。

## 证据与流程

本机证据目录：`desktop/desktop-report/req075-pc/`。

- `table-width-before.json`、`table-width-after.json`、`table-width-reopened-model.json`：修改及持久化核对。
- `table-width-before-layout.json`、`table-width-after-layout.json`、`table-width-reopened-layout.json`：实际列宽、ActionGroup 与 Badge 宽度。
- `table-width-runtime-right-layout.json`、`table-width-runtime-right-visual-0.png`：App 实际横向滚动末端，完整状态和时间、固定操作列。
- `table-width-runtime-mine-layout.json`、`table-width-runtime-mine-visual-0.png`：我负责的实际预览。
- `table-width-full-view-metrics.json`、`table-width-full-view-screenshot-1.png`：1494px 全列参考图及 20 条记录。
- `table-width-room-allocation-metrics.json`：静态表体剩余空间分配检查。
- `table-width-plan.json`、`table-width-acceptance-checks.json`、`transcript.jsonl`：依据、数值、自动核对和脱敏 MCP 记录。

仓库与本机安装的 Plasmic 原型技能已补充逐列样本、操作内容量测、剩余空间分配、溢出及保存重开检查；两处 skill 校验通过。
