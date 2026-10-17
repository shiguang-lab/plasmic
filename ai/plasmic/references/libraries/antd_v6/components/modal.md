# Modal

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Modal | `plasmic-antd6-modal` |

Read the installed Modal contract before changing its Props, Slots or events. [Overlays](../compositions/modal-drawer.md) owns Modal/Drawer composition, dismissal policy and the generation gate; [form composition](../compositions/form-layout.md#modal-form-layout) owns field columns and Modal width selection.

Read Footer and Registration and runtime verification for every Modal; Submission for confirmation/business actions. Follow Form/layout references only when a business Form is present. Read-only content still requires the overlay generation gate, close/reopen, visual and persistence checks.

## Footer

For a Modal with one routine confirmation action plus cancel, keep the component's default footer and locale-owned button text. Omit okText/cancelText and custom footer children; do not recreate the two default buttons just to attach events, loading or disabled state. Bind onOk/onCancel and use the real confirmLoading/okButtonProps/cancelButtonProps contracts for submission state. A source-required specific action/risk label may override supported button text while retaining the native footer. A custom footer is appropriate when the required workflow has multiple distinct operation actions (for example draft/save/publish). Follow [overlay footer selection](../compositions/modal-drawer.md#footer-with-only-an-exit-button) and [buttons and action bars](../compositions/action-bars.md#buttons-and-action-bars) for the required actions and their order, types and availability. An explicit user requirement overrides this default. Remove obsolete custom footer buttons and their handlers when replacing them; field cleanup follows [Form](form.md).

Studio renders an empty code-component Slot as undefined, preserving the native default; explicit footer=null or hideFooter=true removes the footer. Restore defaults through changeElement resetProps after deleting custom footer children, and reset obsolete okText/cancelText/hideFooter overrides too. Do not use an empty Slot to request footer removal. Check actual runtime buttons after cleanup. Code export can serialize empty RenderExpr Slots differently; Preview evidence does not verify exported-code behavior.

Read-only overlays whose composition requires no footer use the current Antd6 hideFooter=true after verifying the installed contract. footer=null also hides the native footer.

## Submission

Modal OK invokes its callback without closing automatically. Bind a real validation/save flow and explicitly change the open state only after success; invalid input or failed saving must leave the form available for correction. Cancel/close must clear the open state under the owning [close policy](../compositions/modal-drawer.md#structure-and-close-behavior).

When the footer is outside Form, do not assume browser implicit Enter submission works: verify the supported input Enter event reaches the same Form validation and duplicate-submit guard as onOk, preventing the default event if needed. [Form acceptance](form.md#acceptance) requires visible inline errors as well as blocked saving. Inspect the reachable native footer and required controls in editor/Preview, then save/reopen and reread; a working success path alone does not pass.

## Registration and runtime verification

Zero and responsive width values must pass through. Mask visibility and outside-click closing are separate settings; an explicit close setting must work with boolean and object masks. Test omitted values and explicit overrides against the installed Ant Design version.
