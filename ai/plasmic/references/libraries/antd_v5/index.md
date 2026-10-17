# Ant Design v5 reference index

Library: @plasmicpkgs/antd5 registrations (plasmic-antd5-*). The maintained package declares antd ^5.12.7; that dependency range is distinct from its npm version and any Studio published-library version. Read [library selection](../index.md), identify the actual imported library/native version and verify live Props/Slots/events before using this reference.

## Components

One document owns each main component, including registered children, groups and variants. Table and several controls expose a narrower wrapper contract than the full native Ant Design API. Registration identities and the final Studio display names below are actual facts, including Table (deprecated).

Look up used registration keys in the [component catalog](catalog.md); read only their matching component documents. The catalog is a lookup table, not an additional mandatory full read.

## Design and verification

Use [shared layout](../../design/layout.md), [keyboard/focus rules](../../design/accessibility.md) and the target library’s actual theme/style controls. Size spellings, wrapper defaults, field/value conversion and overlay lifecycle come from the used registration. Query Forms, table selection and overlays are composed from those real contracts and the requirement; these references do not presume v6-only layouts, Slot controls or a business shell.

The existing resource-root Form, Descriptions and overlay identity scanners target the v6 scope. Verify v5 model ownership, values, bindings and real Preview behavior directly; do not mark those v6 gates passed for this library. Source coverage validation checks registration-to-document ownership independently of runtime acceptance. Save/reopen and reread affected components after edits.
