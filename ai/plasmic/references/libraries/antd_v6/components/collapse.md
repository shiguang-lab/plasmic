# Collapse

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Collapse | `plasmic-antd6-collapse` |
| Collapse.Panel | `plasmic-antd6-collapse-item` |

## Generation rules

### Design defaults

- Use for optional or advanced groups that most users skip, and for regions the source marks as collapsible.
- Collapsed by default unless the source says otherwise; one panel per group, titled with the group name.

### Related expandable sections

Use Collapse for sections that may be individually expanded or follow an explicit accordion rule. Read actual activeKey/defaultActiveKey, accordion, items/children and onChange contract. Keys are stable business identifiers, not array positions that change when sections are inserted. Collapse.Panel uses the installed child registration and lives in this document.

### Semantic styles

Under **Semantic styles** (`styles`) in Studio, open the region you want to style and edit its fields directly. Numeric dimensions use pixels. Code and data bindings can supply additional React CSS properties in the same native `styles` object.

| Region | Applies to | Studio fields |
| --- | --- | --- |
| `root` | Collapse container | Maximum width, inline margin, background, border color, width and radius |
| `header` | Full header row | Inline and block padding, text color |
| `title` | Title inside the header | Text color, font size and weight |
| `body` | Panel content body | Inline and block padding, background and text color |
| `icon` | Expand indicator container | Color, font size and weight |

Use the panel's native body padding by default. Leave the padding properties in `styles.body` unset and let the panel provide the inset around the `children` slot. Keep content wrappers free of padding that duplicates this inset. When the design explicitly calls for a different inset, set it directly on `styles.body`.

Use **Header background color** (`headerBackgroundColor`) to pick a color or token for the full header row. The wrapper overrides only `styles.header.backgroundColor` while the picker has a value. Clear it to use the background from `styles.header` or the inherited theme. Check the color and any other header styles together in Preview.

### Read-only workflow details

Use one Collapse with one Panel per stage when users review ordered results and can expand each stage independently. Use [Steps](steps.md) for workflow progress or stage navigation. For a review that requires comparing stages, keep `accordion=false` and initialize the open stages from the requirement. In Studio, the registered initial `activeKey` maps to native `defaultActiveKey`; use an array of stable stage keys for multiple open panels. Keep those keys stable when the display order changes.

- Use the Panels (`children`) slot for rich, editable content. Place the stage number, short title and readable status in each Panel's `header` slot. Show the number once. Place a completion timestamp in `extra` when the source supplies it. Use [Descriptions](descriptions.md) for read-only attributes and [Table](table.md) for repeated records in the Panel's `children` slot.
- Set **Expand icon placement** (`expandIconPlacement`) to `end` for the right edge in left-to-right layouts. Enter `展开` in **Expand text** (`expandText`) and `收起` in **Collapse text** (`collapseText`). The wrapper renders the label through native `expandIcon` using each panel's `isActive` state. Setting either label enables text and supplies `Expand` or `Collapse` for the other label if blank. Leaving both unset keeps the native indicator.
- Use the **Expand icon** (`expandIcon`) render slot for a custom icon or styled text. It receives `panelProps`; use `panelProps.isActive` for state-specific content. The slot takes precedence over the two text fields. Keep `showArrow` enabled on panels that need an indicator, including text indicators. Keep slot content non-interactive so Collapse owns the trigger; `extra` remains available for metadata or independent actions.
- Use the [Header background color picker](#semantic-styles) on Collapse. For a white review surface, choose the corresponding container background token. Keep `bordered` enabled and `ghost` off where the design requires the group border and separators. Code can scope `theme.components.Collapse.headerBg` to the group when the design calls for the same color on the Collapse container.

For an existing Studio project, use the hostless library metadata and canvas runtime version that include these controls. Verify the installed contract before authoring.

In Preview, verify the intended initial panels, two stages open at the same time, and one stage closing independently. Check the full header background and dividers in both states, the indicator and `aria-expanded` after each toggle, and operation with Enter and Space. Reopen the saved page to verify the initial state and editable content slots.

### Content and acceptance

Temporary canvas reveal does not persist expanded business state. Keep required form fields and their validation/values under the real Form preserve and visibility policy; do not treat a collapsed valid field as absent. Verify default, expanded/collapsed, disabled and controlled states, relevant keys after reordering, keyboard operation and hidden error reveal. Check complete content and scroll reachability after expansion.
