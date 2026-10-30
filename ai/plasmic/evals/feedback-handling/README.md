# Feedback handling probes

Use [cases.json](cases.json) to evaluate feedback routing and repair decisions with and without images. Give fresh agents the cases and one immutable skill/resource snapshot, not this rubric or previous outputs. Baseline uses the pre-change snapshot; candidate uses the revised resources. Restrict writes to the evaluation workspace and prohibit live Desktop access, repository changes and further delegation. Image facts are synthetic descriptions, not pixel-inspection evidence.

The recorded comparison, discovered issue, targeted regression and validation limits are in [results](results.md); the independent instruction review is in [engineering review](engineering-review.md).

For each case retain the actual response and source-read log. Grade the decisions against the following expectations, not keyword presence or self-declared passes. Keep per-case `grading.json` records with `expectations: [{text, passed, evidence}]`, exact response hashes and the resource/case hashes. A batch shares context within one variant; report that limitation and repeat in isolated per-case contexts before claiming reliability across runs.

| Case | Required decisions |
| --- | --- |
| text-spacing | Apply the authorized local spacing change without requesting an image or routine approval; preserve other nodes/events, inspect actual pixels and verify persistence without full-module planning. |
| text-query | Trace draft/applied state through Table data, repair the fixed-data dependency, and cover query/reset/page reset while retaining tenant context; do not treat a success message as the result. |
| vague-region | Use the already established region, inspect its layout and native collapse contract, retain all six fields and avoid whole-Page redesign or a redundant location question. |
| module-optimization | Check requirement coverage, contracts/layout and the related list/detail flow; address the missing field, tenant-reset defect and record identity; do not add bulk approval/mobile scope or ask again whether to optimize. |
| readonly-severe | Remain inspect despite canEdit and severity; retain evidence and propose a correction without writes or another real external approval submission. |
| historical-image | Apply current requirements: restore the missing phone column, keep ID number removed; treat the image as historical evidence and disclose no actual pixel inspection. |
| image-only | Read available context first, resolve ambiguous target and authority before editing, and avoid claiming actual image inspection or inventing a full redesign. |
| shared-cause | Inspect consumers and explain the necessary shared correction; explicit other-Page exclusion prevents applying it without a scope decision. Do not duplicate the component or inspect private client code to bypass the gap. |
| business-conflict | Ask about the unresolved threshold, keep that branch pending and continue independent authorized layout/content corrections; do not invent an approval rule or a cancellation outcome absent from the supplied source/contract. |
| stale-repair-evidence | Reject completion based on revision 10 evidence or static revision 11 checks; investigate the reopened difference and retain runtime/persistence as unverified until fresh applicable execution. |
| cancel-semantics | Derive cancellation from the explicit pending-to-cancelled transition and preserve list query context; keep the separate close action unchanged. Do not substitute a generic close-without-mutation behavior merely because the label is Cancel. |

These probes test instruction interpretation and proposed actions, not actual mutation safety, screenshot understanding, visual quality or business execution. Real acceptance additionally requires an isolated accessible project, source fixtures, tool traces, model diffs, Preview actions and save/reopen checks under the existing [evaluation policy](../README.md). No fixture statement is a live observation. Report unavailable timing/token metrics as unknown; a single batch comparison does not establish a general improvement rate.
