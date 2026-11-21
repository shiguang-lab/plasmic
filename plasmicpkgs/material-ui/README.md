# Material UI for Plasmic

`@shiguang-lab/plasmic-material-ui` registers 103 Material UI 9.5.0 components,
MIcon for Material icons, NativeOption for native select options, and a Material UI Theme global context.
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
- Empty-slot placeholders follow the native content contract. Primary content
  (Button, Typography, dialog bodies) and required controls/triggers retain their
  editing targets. Optional labels, decorations and fallback/measurement content
  (Box, StepLabel, Divider, Avatar, Skeleton, Snackbar) stay absent until supplied.
  Native-child collections and SVG/table/select structures do not receive an
  unsolicited placeholder div. Studio can still reveal a slot when explicitly
  focused; the global placeholder preference is unchanged.
- Inherited `children` props ignored by the native component are not registered;
  use its actual `icon`, `message`, `page` or other content prop. Content `action`
  slots remain slots, while ref-valued `action` props remain expressions.
  Single-node props resolve Studio slot observers before native inspection or
  cloning, preserving control events, icon classes and StepLabel identity.
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
  attributes. `textFieldProps` customizes this input; its `slotProps` merge native
  classes and event handlers. Autocomplete retains ownership of refs, ARIA,
  values and adornments. `renderInput` can replace the input composition.
- `Material UI Theme` accepts native `ThemeOptions`, including light/dark palette,
  typography, spacing, shape, breakpoints and component overrides.

## Property controls

- Native booleans and numbers (including MUI custom integer validators) use
  boolean and number controls. Enum choices retain actual booleans such as
  `false`, alongside strings. Native defaults are hints, not injected values.
- Mixed scalar/array values, responsive Grid/Stack values, component types,
  refs and callbacks use expressions. Pass HTML tags as string expressions
  (for example `"section"`) and React components as component expressions.
  Use `sx` for style objects; function/array styles can use expression bindings.
- `Grid.container` is a boolean. Portal `container` props are element/function
  expressions. `CardMedia.image`/`src` use image controls; `alt`, `srcSet`, `sizes`
  and `loading` configure the image root when `component` is `"img"`.
- TextField input attributes belong in `slotProps.htmlInput` (for example
  `{ maxLength: 12 }`); InputBase/OutlinedInput retain their native `inputProps`.
  Autocomplete accepts these TextField settings through `textFieldProps`.
- Select accepts MenuItem children, or NativeOption children with `native:true`.
  ImageListItem accepts image nodes and ImageListItemBar content. Collections
  that inspect children resolve Studio observers before native rendering.
- Stepper resolves StepButton identity before MUI establishes keyboard
  navigation; Select/NativeSelect retain MUI's FormControl identity for SSR.

The catalog covers Inputs, Navigation, Data display, Feedback, Surfaces and
Layout. MIcon selects an official `@mui/icons-material` component by export name,
including themed variants. For example, use `<MIcon name="Search" fontSize="small" />`
inside an input adornment. MUI X and Lab are outside this package.

## Build and validation

`catalog.test.tsx` renders all 103 catalog components in their native contexts,
plus NativeOption, and checks for render warnings. `contracts.test.tsx` checks
scalar/component/ref registration across the catalog. `behavior.test.tsx`
exercises input validation attributes, controlled values, selection, range and
pagination events, keyboard navigation, overlays, SSR labels and configured
input slots. `slots.test.tsx` covers optional content and native defaults.
These tests do not establish every browser, gesture or responsive combination.

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

The Component Store release version is independent of the application and source
package versions. Removing a published slot requires `--breaking` and creates a
major library release. Rehearse the release and inspect importing projects for
removed settings before publication; existing platform-library consumers upgrade
through the normal project load/publish/export flow.
