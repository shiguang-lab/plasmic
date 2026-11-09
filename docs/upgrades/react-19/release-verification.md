# React 19 最终运行链验收

当前验收包含邮件 SSR／Host、最终 SDK／CLI／CPA／Loader 消费方、独立 Preview／原生 renderer／发布 hydration，以及 Desktop 最终资源和本地安装版。性能工作按用户要求暂停；外部包发布、生产部署和回滚演练独立验收。

本地证据目录为 `/tmp/plasmic-react19-release-20261108/`。每项通过结果必须包含实际退出码、输入身份和产物身份；旧的失败日志保留，不能由后续成功覆盖为通过。更改产品源码后，重新构建所有受影响制品并验证它们的实际运行路径。

## 邮件与 Compiler

邮件 SSR、邮件 Host 与 Studio／Canvas／SDK 使用 `infer`、React 19 target、`all_errors`。所有业务函数组件和 Hooks 都要求实际转换，三个必需的薄错误边界 class 单独计数。独立候选盘点包括带显式 React 组件类型的匿名函数工厂，不把普通数据回调当作组件，也不添加虚假 Hook。

后端启动、PM2／worker 和邮件生成 CLI 共用 `platform/wab/tools/backend-register.cjs`。Node 公共模块钩子先严格编译邮件，再执行 esbuild 转换；所有邮件路径共享 WAB 的同一物理 React／ReactDOM。Node 最低版本为 22.15.0。Host 的 Vite 构建使用相同编译选项和 React 去重。

验收覆盖真实开发／生产邮件 HTML、全部通知区块、无客户端渲染回退、Host 注册及同一 DOM 节点更新。CLI 只生成 HTML，不发送邮件。候选统计以 `compiler-final-release-audit.json` 的逐文件哈希及覆盖结果为准。

## SDK、生成器与服务

最终消费方从本地真实 tarball 安装，逐项核对 tarball 哈希、生产者文件与消费方已安装文件。11 套 CPA 输出及 11 个实际新生成项目分别覆盖 React、TanStack、Next Pages／App、Loader／codegen 和 JS／TS。CLI 使用实际 WAB 代码生成输出验证 init、sync 及强制再次 sync 保留用户文件；本机协议 fixture 不等于真实线上后端。自动 JSX runtime 单独验证缺失 children、显式空值／数组及真实生成组件的嵌套状态。

CPA 在首次依赖安装前写入所选包管理器版本；脚手架原生创建命令跳过安装，由共享生命周期统一安装。外部消费应用保留其框架原生 Compiler 策略；严格编译 SDK 不等于为所有生成应用开启 Compiler。

命名 ref 的实际注册值由 SDK 命令登记表保存，事件触发时才读取，不订阅句柄身份。验收包含每次提交生成新对象的合法 `useImperativeHandle`、跨异步等待读取最新句柄、主动保留旧句柄、卸载和过期 cleanup，以及锁定原组件版本的真实项目。渲染及状态初始化只消费真实数据，不通过 ref getter 或 Proxy 隐藏可变读取。

独立 Preview 使用真实 Next standalone 生产服务、临时 PostgreSQL 和生产 Loader library 产物，覆盖发布、重新发布、撤销、链接、表单、分页／Tab／浮层、导航、查询与不可变草稿。原生 renderer 在 Linux ARM64 Docker 中验证唯一 React、公开 prepass、HTTP／HTTPS、SSR、正式 hydration 零重取与点击，以及错误、禁止 syscall、超时和子进程回收。不据此声明其它原生架构已验证。

对应报告为 `consumer/final-sdk-consumer-verification.json`、`service-integration-verification.json` 和 `service-build-inputs.json`。SDK 变更后必须重新密封受影响 tarball、消费方与服务制品，不能沿用旧哈希宣称最终通过。

## Desktop 与真实项目

使用标准 `scripts/build-studio.mjs` 构建链和 self-hosted 生产配置生成 Studio、Sub、SDK、live-frame 与发布 hydration，再由 Desktop 正式资源准备脚本检查来源。打包使用 `desktop/scripts/package.mjs --local-adhoc --output <目录>`，保留正式 ASAR、fuses 和资源校验。

两个真实保存项目通过不可变模型及依赖 fixture 重放；测试修改只写任务内存／隔离目录。验收包括打开、画板／选区、真实 DOM、重命名及样式／位置撤销重做、保存重开，以及业务 Preview 分页。复杂项目还验证连续切换组件画板、淘汰后的视图重建，以及撤销重做恢复选区和实际 DOM 样式。动态业务代码仍经过严格 Compiler，不修改持久化模型或通过跳过转换取得通过。

安装版从实际 DMG 只读挂载并复制到任务安装目录，使用新 profile 启动真实应用，验证编辑、撤销、保存、重启读取、恢复和 Preview。任务 profile 不注册系统默认协议处理程序。仅有 DMG／ZIP 构建成功不足以证明安装版通过；最终资源、包和运行报告必须对应同一源码身份。
