# Descriptions

Choose Descriptions for source-defined labeled read-only field groups before composition, and inventory their fields independently of output. A group rendered as loose labels/values cannot justify omitting its required native structure from acceptance. Full suites require per-Page inventories (explicit empty groups where the source has none), rather than a project-wide notApplicable based on having generated no Descriptions.

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Descriptions | `plasmic-antd6-descriptions` |
| Descriptions.Item | `plasmic-antd6-descriptions-item` |

Read before composing a read-only label/value group. [Descriptions + Statistic + Card](../compositions/summary-metrics.md) owns region selection, metric arrangements and adjacent editable Forms.

Read the installed Descriptions and Item contracts. A Card is optional; layout and Tab containers are valid. Give each region one heading owner, avoiding a Card title that repeats the Descriptions title. For an editable prototype with a known field set, use real Descriptions.Item nodes with editable label/children Slots. Its children Slot accepts real [Descriptions Item](descriptions.md#descriptionsitem) nodes. The advanced native items array or expression remains available for data-driven groups and takes precedence over children, including an empty array. Do not set items when the fields must be edited as nodes.

Use the real title Slot with editable text for a group heading. Let the component theme own title typography and title-to-fields spacing; do not imitate it with a separate native heading above an untitled Descriptions. Keep spacing between groups on their containing layout. Select `column` and item spans from available width and realistic value lengths. A Key/identifier does not automatically occupy a full row: keep it in a normal cell when the complete expected value fits, and allocate additional span only when real content would otherwise crowd or truncate. Inspect row packing and avoid large unexplained gaps. Preserve the native theme's label/value hierarchy and internal spacing. The outer Card/layout owns spacing between the summary and Form. Check full long values, wrapping and empty values in Preview; do not silently truncate required identifiers or replace valid zero/false with an empty marker.

## Acceptance inventory

Before insertion, freeze a requirement-derived information inventory independently of the generated HTML. For each reviewed Page, record `componentUuid` and `groups`; each group records its instance `name`, containing region `container`, `title` (empty when intentionally untitled), `column` and either ordered `itemSlots` entries (`name`, `key`, `label`, `children`, optional `span`) or the exact native `items` array/binding expression. Item Slot label/content expectations are their text or binding strings; verify nested rich components and their props separately through the Slot checks and model read. Keep these task-specific expectations outside the product model. Run `python3 scripts/verify_descriptions.py <information-inventory.json> <mcp-read.json>` against the complete inserted model before delivery, after save and after reopen. Before insertion, review the independent inventory; absent target nodes cannot pass the model gate. It checks component identity, group/container ownership, title, ordered Item nodes, spans and field/binding equality. A missing Descriptions, text substitute or altered field/binding fails even when Slot checks pass. Expressions are never executed by the checker; Preview must separately prove values render correctly. This gate does not detect regions omitted from the reviewed inventory or certify geometry, business APIs or independent AI generation quality.

## Native code generation

When the target has the verified native Ant Design items contract, convert this wrapper's Descriptions.Item nodes to items, preserving key/span, order, bindings, conditions and repetition. Slots remain ReactNode, parent items take precedence, and editing wrappers are removed. For a different target library/API, follow the actual two-sided implementation contract in [model reading](../../../model-reading.md); do not copy this items conversion without checking it.

## Descriptions.Item

Use this registered child inside [Descriptions](descriptions.md). Each field has independent label and children Slots, a stable business key and the native span prop. Labels and values may contain text bindings, tags, links or other registered components; do not concatenate several fields into one Item or put React markup in JSON.

Choose span against the parent column count, available width and realistic value lengths. Keep required identifiers complete and preserve legitimate zero/false. Check ordered fields, rich children, bindings and packing through the parent [acceptance inventory](descriptions.md#acceptance-inventory) and real Preview.
