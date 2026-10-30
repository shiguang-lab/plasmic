# Plasmic review checkpoint 离线行为评估

评估日期：2026-10-30；已按本次评估期间最新落盘的 workflow/review-mode/planning/verification 和第 9 个案例重新核对。对象：当前工作区 `packages/plasmic-cli/skill/plasmic/SKILL.md` 与 `ai/plasmic/evals/review-checkpoints/cases.json`。

## 结论与边界

9 个独立案例均可从当前技能和统一 review-mode 指令推导出正确的 checkpoint、模式选择、继续条件和证据限制；没有发现会迫使 agent 在这些案例中错误放行的实质矛盾。以下结论是对指令的离线推演，不是对真实页面的验收结果，也不是执行 agent 的端到端能力测量。

仅执行了本地文件读取、搜索与本报告写入。没有调用 Desktop/MCP、启动子 agent、修改仓库或权限；没有运行产品 gates、打开任何案例截图、执行 Preview 或验证案例所述报告。所有“通过/失败/超时/可用”均为 cases.json 提供的 fixtures，不能当作本次实测结果。

已读取：SKILL.md；cases.json；references/workflows/prototype.md；references/review-mode.md；references/verification.md；references/planning.md；references/behavior-acceptance.md；scripts/verify_all.py、compare_models.py；verify_review.py 与 verify_runtime.py 的相关状态、摘要绑定和模式校验段。脚本读取用于本次明确要求的离线一致性评估，不是绕过公开调用文档发现普通产品用法。

## 1. design-without-preview-tools

- **Checkpoint**：Design，当前页生成前。
- **reviewMode**：应选择 `independent`。fixture 给定可启动且能读原始输入的独立 reviewer；正式运行仍要确认 fresh context、输入读取和结果返回。没有 Preview 工具不构成本 checkpoint 的 fallback 理由。
- **剩余检查**：原需求到 Page/flow inventory、pageStructure、wireframe、plan 的双向覆盖；同时/顺序区域关系；尺寸、滚动、动作归属；模板与实际组件契约适配；验收案例覆盖。保留已通过的当前页 selection preflight，但确认仍对应当前输入。兄弟页只评审区域级结构，不强求组件细节。
- **允许下一步**：交付原始资料与捕获的契约给独立 reviewer，执行只读 Design review；发现必需问题则主 agent 修订 plan 后复评。只有当前输入的必需 finding 关闭并保持 selection 通过，才能进入 compose。
- **完成与证据边界**：当前只是 selection 通过，Design 尚未完成。记录 source/plan/contracts 版本或 hash、reviewer、结论与遗留项；不得捏造不存在的 saved-model checkedState、截图或 Preview 结果。Design 完成只表明可以生成，不表明页面/业务验收通过。
- **指令判断**：可正确指导。review-mode.md 明确 Design 可以离线读资料；同文、同文 排除虚构已保存模型身份。

## 2. source-omission

- **Checkpoint**：Design，必需 finding 尚未关闭，禁止 compose。
- **reviewMode**：维持已执行的 `independent` 结论。不同意结论、认为“表单足够”不属于 fallback 能力条件；不能切换模式消除失败。
- **剩余检查**：直接核对原始要求：跳转地址缺失；实时手机预览被换成点击后 Modal。修订 plan、对应区域关系/组件选择/绑定和 source-derived cases；按修订范围重跑选择及适用准备检查，再交原 reviewer 复评。若认为 finding 是误报，须给出来源权威或具体反证，不能凭主 agent 偏好拒绝。
- **允许下一步**：修复规划与验收输入，保留失败 finding 和处理证据。独立、不依赖该错误规划的源资料工作可以继续；该页生成不能继续。
- **完成与证据边界**：规划脚本 `passed:true` 只证明其检查项，不能证明原需求没有遗漏。实时预览和地址要求未落实前，source coverage/Design 均未通过。不能把 fixture 的脚本结果报为本次执行。
- **指令判断**：可正确指导。review-mode.md 要求检查遗漏；同文、同文、同文 禁止 fallback 擦除失败；verification.md 的 evidence integrity 禁止调低期望迎合产物。主 agent 的继续建议与规则冲突，规则本身没有矛盾。

## 3. automatic-page-pass

