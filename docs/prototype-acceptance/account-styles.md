# 预览账号切换样式验收

2026-10-04。项目 `2DdvqnozKTQgbqsQAu4c4X`，客群列表 `/req-075/groups`。已更新、打包并重启本地 App；未发布 NAS、npm 或组件库。原型页面和业务权限规则保持现有模型。

## 根因与修复

宿主的 ActionGroup、Antd6 注册包和 Overseas 注册包分别打包 Ant Design；宿主的 skinny CJS 入口与 `@react/ui` 的 ESM 深层导入也会产生独立主题上下文。ActionGroup 无法继承外层主题，使用 `rc-ant` 前缀，而其他控件使用 `ant`。CSS 变量共享 `css-var-root` 标记，独立缓存会覆盖变量并在组件卸载时删除另一处仍使用的样式。[修复前预览](account-styles/before.png) 中，切换回来后侧栏选中背景消失、菜单间距变化，行操作变黑。

- 宿主保留 ActionGroup 注册，导出共享的 Antd6 运行时；Webpack 将 Antd barrel 和 ESM 深层入口解析到同一模块图。
- Canvas 包优先复用宿主运行时；没有原生 Antd 的宿主由 Canvas 提供运行时。Antd6、Overseas 和 `@react/ui` 的实际 Antd 导入统一引用它，主题和样式缓存一致。
- 加载 Antd6/Overseas 时先在目标窗口初始化 Canvas 运行时，已有运行时则复用。该步骤同时覆盖组件元数据隐藏窗口、编辑画布和预览窗口。
- [skill 验收规则](../../ai/plasmic/references/reproducibility.md) 增加三轮完整账号切换、返回原账号后的截图比较及重新进入预览检查；已同步安装版本，校验通过。

## 实际 App 验收

最终 App 冷启动、重新打开项目和进入预览均未出现组件缺失或启动异常。预览配置为 1440×848；下列 workspace 截图为 3200×1936 屏幕像素，不等同于页面画板尺寸。

| 状态与证据                                                | 检查结果                                                                                    |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [管理员初始状态](account-styles/admin-initial.png)        | 侧栏选中浅蓝背景和菜单间距正常；表格操作为蓝色，详情/编辑/More 或复制按既有权限显示。       |
| [只读访客](account-styles/readonly.png)                   | 侧栏背景和间距保持；新建、编辑、复制、More 隐藏，蓝色详情仍正常。运营账号也实际切换并检查。 |
| [三轮后返回管理员](account-styles/admin-three-cycles.png) | 完成三次“管理员 → 运营 → 只读 → 管理员”；侧栏、Header 控件、表头及操作组样式保持。          |
| [三轮后的 More](account-styles/more.png)                  | 菜单白色背景、阴影、项目间距及危险操作红色正常。                                            |
| [三轮后的 Popconfirm](account-styles/confirm.png)         | 标题、说明、黄色确认图标、红色停用按钮及行锚点正常。取消后保持 63 条，首行仍启用。          |
| [重新进入预览](account-styles/reentered.png)              | 回到 Studio 后重新进入，侧栏和操作列保持正常，仍为 63 条，没有启动异常。                    |

[像素比较](account-styles/pixel-comparison.json)：初始管理员与三轮后、重新进入预览后的截图比较，侧栏菜单 `(168,330)..(628,520)`、表头 `(712,655)..(2966,765)`、前三行操作 `(2664,792)..(2968,1145)` 六项比较的变化像素均为 0。比较不含实时钟、账号名称和其他未指定区域。

## 命令验证

- `node --test antd6-runtime.test.cjs makePkgTypes.test.js`（Canvas 包）：7/7。实际生产 Host/Canvas/Antd6/Overseas bundle 在两种 JSX 版本、宿主提供运行时或 Canvas 提供运行时下，连续三轮挂载/卸载仍有正确前缀的基础变量及菜单变量；包含宿主组件包先于 Canvas 加载的顺序。
- `vitest run src/wab/client/components/studio/studio-bundles.test.ts`（WAB）：1/1。不同目标窗口先初始化再注册，每个窗口只初始化一次。
- Canvas `tsc --noEmit`、Antd6 Rollup/声明、相关 Canvas bundle、Host Webpack、WAB Rsbuild、本地资产准备和 App 打包通过。Webpack 仅报告 bundle 大小建议。
- 已安装 skill 的 `quick_validate.py` 通过；仓库与安装版本的新增验收规则一致。

本次真实交互与截图验收覆盖客群列表及其菜单、行确认、账号切换和预览重入；未重做其他四页的全量验收。
