# Page structure design

Before detailed component planning, design how the user will work with the Page's regions. Read this reference with [requirement alignment](../requirement-alignment.md), then use [layout](layout.md) for implementation constraints. Keep the design in the existing Page plan, outside the business UI.

**Hard constraints**:

- Preserve source-required content, behavior and explicit presentation constraints. Label inferred layout decisions as design reasoning; never present them as source quotations or protected-prop overrides.
- Decide region relationships before selecting a template. Read matching live templates and destination contracts before finalizing the structure; templates supply implementation patterns, not business requirements.
- Reference the decided structure during generation and review it against the saved model and rendered Page. A complete declaration does not prove a usable layout.

## Design from the task

First sketch the structure of all in-scope Pages and their shared flows. Detail only the current Page's components, Props, Slots and events. For a local edit, inspect and retain the existing structure outside affected regions; do not redesign sibling Pages or require a new whole-project plan just to change a label.

Identify the primary user task, required regions, their information priority and interaction relationship. Distinguish what must stay visible together from what is sequential, mutually exclusive or opened on demand. Account for required inactive Tabs, steps and overlays without placing them all in the initial view. Document order alone does not prescribe screen order. A region is a business responsibility, not a requirement to add a Card, title or wrapper.

Use [source precedence](../requirement-alignment.md#source-and-scope) for explicit layout instructions and selected visual sources. When presentation is unspecified, make a design decision from the task and content. [Page types](page-types.md) provide starting skeletons and component-reading routes; they do not exhaust possible spatial arrangements. Keep protected component defaults under their owning rules. A new outer layout does not authorize a different Form density, extra Header or altered component contract.

Use these relationships as design cues, not a keyword-to-layout classifier:

| Relationship | Starting arrangement | Check before choosing |
| --- | --- | --- |
| Edit while observing a live result | Side-by-side editor and preview on desktop | Both regions need usable width; choose the dominant region from the task, not a universal 50/50 ratio |
| Produce a result after an explicit action | Result below its input, or an on-demand overlay | Keep result near its trigger; use simultaneous visibility when comparison is part of the task |
| Select an item, then work in its context | Navigation/list beside a flexible workspace | Selection must establish the workspace context; two adjacent regions alone do not make a catalog workspace |
| Complete ordered stages with prerequisites | Steps with one active stage | Preserve required review/context; do not hide independently editable peer regions behind artificial steps |
| Read a record and related information | Summary followed by grouped details or scoped Tabs | Keep decision-critical context accessible without repeating fields or adding a generic Page header |

Choose fixed, content-sized or flexible regions from real content needs and the supported viewport. Record which region owns scrolling and where actions belong. Follow the existing shell and shared Scrollbar contracts; do not invent independent pane scrolling without a verified need and supported integration. Add responsive behavior only when in scope. If two useful regions do not fit, revise the arrangement rather than shrinking controls or dropping content.

## Resolve templates and contracts

Read `RESOURCE_ROOT/references/admin-templates.md` and the complete `RESOURCE_ROOT/references/templates/admin/catalog.json`, where `RESOURCE_ROOT` is the resolver's `resourceRoot`. Follow [template acquisition](../admin-templates.md#read-and-compose-through-public-tools) to inspect matching live models and nested definitions. Do not guess local template paths, project IDs or native registration keys.

Match both the Page and its individual regions by scenario and interaction scope. Compare the draft with the live template's layout, Slots and destination component capabilities, then retain or revise the structure with a concrete reason. For an editor with live preview, a form region may reuse the form template's inspected structure even when no complete editor-preview template exists. A catalog template is not a match solely because it also has two columns. Record selections and adaptations in the existing `templates` entries; do not duplicate template identities in the structure decision.

Finalize the current Page and complete the [Design review checkpoint](../review-mode.md#review-checkpoints) before markup. Review a structure-only draft with its unresolved contract assumptions; do not invent live evidence. Missing layout detail is normally an agent decision, not a user approval checkpoint. Ask only about an unresolved material source conflict or business choice; continue independent work. A missing required contract blocks the affected implementation, not permission to silently change the requirement.

## Plan decision

Record `pageStructure` on each complete Page in `structure-expectation.json`. Draft it alongside the page inventory before detailed declarations; resolve region `nodeName` references to the existing `components` or `nodes` inventory before preflight. Use concise prose, not a new layout DSL or a second Props/Slots schema.

| Field | Meaning |
| --- | --- |
| `intent` | The primary task the Page supports |
| `source` | Current requirement/user-decision citation; identify explicit spatial constraints, or state that arrangement is unspecified |
| `layout` | Region order, grouping, spatial relationship and relevant conditional visibility; a small text sketch is optional |
| `rationale` | Agent reasoning connecting that arrangement to the task, distinguished from explicit source constraints |
| `regions` | Nonempty array of `{nodeName, purpose}` identifying business-region anchors, including required conditional regions; do not repeat every field or invent wrappers just for this array |
| `sizing` | Which regions are fixed/content-sized/flexible, the usable-width basis and any in-scope reflow |
| `scrolling` | Actual shell/region scroll ownership and how overflowing content and final actions stay reachable |
| `actions` | Placement and scope of primary/secondary actions; state when no actions are required |

These are planning fields, never native component props. Use the component/node declarations for real identities, ownership and values. Keep source wireframe coverage in `wireframe`; an agent-authored sketch is not a source wireframe. The runnable [plan example](../planning.md#format-example-and-mechanical-helpers) demonstrates the envelope.

Preflight checks required fields and distinct, declared region anchors. It does not infer source meaning, judge a layout rationale, or prove region coverage or pixel geometry. Existing content/owner gates check the referenced declarations against the saved model; actual region relationships still need visual review.

## Generate, evaluate and revise

Compose from the finalized structure and verified component contracts. When source, contract or measured geometry changes the design, update the affected decision before continuing and rerun affected checks. Agent-inferred arrangements may change with documented reasoning; changing source-required content or explicit layout constraints follows requirement alignment. Do not rewrite the plan merely to bless an incorrect generated result.

Review each affected Page against the same design at the required viewport and relevant states:

- Every required region is present in its intended context; priority, order, side-by-side relationships and action ownership match the plan.
- The actual content fits its assigned space: populated tables, long labels, validation errors and preview media remain usable without unintended document overflow.
- Coupled regions remain observable during the required interaction. For a live preview, change representative inputs and verify the preview updates; adjacent static mockups do not satisfy live behavior.
- Scroll ownership, hidden-state transitions and action reachability work in Preview and persist after save/reopen.

Record observed evidence and unresolved findings in the existing acceptance/review artifacts. Revise poor inferred layout choices when the evidence warrants it, then recheck. A checked plan, screenshot or template-source read alone cannot pass these checks.
