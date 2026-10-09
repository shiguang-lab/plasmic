# Admin Templates

[打开素材库](https://studio.plasmic.shiguanglab.com/projects/145nN6S5QQBwgjtNUwuiQZ) ·
[查看组合演示](https://studio.plasmic.shiguanglab.com/projects/145nN6S5QQBwgjtNUwuiQZ/preview/templates)

素材库位于 shuhe / Prototypes，已保存发布版本 **0.0.1**。它提供设计时可组合的页面、区块和抽屉素材。页面模板按照 Plasmic 官方方式保存为普通 Component；`TemplatePreview` 是唯一的演示 Page。

## 模板目录

| 模板 | 场景 | Pen 来源 |
| --- | --- | --- |
| `StandardListPage` | 外壳、筛选、分页表格、行操作 | RiMP8 |
| `SplitTabsPage` | 外壳、左侧目录、右侧标签工作区 | rlAE5 |
| `BasicFormPage` | 外壳、独立新增或编辑表单 | FhyyS |
| `RecordDetailPage` | 外壳、返回入口、详情摘要、关联表格 | vjnvs |
| `SearchTableSection` | 已有外壳中的筛选和表格 | RiMP8 |
| `TabsTableSection` | 全部、我负责的等互斥列表 | RiMP8，按标签列表组合规则提取 |
| `CatalogTabsSection` | 已有外壳中的目录和标签工作区 | rlAE5 |
| `DetailSection` | 已有布局中的摘要和关联记录 | vjnvs |
| `DrawerDetailSection` | 保留当前页面上下文的快速查看 | bAEIb |
| `DrawerFormSection` | 保留列表上下文的短表单编辑 | YciXK |

来源文件是 `/Users/yanxianliang/overseas/pen-antd-kit/libraries/templates.pen`，通过 Pen MCP 读取。原图中的背景页面和固定 1920×1080 尺寸没有成为抽屉模板的内容。当前验收视口是桌面 1440×1024。

## 组件与布局

基础控件直接使用已发布组件库：Antd6 **1.12.0**、Overseas **1.4.0**、Antd Icons **0.1.0**、React UI **0.1.0**。没有新增基础控件实现。

布局使用真实 Antd `Flex`、`Row`、`Col`、`Space` 和 `Card`；外壳使用 Overseas `AppShell`。筛选使用 `SearchForm` / `SearchFormItem`，表格使用 `Table` / `TableColumn`，行操作使用 `ActionGroup`，字段使用 `Form` / `Form.Item`，详情使用 `Descriptions`，抽屉使用原生 `Drawer`。

整页只保留一个 `AppShell`。已有外壳时使用 Section，Overlay 作为页面级兄弟节点插入。外壳负责页面纵向滚动；目录右栏自适应，表格使用原生横向滚动。两个抽屉的业务初始状态均为关闭。

## 在项目中使用

可以从目标项目的 Imported projects 安装素材库项目，再插入需要的组合组件。实例的真实 Slots 可替换字段、列、标题和操作；修改外壳、内部布局或页面级数据时使用 Studio 的 Detach instance。页面模板内部的 Section 也需要按编辑范围展开或解离。以普通组件方式插入的抽屉要先解离组合实例，再由所在页面绑定原生 `Drawer.open` 和内部 Form ref。

Plasmic 官方模板目录使用 [`ui-config.json`](../../ai/plasmic/references/templates/admin/ui-config.json)。`pageTemplates` 包含 4 个整页模板，`insertableTemplates` 包含 4 个区块和 2 个抽屉。`componentResolution: "inline"` 将自定义组合展开为可编辑内容，底层注册组件仍使用各自的真实契约。缩略图已经通过 Desktop `import_image` 上传到本系统资产服务。

**当前配置尚未应用到组织或工作区。** 当前 shuhe 为 Free；官方 `Configure Studio UI` 入口要求 Enterprise，实际组织菜单中没有该入口。有可用入口后，将这两个数组合并到组织或工作区现有 UI 配置，保留其他字段。不要为了添加模板开启 `contentEditorMode`。这一行为对应[官方自定义模板说明](https://docs.plasmic.app/learn/custom-templates/)。

## AI 如何参考

[`catalog.json`](../../ai/plasmic/references/templates/admin/catalog.json) 提供真实项目和组件 UUID、适用场景、避免场景、Slots 名称、组合规则、库版本和缩略图。它是 AI 的选型目录，组件的实时模型与注册元数据仍是 Props 和 Slots 的依据。仓库根 `CLAUDE.md` 已要求在设计管理后台原型前读取这个目录，Plasmic skill 的原型 workflow 也要求读取随资源包分发的模板规范与目录，发布到 NAS 后可用于其他项目。Plasmic 内置 AI 的自动检索和自动实例化服务尚未接入。

设计时先读 [模板规范](../../ai/plasmic/references/admin-templates.md) 和目录选择结构，再通过 Desktop MCP 读取模板和所用组件的实时契约。目录和 UiConfig 的唯一维护源位于 `ai/plasmic/references/templates/admin/`，随 skill 资源包发布；其他业务项目无需复制本仓库目录。已有外壳就选 Section；快速查看和短表单选 Drawer；完整详情与长表单选独立页面。组合示例：

```text
StandardListPage + DrawerDetailSection + DrawerFormSection
已有 AppShell + TabsTableSection + DrawerFormSection
SplitTabsPage + DrawerFormSection
RecordDetailPage ↔ BasicFormPage（两个路由）
```

可以向 AI 提供以下任务指令：

> 先读取当前 skill 资源包的 references/admin-templates.md 和 references/templates/admin/catalog.json，按当前需求选择和组合模板，再读取素材库实时模型与组件注册契约。复用现有库，布局优先使用 Antd。只保留一个 AppShell；替换示例字段、列和数据；绑定本项目真实事件、状态与路由；在 Preview 中检查查询、分页、校验和抽屉行为，保存后重读。

## 数据与事件绑定

表格使用 45 条虚构资源作为可读默认内容，`我负责的` 视图使用其中王晓负责的记录，平台配置视图使用 8 条记录。表格数据表达式为静态字面量，适合作为被复制的设计素材。

使用模板时必须按项目需求绑定：

- `SearchForm.onSearch` / `onReset` 与实际 Table 数据、分页状态。
- 目录选择、每个标签的数据范围、`ActionGroup` 行操作。
- 新建入口与 Drawer 的 `open` 状态；关闭和取消写入 `false`。
- 抽屉外部提交按钮调用该 Form 的真实 `submit` ref action；`onFinish` 调用项目保存逻辑，通过后再关闭。
- 页面返回入口与项目真实路由；AppShell 菜单与页面导航。

当前系统通过模板目录复制布局时，会清除来源自定义 State、事件和查询，不能把来源演示中的事件当作已迁移。普通组件导入仍保留组合组件自身的契约。复制或解离后应重新读取当前模型，按当前节点和状态名称绑定。Form 必须使用 `advanced` 模式；字段和页面内提交操作放在 `children` 中。名称使用真实 `required` 和 `whitespace` 规则，分类使用 `required` 规则，说明为可选；错误提示由 `Form.Item` 持有。

组合演示验证了 Drawer 打开和关闭、取消后再次打开、必填提示、选择分类、通过校验后关闭以及表格分页。演示提交只关闭抽屉，不保存业务记录；查询和行操作的业务处理仍由使用模板的项目提供。

## 维护与验收

`design.cjs` 是初始组合的 HTML 构造函数，输入为 Desktop MCP 返回的真实组件索引。编辑已存在模板时，优先使用 Studio 或公共 MCP 原位修改，保持节点和 Slots 的身份。维护后保存并发布新素材库版本，再更新目录中的版本和实际 UUID。

[`evidence/template-models.json`](evidence/template-models.json) 是已保存的 10 个模板读回快照。模型校验与 Slots、节点命名、两套表单的 6 个字段检查已通过；演示 Page 的 3 个字段另外通过技能 `verify_forms.py`。运行预览验证使用 1440×1024；未进行移动端适配验收。

`evidence/` 保存模型检查、表单检查、运行行为检查和截图。静态截图接口在本次会话中未能解析画布，截图通过真实运行预览取得。
