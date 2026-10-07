# Requirement alignment

Use before requirement-driven generation, regeneration or an audit of page/navigation scope. The source inventory is a task artifact, not another component prop schema and not UI content.

Keep business-specific page counts, entity names, routes, menu trees, field dictionaries and approved layout decisions in that task's inventory. Do not promote them into this skill's defaults or add branches keyed by a requirement ID. Examples illustrate a mechanism only; a new requirement must produce a new inventory from its own sources. This skill targets editable Ant Design PC prototypes in Plasmic; other product/platform requirements need their own applicable design rules, not forced reuse of the admin defaults.

## Source and scope

Read the current requirement body and its page/navigation, field, permission and workflow sections. Record file/URL, version/date and section anchors. Apply explicit user decisions first, then the current requirement; use approved design evidence for presentation and library conventions for unspecified details. History, obsolete screenshots, previous models and generated code are evidence, not authority for current scope. Separate P0/P1/P2 or other release boundaries explicitly.

Record conflicts and their resolution with sources. If a conflict changes business behavior and the current text/user decisions do not resolve it, ask a focused question while continuing independent work. Do not silently select the convenient statement. Visual conventions must not remove required fields, change entry points, permission rules or page ownership.

## Inventory before routes

Create a table with one row per required surface: source section and brief excerpt, purpose, entry/return path, surface kind, shared page identity, type/role/state differences, in-scope decision and proposed route. Classify independent Page, shared-page variant, Tab, Modal/Drawer and overview frame separately. A separate screenshot/frame is not automatically a Page; an overview frame referencing a Page is not a duplicate route.

When the requirement says common/shared detail or creation page, represent type differences through supported bindings, conditional nodes and slots in one Page. Different entity types or permissions alone do not justify another route. Conversely, retain separately specified flows with different entry contracts or business behavior even when their screenshots are similar. Record an explicit user-authorized split if one is required. Count routed Pages from this inventory, never from the number of types, screenshots or generated objects.

Derive the complete navigation tree separately: preserve the requirement's exact labels, parent hierarchy, order, visible/hidden status and destinations. Keep action-only routes under their business owner; a hidden creation/detail route does not become a top-level menu. Record role visibility and test it in live preview. Do not rename a product menu to its current implementation technology. If a host supplies navigation, use its verified contract rather than inventing another sidebar.

Before generation, review coverage in both directions: every in-scope requirement has an intended surface/behavior, and every proposed Page/menu/action has a source or explicit user decision. Mark inferred design choices as such. Keep the reviewed expectation separate from the generator's output plan and generated UUIDs. Updating it requires new source evidence or a user decision; a failed check is not a reason to redefine the expected result.

## Behavior and field matrix

For each required flow, record source, Page/variant, entry trigger, required fields, labels/defaults/enums, editable/read-only behavior, permission gates, state transitions, navigation and observable expected feedback. Use current requirement enums and mandatory fields, with actual registered props/slots/events as the implementation contract. Record mock data/API limitations separately. Test both positive and relevant blocked cases: a hidden list action does not prove its destination is protected; a toast does not prove the expected record changed.

Shared pages must be exercised for every required type, including directly entering the route, switching from different list rows, type-specific field/Tab visibility and the correct return destination. Screenshot acceptance checks both editor and actual preview. Layout checks must include alignment/grouping against the approved design, not only absence of overflow. Record which cases ran and their observations.

## Structural gate

Save a task-local `structure-expectation.json` before generating. It contains all planned Page paths and the full expected AppShell menu tree; give every Page and the navigation a requirement section/excerpt or explicit user-decision citation. Keys/routes are implementation choices; labels/hierarchy/ownership are source-derived. Example format (illustrative routes, not a universal page count):

```json
{
  "pages": [
    {"path": "/records", "source": "requirement.md §List: browse records"},
    {"path": "/record-detail", "source": "requirement.md §Detail: one shared detail for both types"}
  ],
  "navigation": {
    "source": "requirement.md §Navigation: Records > Record list; details entered from rows",
    "items": [
      {"key": "records", "label": "Records", "children": [
        {"key": "list", "label": "Record list", "href": "/records", "children": [
          {"key": "detail", "label": "Record detail", "href": "/record-detail", "hidden": true}
        ]}
      ]}
    ]
  }
}
```

Read the public MCP overview and all full Page models into separate JSON files. Run:

```bash
python3 scripts/verify_structure.py structure-expectation.json overview.json pages.json --report structure-report.json
```

The check rejects missing/extra/duplicate routes, incomplete full-page readback, missing/extra shells and different menu labels/hierarchy/order/visibility/destinations on any Page. It ignores unrelated menu appearance props. It currently checks standalone Overseas AppShell's static `menuItems`; dynamic menus require exercised role/state evidence and cannot pass this static gate by treating an expression as a menu. For host-owned navigation, record that verification separately rather than presenting this AppShell check as applicable.

This check proves agreement with the supplied expectation, not that the expectation faithfully interprets prose. Review its source citations against the original requirement before running the generator. The behavior matrix, role checks and complete-page screenshots remain necessary; structural success does not establish usability or runtime correctness.

After saving/reopening, reread the overview and full Pages and rerun the gate. Report requirement coverage, structural results, visual review, actual interactions and persistence separately. Repeatability is a separate result: two equally wrong runs cannot establish requirement acceptance. Remove obsolete routes/menus/call sites only as part of an authorized correction, then recheck their replacements and incoming links.
