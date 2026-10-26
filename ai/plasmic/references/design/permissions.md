# Permission generation and acceptance

Use this reference when the source restricts roles, records, markets or Apps. Keep decisions in the existing component `purpose`/`source`, native `bindings`, `actionContracts` and cases; do not add a permission schema, management page or in-page role simulator.

## Source decisions before implementation

Read the actual role/action matrix and data-scope rules together. For each action, determine all permitted roles, required record state/history and authorized scope independently. A role's position in a list has no permission meaning. Never apply administrator-allowed/operator-denied to every action or use the last **allowed** role as a denied fixture. Viewing, editing and exporting can have different allowed sets. An administrator role does not imply access to every market unless the source says so.

Use existing action cases to record these decisions, with exact source evidence. Cover each distinct role outcome, then vary record state and scope independently; do not multiply every role by every state when they exercise the same branch. Keep valid state/scope fixed for a role-denial case, and keep an allowed role/state fixed for a scope-denial case. Otherwise a failed state check can conceal a missing permission check.

An action available to every declared role must have positive cases for those roles. Its `permission-denied` case can exercise a real source-defined unauthorized record/market boundary; it must not invent a forbidden role. When the reviewed sources define public access or no permission distinctions within this prototype's scope, record a nonempty `permissionDeniedNotApplicable` reason on that same action contract, supported by its existing `evidence` and reviewed scope. This exempts only `permission-denied`; positive cases, confirmation/cancellation, transitions and source-defined loading/failure cases remain required. Do not declare both the exemption and a denied case. An out-of-scope permission distinction does not establish public service access: preserve existing host authorization and report service authorization as unverified. If the source requires a restriction but leaves its meaning unresolved, resolve that specific gap before composing the affected branch. Source text/hash validation and case-kind coverage cannot determine whether the scope justifies the exemption or whether a role matrix was interpreted correctly.

## One executable context, display and submission

Before composing actions, establish the actual current-user context through the verified host/query/state contract: identity, role/permissions and authorized scopes required by the source. A display name, owner filter, selected market or `given.role` declaration is not that context. For local prototypes, a clearly identified external fixture may provide it; missing context must not silently become an administrator or grant all markets. Do not add fake context Props to AppShell or ActionGroup.

Derive the task's permission decision once from that context and the **current** target record. Reuse it for list/detail data access, native action items, direct-entry routes and corresponding mutations/export. Include all source-defined state/history restrictions; role checks do not replace them. Bind every consuming owner to the same context, including duplicated list Tabs and overlay submission. Record actual state dependencies in existing `bindings.propStateDependencies` where supported. Their presence is structural evidence, not proof of the guard's meaning.

At execution, resolve the target by identity from current data and reevaluate the decision. At confirmation/Form submission, read current context and record again before writing or starting an export. Do not rely on a visible button, a previously filtered item, an earlier successful check or a record captured when the dialog opened. Rejection leaves records/jobs unchanged and uses the registered feedback action. Native confirmation controls when an event fires; it does not supply business authorization. Use the verified implementation contract when sharing the predicate; do not invent a globally callable helper API.

### Executable fixture example

This isolated JavaScript example is **only** the source scenario used by `prepare_plan.py example`: administrator/operator/reader can view authorized-market records; only an administrator can disable an ACTIVE authorized-market record. It is not the policy or role naming for another requirement. Real Pages still require their current source, native components, interactions and service contracts.

```javascript
function allowed(viewer, action, record) {
  const roles = { view: ["administrator", "operator", "reader"], disable: ["administrator"] };
  return Boolean(viewer && typeof viewer.id === "string" && viewer.id.trim() && record && roles[action]?.includes(viewer.role)
    && Array.isArray(viewer.authorizedMarkets) && viewer.authorizedMarkets.includes(record.market)
    && (action !== "disable" || record.status === "ACTIVE"));
}

function commitDisable(state, id) {
  const record = state.records.find((item) => item.id === id);
  if (!allowed(state.viewer, "disable", record)) return false;
  record.status = "INACTIVE";
  return true;
}
```

Use `allowed(viewer,"view",record)` for this fixture's visible data and `allowed(viewer,"disable",record)` for its native action items; confirmation invokes `commitDisable` with the record ID, not a saved authorization boolean. The runnable plan format declares those context dependencies and source-derived cases. This example grants no implicit all-market privilege and does not treat client code as a production security boundary.

## Presentation without simulation controls

Keep permission demonstrations out of the business UI: do not add role-view switches, administrator/operator/read-only buttons or current-role debug badges. Use one current-user context and representative records to express source-defined record access through the relevant row actions, fields and mutation guards. Where permissions differ between records, show or omit each action accordingly rather than exposing a global simulator. Exercise other roles through test setup or supported direct-entry context outside the page; preserve authorization guards when removing simulation controls.

## Acceptance with real setup and effects

First review source versus cases, then saved code versus those decisions. Check the data selection, action expressions and every handler/submit branch, not only whether a component exists. A uniform denied-role pair across unrelated actions is a reason to reread the matrix. Keep this review with existing source and verification evidence, without another checklist file.

Exercise allowed non-administrator actions as well as administrator actions, read-only viewing and rejected changes. For market/record scope, compare an authorized and unauthorized target using the same otherwise allowed role/state. With real external setup, check that unauthorized records are excluded from lists and inaccessible by direct target ID; requesting “all markets” does not expand the authorization set.

Button visibility alone cannot verify submission. Test an invocation without relying on the button, a dialog whose role/scope was revoked before confirmation, a target whose state changed and a missing target. Assert the record/job effects (including unchanged data on rejection), not just an error Message. Use a supported external fixture or run the **saved handler code** in an isolated local test with faithful current context/ref/action dependencies. Test-only reconstructed logic cannot certify the delivered handler. Handler-only execution is separate from native Preview evidence; do not manufacture an `assertLine` for it. If unsupported, retain code findings and mark the corresponding runtime check unverified.

`given` describes setup; it neither switches identities nor executes actions. Retain actual setup/observations alongside the existing case trace, reset fixtures between scenarios and verify that the selected identity/scope really changed. Native Preview assertions use current roles/names and the existing `text`/`visible`/`count`/`value` contracts. Permission cases inherit their action's source evidence; cases need distinct IDs, not duplicated evidence blobs. Use [business outcome cases](component-policy.md#business-outcome-cases) and the [runtime manifest](component-policy.md#native-runtime-evidence) without inventing new assertion operators.

Perform live cases in the existing final Preview round, after saved-model gates, collecting the round before repairs and retaining the shared ten-round limit. Report local UI/handler behavior separately from real service authorization: backend enforcement and authorization revocation require the actual service, and remain unverified when unavailable.
