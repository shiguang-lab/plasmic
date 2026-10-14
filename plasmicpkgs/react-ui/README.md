# React UI component library

`@shiguang-lab/plasmic-react-ui` registers components from the local `@react/ui` dependency:

| Component | Registration | Behavior |
| --- | --- | --- |
| ActionGroup | `plasmic-react-ui-action-group` | Editable actions, links, confirmations and `onAction(key)` |
| ResourceAuthorization | `plasmic-react-ui-resource-authorization` | Create personalized authorization for a user or department |
| ResourceAuthorization.Record | `plasmic-react-ui-resource-authorization-record` | View permissions and delete personalized policies after confirmation |

Install **React UI** through **Component Store → Business components**, beside Overseas. Installation adds React UI to Installed; the default host and Overseas do not register it. The local dependency and source scope are documented in [vendor/react-ui](../../vendor/react-ui/README.md).

The drawers expose their real `open`, `resourceTypeCode`, `resourceId`, `title`,
`width`, `apiSources`, `onClose()` and `onSuccess()` contract. ResourceAuthorization
also requires `resourceName`. Width defaults are 500 and 600 respectively; neither
drawer accepts arbitrary body or footer slots.

The wrapper adds a `trigger` slot: put a Button in it and bind resource props to
the current row. With `open` omitted, clicking opens local state and closing resets
it. Explicit `open` remains controlled, with change requests emitted through
`onOpenChange`; existing trigger click handlers and disabled/cancelled clicks are
preserved. The trigger slot is optional and adds no default button.

The wrapper retains writable `open` state through `onOpenChange(false)` on close and
uses the shared Antd canvas overlay contract for selection and edit-only
`previewOpen`. Canvas reveal performs no requests or mutations. Preview requires
the host's `window.$$request`; URLs default to the dependency's `/fintecharch`
endpoints and can be overridden through the four `apiSources` fields.

Native `@react/ui` has no `trigger` or `onOpenChange` props. During native code
generation, keep the trigger Button as sibling JSX and translate open/close
behavior and event effects into React state/handlers. Remove wrapper-only props
from the native component. See the [generation contract](../../ai/plasmic/references/libraries/react_ui/components/resource-authorization.md#native-react-code-generation).

Build Antd6 before React UI, then build Canvas packages. Updating an installed
library also requires publishing the hostless React UI project and upgrading the
consuming project's dependency; see [deployment](../../deploy/README.md#react-ui-business-components).
