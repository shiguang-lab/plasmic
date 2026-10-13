# Radio

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Radio | `plasmic-antd6-radio` |
| Radio.Button | `plasmic-antd6-radio-button` |
| Radio.Group | `plasmic-antd6-radio-group` |

## Choice and values

Use Radio.Group for one choice from a visible set; each Radio or Radio.Button keeps its stable business value and label. Do not use separate booleans to simulate a mutually exclusive group. Group options and editable children are alternatives selected through the installed useChildren contract. Keep disabled choices visible when their meaning matters, and distinguish a disabled group from a disabled item.

## Radio.Group and Radio.Button

The group owns the selected value; inside Form, let the named Item own that binding. Read its registered onChange event/state helper instead of treating the native event as a bare business value. Radio.Button changes presentation, not the value model. Select a default only from the requirement, preserve zero/false values and test an absent initial selection.

## Acceptance

Verify one selected choice, switching, disabled choices, controlled/uncontrolled initialization, Form validation and keyboard traversal. Test the actual options/children branch and save/reopen to confirm labels, values and selection bindings.
