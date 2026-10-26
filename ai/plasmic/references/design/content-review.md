# Authored names and UI copy

Read before composing business markup and when reconciling naming/copy findings. Use the same source-derived `structure-expectation.json` as component selection; this is review evidence, not a new persisted Studio schema. The generating model performs this review against the requirement and live template/contract, including in a single-model run.

## Before generation

Choose names while deciding each node's role. Existing `components` entries already provide functional instance names, identities, sources and purposes. Add `nodes` for authored layout components, owned children, ordinary containers and text nodes not in `components`. Include roots, repeated templates, inactive Tabs and overlays. Each name occurs once across both arrays. Supplemental nodes record their native `tag` or `component`, `purpose`, `source` and nearest component `owner:{nodeName,slot}`; use `owner:null` outside a component. Slot names remain the registered English contract. A wrapper does not change the nearest component/Slot owner.

For each name, read the source role, actual content and owner together. Ask whether the editor name would distinguish the node without opening its props. A label for a Key field can be `KeyLabel`; a table header can be `AllGroupsKeyTitle` when scope is needed. Ordinary layout may use `Toolbar` or `Flex` when that explains its role. Choose words for the actual scope rather than expanding every name. Numbers are valid when they express business meaning; traversal position, error order and arbitrary serial suffixes are not naming evidence. Preserve an already clear name. Follow [naming](naming.md) for native renaming and identity preservation.

Interpret requirement sentences before using them as interface copy — this applies to every authored literal, not only Form help. Classify each one: a visible label/value, information needed for a user's current decision, an operation result, or a rule implemented by behavior. Validation algorithms and rule lists (`语法校验：仅只读 SELECT…`, `底表校验：FROM 表属于…`) are behaviour; show the outcome, not the algorithm. Keep labels to the source's own UI wording (a wireframe `[校验]` stays `校验`; do not expand it into the rule name). A system validation algorithm, implementation rationale, scope statement or permission matrix usually belongs in behavior/reporting. Do not paste it into a nearby Form description merely because it mentions the same field. A genuine input/output constraint or recovery instruction can be useful help, including technical vocabulary where the user's operation requires it.

Record **all authored UI literals and bindings**, not only suspicious words or selected help. `copy.entries` uses:

- `nodeName`: the actual named text node or component owning the value.
- `at`: `/text` for that node's direct text, `/slots/<nativeSlot>/text` for text directly inside a component Slot, or `/props/<nativePropertyPath>` using JSON-pointer escaping.
- `text`: exact literal or binding source; `kind` (required): `label`, `placeholder`, `value`, `help`, `warning`, `feedback` or `action` (button/menu labels).
- `role` (optional): refines the kind's budget below. Omitted, it follows the kind (`action` → `button`, `label` → `fieldLabel`, `placeholder` → `placeholder`, `help`/`warning`/`feedback` → `help`, `value` → `value`); set `columnTitle`, `title` or `hint` where that is the real owner. `role:"other"` skips the budget and needs a `roleReason`.
- `copyTriage` (optional): `perceive-now`, `perceive-on-demand` or `not-user-facing`; omitted, tooltip locations are on demand and all others perceive-now. `not-user-facing` text must move to `copy.excluded`. Form fields record their own triage under [Form label help](../libraries/antd_v6/components/form.md#label-help).
- `source`: the requirement section/excerpt or explicit user decision; `purpose`: the specific user decision/action this copy supports at this location. A source citation alone does not justify showing its prose.

The collector inspects authored text and native text-bearing props, including nested option/menu labels, validation messages and hidden branches. Text-valued native `value`/`defaultValue` props are candidates; option keys are separate from displayed labels. Discover additional visible prop names from the actual component contract and declare their paths in that node's `copyProps`, relative to its native props (e.g. `['/caption']`). Do not put event handlers or whole data sources there. Whole data sources remain business data review; dynamic copy is reviewed as a binding plus its resolved values in Preview. Read inherited defaults from the live template/contract and inspect their rendered result; do not invent task-authored declarations for read-only library internals.

### Copy economy

Every literal is budgeted. Write the shortest text that still supports the user's next decision; the requirement document is not the copy deck.

The structural gate applies each entry's role budget and a repetition check. Length is counted in display units after trimming: a CJK or fullwidth character is 1 unit, any other character 0.5, so `新建供应商` is 5 and `Save draft` is 5. Bindings are reviewed in Preview.

| Owner (`role`) | Budget | Rule |
| --- | --- | --- |
| Action label (`button`) | verb, or verb + object, ≤ 6 units | Use the wireframe/requirement's own UI wording (`[校验]` stays `校验`); never a rule, algorithm or API name (`校验语句合法性` is wrong) |
| Field label (`fieldLabel`) | noun, ≤ 10 units | No parenthetical notes, no trailing colon in code (the control renders it), required state comes from the rule not the label |
| Column title (`columnTitle`) | noun, ≤ 8 units | Do not repeat the Table's own scope in every column |
| Placeholder (`placeholder`) | one short example or format, ≤ 16 units | Instructions belong to field help, never the placeholder |
| Section/card title (`title`) | noun phrase, ≤ 12 units | Do not restate the page directory name or the first field's label |
| Help/tooltip/feedback (`help`) | one sentence, ≤ 80 units | Long prose goes to the tooltip or `copy.excluded`; a multi-column Form caps `description` (see form-layout) |
| Footer hint (`hint`) | current prerequisite only, ≤ 20 units | Never a process narrative (`提交后自动预跑，预跑成功后可保存 SQL / 上线`) |

State each fact once, at the single owner where the user acts on it: a constraint shown in a banner must not repeat in the field help, the card description and the footer hint. A read-only summary surface such as a detail Card lists only the facts the requirement assigns to it; do not append a behaviour explanation (refresh cadence, retention policy, refresh semantics) that a KPI or sibling Card already owns — the fact keeps its single owner and the summary keeps its real content. `button`, `help`, `hint` and `title` entries are compared for repeats and fail when the same text appears at two owners; data values and column titles may legitimately repeat. Prefer the field-level owner for input constraints and the banner only for page-wide scope. Use operator vocabulary from the requirement glossary; internal identifiers, algorithm names, table names and permission matrices stay out of the UI.

Use `copy.excluded` for source-specific requirement/process passages kept outside UI. Each exclusion carries `{text, source, evidence}`, where `evidence` is `{path, sha256, quote}` for the requirement file: `text` must appear verbatim in that quote (markdown emphasis and wrapping whitespace ignored), a paraphrase or stale hash fails, and the same text cannot be excluded twice. The structural gate also fails when an excluded passage appears in the rendered UI copy. This supplements exhaustive copy coverage; an empty exclusion list never approves unreviewed help. An empty entries array is valid only when there is no authored UI text. Do not infer approval from omitted inventory or blacklist words globally.

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
