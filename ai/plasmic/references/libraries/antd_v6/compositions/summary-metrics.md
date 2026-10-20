# Descriptions + Statistic + Card

Applies to [Ant Design v6](../index.md) registrations and theme behavior. Select the matching project library through the [library index](../../index.md) before using this recipe; another library or major requires its own verified composition rules.

Read [Typography Text](../components/typography.md#text) for supporting-text hierarchy, [Descriptions](../components/descriptions.md) for read-only fields and its inventory gate, [Statistic](../components/statistic.md) for numeric content, and [Badge](../components/badge.md) for status. This file owns region selection, metric arrangements and heading composition.

## Read-only and editable regions

Choose components from each region's information role before generating markup. A group of read-only label/value fields uses the installed Descriptions component, including summaries inside create/edit pages, Drawers and confirmations. Mixed regions compose Descriptions alongside Form/Form.Item for editable values; being on an edit page does not make the read-only summary ordinary text. Keep necessary user-facing help as text, entity names in the information group, and emphasized metrics in Statistic. A standalone entity header requires the explicit user request described in the [header recipe](detail-header.md). Requirement rationale and implementation commentary stay outside the UI.

Descriptions owns each read-only group’s title and fields. The outer Card/layout owns spacing between that group and an adjacent [Form](../components/form.md); inspect each region’s independent inventory and binding values. Keep narrative/help, entity headings and metrics in their intended roles rather than concatenating all information into one text block.

## Overview metrics and information cards

Before generation, record each field's source, role (label/value/unit/comparison/section heading), applicable types, empty-state meaning and action destination in the task plan. Choose the composition from these roles and the available content width; do not derive it from a previous generated screenshot. Business field names, mock values and page-specific card arrangements stay in the task workspace.

Choose a Card only when the source calls for a separate surface; a summary or read-only group can sit directly in its layout. Use registered Cards under [Card ownership](../components/card.md#card-ownership), with [Statistic](../components/statistic.md) for emphasized numbers, readable text for dates and [Badge](../components/badge.md)/Tag for applicable states. A metric label is secondary text, not a section heading. For a compact desktop metric row without a source-specific typography decision, use these **project defaults**, not purported universal Ant Design defaults:

| Role | Default font size / line height | Treatment |
| --- | --- | --- |
| Metric label | 14px / 22px | Regular, secondary color |
| State value | 20px / 32px | Regular, semantic indicator |
| Date/time value | 18px / 32px | Complete required precision |
| Emphasized number | 24px / 32px | Real Statistic content styling |
| Comparison/context | 12px / 20px | Secondary, readable full meaning |
| Information section heading | 16px / 24px | Weight 600, normal tracking |

Honor explicit design/theme choices instead. Check actual inherited styles and the installed prop/Slot contracts; never invent a prop to force this typography. Native editable text must not acquire incidental editor padding that shifts label/value starts. Keep intended inner spacing in one owner. Use the [plain Card body padding](../components/card.md#card-ownership), with label-to-value gap 8px and sibling gap 16px unless the source requires another density.

Build a label and a natural value region. A single-line composition with the defaults above derives its height from 22px label + 8px gap + 32px value + vertical body padding and actual borders; do not emit that sum as height/min-height. Equal height alone is not a quality target. Do not use arbitrary body min-height, empty spacers or unrelated card stacks to stretch sparse metrics. Align comparable labels and value regions, while retaining intentional differences between numeric, date and state typography.

Choose comparison placement before insertion. A short comparison may share the value row when the complete number, unit and comparison fit at the target width. Use [Tooltip](../components/tooltip.md) to expose baseline/direction/unit meaning while preserving required primary values in the visible UI. If content cannot fit, allow a natural extra line or choose fewer columns according to the source; reassess the density of the whole row. Never truncate required values or hide required business fields just to retain a compact height. Test the longest source-relevant value/label and comparison, including wrapping; a short mock value is insufficient.

Information cards grow with their own content. Top-align asymmetric columns; check both the parent grid and the component instance for stretching/height. Put actions in a genuine Card header's extra Slot or beside an inline summary heading/in natural content flow. A lone link must not expand and center across a sparse card. Keep summaries read-only when a separate view action is required. Preserve source-required repeated metrics while explaining each region's role, such as quick count/comparison versus snapshot time, mode or scope.

Derive all regions from consistent data/state. Do not invent comparisons without a baseline or success results for pending/failed operations. Distinguish an absent first snapshot from a retained historical snapshot during a later operation, using the requirement's actual semantics. Hide inapplicable type-specific fields without leaving an empty grid column.

**Acceptance gate:** compare each card with the independently source-derived checklist in editor and real preview at the requested viewport, then repeat after save/reopen. Record expected and measured label/value starts, label-to-value gap, body edge padding and each value region's bottom-to-Card-inner-bottom distance (exclude the border). Explain any space beyond intended padding from actual content/structure; matching card heights is not a pass. Inspect glyph spacing, prominence, wrapping, action placement and the complete region screenshot. A working Tooltip, valid model or successful save cannot pass this visual gate.

Cover populated values, legitimate zero/empty data, absent comparison baseline, type-specific hidden fields and longest relevant content where applicable. Exercise Tooltip hover/focus and actual summary actions. Record model, geometry, visual review and interaction conclusions separately. Fix the generation source when a rule fails, rather than declaring acceptance from a one-off model patch.

## Heading composition

Use a registered component's actual heading Slot when the heading belongs to that component, such as Descriptions title, Card title or Modal title. Keep text editable and let the installed Ant Design theme own its typography and internal spacing. Do not nest a styled native heading inside the Slot or place a duplicate heading beside it to imitate the component. A separately composed business section may use an appropriate semantic heading. This does not authorize a standalone Page heading; the [admin content-entry rule](../../../design/layout.md#admin-content-entry) applies first. Different legitimate heading roles retain their own scale.

For native semantic headings, explicitly set `letter-spacing: normal` unless the approved design specifies tracking. Plasmic's default heading theme can retain negative letter spacing after the font size is reduced; changing font size/weight/line height alone does not reset it. Inspect actual Chinese and Latin glyph spacing in editor and preview, not only the heading container's bounds. Resolve font family, size, weight, line height and margins against the approved hierarchy and actual inherited theme; account for theme defaults beyond the overridden properties. Avoid adding custom tracking just to make a heading visually larger.

Before acceptance, inspect all generated page, section and component headings at the target viewport in editor and live preview. Check actual glyph spacing, title-to-content separation, sibling consistency and long-text wrapping. Save/reopen and verify heading ownership and explicit overrides. Record model checks and rendered observations separately; do not mark a preview check passed when it was not executed.
