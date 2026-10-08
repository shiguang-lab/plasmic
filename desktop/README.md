# Plasmic

Electron desktop app with bundled Studio, canvas, Ant Design component bundles,
fonts, CSS and Monaco workers. The NAS serves APIs, project data, user-uploaded
assets and WebSocket updates. Static files are never downloaded at runtime; a
missing bundled file returns 404.

## Build and run

Requires Node >=22.12, npm, curl, and Docker for extracting the released web build.
Run in `desktop`:

```sh
npm ci
npm run assets
npm start
npm run package:mac
# Or: npm run package:win / npm run package:linux
```

`desktop.config.json` pins the web release and Studio/Canvas origins. Keep this
web release aligned with the NAS server release. `assets` extracts `/opt/plasmic-web`
from the pinned image, sets its deployment origin, excludes source maps, and
writes `renderer/desktop-assets.json`. The fixed Studio Google Fonts stylesheet,
font binaries and OFL license files are bundled at build time too. Project requests
for those same bundled font families reuse local font faces; other Google font
families still require the network. Docker and curl
are build dependencies only. Custom project fonts and external project hosts
remain project-managed resources.

If the pinned image is already present on a Docker daemon, `npm run assets --
--cached-image` extracts that image without contacting the registry. The image
must match `webImage`; a missing image fails instead of falling back. A remote
NAS daemon can be used through `DOCKER_HOST=ssh://<configured-nas-host>`.

To build the local SDK, business components, canvas bundles and Studio, then
prepare assets and package the app in one command:

```sh
npm run package:local
```

Both workspaces must already have their dependencies installed. This command
links these local packages into the consumers' `node_modules` before building;
reinstalling workspace dependencies restores normal dependency resolution.
Quit and reopen the packaged app after a successful build. About Plasmic and
`get_app_state.build` show the source commit, local/release kind, dirty status,
build time and renderer hash. Packaging verifies both renderer and desktop
source hashes and rejects assets changed since preparation.
Local Studio builds write `studio-build.json` with the source revision, source
hash and compiled asset hash. Asset preparation and packaging validate this
provenance; they preserve the compile-time revision and dirty status.

To bundle an already completed production frontend instead:

```sh
# Recompile Studio and record its provenance after building the local canvas packages:
node ../scripts/build-studio.mjs
npm run assets -- --from ../platform/wab/build
```

Use this command for local Studio changes. Running `npm run assets` without
`--from` replaces the renderer with the pinned web release. After packaging,
quit and reopen the app to load the updated frontend and desktop login code.

That directory must be a complete self-hosted WAB production build, including
canvas packages, generated CSS and valid `studio-build.json` provenance.

Packaging creates applications, installers and update manifests in
`dist/<version>/<platform>-<arch>/`, with renderer files inside `resources/app.asar`.
macOS uses `darwin-universal`: one DMG and one update ZIP contain both Apple Silicon
and Intel binaries. `package:mac` and macOS defaults build Universal packages;
packaging verifies both executable architectures and the signed bundle's runtime
dependencies. Windows and Linux retain their architecture-specific packages.
macOS produces an ad-hoc signed DMG and ZIP for internal distribution, Windows
produces a per-user NSIS installer, and Linux produces an AppImage. macOS
Developer ID signing/notarization requires Apple credentials and a macOS
build environment. No backend or database is included.

## Canvas reads and verification

`get_screenshot`, `snapshot_layout` and exports with `componentUuid` pin a
background canvas until the read completes. They keep the active arena,
selection and viewport. Workspace screenshots capture the current editor view
and reject `componentUuid`; use artboard mode for another component. Editor
mutations serialize, while state queries and independent media jobs proceed
without waiting for the editor queue. State reports queued/running operations.

`validate` checks the authored model. `snapshot_layout` checks horizontal
overflow and unloaded images in rendered DOM, and reports when its 2,000-node
limit truncates inspection. Neither checks interactions, content overlap or
responsive breakpoints. Artboard exports are static; `sourceViewport` and
`resized` distinguish the source canvas from a resized rendering. Verify
interactions and responsive behavior in Preview at the actual viewport size.
Current canvas reads support project hosts as well as the bundled host. Overflow
checks account for ancestor clipping and internal scroll containers. Static
exports preserve current form values and nested scroll positions; authored
scripts are removed and only the generated scroll restorer is permitted to run.

Projected code-component parts can mark DOM roots with
`data-plasmic-canvas-part="part-name"` inside a
`data-plasmic-canvas-part-scope` ancestor. Studio unifies the bounds of matching
parts belonging to the same authored node and owner within that scope. Table
uses this contract for column cells; hierarchy selection stays component-neutral.

## NAS updates and releases

