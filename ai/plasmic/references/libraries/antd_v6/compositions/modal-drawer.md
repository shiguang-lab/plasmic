# Modal + Drawer composition

Applies to [Ant Design v6](../index.md) registrations and theme behavior. Select the matching project library through the [library index](../../index.md) before using this recipe; another library or major requires its own verified composition rules.

Read before creating, editing or reviewing a Modal/Drawer, including result tables and read-only details. Use the actual registered component's Props, Slots, defaults and events. Read [Modal](../components/modal.md) only when using Modal; read [Form layout](form-layout.md) only when the overlay contains a business Form. Read [Actions](action-bars.md) for present action groups and [Layout](../../../design/layout.md) for bounded scrolling. A read-only detail Drawer does not require Form or Modal rules.

## Footer with only an exit button

When the native top-right close icon is enabled and usable, do not retain a footer whose sole visible button only dismisses the overlay. Remove that button and the now-unused footer; use the native close icon for dismissal. This applies to Cancel, Close, Done, Return and differently named buttons with the same actual effect. Judge the handler/state transition, not the label.

This rule does **not** remove Cancel/Close from a multi-button footer. Save + Cancel, Confirm + Cancel, and other required action groups may retain the exit button even with a header close icon. Keep native ownership through the [Modal footer contract](../components/modal.md#footer), with order and hierarchy from [Actions](action-bars.md). Do not hide native Cancel from a normal two-button Modal merely because X exists.

- Read-only results, details and help with no required business operation normally need no footer. Apply the component's actual removal contract ([Modal](../components/modal.md#footer) or Drawer footer Slot); do not leave an empty footer Slot, spacer or separator.
- A single button that downloads, submits, stops work or returns to a previous workflow step is a business action and can remain. “Return to SQL editing” is an exit-only action if it merely closes the current result overlay; it is a business action if it performs a required distinct transition. Record and verify that effect.
- Pagination, table row actions and body controls do not turn an exit-only footer into a multi-button footer. Count buttons in the actual footer only. Disabled buttons still occupy that footer; check each required runtime state when buttons are conditionally hidden.
- If no usable close icon exists, do not remove the only usable exit. Keep the supported dismissal path or enable the native icon where the requirement permits it. Do not add a custom header close icon.

## Structure and close behavior

Keep one native header/title and one footer owner. Bound long content using the shared scrolling contract; the close icon and any business footer stay reachable at the target viewport. No nested native scrolling, clipped last row or blank reserved footer after removal.

Bind dismissal to the actual controlled open state. Available X/Cancel/Esc/mask paths follow the same dirty-input, cleanup and processing policy; closing does not imply backend cancellation. Failure preserves recoverable input. Selection/reveal must not persist an open initial state. In Preview verify close/reopen, retained business actions, keyboard focus and return to the trigger; editing also checks dirty input and processing restrictions. Save/reopen and reread after edits.

## Generation gate

Derive an independent acceptance inventory from requirements before generation. For each affected owning component, inventory every Modal/Drawer in its full public `baseVariantTplTree`, including hidden branches. Read referenced custom components separately; private internals need their own readback. The inventory is verification evidence, not persisted design props.

Declare the exact component identity, expected usable `closeIcon`, footer mode (`none`, `native`, `custom`) and ordered visible `footerActions`. For a native Modal footer use `nativeCancel` and `nativeOk`; for a custom footer use actual Button node names. Each action declares `effect: "dismiss"` or `"business"`; a business action needs a concrete `reason`. Optional action `props` checks required handler/visibility values from the public readback. Review effects against actual interactions; do not derive them solely from labels or generated output.

Plan Pages by exact path (or unique name / known componentUuid) through [unified verification](../../../verification.md#reviewed-suite-configuration). Its runner resolves selectors from current readbacks. The standalone command below requires actual componentUuid values already resolved; do not fabricate UUIDs before creating Pages. Example of a resolved inventory for a read-only SQL result:

```json
{"pages":[{"componentUuid":"reviewed-owner-uuid","overlays":[{"name":"SQLPreview","component":"plasmic-antd6-modal","closeIcon":true,"footer":"none","footerActions":[]}]}]}
```

Run `python3 scripts/verify_overlays.py <inventory.json> <mcp-read.json>` using scripts from the resolved resource root, before delivery and again on saved/reopened readbacks. It rejects missing/extra overlays, mismatched footer/action inventories and a sole exit-only footer button with a usable close icon. A normal multi-button Confirm + Cancel footer must pass. Flat native Button object bindings with literal values or simple `$state`/`$ctx` property reads are inspected without execution. Quoted literal text cannot substitute for a read binding. Dynamic `disabled`/`loading` does not alter the visible action inventory; inventory action `props` can require its exact binding. Dynamic `hidden`/`style`, non-boolean hidden values, prototype keys, spreads, computed keys and unsupported expressions still fail. Conditional visibility that cannot be resolved statically fails with a request for state-specific evidence; do not execute expressions or assume dynamic configuration is hidden. For Antd6, explicit `closable: true` or an object preserves the native fallback icon even with top-level `closeIcon: false/null`; object `disabled` must be a literal boolean. Literal custom icons follow React rendering: numbers including `0` render, booleans/null/blank text do not. Nonempty custom `closeIcon` Slots cannot be classified as the native fallback; their unresolved rendered availability fails the gate. `hideFooter` must also be a literal boolean. Hidden inline CSS remains hidden with case/whitespace differences or `!important`. CSS variables, inherited/conditional visibility and other unresolved styles require rendered evidence; do not treat them as visible or exempt the gate. Nested overlay footers and trigger Slots belong to their own scope.

The gate cannot infer business meaning or execute handlers. Review the inventory and actual interaction readbacks, inspect opened overlays at the target viewport, and exercise dismissal/retained actions in each relevant state. Passing structure alone does not prove behavior or geometry.
