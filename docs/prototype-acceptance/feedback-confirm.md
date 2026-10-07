# REQ075：操作反馈与行确认验收

2026-10-04。项目 `2DdvqnozKTQgbqsQAu4c4X` 的客群列表已重新生成；Page UUID、路由、其他四页保留。只更新本地 App 运行时和可编辑原型，未发布 NAS、npm 或组件库。

## 需求与规范结论

[原始需求](/Users/yanxianliang/overseas/pd-atlas/03_迭代需求交付/01_业务需求/REQ075_客群管理平台P0需求/1.需求/REQ_海外客群管理平台.md) 要求复制为初始化客群，没有要求页面顶部展示成功 Alert。[pen-antd-kit 浮层规范](/Users/yanxianliang/overseas/pen-antd-kit/pen-prototype-platform/standards/patterns/forms-overlays.md) 已规定简单单行删除、启停使用 Popconfirm；生成 skill 原先措辞不强制，验收缺少反馈类型和真实取消/确认检查。

已在 [admin-design.md](/Users/yanxianliang/shiguang/plasmic/ai/plasmic/references/admin-design.md#feedback-and-row-confirmation) 和 [reproducibility.md](/Users/yanxianliang/shiguang/plasmic/ai/plasmic/references/reproducibility.md) 固化：普通完成反馈使用自动消失的 Message；单行确认锚定操作列 Popconfirm；取消/点击区域外不修改数据；检查实际行、总数、提示消失及布局不偏移。与已安装 skill 三个修改文件逐字节一致，skill 校验通过。

SQL 预跑 Modal 由需求 §2.4/2.5/5.8 明确要求，保持。编辑表单和导出格式/审计表单仍是 Modal；简单行确认不再使用 Modal。

## 实现与模型证据

- Antd6 ConfigProvider 注册 `showMessage(type, content, duration)`，普通成功反馈设为 3 秒。
- ActionGroup item 增加 `confirm` 对象，使用 Antd Popconfirm；点击动作仅建立确认状态，确认后才调用业务事件。More 菜单先关闭，浮层锚点保持在该行。权限过滤、默认三个展示位置和路由逻辑保留。
- 删除列表顶部 `listFeedback` Alert、`rowConfirmation` Modal 及无用 `feedback` state。全部/我负责两个 Table 使用相同确认项；复制、编辑保存、导出及状态切换完成后使用 Message。
- 修复预览生成遗漏：自定义回调引用 `$globalActions` 时，也必须生成 `useGlobalActions` 绑定。仅有合法表达式、模型校验通过不足以证明提示实际出现。
- [保存模型](feedback-confirm/saved-model.json) 与 [重启后模型](feedback-confirm/reopened-model.json) 完全一致；最终再次回读一致。保存 revision 111。[全五页模型验证](feedback-confirm/validation.json) 无警告。

## 实际 App 交互

业务数据与导出仍是原型本地模拟，重新进入页面会复位。

| 用例                          | 实际结果                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------ |
| More 复制、直接复制、重复复制 | 初始化副本加入列表；总数 63→64→65；两种入口均出现“客群已复制为初始化状态”Message，之后自动消失。 |
| 取消删除                      | 浮层关闭，两条副本和 65 条总数保留。                                                             |
| 点击确认区域外                | 新一轮副本测试中，浮层关闭，副本和 64 条总数保留。                                               |
| 确认删除                      | 副本消失，64→63，无残留确认浮层。                                                                |
| More 停用                     | 单行 Popconfirm 确认后，1001 从启用变成停用，并显示 Message。                                    |
| 我负责的列表启用              | 32 条；确认后 1001 变成重新启用圈选中，数量仍为 32，出现 Message。                               |
| 导出表单完成                  | 表单关闭后仍能看见“脱敏名单已生成，审计记录已写入。”Message。                                    |
| 只读访客                      | 只显示详情；编辑、复制、More 均不存在。随后恢复管理员。                                          |

控制会话曾返回界面变化和 native pipe 错误；重建会话后继续读取实际结果，上述取消/区域外/删除/停用/启用均已完成验证，未以点击尝试代替验收结果。

## 截图分析

[完整列表](feedback-confirm/list.png) 是 1440×1024 静态画板。其余是实际 App 预览的 workspace 截图，3200×1936 屏幕像素，预览配置 1440×848；不能把两者尺寸混为一谈。

| 证据                                                     | 检查区域与结论                                                                                                                                                                 |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [预览基线](feedback-confirm/preview-baseline.png)        | 没有页顶成功 Alert；筛选、Tabs、表头及操作列完整。                                                                                                                             |
| 本次工具返回的复制成功实时截图                           | Message 悬浮在预览顶部中央，有成功图标和完整中文；不占据列表布局。3 秒反馈的出现由实时截图与可访问文本共同验证。                                                               |
| [提示消失后](feedback-confirm/preview-after-message.png) | 两条副本可见，Message 已消失。此文件不是 Message 出现时的截图。                                                                                                                |
| [删除确认](feedback-confirm/preview-confirm.png)         | More 菜单已关闭；浮层箭头指向副本行操作组；客群名称与删除后果完整；取消、红色删除按钮可见，没有整页灰色遮罩或居中 Modal。                                                      |
| [像素区域比较](feedback-confirm/preview-geometry.json)   | 复制前/重复复制提示消失后，筛选区域 `(680,360)..(2990,486)`、表头区域 `(712,655)..(2965,763)` 的像素变化均为 0。比较仅覆盖这两个已明确区域，未声称数据行/实时钟/整页像素相同。 |

## 命令验证

- Overseas 原有 ActionGroup Node 测试：5/5；`tsc --noEmit` 通过。
- `vitest run tests/action-group-confirm.test.tsx --environment jsdom`：4/4，覆盖直接确认/取消、More 确认、待确认期间禁用、区域外关闭。jsdom 不完成 CSS 动画，区域外用关闭动画开始状态验证 open 已关闭；最终消失另外在 App 实测。
- WAB `vitest run src/wab/shared/core/components.test.ts`：14/14，含自定义全局动作回调、字符串/局部变量反例。
- Antd6 注册测试：13/13；相关 Rollup、声明、Canvas、Host 和 WAB 构建通过；App 打包并实际重启。
- Skill `quick_validate.py`：通过。

这是针对本次反馈和确认的补充验收。此前五页两轮生成结果是历史证据，不能作为新交互规则已执行两轮的证据。本次完成受影响列表重生成及上述交互验证，未重新执行全五页两轮稳定性测试。