Updates use `desktop.config.json`'s HTTPS `updateUrl`. macOS uses the shared
`darwin/universal/` feed on both CPU architectures; Windows and Linux use feeds
partitioned by platform and architecture. GitHub is not contacted when checking, downloading or installing.
The application checks immediately at startup and every ten minutes. The sidebar
shows a blue update icon at the bottom when an update is available. Hover or keyboard
focus expands the sidebar icon's action label; the editor's narrow left toolbar
uses a circular icon and tooltip. Click to download, watch the progress, then click
again to save the design and restart with the update. Failures show a retry action.
The icon is embedded in the sidebar and never floats over the page. On the login
page, use the native **更新 → 检查更新…** menu to check, download or install updates.
Development launches disable installation.

Desktop releases use `desktop-v<version>` tags. Set a higher stable version in
`package.json` and `package-lock.json`, pin the compatible Studio `webImage` in
`desktop.config.json`, and add `release-notes/<version>.md`. Push the commit and tag:

```sh
git tag desktop-v0.0.23
git push origin master desktop-v0.0.23
```

`.github/workflows/publish-desktop.yml` extracts the pinned Studio image once, then
builds macOS Universal on macOS, Windows x64 on Windows, and Linux x64 on Linux.
Each native runner tests the desktop and packages its installer. The final job verifies
all installer sizes and SHA-512 hashes, copies installers and Electron update YAML
into `desktop/public/desktop-updates/`, and generates `latest.json` for the website.
The JSON contains the version, platform, architecture, size, SHA-512 and public HTTPS
download URL. Installers and manifests ship together in
`ghcr.io/shiguang-lab/plasmic-desktop-releases:desktop-v<version>`.

The release image contains the installers and manifests built for that release.
Existing version tags cannot be overwritten. Make this GHCR package public so NAS
deployments can pull it without GitHub credentials.

After Actions succeeds, deploy the image from the repository root:

```sh
node desktop/scripts/publish.mjs desktop-v0.0.23
```

This pulls the image on the NAS and recreates only `desktop-releases`. The initial
setup adds that service to the deployed Compose configuration and reloads Studio's
Nginx route. The existing web service proxies `/desktop-updates/` to this static
service; no separate public port or binary-upload directory is needed. Downloads and
`latest.json` use `https://studio.plasmic.shiguanglab.com/desktop-updates/`. JSON and
YAML have `no-store` caching; versioned files are immutable and support HTTP ranges.
CORS allows the Shiguang website to fetch public metadata and HEAD installer sizes
without account credentials. Website builds do not embed release versions.

NAS deployment verifies the live JSON and all three installers. `DESKTOP_RELEASE_TAG`
selects the desktop image independently of the Studio/server `IMAGE_TAG`. The existing
`plasmic-desktop-updates` volume retains only the separate CLI/Skill resource route.
App releases do not rebuild or redeploy the Shiguang website or Studio backend.
Local packaging remains available for development; production installers come from Actions.

Clicking **重启并安装** saves an open design before quitting; a failed save blocks
installation. Downloaded updates do not install on an ordinary quit. macOS verifies
SHA-512, bundle identity, version, CPU architecture and code signature, stages the
new bundle alongside the installed app, then uses a detached helper to replace it.
The old bundle is retained until the new app loads successfully. If startup fails,
the helper restores and reopens the old bundle. Install from the DMG into a writable
Applications directory before updating; running from the mounted DMG cannot update.
Windows and Linux use `electron-updater` with NSIS/AppImage installation.

The first update-capable release must be installed manually on clients that
predate this updater. Subsequent versions use the in-app flow. Login cookies,
projects and MCP settings stay in the existing user-data directory. macOS install
diagnostics are under `Plasmic Desktop/updates/install.log`. For isolated acceptance
runs, `PLASMIC_DESKTOP_PROFILE` selects a separate application-data directory.

The application is named **Plasmic**. Its local data remains in
`Plasmic Desktop` under the OS application-data directory, including login
cookies, image-service settings and MCP preferences.

Application icons live in `assets/`: `icon.png` is the 1024px master and Linux
window icon, `icon.icns` is the macOS bundle icon, and `icon.ico` is the Windows
executable/window icon. All macOS launches explicitly set the Dock icon.
Packaging embeds the platform icon; see `assets/README.md` for the design source.

## Runtime

The application's persistent Electron session handles the two existing HTTPS
origins. Studio routes resolve to local `index.html`; static URLs, canvas scripts
and workers resolve inside the packaged renderer. API requests are forwarded
with Chromium's network stack and the same session cookies, method, headers and
body. Real-time WebSockets retain their NAS URL. This preserves origin checks
and the cross-origin Studio/Canvas split without disabling web security.

