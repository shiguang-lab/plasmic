# REQ075 P0：Skill 重生成验收

当前操作反馈和单行确认已按 [补充验收](feedback-confirm.md) 更新。下述两轮结果属于更新前的生成版本；列表截图、行确认方式和成功反馈结论以补充验收为准。

2026-10-04。已通过 `plasmic-prototype` 从空白重新生成 5 个可编辑 PC Page，保留原型的 AppShell、SearchForm、ActionGroup 和详情 Header 效果。最终相同输入连续执行两轮，各通过 71 项自动检查；两轮均真实退出、启动 App 并重新读取模型、检查截图。

交付项目：**REQ075 客群管理 · Skill 重生成**，ID `2DdvqnozKTQgbqsQAu4c4X`。App 已打开 `REQ075 · Desktop` 总览，只有一个总览、5 个 1440×1024 Page，无移动端画板和断点。旧项目 `b1VPmGnbGvyKc4rnA2xLVv` 保留。此次只验证本地 App，未发布 NAS 软件。

## 来源与范围

业务来源是 [REQ075 当前需求](/Users/yanxianliang/overseas/pd-atlas/03_迭代需求交付/01_业务需求/REQ075_客群管理平台P0需求/1.需求/REQ_海外客群管理平台.md)，设计来源是通过 Pen MCP 读取的 [原始 Pen](/Users/yanxianliang/overseas/pd-atlas/03_迭代需求交付/01_业务需求/REQ075_客群管理平台P0需求/1.需求/海外客群管理平台.pen)，不是复制旧原型模型。Pen 中过时的 AI、核验、观察和版本功能按当前 P0 需求排除。表格规范参考 [pen-antd-kit](/Users/yanxianliang/overseas/pen-antd-kit/pen-prototype-platform/standards/patterns/table-columns.md)。

业务数据、SQL 执行、名单导出与状态切换是本地交互模拟，未接入业务 API。演示数据修改会在重新进入页面后复位；保存与重启验证针对可编辑设计模型。`@react/ui` 继续使用本地复制的依赖，只注册 ActionGroup；正式私有 npm 安装和 NAS 验证待源可用后执行。

## 已固化到 Skill 的规则

- [Skill](/Users/yanxianliang/shiguang/plasmic/skills/plasmic-prototype/SKILL.md) 与用户已安装副本同步。生成必须读取实时组件契约，用原生可编辑节点、真实 Slot、State 和 Interaction；页面跳转使用组件 `href`。
- [布局规范](/Users/yanxianliang/shiguang/plasmic/skills/plasmic-prototype/references/admin-design.md) 明确表格列宽、操作列及详情 Header 验收。ActionGroup `max=3` 包含“更多”，多余操作进入菜单；有权限差异时不填充无效按钮。详情返回独占一行、16px SVG，标题 20/600/28，可换行，类型与状态独立，元数据两列。
- [重生成规范](/Users/yanxianliang/shiguang/plasmic/skills/plasmic-prototype/references/reproducibility.md) 要求页面创建后设置视口、清理组件示例 Slot、核查 Unicode、分别记录模型/布局/截图/真实交互/持久化证据。失败须补规则、修生成源后清空重跑；稳定性要求第二轮相同输入生成。
- [Slot 校验](/Users/yanxianliang/shiguang/plasmic/skills/plasmic-prototype/scripts/verify_slots.py) 检测缺失组件和意外示例内容；[模型比较](/Users/yanxianliang/shiguang/plasmic/skills/plasmic-prototype/scripts/compare_models.py) 归一化生成 ID，保留业务 props、状态和交互进行比较。

同时修复 [Desktop RPC](/Users/yanxianliang/shiguang/plasmic/desktop/src/local-rpc.cjs) 的 UTF-8 分片解码根因：socket 使用流式 UTF-8 解码，避免中文恰好跨包时损坏。新增请求、响应两方向分片回归测试；App 已重新打包并实际重启验证。

## 两轮复现证据

| 验证                       | 第一最终轮                | 第二最终轮                  |
| -------------------------- | ------------------------- | --------------------------- |
| 从空白生成                 | 5 Page、1 总览            | 5 Page、1 总览，重新生成 ID |
| 自动检查                   | 71/71                     | 71/71                       |
| 模型验证                   | 0 警告                    | 0 警告                      |
| 真实进程重启后 public read | 5 页完全相等，revision 98 | 5 页完全相等，revision 107  |
| 重启后完整截图人工分析     | 5/5                       | 5/5                         |

两轮生成器 SHA256 为 `91c6d90beafe89d1ce2769ef4495330f74a273f9536547d7d889eefa862d7fda`，Skill、需求、运行时代码哈希相同。归一化模型 5/5 一致；除了顶部实时钟及其直接容器因数字字宽改变，全部测量节点相同。4 页业务区域逐像素一致；列表仅两个 processing Badge 动画相位不同，共 204 像素，位置分别为 `(1120..1134,486..500)`、`(1120..1134,681..695)`。限定这两个已确认动画区域后，5 页静态业务区域全部一致；没有声称原始全屏截图完全相同。

