# 预览视口验收

2026-10-04，本地 Plasmic Desktop，项目 `2DdvqnozKTQgbqsQAu4c4X`（REQ075 客群管理 · Skill 重生成）。本次修改预览工具，不修改业务页面模型；没有发布 NAS 或 npm。

## 可观察结果

桌面模式填满工具栏下方区域，尺寸跟随窗口。手机默认 390×844、平板默认 768×1024，支持横竖屏；自定义模式支持输入宽高、左右边缘拖动宽度、底边拖动高度。固定视口居中展示，空间不足时仅缩放外观，iframe 的 CSS 视口保持设定尺寸。模式和尺寸写入预览路由，页面跳转和刷新后保留。

## 本地 App 验收

通过原生 App 操作控件，以公开 Desktop MCP 的 `snapshot_layout`、`get_app_state` 和 `get_screenshot`记录结果。所有尺寸单位为 CSS px；[布局检查数据](preview-viewport/layout-checks.json)独立核对实际 iframe 尺寸和导航后的路由。

| 场景 / 页面                       | 实测 iframe           | 截图观察                                                                                                                               | 结论                             |
| --------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| 桌面 / 客群列表                   | 1600×872              | [截图](preview-viewport/desktop-restored.png)：内容从工具栏下缘开始，左右铺满，无原先预览顶部空白                                      | 通过                             |
| 缩小 App 窗口 / 客群列表          | 1400×772              | [截图](preview-viewport/desktop-resized.png)：控件显示新尺寸，预览随窗口缩小；业务页面的 1440 最小宽度导致右侧内容裁切                 | 视口通过；页面最小宽度为既有约束 |
| 手机竖屏 / 客群列表               | 390×844               | [截图](preview-viewport/phone.png)：手机模式选中，视口居中，显示缩放 99%；页面在窄视口中裁切                                           | 通过                             |
| 手机横屏 / 客群列表               | 844×390               | [截图](preview-viewport/phone-landscape.png)：宽高交换，按钮变为切换竖屏，显示缩放 100%                                                | 通过                             |
| 平板竖屏 / 客群列表               | 768×1024              | [截图](preview-viewport/tablet.png)：视口居中，显示缩放 81%，实际高度仍为 1024                                                         | 通过                             |
| 平板横屏 / 客群列表               | 1024×768              | [截图](preview-viewport/tablet-landscape.png)：宽高交换，显示缩放 100%                                                                 | 通过                             |
| 自定义输入 / 客群列表             | 1280×720              | [截图](preview-viewport/custom.png)：输入后应用，宽高与 iframe 一致；空输入时应用不可用                                                | 通过                             |
| 自定义边缘拖动 / 客群列表         | 1440×720 → 1440×800   | [截图](preview-viewport/custom-drag.png)：右侧拖动改变宽度，底边拖动改变高度，另一维度保持                                             | 通过                             |
| 列表详情跳转、刷新 / 常规客群详情 | 1440×800              | [截图](preview-viewport/reloaded.png)：详情标题与返回入口正常显示，刷新后仍为自定义尺寸；路由中的业务参数和视口参数均保留              | 通过                             |
| 缩放状态下拖动 / 常规客群详情     | 1440×1024 → 1563×1024 | [截图](preview-viewport/scaled-drag.png)：缩放 81%，向右拖动物理 100px（CSS 50px）后宽度增加 123px；符合居中双边变化和 0.8125 缩放换算 | 通过                             |

最后返回客群列表并恢复桌面模式，窗口恢复后实测 1600×872。

## 代码校验

- `vitest run .../PreviewCtx.test.ts .../PreviewViewportControls.test.tsx --project studio`：2 个文件、8 项测试通过，覆盖模式、尺寸校验、横竖屏、缩放及路由持久化。
- 本次 6 个 TypeScript 文件的 ESLint 检查通过；预览文件与规范的 `git diff --check` 通过。
- WAB 生产构建、Desktop 静态资源准备与 macOS arm64 打包通过；已启动新构建进行上述操作验收。
- WAB 全量 TypeScript 检查未通过：9 项错误位于 TopFrameChrome、anonymous-chat 测试与 server/auth/routes，本次预览文件没有报错。[诊断](preview-viewport/type-errors.log)。
- `plasmic-prototype` 补充视口验收要求并同步到本地技能；`quick_validate.py` 通过。

## 范围

手机和平板模式验证的是浏览器视口尺寸。当前 REQ075 页面有 PC 最小宽度，窄视口中的裁切并不代表完成了移动端页面适配。本次没有新增移动端布局，也没有模拟移动设备 UA 或触控环境。
