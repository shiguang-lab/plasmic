# SearchForm 与 Select 验收

标签宽度的当前契约与后续验证见 [SearchForm labelWidth](search-form-label-width.md)；本报告中的 80px 截图是取消组件默认宽度之前的验收记录。

2026-10-04，REQ075 客群列表，项目 `2DdvqnozKTQgbqsQAu4c4X`。仅构建和打包本地 macOS arm64 App；未发布 NAS、npm 或组件库。

| 问题                   | 根因与修复                                                           | 实际验收                                                                                                                            |
| ---------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 查询上下行控件不对齐   | SearchForm 使用原生标签自适应宽度；增加共享 labelWidth，默认 80px    | 画布与展开预览的五个标签栏均宽 80px；市场、关键字输入内容均从 x=368 开始                                                            |
| 画布已展开却显示“展开” | 编辑模式强制显示全部字段，按钮仍读取运行态 collapsed                 | 文案、箭头旋转及 aria-expanded 使用相同显示状态；画布显示收起，预览实际展开/收起切换                                                |
| Select 画布缺少箭头    | 空 RenderExpr Slot 被传为 null；Antd 将 suffixIcon=null 视为显式隐藏 | 空代码组件 Slot 使用 undefined 保留默认；显式 null 仍生效，普通组件空 Slot 语义保留；画布四个下拉箭头均可见，预览市场点击出现 MX/VN |

## 截图分析

- [修复前](search-form-canvas/before.png)：1440 × 1024 画布，字段全显示，按钮仍是展开；四个 Select 缺少下拉箭头。
- [展开预览](search-form-canvas/preview-expanded.png)：1600 × 872 自适应桌面预览，五项条件显示，按钮为收起，上下行对齐。
- [折叠预览](search-form-canvas/preview-collapsed.png)：收起后仅显示市场、场景、类型，第四列留给动作，按钮为展开。
- [Select 面板](search-form-canvas/preview-select.png)：实际点击市场控件后出现 MX/VN，下拉层贴着触发器，没有遮罩或裁切。Escape 收起面板，未修改查询值。

通过公共 MCP 保存返回 revision **118**。刷新编辑器后重新读取原页面，并重新测量五个标签栏均为 80px、四个 Select 保留箭头。修复位于组件实现和画布渲染器，页面没有重建。量测摘要见 [evidence.json](search-form-canvas/evidence.json)。

当前导入的 Overseas 库版本尚未包含 labelWidth 编辑属性；没有写入不受支持的 prop。当前组件实现已取消 80px 默认值，未配置时按内容宽度显示。显式设计宽度需要导入库的属性契约更新后才能保存，库发布仍遵守用户的后续发布安排。

## 检查结果与范围

- Antd6 交互测试 58 项通过（包含默认、自定义和显式隐藏 Select 图标）。
- Overseas DOM 测试 11 项、静态/注册测试 13 项通过。
- Canvas 渲染回归测试覆盖空 Slot 与显式 null；裁剪实现及相应测试已撤销，不计入当前验收范围。
- Overseas typecheck、包构建、Canvas、Host、WAB 构建与本地 App 打包通过。相关 6 个文件 ESLint、git diff --check、skill quick_validate 通过。
- 宽泛运行 dom-utils.test.ts 时，已有 SVG “fill: currentColor” 断言失败；该处理函数及断言未修改，未宣称此文件全量通过。
- skill 补齐标签对齐、编辑/预览一致性及空 Slot 默认值要求，安装副本同步。

日志位于 `desktop/desktop-report/req075-regeneration/search-*.log`。未进行移动端全量验收或所有编辑器选择/拖拽场景验收。
