# REQ075 修复候选与回归状态 — 2026-10-20

代码、Skill references 和验收脚本已同步修改，登录已恢复。首轮候选在接口探索阶段反复失败，已主动中止并修正查询语义；第二轮正在新的隔离会话按原五行提示词执行。**尚未完成的新链路不记为业务通过。**

## 修复清单

| 优先级 | 问题 | 当前实现与验证 |
| --- | --- | --- |
| P0 | 默认页面使用自定义尺寸并附带移动设备列 | MCP createComponent 的 Page 默认选择原生 Desktop 预设，只创建一个设备列；preset 可显式选择其他设备。新建页事务测试确认 1440×1024；不修改其他已有页面的设备列。 |
| P0 | 总览画板组为空或遗漏页面 | 创建 Page 同事务复用页面总览机制，添加原 Page 引用；优先复用空 Arena，已有位置保留，更新视口时同步总览尺寸。原生测试覆盖多页身份、单总览与失败回滚；已有原生持久化测试保留。 |
| P0 | 隐藏 Form.Item 被判通过 | Form.Item inventory 要求有效 advanced mode。默认 simplified / 显式 simplified 即使含完整 children 也失败；reference 说明真实字段来源。此 gate 的适用范围是高级模式原生字段，简化模式需按实际 schema/运行时检查。 |
| P0 | 验收豁免、缺失覆盖与整体通过混淆 | 增加 page_layout gate；全项目 Slots、Descriptions、overlays 要覆盖所有 Pages。实际存在受支持组件时拒绝相关 N/A。报告显式保留 acceptance.status=unverified 和未覆盖维度；自动化通过仍需独立 Preview/持久化。 |
| P0 | 表格缺数据、业务动作无绑定仍被接受 | structure gate 拒绝未绑定 data 的 Antd6 Table；源需求 Page inventory 可指定 bindings 的目标、必需 Props/Events 和来源。检查绑定存在性；表达式语义、角色隔离和真实操作结果仍由 Preview 验证。 |
| P1 | 导入项目仍嵌套大资源清单 | 非 full 读取返回依赖身份、版本、计数；read 增加 fromProject / nameContains，配合集合分页发现资源；完整读取保留。fromProject 可与组件/元素目标并用以校验归属；集合支持fields与contract视图，先分页再展开。原生测试验证大小、范围和契约。 |
| P1 | schema 重复、输出契约占用上下文 | get_app_state 默认仅返回完整输入契约，schemaView=full 才包括输出。reference 指导 MCP 批次只发现实际使用操作，避免重复加载原生 batch union。 |
| P1 | 包装层和字段错误难以纠正 | MCP 错误包含工具名与短的合法 envelope；原生校验错误包含字段路径和契约发现入口。保持严格校验。 |
| P1 | Slot、queryData 使用错误 | Form/Table/示例 references 明确高级模式、Slot 写法、queryData 的 data.data 形状及动态表达式；不支持 literal 的错误指出可行绑定方式，不通过删除必要数据规避错误。 |
| P1 | 创建/复制描述过时与批次使用不足 | 修正 createState / copyElement receipt 描述；保留并说明 as/$name/$name.root；以区域组织写入和失败纠正。 |
| P1 | 模板依赖冲突 | reference 要求先检查源模板依赖版本，优先由模板导入依赖图，避免提前独立安装 latest；冲突或无法导入时分别报告真实导入与参考重建。未发布或升级线上模板。 |
| P1 | 截图使用固定900高度改变组件布局 | 离屏窗口直接使用源画板尺寸；显式 width/height 才改变布局视口；裁剪和压缩分开。真实 Electron 检查保持1440×720，并将小组件裁成160×80。历史超时仍未证明修复。 |
| P1 | 默认 Slot、设备与演示内容残留 | reference 要求清理未用演示 Slot，按需求检查实际 App、禁止动作和视口；新增 page_layout 检查设备与总览；业务内容仍需原需求验证。 |
| P2 | 全量数据反复读回、任务上下文增长 | 按节点/字段读取、完整证据保存在磁盘、定点读取失败项；保持完整数据能力。预算不是通过增加分页调用即可解决。 |
| P2 | 仅观察到部分 MCP 流量 | 增加可选 PLASMIC_RPC_METRICS，本地 RPC 入口记录操作、输入/响应字节、耗时和错误状态；不记录参数值、响应内容、token 或错误正文。与 MCP wire proxy 分开统计，避免双重计数。文件/shell读取和请求级 provider usage 仍需客户端证据。 |

## 已实际完成的验证

