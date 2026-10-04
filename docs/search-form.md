# Overseas SearchForm

来源：`fintechgrowthui/src/components/search-form.tsx`。Overseas 实现保留查询卡片、24 栅格、末行右侧操作、展开/收起、字段初始值及业务清除值语义，使用 Ant Design 6。输入控件由画布节点提供。

## 可编辑结构

`plasmic-overseas-search-form` 的 Fields (`children`) Slot 放置 `plasmic-overseas-search-form-item` 实例。一个实例代表一个字段，字段顺序就是画布节点顺序。插入、复制、删除、移动和修改通过 Studio/MCP 的现有节点操作完成，无独立的字段数组或另一套简化模式。

每个 Item 的 `name` 是唯一的字段键；`label`、`span`、`initialValue`、`clearValue`、`required`、`requiredMessage`、`rules`、`valuePropName` 和 `trigger` 可编辑、可绑定表达式。`name` 为单个字符串键，不解释点分路径。`rules` 为 Ant Design Form.Item 的规则数组。

Item 的 Control (`children`) Slot 放一个值控件，例如 Antd6 Input、Select、DatePicker、Checkbox 或自定义组件。控件自身的 placeholder、options、模式、格式、禁用状态等在该控件上编辑；初始值在 Item/Form 上配置，避免同时给控件绑定独立受控值。默认以 `value` / `onChange` 绑定；支持注册控件的 `__plasmicFormFieldMeta.valueProp`（Checkbox/Switch 的 `checked`），以及 Item 手动指定属性和事件名。控件事件仍会调用原本的事件处理器。

Item 另提供 Custom label (`labelContent`) 和 `help` Slot，SearchForm 提供 Extra actions (`extraActions`) Slot。自定义标签覆盖文本 label，help 用于辅助文字或校验提示。Extra actions 位于查询/重置之后；内置按钮文本通过属性编辑，其行为固定为提交和重置。

## 布局与状态

默认 `colSpan=8`、`minRows=1`；需要四列查询布局时设置 `colSpan=6`。Item 可单独覆盖 span。动作使用末行剩余栅格；末行占满时换行。超出 minRows 时提供折叠；折叠至少保留第一个字段。小屏保持原组件 xs=24、sm=12、md=指定 span 的响应式栅格。

卡片使用主题背景和边框，内边距 16px/20px、圆角 8px，默认下间距 16px；父级已有 gap 时设置 marginBottom=0。`embedded` 移除卡片和外间距。className 接收画布样式。

编辑画布展示全部字段，便于选取和修改；交互预览/运行态遵循 collapsed。折叠仅隐藏列，字段不卸载，初始值、校验和提交均包含折叠字段。若折叠区字段校验失败，表单请求展开，以显示可修改的错误字段。

初始值优先级为 Item.initialValue > Form.initialValues > Item.clearValue，保留 0、false 和空字符串。运行中的初始值用于初始化及重置，不覆盖用户当前草稿；编辑器修改默认值会更新字段预览。重置先恢复初始值，再用明确设置的 clearValue 覆盖；输入清除至 null/undefined 也恢复 clearValue。

`onSearch(values)` 在校验通过后返回全部已注册字段；`onReset(values)` 返回重置后的值；`onValuesChange(values)` 提供当前草稿（包含折叠字段），对应 readonly `values` 状态。查询不会自动改变应用的数据；页面交互将提交值赋给 appliedFilters 并将 page 设为 1。重置事件做同样的应用状态更新。`collapsed` 为可写状态；ref actions 为 `submit()`、`reset()`、`setFieldsValue(values)`。

## 页面生成

列表查询区统一使用 Overseas SearchForm，按需求插入真实 Item 和 Antd6 控件，默认四列 colSpan=6。不得生成另一套原生查询网格、重复查询按钮，或不可编辑的 fields/element JSON。生成前读取已发布 Overseas 和 Antd6 契约，必要时安装/升级库并保存。额外操作使用 extraActions，字段增删排序使用节点操作，查询/重置事件接页面状态。

```html
<plasmic-component data-plasmic-component="plasmic-overseas-search-form" data-props='{"colSpan":6,"marginBottom":0}'>
  <slot name="children">
    <plasmic-component data-plasmic-component="plasmic-overseas-search-form-item" data-props='{"name":"keyword","label":"关键词"}'>
      <slot name="children">
        <plasmic-component data-plasmic-component="plasmic-antd6-input" data-props='{"placeholder":"请输入关键词","allowClear":true}'></plasmic-component>
      </slot>
    </plasmic-component>
  </slot>
</plasmic-component>
```

实际 MCP 插入时，每个组件还需指定 `data-plasmic-project`，其值来自当前项目的 imported project ID，Overseas 和 Antd6 分别指定。

## 交付与验证

通过条件：注册包含两种组件及 Slot/event/state/action 契约；类型检查和组件构建通过；栅格/默认值/Slot 遍历测试通过；浏览器验证折叠值提交、重置和清除、校验、Checkbox、自定义控件事件和额外操作。

运行 App 的资源有三层：Overseas dist/skinny、canvas-packages 客户端/服务端产物、Desktop renderer/app.asar。增加注册组件还需要 NAS 原生 hostless 发布，再在项目升级 Overseas；只更新本地桌面 JS 不会使数据库中的组件目录出现新组件。发布使用 deploy/README.md 的正式镜像流程；部署确认后再生成和验收页面。
