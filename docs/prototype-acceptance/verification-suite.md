# Unified verification and inspection timing

2026-10-14，Asia/Shanghai。本次验证不修改或保存设计，不发布资源。

## Automated checks

- `node scripts/build-plasmic-resources.mjs --version 0.0.87 --output /tmp/plasmic-verification-resource-build-final-20261014`：通过。包含 97 项 Python 单元测试、references 链接/可达性/阅读预算检查及组件文档注册覆盖检查，成功构建资源。版本参数仅用于本地构建验证，未覆盖 NAS 上的同版本资源。
- `node --test desktop/tests/controller.test.cjs`：8 项通过。新增丢失 metadata 响应的故障注入：超时清理 pending、后续队列继续运行、迟到 IPC 响应被忽略，后续健康调用成功。这不模拟真实渲染进程卡死。
- `node --check desktop/scripts/diagnose-inspection.cjs`、`git diff --check`：通过。

Python 覆盖路径清单在不同 UUID 项目中复用、名称解析、多个选择器冲突、缺失/重复页面、六类门禁汇总、动态菜单拒绝静态通过、独立失败不阻断其余门禁、缺少配置不通过、证据版本变化、逐页高度覆盖、在线只读调用序列及离线 CLI 报告。

## Live collection and replay

当前打开项目 `iqBeCQWLFWvGwftodkcHbN`，Desktop `0.0.63`，4 个路由页面。

使用 `verify_all.py --project-id ... --profile ... --expectations ... --output ...` 在线采集，suite 配置仅为 `{"shell_height":{}}`，用于验证新入口的实际采集和高度门禁。未从模型反推其他门禁的需求清单。

[在线结果](verification-suite/live-gates-report.json)：概览/完整页面证据一致，4 页的 AppShell、Layout、sidebar 均从 y=0 填充到 1024px。采集前后 revision=16、changeCounter=0，项目和分支一致。

用 `--evidence` 重放同一目录，生成的 JSON 报告与在线报告完全一致。两次退出码均为 1：另外五类门禁缺少独立审核清单，正确标为 `unverified`。这不是该业务项目的全量验收通过；真实 Preview、保存重开不在此次检查范围。

## IPC reproduction

运行 [diagnose-inspection.cjs](../../desktop/scripts/diagnose-inspection.cjs)，3 轮遍历上述 4 页，记录每次公共 RPC 的阶段和耗时。原始结果见 [inspection-report.json](verification-suite/inspection-report.json)。正式探测从北京时间 07:18:22 开始，工具返回 Desktop 版本 `0.0.63`；前置状态检查曾返回 `0.0.62`，本报告不将两者视为同一版本的测试证据。

| 场景 | 次数 | 返回画板数/次 | 耗时范围 | 超时 |
| --- | ---: | ---: | --- | ---: |
| 直接 `snapshot_layout({componentUuid})` | 12 | 1 | 33–140 ms | 0 |
| `navigate` 后立即定向 snapshot | 12 | 1 | 42–236 ms | 0 |
| `navigate` 后立即无目标 snapshot | 12 | 4 | 2417–2715 ms | 0 |

24 次 navigate 耗时 157–308 ms；24 次后续 metadata 状态读取均成功。最终项目、分支、revision、changeCounter、选择和 editorView 与探测前一致，原画板、缩放和平移已恢复。

代码定位：`DesktopController.invoke()` 在等待渲染端回复超时后产生 `Editor command timed out: metadata`；metadata 经 editor bridge 读取 `getEditorContext`。现有控制器已有串行队列，`ready()` 对 metadata 超时已有有界重试。`navigate` 切换 arena 后立即返回；定向检查则通过 `beginCanvasInspection` 等待 view sync 并持有后台画板。

此轮未复现原超时，无法证明旧页面卸载是根因，也未证明所有负载下不会超时。实测证据支持默认使用定向检查，避免无目标读取多个画板；不据此增加第二套队列或固定重试次数。若再次出现，保留探测报告中失败的阶段、版本和调用耗时，再定位 metadata 往返或目标画板同步的具体阻塞点。
