# SearchForm

Library: [Overseas](../index.md).

| Registered component | Registration key |
| --- | --- |
| SearchForm | `plasmic-overseas-search-form` |
| SearchForm.Item | `plasmic-overseas-search-form-item` |

设计来源为 fintechgrowthui 的 SearchForm；该来源不是任务必需的本地文件。Overseas 实现保留查询卡片、24 栅格、末行右侧操作、展开/收起、字段初始值及业务清除值语义，使用 Ant Design 6。输入控件由画布节点提供。

## 可编辑结构

Read [SearchForm.Item](search-form.md#searchformitem) for field Props, control value/event mapping and label/help Slots.

`plasmic-overseas-search-form` 的 Fields (`children`) Slot 放置 `plasmic-overseas-search-form-item` 实例。一个实例代表一个字段，字段顺序就是画布节点顺序。插入、复制、删除、移动和修改通过 Studio/MCP 的现有节点操作完成，无独立的字段数组或另一套简化模式。

SearchForm 提供 Extra actions (`extraActions`) Slot，用于查询辅助操作，位于查询/重置之后。新建、导入等业务动作按[列表组合](../compositions/search-table.md#query-and-list-structure)放置，不因存在此 Slot 就放入查询操作列。内置按钮文本通过属性编辑，其行为固定为提交和重置。

## 布局与状态

先按[业务内容与视觉适配](../../../requirement-alignment.md#content-before-presentation)确定完整筛选字段，并在现有 `components` 清单中逐项记录 Item 的业务键、标签、来源和 SearchForm Slot 归属，再选择列数。列数只规定排版密度，不限制字段总数；不能通过漏项、删项、合并不同字段或移到无关的全局控件来凑满一行。超过一行的字段保留真实 Item，由原生换行与折叠承接；需求明确移除字段时才更新字段清单。

常规生成只有四列和三列两种模式。`colSpan` 是每个字段占用的 24 栅格份数，不是列数：四列写 `colSpan=6`，三列写 `colSpan=8`；不能把“四列”写成 `colSpan=4`。

生成前按以下顺序选择，后续调整使用同一依据：

1. 需求文档明确规定列数或栅格时按文档执行；四列、三列以外的配置也必须有该文档的明确要求，并按[来源例外](../../../design/component-policy.md#protected-configuration)记录原文、哈希和属性覆盖。
2. 文档未指定时，只有视觉稿的筛选字段明确排成多行、每行按三列对齐，才选择三列 `colSpan=8`。读取原图，在现有 reference-region `decision` 中记录画板、视口和多行三列的观察。只数筛选字段，不把查询/重置操作当成字段；末行不满时仍按三列对齐。
3. 其他情况固定选择四列 `colSpan=6`：包括没有视觉稿、布局不清楚、单行三个字段，以及视觉稿显示其他列数。其他列数只是无效的视觉输入，忽略该排列并按四列重排，不照搬为新的模式，也不为了把所有字段塞在一行而压窄列宽。

在生成前的 `components` 中记录选定的真实 `props.colSpan` 和来源；三列是受支持的常规模式，不需要伪造需求文档来申请例外。静态脚本核对模式与保存值，不能证明原图确实满足“多行三列”，该判断保留原图证据并独立审查。原生 API 的其他栅格值保留给需求文档明确要求的例外，不作为模型自行选型的候选。

两种常规模式均采用 `minRows=1` 和运行态初始 `collapsed=true`，Item 不覆盖 span，继承选定列宽。选择三列不代表初始展开或常驻多行；这些初始状态只有明确需求才允许覆盖。动作使用末行剩余栅格；末行占满时换行。超出 minRows 时提供折叠；折叠至少保留第一个字段。小屏保持原组件 xs=24、sm=12、md=指定 span 的响应式栅格。

`Item.span` 优先于 `Form.colSpan`，因此检查每个字段的有效 span，不能混合三列与四列模式。跨列例外须有需求文档明确要求，在生成前按 Item 声明 `props.span` 和有真实文件、原文、哈希的 `overrides.span`。日期区间、长 placeholder、字段数量或可用空白都不自动授权跨列；不能先扩大字段再改期望清单放行。栅格 span 不是固定像素上限，实际宽度仍取决于容器、gutter 与 labelWidth；后者按最长真实标签测量，不冻结为示例数值。

`labelWidth` 是可选的共享标签栏宽度，单位为 px，没有固定默认值；选中 SearchForm 后在属性面板的 Label width 中修改，导入库的契约必须包含它。

未配置 `labelWidth` 时，各标签按内容宽度显示；配置后所有 Item 使用共享宽度。生成前检查全部标签，包括初始折叠字段、自定义标签、必填和帮助标记、组件生成的冒号及其原生间距；按实际字体和最长标签选择足够的单行宽度，并确认目标视口仍有可用的控件空间。标签变化后重新评估整个表单，不把页面选择的宽度写入组件默认值。标签使用纯文本，不手动追加冒号、空格或 CSS 偏移来补偿窄标签栏。

编辑器强制展开时必须显示“收起”、向上指示和 `aria-expanded=true`；Preview 使用实际 collapsed 状态。检查短/长标签的控件起点、完整单行文字、冒号到控件的原生间距，以及双向展开/收起；清除 labelWidth 后恢复内容宽度，不裁切或省略标签。

卡片使用主题背景和边框，内边距 16px/20px、圆角 8px，默认下间距 16px；父级已有 gap 时设置 marginBottom=0。`embedded` 移除卡片和外间距。className 接收画布样式。

编辑画布展示全部字段，便于选取和修改；交互预览/运行态遵循 collapsed。折叠仅隐藏列，字段不卸载，初始值、校验和提交均包含折叠字段。若折叠区字段校验失败，表单请求展开，以显示可修改的错误字段。

初始值优先级为 Item.initialValue > Form.initialValues > Item.clearValue，保留 0、false 和空字符串。运行中的初始值用于初始化及重置，不覆盖用户当前草稿；编辑器修改默认值会更新字段预览。重置先恢复初始值，再用明确设置的 clearValue 覆盖；输入清除至 null/undefined 也恢复 clearValue。

`onSearch(values)` 在校验通过后返回全部已注册字段；`onReset(values)` 返回重置后的值；`onValuesChange(values)` 提供当前草稿（包含折叠字段），对应 readonly `values` 状态。查询不会自动改变应用的数据；页面交互将提交值赋给 appliedFilters 并将 page 设为 1。重置事件做同样的应用状态更新。`collapsed` 为可写状态；ref actions 为 `submit()`、`reset()`、`setFieldsValue(values)`。

## 页面生成

每个查询字段默认提供可见的 `label` 或真实 `labelContent`，包括关键词输入；placeholder 仅作为输入提示，不能替代标签，也不能为了给输入框更多空间而把 label 清空。标签文本从业务字段含义确定，并重新测量整个表单的 labelWidth。明确要求无标签的特殊搜索入口需在 source-reviewed Item 的 `props.label:""` 和来源中单独声明；参考图中只有 placeholder 不自动构成这一例外。

标准列表保留 `minRows=1`。只有需求明确要求初始展开并保留收起按钮时，才通过来源例外设置 `collapsed=false`，不要通过增加 minRows 实现初始展开。五个 span=6 的字段跨两行：minRows=1 显示展开/收起，minRows=2 会使两行全部成为常驻区域而不显示按钮；只有明确批准常驻两行时才在计划中声明后者。编辑器强制展示全部字段与运行态的折叠设置分别验收。

后台四列组合（colSpan=6、minRows=1）只有三个普通字段时，查询/重置位于同一行第四格，不显示多余的展开控件。检查 Item 的实际 span；日期范围等较宽控件也保持继承，只有明确的来源例外允许跨列，可用空白不构成修改理由。

列表查询区统一使用 Overseas SearchForm，按需求插入真实 Item 和 Antd6 控件，默认四列 colSpan=6。不得生成另一套原生查询网格、重复查询按钮，或不可编辑的 fields/element JSON。生成前读取目标已安装 Overseas 和 Antd6 契约；依赖准备遵循[库选择](../../index.md)，缺少能力时明确报告，不把组件升级或发布作为默认修复。字段增删排序使用节点操作，查询/重置事件接页面状态。

```html
<plasmic-component
  data-plasmic-component="plasmic-overseas-search-form"
  data-props='{"colSpan":6,"labelWidth":72,"marginBottom":0}'
>
  <slot name="children">
    <plasmic-component
      data-plasmic-component="plasmic-overseas-search-form-item"
      data-props='{"name":"keyword","label":"关键词"}'
    >
      <slot name="children">
        <plasmic-component
          data-plasmic-component="plasmic-antd6-input"
          data-props='{"placeholder":"请输入关键词","allowClear":true}'
        ></plasmic-component>
      </slot>
    </plasmic-component>
  </slot>
</plasmic-component>
```

实际 MCP 插入时，每个组件还需指定 `data-plasmic-project`，其值来自当前项目的 imported project ID，Overseas 和 Antd6 分别指定。

## 交付与验证

按 Page/Tab 清点所有生成的 SearchForm，包括初始不活跃的 Tabs。独立于生成结果记录预期栅格、有效 Item span、共享 labelWidth 和折叠状态。逐项校验整体 colSpan 与 `Item.span ?? Form.colSpan`，未声明例外的字段须继承预期列宽；隐藏字段也检查。在目标视口检查编辑器和真实 Preview，测量列宽/行位置、标签与标点是否完整、控件可用空间；验证查询/重置。有折叠区时验证隐藏字段的值和双向展开/收起；未超出 minRows 时确认不显示多余折叠按钮。保存/重开后再次检查，分别记录模型、几何、截图和交互结果。未访问 Tabs 或未测量条件保持未验证；模型验证、Slot/路由检查和 Skill 格式验证不能证明视觉验收。失败时同步修正生成输入和交付模型。

组件实现、注册和发布由单独授权的工程任务处理，使用[工程验证](../../../engineering/component-contracts.md)。原型验收针对当前实际版本，不要求 Agent 构建或读取客户端内部产物。

## SearchForm.Item

Read the actual registered child contract before editing a query field. The owning [SearchForm](search-form.md) controls grid, shared labels, collapse and query/reset state.

每个 Item 的 `name` 是唯一的字段键；`label`、`span`、`initialValue`、`clearValue`、`required`、`requiredMessage`、`rules`、`valuePropName` 和 `trigger` 可编辑、可绑定表达式。`name` 为单个字符串键，不解释点分路径。`rules` 为 Ant Design Form.Item 的规则数组。

Item 的 Control (`children`) Slot 放一个值控件，例如 Antd6 Input、Select、DatePicker、Checkbox 或自定义组件。控件自身的 placeholder、options、模式、格式、禁用状态等在该控件上编辑；初始值在 Item/Form 上配置，避免同时给控件绑定独立受控值。默认以 `value` / `onChange` 绑定；支持注册控件的 `__plasmicFormFieldMeta.valueProp`（Checkbox/Switch 的 `checked`），以及 Item 手动指定属性和事件名。控件事件仍会调用原本的事件处理器。

Custom label (labelContent) and help are real editable Slots. Custom label overrides the text label; help supplies supporting text or validation feedback.

Check the real Item/control Slot ownership, unique field key and span override in editor, Preview and saved/reopened readback. Use the parent [acceptance](search-form.md) to verify initial/reset/clear values, validation and collapsed fields.
