# REQ075 按钮图标验收

项目 `b1VPmGnbGvyKc4rnA2xLVv` 的客群列表 `Ne1KXZPJ2Up_` 使用独立 SVG Icon 节点，保存 revision **158**。

- 新建客群：Button.icon 放置 PlusOutlined，文字旁放置 DownOutlined。
- 全部客群及我负责的行操作：Button.icon 放置 DownOutlined，iconPlacement=end，文案仅为“更多”。
- 图形使用已安装 `@ant-design/icons-svg` 的官方路径，currentColor 继承按钮颜色。四个 SVG 节点及其 Slot 可通过 Studio/MCP 编辑，不使用文本字符模拟图标。
- Dropdown 父节点、菜单配置、事件及页面状态保持；运行预览中新建菜单显示常规/一次性客群，更多菜单显示复制/停用/导出名单。
- 页面 validate 无错误或警告；保存后重开检查模型及截图。

生成规则已同步到仓库 MCP guide、prototype Skill 及本机已安装 Skill，要求图标使用独立节点，并检查实际交付页面及菜单交互。桌面包使用现有正式 0.0.27 画布资源。

证据目录：`desktop/desktop-report/button-icons/`，包含修改前后及重开模型、公开 MCP 操作记录、实际菜单预览和画布截图。
