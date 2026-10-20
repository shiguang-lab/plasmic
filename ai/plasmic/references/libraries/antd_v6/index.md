# Ant Design v6 reference index

Scope: @shiguang-lab/plasmic-antd6 registrations (plasmic-antd6-*), using native Ant Design 6. The current maintained implementation declares antd 6.6.5. This native dependency version is not a Studio published-library version. Read [library selection](../index.md) first and verify the target's live registration/version; this scope does not define v5 contracts.

Organize documents by the [Ant Design component catalog](https://ant.design/components/overview/): one file per main component. Items, groups, columns and picker variants are sections in their owner; separate Studio registrations do not require separate files. Titles use the public Antd component name, while the registration table preserves the actual Studio names and keys.

Use this library's theme tokens for color, typography, borders and radius. Read size options per component: most registered controls use medium, List uses default and Table defaults to large. Do not import another component/major's size spelling or defaults. Project composition spacing defaults are blocks 16px, inline actions 8px and Drawer footer actions 12px; explicit approved designs take precedence.

Look up used registration keys in the [component catalog](catalog.md); read only their matching component documents. The catalog is a lookup table, not an additional mandatory full read.

## Compositions and dependent libraries

Read only the actual arrangement: [Form layout](compositions/form-layout.md), [Descriptions + Statistic + Card](compositions/summary-metrics.md), [Modal + Drawer](compositions/modal-drawer.md), [action bars](compositions/action-bars.md) or, only for an explicitly requested heading area, [detail header](compositions/detail-header.md). Recipes declare cross-library participants. Overseas SearchForm and React UI ActionGroup are separate registrations; use their own indexes rather than treating them as Antd components.

For the affected workflow, read [content states](compositions/content-states.md), [Steps + Form](compositions/step-form.md), [Table bulk actions](compositions/bulk-actions.md) or [master-detail](compositions/master-detail.md). Sizing, spacing ownership, responsive scope and keyboard/focus principles remain in [shared layout](../../design/layout.md) and [accessibility](../../design/accessibility.md); component documents own actual registered layout APIs.

## Structural gates

The resource-root scripts verify_forms.py, verify_descriptions.py and verify_overlays.py recognize this Antd-v6 wrapper's identities/props; use only with this scope and their independently reviewed inventories. verify_slots.py and verify_structure.py additionally check task-supplied ownership/structure; their specific Card rules target this scope. Run them as described in the selected reference, then separately check real Preview behavior. An absent reference for another library is not a passed gate.
