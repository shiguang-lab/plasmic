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
- `slots` checks the supplied intent HTML for each selected Page; report coverage is that explicit list. Do not generate intent HTML by copying the actual readback just to pass.
- `shell_height: {}` checks **every routed Page** and its targeted snapshot. Use this only for a project of standalone supported shells. It does not establish Preview scrolling or persistence.

Forms accept Page `path`, unique `name`, or `componentUuid`. The suite also resolves those selectors for descriptions, overlays and slots. Multiple selectors must agree; no fuzzy name matching, route normalization or silent UUID fallback is performed. Reusable inventories should omit environment-specific UUIDs.

Declare an inapplicable gate as `{"notApplicable":"Reviewed reason and scope"}`. Omitted gates are `unverified` and make the run incomplete. Do not exempt a failing or dynamic menu merely to get a green report: dynamic role/state navigation still requires separate exercised evidence. A valid exemption records genuine scope/library inapplicability, not successful acceptance.

## Collect and verify

Open the intended project in the signed-in Desktop first. `--profile` is its **user-data directory**, containing `mcp-connection.json`, not the suite configuration or a named preset. Live collection uses the same authenticated local RPC as Desktop MCP on macOS/Linux. Keep the connection file private; the runner does not copy its token into evidence.

```sh
python3 RESOURCE_ROOT/scripts/verify_all.py \
  --project-id PROJECT_ID \
  --profile "/absolute/path/to/Desktop user-data" \
  --expectations /absolute/path/to/suite.json \
  --output /absolute/path/to/new-verification-run
```

The runner identifies the session, reads overview and full Pages in batches of at most 30, and calls `snapshot_layout({componentUuid})` for every Page without navigating. It records project/branch/revision/changeCounter before and after collection; differing or missing evidence cannot pass. Do not edit the design while collecting. It inspects current editor models; a revision number alone does not prove those models were saved. Explicit save/reopen acceptance stays separate.

The new output directory contains `overview.json`, `pages.json`, `layouts.json`, `capture.json`, `report.json` and `report.md`. Page snapshot errors remain visible in `layouts.json` and fail the affected height check. A collection error produces a failed report, retaining any evidence already collected. Existing output directories are refused to preserve prior runs.

## Replay and interpretation

Replay the same captured evidence without Desktop, including on Windows:

```sh
python3 RESOURCE_ROOT/scripts/verify_all.py \
  --project-id PROJECT_ID \
  --evidence /absolute/path/to/previous-verification-run \
  --expectations /absolute/path/to/suite.json \
  --output /absolute/path/to/new-replay-report
```

Exit 0 means all configured automated gates passed or have explicit applicability reasons. Exit 1 means failure or incomplete configuration/evidence. Reports distinguish `passed`, `failed`, `not_applicable` and `unverified`, preserve individual gate details and always list excluded acceptance dimensions. A replay proves only the captured state. Review source interpretation, actual Preview interactions/scrolling and saved/reopened models before claiming full acceptance.
