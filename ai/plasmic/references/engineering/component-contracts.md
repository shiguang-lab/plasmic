# Component registration and runtime verification

Read only when changing a component wrapper, registration or editor runtime. Ordinary design tasks verify affected Preview behavior through the relevant region/component reference. Use the [library index](../libraries/index.md) to select matching library/API and component rules; this file owns shared engineering verification.

## Defaults and values

Use the actual installed component library/version’s defaults. Keep registration hints and runtime defaults consistent; a hint is not an injected value. Business conventions belong in explicit page props rather than wrapper defaults. Preserve explicit false, zero, empty string and null according to each native prop’s contract.

## Native classes and events

Where the component exposes native semantic classNames, merge them (including supported function forms and nested popup classes) with Studio scope/reset classes; neither may overwrite the other. Preserve independent root, input, popup, body/container and panel classes. Avoid leaking editor-only styling props into native DOM attributes. Test portal overlays and controls with both class sources present.

Function events and render-slot Props expose native `args` names and types. Use the returned submit argument and lexical row variables; do not invent a data context for them.

MCP prop registration reports the original declared type/signature and nested fields even when Studio stores an any type. Preserve the distinction between returning functions and event handlers. Export declarative metadata only; never invoke options, argValues, hidden callbacks or custom controls to discover a contract. An undeclared nested shape remains unknown.

Identical descriptions/signatures and normalized choice lists appear once on the prop, rather than being repeated in registration. Verification failures report constrained property paths, not unrelated row datasets.

Global contexts use the context registration registry, separately from ordinary code-component registrations. Preserve their native `isContext` identity in inventory and projected reads; expose qualified global-action names and ordered declarative parameter types without executing metadata callbacks. Read installed instances/settings from the consuming project's native `globalContexts`, not from a library definition or an authored Page wrapper. Verify this discovery path before page mutations, including imported and hostless registrations.

## Slots and editor state

Empty code-component Slots retain the component’s native default; an explicit null expression remains an override. Check native default content, explicit null and custom Slot content on editor canvas and Preview. Keep temporary selection/reveal separate from persisted business props; follow each component’s actual Slot and visibility contract.

Overlay visibility and Table expansion used for editing belong exclusively to the artboard's `CanvasSessionState`. Declare overlay capability through live `canvasOverlay` registration metadata; do not register display overrides or row-sample choices as component props. Selection, content editing, eye controls and permitted native canvas gestures update this session. Native `open`, supported initial values such as `defaultOpen`, and business events retain their actual names and behavior; Modal and Drawer keep their real controlled `open`. Temporary reveals never enter the Site, saved designs, MCP contracts, Preview or generated applications.

MCP mutations reject registered editor-only props, including HTML insertion, literal or bound property changes, resets and batches. Studio selects and reveals the target through its internal canvas session; agents edit only public runtime props and content Slots. New instances do not materialize internal registration defaults into authored props. A fresh artboard session starts from the real business configuration, independently of previous editing reveals.

### Canvas session state

The canvas owns one transient session per artboard, keyed by the full rendered instance identity (including repetition) and state property. Editing and interactive canvas modes share that session; changing modes must not change React keys, remount descendants, clear state, or invoke business callbacks.

Registered writable states use their real `valueProp`, `onChangeProp` and state helper argument conversion. Declare `initialValueProp` when the native initial prop is separate, such as `defaultActiveKey`; existing `uncontrolledProp` mappings retain their real initial-prop meaning. Do not invent component-name branches or another persisted property schema.

Use `usePlasmicCanvasComponentInfo(props).states` for selection-driven reveals of registered states. Native nested/private UI state without a writable top-level prop uses the same contract's `getState(name, nativeValue, initialValue)` binding: `value` reads the current session, `reveal(value)` supplies an editing reveal, and `set(value)` records a real UI change. The state name identifies the actual native property/path. Wrappers keep their real controlled/uncontrolled and event semantics; the canvas suppresses business handlers during editing. Explicit business/default value changes take precedence over retained session state. Selection reveals also apply in interactive canvas mode, while actual inputs retain their normal business events. The optional `revealed` flag on a canvas state binding identifies temporary display transitions so overlay lifecycle callbacks remain silent for them. Releasing a selection reveal restores the state that preceded it.

Canvas injection uses one reserved `__canvas` field typed by the host SDK's `PlasmicCanvasProps`. Its members are `selected`, `editing`, `slot`, `fullContent`, `instance`, `states`, `getState` and `onReveal`. Read it through `usePlasmicCanvasComponentInfo`; pass the same object to internal helper components. Do not register this field in component metadata or expose it as a business prop, persist it in the Site, or forward it to native DOM elements. The prefix marks an internal convention; registration and session boundaries enforce isolation.

The same session retains conditional/not-rendered regions and display-none reveals. Overlay visibility follows the shared overlay contract, independent of widget identity. The canvas renderer resolves overlay selection once; wrappers read its effective state rather than feeding that value back as another reveal request. A real close must remain closed through repeated mode changes with the same selection. Preserve native DOM instances so fields, focus and internal state are not lost at mode boundaries. Dispose state with its artboard; independent Preview, static exports and generated applications use business props and initial values and never consume this session.

Verify both transition directions, registered and native nested state, hidden regions, repeated instances/artboard isolation, controlled source updates, callback counts and mounted descendant identity. Check that saved models and independent Preview/exports retain their configured initial state.

Run `node plasmicpkgs/antd6/tests/mode-session.browser.cjs` from the repository root for real-browser transition checks, including DOM identity, draft input, Tabs indicator stability, business event isolation and standalone initial values.

## Verification

When changing a wrapper, test omitted props, explicit overrides and controlled/uncontrolled use against the same installed component library/version. Exercise validation failure, rejected/thrown save, retry, duplicate submission, disabled controls, selection, clearing and event timing where relevant. Run the package's behavior tests and registration/build checks. For affected prototype flows, exercise live App interactions and record screenshots plus observations; screenshots do not prove callback order, validation blocking or state recovery. For shell/editor sizing changes, verify create → content edit → save/reopen → further content edit: shell viewport fill and scrolling must survive each transition. Keep component examples and capability-test pages out of the deliverable.