The renderer has no Node access; sandbox and context isolation remain enabled.
External navigation opens the system browser. Internal preview popups share the
same asset handler and authenticated session. Remote custom project hosts are
still remote, because their code is not part of this application bundle.

Sign-in uses the Shiguang account system. An unauthenticated window first displays
a sign-in page. Only clicking **Sign in with Shiguang** starts authorization and
opens `https://shiguanglab.com/oauth/authorize` in the system browser for
`plasmicapp`. S256 PKCE and random state bind authorization to the running app.
The registered HTTPS callback is `https://shiguanglab.com/auth/apps/plasmicapp/callback`.
Website displays the registered app's logo and automatically requests
`plasmic-desktop://oauth/callback`, with an **Open Plasmic Desktop** button as a fallback.
That link carries only the single-use code and state. The main process accepts a
callback only for its matching pending login, exchanges the code with its in-memory
PKCE verifier and consumes a one-use IAM web-session ticket. IAM sets its shared
HttpOnly cookie in Electron, then the app returns to the requested design.
The public page confirms browser authorization; the app reports whether session
establishment succeeded. Cancelling ends the pending request; retrying starts a new one.
OAuth credentials remain in memory during the exchange. Account management opens
the central `/account` page. Sign-out revokes the shared IAM session.

The NAS gateway and auth-service must use the corresponding unified-authentication
release. Register the Desktop OAuth client, `plasmic:access` entitlement and Studio
return origin as described in [deployment configuration](../deploy/README.md#shiguang-unified-authentication).

The desktop honors the OS proxy by default. When launched from a terminal,
`HTTPS_PROXY` / `HTTP_PROXY` and `NO_PROXY` can explicitly configure its proxy. The desktop exposes a native stdio MCP server backed by the active editor. No
Chrome DevTools connection is needed.

Local files remove frontend download latency, but project loading and saves
still depend on NAS response time and the editor still performs its normal
initialization work. This is not an offline editor.

## Desktop verification

```sh
npm test
# On the current computer; the private env file contains an IAM-issued SG_SESSION:
PLASMIC_ENV_FILE=/absolute/path/to/acceptance.env \
PLASMIC_REPORT_DIR=/tmp/plasmic-desktop-report \
npm run test:smoke
```

The smoke test reads existing acceptance-project data, verifies a real NAS
login, locally served Studio/canvas resources, validation and save/reload, and
an offline static asset. It never writes credentials or session cookies to its
report. The desktop application runs on the current computer; only its API
backend runs on the NAS. Test profiles are isolated from the normal app profile.

After publishing a newer version, verify a real NAS download, bundle replacement,
restart and backup cleanup with an older update-capable application bundle:

```sh
npm run test:updates-e2e -- /absolute/path/to/older/Plasmic.app 0.0.6
```

This copies the old app into `desktop-report/updates/installed`, uses a separate
profile, and writes `report.json` and screenshots. It does not replace the ordinary
installed application or use its login profile. This acceptance runner is for macOS
and uses the repository's Playwright installation.

## MCP

Choose **AI → MCP** in the desktop menu to open the local Electron modal window.
Its header stays fixed while the settings body scrolls. Enable a client
to register Plasmic automatically; disable it to remove its Plasmic entry.
Selections are saved and reapplied at startup. Restart or refresh the client
after changing its configuration. Other servers are preserved, and conflicting
entries are reported without being overwritten. Claude Code, Codex, Gemini,
Antigravity 2.0, OpenCode, Kiro, and Claude Desktop are supported (Claude Desktop
on macOS and Windows). The dialog also provides a copyable JSON configuration
for other MCP clients. Start the desktop and sign in before using editor tools. The packaged
application itself runs with `--mcp` as a dedicated stdio process; the normal GUI
process owns the editor. The configuration uses an absolute executable path, so
copy it again after moving the application.

The server provides these tools:

| Tool                             | Function                                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------- |
| `get_app_state`                  | Read readiness, project, focused artboard, selection/editing scope and exact editor schemas |
| `list_projects` / `open_design`  | List accessible NAS projects and open a design                                              |
| `read_skill` / `get_style`       | Editing workflow and local palette/spacing presets                                          |
| `execute` / `execute_batch`      | Validated edits; a batch rolls back completely on failure and is one undo step              |
| `snapshot_layout`                | Rendered desktop/mobile geometry and image load status                                      |
| `get_screenshot`                 | Clean static artboard PNG; `mode: "workspace"` captures the editor                          |
| `import_image` / `read_image`    | Import a local raster into NAS and read design image pixels                                 |
| `export_design` / `export_pages` | Static exports and ordered multi-page PDF                                                   |
| `export_code`                    | Editable React/TypeScript/CSS from NAS codegen                                              |
| `capture_browser` / `browser`    | Reference PNG/DOM and persistent isolated browser CDP                                       |
| `search_stock_images`            | Commons images with license/source/attribution metadata                                     |
| `vectorize_image`                | Local raster tracing to SVG paths                                                           |
| `make_vector`                    | SVG paths and union/intersection/subtraction/xor geometry                                   |
| `generate_image`                 | Configured Images generation/edit/background service                                        |

`execute` supports `identify`, `read`, `createComponent`, `insertHtml`,
`changeElement`, `deleteElement`, `createState`, `createInteraction`,
`createStyleToken`, `copyElement`, `moveElement`, `queryElements`,
`updateState`, `deleteState`, `updateStyleToken`, `deleteStyleToken`,
`createVariantGroup`, `createVariant`, `createGlobalVariantGroup`,
`createGlobalVariant`, `createBreakpoint`, `deleteComponent`,
`readVector`, `updateVector`, `createCanvas`, `createArtboard`,
`findEmptySpace`, `navigateCanvas`,
`navigate`, `scrollElementIntoView`, `validate`, `save` and `undo`. Read the schemas in
`get_app_state` and component/slot contracts from `execute` → `read` before
editing. New pages and component definitions are created with `createComponent`;
new elements and registered Ant Design 6 instances are inserted with `insertHtml`.
Call `validate`, inspect a screenshot and then `save`. Changes persist through the
NAS API and remain editable in Studio.

The stdio process forwards commands to a local Unix socket (Windows named pipe).
A random token and owner-only files in the Electron user-data directory protect
that connection. Editing commands run serially through the sandboxed preload and the
existing `PLASMIC_AI_TOOLS` transaction API. Read-only canvas inspection uses
fixed DOM code; exports render sanitized snapshots in isolated windows. Clients cannot evaluate arbitrary JavaScript in the Studio renderer. The isolated reference browser exposes restricted CDP domains and shares no Studio session or preload. Runtime prototype
interaction code is supported only by the validated createInteraction contract. Do not share the user-data directory or `mcp-connection.json`.

For a development checkout, the copied configuration uses the local Electron
binary and the `desktop` directory as its first argument. Keep that GUI instance
running while calling tools. To run the end-to-end MCP acceptance test on the
current computer using an already authenticated, isolated acceptance profile:
Set `PLASMIC_TEST_PROJECT_ID` and `PLASMIC_TEST_COMPONENT_PROJECT_ID` to an editable
acceptance project and its imported Ant Design 6 catalog. The test creates a new page.

```sh
PLASMIC_DESKTOP_PROFILE=/absolute/path/to/acceptance-profile npm run test:mcp
```

This test connects through the actual stdio MCP transport, lists/opens a project,
creates an Ant Design 6 page, reads and modifies it, validates and saves it,
captures a PNG, reloads it from the NAS, and checks rejection of arbitrary code.
It adds a uniquely named page to the acceptance project. Reports and screenshots
are written to `PLASMIC_REPORT_DIR` (default `/tmp/plasmic-desktop-mcp-report`).

Screenshots and exports clone the rendered canvas into an isolated window with
scripting disabled and empty slot placeholders removed. They wait for fonts and
images with bounded timeouts. Use an existing artboard width for responsive
validation: resizing a static snapshot does not re-evaluate Studio variants.
HTML exports retain asset links and do not include live interactions or React
source. Imports convert raster images to PNG and do not preserve animation.

Install the unified [Plasmic skill and CLI](../ai/plasmic/README.md) for product
prototyping and development code generation. Each task resolves current NAS resources;
`read_skill` supplies this bootstrap entry point. Repository numeric tags publish the CLI to npm; deploy its matching resource bundle to NAS.
Desktop tags publish native installers and the static release image through Actions.

See [MCP guide](../ai/plasmic/references/desktop-mcp.md) for exact sequencing and current limitations, and
[MCP capability status](MCP-CAPABILITIES.md) for acceptance evidence and the Pen
comparison. Full Pen MCP parity is not implemented.

## Image service

Create `image-service.json` in the desktop user-data directory (`~/Library/Application Support/Plasmic Desktop` on macOS), with owner-only permissions:

```json
{
  "baseUrl": "https://api.openai.com/v1",
  "model": "YOUR_IMAGE_MODEL",
  "apiKey": "YOUR_KEY"
}
```

The chosen service must implement JSON `/images/generations`, multipart `/images/edits`, and `data[0].b64_json` PNG output. Background removal requires transparency support. `get_app_state` reports whether it is configured, without returning credentials. No image service is enabled by default.
