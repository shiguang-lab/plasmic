# AI 读写区域反馈（本地 App）

## 行为

- Studio 的 AI/MCP `read`、`readVector`、`queryElements` 显示蓝色区域扫描；编辑操作及 `executeBatch` 显示紫色扫描。
- 页面请求覆盖对应画板，元素请求通过渲染节点定位对应模块。移动/复制同时标识源和目标；没有独立 DOM 的节点使用最近可渲染祖先，并注明“所在区域”。
- 区域标签和画布顶部状态显示目标名称、读取/编辑/完成/失败。失败使用红色提示。画布未展示的页面或注册组件仍能在顶部看到目标名称。
- 同一节点共用一个扫描层，按请求引用计数；单次批量操作重复指向同一节点只计一次。React key 使用节点身份，新的引用加入或旧引用释放时复用原扫描 DOM。
- 短操作最少显示 1.6 秒；长操作保持提示直至结束，并保留至少 400 毫秒。请求返回不等待动画。各请求独立释放引用，计数归零移除扫描层；关闭 Studio 取消全部计时器。完成回调重复调用不会重复释放或创建计时器。
- 同一区域仍有操作运行时，优先显示运行中的编辑或读取，不会被另一个请求的完成/失败提前覆盖。
- 区域随真实 DOM 位置更新，裁切到画板及内部滚动容器。边框和标签随画布缩放保持可读尺寸；减少动态效果的系统设置使用静态提示。
- 提示不拦截指针、不改变选中状态，不属于 Site 数据、撤销记录或画板导出内容。

## 验证

本地构建、打包并重启 macOS App 后，通过 Desktop MCP 检查项目 `b1VPmGnbGvyKc4rnA2xLVv` 的 `REQ075 客群列表`：

| 检查            | 结果 / 证据（仓库内本地验收目录）                                             |
| --------------- | ----------------------------------------------------------------------------- |
| 页面读取        | `desktop/desktop-report/req075-pc/scan-page-0.png`：蓝色扫描覆盖整张画板      |
| 查询模块读取    | `scan-module-0.png`：只覆盖 `querySearchForm`                                 |
| 查询模块编辑    | `scan-edit-0.png`：紫色扫描覆盖同一模块；使用空 styles 验证编辑入口，不改设计 |
| 自动清理        | `scan-cleared-0.png`：状态条及区域扫描均已消失                                |
| 45% / 100% 缩放 | `scan-module-0.png`、`scan-zoom-0.png`：模块定位与缩放后的真实内容一致        |
| 扫描线实际显示  | `scan-zoom-0.png`：扫过查询区域的蓝色线及渐变可见                             |
| 画板导出        | `scan-clean-export-0.png`：没有扫描、区域标签或状态条                         |
| 设计数据        | `scan-page-before.json` 与 `scan-page-after.json` 深度比较完全一致            |
| 模型校验        | `scan-validate.json`：valid=true，errors=[]，warnings=[]                      |

运行 `vitest` 的 `activity.test.ts`、`CopilotActivityOverlay.test.tsx`、`prototype.test.ts`：38 项通过。覆盖并发引用计数、重复批量目标、旧计时器与新引用交错、完成回调幂等、单扫描 DOM 复用及归零清理，以及长操作、失败、卸载清理、批量源/目标、滚动裁切、实际工具入口及读取不写模型。

计数修复已在重新打包并真实重启的 App 中验证：项目 `2DdvqnozKTQgbqsQAu4c4X`，`queryForm` 节点 `Qckeyg6xJQIc`，并发3次读取，每次携带5个相同节点目标。

- [重叠请求截图](/Users/yanxianliang/shiguang/plasmic/docs/prototype-acceptance/ai-canvas-feedback/scan-count-overlap.png)：顶部显示3项操作，查询模块只有一份蓝色扫描边框、扫描线和标签。
- [清理后截图](/Users/yanxianliang/shiguang/plasmic/docs/prototype-acceptance/ai-canvas-feedback/scan-count-cleared.png)：所有引用到期后，区域扫描及顶部状态消失。原生编辑器的节点选择框不属于扫描层。
- 读取前后公开模型深度比较完全相同；单扫描 DOM 测试验证一个请求先结束不会移除另一个请求的区域，最后引用到期后 DOM 数量归零。

WAB 生产构建、Desktop 资源准备及 darwin/arm64 打包通过。本次修改没有 TypeScript 报错；全量 `tsc --noEmit --incremental` 仍被现有的 `TopFrameChrome.hiddenByModal`、anonymous-chat 缺失导出/enterprise 模块、auth.routes 的 desktopOAuth Session 类型错误阻断。

仅在本地 App 验证，未发布 NAS。pen.dev 当时未打开文件，参考的是用户描述的扫描反馈行为。
