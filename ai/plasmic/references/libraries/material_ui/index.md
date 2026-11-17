# Material UI reference index

Scope: `@shiguang-lab/plasmic-material-ui`, registrations `plasmic-material-ui-*`. The maintained wrapper pins `@mui/material` 9.5.0; verify the target project's imported library, published version and live contracts through MCP. Wrapper, native package and Studio published versions are separate facts. Read [library selection](../index.md) first.

## Read only the selected usage

Use the [catalog](catalog.md) to find a registration's short usage group. [rules.json](rules.json) routes actual registrations to these documents for compose/accept reading; it adds no mandatory property decisions or admin compositions. Props, Slots, defaults, supported values and events come from the live registration, not a copied API manual. The library includes Material UI Core, NativeOption and a Theme global context; it does not include MUI X Data Grid/date pickers, Lab or the separate Material Icons package.

This scope supplies component usage guidance, not a PC or mobile page-design standard. Choose page purpose and target devices from the requirement. Do not apply Antd/Overseas admin templates, size/density defaults, Form ownership or structural gates to MUI. On mixed-library pages, read each component's own scope; an Antd participant does not turn a MUI region into an Antd composition. Shared source, naming, accessibility, layout, interaction and persistence checks still apply.

## Registration conventions

React node/element props are editable Plasmic Slots. MUI's native `slots` instead contains component types; it is an expression, as are native refs, callback renderers, anchorEl and container. `slotProps`, classes and responsive sx use their native object contracts. Single-element Slots must receive one compatible element.

Writable state helpers extract values from original MUI event signatures. Initial controls with editOnly/uncontrolledProp map to native defaults; do not add duplicate controlled values or assume the event callback receives only the extracted value. Tabs/BottomNavigation and overlays have wrapper state conveniences described in their usage groups. Canvas-only reveals remain separate from saved business state.

Use the installed [Material UI Theme](components/theme.md) global context and the selected component's real style API. No Antd token or theme migration is implied.

## Focused verification

Read the selected usage documents' Acceptance checks, exercise actual Preview events and required viewport behavior, then save/reopen and reread. Existing rule cards verify reference delivery; Antd-only Form/Descriptions/Modal/Table gates do not certify MUI semantics. Use applicable shared model, binding and rendering checks with explicit coverage limits under [verification](../../verification.md). Mixed-library theme/rendering behavior must be checked in Preview; documentation isolation is not a runtime CSS guarantee.
