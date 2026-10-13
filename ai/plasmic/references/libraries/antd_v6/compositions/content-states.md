# Content-state composition

Applies to the actual [Ant Design v6](../index.md) components and global context. A state belongs to the affected page/region or operation; do not add a separate demonstration state board to the deliverable. Preserve the user's selected library and verify available Props/Slots before binding.

| Actual condition | Composition and behavior |
| --- | --- |
| First load, known content structure | [Skeleton](../components/skeleton.md) matching that region, removed when data resolves |
| Busy operation or refresh over usable content | [Spin](../components/spin.md) or the actual control's loading state; retain applicable content |
| Successfully loaded, no records | [Empty](../components/empty.md) with meaningful no-data text and only an authorized applicable action |
| Successfully loaded, filters match nothing | Empty with no-results text and a real reset/change-filter action where appropriate |
| Missing prerequisite selection | Explain the required selection in the dependent region; do not claim the request returned no data |
| Recoverable regional error | [Alert](../components/alert.md) or the region's supported error treatment, with one useful retry/recovery path |
| Page-level denied/not-found/substantial outcome | [Result](../components/result.md) with actual status and supported return/recovery actions |
| Routine transient operation outcome | Themed Message through [ConfigProvider](../components/config-provider.md); field errors remain in Form |
| Longer notification with relevant context | The actual ConfigProvider Notification global action and required lifetime/placement |

## Ownership and transitions

Loading display is not authorization, a submit lock or proof of completion. Bind states to the actual operation and settle them on its verified outcome. An old response must not replace the current filter/entity/selection. Keep failed-refresh content when it remains applicable, distinguish no permission from empty data, and do not show success before the actual save completes. Recovery retries the intended operation without repeating a successful write.

Keep the surface and scroll owner stable through state changes. Avoid extra Card shells around every feedback component, a tall artificial empty region or layout shifts that hide the toolbar. One operation produces its required feedback once; do not duplicate provider feedback and a second page toast for the same result. Shared [layout](../../../design/layout.md) and [accessibility](../../../design/accessibility.md) apply independently.

## Acceptance

Exercise only real branches: first load, refresh, matching/no-match data, failure, recovery, permission and prerequisite changes, and submitted/failed/successful operation as applicable. Verify the chosen component, readable text, permitted action, retained content and actual callbacks in Preview. Confirm both settled state and saved bindings; a spinner, success screenshot or empty placeholder does not establish the underlying result.
