# 待办：交互模式下的读写与扫描效果

> 记录于 2026-11-06。范围：Desktop 灵动岛 / MCP 交互画布。

## 1. 交互模式下支持读

- [ ] 模型读（`read` / `queryElements` / `validate` / `getEditorContext` 等）：已可用，补一次实测确认。
- [ ] 画布读（`get_screenshot`、`snapshot_layout` 不带 `componentUuid`）当前要求编辑模式，需放行 `interactive`。

## 2. 交互模式下显示扫描效果

- [ ] `desktop/src/island.cjs:100` 的放行条件排除交互模式，需要放行 `previewKind === "interactive"`。
- [ ] `desktop/src/island-capture.cjs:98` 取景传的是 `context.mode`（交互态为 `preview`），会去找原生 Preview 的 `.live-root-container`；交互画布应走编辑画布分支（`"edit"`）。
- [ ] 目标定位随之走编辑画布 `valkey` 分支，确认扫描区域落在交互画布上。
- [ ] 说明：扫描层是灵动岛独立透明窗口的覆盖层，鼠标穿透，不进截图/导出，不会阻塞交互。

## 3. 交互模式下的写操作

- [ ] 现状：写操作会自动关闭交互模式再执行（`desktop/src/controller.cjs:267`），扫描落在编辑画布上。
- [ ] 待定：是否需要"留在交互模式里写"；若需要，卡点在 Studio 的编辑模型：
  - `assertCanEditPrototype` 断言 `!isInteractiveMode`
  - `canEdit` 在交互态为 false
  - 写入后的展示/选中会主动退出交互（`present-target` / `selectElement`）

## 4. 关闭优化：扫描动画完整执行

- [ ] 关闭（扫描结束 / 关闭交互模式 / 关闭预览）时，扫描动画要完整跑完当前这一趟，不要在一半截断。
- [ ] 已知问题：`desktop/src/island.css` 中 `completed` 状态把 `.feedback-sweep` 的 `animation-iteration-count` 改成 1，长操作完成时会直接跳到末帧而不是扫完。
- [ ] 方案方向：在渲染层按当前动画剩余时间收尾（`animationiteration` 或 `currentTime % duration`），完成/移除都等这一趟结束。

## 5. 测试与文档

- [ ] 灵动岛交互态扫描的 native 测试（镜像 + 扫描区域）。
- [ ] 关闭收尾的计时测试。
- [ ] 更新 `desktop/README.md` 灵动岛反馈行为说明。
