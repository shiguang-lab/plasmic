# React UI 安装库

React UI 通过 Component Store → Business components 的预览卡片安装，与 Overseas 同级。安装后出现在 Installed，默认 host 和 Overseas 均不注册 ActionGroup。

独立注册包 `@shiguang-lab/plasmic-react-ui` 使用 [vendor/react-ui](../../vendor/react-ui/README.md) 中的 ActionGroup。组件保留可编辑 items、max、链接、确认以及 onAction(key) 合约；项目中的实例引用安装库。发布和目录注册见 [部署说明](../../deploy/README.md#react-ui-business-components)。

## 验证

- React UI：5 项注册及行为测试、4 项确认行为测试通过。
- 两套浏览器运行包验证默认 host 和 Overseas 不注册 ActionGroup，安装 React UI 后注册独立组件，max=3 显示详情、编辑、更多。
- 原生 hostless 项目创建测试确认 ActionGroup 的名称、importPath 和事件合约。
- Rollup、类型声明、Canvas 运行包和 App host 构建通过。

## 当前项目验收

2026-10-05，项目 `2DdvqnozKTQgbqsQAu4c4X` 通过公开 Desktop MCP 安装 React UI（库项目 `vJfWZAFzStvt61gEWotC7k`），保存为 revision **138**。

两个操作列的 ActionGroup 均引用安装库，items、max、onAction 的完整数据保持一致；页面状态、交互及路由保持一致。旧的本地组件定义已删除。严格 HTML 导入移除了不适用于代码组件的 object-fit 默认样式，保留 max-width。结构校验无错误、无警告。

重开新版客户端后，完整页面读取与保存结果深度比较一致，安装库存在，本地定义不存在。[重开截图](react-ui-installation/reopened.png) 展示客群列表，详情、编辑、更多及直接复制操作正常显示，操作列布局保持一致。截图只验证渲染；业务点击未重新人工点检，组件行为测试覆盖未改变的合约。

共享运行环境加载测试覆盖 React UI 单独安装，以及与 Ant Design、Overseas 一起安装，两项通过。Mac 锁屏阻止原生菜单点击验收；已通过公开 MCP 的原生依赖安装操作确认安装成功。

NAS 的 server/web 已更新至 **0.0.31**，两个服务健康。线上 React UI 预览图、运行包及 Studio 共享环境加载模块访问和内容检查通过。新版本地客户端已打包并重开当前项目。
