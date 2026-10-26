# Typography

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Typography | `plasmic-antd6-typography` |
| Typography.Link | `plasmic-antd6-typography-link` |
| Typography.Paragraph | `plasmic-antd6-typography-paragraph` |
| Typography.Text | `plasmic-antd6-typography-text` |
| Typography.Title | `plasmic-antd6-typography-title` |

## Generation rules

### Design defaults

- Text for supporting and secondary copy (`type: "secondary"`); Link for navigation inside text; Title only for a section heading that has no component title Slot.
- Sizes follow the [scale](../../../design/scale.md) type table. There is no Page title.

### Text

#### Supporting text hierarchy

Classify text by its role before composition. Neutral supporting descriptions use the theme's **secondary** description hierarchy, whether they appear beside/below a control, under an editor, in a Card, or as a caption/usage constraint. This includes format/range instructions, SQL/data restrictions, supplementary context and routine explanatory notes. Their position does not change their hierarchy. Primary text is reserved for headings, labels and actual business values/content; do not mute a required value merely because it appears in a description region. Error, warning and success feedback retain their native semantic treatment; secondary is not a replacement for feedback colors.

Prefer registered `Typography.Text` with the real `type="secondary"` prop for standalone supporting text. Native Form.Item `extra` and other component-owned descriptions retain their native secondary styles; remove primary-color overrides and avoid inner text components that reset that hierarchy. Use the actual component's description Slot/prop only when its installed contract supports it. When native semantic text is necessary, bind the installed theme's description text token through the supported style contract. In Antd6, Typography's `secondary` uses `colorTextDescription` (aliased to `colorTextTertiary`), not `colorTextSecondary`; preserve the native component mapping rather than choosing a gray token by its name. Do not hard-code gray, lower the whole region's opacity, use disabled text color, or style actual disabled controls as ordinary descriptions. Preserve theme contrast/readability and natural wrapping.

Before generation/editing, inventory supporting text roles, expected text/bindings and secondary ownership along with the containing region. Inspect actual registered props and rendered color, including local/inherited overrides and description children. In Preview verify that supporting text uses secondary hierarchy, complete text remains readable, and headings/values and semantic feedback retain their own hierarchy. Recheck normal/error states where the description accompanies a validated control, then save/reopen and reread. The presence of a description Slot or a gray-looking screenshot alone does not prove correct theme ownership.

For standalone native headings and component-title composition, read [information headings](../compositions/summary-metrics.md#heading-composition).

### Title, Paragraph, Link and Typography

Title owns the intended heading level through its actual level contract. Choose it from the page's semantic hierarchy, then apply supported theme/style sizing; an arbitrary large Text is not an equivalent heading. Paragraph is complete prose with wrapping and any supported copyable/ellipsis behavior. Link has a real href/target and navigational meaning; do not replace local actions with a decorative link whose target is fabricated. Typography is the family container, not another surface or a second heading model.

Read each registration's actual children and supported text controls. Editable/copyable/ellipsis capabilities may differ by component and exposed prop shape; do not borrow a richer native configuration absent from the wrapper. Test heading hierarchy, long paragraphs, copied complete values and real Link destinations. Check normal/secondary/semantic text, theme contrast, keyboard access and saved content/bindings without truncating source data.