- Desktop 全量测试：257 项通过；后续 RPC/bridge/resources 定向9项通过。
- 原生 prototype、页面总览、HTML props：75 项通过；local-edit 与 ai-workflow：23 项通过。
- 项目序列化：1项通过；快照变更仅增加真实依赖版本。
- Python 验收测试：159 项通过；生产资源打包运行同组测试，并通过引用、读取预算、组件覆盖与哈希校验。
- 真实原生 fixture 生成与 padding 编辑回放各1项通过；这些是工具级验证，不是原需求业务验收。
- 真实 Electron 截图：源1440×720保持不变；小组件160×80，未放大。证据见 [native viewport](../../../desktop/desktop-report/mcp-repair-20261020/canvas-viewport-native.json)。
- 使用新脚本回放上一轮完整原始证据：evidence通过；structure、page_layout、forms、slots失败，正确捕获上一轮缺陷；旧结果没有被修改。
- 全仓 typecheck 失败于已有 LivePopOutButton.tsx:218 TS7030、TopBarLoading.tsx:58 TS2322；本次范围未出现新类型错误。Studio生产构建成功；git diff --check通过。

7个实际原生fixture操作的元数据，完整契约13,167 bytes，输入契约7,803 bytes，减少5,364 bytes（约40.7%）。这是序列化字节比较，**不是本轮模型token测量**。[计数证据](../../../desktop/desktop-report/mcp-repair-20261020/schema-size.json)。

## 真实回归：首轮诊断与第二轮

首轮 conversation `e879ee25-a473-4437-be8c-c6d64b3d685e`，项目 `6XV47VazEN954GgCJdCV1m`。界面14分钟后主动停止，完整原生读回确认尚无 Pages。该轮是中断的诊断样本，不能与自然完成的全链路比较生成效率。

| 首轮诊断指标 | 实测 |
| --- | ---: |
| Provider请求 | 155 |
| input（含cache） | 15,457,654 tokens |
| cache / 非cache input | 14,890,102 / 567,552 tokens |
| candidates / thoughts | 21,383 / 27,490 tokens |
| 单请求prompt峰值 | 235,773 tokens |
| CHECKPOINT | 1 |
| Plasmic MCP | 38调用，8错误 |
| MCP text / wire响应 | 87,656 / 101,636 bytes |
| 最大wire响应 | 35,068 bytes |

该轮正确先导入 Admin Templates，原生依赖图使用 Antd6 1.12.0，没有发生上一轮的版本冲突。接口失败包括：fromProject不能与组件目标并用、collection不能投影fields，以及模型臆造参数/集合。前两项是工具设计问题，已修正为自然的范围与投影语义；组件集合的contract视图也已修正为真实契约。未知参数继续严格拒绝。外部Pen工具另有5次错误，文件查看器另有越界/重叠读取，单独统计，不归为Plasmic MCP错误。

第二轮 conversation `bcf61ef3-eaee-41fc-a3c7-345aa7887378`，隔离目录 `/tmp/plasmic-req075-repair-r2-20261020`，新项目名 `REQ075 修复回归 Gemini38Flash 20261020 R2`。Gemini App 界面确认 Gemini 3.8 Flash High。使用原始REQ/P0 PRD、业务HTML、原.pen和原五行提示词；没有复用历史生成物。资源version0.1.4 / release `fb658f897d145ce8ca54c16dd869e3a10c4e39ac5af5acc186f76f8b4b7e3837`，由生产打包器构建并通过本地feed下载/哈希验证，未发布线上。

第二轮启动前，候选Desktop已重建并通过真实RPC验证同一依赖范围下的集合contract投影及组件目标读取，返回完整所选Props。新增原生查询测试71项通过。源需求清单及文件哈希在生成前冻结；独立审查将检查实际Preview、Desktop设备列、四页总览及真正退出重开后的模型。

## 用量口径与证据

客户端完整transcript包含每个provider请求的非cache input、cache、总output；非cache+cache为单次prompt。SDK的prompt已含cache，不能再相加。历史自然完成样本206请求与SDK完全一致，峰值239,715；首轮诊断155请求与SDK也完全一致。CHECKPOINT不等于context_length_exceeded，累计input不是窗口大小。

完整证据保存在磁盘；客户端工具呈现文字、原始MCP wire、本地RPC和图片分别统计，不能相加为独立内容。不会输出模型内部推理内容。计费、客户端压缩阈值没有证据，保持未知。

[首轮及本地测试证据](../../../desktop/desktop-report/mcp-repair-20261020/)；[第二轮证据与计数脚本](../../../desktop/desktop-report/mcp-repair-r2-20261020/)。
