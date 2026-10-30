# Text wireframes

This reference inventories wireframes supplied as requirement sources. Keep agent-authored structure sketches in [pageStructure](page-structure.md#plan-decision), not as fabricated source evidence.

Requirements often draw pages as text wireframes: box-drawing frames, `[按钮]`, `[____]`, `▾` and short annotations. A text wireframe is the Page's visual source. Read it under [visual sources](../requirement-alignment.md#visual-sources-and-component-rules) and reconcile its members with the requirement body under [content before presentation](../requirement-alignment.md#content-before-presentation). It fixes regions, members, grouping and order; it does not fix pixel sizes, column counts or component library.

## Inventory

Before choosing components, copy every element of the Page's wireframe into the plan's `wireframe` decision and map it to a planned node, or exclude it with a source-backed reason. Elements are fields, actions, named regions, headers, Tabs, status lines, read-only lines and fold markers. Annotations for readers (`← …`, `（说明）`) are excluded as not user-facing or recorded as behavior.

```json
"wireframe": {
  "source": {"path": "/abs/PRD.md", "sha256": "…", "quote": "<the verbatim wireframe block>"},
  "items": [
    {"text": "名称[____]", "node": "NameItem"},
    {"text": "备注[____]", "node": "RemarkItem"},
    {"text": "── 规则配置卡 ──", "node": "RuleCard"},
    {"text": "卡头: [导入] [导出]", "node": ["ImportButton", "ExportButton"]},
    {"text": "（批量编辑 · P1）", "excluded": "Later release; out of this scope"}
  ]
}
```

Create `source` with `prepare_plan.py evidence`, quoting the complete wireframe block for this Page. Selection preflight requires each item's `text` to be a verbatim part of the quote, every bracketed (`[…]`) or dropdown (`…▾`) token in the quote to appear in some item, each `node` to be a declared component, and each exclusion to state a reason. A Page without a text wireframe declares `{"notApplicable": "<reason>"}`. A missing field is repaired in the plan, never dropped because the layout looks fuller without it.

## Notation

Read the document's own legend or notation section first; it takes precedence. Without one, these common forms apply:

| Notation | Meaning | Native mapping |
| --- | --- | --- |
| `── X卡 ──`, `X 区`, `X 栏` | A named business region | Region name X is the title text if a header is needed; whether it gets one follows [Card headers](../libraries/antd_v6/components/card.md#card-headers) |
| `卡头: [A] [B]` | Actions drawn in the region header | Card `header: title+extra`: title X, extra A and B |
| `Label[____]`, `Label▾`, `Label[value]` | Editable fields of one Form, in reading order | One Form.Item each; [Form layout](../libraries/antd_v6/compositions/form-layout.md#layout-ownership) decides Page/overlay columns and full-row fields from the source and content. Incidental wireframe line breaks alone do not set columns |
| `ℹ` after a field | Field help | Form.Item `tooltip` |
| `Tab：[X]（Y · P1）` | Tabs, some out of scope | Tabs only with two or more in-scope tabs; a single in-scope tab is not rendered, and X is the region's title text when [Card headers](../libraries/antd_v6/components/card.md#card-headers) justify a header |
| `label: a / b / c` or `a · b · c` on one line | Parallel read-only facts | Multi-column Descriptions under its [column defaults](../libraries/antd_v6/components/descriptions.md#column-and-span) |
| `状态条: ✓ …` | Persistent status feedback | Alert |
| `[按钮]` in a bottom or `底部操作` row | Page or Form actions | [Action bars](../libraries/antd_v6/compositions/action-bars.md#buttons-and-action-bars) |
| `（折叠）` | Collapsible region | A titled header with a toggle (Card `header` reason `collapse`) or Collapse, if folding is in scope |
| Values such as `12,340 人`, `[3天]` | Example or default data | Mock data or `initialValues`; required defaults come from the requirement body |

Notation outside this table is interpreted from the requirement body; record the interpretation as the item's mapping.
