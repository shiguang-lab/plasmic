# Admin page types

Choose `pageType` from the Page's primary user task during [structure design](page-structure.md), before templates or components. It routes starting skeletons and composition guidance; the source determines required content, not component counts. Put the type in the minimal plan. Explicit spatial constraints take precedence; otherwise decide arrangement through `pageStructure` reasoning without overriding protected component defaults. Use the [design scale](scale.md) for dimensions and the linked compositions for region internals.

Rendered examples of every type live in the Plasmic project 页面类型参考 (`gPHk7DnpyjQisz59sZYNVJ`), one Page per type. Read a Page's model through MCP to compare structure and props; the reference structures below remain the rule.

**Hard constraints** (always delivered with any section):

- Decide `pageType` from the user task of the Page, not from its fields: find records, enter one record, read one record, follow a multi-stage flow, see an outcome or monitor indicators.
- Use the regions below as starting guidance, then decide arrangement from the source and task under [Page structure design](page-structure.md). Omit regions with no source content; retain required regions and explicit arrangements even when they differ from the example. Record source constraints separately from agent reasoning and verify the inventory.
- Content starts with the first business region inside the AppShell; no Page title, intro or breadcrumb copy (see [admin content entry](layout.md#admin-content-entry)).
- Top-level regions follow the decided Page structure using native layout components and the shared 16px spacing baseline. Vertical Flex is suitable for sequential regions; Row or horizontal Flex can express simultaneous regions. Do not nest one region's surface inside another's.
- Overlays (Modal, Drawer) belong to the Page that opens them; they are not separate Pages.

## Choosing the type

| User task on this Page | `pageType` | Template |
| --- | --- | --- |
| Find, filter and act on many records of one kind | `list` | StandardListPage / SearchTableSection |
| The same, split into mutually exclusive scopes (all/mine, by status) | `tabbed-list` | TabsTableSection |
| Choose a node in a catalog, then work on its records | `catalog-workspace` | SplitTabsPage / CatalogTabsSection |
| Enter a short field set to save a record or run an operation | `basic-form` | BasicFormPage |
| Create or edit one record whose fields fall into named groups | `grouped-form` | None; compose (each group uses BasicFormPage's field structure) |
| Create a record through ordered stages with prerequisites | `step-form` | None; compose |
| Read one record's attributes and related records | `basic-detail` | RecordDetailPage / DetailSection |
| Read one record whose related content splits into Tabs | `tabbed-detail` | RecordDetailPage with Tabs |
| Monitor indicators and inspect a visual workspace or related records | `overview` | None; compose |
| See the outcome of a finished operation or an error state | `result` | None; compose |

An input-and-run tool uses the closest form type plus its output region; `result` is for an outcome-focused Page. Keep the real action (for example Run), without inventing Save or record persistence.

A create/edit flow that keeps list context uses a Drawer or Modal on the list Page instead of a form Page; see [overlays](../libraries/antd_v6/compositions/modal-drawer.md).

## Page types

### list

1. Query region, when the source requires filters: [SearchForm](../libraries/overseas/components/search-form.md), its own surface, four columns. A list with no query requirement starts at the list region.
2. List region: one Card containing the Table with native pagination. List-level actions (create, import, export) put a header on it: `title+extra`, `headerReason: actions`, title = record kind, extra = the actions. Without list-level actions the Card is headerless; the shell already names the list. See [query and list](../libraries/overseas/compositions/search-table.md).

Batch actions follow [bulk actions](../libraries/antd_v6/compositions/bulk-actions.md). Row actions use ActionGroup in a fixed right column.

Reference structure:

```text
AppShell › children
└ PageBody            Flex vertical, gap 16
  ├ Filters           SearchForm colSpan 6, marginBottom 0
  └ ListCard          Card header title+extra, body 16px 20px 0 (pagination owns the bottom)
    ├ title           record kind, e.g. 订单列表
    ├ extra           Space 8 › CreateButton (primary)
    └ RecordsTable    Table large, pagination 20 (20/50/100)
      ├ …Columns      fixed widths; one main text Column without width
      └ ActionsColumn fixed right › RowActions ActionGroup max 3
```

### tabbed-list

1. Query region, when required: SearchForm shared by all scopes.
2. List region: one headerless Card whose first content is Tabs (`0 20px` body padding); shared list actions in Tabs extra. Separate Tab content holds its own Table and pagination. When the source defines Tabs as filters for one shared Table, keep that Table outside the Tab items, bind its scope and reset pagination on scope changes.

Reference structure:

```text
AppShell › children
└ PageBody            Flex vertical, gap 16
  ├ Filters           SearchForm colSpan 6, marginBottom 0
  └ ListCard          Card, empty title/extra, body 0 20px
    └ ScopeTabs       Tabs line medium; tabBarExtraContentRight › CreateButton
      ├ AllTab        › AllRecordsTable (Table large, pagination 20)
      └ MineTab       › MyRecordsTable  (same Columns)
```

### catalog-workspace

A Row with `wrap:false` and gutter 16: a 248px catalog column (Card with a search Input and Menu or Tree) and a flexible workspace column (`flex:auto`, `min-width:0`) containing a `list` or `tabbed-list` layout. The workspace column is narrower than a full-width list: measure its rendered content width and choose columns whose `scroll.x` (fixed widths plus the main column's baseline, per [Table](../libraries/antd_v6/components/table.md#content-and-scroll-width)) fits it, rather than relying on horizontal scroll. See [master-detail](../libraries/antd_v6/compositions/master-detail.md).

Reference structure:

```text
AppShell › children
└ Workspace           Row gutter 16, wrap false
  ├ CatalogCol        Col flex 248px › CatalogCard (Card) › CatalogSearch + CatalogMenu
  └ ContentCol        Col flex auto, min-width 0 › list or tabbed-list structure
```

### basic-form

1. Form region: one headerless Card holding the Form in the [Page Form structure](../libraries/antd_v6/compositions/form-layout.md#page-form-structure).
2. Form actions: inline below the fields inside the same Form, in a Form.Item with a blank label and `colon:false` so the shared labelCol aligns them with the controls, submit before cancel ([inline form actions](../libraries/antd_v6/compositions/action-bars.md#placement-and-ordering)). A completion bar is for actions that span several surfaces (`grouped-form`, `step-form`).

Read-only context of the record (identifiers, inherited values) is a Descriptions group at the top of the same Card or a headerless Card above it.

Reference structure:

```text
AppShell › children
└ PageBody            Flex vertical, gap 16
  └ FormCard          Card, empty title/extra, body 24px 20px 0
    └ RecordForm      Form horizontal, padding 0, labelAlign right, labelCol flex <measured>px, wrapperCol flex 1
      ├ Fields        Row gutter 16 › one Col per field (span 8; span 24 full row) › Form.Item
      └ Actions       Form.Item, blank label, colon false › FormButtons (Space 8) › [Submit (primary), Cancel]
```

### grouped-form

1. One Card per source field group, header `title` with the group name (`headerReason: distinguish`); each Card holds its fields in the Page Form structure. All groups share one Form when they submit together: the Form wraps the group Cards inside its children Slot.
2. Completion bar outside the Form: its primary action calls the Form's verified submit ref action ([events and ref actions](../libraries/antd_v6/components/form.md#events-and-ref-actions)); the Form's validated submit event performs the mutation.

A group that the source does not name and that holds only one or two fields joins its neighbour instead of getting its own Card; a source-named group keeps its Card and title.

Reference structure:

```text
AppShell › children
└ PageBody            Flex vertical, gap 16
  ├ RecordForm        Form horizontal, padding 0, gap 16 between the group Cards
  │ ├ BasicGroupCard  Card header title (group name), body 24px 20px 0 › BasicGroup Row gutter 16 › Cols › Items
  │ └ RuleGroupCard   Card header title (group name), body 24px 20px 0 › RuleGroup Row gutter 16 › Cols › Items
  └ ActionBar         completion bar › Space 8 [Cancel, Submit (primary) → Form submit ref action]
```

### step-form

1. Steps region: Steps on its own, without a Card, horizontal, current stage from the workflow state. Its wrapper has a `0 20px` horizontal inset so the first step aligns with the stage Card content.
2. Stage region: one headerless Card holding the current stage's content (a Form in the Page Form structure, a review Descriptions or an editor with its result).
3. Completion bar: back before next, the last stage's completion action last. See [Steps + Form](../libraries/antd_v6/compositions/step-form.md).

Reference structure:

```text
AppShell › children
└ PageBody            Flex vertical, gap 16
  ├ FlowSteps         Steps horizontal, no Card; wrapper padding 0 20px
  ├ StageCard         Card, empty title/extra, body 24px 20px 0 for a Form stage (16px 20px otherwise) › current stage content
  └ ActionBar         completion bar › Space 8 [Back, Next or Finish (primary)]
```

### basic-detail

1. Information region: one headerless Card holding one titled Descriptions per source information group (Flex vertical, gap 16; each Descriptions title owns its heading), three columns.
2. Related records: one Card per related list, header `title` (`distinguish`), Table with pagination.

Place required detail actions in existing toolbars, Tabs extra or owning regions by scope, not a new Header; apply [Header assessment](layout.md#admin-content-entry).

Reference structure:

```text
AppShell › children
└ PageBody            Flex vertical, gap 16
  ├ InfoCard          Card, empty title/extra, body 16px 20px
  │ └ Flex vertical gap 16 › one titled Descriptions per group (column 3)
  └ RelatedCard       Card header title (related list name), body 16px 20px 0 › RelatedTable (Table large, pagination)
```

### tabbed-detail

1. Information region as in `basic-detail`, limited to the identity and summary groups.
2. Content region: one headerless Tabs-first Card; each Tab holds one related list, a metric row or a further Descriptions group.

The Tab shown by default follows the source; inactive Tabs keep their content in the model.

Reference structure:

```text
AppShell › children
└ PageBody            Flex vertical, gap 16
  ├ InfoCard          Card, empty title/extra, body 16px 20px › SummaryDescriptions (title, column 3)
  └ ContentCard       Card, empty title/extra, body 0 20px
    └ SectionTabs     Tabs line medium › one TabItem per related section (Table, metrics, Descriptions)
```

### overview

1. Metric row: Row gutter 16, four metric Cards per row (Col `span` 6) under [metrics](../libraries/antd_v6/compositions/summary-metrics.md#overview-metrics-and-information-cards).
2. Detail regions: Cards with titles (`distinguish`) holding Tables or Descriptions; two side by side use Col `span` 12 with `min-width:0`. Place a Table at half width only when its `scroll.x` fits the measured Card body width of that Col; otherwise reduce it to the columns the region needs or give it a full row.

Reference structure:

```text
AppShell › children
└ PageBody            Flex vertical, gap 16
  ├ Metrics           Row gutter 16 › Col span 6 × 4 › MetricCard (Card) › Statistic
  └ DetailRow         Row gutter 16 › Col span 12 › titled Card › Table or Descriptions
```

### result

A single [Result](../libraries/antd_v6/components/result.md) with the actual status, title, a one-sentence subtitle and the recovery or next actions, in one headerless Card: the outcome is the Page's only business surface, so it sits on the same white surface as every other page type instead of the neutral content background. A simple outcome needs no additional region; retain any source-required result details. See [content states](../libraries/antd_v6/compositions/content-states.md).

Reference structure:

```text
AppShell › children
└ PageBody            Flex vertical, gap 16
  └ OutcomeCard       Card, empty title/extra, body 16px 20px
    └ Outcome         Result status, title, subTitle; extra › Space 8 [Next (primary), Return]
```

## Regions inside any type

Some source content does not belong to one type and is placed as a region of the Page that owns the task:

| Content | Region |
| --- | --- |
| Editing with a live preview or result that must stay observable | Decide a simultaneous workspace under [Page structure design](page-structure.md); on desktop, consider editor and preview side by side, sized for their content |
| An operation that produces a result after an explicit action (validation, test run, calculation, on-demand preview) | Normally place the result near/below its input, or in an on-demand overlay when appropriate; choose simultaneous regions when comparison is needed. Use Alert for a continuing condition, Descriptions or Table for structured results, Statistic for a count |
| A group of read-only attributes inside a form Page | Descriptions at the top of the form Card |
| A continuing regional condition | Alert at the top of the affected surface |
| No data, loading, failure | [Content states](../libraries/antd_v6/compositions/content-states.md) inside the affected region |