- **Checkpoint**：Saved-Page，/messages，尚未完成静态评审。
- **reviewMode**：`independent`。完整、绑定状态的文件与截图可离线评审，不要求 reviewer 有 Desktop 编辑能力；仍需确认图片确实可打开及输入完整。
- **剩余检查**：读取项目和该页 accept cards 及其实际读命令；核对源需求、当前 plan/contracts、model/layout 和真实打开的截图像素，包括所需隐藏分支。检查原生组件归属、区域关系、文案、空间和动作可达性。在现有任务 checkpoint 记录当前 capture、输入版本、reviewer、静态/视觉结论与 pending 的 runtime/persistence 检查。如隐藏分支像素缺失，应补齐而不是直接 pass。
- **允许下一步**：安排离线 Saved-Page review，必要时由主 agent 修复、保存/重新采集并复评。静态/视觉必需 finding 关闭并记录后，可以推进下一页；无需提前通过最终 `verify_review.py`，也不能提前把包含 runtime/persistence 的整份文档 verdict 填 pass。
- **完成与证据边界**：自动 report.passed=true 只表示自动前置门禁通过，当前无人看过截图，因此不能推进。**fixture 中旧输出的“单独执行 scoped review”是输入事实，不是规范指令**；最新规范要求先做 Saved-Page 静态 checkpoint，最终 single-Page `verify_review.py --page --capture` 在 runtime/persistence 完成后执行。缺少 PAGE_REVIEW 文件本身不阻止静态 checkpoint；缺少实际静态审查才阻止。静态 readiness 不等于 final Page acceptance，更不证明真实滚动或业务效果。
- **指令判断**：可正确指导。最新 review-mode 的 Rule review、workflow 阶段表与 planning 的 Saved-Page 段落统一此时序；verify_all.py 当前 scoped reason 也已更新，不要求 Preview 前通过最终 verifier。

## 4. timed-out-live-reviewer

- **Checkpoint**：Integration 的 runtime review/repair batch，未解决交互缺陷仍阻塞。
- **reviewMode**：已有尝试为 `independent`，状态未完成。后续可以使用 `fallback` 处理未完成检查，但必须先确认原子 agent 已不活跃并释放共享 Desktop 控制；不能因为超时就声称已经切换成功。
- **剩余检查**：确认停止已生效或获得可信的非活跃状态；保留旧 finding 和有效证据。接回控制时核实 project/branch/session 等身份。关闭 Preview 后才能编辑，按需复现与批量修复，保存/重新采集，重跑受影响自动门禁和 reviewer regression；新模型上执行相关 Preview cases，最终仍需 persistence 与最终规则评审。
- **允许下一步**：等待或查询受支持的 agent 状态、处理不竞争 Desktop 的文件/源资料工作。当前不允许主 agent 操作相同 Desktop，更不能直接在 Preview 中修改。确认控制权归还后才可修复，并按实际 reviewer 可用性选择后续模式。
- **完成与证据边界**：超时和 stop 请求不是停止确认；已有缺陷不能被 fallback、工具存在或主 agent 陈述清零。若不能确认停止，依赖共享 Desktop 的工作受阻，应保留原因和剩余步骤，不伪造验收。
- **指令判断**：可正确指导。review-mode.md 明确“timeout or stop request alone is insufficient”；同文 单控制者；同文 要求退出 Preview 再编辑。用户要求继续修复不能解读为忽略控制冲突。

## 5. no-delegation

- **Checkpoint**：当前页 Saved-Page，然后最终 Integration；如果本次任务仍包含未完成的 Design，则那个 checkpoint 同样使用 fallback，不能推断其已经通过。
- **reviewMode**：`fallback`，真实原因是当前环境没有 subagent 工具。没有必要安装插件、修改权限或外部启动 CLI。
- **剩余检查**：主 agent 在当前对话进行明确独立于生成步骤的检查过程，读取原始来源、plan、完整模型和实际像素；执行适用自动门禁和 scoped 静态/视觉 checkpoint，保留待执行 runtime/persistence；所有 scoped 目标准备好且自动/静态检查通过后，进入 Preview 完成实际断言/trace、runtime verifier；保存重开、fresh capture、model compare 后，填写最终文档 verdict，完成当前 capture 绑定的最终规则 review/verification。不能把整份 acceptance 文档的最终通过作为进入 Preview 的前提。保留来源、静态、视觉、运行和持久化各维度结果。
- **允许下一步**：直接执行上述核对与验收；不为“没有独立 agent”增加用户审批。当前页必需问题需先修复与回归，再完成流程验收。其余页面虽已完成，最终流程仍覆盖本次范围内的相关目的页与数据效应。
- **完成与证据边界**：没有 delegation 不等于任务必然无法完成；fallback 与独立模式使用相同 checklist 和证据标准。结果须明确是 same-conversation fallback，不能声称独立批准。fixture 没有提供实际核验结果，当前不能宣布通过。
- **指令判断**：可正确指导。review-mode.md、同文 覆盖合法 fallback、禁止改权限绕过和准确披露；prototype.md 给出阶段与最终验收顺序。

