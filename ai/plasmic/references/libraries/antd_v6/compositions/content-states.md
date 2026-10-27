# Content-state composition

| Actual condition | Composition and behavior |
| --- | --- |
| First load, known content structure | [Skeleton](../components/skeleton.md) matching that region, removed when data resolves |
| Busy operation or refresh over usable content | [Spin](../components/spin.md) or the actual control's loading state; retain applicable content |
| Successfully loaded, no records | [Empty](../components/empty.md) with meaningful no-data text and only an authorized applicable action |
| Successfully loaded, filters match nothing | Empty with no-results text and a real reset/change-filter action where appropriate |
| Missing prerequisite selection | Explain the required selection in the dependent region; do not claim the request returned no data |
| Ordinary query, pagination, refresh or submission failure | One Message/toast from the existing feedback owner; settle loading, retain applicable data/input and restore existing controls. Do not add an error row, retry button, Alert, Result or error placeholder, or replace Table empty text with a load-failure message |
| Requirement-defined business result, such as invalid detail parameters, missing entity or a state that prevents viewing | [Result](../components/result.md) or [Alert](../components/alert.md) only as required by the design, with verified business meaning and applicable actions; a rejected request alone does not establish this result |
| Routine transient operation outcome | Themed Message through [ConfigProvider](../components/config-provider.md); field errors remain in Form |
| Longer notification with relevant context | The actual ConfigProvider Notification global action and required lifetime/placement |

## Generation rules

Applies to the actual [Ant Design v6](../index.md) components and global context. A state belongs to the affected page/region or operation; do not add a separate demonstration state board to the deliverable. Preserve the user's selected library and verify available Props/Slots before binding.

Dedicated failure UI or recovery controls require an explicit current requirement/design; the availability of an error component or an existing retry pattern is not sufficient. Keep failed requests distinct from successful empty results internally without giving every request state its own UI. An initial request failure leaves the existing container's default no-data presentation; do not claim that the query succeeded with no records. Native code generation follows [feedback ownership](../../../codegen/interactions.md#反馈职责).

### Ownership and transitions

Loading display is not authorization, a submit lock or proof of completion. Bind states to the actual operation and settle them on its verified outcome. An old response must not replace the current filter/entity/selection. Keep failed-refresh content when it remains applicable, distinguish no permission from empty data, and do not show success before the actual save completes. Recovery retries the intended operation without repeating a successful write.

Keep the surface and scroll owner stable through state changes. Avoid extra Card shells around every feedback component, a tall artificial empty region or layout shifts that hide the toolbar. One operation produces its required feedback once; do not duplicate provider feedback and a second page toast for the same result. Shared [layout](../../../design/layout.md) and [accessibility](../../../design/accessibility.md) apply independently.

## Acceptance checks

### Acceptance

Exercise only real branches: first load, refresh, matching/no-match data, failure, recovery, permission and prerequisite changes, and submitted/failed/successful operation as applicable. Verify the chosen component, readable text, permitted action, retained content and actual callbacks in Preview. Confirm both settled state and saved bindings; a spinner, success screenshot or empty placeholder does not establish the underlying result.
