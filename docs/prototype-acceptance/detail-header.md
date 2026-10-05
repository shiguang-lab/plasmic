# REQ075 详情 Header 验收

2026-10-04。本地 App 保存 revision **170**，常规详情 `ayKXc8e7JTsP`、一次性详情 `N5dvwSUWcJMa`。未发布 NAS。

此前流程有模型校验、交互检查和页面截图，但没有记录详情 Header 各区域的视觉分析，漏掉了返回符号、层级和状态颜色问题。生成截图不能代替查看截图并给出结论；本次重新检查并修正两页 Header。

依据为 REQ075 §6.4 只读详情，以及 `pen-antd-kit/pen-prototype-platform/standards/patterns/admin-app-shell.md` 和 `quality/review-checklist.md`。本次没有重新读取原 `.pen` 设计，结论限于需求、规范和实际 App 渲染；不是与原设计逐像素比对。

## 完整页面截图与分析

保存后退出并重开 App，再逐页截取 **1440×1024** 画板。使用业务节点 `dgUK37AYLAfJ`、`A0D4Pp5S9Rkx` 分别指定目标，并核对页面面包屑、客群名称和布局中的节点 UUID。相同画板宽度不作为页面身份依据。

- [常规详情，重开后的完整页面](../../desktop/desktop-report/req075-pc/header-regular-reopened-0.png)：面包屑为常规客群详情，名称为墨西哥授信用户促活。
- [一次性详情，重开后的完整页面](../../desktop/desktop-report/req075-pc/header-onetime-reopened-0.png)：面包屑为一次性客群详情，名称为到期用户召回。

| 区域        | 原问题                                     | 本次截图观察与布局证据                                                                                      | 结论                 |
| ----------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | -------------------- |
| 全局 Header | 需确认问题是否影响壳层                     | 两页面包屑均为产品 → 客群列表 → 当前详情；顶栏、侧栏和内容边界完整，画板与实际文档高度均为 1024px           | 本次默认视口通过     |
| 返回列表    | 使用文字 `‹` 充当图标，与标题混排          | Antd6 Button 的 icon 槽使用独立 ArrowLeft SVG；图标 16×16，按钮 110×24，单独一行；按钮与标题均从 x=276 开始 | 通过                 |
| 标题与层级  | 返回、名称、类型与状态挤在同一行           | 返回行 y=97，高 24；标题行 y=133，高 28，标题 20px/600；两行及下方元信息之间均有清楚间隔                    | 通过                 |
| 类型与状态  | 缺少长名称下的稳定空间；初始化错误继承绿色 | 类型与状态不收缩，名称剩余空间允许换行。默认启用为绿色；真实初始化状态在 Header 和概览均为灰色点            | 默认及初始化样例通过 |
| 元信息      | 四项混在一行，可读性弱                     | 两列网格显示 ID/负责人、App 来源/保留策略；行距 8px、列距 24px，元信息从 y=173 开始，高 52px                | 通过                 |
| 整体边界    | 缺少分区边界验收结论                       | 两页摘要卡均为 (255,80)，1169×162；返回、标题、类型、状态和元信息均在卡内；Tab 位于摘要下方，无相互覆盖     | 通过                 |

以上是截图观察与布局测量结论，模型校验单独记录在下文。

## 实际预览交互与状态

通过本地 App 原生 UI 操作实际预览，没有用脚本替代点击：

- 两类详情的“返回客群列表”均实际点击并进入列表，确认列表标题和客群行显示。[常规返回后的列表](../../desktop/desktop-report/req075-pc/header-regular-returned-list-clean-0.png)。
- 从列表进入初始化的一次性客群，检查 Header 和概览的灰色 7px 状态点、成员数 0 和未完成圈选信息。[初始化状态截图](../../desktop/desktop-report/req075-pc/header-onetime-initialization-clean-0.png)。
- 从列表编辑弹窗输入长名称，再进入常规详情。标题实际换为两行（56px），类型、状态和返回入口完整；状态仍位于 (1356,136)，未与名称重叠。[长名称截图](../../desktop/desktop-report/req075-pc/header-regular-long-name-0.png)。这只修改了运行预览的演示数据，返回后原样例名称已恢复，保存模型未改变。

运行截图包含 App 预览工具栏；业务布局宽度为 1440px，预览可见高度为 848px。它们验证真实状态和点击，默认完整页截图另用 1440×1024 画板。

## 保存与模型校验

`header-save.json` 确认 saved=true、revision=170。重启 App 并重新打开项目后，两页读取模型与保存后模型完全一致。重开后的 `validate` 返回 valid=true，错误 0、警告 0；2 个页面，78 个代码组件实例，其中 Ant Design 6 为 76。

本机证据位于 `desktop/desktop-report/req075-pc/`（忽略的产物）：

- `header-before-models.json`、`header-after-models.json`、`header-reopened-models.json`：改前、改后及重开模型。
- `header-regular-reopened-layout.json`、`header-onetime-reopened-layout.json`：目标身份、实际尺寸和元素边界。
- `header-reopened-validation.json`、`header-acceptance-checks.json`：模型校验和实际布局断言，均通过。
- `transcript.jsonl`：脱敏调用记录，包含失败尝试及修正。失败导入产生的错误提示已关闭，验收采用干净截图。

仓库与本机 `plasmic-prototype` skill 已补充详情 Header 检查，以及“页面身份、视口、检查区域、具体观察和通过/失败结论”的必填证据要求；两份 skill 的 `quick_validate.py` 均通过。本次不重复此前的完整业务回归，不代表业务后端已经上线。
