# Dropdown 触发方式验收

2026-10-04，本地 Plasmic Desktop，REQ075 客群管理 · Skill 重生成，项目 `2DdvqnozKTQgbqsQAu4c4X`，客群列表 `S2fCQS6U6wJM`，预览视口 1600×872 CSS px。仅更新本地 App 和原型配置，未发布 NAS、npm 或组件库。

## 规范与实现

[Ant Design 官方 Dropdown 文档](https://ant.design/components/dropdown/)规定默认 trigger 为 hover，触屏不支持 hover。当前 PC 原型的普通菜单统一使用 hover：ActionGroup 更多、新建客群、顶部语言与账号菜单。选择菜单项才执行动作。Select 等表单控件仍点击打开，Popconfirm 仍需点击后显式确认。

Antd6 Dropdown 注册包装的运行时默认值及属性提示改为 hover；Overseas ActionGroup 通过 dropdownProps 覆盖私有组件内部 click 默认值，同时尊重明确传入的 trigger；AppShell 语言与账号菜单使用 Antd 默认行为。保持原生菜单移入/移出延迟。

五个业务页面读取检查只发现客群列表的新建菜单显式配置 click，通过公开 Desktop MCP 改为 hover 并保存至 revision 116。两处列表 ActionGroup 没有显式覆盖，使用新默认值。保存后的列表与新 App 重新打开后的完整读取结果相同，[检查数据](dropdown-trigger/checks.json)。生成源中新建菜单同步为 hover。规范与交互验收要求写入 `plasmic-prototype/references/admin-design.md` 并同步到本地技能。

## App 操作与截图分析

通过 CUA 原生 App 操作，公开 Desktop MCP 截图和布局记录证据。原生工具没有独立 hover API，因此使用从空白区域开始、在触发器处结束的鼠标拖动来产生 pointer enter；没有点击触发器。React DOM 测试另外独立验证纯 mouseEnter/mouseLeave 行为。

| 检查       | 观察                                                                                                                                      | 结论 |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| 行操作更多 | 移入后出现复制、停用、导出名单；从触发器移入停用项后菜单保持打开，只有菜单项高亮，没有确认浮层。[截图](dropdown-trigger/more-enter.png)   | 通过 |
| 选择菜单项 | 点击复制后菜单关闭，出现短 Message 并新增初始化状态的临时副本；没有因悬停执行复制。验收后刷新已清除预览内副本                             | 通过 |
| 点击停用   | 菜单关闭后出现锚定于行操作的 Popconfirm，背景没有模态遮罩；原客群仍启用。点击取消后浮层关闭，未停用。[截图](dropdown-trigger/confirm.png) | 通过 |
| 顶部账号   | 移入后出现三个角色选项；没有自动切换账号，管理员仍为当前角色。[截图](dropdown-trigger/account-hover.png)                                  | 通过 |
| 顶部语言   | 移入后出现简体中文与 English，当前中文选中；离开账号区域后账号菜单关闭。[截图](dropdown-trigger/language-hover.png)                       | 通过 |
| 新建客群   | 移入后出现新建常规客群、新建一次性客群；没有自动导航或打开建群对话框。[截图](dropdown-trigger/create-hover.png)                           | 通过 |
| 离开菜单   | 指针移出新建菜单及触发器后菜单关闭，页面几何不变。[截图](dropdown-trigger/closed.png)；布局快照仍为 1600×872                              | 通过 |

最终停留在客群列表、桌面预览、管理员角色，没有残留菜单、确认或临时复制数据。

## 代码校验

- DOM 交互测试：2 个文件、9 项通过。覆盖普通 Dropdown hover 默认、菜单选择后关闭、禁用项不执行、显式 click 覆盖、ActionGroup 移入/移出、顶部菜单、Popconfirm 取消/确认与禁用状态。
- ActionGroup 现有静态渲染测试：5 项通过；Antd6 注册回归：13 项通过。
- Antd6、Overseas、Canvas、Host、WAB 生产构建通过；Desktop 资源准备、macOS arm64 打包通过，验收运行新 App。
- Dropdown 源文件及两个 DOM 测试文件 ESLint 通过；相关文件 `git diff --check` 通过。
- 两个 Overseas 源文件 ESLint 仍有 8 项已有问题：7 个 curly 格式错误及 usePlasmicLink 局部变量名触发 forbid-elements。此次修改行未引入这些错误，未宣称整体 lint 通过。
- skill `quick_validate.py` 通过。

本次未验证真实触屏设备；触屏需求须明确设置 click，不以缩窄 PC 预览替代移动端交互规范。
