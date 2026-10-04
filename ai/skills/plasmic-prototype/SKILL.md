---
name: plasmic-prototype
description: Generate and refine editable Ant Design 6 prototypes in the self-hosted Plasmic Studio using Chrome DevTools MCP and the validated PLASMIC_AI_TOOLS API. Use for prototype pages, flows, forms, dashboards, and component-based UI design.
---

# Plasmic prototype

Studio: https://plasmic.studio.publib.cn

Use the user's project ID (the segment after `/projects/`). If absent, inspect the open Studio tab; ask only if multiple projects make the target ambiguous. Never default to the official cloud Studio. Sign-in must already be available in the browser session.

Use Chrome DevTools MCP navigation, evaluation and screenshot tools. Run API calls in the top-level Studio window, which forwards validated calls into the editor iframe. Do not access private StudioCtx/model globals or edit database bundles.

## Generate

1. Navigate to the project. Wait for `window.PLASMIC_AI_TOOLS`; call `identify` with model/client/skill identity and `outputFormat: "json"`. Stop if `canEdit` is false. Do not change permissions or disable branch protection.
2. Inspect `_meta` by returning each tool’s name, description and `inputSchema`; fetch the output schema for a specific tool when needed. Tools return `{success, output}`; parse `output` as JSON only after checking success. Report errors and fix their cause. Never silently ignore import errors.
3. `read({})` to discover pages, reusable components, installed library names, project IDs, tokens and screen breakpoints. `read({componentUuids: [...]})` for exact props, choices, slots and names of components you will use. Reuse Ant Design 6 registrations (`plasmic-antd6-*`) and existing local components. Never assume Ant Design 5 or React Aria props are valid.
4. Translate the request into a short page/flow plan: navigation, main task, states, realistic sample content and mobile behavior. For a new prototype create pages/components with unique names and routes. For changes read the target before modifying it; never replace an existing root without explicit user intent.
5. `createComponent` and `insertHtml` build editable elements. Use native HTML for semantic text and layout; use Ant Design 6 for controls, cards, forms and data display. Use flex/grid, spacing tokens, a readable hierarchy, sensible max widths and real task content. Avoid absolute-positioned mockups and screenshots as UI.
   For list query regions, use Overseas `plasmic-overseas-search-form` and editable `plasmic-overseas-search-form-item` nodes in its children Slot. Read installed Overseas contracts; install/upgrade the published library if these components are absent. Use colSpan=6 for four-column layouts. Configure unique name, label, span, initialValue, clearValue and validation on each Item; place exactly one Antd6 control in its children Slot and edit placeholder/options/date mode on that control. Extra buttons go in extraActions; custom labels/help use labelContent/help. Insert, modify, move and delete real Item/control nodes. Bind onSearch(values)/onReset(values) to applied filters and page one; values tracks drafts. Do not construct another native query grid or opaque fields/element JSON. See docs/search-form.md for the component contract.
6. Use `createState`, bindings and `createInteraction` for requested interactions; links should use registered `href` props or native links. Forms should have labels, an obvious submit action and a meaningful outcome. Mark simulated data honestly. Do not claim a backend integration that is not implemented.
7. `navigate` to each generated page. Review screenshots and actual DOM behavior at desktop and mobile widths. Fix clipping, overlapping text, inaccessible labels, empty components and broken navigation. `validate` checks model integrity and library usage; it is not a visual quality score.
8. Call `save`, record its returned revision, reload the project, then `read` to confirm generated pages, props, states and interactions persisted. Only report completion after this verification. Do not publish a release without user intent.

## Markup

```html
<section data-plasmic-name="actions" style="display:flex;flex-wrap:wrap;gap:12px">
  <plasmic-component
    data-plasmic-component="plasmic-antd6-button"
    data-plasmic-project="PROJECT_ID_FROM_READ"
    data-plasmic-name="primaryAction"
    data-props='{"type":"primary"}'>
    <slot name="children"><span>Create project</span></slot>
  </plasmic-component>
</section>
```

Read the real component contract before using this example. `data-props` contains JSON, never JSX. Slots must be direct children of `plasmic-component`. Styles on code-component instances are limited to layout; appearance should use supported component props or a styled wrapper. Responsive CSS must match breakpoints returned by `read`, or use `changeElement` with their variant UUIDs. Give important elements semantic `data-plasmic-name` names so later reads and modifications can target them reliably.

## Verification report

Report the project URL, generated pages/flows, saved revision, actual checks and remaining limitations. Keep a tool-call transcript with names, sanitized inputs, success/error, outputs and durations when the user requests process auditing. Include desktop/mobile screenshots for quality review. Do not invent test results or infer visual quality from a successful save.
