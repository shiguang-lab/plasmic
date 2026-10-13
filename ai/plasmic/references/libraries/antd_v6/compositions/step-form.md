# Steps + Form composition

Applies to the actual [Ant Design v6](../index.md) [Steps](../components/steps.md), [Form](../components/form.md) and [Button](../components/button.md) contracts. Use stages only when the requirement contains a real staged workflow; a short ordinary form does not need an invented wizard.

## Stage and field ownership

Record ordered stages, actual fields, conditions and allowed transitions before composing. One verified owner controls the current stage and the business values; visual Steps onChange does not authorize advancement. Use the supported Form structure and native hidden/preserve/dependency contract for fields. A stage's omitted/inapplicable fields and a merely hidden valid field follow different payload/validation policies.

Advancing validates the fields required for that transition through the actual registered actions; use an exposed field-validation capability or validate the appropriate actual Form. Do not invent arguments for a registered validateFields action that declares none. Returning preserves entered values under the workflow policy. The final save validates the complete effective payload, runs one submission path and stays recoverable on failure.

## Actions and layout

Place actual Back/Next/Submit actions in the workflow order, with one current primary action. Preserve permission, pending and safe-close rules. Stage change reveals its real content and appropriate focus; temporary editor reveal never changes persisted current/initial values. Apply [Form layout](form-layout.md) and [shared layout](../../../design/layout.md) rather than absolute-positioning panels to a fixed screenshot height.

## Acceptance

Test first stage, valid/invalid Next, permitted Back/jump, conditional branches, hidden errors, retained values, final failure/correction/retry and reopening another record. Verify actual payload, disabled transitions, focus and complete reachable actions. Save/reopen and check initial stage separately from temporary editing state.
