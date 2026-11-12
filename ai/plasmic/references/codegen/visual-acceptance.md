# 逐场景设计与实现截图验收

用于原生 codegen 的生成、修改、修复及一致性验收。每个范围内的变体、隐藏状态、条件入口和面板都需要设计与实现的成对截图、差异分析以及必要的修正复验。默认页截图、源码审查或工程检查不能覆盖未观察的状态。缺少任一必需场景的有效证据时，不得报告视觉验收通过。

## 从原型清单确定场景

沿用[原型清单](../workflows/codegen.md#3-核对原型清单并建立实现契约)，以完整保存的设计 Page 和项目 overview 发现默认视图、原生变体、全局变体、断点、非活动 Tab、折叠面板、弹层开关、展开行、显隐和条件禁用状态。按照[场景发现规则](../visual-scenarios.md#discover-the-scenes)对照原始需求和引用组件，补充表达式内部的业务结果、权限/数据分支、导入组件内部状态、组合变体及长面板的必要滚动位置。独立设计审查从来源重新盘点，不以实现方的清单作为完整性依据。

在现有任务目录保存可机械校验的清单片段，无需重写整个业务计划：

```json
{
  "implementation": {"root": "/absolute/application", "paths": ["src", "public", "package.json", "pnpm-lock.yaml", "vite.config.ts"]},
  "pages": [{"path": "/records", "visualScenarios": []}]
}
```

`paths` 使用目标项目实际存在的相对文件或目录，包含页面、路由、共享组件/样式、资产、配置、依赖锁文件及影响场景的模拟数据。目录会递归计入新增和未提交文件；不选择构建输出、截图证据、依赖安装目录或其他无关文件。使用真实文件路径，符号链接范围需展开到实际所在项目并明确依赖覆盖。审查者核对文件范围；哈希不能发现人为未列出的外部输入。`visualScenarios` 必须显式给出，模型以外的场景沿用 `{id,kind,nodeName,state,source,given,steps,expected}`。局部修复列受影响 Page，补齐共享消费者；该门禁检查列出的 Page 全部场景，其他 Page 保持明确未覆盖，不扩大为全项目通过。

## 采集、进入和对比

冻结已确认的设计版本，复用[公开设计采集](../verification.md#collect-and-verify)的 `capture.json`、`pages.json` 和 `overview.json`。不要修改原型初值来制造截图状态。通过 Preview 的真实入口及支持的变体控制进入设计；通过目标应用真实路由进入实现，不另建验收专用页面。记录两端实际入口步骤，允许合理的宿主/路由转换，并说明映射依据。

两端对齐视口、业务内容有效宽度、数据 fixture、权限、语言、所观察的状态和滚动位置。隐藏/关闭场景拍摄其所属区域和入口，核对留白和操作状态；条件入口覆盖适用的可见/隐藏、可用/禁用和打开的目标。长面板检查必要滚动位置及底部操作，额外位置作为独立场景。窄屏、组合变体及加载/空/失败结果按需求纳入，不能只验证默认桌面状态。

逐一打开两端原始截图并比较布局、内容及控件：层级、对齐、间距、密度、裁切、滚动、文本、状态与操作可达性。分别记录具体相同点和差异，不能以文件名、`pass` 或像素差比例代替分析。合理转换记录来源及理由；确认缺陷写入 `issues`，不得把缺陷改成预期以通过。截图比较不代替行为和可访问性验收。

## 证据与修正复验

先生成待填骨架，再按场景填充；重新生成时按场景 ID 合并历史，不能丢弃失败尝试。每 Page 的 `sourceCoverage` 沿用来源核对记录：`reviewed:true`、`sources` 和具体 `notes`。

每场景保留生成的 `id/kind/nodeName/state/given/steps/expected`，并填写 `context`：`viewport:{width,height}`、整数 `contentWidth`、具体 `fixture`、`role`、`locale`、`scroll`。每次 `attempts` 观察包含：

| 字段 | 内容 |
| --- | --- |
| `design` | `checkedState`（来自设计 capture 的完整身份）、`screenshot:{path,sha256}`、实际 `context`、实际入口 `steps` |
| `implementation` | 当次代码快照的 `sourceSha256`、`screenshot:{path,sha256}`、实际 `context`、真实应用 `url`、实际入口 `steps` |
| `analysis` | `layout/content/controls` 三项成对比较的具体观察，包含合理转换的依据 |
| `issues` | 缺陷数组 `{id,description}`；无缺陷为 `[]` |
| `repairs` | 本次观察后完成的修正 `{issueId,change}`；没有修正为 `[]` |

截图使用捕获工具返回的 PNG/JPEG/WebP 原文件和 SHA-256，路径为绝对路径。两端使用独立捕获文件，不得用设计图冒充实现图。同一冻结设计版本、场景和上下文的设计基线可在后续尝试中复用；实现端每次观察必须重新截图。像素相同的独立截图是合法结果。

发现差异后保留原观察，修正代码，运行受影响的工程/行为检查，确认实际应用已加载新代码，生成新的源码快照，然后重新进入同场景截图并追加分析。保留每轮源码快照原文件及实际启动/构建证据，供审查者追溯截图时运行的产物。仍存在的缺陷保留原 ID，继续修正复验。所有必需修复均有后续观察，最后一次观察无未解决缺陷，并绑定当前设计与当前代码快照。源码快照覆盖未提交及新增文件，不能仅记录 git HEAD。设计发生变化时重新采集、核对清单和基线，保留旧验收档案；旧设计图不能为新设计通过。

## 执行门禁

```sh
python3 RESOURCE_ROOT/scripts/verify_codegen_visual.py skeleton PLAN \
  --capture RUN/capture.json --pages RUN/pages.json --overview RUN/overview.json --output REVIEW
python3 RESOURCE_ROOT/scripts/verify_codegen_visual.py snapshot PLAN --output SOURCE_SNAPSHOT
python3 RESOURCE_ROOT/scripts/verify_codegen_visual.py check PLAN \
  --capture RUN/capture.json --pages RUN/pages.json --overview RUN/overview.json --review REVIEW --output RESULT
```

输出路径必须是新文件，避免覆盖历史证据。骨架的 `checkedImplementation` 是当时的源码快照；修正后用最新 `snapshot` 更新它，并将实际截图时的快照 `sha256` 记入对应观察的 `implementation.sourceSha256`，不能只修改旧观察的版本标记。`check` 重新读取磁盘计算源码哈希，检查最终证据是否仍匹配。报告计划摘要、设计身份、源文件清单和哈希共同绑定检查范围。

最终 codegen 验收执行此门禁；缺场景、缺任一端截图、图片损坏/哈希不符、两端上下文不一致、复用实现图片、代码或设计版本过期、未修正或修正后未复验均失败。缺浏览器、认证或数据时保持对应项未验证，继续能执行的工作，不用豁免绕过，也不将整体视觉验收记为通过。

这是证据完整性门禁。来源覆盖是否真实、两端是否实际进入对应状态、运行应用是否加载记录的代码以及画面是否符合设计，由设计审查核实；脚本不能自动证明任意表达式的全部业务分支或像素语义。交付同时报告门禁结果、逐场景视觉结论及未验证项。
