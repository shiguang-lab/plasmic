# SearchForm

Library: [Overseas](../index.md).

| Registered component | Registration key |
| --- | --- |
| SearchForm | `plasmic-overseas-search-form` |
| SearchForm.Item | `plasmic-overseas-search-form-item` |

来源：`fintechgrowthui/src/components/search-form.tsx`。Overseas 实现保留查询卡片、24 栅格、末行右侧操作、展开/收起、字段初始值及业务清除值语义，使用 Ant Design 6。输入控件由画布节点提供。

## 可编辑结构

Read [SearchForm.Item](search-form.md#searchformitem) for field Props, control value/event mapping and label/help Slots.

`plasmic-overseas-search-form` 的 Fields (`children`) Slot 放置 `plasmic-overseas-search-form-item` 实例。一个实例代表一个字段，字段顺序就是画布节点顺序。插入、复制、删除、移动和修改通过 Studio/MCP 的现有节点操作完成，无独立的字段数组或另一套简化模式。

SearchForm 提供 Extra actions (`extraActions`) Slot。Extra actions 位于查询/重置之后；内置按钮文本通过属性编辑，其行为固定为提交和重置。

## 布局与状态

默认 `colSpan=8`、`minRows=1`；需要四列查询布局时设置 `colSpan=6`。Item 可单独覆盖 span。动作使用末行剩余栅格；末行占满时换行。超出 minRows 时提供折叠；折叠至少保留第一个字段。小屏保持原组件 xs=24、sm=12、md=指定 span 的响应式栅格。

`labelWidth` 是可选的共享标签栏宽度，单位为 px，没有固定默认值；选中 SearchForm 后在属性面板的 Label width 中修改，导入库的契约必须包含它。

未配置 `labelWidth` 时，各标签按内容宽度显示；配置后所有 Item 使用共享宽度。生成前检查全部标签，包括初始折叠字段、自定义标签、必填和帮助标记、组件生成的冒号及其原生间距；按实际字体和最长标签选择足够的单行宽度，并确认目标视口仍有可用的控件空间。标签变化后重新评估整个表单，不把页面选择的宽度写入组件默认值。标签使用纯文本，不手动追加冒号、空格或 CSS 偏移来补偿窄标签栏。

编辑器强制展开时必须显示“收起”、向上指示和 `aria-expanded=true`；Preview 使用实际 collapsed 状态。检查短/长标签的控件起点、完整单行文字、冒号到控件的原生间距，以及双向展开/收起；清除 labelWidth 后恢复内容宽度，不裁切或省略标签。

卡片使用主题背景和边框，内边距 16px/20px、圆角 8px，默认下间距 16px；父级已有 gap 时设置 marginBottom=0。`embedded` 移除卡片和外间距。className 接收画布样式。

编辑画布展示全部字段，便于选取和修改；交互预览/运行态遵循 collapsed。折叠仅隐藏列，字段不卸载，初始值、校验和提交均包含折叠字段。若折叠区字段校验失败，表单请求展开，以显示可修改的错误字段。

初始值优先级为 Item.initialValue > Form.initialValues > Item.clearValue，保留 0、false 和空字符串。运行中的初始值用于初始化及重置，不覆盖用户当前草稿；编辑器修改默认值会更新字段预览。重置先恢复初始值，再用明确设置的 clearValue 覆盖；输入清除至 null/undefined 也恢复 clearValue。

`onSearch(values)` 在校验通过后返回全部已注册字段；`onReset(values)` 返回重置后的值；`onValuesChange(values)` 提供当前草稿（包含折叠字段），对应 readonly `values` 状态。查询不会自动改变应用的数据；页面交互将提交值赋给 appliedFilters 并将 page 设为 1。重置事件做同样的应用状态更新。`collapsed` 为可写状态；ref actions 为 `submit()`、`reset()`、`setFieldsValue(values)`。

## 页面生成

后台四列组合（colSpan=6、minRows=1）只有三个普通字段时，查询/重置位于同一行第四格，不显示多余的展开控件。检查每个 Item 的 span 覆盖；日期范围不得沿用旧三列布局的 span=8，除非当前需求明确需要更宽字段。

列表查询区统一使用 Overseas SearchForm，按需求插入真实 Item 和 Antd6 控件，默认四列 colSpan=6。不得生成另一套原生查询网格、重复查询按钮，或不可编辑的 fields/element JSON。生成前读取已发布 Overseas 和 Antd6 契约，必要时安装/升级库并保存。额外操作使用 extraActions，字段增删排序使用节点操作，查询/重置事件接页面状态。

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

按 Page/Tab 清点所有生成的 SearchForm，包括初始不活跃的 Tabs。独立于生成结果记录预期栅格、有效 Item span、共享 labelWidth 和折叠状态。在目标视口检查编辑器和真实 Preview，测量列宽/行位置、标签与标点是否完整、控件可用空间；验证查询/重置、折叠字段的值和双向展开/收起。保存/重开后再次检查，分别记录模型、几何、截图和交互结果。未访问 Tabs 或未测量条件保持未验证；模型验证、Slot/路由检查和 Skill 格式验证不能证明视觉验收。失败时同步修正生成输入和交付模型。

通过条件：注册包含两种组件及 Slot/event/state/action 契约；类型检查和组件构建通过；栅格/默认值/Slot 遍历测试通过；浏览器验证折叠值提交、重置和清除、校验、Checkbox、自定义控件事件和额外操作。

运行 App 的资源有三层：Overseas dist/skinny、canvas-packages 客户端/服务端产物、Desktop renderer/app.asar。增加注册组件还需要 NAS 原生 hostless 发布，再在项目升级 Overseas；只更新本地桌面 JS 不会使数据库中的组件目录出现新组件。发布使用 deploy/README.md 的正式镜像流程；部署确认后再生成和验收页面。

## SearchForm.Item

Read the actual registered child contract before editing a query field. The owning [SearchForm](search-form.md) controls grid, shared labels, collapse and query/reset state.

每个 Item 的 `name` 是唯一的字段键；`label`、`span`、`initialValue`、`clearValue`、`required`、`requiredMessage`、`rules`、`valuePropName` 和 `trigger` 可编辑、可绑定表达式。`name` 为单个字符串键，不解释点分路径。`rules` 为 Ant Design Form.Item 的规则数组。

Item 的 Control (`children`) Slot 放一个值控件，例如 Antd6 Input、Select、DatePicker、Checkbox 或自定义组件。控件自身的 placeholder、options、模式、格式、禁用状态等在该控件上编辑；初始值在 Item/Form 上配置，避免同时给控件绑定独立受控值。默认以 `value` / `onChange` 绑定；支持注册控件的 `__plasmicFormFieldMeta.valueProp`（Checkbox/Switch 的 `checked`），以及 Item 手动指定属性和事件名。控件事件仍会调用原本的事件处理器。

Custom label (labelContent) and help are real editable Slots. Custom label overrides the text label; help supplies supporting text or validation feedback.

Check the real Item/control Slot ownership, unique field key and span override in editor, Preview and saved/reopened readback. Use the parent [acceptance](search-form.md) to verify initial/reset/clear values, validation and collapsed fields.
