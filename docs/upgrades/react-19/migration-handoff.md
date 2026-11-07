# MobX 迁移暂停交接

用户要求本轮所有已做改动问题修复、验收全绿后暂停。现已满足并暂停；不得自动继续迁移，只有用户明确恢复后才启动新任务。所有3子代理和两个DeepSeek进程均已完成，未遗留实现或检查进程。

## 当前已验收基线

唯一实施区 `/Users/yanxianliang/.codex/worktrees/react-19-upgrade/plasmic`，分支 `codex/react-19-implementation`，HEAD `32df7af09a1df7d119143b546f14a81b6d876c83`。桌面cwd是另一个工作区。没有安装/重装依赖、提交、推送。

最终本轮118个不同文件（初批98，包含已落地改动和必要修复后去重），source `62d42981a97bfba93d2a36a0d86b996ea6a6cfe33ebeb0d6754f85352da929a5`。唯一复用验收树 `/private/tmp/plasmic-react19-20261105/validation-u21/plasmic` 固定该源，不要另搭验收环境。全部118个实施区文件与冻结树逐SHA一致。制品 `/tmp/plasmic-react19-20261105/renderer-react19-zustand-compiler-u39p-final2`；已验收制品不可修改。

类型、生产构建、资源准备、归档均PASS。GP5/Complex6、保存重开、viewport各7、draft3、Docs codegen/loader各50模型0诊断全部PASS，renderer/preview错误0。完整Studio716文件全部通过，5273用例通过、4个既有跳过、0失败、0unhandled。原生及全测后源码一致。Compiler开启，实际React19 annotation10文件，不声称全应用编译。证据 `state-verification-u39p-final2.json`，完整日志 `/tmp/plasmic-react19-20261105/u39p-final2-full-studio.log`。

本轮native callback净5、wholefile0的partial迁移不当作文件清零：Switch因synthetic flex-reverse需要原indicator语义，保留原genuine observer，未加synthetic特例或吞CSS错误；其他native checkbox/toggle保留，原编辑断言全部保留。先前失败/中止日志完整保存在临时目录，不用定向通过改写原失败结果；最终以上述全测绿色为准。

## 当前剩余与恢复条件

最新实扫221个旧依赖文件：178生产、42测试、1工具，另1依赖manifest；迁移整体尚未完成。`verification-queue.json` baseline已前移u39p-final2，当前已接入待验批次为空，计数0。恢复后继续简单同类批量，DeepSeek与子代理互不重叠并行；重验收累计50～100不同文件，核心窄测及时做。实现可并行，重检查单进程错峰，避免多Vite/typed lint争资源。

已有测试库是Docker `plasmic-react19-tests-u17`，映射127.0.0.1:55436，不是5432。完整/数据库测试必须带 `WAB_TEST_SUPER_DATABASE_URI=postgresql://superwab@127.0.0.1:55436/postgres` 与 `WAB_TEST_DATABASE_URI=postgresql://wab@127.0.0.1:55436/postgres`。不重建环境、不停止该原有服务。最终全测脚本 `u39p-final2-full-studio.py` 已包含这两个变量。

## 未应用草稿

以下只保留，不计迁移完成、不并入当前源码：

- `/tmp/plasmic-react19-20261105/lint-domain-native-private`：11文件，before/LIVE已核一致，runtime未跑；明确缺FrameContextData-only动态choice producer，root标held，不能把overlay类型检查当原项目验证。
- `/tmp/plasmic-react19-20261105/frame-layout-native-private`：6文件，before/LIVE已核一致，AST/applycheck仅静态；runtime未跑，GridFramesLayout外层必须保留对未承接caller callback的真实观察。

DeepSeek控制日志在 `dsh-control/lint-domain-batch` 和 `dsh-control/frame-layout-batch`，均completed/exit0，禁止自动续派。API key只运行时读取本机配置，不能打印。

## 实施约束

无通用属性追踪、全局revision、MobX桥、全Site/全Map克隆、observer改名、readonly模型违规写入、测试别名环境或伪IRSH。保真实命令、保存撤销、旧world/异步生命周期、原alias/duplicateUUID/缺失值语义。未完整闭合的真模型observer保留。不得为数字盲删依赖或弱化测试。
