# Authored names and UI copy

Read before composing business markup and when reconciling naming/copy findings. Use the same source-derived `structure-expectation.json` as component selection; this is review evidence, not a new persisted Studio schema. The generating model performs this review against the requirement and live template/contract, including in a single-model run.

## Before generation

Choose names while deciding each node's role. Existing `components` entries already provide functional instance names, identities, sources and purposes. Add `nodes` for authored layout components, owned children, ordinary containers and text nodes not in `components`. Include roots, repeated templates, inactive Tabs and overlays. Each name occurs once across both arrays. Supplemental nodes record their native `tag` or `component`, `purpose`, `source` and nearest component `owner:{nodeName,slot}`; use `owner:null` outside a component. Slot names remain the registered English contract. A wrapper does not change the nearest component/Slot owner.

For each name, read the source role, actual content and owner together. Ask whether the editor name would distinguish the node without opening its props. A label for a Key field can be `KeyLabel`; a table header can be `AllGroupsKeyTitle` when scope is needed. Ordinary layout may use `Toolbar` or `Flex` when that explains its role. Choose words for the actual scope rather than expanding every name. Numbers are valid when they express business meaning; traversal position, error order and arbitrary serial suffixes are not naming evidence. Preserve an already clear name. Follow [naming](naming.md) for native renaming and identity preservation.

Interpret requirement sentences before using them as interface copy. Classify their purpose: a visible label/value, information needed for a user's current decision, an operation result, or a rule implemented by behavior. A system validation algorithm, implementation rationale, scope statement or permission matrix usually belongs in behavior/reporting. Do not paste it into a nearby Form description merely because it mentions the same field. A genuine input/output constraint or recovery instruction can be useful help, including technical vocabulary where the user's operation requires it.

Record **all authored UI literals and bindings**, not only suspicious words or selected help. `copy.entries` uses:

- `nodeName`: the actual named text node or component owning the value.
- `at`: `/text` for that node's direct text, `/slots/<nativeSlot>/text` for text directly inside a component Slot, or `/props/<nativePropertyPath>` using JSON-pointer escaping.
- `text`: exact literal or binding source; `kind`: `label`, `placeholder`, `value`, `help`, `warning` or `feedback`.
- `source`: the requirement section/excerpt or explicit user decision; `purpose`: the specific user decision/action this copy supports at this location. A source citation alone does not justify showing its prose.

The collector inspects authored text and native text-bearing props, including nested option/menu labels, validation messages and hidden branches. Text-valued native `value`/`defaultValue` props are candidates; option keys are separate from displayed labels. Discover additional visible prop names from the actual component contract and declare their paths in that node's `copyProps`, relative to its native props (e.g. `['/caption']`). Do not put event handlers or whole data sources there. Whole data sources remain business data review; dynamic copy is reviewed as a binding plus its resolved values in Preview. Read inherited defaults from the live template/contract and inspect their rendered result; do not invent task-authored declarations for read-only library internals.

Use `copy.excluded` for source-specific requirement/process passages kept outside UI, with a source for each. This supplements exhaustive copy coverage; an empty exclusion list never approves unreviewed help. An empty entries array is valid only when there is no authored UI text. Do not infer approval from omitted inventory or blacklist words globally.

Example fragment (combine with the Page's component/template/behavior inventories):

```json
{
  "components": [],
  "nodes": [
    {"nodeName":"QueryField","component":"plasmic-antd6-form-item","owner":null,"purpose":"Submitted SQL query field","source":"requirement §SQL input"},
    {"nodeName":"QueryHelp","tag":"span","owner":{"nodeName":"QueryField","slot":"description"},"purpose":"Explain the query output required before submission","source":"requirement §SQL input"}
  ],
  "copy": {
    "source":"requirement §SQL input reviewed for query entry",
    "excluded":[],
    "entries":[{"nodeName":"QueryHelp","at":"/text","text":"查询结果须包含成员 uid 列。","kind":"help","purpose":"Tell the query author which output column is required","source":"requirement §SQL input"}]
  }
}
```

Set the reviewed names in initial markup with `data-plasmic-name`; put copy in the real registered property/Slot. Do not copy this example's domain, words or component choices into another requirement. The preflight validates coverage declarations before business writes. It cannot decide whether a cited sentence was correctly interpreted.

## Saved-model acceptance

Run the full Page selection preflight, then the saved-output suite as documented in [verification](../verification.md). It compares in both directions: every authored named node resolves once to a reviewed role/identity; additional/missing nodes fail, and declared owner/Slot changes fail. Every actual UI copy location must have a matching reviewed value; missing, changed, moved and extra copy fail. Hidden authored branches are included. `components` entries may also declare `owner` to pin their native placement. These checks establish coverage and consistency, not natural-language semantic correctness.

For a focused, read-only inventory or comparison:

```bash
python3 RESOURCE_ROOT/scripts/verify_content.py work/pages.json --page-path /records --output work/content-inventory.json
python3 RESOURCE_ROOT/scripts/verify_content.py work/pages.json --expectation work/structure-expectation.json --page-path /records --output work/content-check.json
```

The inventory contains UUID, nearest component, Slot and text; it is **unreviewed evidence**, not an automatically approved plan. Compare all actual candidates with the source-backed plan, including ordinary text wrappers and unexpected help. Do not turn an error UUID list into numbered names or copy the observed text into the expected inventory to make a gate pass. If output differs, fix output to source intent; when intent was incomplete, reread the source and record the actual rationale before amending it. Use native rename so UUIDs/references survive, then save/reread and rerun the checks.

Finally review the meaning of every planned name and copy entry against its source and owning screen. For help/warnings, identify what the user can decide or do with the information in that location. Render and inspect actual wording, defaults, conditional text and operation feedback. JS-generated messages are checked through the source-derived feedback/business outcome cases and their observed Preview values; static matching does not execute handlers. Keep semantic review and Preview observations in the task evidence. Do not report semantic acceptance based only on PascalCase, matching arrays or a static `passed:true`.
