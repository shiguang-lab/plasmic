# Admin design scale

Default spacing, surface, width, size, typography and density values for desktop admin prototypes. Use them whenever the current user, the requirement or an approved design does not state a value; those sources take precedence and their value is recorded with its source. The values follow Ant Design's 8px spacing system and theme tokens and the current Antd-v6/Overseas registrations. These defaults apply to the Antd-v6, Overseas and React UI composition. Other libraries use their own reference scope and verified tokens; do not copy these sizes or recipes into another API family.

Rows marked with an owner link are maintained in that document; the value is repeated here only as a lookup. Change a value in its owner, then update this table.

**Hard constraints** (always delivered with any section):

- Without a stated value, use the values in this document. Gaps, gutters and margins between siblings are 8, 12, 16 or 24px; surface insets (padding) are 16, 20 or 24px per the Surfaces table; never an in-between value such as 10px, 14px or 18px.
- Spacing comes from the parent's gap/gutter and the surface's padding, never from margins added to children, blank nodes or fixed heights.
- Top-level regions in the content area are 16px apart; buttons in one group are 8px apart; form fields share a 16px column gutter; every surface keeps the same 20px horizontal inset so content and action edges align.
- Controls in one region use consistent effective sizes from the Component sizes table unless the requirement or approved design specifies otherwise. Native defaults and supported context inheritance are valid; set an instance's `size` only when an override is needed, and verify the rendered result.
- Text uses the theme scale in the Typography table: 14px body and secondary text, 12px captions, 16px/600 region titles, and only the listed metric-value and requested-header sizes; no other font sizes without a source.

## Spacing

