# Review checkpoint 评估结果

日期：2026-10-30。范围：仓库 Plasmic skill 的三个评审检查点、统一 independent/fallback 策略及 scoped review 工具。未发布或安装资源。

## 工程审核与修复

独立工程 reviewer 使用全新上下文，读取实际 workflow、引用文档与脚本，并运行合成记录反例。初审发现一项 P1：要求 Preview 前通过包含真实运行检查的最终规则评审，形成循环依赖。现已修复：

- Design 检查原始需求、页面结构、模板/组件契约和案例覆盖，解决必需问题后才生成。
- Saved-Page 检查模型和真实截图，关闭静态/视觉问题后才推进；运行与持久化检查保留 pending。
- Integration 实际执行 Preview、验证 trace、保存重开并比较模型；随后完成绑定当前状态的最终文档 verdict。

检查点沿用现有 task checkpoint，最终规则、运行记录和降级机制沿用现有契约，没有新增平行验收 schema。单页最终评审覆盖共享规则，保留完整 plan digest；scoped capture 不能冒充全项目验收。评审只读、生成者不能独立审自己的产物、共享 Desktop 单控制者、故障降级保留已有 finding 和有效证据。混合执行按子集记录真实模式。

复审确认原 P1 关闭，未发现新的可操作缺陷。实际反例确认：旧 reopen session、同 capture 的变更 plan、pending 最终规则、fallback 中保留的失败均不能通过 verifier。详见 [工程审核与复审](engineering-review.md)。这些反例验证记录契约，不证明真实界面或业务正确。

## 独立行为评估

另一位全新上下文 agent 读取候选 skill、相关引用和 [9 个场景](cases.json)，首次委派未提供逐题标准答案。评估期间通知了源文件更新，修复后的定点复核明确提供修改点；这是独立离线走读与回归，不是九次隔离盲测。九例均得到符合当前规范的推进/阻断边界：设计阶段缺 Preview 工具、需求遗漏、自动 Page pass 但未查看像素、持有 Desktop 的 reviewer 超时、无 delegation、双方缺 runtime 工具、仅改文案、修复与重开证据失效、正常进入 Preview。

详见 [原始场景输出及定点复核](agent-output.md)。采纳了按子集标注混合评审模式的建议；局部文案调整保留基于证据的必要判断，不增加无关跨页回归。

这是离线决策推演，不是九次真实原型执行，也不是跨模型成功率统计。Design/Saved-Page 的语义评审仍依赖 agent 判断；脚本检查记录、摘要、范围和证据格式，不能强制独立性或证明所有必需检查真实执行。

## 自动验证与范围

修正后完整 Python 回归：`python3 -B -m unittest discover -s ai/plasmic/scripts -p 'test_*.py'`，527 项通过，72.372 秒。`git diff --check` 通过。

CLI skill 安装/同步测试：`node --test tests/skill.test.mjs`，20 项通过。单独的规则评审测试：`python3 -B -m unittest discover -s ai/plasmic/scripts -p 'test_verify_review.py'`，20 项通过。

实际资源构建使用的 `validateReferences` 和 `validateComponentReferences` 校验了 202 个资源，引用、锚点、组件文档及阅读预算通过。prototype mustRead 为 12,230 bytes，directed 为 211,216 bytes，低于既有 212,992-byte 上限；未扩大预算。

首轮 Python 回归发现新增测试断言误把诊断的规则 owner 当作被审文档路径；实际 verifier 已正确拒绝 pending。根据真实输出改为断言准确的 verdict JSON pointer，没有修改生产检查或弱化标准。曾运行的 CLI 全套测试也嵌入同一 Python 回归并报告同一失败，随后停止剩余重复发布构建；本次不声称 CLI 全套发布测试通过，以完整 Python 回归和相关 skill 测试为验证范围。

通用 `skill-creator/quick_validate.py` 在当前文件与未修改 HEAD 上均拒绝既有 `compatibility` frontmatter；该字段未改动，未为通过此通用检查删除运行约束。仓库自己的资源与 skill 测试结果单独报告。

未访问真实 Desktop/MCP、执行真实 Preview/save-reopen 或测量线上产物质量。复测行为场景时，把候选 skill 与 cases.json 交给新上下文，禁止附带本报告或旧结论；真实产品验收需另有受控页面、工具和实际执行证据。