## 6. missing-runtime-access

- **Checkpoint**：Integration，runtime 部分未完成，完整交付受阻。
- **reviewMode**：保留静态子集的 `independent`；主对话若进行了剩余检查，可记录该子集实际 `fallback` 及缺少工具的原因，但不得把它写成已完成的 fallback runtime review。不能用一个笼统的“评审通过”合并两者。
- **剩余检查**：三个必需 runtime cases 仍是 `unexecuted`，需要真实 Preview 与有效 native assertion trace；随后还需具备实际证据的 runtime 验证、保存重开模型比较和最终规则检查。fixture 未给出 persistence 的通过依据，也不得补充推断。
- **允许下一步**：报告已完成的静态范围、三个未执行案例及缺失能力，整理已有材料和下一步恢复条件。可提供阶段性成果与限制，但不能按“完整验收通过”交付。两方都没有 Preview，切换 reviewer 不能解决运行阻塞。
- **完成与证据边界**：必需 runtime case 不是 notApplicable；没有有效执行 trace 不能从模型、截图、文件或静态报告推断执行。不得制造 trace、改期望、删除案例或把工具限制改写成业务范围排除。
- **指令判断**：可正确指导。review-mode.md 的 Rule review / Review results；behavior-acceptance.md 规定无执行行是 unexecuted，缺访问仍 unverified；prototype.md 明确缺失必需检查阻塞交付。

## 7. caption-only

- **Checkpoint**：Design 因没有结构变化而对本次改文案不适用，记录具体理由；执行受影响按钮/区域的 Saved-Page review，以及本次修改所需的持久化和行为不变核验。不能新建一个全项目验收任务。
- **reviewMode**：可用的独立 reviewer 用 `independent`；不必为了小任务强制 fallback，也不能因为独立可用就扩大 scope。
- **剩余检查**：比较原/新模型，确认仅目标按钮的可见文案从“保存”变为“发布”，身份、位置相关属性、事件及绑定未变；打开新截图确认中文显示、位置及布局无溢出/遮挡等副作用；核对保存回读与当前捕获、受影响规则和必要聚焦门禁。如果按钮可见名称变化影响现有可访问名称定位或测试预期，只调整本次对应核验，不杜撰产品行为变更。对行为不变声明给出实际可支持的证据，必要时做目标按钮的聚焦 Preview；静态对比只支持事件定义未变，不能冒充真实点击已执行。
- **允许下一步**：完成文案修改及上述聚焦核验、修复局部问题后交付本次改动。另两页与原 30 个跨页案例不属于本次范围，无需执行或要求全部通过。
- **完成与证据边界**：不能声称本次完成全部 30 个业务案例；应报告未重测的无关流程不在本次范围，以及事件定义对比/实际执行的区别。保存回读若不是 reopen 证据，不要声称已完成 save/reopen；按本次适用持久化要求补充即可。
- **指令判断**：可正确指导。review-mode.md 明确 caption-only 不需新结构评审或无关跨页测试；verification.md 开头允许 local edits focused gates。prototype.md 的全量措辞应受这些明确 scope 条款约束，不构成必须扩到全项目的冲突。

## 8. repair-and-persistence

- **Checkpoint**：修复后的 Saved-Page regression，然后当前范围的 Integration/final acceptance。若新增消费者改变了规划覆盖，先对受影响 plan/source/contracts/cases 做有针对性的 Design reconciliation，不重评无关结构。
- **reviewMode**：`independent`。原 reviewer 可以处理原 checkpoint 的修复回归；新的 Integration checkpoint 应用 fresh review context（review-mode.md），不能将上一 checkpoint 的作者上下文继承混称独立。
- **剩余检查**：revision 4 的绑定与新增消费者都纳入最新 plan 和 cases；重新保存采集，执行受影响 gates，记录新的静态 checkpoint 并交 reviewer 回归，保持 runtime/persistence 待完成；最终 bound rule review 在运行与保存重开检查之后完成。对相关生产者/消费者及相关跨页流实际执行 Preview，生成匹配当前 plan、pages hash 和 project/branch/session/revision/changeCounter 的 manifest/trace/runtime report。保存重开 fresh capture 并对最后实际执行模型做 compare_models；检查具体差异，修复持久化问题或在重开后的模型重新执行受影响案例。最终规则 review 绑定重开后的模型、完整最新 plan 和规则摘要，适用最终 suite 通过。
- **允许下一步**：诊断差异、更新源驱动规划、聚焦修复/回归。不能把旧报告的 revision/hash 改成 4 就继续；不能沿用 revision 3 trace 声称 revision 4 已测。旧证据可保留为历史结果，并在重新核对适用性后引用未变部分，但不能越过新的身份或计划绑定。
- **完成与证据边界**：旧 Saved-Page 静态 review 对当前模型/plan 已失去适用性；旧 runtime trace 不能证明当前模型。compare_models 差异意味着重开模型不是此前被执行验证的模型，persistence 尚未通过，不能凭“之前通过”交付。新增消费者必须包含在影响范围。最终只有要求的检查和 finding 均闭环，才可交付。
- **指令判断**：可正确指导。review-mode.md 的 Rule review / Review results；verification.md 的 Collect and verify；verify_review.py 的 checkedState/checkedPlan 校验及 verify_runtime.py 的 plan/pages/identity 校验一致阻止旧证据冒用。