证据：[第一轮检查](/Users/yanxianliang/shiguang/plasmic/docs/prototype-acceptance/req075-regeneration/first-checks.json)、[第二轮检查](/Users/yanxianliang/shiguang/plasmic/docs/prototype-acceptance/req075-regeneration/second-checks.json)、[模型比较](/Users/yanxianliang/shiguang/plasmic/docs/prototype-acceptance/req075-regeneration/model-comparison.json)、[布局与像素比较](/Users/yanxianliang/shiguang/plasmic/docs/prototype-acceptance/req075-regeneration/output-comparison.json)、[验收矩阵](/Users/yanxianliang/shiguang/plasmic/docs/prototype-acceptance/req075-regeneration/acceptance-matrix.json)。原始 MCP 调用与失败轮保留在本地 `desktop/desktop-report/req075-regeneration/`，失败轮不计入上述两轮通过结果。

## 截图分析

下表截图均是第二轮重启后按业务节点指定的完整 1440×1024 画板；App 实际预览的窗口视口为 1440×848，可滚动。工作区截图包含编辑器外框，不作为 1440×1024 画板证据。

| 页面截图                                                                                                           | 检查区域与观察结论                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [客群列表](/Users/yanxianliang/shiguang/plasmic/docs/prototype-acceptance/req075-regeneration/list.png)            | Shell 与菜单完整；SearchForm 四列对齐；Tabs 和新建操作同一栏；每行最多三个直接入口；操作列固定右侧；页码、总数和 page size 均在画板内。宽表内部横向滚动查看更新时间/负责人，不能把固定列遮住的部分当成缺失列。 |
| [常规 SQL 建群](/Users/yanxianliang/shiguang/plasmic/docs/prototype-acceptance/req075-regeneration/regular.png)    | 基础信息三列、两行；截止时间显示秒；SQL 区、规则提示及底部操作完整；提交/保存/上线在未通过门禁时置灰。                                                                                                         |
| [一次性 SQL 建群](/Users/yanxianliang/shiguang/plasmic/docs/prototype-acceptance/req075-regeneration/onetime.png)  | 信息与来源清晰，类型锁定；有效期默认14；SQL 区与底部操作可见，无超出画板的操作。                                                                                                                               |
| [常规详情](/Users/yanxianliang/shiguang/plasmic/docs/prototype-acceptance/req075-regeneration/regularDetail.png)   | 返回箭头与文字独占一行；标题、类型、状态互不挤压；元数据两列；默认概览、6 Tabs；概览卡片和查看 SQL 完整，无编辑控件混入只读详情。                                                                              |
| [一次性详情](/Users/yanxianliang/shiguang/plasmic/docs/prototype-acceptance/req075-regeneration/onetimeDetail.png) | 同一 Header 规范；默认概览、5 Tabs；“有效期至”中文完整；固定快照语义和14天有效期一致。                                                                                                                         |

长标题另见 [80字 Header 实际预览](/Users/yanxianliang/shiguang/plasmic/docs/prototype-acceptance/req075-regeneration/ui-long-header-0.png)：两行自然换行，返回行独立，类型/状态仍可见，元数据未重叠。预跑 [处理中截图](/Users/yanxianliang/shiguang/plasmic/docs/prototype-acceptance/req075-regeneration/second-ui-preflight-processing-0.png) 在完成前捕获，标题、Spin 和遮罩可见；成功状态另见 [Top100 截图](/Users/yanxianliang/shiguang/plasmic/docs/prototype-acceptance/req075-regeneration/ui-preflight-success-0.png)。

## 实际交互验证

第二轮执行了搜索草稿收起/展开保留、完整 Key 查询1条、重置、全部63/我负责32；复制新增记录后64条，删除后63条且副本消失；管理员停用后实际行状态变更；导出弹窗关闭后完成反馈仍存在。第一最终轮还执行复制→修改名称→删除，验证更新的是实际集合。

第二轮 SQL 页面切为只读访客后，编辑、格式化、校验、提交、保存、上线均禁用；管理员校验→提交→预跑成功→保存，成功样本包含 SQL 全列且敏感值脱敏。第二轮一次性新建为空名称、重复 Key 均禁用继续；唯一 Key 将名称/负责人/场景带入 SQL 页；默认14天，输入366失焦后归为365。详情返回真实导航、基本信息只读，成员展示脱敏值和617页分页，对应12,340条完整成员而非Top100。

SQL 校验失败、预跑失败、上线圈选中、初始化/待处理成员0与空历史、三角色列表菜单、SQL 查看弹窗等分支在诊断轮实际执行，最终两轮对应模型契约一致；验收矩阵分别标明实际操作所在轮次，未把每个诊断分支写成最终两轮均重测。

表格渲染仍可编辑：选择 Table 下对应 Column，调整 width/title；单元格内容在该 Column 的 `children` 渲染 Slot 中修改，表达式使用注册的渲染参数。操作列保留 ActionGroup，调整 items/条件，不在每行拼接四个独立按钮。全部/我负责两个 Table 的列配置须同步，修改后重新跑列宽与截图验收。

## 命令验证与限制

- `node --test desktop/tests/local-rpc.test.cjs`：3/3 通过，含中文分片请求、响应回归。
- `node desktop/scripts/package.mjs darwin arm64`：成功；使用产物进行上述 App 验收。
- Skill `quick_validate.py`：仓库与已安装副本均通过；五个相关文件逐字节一致。模型比较脚本的 ID 重排正例、状态/交互变化反例均验证。
- `npm test --prefix desktop`：50通过、1失败。失败为 `vector.test.cjs` 中 Paper 依赖原生 Canvas，当前 Node 环境不提供 `HTMLCanvasElement` 的2D context；未修改无关矢量实现或弱化测试。

本次结论是当前固定输入在两轮清洁生成中可重复通过上述验收。正式业务连接、私有 npm 安装和 NAS 发布不属于已通过范围。
