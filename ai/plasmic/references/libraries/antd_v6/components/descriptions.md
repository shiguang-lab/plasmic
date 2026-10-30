# Descriptions

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Descriptions | `plasmic-antd6-descriptions` |
| Descriptions.Item | `plasmic-antd6-descriptions-item` |

**Hard constraints** (always delivered with any section):

- The field collection uses either native `items` or direct Descriptions.Item children, never both. Reject span/div/text fields, layout components and wrappers in the children Slot, even beside valid Items. Text and rich content remain valid inside Item label/children Slots and the Descriptions title Slot.
- Fixed fields must use real Descriptions.Item nodes with editable label/children Slots, even when values are bound to API data. Native `items` is allowed only when the field collection itself is determined at runtime or the user explicitly requests it; record source-backed `itemsReason` outside props. See [Composition](#composition).
- Decide `column` from the group's container before markup: 3 or 4 in a full-width page region according to actual value lengths and rendered density (use 4 when 3 looks too sparse, 3 when 4 crowds the content), 2 in a half-width Card, 640px Drawer or 720px Modal, 1 below about 560px. A wider single-column group needs evidence that every value requires a full row, or an explicit source override. See [Column and span](#column-and-span).
- Default to `layout="horizontal"` (label and value side by side). Use `vertical` only when explicitly required by the user or source; a template or aesthetic preference does not justify it. See [Layout direction](#layout-direction).
- Short parallel facts (status, check results, owner, dates) fill the columns side by side; never stack them in one column inside a wide region.
- A long value takes a larger `span`; it does not lower the whole group's `column`.
- Give each region one heading owner. Use the real title Slot for a Descriptions group heading; do not clear it and imitate the heading with separate native text. A containing Card may own the region heading without repeating it on Descriptions; intentionally untitled groups remain valid. See [Composition](#composition).

## Plan decisions

Declare these native props in each planned instance before markup. `prepare_plan.py scaffold` sets the horizontal layout baseline and writes `"__DECIDE__"` for column; selection preflight rejects pending values.

| Registration | Prop | Decision |
| --- | --- | --- |
| `plasmic-antd6-descriptions` | `column` | Column count from the container, actual value lengths and rendered density under [Column and span](#column-and-span). |
| `plasmic-antd6-descriptions` | `layout` | `horizontal` by default; `vertical` only with an explicit user/source requirement under [Layout direction](#layout-direction). |

## Generation rules

### Column and span

| Container the group renders in | `column` |
| --- | --- |
| Full-width region of a desktop Page (main content, full-width Card or Tab panel) | 3 or 4, according to actual value lengths and rendered density |
| Half-width Card or column, 640px Drawer, 720px Modal | 2 |
| Narrower than about 560px, or evidence shows every value requires a full row | 1 |

For a full-width region, compare the actual labels and realistic values at the target viewport: use 4 columns when 3 leaves excessive whitespace; use 3 when 4 crowds labels/values or causes avoidable wrapping. Choose from the rendered result, not container width alone or a fixed template count.

For a wider single-column group, review every value at the target viewport or cite an explicit source override under [protected configuration](../../../design/component-policy.md#protected-configuration). One long value justifies that Item's span, not a single-column group. A width measurement alone does not identify a full-width region versus a half-width or overlay container.

Measure the container in the target viewport when unsure; about 280px or more per column keeps a short label and value on one line. A text wireframe that lists the facts on one line (`a / b / c`) confirms a multi-column group. Give a long identifier, URL or sentence `span` 2, 3 or 4 (at most `column`) so it stays complete, and keep the remaining short Items in normal cells. Fill rows in reading order; avoid a trailing row with a large unexplained gap by adjusting one Item's span, not the column count. An emphasized metric beside the group is a [Statistic](statistic.md) placed under [information composition](../compositions/summary-metrics.md), not another stacked Item.

Column widths follow their content natively, so two groups with different values do not share column edges. Keep that behavior: do not set widths on Items, labels or contents, or override the component's table styles, to equalize columns. Control the layout only through `column`, `span`, `bordered`/`layout` and grouping.

### Layout direction

Set `layout="horizontal"` by default in Pages, Cards, Tab panels, Modals and Drawers: labels and values appear side by side. `layout="vertical"` places labels above values and is reserved for an explicit user or source requirement; cite that requirement in the task plan. Narrow width, long content, a template default or a visual preference alone does not justify switching to vertical. Adjust column count and Item spans under [Column and span](#column-and-span) instead.

### Composition

Choose Descriptions for source-defined labeled read-only field groups before composition, and inventory their fields independently of output. A group rendered as loose labels/values cannot justify omitting its required native structure from acceptance. Full suites require per-Page inventories (explicit empty groups where the source has none), rather than a project-wide notApplicable based on having generated no Descriptions.

Read before composing a read-only label/value group. [Descriptions + Statistic + Card](../compositions/summary-metrics.md) owns region selection, metric arrangements and adjacent editable Forms.

Read the installed Descriptions and Item contracts. A Card is optional; layout and Tab containers are valid. Give each region one heading owner, avoiding a Card title that repeats the Descriptions title. For a known field set, always use real Descriptions.Item nodes with editable label/children Slots, including when their values are API-bound. Its children Slot accepts only direct [Descriptions Item](descriptions.md#descriptionsitem) nodes. Do not imitate fields with span/div/text, put Flex/Row or other wrappers between Descriptions and Item, or mix such nodes beside real Items. Choose one field source: native `items` or Item children; remove unused children when selecting native items. Text and rich components belong inside each Item’s label/children Slots; the title Slot may also contain editable text. Use the advanced native `items` array/expression only when the field collection itself is determined at runtime or the user explicitly requests native `items`. Bound values within a fixed array, shorter markup and template defaults do not qualify. Native `items` takes precedence over children, including an empty array. Do not set it for the default editable composition.

For either exception, put `itemsReason` beside `props` on the planned Descriptions declaration; inventory derivation preserves it on the group. Use `{kind:"dynamic-fields", binding:"$ctx.query.fields", evidence:{path,sha256,quote}}` for a runtime field collection; `items` must be an expression using that actual collection binding. Use `{kind:"explicit-user-request", evidence:{path,sha256,quote}}` when the user explicitly requests native items. Evidence follows the existing absolute source path, hash and verbatim quote contract; it must establish the dynamic field collection or the explicit user request, not merely data-bound values. Keep this task evidence outside component props and saved designs. Preflight and saved-model checks reject missing/invalid evidence; source semantics and runtime field changes still require review and Preview verification.

Use the real title Slot with editable text for a group heading. Let the component theme own title typography and title-to-fields spacing; do not imitate it with a separate native heading above an untitled Descriptions. Keep spacing between groups on their containing layout. Select `column` and item spans under [Column and span](#column-and-span). A Key/identifier does not automatically occupy a full row: keep it in a normal cell when the complete expected value fits, and allocate additional span only when real content would otherwise crowd or truncate. Preserve the native theme's label/value hierarchy and internal spacing. The outer Card/layout owns spacing between the summary and Form. Check full long values, wrapping and empty values in Preview; do not silently truncate required identifiers or replace valid zero/false with an empty marker.

### Acceptance inventory

Before insertion, derive the information inventory from the reviewed plan with `prepare_plan.py inventories`, never from the generated HTML. For each reviewed Page, use its planned `path` (or unique existing `name` / known `componentUuid`) and `groups`; each group records its instance `name`, containing region `container`, `title` (empty when intentionally untitled), `column` and either ordered `itemSlots` entries (`name`, `key`, `label`, `children`, optional `span`) or, for an approved exception, the exact native `items` array/binding expression with `itemsReason`. Item Slot label/content expectations are their text or binding strings; verify nested rich components and their props separately through the Slot checks and model read. Keep these task-specific expectations outside the product model. Use [verify_all](../../../verification.md#collect-and-verify) to resolve these planned Page selectors against fresh readbacks. The standalone command `python3 scripts/verify_descriptions.py <resolved-inventory.json> <mcp-read.json>` instead requires actual `componentUuid` values already resolved from those readbacks. Check the inserted and saved/reopened models; never fabricate a UUID before creation. Before insertion, review the independent inventory; absent target nodes cannot pass the model gate. It checks component identity, group/container ownership, title, exclusive field sources, direct Item-only children, ordered Item nodes, spans and field/binding equality. Preflight checks the declared components/native nodes; saved-model checks reject illegal field children even when omitted from the planned Item inventory. A missing Descriptions, text substitute or altered field/binding fails even when Slot checks pass. Expressions are never executed by the checker; Preview must separately prove values render correctly. This gate does not detect regions omitted from the reviewed inventory or certify geometry, business APIs or independent AI generation quality.

The report distinguishes inventory consistency and supported static checks from `notChecked` design obligations. Static checks reject non-positive/non-integer literal columns and literal spans outside 1..column, even when the plan agrees. Expressions remain for runtime review. Layout evidence enables the limited wide-single-column check; absent/hidden group measurements remain unverified. A verified quote or a longest-value measurement alone does not prove that the exception applies to every value. Keep `columnReason`, when needed, on the planned Descriptions declaration (beside `props`); inventory derivation preserves it.

### Descriptions.Item

Use this registered child inside [Descriptions](descriptions.md). Each field has independent label and children Slots, a stable business key and the native span prop. Labels and values may contain text bindings, tags, links or other registered components; do not concatenate several fields into one Item or put React markup in JSON.

Choose span against the parent column count, available width and realistic value lengths. Keep required identifiers complete and preserve legitimate zero/false. Check ordered fields, rich children, bindings and packing through the parent [acceptance inventory](descriptions.md#acceptance-inventory) and real Preview.

## Acceptance checks

### Rendered columns

In Preview at the target viewport, measure each group's width against its `column`: a group wider than about 640px with one column and three or more Items fails unless a recorded measurement or source quote shows its values need the full width. Check row packing, long values and empty values after save/reopen.

For full-width regions, verify the 3/4-column choice with realistic values: 3 must not leave excessive whitespace, and 4 must not crowd the content. Check the full Column and span table, not only that automated single-column condition. Establish the actual full-width/half-width/overlay container, review every value for a single-column exception, and exercise dynamic items/column/span bindings. Missing measurements or unexecuted expressions remain unverified; a matching plan and model is not evidence of the correct column choice.

### Rendered direction

Check the plan, saved/reopened native `layout` prop and Preview against the horizontal default. A vertical group requires an explicit user/source requirement; reject inherited template direction or aesthetic preference as the reason. This semantic exception review is manual, not covered by the static Descriptions inventory checker.

### Heading ownership

Review the group's surrounding content and native title Slot against its source purpose. Reject a separate native heading substituting for an empty Descriptions title, and duplicate Card/Descriptions headings for the same region. Keep legitimate Card-owned headings, unrelated help text and intentionally untitled groups. Do not classify arbitrary adjacent text as a heading solely from its tag or position; the static inventory checker compares the expected title, not its semantic ownership.

### Native code generation

When the target has the verified native Ant Design items contract, convert this wrapper's Descriptions.Item nodes to items, preserving key/span, order, bindings, conditions and repetition. Slots remain ReactNode, parent items take precedence, and editing wrappers are removed. For a different target library/API, follow the actual two-sided implementation contract in [model reading](../../../model-reading.md); do not copy this items conversion without checking it.
