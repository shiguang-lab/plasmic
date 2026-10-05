# 组件规范追加检查

2026-10-04，接续[首轮检查](component-defaults.md)。对照当前安装的 Ant Design 6.6.5，继续检查注册契约、原生默认值、Slot 和弹层样式。本轮只更新本地 App、skill 及原型验收，未发布 NAS、npm 或组件库。

## 新发现及修复

| 范围                                 | 实际问题                                                                                                | 修复与验证                                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Modal 页脚、宽度                     | footer=null 被改成 undefined，重新出现默认按钮；0 和响应式宽度对象丢失                                  | 保留原生值，DOM 检查无页脚、0px 和断点宽度 CSS 变量                                                |
| Modal 遮罩                           | mask=true 时 closeOnOutsideClick 覆盖被忽略                                                             | 区分遮罩启用与关闭条件；真实 mousedown/click 验证 false 不关闭、true 发取消事件                    |
| Drawer                               | 原生 rootClassName 被 Studio scope 覆盖，编辑器 reset 属性传入原生 DOM                                  | 合并 root 和 panel 类名，排除编辑器专用属性                                                        |
| Select、日期、Tooltip、Popover、Tabs | 原生 classNames 与 Studio scope 相互覆盖；回调形式及子区域样式丢失                                      | 保留函数/对象形式及嵌套弹层类名，6 类组件 DOM 验证原生样式类与 Studio 类并存                       |
| RangePicker                          | 省略 disabled 仍传入端点数组，阻断 ConfigProvider 禁用继承；false 被端点配置覆盖                        | 省略时继承，显式整体值优先，只有未设置整体值时使用端点配置；allowEmpty 使用同样的明确覆盖规则      |
| Select / TreeSelect                  | 多选结果是数组，但状态声明为文本；tags 初始值不支持多选                                                 | 通用状态/事件支持标量、数组或带标签对象；tags 开启多选默认值编辑，真实选择两项再清空验证数组不丢失 |
| Menu                                 | onSelect 注册成字符串，实际返回选择信息对象；子菜单 key 编辑被隐藏                                      | 保持原生 info 对象参数，子菜单可配置稳定 key                                                       |
| Rate                                 | 多符号模式过滤文本、丢失数组；0 被当成未配置；默认 5 项时提示标签不可编辑，校验不执行；hover 事件漏参数 | 接受单节点、数组、文本；尊重 0；按实际符号数量或原生 5 项校验提示标签，声明数值 hover 参数         |
| Progress                             | 省略 type 时步进颜色不起作用，successPercent=0 被丢弃                                                   | 使用原生 line 默认，保留零成功段                                                                   |
| 原型字段校验                         | 名称为空时仅阻止保存，没有字段错误说明                                                                  | 增加就地错误信息；App 中验证空白字符串报错、保存被阻止，恢复名称后提示消失且保存关闭               |
| ActionGroup                          | 更多按钮尺寸仍提供旧版 middle                                                                           | 注册选项改为 small/medium/large，与 Antd 6 一致                                                    |

官方契约：[Modal](https://ant.design/components/modal/)、[Drawer](https://ant.design/components/drawer/)、[Select](https://ant.design/components/select/)、[TreeSelect](https://ant.design/components/tree-select/)、[Menu](https://ant.design/components/menu/)、[Rate](https://ant.design/components/rate/)、[Progress](https://ant.design/components/progress/)。语义样式合并还对照已安装版本的声明和真实 DOM，不根据外观推断回调参数。

额外阅读检查了 Collapse、Segmented、Radio、Switch、Slider、Cascader、Transfer、Calendar、TimePicker、TimeRangePicker 及 Overseas SearchForm/AppShell。未发现需要替换其原生默认交互的证据；未把业务默认值或缺少某个可选原生属性一律当成缺陷。此轮不代表覆盖所有组件、属性组合和移动端交互。

## 自动验收

- 新增 `tests/remaining-contracts.test.tsx` 19 项；修复前首次运行有 12 项失败，修复后完整组件交互检查 57 项通过。
- Antd6 注册/静态检查 14 项、Overseas 13 项、Dropdown/确认 DOM 9 项通过，本轮合计 93 项。
- Antd6 typecheck、Overseas 与 Antd6 包构建、Canvas、Host、WAB 构建通过。
- 新增测试及此次单独校验的 9 个组件源文件 ESLint 通过，相关 `git diff --check` 通过。原有跨文件 lint 问题参见首轮记录，未宣称全包 lint 通过。
- skill 契约增加弹层语义类合并、整体/端点覆盖、多模式状态、原生事件形状及符号数量要求；安装副本同步，quick_validate 通过。

完整命令日志在本地 `desktop/desktop-report/req075-regeneration/remaining-*.log`。jsdom 不测量弹层真实位置和动画，因此下面另记本地 App 操作及截图观察。

## 本地 App 截图验收

重新构建并打包 macOS arm64 App，应用更新后的组件注册属性。原型保存结果为 revision **118**；退出预览、刷新编辑器后通过公共 MCP 重新读取，确认字段错误的显示条件和两处 ActionGroup 的 `moreButtonSize=medium` 均保留。生成源同步相同配置。

- 在 1600 × 872 桌面预览打开首行编辑，将名称改成三个空格，点击保存：弹窗保持打开，名称下方显示“请输入客群名称”。[错误截图](component-defaults-followup/invalid-name.png)
- 恢复原名称后错误消失；负责人 Select 弹层显示两个选项，未被遮罩遮挡或裁切。布局数据确认弹层宽 288px、高 72px，保留原生 `ant-select-dropdown` 与项目 reset/token/popup 类。按 Escape 收起后保存，弹窗关闭。[选择器截图](component-defaults-followup/select-popup.png)
- 最终列表保留原名称、管理员账号、第一页；操作区域仍最多 3 个入口，滚动使用内容区域。[列表截图](component-defaults-followup/list.png)

截图已人工查看，布局与保存摘要见 [evidence.json](component-defaults-followup/evidence.json)。原型没有使用 Rate、Drawer 和所有日期配置组合，这些分支通过真实 Antd6 DOM 测试验证，不冒充 App 页面截图覆盖。未进行移动端全量验收或 NAS 发布。
