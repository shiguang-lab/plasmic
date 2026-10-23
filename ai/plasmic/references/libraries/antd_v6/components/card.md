# Card

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Card | `plasmic-antd6-card` |
| Card.Grid | `plasmic-antd6-card-grid` |
| Card.Meta | `plasmic-antd6-card-meta` |

**Hard constraints** (always delivered with any section):

- Use Card only for an independently justified business surface (record `condition`); never around SearchForm, AppShell, Steps or every section, and avoid nested Cards.
- Initial data-props: `{"size":"medium","variant":"outlined","styles":{"body":{...}}}`; never the legacy `bordered` prop or a padded native wrapper.
- A headerless Card supplies explicit empty `title` and `extra` Slots in the initial markup.
- A Tabs-first list Card uses body padding `0 20px`: Tabs owns the top edge, Table pagination owns the bottom edge. See [Card ownership](#card-ownership).

## Plan decisions

Declare these native props in each planned instance before markup. `prepare_plan.py scaffold` writes `"__DECIDE__"` (or the baseline) for each; selection preflight rejects pending or missing values. `null` means deliberately unset and is accepted only where marked.

| Registration | Prop | Decision |
| --- | --- | --- |
| `plasmic-antd6-card` | `size` (baseline `"medium"`) | Current contract baseline. See [rule](#card-ownership). |
| `plasmic-antd6-card` | `variant` (baseline `"outlined"`) | Current contract baseline; never the legacy bordered prop. See [rule](#card-ownership). |
| `plasmic-antd6-card` | `styles.body.padding` | Explicit body padding assigned to one edge owner, for example 0 20px for a Tabs-first list Card. See [rule](#card-ownership). |

## Generation rules

### Card ownership

Use the registered `plasmic-antd6-card` for a business surface with card appearance: a list containing toolbar/Tabs/Table/pagination, grouped form information, a detail information panel or a metric card. Read the installed Card contract before generation. A background, border, radius and padding on a native section/div do not fulfill this requirement. Use registered Antd6 Flex, Row/Col and Space for layout without a card surface; native main/section/div remain appropriate when semantic grouping is needed; SearchForm and AppShell keep their own surfaces, without an extra Card around them. Avoid nested cards unless the source explicitly requires separate surfaces.

Card-scoped actions belong in the Card `extra` Slot, right-aligned in the header — for example `格式化` and `校验` acting on this Card's SQL editor, or a disclosure such as `查看 SQL ›`. Do not insert a separate button row above the body when the Card already has a header: the row wastes a full line and separates the actions from the content they control. Keep a body toolbar when the actions belong to a wider region (multiple Cards or Tabs), when the Card is headerless (use Tabs `extra` or an in-body toolbar aligned with the region), or when the same row also carries filters or search fields. Card `actions` is the footer contract, not the header slot.

Place business nodes in Card's children Slot; keep Tables inside their existing Tab content slots. Use title and extra slots only when the design calls for a Card header; do not add a header solely because Card supports one. Appearance comes from Card's theme and supported props. With the current contract, use size=medium and variant=outlined; configure body padding through styles.body rather than a padded outer section. A plain information/form/metric card typically uses 16px vertically/20px horizontally. This is not a universal Card padding preset: Tabs and Table spacing ownership below takes precedence. Layout components inside children may provide gap or columns but must not repeat the surface or body padding. Card grows with its content; the AppShell remains the vertical scroll owner.

For a headerless Tabs/list Card, clear the header Slots in the **initial** insertHtml: supply `<slot name="title"></slot>` and `<slot name="extra"></slot>`. Omitting a Slot retains its registered default; the current title default is `Card title`, even with hidePlaceholder=true. “No header” therefore requires explicit empty Slots, not just body padding. Include these empty Slots in the intended markup and verify saved readback has no header children; hiding a retained sample title with styles.header.display=none does not clear it. When a Card header is required, supply its source-derived title instead (16px/600, with counts at secondary hierarchy).

When Tabs is the first content and its tab bar already supplies top spacing, set Card body and all intervening wrappers' paddingTop to 0. Do not reintroduce that space as margin, a translated/absolute offset or an empty header. When the last Panel content is a Table whose pagination already supplies bottom spacing, set Card body, Panel and intervening wrappers' paddingBottom to 0; do not add fixed-height slack or a spacer. For the current Antd6 list composition, styles.body.padding is `0 20px`: Tabs owns the top and Table's pagination margin owns the 16px bottom gap. Keep left/right Card body padding 20px. Do not modify Tabs internal label padding or Table pagination margin to compensate for an outer spacing error. For other compositions inspect the actual component spacing and assign each edge to one owner.

Write this padding explicitly in the Card's initial data-props, including in ad hoc build scripts: `{"size":"medium","variant":"outlined","styles":{"body":{"padding":"0 20px"}}}`. Omitting styles.body does not mean "no padding"; the Card falls back to its default body padding and pushes Tabs down. Do not use the legacy `bordered` prop. `verify_slots.py` checks the planned markup itself: its `tabsCardPolicy` rejects a Tabs-first Card (Tabs as first component content, through native wrappers) whose planned styles.body has no zero top edge, or that lacks empty title/extra Slots. A missing plan is not accepted because the readback matches it.

For Cards containing mixed Tab panels, assign bottom spacing per panel. A Table panel may rely on its pagination margin, but a Descriptions/form/text panel has no such owner: when Card body paddingBottom is 0, give that panel one 16px bottom padding. Put this padding outside conditional sections so hiding a type-specific section does not remove the gap. Do not add padding to Descriptions internals or increase the Card padding globally, which would double the spacing on Table panels. Check every panel and relevant visibility state, including a missing pagination footer, by measuring its final visible content to the Card inner bottom.

After save/reopen, measure Card inner body → every wrapper → Tabs top and Table bottom → wrappers → Card inner bottom. Top offsets must be 0 when Tabs owns top spacing, and external bottom offsets must be 0 when Table owns bottom spacing. With the current bordered Card, the outer 1px border is not body padding. Check the pagination's own bottom gap separately (currently 16px). Reject an extra 16px outer gap even when total spacing looks balanced; verify both model padding and rendered geometry.

Record the planned Card names and contents in the generation input and acceptance matrix. Readback must show real Card instances and the intended business nodes inside their children Slots; reject native substitutes, empty Cards with sibling content and imported sample children. When migrating an existing surface, insert Card, move existing content with moveElement to preserve UUIDs/state/interactions, then remove the obsolete native surface. Check complete-page geometry and save/reopen persistence. Use verify_slots.py with the intended Card markup to check component identity and content ownership, in addition to screenshot review.

### Card.Meta, Card.Grid and action Slots

Meta owns its title/description/avatar inside the Card. Grid is a real Card subregion with its children/hoverable contract; it is not Row/Col Grid or a reason to nest another surface around every item. Use either structure only for the actual content arrangement and keep complete labels/values in their supported Slots.

Card actions are editable Slot children converted by this wrapper to the native actions array. Cover, extra and actions have different roles; do not repeat a page's primary action in each Slot. Verify real permission-dependent actions, long Meta text, cover sizing, loading-to-content and Grid boundaries. Hoverable presentation alone does not make the Card navigate or provide a keyboard action.
