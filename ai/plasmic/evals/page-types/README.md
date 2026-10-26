# 页面类型回归

每种页面类型一份中性需求，用来检查规范在设计阶段能不能让 AI 做出确定的决策，而不是只靠某一个真实需求回归。需求与 `references/design/page-types.md` 的十种类型一一对应。

## 用例

| 用例 | 需求 | 主要检查 |
| --- | --- | --- |
| `list` | [供应商列表](requirements/list.md) | SearchForm 四列；列表卡片 title+extra；Table large；ActionGroup；状态 Badge |
| `tabbed-list` | [工单列表](requirements/tabbed-list.md) | 无卡头的 Tabs 卡片、`0 20px` 内边距；每个 Tab 一张表 |
| `catalog-workspace` | [商品类目工作台](requirements/catalog-workspace.md) | Row 分栏，目录用 Tree 或 Menu |
| `basic-form` | [新建优惠券](requirements/basic-form.md) | 线框逐项清点；横向三列；一个整行字段；测得的标签宽度；无卡头 |
| `grouped-form` | [编辑员工档案](requirements/grouped-form.md) | 三张分组卡片（title，distinguish）；一个 Form、三个字段 Row |
| `step-form` | [创建合同](requirements/step-form.md) | Steps 不放进 Card；确认步骤用 Descriptions；上传字段 |
| `basic-detail` | [供应商详情](requirements/basic-detail.md) | 三组 Descriptions、三列；关联表格；无表单和查询 |
| `tabbed-detail` | [工单详情](requirements/tabbed-detail.md) | 摘要 Descriptions；Tabs 内三张表 |
| `overview` | [运营概览](requirements/overview.md) | 四个 Statistic；两张表；不用 Descriptions 承载指标 |
| `result` | [批量导入结果](requirements/result.md) | 单个 Result 放在一张无卡头 Card 中；无表格和表单 |

## 运行

1. 每个用例在全新上下文中运行，只提供需求文件和当前 skill。要求完成到编排前：页面计划（`structure-expectation.json`）和字段清单通过 `verify_selection.py`，规则卡已读。
2. 检查计划里的设计决策：

```sh
python3 ai/plasmic/evals/page-types/check_plan.py basic-form /run/structure-expectation.json --forms /run/forms.json
```

3. 继续生成并保存后，再用 `verify_all.py` 和真实 Preview 按常规验收。

`verify_selection.py` 验证页面类型并提供对应布局规则；类型不限制必需/禁止组件数量，需求决定页面实际内容。`check_plan.py` 在此之上评估设计阶段的决定：页面类型、线框清点、组件身份和数量、已决定的属性和卡头、归属关系、表单布局清单。它不评估需求理解是否完整，也不代替保存后的模型、像素和交互检查。期望值来自规范；规范调整默认值时，同步修改 `expected.json`，不要为了让某次运行通过而改期望。

`python3 -m unittest test_check_plan`（在本目录下）检查用例和评分器本身。
