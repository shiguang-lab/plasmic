# React UI 安装库

React UI 通过 Component Store → Business components 的预览卡片安装，与 Overseas 同级。安装后出现在 Installed，默认 host 和 Overseas 均不注册 ActionGroup。

独立注册包 `@shiguang-lab/plasmic-react-ui` 使用 [vendor/react-ui](../../vendor/react-ui/README.md) 中的 ActionGroup。组件保留可编辑 items、max、链接、确认以及 onAction(key) 合约；项目中的实例引用安装库。发布和目录注册见 [部署说明](../../deploy/README.md#react-ui-business-components)。

## 验证

- React UI：5 项注册及行为测试、4 项确认行为测试通过。
- 两套浏览器运行包验证默认 host 和 Overseas 不注册 ActionGroup，安装 React UI 后注册独立组件，max=3 显示详情、编辑、更多。
- 原生 hostless 项目创建测试确认 ActionGroup 的名称、importPath 和事件合约。
- Rollup、类型声明、Canvas 运行包和 App host 构建通过。