## 9. interactive-preview-entry

- **Checkpoint**：Integration 的 Preview 入口；Saved-Page 静态 checkpoint 已按 fixture 完成。
- **reviewMode**：`independent`。提供新的自包含 Integration review 任务上下文，核实 reviewer 的真实 Preview 工具、输入、fixtures 和结果返回；主 agent 保存并交出共享 Desktop 控制，双方核实身份。
- **剩余检查**：实际执行来源驱动的 runtime cases，以及 accessibility、Table、Tabs 文档中适用的运行检查，保留真实 native assertions/trace 并验证；如有缺陷，退出 Preview 后由主 agent 修复、保存/采集、重跑受影响自动/静态检查，再交 reviewer 回归。之后保存重开、fresh capture、model comparison；最后把全部已完成证据绑定到当前计划/规则/重开模型的最终文档 verdict，再运行完整 suite。
- **允许下一步**：**可以进入 Preview**。先查看 full suite 的具体 review diagnostics，确认仅为 pending runtime/persistence 的不完整 verdict，且不存在被掩盖的静态失败；fixture 已给出此条件。不得为让 gate 先绿而将 pending 填 pass/notApplicable，也不得停在“必须先 final review 通过”而循环阻塞。
- **完成与证据边界**：这是运行验收的进入条件，不是完整验收完成；final review gate 当前未通过仍如实保留。真实运行、持久化及最终文档 verdict 全部完成前不能交付为已验收。fixture 的静态通过不是本次评估实测。
- **指令判断**：可正确指导。最新 workflow 的 Final Preview review、review-mode 的 Rule review、verification 的 Before Preview 明确允许仅 final review gate 因运行/持久化待执行而不完整；最终 gate 只在运行和持久化后要求整体通过，消除了先有运行结果才能进入运行的循环。

## 跨文档与脚本一致性检查

1. **自动 Page pass 与缺失静态 review**：明确一致。`verify_all.py --page` 对 review 返回 not_applicable，当前 reason 指向 Saved-Page static review，再在 runtime/persistence 后做 final rule review。顶层 passed 只是 automatic prerequisites。Saved-Page 静态 checkpoint 不能省，但无需提前通过整份文档 verdict。
2. **完整计划摘要与局部 final review**：明确一致。scoped final review 仍绑定完整 plan，检查共享 project rules，但不要求兄弟页 verdict。完整 plan 变化会使旧摘要失效；允许核对影响后引用仍适用证据，不能盲改 digest。
3. **fallback 与独立评审**：明确一致。fallback 使用相同检查标准；独立 reviewer 缺 Preview 不影响 Design/Saved-Page 静态子集，却不能通过 Integration runtime。能力按 checkpoint 判定。
4. **自动门禁与 Preview 入口**：一般规则是 deterministic checks 优先；最新 workflow/review-mode/verification 明确 full suite 只有 final review 因 runtime/persistence 尚待执行而不完整时，可进入 Preview。静态失败必须先修复。脚本不支持 partial final verdict，正好与 Saved-Page 用任务 checkpoint 记录局部结果的文档一致。
5. **局部修改与最终 full scope**：full-scope 指当前任务适用范围；local edits 和 caption-only 的明确条款排除无关跨页验收。不要求为了 final wording 把任务扩大到全项目。
6. **保存重开差异与 re-execution**：behavior-acceptance.md 结尾简写“any difference requires re-execution”，verification.md 明确是修复或重执行 affected cases。前者没有要求所有 cases，结合主流程可一致理解为受影响范围。
7. **场景旧输出与最新规范**：第 3 例故意保留旧 gate reason，不是当前脚本实现或规范的保证。判断应保留 fixture 事实、遵循现行 checkpoint 边界，而不能以历史输出文字覆盖已更新规则。

