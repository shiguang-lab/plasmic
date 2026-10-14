# Resource authorization drawers

Library: [React UI](../index.md).

| Component | Registration |
| --- | --- |
| ResourceAuthorization | `plasmic-react-ui-resource-authorization` |
| ResourceAuthorization.Record | `plasmic-react-ui-resource-authorization-record` |

ResourceAuthorization creates personalized authorization for a user or department.
ResourceAuthorization.Record views permissions and deletes personalized policies.

## Trigger and open state

Place a Button in the wrapper's `trigger` slot to open the drawer. Bind the
resource props directly to that row's values; each instance owns its open state
when `open` is omitted. Trigger clicks emit `onOpenChange(true)`. Close emits
`onOpenChange(false)` before `onClose()`. Existing Button click handlers are
preserved; disabled buttons and clicks cancelled with `preventDefault()` do not
open the drawer. The drawer portal is a sibling of the trigger, so closing or
interacting with drawer contents cannot reopen it through the trigger.

An explicit `open` value is controlled: trigger/close only request changes through
`onOpenChange`, and the bound owner supplies the next `open`. Keep writable
`open` for a shared page-level drawer opened by multiple actions. `trigger` is
optional and does not create a default button.

Bind `resourceTypeCode` and `resourceId` from the selected business record; also
bind `resourceName` for ResourceAuthorization. `open` is writable through
`onOpenChange`. `onClose()` has no arguments. `onSuccess()` has no arguments and
can refresh consuming page data. Creation emits success and then closes; deletion
refreshes permission details and emits success without closing the drawer.

`title` is an optional slot. `width` defaults to 500 for creation and 600 for
details. The form and permission list are owned by the component, with no body or
footer slots. Keep prop names and metadata in English.

`apiSources` can override `dataPolicy`, `dataResourceTypeList`, `userOptions` and
`deptTree`. Requests use the host's `window.$$request`; a standalone Preview must
provide that authenticated request instance. The component manages resource
actions, users, departments, policies and permission requests itself.

Selection or `previewOpen` reveals the drawer only on the noninteractive canvas,
without changing persisted `open` or issuing requests. Preview follows `open` and
uses real APIs or the omitted-open trigger state. Selecting the `trigger` slot
does not automatically reveal the drawer. Verify creation, validation, close,
deletion confirmation and refresh behavior through Preview with the consuming
host configured.

## Native React code generation

`trigger` and `onOpenChange` are wrapper additions. Native `@react/ui`
ResourceAuthorization and ResourceAuthorization.Record do not accept them.
Read the target package's actual types before generation.

When generating native `@react/ui` code:

- Lift the actual trigger content into sibling JSX, in its original row/condition
  scope. Keep the button's label, styles, disabled state, existing click handler
  and permissions. Removing the `trigger` prop must not remove its content.
- Translate omitted-open trigger behavior to local React state. Explicit page
  state remains owned by that page; connect opening to the trigger click and
  closing to the native `onClose`. Preserve event binding effects and callback
  order; `preventDefault()` or a disabled trigger still blocks opening.
- Pass only real native props. Remove `trigger`, `onOpenChange`, `previewOpen`,
  selection and canvas notification props from the native component. Translate
  runtime `onOpenChange` effects into the React handlers before removing the prop.
  Record does not take `resourceName` either. Keep native `onSuccess` unchanged.
- Verify both drawer variants against installed types and test opening, closing,
  row identity, disabled triggers and controlled state. Do not import the Studio
  wrapper or add a new generic trigger adapter to the target just to retain a
  nonexistent prop. If the target intentionally uses the actual Plasmic wrapper,
  its supported `trigger` prop remains valid.

For a simple native authorization trigger, the resulting structure is:

```tsx
const [open, setOpen] = useState(false);

return (
  <>
    <Button onClick={() => setOpen(true)}>授权</Button>
    <ResourceAuthorization
      open={open}
      resourceTypeCode={resourceTypeCode}
      resourceId={resourceId}
      resourceName={resourceName}
      onClose={() => setOpen(false)}
      onSuccess={onSuccess}
    />
  </>
);
```

ResourceAuthorization.Record follows the same structure with its actual native
props and no `resourceName`. Existing business click and close effects must be
composed into these handlers when present in the source model.
