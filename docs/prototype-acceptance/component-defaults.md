# 组件默认行为修复与验收

2026-10-04，Ant Design 6.6.5，REQ075 客群管理，本地 Plasmic Desktop。此次修复封装组件和注册属性，不重新生成业务页面。未发布 NAS、npm 或组件库。

## 修复范围

| 组件                                  | 问题与修复                                                                                                                                                                                                 |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Form                                  | 保留显式 disabled 及 ConfigProvider 继承值；提交抛错或异步失败后恢复状态；validateFields 校验失败继续 reject；默认阻止同一时刻重复提交，明确允许并发时等待全部提交完成才恢复；完整值事件参数与注册契约一致 |
| Form.Item                             | 实现属性面板已有的精确长度 len 校验                                                                                                                                                                        |
| Modal                                 | OK 仅触发业务事件，校验、保存成功后由业务关闭；取消和关闭仍同步 open。避免校验失败时先关闭弹窗                                                                                                             |
| Table                                 | 无受控 selectedRowKeys 时保留选择，清空操作同步界面；受控模式尊重外部值                                                                                                                                    |
| Pagination                            | 初始化索引状态，不在挂载时发业务 onChange；真正翻页才发事件                                                                                                                                                |
| Select                                | 尊重 filterOption=false、optionFilterProp 和 suffixIcon=null；搜索支持 React 节点、数字标签；单选/多选的搜索默认提示与实际一致                                                                             |
| Popover / Tooltip                     | 悬停延迟使用原生默认；显式空值、null、0 不被示例内容覆盖，空 Tooltip 标题可关闭提示                                                                                                                        |
| Tabs                                  | 运行时默认启用高亮条动画；支持空或单个子节点，不只依赖注册属性的默认值                                                                                                                                     |
| Tree                                  | 移除额外强制展开逻辑和错误默认值，尊重 autoExpandParent 等原生属性                                                                                                                                         |
| DatePicker / RangePicker              | 未受控的范围选择可自行更新；尊重 value/defaultValue、清空和输入；去除强制只读及影响所有日期弹层的全局 CSS                                                                                                  |
| ColorPicker                           | onChange 实时通知颜色变化，保留独立完成事件；showText=false 有效                                                                                                                                           |
| Button / InputNumber / Checkbox.Group | 显式 htmlType 有效；数字状态使用 number 且不注入引发原生滚轮变化的 type=number；多选框组状态使用 array                                                                                                     |
| Steps / Avatar / Badge                | Steps 从第 0 步开始；Avatar 使用 circle/square；去除头像组默认截断数和 Badge 演示计数、内容污染                                                                                                            |
| Breadcrumb                            | 空、单个和隐藏子节点安全处理；尊重明确传入的 items                                                                                                                                                         |
| Upload                                | 同次多选不丢文件，异步读取完成不改变选择顺序，maxCount 保留最新文件。当前组件读取本地 base64，done 表示读取完成，未接入服务端上传；此契约已写入属性描述和 README                                           |

