# Component registration and runtime verification

Read only when changing a component wrapper, registration or editor runtime. Ordinary design tasks verify affected Preview behavior through the relevant region/component reference. Use the [library index](../libraries/index.md) to select matching library/API and component rules; this file owns shared engineering verification.

## Defaults and values

Use the actual installed component library/version’s defaults. Keep registration hints and runtime defaults consistent; a hint is not an injected value. Business conventions belong in explicit page props rather than wrapper defaults. Preserve explicit false, zero, empty string and null according to each native prop’s contract.

## Native classes and events

Where the component exposes native semantic classNames, merge them (including supported function forms and nested popup classes) with Studio scope/reset classes; neither may overwrite the other. Preserve independent root, input, popup, body/container and panel classes. Avoid leaking editor-only styling props into native DOM attributes. Test portal overlays and controls with both class sources present.

Function events and render-slot Props expose native `args` names and types. Use the returned submit argument and lexical row variables; do not invent a data context for them.

MCP prop registration reports the original declared type/signature and nested fields even when Studio stores an any type. Preserve the distinction between returning functions and event handlers. Export declarative metadata only; never invoke options, argValues, hidden callbacks or custom controls to discover a contract. An undeclared nested shape remains unknown.

Identical descriptions/signatures and normalized choice lists appear once on the prop, rather than being repeated in registration. Verification failures report constrained property paths, not unrelated row datasets.

## Slots and editor state

Empty code-component Slots retain the component’s native default; an explicit null expression remains an override. Check native default content, explicit null and custom Slot content on editor canvas and Preview. Keep temporary selection/reveal separate from persisted business props; follow each component’s actual Slot and visibility contract.

## Verification

When changing a wrapper, test omitted props, explicit overrides and controlled/uncontrolled use against the same installed component library/version. Exercise validation failure, rejected/thrown save, retry, duplicate submission, disabled controls, selection, clearing and event timing where relevant. Run the package's behavior tests and registration/build checks. For affected prototype flows, exercise live App interactions and record screenshots plus observations; screenshots do not prove callback order, validation blocking or state recovery. For shell/editor sizing changes, verify create → content edit → save/reopen → further content edit: shell viewport fill and scrolling must survive each transition. Keep component examples and capability-test pages out of the deliverable.
