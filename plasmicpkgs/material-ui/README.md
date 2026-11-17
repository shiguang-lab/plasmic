# Material UI for Plasmic

`@shiguang-lab/plasmic-material-ui` registers 103 Material UI 9.5.0 components,
NativeOption for native select options, and a Material UI Theme global context.
The library targets mobile-first React web pages. It uses the host's React and
Emotion for styles; installing it does not apply a global CSS reset or locale.

## Registration

```tsx
import { registerAll } from "@shiguang-lab/plasmic-material-ui";
registerAll(); // or registerAll(PLASMIC)
```

Component identities use `plasmic-material-ui-*`; runtime components and state
helpers are exported from `@shiguang-lab/plasmic-material-ui/components`.
`platform/canvas-packages/src/material-ui.ts` supplies the hostless canvas and
server registration bundles. The component library is independent of Ant Design.

## Properties and state

- API metadata is generated from the pinned MUI release, including inherited
  props, English descriptions, enum values, native event arguments and defaults.
- React node props are editable slots. Native component types, refs and callback
  functions use expressions. `slotProps`, `classes`, and responsive `sx` values
  accept native MUI objects; function values can be supplied by expressions.
- Writable state bindings extract values from MUI's original callback signatures.
  Native default props are represented by edit-only initial-value controls whose
  `uncontrolledProp` points to `defaultValue`, `defaultChecked`, `defaultPage`,
  or `defaultExpanded`. They do not force otherwise uncontrolled inputs to stay
  controlled in exported code.
- Tabs and BottomNavigation add `defaultValue` for standalone interaction.
  Dialog, Drawer, SwipeableDrawer, Menu, Snackbar and Tooltip add `defaultOpen`
  and `onOpenChange(open)`. Original `onOpen` and `onClose` callbacks still receive
  MUI arguments. The shared canvas state contract supplies temporary selection
  reveals, without saving values or invoking business callbacks during editing.
- Autocomplete provides a default TextField with preserved native refs/input
  attributes. `textFieldProps` customizes this input; `renderInput` can replace it.
- `Material UI Theme` accepts native `ThemeOptions`, including light/dark palette,
  typography, spacing, shape, breakpoints and component overrides.

The catalog covers Inputs, Navigation, Data display, Feedback, Surfaces and
Layout. MUI X (date/time pickers and Data Grid), Lab components and the separate
Material Icons package are not included in this Material UI Core registration.

## Build and validation

```sh
pnpm --filter @shiguang-lab/plasmic-material-ui build
pnpm --filter @shiguang-lab/plasmic-material-ui typecheck
pnpm --filter @shiguang-lab/plasmic-material-ui test
pnpm setup:canvas-packages
node --test platform/canvas-packages/material-ui-runtime.test.cjs
cd platform/wab
node_modules/.bin/vitest run src/wab/server/code-components/material-ui.test.ts
```

Regenerate API metadata with `pnpm --filter @shiguang-lab/plasmic-material-ui generate`
after changing the pinned MUI version. Generated metadata is checked in; builds
and registration do not fetch documentation. The upstream MIT license is in NOTICE.

To add the library to a deployed Component Store, build/deploy the corresponding
canvas and server packages, stop the server and run:

```sh
docker compose run --rm server src/wab/server/nas-material-ui.ts
```

Restart the server to load its new catalog. The command creates or republishes the
hostless library, preserves other libraries, and records whether versioned code
artifacts exist. Designers can then install Material UI from the Component Store.
