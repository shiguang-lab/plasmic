# REQ075 表格自然高度与内容区滚动

2026-10-04，本地 App 项目 `2DdvqnozKTQgbqsQAu4c4X`，保存 revision **113**。本次仅修改原型属性、生成源与 skill，没有发布 NAS。

## 当前布局契约

5 个页面内的 11 张 Table 均无 `scroll.y`：列表 All/Mine 两张保留 `scroll.x=1494`；两张 SQL 预跑样本表和七张详情表的 scroll 为 undefined。Table 按行数自然展开，分页随表格排布。

Page root 使用 `height/maxHeight:100vh; minHeight:0`，AppShell 高度为 100%，纵向滚动由 AppShell 内容区域承担。实际预览为 1440×848，Shell Header 位于 y=0、高64，内容区域位于 y=64、高784，文档 contentHeight=848。编辑视口和概览 artboard 仍为 Desktop 1440×1024。

预跑 Modal 的 children 内容容器使用 `max-height:calc(100vh - 240px); overflow-y:auto`，表格本身自然高度；弹窗标题、关闭和返回 SQL 编辑位于滚动内容之外。

## 已执行验收

| 状态                 | 实际观察                                                                                      | 证据                                                                                      | 结果 |
| -------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---- |
| 保存重开后的默认列表 | 折叠查询、标签、表头和第一批记录正常；导航、选中侧栏及蓝色行操作样式完整                      | [默认列表](table-content-scroll/reopened-top.png)                                         | 通过 |
| 每页20条，全部客群   | 整张表高度1357px；内容区到底可见1020及分页，Header保持y=0                                     | [20条底部](table-content-scroll/list20-bottom.png)                                        | 通过 |
| 每页50条，全部客群   | 表高3307px，底部1050、总63条、两页及50/page可见                                               | [50条底部](table-content-scroll/list50-bottom.png)                                        | 通过 |
| 每页100条，全部客群  | 当前63条一次显示，表高4152px；底部1063及分页可见，Header仍固定                                | [100条底部](table-content-scroll/list100-bottom.png)                                      | 通过 |
| 展开查询，我负责的   | 状态/关键词和查询操作正常，Table在Tabs内容中自然排列；列宽与All相同                           | [展开查询](table-content-scroll/mine-expanded-top.png)                                    | 通过 |
| 我负责的第二页       | 真实点击下一页，显示1041起的12条记录，总32条；底部1063、第二页及分页控件可达                  | [第二页底部](table-content-scroll/mine-page2-bottom.png)                                  | 通过 |
| 常规详情成员页签     | 20行自然展开；向下滚动同时移走详情摘要/页签/表头，Shell Header和侧栏留在原位；617页的分页可达 | [成员底部](table-content-scroll/members-bottom.png)                                       | 通过 |
| 常规详情圈选记录     | 两条记录后紧接分页，不保留540px固定空白表体                                                   | [短记录表](table-content-scroll/short-records.png)                                        | 通过 |
| SQL预跑弹窗          | 实际校验并提交预跑；内容顶端含成功信息与表头，滚到底可见第20条及分页，标题和返回按钮保持可见  | [顶部](table-content-scroll/modal-top.png)、[底部](table-content-scroll/modal-bottom.png) | 通过 |
| 模型完整性与持久化   | validate无错误/警告；正常退出并重启App、重新打开项目后，5个Page完整模型与保存结果逐项完全一致 | 本机scroll-final-model.json、scroll-reopened-model.json                                   | 通过 |

11份布局快照的断言结果见 [layout-checks.json](table-content-scroll/layout-checks.json)。所有快照均不存在 `ant-table-body`，Shell边界均符合上述848px预览；已采集的底部分页均处于内容区可见边界内。

所有列节点及props、页面state/interactions均保持原值。实测All/Mine列宽依次为 **96、280、264、96、96、176、180、144、162px**；操作列162px、右侧固定，表格总宽1494px。本次验证了横向配置和固定列几何；原生自动化横向滚轮/拖动未产生可观测横移，因此未将“横向滚动至末端”标为本次通过项。

## 生成与规则校验

更新 `skills/plasmic-prototype/SKILL.md`、`references/admin-design.md`、`references/reproducibility.md`，同步到本机已安装skill：默认自然表高，内容区为纵向滚动主体，只有明确需求才允许表体限高。验收包含长表、短表、分页、查询展开、scope和真实较矮预览。

本机生成源 `desktop/desktop-report/req075-regeneration/generate.cjs` 同步删除列表/详情/样本表的高度配置，更新Page/Shell与Modal内容布局；plan记录当前滚动契约。当前页面通过公共MCP就地修改，保留业务UUID。

实际运行：生成器 `node --check` 通过，skill `quick_validate.py` 通过，3个skill文件的已安装副本 `cmp` 一致，skill `git diff --check` 通过。修改/读取/截图/布局/保存/重开记录保存在本机 `desktop/desktop-report/req075-regeneration/scroll-*` 和 `transcript.jsonl`。
