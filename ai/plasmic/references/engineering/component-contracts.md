# Component registration and runtime verification

Read only when changing a component wrapper, registration or editor runtime. Ordinary design tasks verify affected Preview behavior through the relevant design reference.

### Component behavior contracts

Use the installed Ant Design version's defaults for component behavior. Keep registration hints and runtime defaults consistent; a hint is not an injected value. Business conventions such as 20 rows per page belong in the page's explicit props. Do not seed a different current step, force Tree expansion or Avatar overflow, or leave Badge demo children/counts in status rendering.

Modal OK invokes its callback without closing automatically. Bind a real validation/save flow and explicitly change the open state only after success; invalid input or failed saving must leave the form available for correction. Cancel/close must clear the open state. Form disabled must remain effective, including ConfigProvider inheritance; temporary submission disabling must restore on both success and failure. Await validateFields and stop the mutation on rejection. Custom exact-length rules must actually reject invalid values. When concurrent submissions are explicitly permitted, submitting remains true until all finish.

Invalid-input acceptance requires a visible inline field error as well as blocked saving. Required text rejects whitespace-only values; correcting it clears the error. A dialog that simply remains open without explaining the invalid field does not pass validation-feedback acceptance.

Table selection must persist without a state binding, and controlled selection must follow the bound keys. Clear selection and radio/checkbox modes must work. Pagination initializes its derived indexes from current/default props without emitting a business onChange; changes after user interaction update both page and index values. Numeric input state is numeric; Checkbox Group state is an array.

Preserve explicit false, zero, empty string and null according to each native prop's contract. Tooltip empty/null title disables its fallback. Select honors custom filtering, server-side filterOption=false and suffixIcon=null; labels may be React nodes or numbers. ColorPicker updates its value on change while preserving the separate completion callback. Date ranges honor default dates when uncontrolled, respect controlled values and allow typing by default; read-only is explicit. Do not inject global date-picker CSS from each component instance. Upload reads files locally as base64: done means local reading completed, not server upload success. Multiple selection preserves order; maxCount retains the newest files.

Modal footer=null hides its footer; zero and responsive width values must pass through. Mask visibility and outside-click closing are separate settings; an explicit close setting must work with boolean and object masks. RangePicker inherits disabled from ConfigProvider when omitted, honors an explicit disabled=false, and applies single-side flags only without a whole-control override. A whole-range allowEmpty=false must not enable an endpoint through leftover split flags.

Merge native semantic classNames (including function forms and nested popup classes) with Studio scope/reset classes; neither may overwrite the other. Preserve independent root, input, popup, body/container and panel classes. Avoid leaking editor-only styling props into native DOM attributes. Test portal overlays and controls with both class sources present.

Select single/multiple/tags and TreeSelect single/multiple/checkable values may be scalars, arrays or labeled objects. Their registered state and event types must represent those modes; tags supports multiple initial values. Native Menu onSelect receives an info object containing key and selectedKeys, not a bare key. Rating symbol slots accept single nodes, arrays and text; hover events receive the numeric rating. Progress's omitted type is line, so step colors must work without explicitly setting type; preserve an explicit zero success segment. ActionGroup uses Antd6's medium size spelling.

When changing a wrapper, test omitted props, explicit overrides and controlled/uncontrolled use against the same installed Ant Design version. Exercise validation failure, rejected/thrown save, retry, duplicate submission, disabled controls, selection, clearing and event timing where relevant. Run the package's behavior tests and registration/build checks. For affected prototype flows, exercise live App interactions and record screenshots plus observations; screenshots do not prove callback order, validation blocking or state recovery. Keep component examples and capability-test pages out of the deliverable.

### Editor canvas visibility

Empty code-component Slots retain the component's native default; an explicit null expression remains an override. Check Select's default down arrow on the editor canvas as well as in preview, and verify a custom icon and explicit suffixIcon=null separately.
