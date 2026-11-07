# QueryBuilder

当前实现统一使用 `react-querybuilder` 8.26.0 及其官方 Antd、DnD 和 core 包。

## 数据合同

- Host 的 `QueryBuilderConfig.fields` 使用原生 `Field[]`，每个字段声明真实的 `name`、`label`、`datatype`、输入形式和允许的原生操作符。
- 数据源 `Filters` 只保存 `{tree: RuleGroupType, fields: Field[]}`。组使用 `combinator/not/rules`，规则使用标量或数组 `value`；不另存派生的 JsonLogic。
- 组件与函数的业务值、分群条件继续使用 JsonLogic。编辑器使用上游导入和导出工具读写这个合同，不经过其他查询树。
- Studio 表达式仍通过现有模型和绑定 ID 保存。范围两端使用同一个值编辑器，可以独立绑定。列表使用原生数组值。
- 空查询移除筛选；未填完的规则不会覆盖已有业务 JsonLogic；未知导入条件明确报错，避免保存部分条件。
- SQL 从原生树生成，按字段数据类型决定是否解析数字；动态值经过已有的 SQL 参数绑定流程。
- 不允许分组的 CMS 配置通过 `showAddGroupAction: false` 关闭添加分组；AND-only 与 NOT 限制分别通过原生 combinators 和 showNotToggle 声明。

## 范围

覆盖数据源编辑与标准查询、SQL、Airtable、Fake 数据源、组件属性、分群以及 CMS、Strapi、Contentful、WordPress 注册配置。旧查询库依赖和双向树转换层均不在运行时或锁文件中。维护中的三个项目夹具及服务器测试模板已经转换。

这是持久化合同变更，当前代码只读取原生格式。根据本次线上存量检查，本次上线不安排 QueryBuilder 数据迁移任务。

## 线上存量检查（2026-11-06）

通过 NAS 线上服务实际使用的 `wab` 数据库进行只读查询：数据源配置 `data_source` 和查询操作 `data_source_operation` 均为 0 条，包含已删除记录。92 份最新项目记录和 113 个发布版本中均未发现旧筛选树、数据源模板或数据源操作表达式。

较老历史修订中已核对的 500 份未发现旧筛选树；其余历史修订扫描超时，未完成全量核对。以上结论针对当前线上数据，不将未查完的历史记录记为已通过。检查未改写数据，也未执行数据迁移。

## 验证

定向验证包括原生树编辑与只读控制、动态表达式和范围端点、AND/OR/NOT、空值、零和 false、文本转义、数字文本、日期、列表、SQL 参数绑定、Airtable/Fake 执行、四个 CMS 的查询转换、Host 公开类型和保留夹具的模型引用及代码生成。

运行日志位于 `/tmp/plasmic-react19-20261105/querybuilder-migration`。完整 Studio 功能验收、发布和真实数据库变更不属于本次定向验证。

| 检查 | 结果 | 日志 |
| --- | --- | --- |
| 原生查询树、组合表达式、编辑、只读、DnD | 38 项通过 | `native-final.log` |
| 保留夹具引用、模型与代码生成；数据源表达式 | 10 项通过 | `studio-final.log` |
| 服务器 SQL 参数绑定、Airtable、Fake | 17 项通过 | `server-final.log` |
| 四个 CMS 包的配置和查询转换 | 24 项通过 | `cms-tests.log` |
| Host 公开类型 | 56 项、173 个断言通过 | `host-types-final.log` |
| Host 构建；四个 CMS 包构建及类型检查 | 通过 | `host-build-final.log`、各包 `*-build.log`、`*-types.log` |
| 本次 TS 文件 ESLint | 无错误；保留 7 条空函数测试/既有代码警告 | `eslint-final.log` |
| WAB 完整类型检查 | 未通过：`canvas-model-inputs.ts` 两处并行迁移错误；没有 QueryBuilder 诊断 | `typecheck-final.log` |

根与 platform 安装状态均通过 `verify-deps-before-run=error` 检查；两份锁文件无旧查询库依赖。

## 主题

QueryBuilder 复用 Studio 现有的 Antd/antd-style 主题上下文。`QueryBuilder.styles.ts` 从同一套 token 设置字体、分组背景、边框、圆角、间距、连接线及普通/复制/分组拖拽提示。属性与数据源编辑器的外围分隔线和留白也使用这些 token。

值编辑器、字段/操作符选择器、开关和操作按钮使用 Antd 原生主题与交互状态，局部 SCSS 只负责布局。属性行的旧样式排除 QueryBuilder，避免覆写它的焦点、禁用态、字体和控件尺寸；其他属性控件继续使用原有样式。

弹层保留 Antd 的正常 portal 和主题上下文，无独立主题配置。定向测试加载真实的局部与全局样式，将 QueryBuilder 中的控件和原生 Antd 参照控件逐项比较，并在深色、浅色、再次深色之间切换。覆盖普通/hover/focus/disabled、下拉选项及日期/时间弹层、自定义主题 token。

`theme-tests3.log`：4 个文件、44 项测试通过。`theme-eslint.log`：主题改动的 TS 文件 ESLint 通过。`theme-typecheck-final.log`：WAB 类型检查只有并行工作中的 `plasmicpkgs/antd6/src/registerSelect.tsx:50` 缺少 React 导入错误，无本次主题改动诊断。测试输出另保留一条 `TimeoutNaNWarning`，未过滤该警告，测试通过。

`theme-shared-regression.log`：共享产品主题的 8 项交互回归通过。本次合计 52 项定向测试通过。
