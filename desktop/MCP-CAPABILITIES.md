# MCP capability status

The native stdio server controls the active local Electron editor. Projects,
authentication, asset storage and saves use the NAS. Static resources remain
bundled. This is not full Pen MCP parity.

## Accepted on the authenticated desktop, 2026-10-03

An independent page `MCP 验收 · 项目工作台` was created in the existing project:
component UUID `TH2qP6DaWo_7`, path `/mcp-prototype-workbench`. Existing pages were
preserved. Calls used the packaged executable's `--mcp` server through the MCP
SDK, not a direct database edit or private Studio model script.

- Create page and insert a semantic editable prototype with 18 Ant Design 6 instances.
- Read actual imported component props/slot contracts and the resulting node tree.
- Update a Progress prop from 68 to 82; add a typed state and bind a Statistic value.
- Attach an Increment interaction to a Button; real live-preview click changed 12 to 13.
- Validate invariants: true, no errors or warnings. Save and restart the desktop;
  re-read retained nodes, bindings and the interaction.
- Read rendered desktop/mobile geometry; capture clean artboard images at 1366 and 414 px.
- Insert and read a raster data URL. Import a local PNG to NAS storage, insert its
  returned HTTPS source, and read its pixels through the authenticated desktop session.
- Export PNG, JPEG, WebP, PDF and static HTML. PNG views were visually inspected;
  PDF/HTML were generated, not accepted as interactive application exports.
- The initial partial-batch implementation has been replaced with an atomic Studio transaction. The new model tests verify rollback and single-step undo; updated desktop runtime acceptance is recorded separately.

Artifacts are in the ignored `desktop-report/mcp-acceptance/` directory. They
contain test design data, screenshots and tool results, no login cookies or MCP
connection tokens. The image fixtures were removed from the final prototype.
The saved prototype's search/filter controls are visual examples; only the
counter interaction was implemented and exercised.

## Pen comparison and remaining scope

Comparison reference: [official Pen MCP/CLI documentation](https://docs.pen.dev/for-developers/pen-cli).
Map actual behavior rather than matching tool names.

| Capability | Plasmic status |
| --- | --- |
| App/project discovery and permission checks | Implemented; authenticated MCP accepted |
| Read editable hierarchy and component contracts | Implemented; accepted |
| Insert/update/replace/delete nodes | Implemented via validated Studio operations; core edits accepted |
| State bindings and event interactions | Implemented; real preview increment accepted |
| Create reusable components and design tokens | Existing validated operations; not exhaustively accepted here |
| Workflow/style guidance | Packaged guide and three local style presets |
| Layout/overflow inspection | DOM bounds and image status; no semantic constraint solver |
| Artboard screenshots | Clean static snapshots, desktop/mobile accepted; node-targeted capture accepted |
| Raster import/read | NAS upload, in-design image retrieval accepted |
| PNG/JPEG/WebP/PDF/HTML export | Implemented; static output only; ordered multipage PDF accepted |
| Copy/move nodes, component-instance overrides, variant editing | Same-component copy/move and variant creation accepted through MCP; model tests cover guards and overrides |
| Typed/themed variable update and removal | State and local style token updates/deletion plus global theme overrides implemented; state/theme values persisted across desktop restart |
| Whole-batch atomic rollback and patch retry IDs | Atomic rollback and single undo implemented; targets must exist before the batch |
| SVG/path authoring and boolean vector operations | SVG boolean geometry and raster tracing imported through MCP; source read/update preserved asset/node IDs and undo restored the original SVG; NAS SVG reads accepted |
| Image generation and background editing | Images generation/edit/background interface implemented; actual provider configuration and quality acceptance pending |
| Raster vectorization | Local ImageTracer geometry fixture-tested and SVG imported through authenticated MCP |
| Stock search | Commons API returned actual assets with source/license/attribution through MCP |
| Browser page/node acquisition | Persistent isolated browser, CDP DOM read, node PNG/styled HTML capture, editable paragraph import and read accepted |
| Editable application code export | NAS React/TypeScript/CSS codegen exported through authenticated MCP |
| Empty-space placement/infinite-canvas layout | Three native mixed-canvas artboards created; four-direction empty-space results do not overlap; navigation, desktop/mobile screenshots and restart persistence accepted |

Acceptance should extend this matrix with executable tests for each implemented
contract. Do not describe the project as matching or exceeding Pen until these
rows are implemented and verified. Built-in AI chat, models and parallel agents
are a later scope, per the user's instruction.

## Advanced acceptance

A separate page `MCP 高级能力验收` (`HB5MKTe9-J-v`, `/mcp-advanced-acceptance`) is used for copy/move, atomic rollback and one-step undo, state updates, component variants, global themes, breakpoint creation, node screenshots, SVG operations and exports. The page and theme/state values were read again after restarting the packaged app. Model regression tests cover freeform canvas placement in four directions, SVG source updates preserving IDs, and NAS SVG reads rejecting raster responses.

The native canvas `MCP 验收 · 多屏流程` contains desktop/mobile workbench artboards and the advanced acceptance page. The three artboard IDs and positions survived a packaged-app restart. Rendered layout checks returned no overflow or unloaded-image problems for these three frames. Final save is revision 58; project validation has no errors and three existing empty-component warnings.

Desktop unit suite: 52 passing tests. Editor model suite: 24 passing tests on NAS. The production WAB build succeeds. The full WAB typecheck still reports existing Copilot chat/OAuth typing errors and a missing generated css-variables module in the source build workspace; it is not a passing full-repository check. Image provider calls are tested against a local HTTP fixture; real generation/background quality remains unaccepted until a provider is configured in **MCP → MCP 设置… → 图像服务**.

The release configuration pins `ghcr.io/shiguang-lab/plasmic-web:0.0.11`. The tag-triggered workflow builds both NAS server and web images from the tagged commit. Desktop assets are extracted from the matching released web image.
