# React UI component library

`@shiguang-lab/plasmic-react-ui` registers components from the local `@react/ui` dependency:

| Component | Registration | Behavior |
| --- | --- | --- |
| ActionGroup | `plasmic-react-ui-action-group` | Native action items and folding, with `onAction(key)` for Studio interactions |
| ResourceAuthorization | `plasmic-react-ui-resource-authorization` | Create personalized authorization for a user or department |
| ResourceAuthorization.Record | `plasmic-react-ui-resource-authorization-record` | View permissions and delete personalized policies after confirmation |

Install **React UI** through **Component Store → Business components**, beside Overseas. Installation adds React UI to Installed; the default host and Overseas do not register it. The local dependency and source scope are documented in [vendor/react-ui](../../vendor/react-ui/README.md).

ActionGroup keeps the native item fields and More-menu defaults. Bind navigation
through `onAction`; compose confirmation with a registered Popconfirm and a native
`span` named `RowActionAnchor` around ActionGroup so the popup has a DOM positioning
anchor. See the [row-confirmation composition](../../ai/plasmic/references/libraries/antd_v6/components/popconfirm.md#row-confirmation-composition).

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

For this contract cleanup, publish with the explicit breaking flag:

```bash
docker compose run --rm server src/wab/server/nas-react-ui.ts --breaking
```

Removing nested item fields such as `confirm` and `href` changes behavior without
removing a top-level parameter, so it is not covered by automatic parameter-removal
detection. `--breaking` selects a major version for a changed library; omit it for
later compatible updates. It does not publish an unchanged library again.
