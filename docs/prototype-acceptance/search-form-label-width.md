# SearchForm labelWidth 验收

2026-10-04。组件和注册契约使用可选 `labelWidth?: number`，没有固定默认值。未配置时每个标签随内容宽度；配置数值后统一标签栏宽度；清除后恢复内容宽度。AI 根据全部标签、冒号和必填标记选择单行宽度，显式写入页面。

## 已保存页面

REQ075 客群列表：项目 `2DdvqnozKTQgbqsQAu4c4X`，页面 `S2fCQS6U6wJM`，SearchForm 实例 `yd6UFaD_ANvW`。Overseas 导入库已升级至 **1.2.0**，SearchForm 属性契约包含 numeric `labelWidth`，没有默认值。当前表单显式设置 **72px**；保存后重新打开读取确认，项目 revision **122**。

通过原生 hostless 同步流程更新组件库定义，预检查事务回滚后再应用。范围断言确认仅新增 SearchForm 的 `labelWidth` 属性；原有三个组件 UUID、字段和插槽保留。页面的 states 和 interactions 与修改前逐项相等。NAS 服务、应用镜像和 npm 包没有更新；没有发布业务页面。

## 实际验证

- `tsx --test src/search-form.test.tsx`：6 项通过，包含注册属性类型以及无 defaultValue 的断言。
- 本地 App 的当前业务页面设置 96px 后，五个标签栏全部为 96px；将参数设为 undefined 后，两字标签恢复 45.875px，三字“关键字”恢复 61.875px。再设置 72px 并保存、重新打开，五个标签栏均为 72×32px。见 [量测](search-form-label-width/connected-measurements.json)。
- 编辑画布视口 **1440×1024**：[截图](search-form-label-width/app-configured.png)中“市场”和下一行“关键字”的控件起点一致；五个标签完整单行显示，Select 的默认箭头可见。snapshot_layout 断言首列上下两行控件 x 坐标均为 348px。
- 真实交互预览采用桌面自适应窗口，实际视口 **1600×872**。点击展开后，五个标签栏全部为 72×32px，首列上下行控件起点一致。[预览截图](search-form-label-width/preview-configured.png)按 1440px 输出，检查标签完整单行、下拉箭头和“收起”状态；几何断言来自实际预览 DOM。
- 从图层树选择 queryForm，属性面板显示 **Label width = 72**，输入控件可编辑。见 [属性面板](search-form-label-width/property-panel.png)。

源代码仍使用 `Form.labelCol.flex` 实现标签宽度，没有按页面硬编码组件默认值。源码及用法见 [SearchForm](../../plasmicpkgs/overseas/src/SearchForm.tsx)、[注册定义](../../plasmicpkgs/overseas/src/registerSearchForm.tsx)、[使用文档](../search-form.md)。当前模型、量测、截图、MCP 操作和原生同步记录位于 `desktop/desktop-report/req075-regeneration/label-width-*`。
