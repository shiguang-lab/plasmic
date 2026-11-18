# Overseas O-end template reference

Use the published Template Center canvas **海外 O 端** for structural design of Overseas/Antd6 admin Pages and regions. Its fixed templateId is `pDf4kvKBxRRLAHnjbGRwGu`. Page names, routes, counts, UUIDs and descriptions come from the publication opened for this task. Other libraries follow their own references. Local copy or styling repairs use the affected rules.

## Read and compose through public tools

1. Retain the destination project, branch, Page and editor view using `get_app_state` and `get_editor_view`. Opening another canvas saves the current editable project; respect the task's save scope.
2. Call Desktop MCP `open_template({"templateId":"pDf4kvKBxRRLAHnjbGRwGu"})`. Record its actual version. An unavailable publication or failed read leaves the reference unverified.
3. Collect the descriptions once for the current publication using the command below. Read each Page's name and `pageMeta.description`. Match the business task, the region that owns the controls or data, and relevant interactions.
4. For a clear match, capture only the chosen Page and view the image for layout reference. For an unresolved choice, identify the distinguishing question and capture just the candidates that can answer it. Compare their models and images; reuse the selected image from that comparison. A clearly unrelated description can be ruled out immediately. If all relevant descriptions rule out the required behavior, return directly with zero screenshots. Missing or vague descriptions leave a plausible candidate unresolved and warrant focused inspection.
5. Return with `open_design` to the recorded business project, restore its Page and view, and confirm project, branch and edit permission. Discover the registered components for the required roles, read their Props, Slots and events, and compose on that canvas.

## Select by scenario

Choose a whole Page or a relevant region. In a partial match, adapt the useful regions and design the rest with the destination library. Keep business data, state, events and routes grounded in the current requirement.

When maintaining a template, use its Page settings description as a short, self-contained entry. State what the operator is trying to accomplish, how the regions relate, and the interaction or scope that distinguishes it from its nearest alternatives. Mention concrete fields only when they explain the pattern. Describe the visible structure accurately and distinguish illustrative controls from working behavior. Keep these descriptions in the template publication so new Pages are discoverable without a skill update.

## Source evidence before composition

Collect the text inventory on the read-only published canvas. This command pages through metadata and records its publication version with zero screenshots.

```sh
python3 RESOURCE_ROOT/scripts/verify_templates.py --profile DESKTOP_PROFILE \
  --source-project-id pDf4kvKBxRRLAHnjbGRwGu --output /absolute/task/page-descriptions.json
```

Only when a visual reference or comparison is needed, run the same command with `--names` and a new output path. Pass one selected Page name or just the names still in contention. Each specified Page is read in full, navigated to by its UUID and captured using its returned `frameUuid` with `liveCanvas:true`. Read the relevant nested definitions when needed. Reuse captures from the same publication within the task.

Record the selected Page name, fixed source project ID, `mode:"reference"`, adaptation, capture path and SHA-256 in `templates`. For an unmatched region, keep the closest reviewed names and their specific gaps in `templatesNotApplicable`; the text inventory is sufficient for a description-based exclusion. Set `templates:[]` when the whole Page lacks a reference. A failed publication read leaves the decision unresolved.

## Acceptance

Check saved Page and Slot ownership, destination bindings, navigation and overlay defaults. Exercise required interactions in the consuming project's Preview and reread after saving. Source screenshots document a design choice; acceptance uses the resulting business Page.