| Boundary | Default | Owner |
| --- | --- | --- |
| Shell content padding | 16px, owned by AppShell; the business root adds none | [AppShell](../libraries/overseas/components/app-shell.md) |
| Between top-level regions (SearchForm, Cards, completion bar) | 16px gap on the content root (Flex gap 16 with direction from the Page structure, or Row gutter 16) | This document |
| Between stacked blocks inside one surface (editor, feedback, table, group) | 16px gap on the surface's inner Flex | This document |
| Buttons and inline actions in one group, including overlay footers | 8px (Space) | [Action bars](../libraries/antd_v6/compositions/action-bars.md#placement-and-ordering) |
| A toolbar above the filters (only when the current user requests it) to the filter row | 16px | [Query and list](../libraries/overseas/compositions/search-table.md#query-and-list-structure) |
| Form field columns | 16px Row gutter | [Form layout](../libraries/antd_v6/compositions/form-layout.md#page-form-structure) |
| Form field rows | Native Form.Item bottom margin; no parent row-gap | [Form layout](../libraries/antd_v6/compositions/form-layout.md#columns-and-label-width) |
| Control to its inline instruction | 12px | [Form field instructions](../libraries/antd_v6/components/form.md#field-instructions) |
| Metric label to value; metric siblings | 8px; 16px | [Metrics](../libraries/antd_v6/compositions/summary-metrics.md#overview-metrics-and-information-cards) |
| Form Modal to viewport edge | At least 24px; Drawers retain their native edge attachment | [Overlays](../libraries/antd_v6/compositions/modal-drawer.md#structure-and-close-behavior) |

Component-internal spacing stays native. A component's own theme spacing (Form.Item margin, pagination margin, Tabs bar) counts as that boundary's spacing; do not add a second value on the same edge.

## Surfaces

| Surface | Default | Owner |
| --- | --- | --- |
| Information, metric or outcome (Result) Card body | `16px 20px` | [Card](../libraries/antd_v6/components/card.md#card-ownership) |
| Card body ending in a paginated Table | `16px 20px 0`; the pagination's 16px margin is the bottom | [Card](../libraries/antd_v6/components/card.md#card-ownership) |
| Tabs-first list Card body | `0 20px` | [Card](../libraries/antd_v6/components/card.md#card-ownership) |
| Form Card body | `24px 20px 0` with the Form's padding 0; the last Form.Item's 24px margin is the bottom | [Form layout](../libraries/antd_v6/compositions/form-layout.md#page-form-structure) |
| Card title | 16px/600; counts at secondary hierarchy | [Card headers](../libraries/antd_v6/components/card.md#card-headers) |
| SearchForm surface | Its own card, 16px/20px, radius 8px; no outer Card | [SearchForm](../libraries/overseas/components/search-form.md) |
| Page completion bar | White bar, `16px 20px` padding, actions right-aligned | [Action bars](../libraries/antd_v6/compositions/action-bars.md#placement-and-ordering) |
| Steps outside a Card (step-form) | `0 20px` horizontal inset on its wrapper, aligned with the stage Card content | [Page types](page-types.md#step-form) |
| Nested surfaces | None; a region inside a Card uses layout, not another Card | [Card](../libraries/antd_v6/components/card.md) |

## Widths

| Element | Default | Owner |
| --- | --- | --- |
| Desktop viewport | The live device preset (currently 1440×1024) | [Layout](layout.md) |
| Page content | Fills the shell content area; no centered max-width for list, detail or form Pages | This document |
| Modal | 520 one column; 720 two columns; 640–720 long content; 800 crowded two columns | [Modal form layout](../libraries/antd_v6/compositions/form-layout.md#width-and-columns) |
| Drawer | 480 short help or compact confirm; 640 record detail, Form or Table; 720 code or long values | [Overlays](../libraries/antd_v6/compositions/modal-drawer.md#overlay-width) |
| Catalog column in a split workspace | 248px | [Page types](page-types.md#catalog-workspace) |
| Table columns | Fixed widths for short, status, time and operation columns; the main text column takes the rest | [Table](../libraries/antd_v6/components/table.md#content-and-scroll-width) |
| Form controls | Fill their column | [Form layout](../libraries/antd_v6/compositions/form-layout.md#page-form-structure) |

## Component sizes

This table owns default design sizes, not required instance props. Read each registered component's actual size contract. Native defaults or supported Form/ConfigProvider inheritance may supply the intended size; do not write a redundant instance value that blocks inheritance. Templates and explicit props may override those defaults, so inspect the effective result.

| Registration | Default size |
| --- | --- |
| Button, Input (all variants), Select, TreeSelect, Cascader, AutoComplete, DatePicker, RangePicker, TimePicker, InputNumber, Radio button group, Segmented, Tabs, Card | `medium` |
| Table | `large` |
| List | `default` |
| Descriptions | `medium` |
| Avatar in a Table cell | 32 |

Use another size from the requirement or an approved design, keeping the region consistent. Only pass `size` when the registered contract exposes it; a missing registration for a native capability is a contract defect to fix, not a reason to invent a prop or redraw the component.

During review, check effective sizes in Preview against the requirement or these defaults, including template overrides and context inheritance. An omitted `size` alone is not a failure, and a saved `size` alone is not proof of the rendered size. Static plan checks verify explicitly planned props; rendered review verifies effective size and consistency.

## Typography

| Role | Size / line height | Treatment |
| --- | --- | --- |
| Body, field values, table cells | 14px / 22px | Theme text color |
| Secondary text, field help, metric labels | 14px / 22px | Theme secondary color |
| Captions, comparisons, footnotes | 12px / 20px | Theme secondary color |
| Region, Card, Descriptions and Modal titles | 16px / 24px | Weight 600 through the component's title Slot |
| Requested entity header title | 20px / 28px | Weight 600; only when [explicitly requested](layout.md#admin-content-entry) |
| Metric values | 24px / 32px numbers; 20px / 32px state and date/time values | [Metrics](../libraries/antd_v6/compositions/summary-metrics.md#overview-metrics-and-information-cards) |

There is no Page title. Monospace is for code, identifiers and URLs only.

## Density

| Element | Default | Owner |
| --- | --- | --- |
| Table page size | 20, size options 20/50/100 (gated; a stated requirement value needs its override) | This document |
| Row actions visible | 3, the rest folded | [ActionGroup](../libraries/react_ui/components/action-group.md) |
| Page Form | Three short fields per row | [Form layout](../libraries/antd_v6/compositions/form-layout.md#columns-and-label-width) |
| Modal Form | One column; two with a pairing reason | [Modal form layout](../libraries/antd_v6/compositions/form-layout.md#width-and-columns) |
| SearchForm | Four columns (`colSpan` 6) | [SearchForm](../libraries/overseas/components/search-form.md) |
| Descriptions | 3 full width, 2 half width or Drawer, 1 narrow | [Descriptions](../libraries/antd_v6/components/descriptions.md#column-and-span) |
| Metric cards | Four per row (Row gutter 16, Col `span` 6); fewer only when content does not fit | This document |
| Primary actions | One per region; one completion action per Page | [Action bars](../libraries/antd_v6/compositions/action-bars.md) |
