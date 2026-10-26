# Descriptions

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Descriptions | `plasmic-antd6-descriptions` |
| Descriptions.Item | `plasmic-antd6-descriptions-item` |

**Hard constraints** (always delivered with any section):

- Decide `column` from the group's container width before markup: 3 in a full-width page region, 2 in a half-width Card or a 640px Drawer, 1 only below about 560px. See [Column and span](#column-and-span).
- Short parallel facts (status, check results, owner, dates) fill the columns side by side; never stack them in one column inside a wide region.
- A long value takes a larger `span`; it does not lower the whole group's `column`.

## Plan decisions

Declare these native props in each planned instance before markup. `prepare_plan.py scaffold` writes `"__DECIDE__"` for each; selection preflight rejects pending values.

| Registration | Prop | Decision |
| --- | --- | --- |
| `plasmic-antd6-descriptions` | `column` | Column count from the container width under [Column and span](#column-and-span). |

## Generation rules

### Column and span

| Container the group renders in | `column` |
| --- | --- |
| Full-width region of a desktop Page (main content, full-width Card or Tab panel) | 3 |
| Half-width Card or column, 640px Drawer, 720px Modal | 2 |
| Narrower than about 560px, or every value is a long sentence | 1 |

Measure the container in the target viewport when unsure; about 280px or more per column keeps a short label and value on one line. A text wireframe that lists the facts on one line (`a / b / c`) confirms a multi-column group. Give a long identifier, URL or sentence `span` 2 or 3 (at most `column`) so it stays complete, and keep the remaining short Items in normal cells. Fill rows in reading order; avoid a trailing row with a large unexplained gap by adjusting one Item's span, not the column count. An emphasized metric beside the group is a [Statistic](statistic.md) placed under [information composition](../compositions/summary-metrics.md), not another stacked Item.

Column widths follow their content natively, so two groups with different values do not share column edges. Keep that behavior: do not set widths on Items, labels or contents, or override the component's table styles, to equalize columns. Control the layout only through `column`, `span`, `bordered`/`layout` and grouping.

### Composition

Choose Descriptions for source-defined labeled read-only field groups before composition, and inventory their fields independently of output. A group rendered as loose labels/values cannot justify omitting its required native structure from acceptance. Full suites require per-Page inventories (explicit empty groups where the source has none), rather than a project-wide notApplicable based on having generated no Descriptions.

Read before composing a read-only label/value group. [Descriptions + Statistic + Card](../compositions/summary-metrics.md) owns region selection, metric arrangements and adjacent editable Forms.

Read the installed Descriptions and Item contracts. A Card is optional; layout and Tab containers are valid. Give each region one heading owner, avoiding a Card title that repeats the Descriptions title. For an editable prototype with a known field set, use real Descriptions.Item nodes with editable label/children Slots. Its children Slot accepts real [Descriptions Item](descriptions.md#descriptionsitem) nodes. The advanced native items array or expression remains available for data-driven groups and takes precedence over children, including an empty array. Do not set items when the fields must be edited as nodes.

Use the real title Slot with editable text for a group heading. Let the component theme own title typography and title-to-fields spacing; do not imitate it with a separate native heading above an untitled Descriptions. Keep spacing between groups on their containing layout. Select `column` and item spans under [Column and span](#column-and-span). A Key/identifier does not automatically occupy a full row: keep it in a normal cell when the complete expected value fits, and allocate additional span only when real content would otherwise crowd or truncate. Preserve the native theme's label/value hierarchy and internal spacing. The outer Card/layout owns spacing between the summary and Form. Check full long values, wrapping and empty values in Preview; do not silently truncate required identifiers or replace valid zero/false with an empty marker.

### Acceptance inventory

Before insertion, derive the information inventory from the reviewed plan with `prepare_plan.py inventories`, never from the generated HTML. For each reviewed Page, use its planned `path` (or unique existing `name` / known `componentUuid`) and `groups`; each group records its instance `name`, containing region `container`, `title` (empty when intentionally untitled), `column` and either ordered `itemSlots` entries (`name`, `key`, `label`, `children`, optional `span`) or the exact native `items` array/binding expression. Item Slot label/content expectations are their text or binding strings; verify nested rich components and their props separately through the Slot checks and model read. Keep these task-specific expectations outside the product model. Use [verify_all](../../../verification.md#collect-and-verify) to resolve these planned Page selectors against fresh readbacks. The standalone command `python3 scripts/verify_descriptions.py <resolved-inventory.json> <mcp-read.json>` instead requires actual `componentUuid` values already resolved from those readbacks. Check the inserted and saved/reopened models; never fabricate a UUID before creation. Before insertion, review the independent inventory; absent target nodes cannot pass the model gate. It checks component identity, group/container ownership, title, ordered Item nodes, spans and field/binding equality. A missing Descriptions, text substitute or altered field/binding fails even when Slot checks pass. Expressions are never executed by the checker; Preview must separately prove values render correctly. This gate does not detect regions omitted from the reviewed inventory or certify geometry, business APIs or independent AI generation quality.

### Descriptions.Item

Use this registered child inside [Descriptions](descriptions.md). Each field has independent label and children Slots, a stable business key and the native span prop. Labels and values may contain text bindings, tags, links or other registered components; do not concatenate several fields into one Item or put React markup in JSON.

Choose span against the parent column count, available width and realistic value lengths. Keep required identifiers complete and preserve legitimate zero/false. Check ordered fields, rich children, bindings and packing through the parent [acceptance inventory](descriptions.md#acceptance-inventory) and real Preview.

## Acceptance checks

### Rendered columns

In Preview at the target viewport, measure each group's width against its `column`: a group wider than about 640px with one column and three or more Items fails unless a recorded measurement or source quote shows its values need the full width. Check row packing, long values and empty values after save/reopen.

### Native code generation

When the target has the verified native Ant Design items contract, convert this wrapper's Descriptions.Item nodes to items, preserving key/span, order, bindings, conditions and repetition. Slots remain ReactNode, parent items take precedence, and editing wrappers are removed. For a different target library/API, follow the actual two-sided implementation contract in [model reading](../../../model-reading.md); do not copy this items conversion without checking it.