官方契约对照：[Form](https://ant.design/components/form/)、[Modal](https://ant.design/components/modal/)、[Select](https://ant.design/components/select/)、[Pagination](https://ant.design/components/pagination/)、[Tabs](https://ant.design/components/tabs/)、[Popover](https://ant.design/components/popover/)、[Tree](https://ant.design/components/tree/)、[DatePicker](https://ant.design/components/date-picker/)、[ColorPicker](https://ant.design/components/color-picker/)、[Upload](https://ant.design/components/upload/)。普通受控 Modal 与静态 Modal.confirm 的关闭契约不同，本次修复的是前者。

## 自动验证

- `pnpm --filter @shiguang-lab/plasmic-antd6 test:interactions`：38 项通过。使用组件包实际安装的 Antd 6.6.5；包含真实 DOM 选择、输入、校验、异步失败恢复、受控与非受控状态、多文件选择。
- `pnpm --filter @shiguang-lab/plasmic-antd6 test`：14 项通过。
- `vitest run --config desktop/desktop-report/req075-regeneration/dropdown-vitest.config.mts`：9 项通过，覆盖 Dropdown、ActionGroup、顶部菜单及行确认。
- `pnpm --filter @shiguang-lab/plasmic-overseas test`：13 项通过，覆盖 ActionGroup、AppShell、SearchForm。
- Antd6 typecheck、包构建、Canvas、Host、WAB 构建通过。Host 有 3 条体积/性能警告；jsdom 有 4 条不能解析现代 CSS 的警告，无测试失败。
- 新增行为测试及此次单独校验的组件文件 ESLint 通过。更广的 lint 仍有原有 no-shadow、unused、Modal 导入限制和 curly 问题，不宣称全包 lint 通过。相关修改 `git diff --check` 通过。
- `plasmic-prototype` 补充组件契约及本地 App 验收要求，已同步安装目录，`quick_validate.py` 通过。

证据日志在本地 `desktop/desktop-report/req075-regeneration/defaults-*.log`。DOM 测试验证事件与状态；动画和实际页面布局另由 App 截图验证。未覆盖所有原生属性组合或真实移动设备。

## App 操作与截图分析

Antd6、Canvas、Host、WAB 更新后完成资源准备及 macOS arm64 打包，退出旧 App，重新启动新包并重新打开原项目。项目 `2DdvqnozKTQgbqsQAu4c4X`，列表 `S2fCQS6U6wJM`；页面模型此次未修改。通过 CUA 操作实际预览，通过公开 Desktop MCP 截图、读取布局；每张截图的预览视口均为 1600×872 CSS px，包含 Studio 的预览工具栏。

| 区域和操作           | 实际观察与结论                                                                                                                                                                                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 列表编辑、空名称保存 | [截图](component-defaults/invalid-save.png)中名称为空，编辑弹窗及遮罩保持显示；标题、两列字段和底部按钮完整，没有提前关闭。通过关闭时机检查。现有页面使用业务条件拦截空名称，没有字段错误文案；原生 Form 必填和 len 错误反馈由 DOM 测试单独覆盖                                |
| 有效保存             | 恢复原名称后点击保存，等待原生退出动画结束，弹窗关闭；列表仍为原名称，未留下测试名称或新增数据。通过                                                                                                                                                                           |
| 列表 Tabs            | [截图](component-defaults/mine-tab.png)中“我负责的”文字和高亮条同时选中，列表变成 1001、1003、1005 等当前账号数据；布局读取到 `ant-tabs-ink-bar-animated`。切至第二页首行变成 1041；切回全部后首行恢复 1001、总量恢复 63。通过状态、筛选和页码重置检查；静态截图不测量动画帧率 |
| 行菜单及确认         | 更多菜单显示复制、停用、导出名单；点击停用出现锚定确认，点击取消后关闭，1001 仍启用。通过；Dropdown 纯 hover、移出及显式 click 覆盖另有 DOM 回归                                                                                                                               |
| 详情页               | [截图](component-defaults/detail.png)中返回列表位于标题上方独立一行，右侧类型/状态与名称分开；顶部账号和 App 来源无缺失，6 个 Tabs 未挤压。实际切换基本信息成功，点击返回客群列表后恢复初始列表。通过                                                                          |
| 最终列表             | [截图](component-defaults/list.png)显示管理员、全部客群、初始数据，无残留弹窗或确认。操作列实测 162 px，当前可见行均为 3 个入口；表头与行对齐。Table 内容高度 1357 px，自然超过视口，无独立 `ant-table-body` 高度区域。通过此次选择逻辑修改后的布局回归                        |

[布局证据](component-defaults/layout-checks.json)保留视口、表头宽度、弹窗及高亮条几何。此次没有新发布组件库，新增注册参数在旧版已导入库的属性面板中是否出现仍取决于后续库版本发布；本地运行时修复已经生效。
