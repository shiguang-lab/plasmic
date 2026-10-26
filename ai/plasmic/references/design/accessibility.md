# Keyboard, focus and readable content

Apply these rules to the actual selected components and task scope. Native component semantics and the target project's accessibility conventions define implementation; inspect registered Props/Slots before adding an accessible-name or interaction binding. Business language stays configured, while registration identities and event names remain unchanged.

## Controls and names

Editable controls have their real labels and native value/checked bindings. Placeholder text does not replace a label. An icon-only action has an accessible action name and a discoverable explanation when required; decorative icons do not repeat the label. Links navigate through the real route/href contract, buttons perform actions, and disabled controls cannot execute them. Do not build click-only divs to imitate available native controls.

## Keyboard and focus

Preserve logical reading and Tab order in the model; visual order must not create an unrelated focus sequence. Check keyboard activation, visible focus, menu/select navigation and dismissal using the installed component's behavior. Keep Enter submission on the same validation and duplicate-submit path as the visible submit action. Do not intercept all keys on a page or persist autofocus solely to reveal a control during editing.

Opening an overlay transfers focus according to its native contract, closing returns focus to the initiating control when it still exists, and background controls remain unavailable when the overlay is modal. After filtering, row removal, a hidden section or a step change, move focus only when the workflow requires it and the target exists. Validation can reveal the owning hidden region and locate the first invalid field; it must not silently remove entered values.

## Content and feedback

Use semantic text roles and the selected theme's readable contrast. Color alone must not encode status, selection, error or required input; retain business text or the native semantic indication. Required instructions remain visible and complete. Images convey their purpose through the supported alt contract; decorative images use the project's decorative-image convention. Loading/error feedback retains enough context to explain the affected region and available recovery action.

## Acceptance

Exercise the affected workflow with keyboard alone in real Preview: entry, editing, validation, submission, menus, overlays, cancellation and return. Drive it with native Preview `press` actions followed by assertions; where the requirement depends on keyboard behavior, plan those steps as runtime cases (for example kind `keyboard`) so their trace lines are verified. This document is on the project accept card, so its verdict records what was exercised. Verify accessible control names, focus visibility/order, complete text and status meaning in the delivered theme. Test long labels and supported zoom/reflow when required. A Tooltip, screenshot or model property alone does not prove a usable name or focus flow; reread after save/reopen and record any unavailable native capability.
