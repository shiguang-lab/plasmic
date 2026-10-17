# Unified prototype verification

Use [verify_all.py](../scripts/verify_all.py) from the resolved `resourceRoot` for full-project checks against the supported Overseas/Antd-v6 contracts. It runs the six existing gates; it does not derive expected behavior from generated models, save, publish, switch projects or exercise Preview. Use focused individual gates for a local edit or mixed-library scope that does not fit these full-project checks.

## Reviewed suite configuration

Create a task-local `suite.json` from independently reviewed requirements. All file paths below resolve relative to that file. Keep the Page/field/menu inventories in their existing gate formats. Example:

```json
{
  "structure": {"inventory":"structure-expectation.json"},
  "forms": {"inventory":"form-inventory.json"},
  "descriptions": {"inventory":"description-inventory.json"},
  "overlays": {"inventory":"overlay-inventory.json"},
  "slots": {"pages":[{"path":"/records","intent":"records-intent.html"}]},
  "shell_height": {}
}
```

- `structure` checks all project routes and the static Overseas menu tree against [source expectations](requirement-alignment.md#structural-gate).
- `forms` inventories **every** Page, including `forms: []`, as described in [Form acceptance](libraries/antd_v6/components/form.md#project-inventory-and-acceptance).
- `descriptions` and `overlays` check their inventoried Pages using [Descriptions](libraries/antd_v6/components/descriptions.md) and [overlay policy](libraries/antd_v6/compositions/modal-drawer.md). An empty group/overlay list still checks that none exist on that Page.
- `slots` requires nonempty named component intent, rejects duplicate component and direct Slot names, and checks the supplied intent HTML for each selected Page; report coverage is that explicit list. Nonblank text is valid Card content; whitespace alone is empty. Do not generate intent HTML by copying the actual readback just to pass.
- `shell_height: {}` checks **every routed Page** and its targeted snapshot. Use this only for a project of standalone supported shells. Ready/truncated flags must be literal booleans; viewport height and measured shell coordinates/heights must be finite numbers with positive heights. It does not establish Preview scrolling or persistence.

Forms accept Page `path`, unique `name`, or `componentUuid`. The suite also resolves those selectors for descriptions, overlays and slots. Multiple selectors must agree; no fuzzy name matching, route normalization or silent UUID fallback is performed. Reusable inventories should omit environment-specific UUIDs.

Declare an inapplicable gate as `{"notApplicable":"Reviewed reason and scope"}`. Omitted gates are `unverified` and make the run incomplete. Do not exempt a failing or dynamic menu merely to get a green report: dynamic role/state navigation still requires separate exercised evidence. For the supported recursive role-query transform, declare `navigation.roleQuery` with the reviewed `state`, `query` and `default` names/value alongside the independent literal `items`. The structure gate proves the entire recognized transform against that inventory without executing JavaScript; changed targets, labels, hidden/disabled flags, item type, icon, order, recursion, encoding or fallback precedence fail. Static menus retain the same registered fields; unsupported properties and unresolved bindings fail instead of being projected away. This transform requires literal hrefs without an existing query or fragment. Operator boundaries and line-terminator semantics remain significant; normalization must not turn invalid or changed JavaScript into the reviewed program. Unknown transforms still fail and require an explicit checker extension plus tests. A valid exemption records genuine scope/library inapplicability, not successful acceptance.

## Collect and verify

Open the intended project in the signed-in Desktop first. `--profile` is its **user-data directory**, containing `mcp-connection.json`, not the suite configuration or a named preset. Live collection uses the same authenticated local RPC as Desktop MCP on macOS/Linux. Keep the connection file private; the runner does not copy its token into evidence.

```sh
python3 RESOURCE_ROOT/scripts/verify_all.py \
  --project-id PROJECT_ID \
  --profile "/absolute/path/to/Desktop user-data" \
  --expectations /absolute/path/to/suite.json \
  --output /absolute/path/to/new-verification-run
```

The runner identifies the session, reads overview and full Pages in batches of at most 30, and calls `snapshot_layout({componentUuid})` for every Page without navigating. It records project/branch/session/revision/changeCounter before and after collection; differing or missing evidence cannot pass. Do not edit the design while collecting. It inspects current editor models; a revision number alone does not prove those models were saved. Explicit save/reopen acceptance stays separate.

The new output directory contains `overview.json`, `pages.json`, `layouts.json`, `capture.json`, `report.json` and `report.md`. Page snapshot errors remain visible in `layouts.json` and fail the affected height check. A collection error produces a failed report, retaining any evidence already collected. Existing output directories are refused to preserve prior runs. Reports record exact checker, inventory and intent hashes in `checkedInputs`. Inventories and intents are parsed from those same loaded bytes; changes to checked files during the run fail evidence integrity. Raw evidence remains reusable across rule changes only by rerunning every gate.

## Reuse within the same live design state

When another gate or a corrected expectation needs the same complete capture, pass `--reuse-evidence /absolute/path/to/previous-run` together with `--profile`. The runner checks live project, branch, editor session, revision, changeCounter, Desktop version/build fingerprints, complete models/layouts and file hashes. Renderer and Desktop SHA-256 fingerprints are required; a source fingerprint, when present, must also be valid. Missing build identity, a mismatch or damaged/incomplete capture causes fresh collection. Copies are pinned to the validated manifest hashes. A change during reuse, or a Desktop version/build/project change during either fresh or reused collection, fails the run. Only overview and complete Page models are reused; layout snapshots are always refreshed because runtime rendering can change without a model revision. Every configured gate runs again; previous pass/fail results are never cached.

Do not reuse the pre-save capture for post-reopen acceptance: run `--profile` without `--reuse-evidence` after save/reopen. Preview interactions, pixels and scroll checks remain mandatory and separate. Capture again after edits; use an idle editor during collection. An unchanged revision alone is insufficient because there may be unsaved edits.

Keep full evidence and reports on disk. The command prints gate statuses, report path and excluded checks; inspect each failed gate's full report and the relevant Page/subtree when fixing it. Do not print entire `pages.json` or `layouts.json` into the conversation for each gate. Reuse these exact files across the six checks, including the checks linked from component documents. Missing checks, unresolved scope and failed runtime tests remain unverified/failed, never omitted to save context.

## Replay and interpretation

Replay the same captured evidence without Desktop, including on Windows:

```sh
python3 RESOURCE_ROOT/scripts/verify_all.py \
  --project-id PROJECT_ID \
  --evidence /absolute/path/to/previous-verification-run \
  --expectations /absolute/path/to/suite.json \
  --output /absolute/path/to/new-replay-report
```

Exit 0 means all configured automated gates passed or have explicit applicability reasons. Exit 1 means failure or incomplete configuration/evidence. Reports distinguish `passed`, `failed`, `not_applicable` and `unverified`, preserve individual gate details and always list excluded acceptance dimensions. Both replay and live reuse require complete version/build/session metadata, a parseable collection timestamp with timezone and hashes for all three evidence files. The overview Project id must match the requested project. The manifest is pinned before reading; model checks use the exact loaded bytes, and their hashes must still match the manifest and disk files. Full Page readbacks include markup, props, states, variants, variant groups and interactions; missing fields fail even when the remaining files have valid hashes. A replay proves only the captured state. Review source interpretation, actual Preview interactions/scrolling and saved/reopened models before claiming full acceptance.
