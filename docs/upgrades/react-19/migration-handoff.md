# MobX 迁移暂停交接

用户要求本轮所有已做改动问题修复、验收全绿后暂停。现已满足并暂停；不得自动继续迁移，只有用户明确恢复后才启动新任务。所有3子代理和两个DeepSeek进程均已完成，未遗留实现或检查进程。

## 迁移阶段已验收基线（合并前制品）

当前接手工作区是 `/Users/yanxianliang/shiguang/plasmic`，分支 `codex/react-19-upgrade`。全部实施改动已由源提交 `4ca3eae7808b82bf73ef96a8d011e80c3b5b6313` 合入，并保留目标工作区原有功能修改；以本分支当前源码为准。原 `codex/react-19-implementation` 是归档实施分支，不要继续在两处并行实现。当前已提交合并，未推送，未安装/重装依赖。

最终本轮118个不同文件（初批98，包含已落地改动和必要修复后去重），source `62d42981a97bfba93d2a36a0d86b996ea6a6cfe33ebeb0d6754f85352da929a5`。唯一复用验收树 `/private/tmp/plasmic-react19-20261105/validation-u21/plasmic` 固定该源，不要另搭验收环境。全部118个实施区文件与冻结树逐SHA一致。制品 `/tmp/plasmic-react19-20261105/renderer-react19-zustand-compiler-u39p-final2`；已验收制品不可修改。

类型、生产构建、资源准备、归档均PASS。GP5/Complex6、保存重开、viewport各7、draft3、Docs codegen/loader各50模型0诊断全部PASS，renderer/preview错误0。完整Studio716文件全部通过，5273用例通过、4个既有跳过、0失败、0unhandled。原生及全测后源码一致。Compiler开启，实际React19 annotation10文件，不声称全应用编译。证据 `state-verification-u39p-final2.json`，完整日志 `/tmp/plasmic-react19-20261105/u39p-final2-full-studio.log`。

本轮native callback净5、wholefile0的partial迁移不当作文件清零：Switch因synthetic flex-reverse需要原indicator语义，保留原genuine observer，未加synthetic特例或吞CSS错误；其他native checkbox/toggle保留，原编辑断言全部保留。先前失败/中止日志完整保存在临时目录，不用定向通过改写原失败结果；最终以上述全测绿色为准。

## 当前分支集成检查与运行依赖

合并保留目标最新 `__canvas` selected/slot/editing/fullContent/onReveal/instance 合同与现有功能，同时保留React19、原生store、生命周期订阅；SDK JS/skinny/declarations从合并后源码重建，移除无引用生成chunk，未手合压缩产物。保留已验证GraphiQL6/Monaco0.57依赖闭包。

合并后检查：WAB完整类型通过；Studio定向14文件109用例、Host1文件4用例、Antd6全部29文件296用例通过。详细证据 `branch-integration-verification.json`。原716文件全测/原生制品是合并前迁移检查点，不冒称覆盖目标新增功能合并后的完整全测。

当前主工作区node_modules实际仍React18.3.1，代码/锁文件已是React19。遵守不重装依赖要求未改安装目录；上面的集成验证复用已有实施区React19依赖，受检源码已与主工作区逐文件核对。接手者在主工作区执行React19应用前须按新锁文件同步依赖，不能把当前旧node_modules的运行结果当React19验证。无需再找另一分支取源码。

原目标全部未提交改动已保存到git备份ref `refs/codex/backups/react19-target-premerge`，也保留stash `255d106ff51d3b6c293065265080ef0cf87f39e9`，完整三方before/after与日志在 `/tmp/plasmic-react19-20261105/branch-integration`；不要直接再次apply stash，否则会重复叠加已经合入的修改。

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
