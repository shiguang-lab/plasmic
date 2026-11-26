# Template Center reference workflow

Before drafting detailed component plans or writing to a design canvas, check published Template Center templates through Desktop MCP `list_templates`. It returns each published template's `templateId`, `name`, `description`, `kind`, `device`, `category`, `version` and `libraries` without navigating or saving the active editor. Desktop MCP enforces this check before `createComponent` or `insertHtml` (including inside `execute_batch`), and requires opening `pDf4kvKBxRRLAHnjbGRwGu` via `open_template` before creating Overseas admin Pages or inserting `plasmic-overseas-*` layout components.

For Overseas/Antd6 admin Pages and regions, use the published Template Center canvas **海外 O 端** (`templateId`: `pDf4kvKBxRRLAHnjbGRwGu`). For other libraries, devices or non-admin tasks, match candidates from `list_templates` by business scenario, `kind`, `device` and `libraries`. Page types, ASCII skeletons (`references/design/page-types.md`) and library indexes are starting structural guides; they never replace checking `list_templates` and inspecting matching live Template Center artboards.

## Read and compose through public tools

1. Discover candidates first with `list_templates({query?, kind?, device?, category?})`. Do this before planning component details, and preferably after resolving the destination project identity but before opening or mutating it (to avoid unnecessary mid-task project switches and autosaves). If an editable project is already open, retain its `projectId`, branch, Page and editor view using `get_app_state` and `get_editor_view`; opening another canvas saves the current editable project, so respect the task's save scope.
2. When a published template matches (or is mandatory for Overseas/Antd6 admin design), call Desktop MCP `open_template({"templateId": "..."})`. Record its actual `version`. An unavailable publication or failed read leaves the reference unverified.
3. Collect the Page descriptions once for the current publication using `verify_templates.py` below. Read each Page's name and `pageMeta.description`. Match the business task, the region that owns the controls or data, and relevant interactions.
4. For a clear match, capture only the chosen Page and view the image for layout reference. For an unresolved choice, identify the distinguishing question and capture just the candidates that can answer it. Compare their models and images; reuse the selected image from that comparison. A clearly unrelated description can be ruled out immediately. If all relevant descriptions rule out the required behavior, return directly with zero screenshots. Missing or vague descriptions leave a plausible candidate unresolved and warrant focused inspection.
5. Open or return to the destination business project with `open_design`, restore its Page and view when resuming an existing canvas, and confirm `projectId`, branch and `canEdit`. Discover the registered components for the required roles, read their Props, Slots and events, and compose on that canvas.

## Select by scenario

Choose a whole Page or a relevant region. In a partial match, adapt the useful regions and design the rest with the destination library. Keep business data, state, events and routes grounded in the current requirement.

When maintaining a template, use its Page settings description as a short, self-contained entry. State what the operator is trying to accomplish, how the regions relate, and the interaction or scope that distinguishes it from its nearest alternatives. Mention concrete fields only when they explain the pattern. Describe the visible structure accurately and distinguish illustrative controls from working behavior. Keep these descriptions in the template publication so new Pages are discoverable without a skill update.

## Source evidence before composition

Collect the text inventory on the read-only published canvas. This command pages through metadata and records its publication version with zero screenshots:

```sh
python3 RESOURCE_ROOT/scripts/verify_templates.py --profile DESKTOP_PROFILE \
  --source-project-id TEMPLATE_ID --output /absolute/task/page-descriptions.json
```

For Overseas/Antd6 admin Pages and regions, `TEMPLATE_ID` is `pDf4kvKBxRRLAHnjbGRwGu`.

Only when a visual reference or comparison is needed, run the same command with `--names` and a new output path. Pass one selected Page name or just the names still in contention. Each specified Page is read in full, navigated to by its UUID and captured using its returned `frameUuid` with `liveCanvas:true`. Read the relevant nested definitions when needed. Reuse captures from the same publication within the task.

Record the selected Page name, `sourceProjectId`, `mode:"reference"`, adaptation, capture path and SHA-256 in `templates`. For an unmatched Overseas region, keep the closest reviewed names and their specific gaps as `[{componentName, missing}]` in `templatesNotApplicable`; for non-Overseas or non-admin Pages without a matching Template Center template, record either the reviewed candidate list `[{componentName, missing}]` or a nonempty mismatch reason string noting the `list_templates` check in `templatesNotApplicable` with `templates:[]`. A failed publication read leaves the decision unresolved.

## Acceptance

Check saved Page and Slot ownership, destination bindings, navigation and overlay defaults. Exercise required interactions in the consuming project's Preview and reread after saving. Source screenshots document a design choice; acceptance uses the resulting business Page.
