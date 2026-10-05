# REQ075 Tabs 高亮条动画

2026-10-04，本地 App 项目 `2DdvqnozKTQgbqsQAu4c4X`，保存 revision **115**。未发布 NAS。

Tabs 注册默认值为 `animated=true`、`animateTabBar=true`、`animateTabContent=false`。生成源在列表和两个详情页显式传入了 `animated=false`，覆盖注册默认值并关闭高亮条动画。当前三个 Tabs 已恢复上述默认值；生成器和 skill 的 admin-design 规范同步更新。仅动画属性发生变化，页面结构、UUID、业务状态、交互、表格列宽及滚动配置均与修改前相同。

## 实际验证

- 使用本地 App 当前生产 Host/Canvas/Antd6 bundle，在隔离 JSDOM 中渲染真实注册的 Tabs 与 ConfigProvider。关闭动画的基线没有 animated ink-bar 类；恢复默认后出现该类，computed transition 包含 width/left/right，所用 `--ant-motion-duration-slow` 为 **0.3s**。点击“我负责的”后选中态和“32 条”内容匹配，没有开启内容页签动画。结果见 [runtime-check.json](tabs-animation/runtime-check.json)。
- 真实 App 点击“全部客群→我负责的→全部客群”，总数对应32/63；高亮条从x=276移动到372，宽64、高2。实际布局节点包含 `ant-tabs-ink-bar-animated`。[列表](tabs-animation/list-mine.png)。
- 常规详情点击“概览→成员→概览”；成员态高亮条x=436、宽32、高2，成员表格和字段正常。[常规详情](tabs-animation/regular-members.png)。
- 一次性详情点击“概览→基本信息→概览”；基本信息态高亮条x=340、宽64、高2，1002初始化客群信息与页签一致。[一次性详情](tabs-animation/onetime-basic.png)。
- 保存后正常退出并重启 App，重新打开项目，5个Page完整模型与保存结果逐项一致。再次在实际预览切换至“我负责的”，高亮条动画类、位置和内容正常。[重开结果](tabs-animation/reopened-mine.png)。

5份实际预览布局的断言结果见 [layout-checks.json](tabs-animation/layout-checks.json)。截图用于核对最终高亮条位置和页面内容；动画启用证据来自运行时样式类及真实生产组件的非零CSS过渡，未将静态截图当作逐帧运动证据。

`validate` 无错误、无警告；生成器 `node --check`、skill `quick_validate.py`、skill `git diff --check` 通过；已安装skill参考文件与仓库副本 `cmp` 一致。公共MCP读写、保存与重开记录位于本机 `desktop/desktop-report/req075-regeneration/tabs-animation-*`，生产组件验证脚本为该目录下 `tabs-runtime-check.cjs`。