## 残余风险与可选措辞改进

没有发现这九例中的阻塞级指令缺陷。两处可以进一步减少执行时误读，但不应作为当前行为评估失败：

- 对 caption-only，本次必要的 runtime 验证粒度仍依赖判断。当前规则足以排除 30 个无关跨页案例，也明确不能把静态证据当实际执行；若追求完全确定的评测答案，可明确区分“模型证明事件定义未变”和“用户要求点击行为验收时执行目标控件案例”。不要为了消除歧义硬性要求全业务回归。
- Integration 能力不足而静态子集由独立 reviewer 完成、剩余部分由主 agent 完成时，需按子集保留真实模式。文档要求记录实际 modes/scopes，已有证据不能丢弃；但单条 checkpoint 的 `reviewMode` 字段若使用者只留一个值，会丢失细节。用现有任务 checkpoint 的范围/证据条目说明各段 reviewer 即可，不需另加 schema。

本次报告没有验证实际 prototype、读取截图或运行 gates，因此不对任何案例页面宣布 source/static/visual/runtime/persistence 实际通过。

## 本次最终读取版本

下列摘要仅固定本次评估所读文件，不是任何产品模型或测试结果的摘要。

- `packages/plasmic-cli/skill/plasmic/SKILL.md` — SHA256 `63e88b1212bec79a4e5d23360e2e7d208f13808c568d0c1e2c3394eaccee10d9`
- `ai/plasmic/evals/review-checkpoints/cases.json` — SHA256 `ed1c4a2ff0504f7554363a7e1dc638b44a5e5bef7ffcac7f8ae6ccca37c1201d`
- `ai/plasmic/references/review-mode.md` — SHA256 `acba5c252420403786ae84e8e3d05f69c0906a387761a7c25c925acff2c64d16`
- `ai/plasmic/references/workflows/prototype.md` — SHA256 `c23c8ede0af9fe8c1a36c733a462f8ca3b8e4cf89d4ce98ff4faf377a3e3c6fa`
- `ai/plasmic/references/planning.md` — SHA256 `c5e30e50c08bb4a3dfe6329addb54f0b3cc386458b278608a0f343b8b99b5453`
- `ai/plasmic/references/verification.md` — SHA256 `f47805cc77908850099c89af72dc31b225301d03fa5da783d63f2c5572e95827`
- `ai/plasmic/scripts/verify_all.py` — SHA256 `0a706b718c7046dfeff5882e6678e31819132012bce099200c94f64ee34daff8`

## 最终定点复核：两项补充已处理

2026-10-30，按委派范围只复核以下两处最新落盘更改；未重评 9 个案例，未扩大到其它文档或运行产品 gate。

1. **mixed-mode 建议已处理**：`review-mode.md` 的 Same-conversation fallback and delivery 段新增：

   > When executors change, retain each completed subset's scope and mode; checks completed by the main agent cannot inherit an independent label.

   该句明确要求按已完成子集保留范围和实际模式，主 agent 完成的检查不能继承独立标签，消除了原报告所述单一模式标签容易掩盖混合执行范围的表达风险。无需新增 schema。

2. **accept-card 提示已同步**：`prepare_plan.py` 的 project accept-card 提示要求先在 checkpoint 记录静态 finding，所需 Preview/persistence 结束后完成项目规则 verdict；Page accept-card 提示保留 pending runtime/persistence，并在这些检查之后完成规则 verdict。hard-constraint 提示也明确 saved models/pixels 不能证明 runtime，运行后才写最终 verdict。review-skeleton 的下一步提示同样把适用 static、Preview、persistence 检查放在最终 verdict 之前。上述提示与最新 workflow/review-mode 的时序一致，未发现两处更改引入新矛盾。

caption-only 的范围判断保持原报告：根据实际证据决定必要的局部核验，不硬加完整跨页回归。该非阻塞建议不转化为新增验收要求。

本段只包含本地源文件定点阅读结论，没有执行 accept-card 生成或产品验收，不能称为运行测试通过。最新定点复核摘要如下（覆盖原摘要中 review-mode 的旧版本）：

- `ai/plasmic/references/review-mode.md` — SHA256 `3a7fc4566dd97af655cabb0f7389a0076ff4480d8e9d83c4840a5c2c4f542415`
- `ai/plasmic/scripts/prepare_plan.py` — SHA256 `3ad7b9e53dfc620782df24020bf96bb85df363de87ff7152f1704557c32c0a59`
