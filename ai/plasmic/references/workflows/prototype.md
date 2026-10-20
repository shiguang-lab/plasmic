# Product prototype workflow

Resolve Team → Workspace → Project through [project management](../desktop-management.md), then reread identity and schemas. Edits require canEdit.

## Resolve scope and contracts

Read the actual source and [requirement alignment](../requirement-alignment.md). Freeze source-derived routes, fields, actions, native component mappings and UI-copy decisions outside the UI. Follow [context reading](../context-reading.md) for complete source coverage with bounded tool results.

For admin work, read [admin design](../admin-design.md), [templates](../admin-templates.md) and [catalog](../templates/admin/catalog.json). Apply [content entry](../design/layout.md#admin-content-entry) and [native component selection](../libraries/index.md#native-component-selection). Discover components by source role, verify destination contracts and prepare compatible dependencies before freezing intent. Use the matching composition for cross-region decisions; Overseas/Antd-v6 lists use [query/list composition](../libraries/overseas/compositions/search-table.md). Record the actual template reuse mechanism. Explicit regeneration/stability work also reads [reproducibility](../reproducibility.md).

For a supported full-project suite, run `python3 RESOURCE_ROOT/scripts/verify_mcp_contract.py --profile "/absolute/Desktop user-data" --expectations /absolute/task/suite.json --report /absolute/task/mcp-contract.json`. Correct contract/inventory failures before business writes.

## Complete one Page at a time

New full-project generation of standalone fixed-viewport Overseas/Antd-v6 Pages must read and use the [controlled task](../prototype-tasks.md) and [unified verifier](../verification.md). Focused edits, host-owned/content-growing layouts and other library scopes use scoped checks and report unsupported coverage.

The [controlled task](../prototype-tasks.md#start-and-advance) owns the precise phase order and commands. Start it before creating planned empty native Pages; only the current Page receives business content. Source-reviewed screen/route identity comes from [requirement alignment](../requirement-alignment.md#inventory-before-routes), while directory/node names and overview naming follow [naming](../design/naming.md). Prepare detailed Slot intent only for that Page after reading its Pen evidence and live contracts. Use the requested native device scope; shorter Preview tests do not create new design columns.

Each Page must pass these distinct checks before sibling business content:

1. Generate native structure with real states/events and query/Form/row-action effects. Mock data still requires observable frontend behavior; source-required APIs that are not connected remain explicit limitations.
2. Save and run `verify_all.py --page /exact-route` with the reviewed suite; fix applicable failures.
3. Capture and **open** current pixels through [rendered inspection](../desktop-inspection.md). Compare source hierarchy, copy, data, spacing and relevant hidden states.
4. Exercise pinned native Preview cases and capture required state images, then record visual comparisons and complete the Page through the controlled task. Only its explicitly deferred cross-Page cases may wait for a destination.

Failed or unavailable checks remain pending. Recover mode/context through [structured recovery](../desktop-context.md); Preview failure cannot be replaced by reference tools or saved-state edits.

## Final acceptance

Save explicitly; use open_design with the same projectId and reopen:true for a fresh session, then repeat the affected model/image/runtime checks. For controlled full generation, follow [task completion](../prototype-tasks.md#recovery-and-completion): full verifier, finish and sequence audit are mandatory. Focused edits report only their inspected scope and do not claim a full-project pass. Report source/resource versions, actual reuse, mock/API boundaries, evidence and pending checks; static checks do not prove visual fidelity or source interpretation.
