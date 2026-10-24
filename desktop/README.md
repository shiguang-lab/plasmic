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

On macOS, build and install the current local App and the DS Plasmic skill without publishing:

```sh
pnpm --dir desktop run package:local --install
```

This saves the open design, quits Plasmic, backs up the installed App under
`~/Library/Caches/Plasmic-local-backups`, installs the signed local build into
`/Applications/Plasmic.app`, reopens it and verifies the running renderer/Desktop
hashes. DS uses `~/.agents/skills/plasmic` (or `DSH_AGENTS_HOME/skills/plasmic`),
with the canonical Skill entry and a snapshot of this checkout's references and scripts.
Its `local-source.json` selects `scripts/plasmic-local-context.mjs`, which reads
the current local resources and recomputes their content hash for each task;
it does not resolve the NAS feed. The next task resolution picks up local reference edits;
an active task retains its resource snapshot. Rerun the Skill installer to update
the direct reference/script links used before task resolution.
The resolver exposes a runtime-only content-addressed snapshot of references/scripts, excluding
repository evals and tests. MCP `read_skill` honors the configured local source
in `DSH_AGENTS_HOME` (default `~/.agents`); a broken explicit local source is an
error rather than a fallback to NAS. App/component changes still require a local
rebuild and install; Skill edits require no publication.
App code changes require rerunning the local build/install command.

For an isolated DS skills directory, install the same local source explicitly:

```sh
node scripts/install-local-plasmic-skill.mjs --target /absolute/agent-home/skills/plasmic
```

Both workspaces must already have their dependencies installed. This command
links these local packages into the consumers' `node_modules` before building;
reinstalling workspace dependencies restores normal dependency resolution.
Quit and reopen the packaged app after a successful build. About Plasmic and
`get_build_info().build` show the source commit, local/release kind, dirty status,
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
macOS uses separate `darwin-arm64` and `darwin-x64` DMG/ZIP pairs for Apple Silicon
and Intel. `package:mac` and macOS defaults build for the current CPU architecture.
Packaging verifies the executable architecture and signed bundle runtime
dependencies. Windows and Linux retain their architecture-specific packages.
macOS local builds use an existing **Apple Development** identity in the build
Mac's keychain. Create it through Xcode's account settings or import the intended
certificate and private key before packaging. Packaging selects the single valid
Apple Development identity and fails if it is missing or ambiguous; it never
falls back to ad-hoc signing locally. GitHub Actions (`GITHUB_ACTIONS=true`) uses
ad-hoc signing without looking up or importing a certificate. Do not commit or
bundle private keys.
For local builds, `CSC_NAME`, when set, selects the exact certificate SHA-1 fingerprint; a different
certificate is rejected even if it is a valid Apple Development identity.

All macOS packages must pass strict signature-integrity and bundle-identifier
verification. Local builds additionally verify the selected certificate and
Apple development certificate chain. Retain the same developer team for local updates.
Application sign-in stores its credential in a local JSON file and does not use
the signing keychain. Cookie encryption is explicitly disabled in packaged apps.

Apple Development signing is for development/local testing. Public downloads
with Developer ID trust and Apple notarization require a Developer ID identity
and Apple Developer Program credentials. Windows produces a per-user NSIS
installer, and Linux produces an AppImage. No backend or database is included.

## Canvas reads and verification

MCP screenshots and image reads use WebP previews at quality 85, preserving
transparency and aspect ratio, with a maximum long edge of 2,048 pixels and no
upscaling. `fullResolution: true` on image captures (`get_screenshot`,
`capture_browser`, `reference_browser`, `design_reference`, `preview`) requests
original-size lossless WebP (maximum 16,383 pixels per side).
This changes returned pixels, never the live viewport or saved asset. Image
metadata reports `width`/`height`, `sourceImageSize` and `encoding`. Base64 appears
only in the image block. Generated files remain PNG; exports and imported assets
retain their explicit formats.

JSON tool results appear once in `content.text`, capped at 64 KiB including MCP
content-envelope escaping (images are separate). Oversized values return a
`ResultReference`; `read_result` reads that snapshot by key/index `path`, with
`offset`/`limit` pagination. Entries carry `value` or a nested `reference`;
append the entry key to the path to descend. Strings return `text` chunks and
UTF-16 `nextOffset` values. Follow continuation offsets without cutting surrogate
pairs. Up to 16 snapshots / 64 MiB are retained per MCP connection; references expire
on disconnection or eviction. Reading does not re-execute edits. SVG and captured
HTML use references even when small. Authenticated local RPC remains complete
for the verifier's evidence files.

`read` without targets returns project counts. Use `collection` for a paginated
inventory, or explicit `view: "full"` for complete evidence. `snapshot_layout`
defaults to dimensions/counts and paginated problems; use `view: "elements"` or
`"images"` with fields/target filters for detail, or `view: "full"` for acceptance.

`get_screenshot`, `snapshot_layout` and exports with `componentUuid` pin a
background canvas until the read completes. They keep the active arena,
selection and viewport. Workspace screenshots capture the current editor view
and reject `componentUuid`; use artboard mode for another component. Editor
mutations serialize, while state queries and independent media jobs proceed
without waiting for the editor queue. State reports queued/running operations.

`validate` checks the authored model. `snapshot_layout` checks horizontal
overflow and unloaded images in rendered DOM. Full reads include all visible
elements; summary and detail views declare pagination. Neither checks interactions, content overlap or
responsive breakpoints. Artboard exports are static; `sourceViewport` and
`resized` distinguish the source canvas from a resized rendering. Verify
interactions and responsive behavior in Preview at the actual viewport size.
Current canvas reads support project hosts as well as the bundled host. Overflow
checks account for ancestor clipping and internal scroll containers. Static
exports preserve current form values and nested scroll positions; authored
scripts are removed and only the generated scroll restorer is permitted to run.

For content review, use `get_screenshot` with `fullContent: true` (artboard mode).
It expands nested horizontal and vertical scroll regions and their clipping
ancestors in the isolated static copy, then captures beyond the original viewport.
It leaves the live DOM, scroll offsets and saved design unchanged. `elementUuid`
crops the expanded node; workspace mode rejects `fullContent`. Long captures
default to original-size lossless WebP so text stays readable; explicitly set
`fullResolution: false` for a compressed preview. The response's `fullContent`
metadata records the expanded regions, full dimensions, `coverage: "rendered-dom"`
and limitations. Virtualized items absent from the DOM and content not yet loaded
are not included. Use Preview scrolling for those runtime checks. Captures are
limited to 16383 pixels per side and 20 megapixels; crop a smaller element on
larger pages. This expanded layout supplements a normal viewport screenshot for
layout acceptance. Run `pnpm exec electron tests/canvas-full-content.cjs` from
`desktop/` for native geometry, pixel, crop and source-preservation checks.

Projected code-component parts can mark DOM roots with
`data-plasmic-canvas-part="part-name"` inside a
`data-plasmic-canvas-part-scope` ancestor. Studio unifies the bounds of matching
parts belonging to the same authored node and owner within that scope. Table
uses this contract for column cells; hierarchy selection stays component-neutral.

The app resumes the last Dashboard or editor route on startup. Recent projects
remain a separate File-menu history. Login and external URLs do not replace the
saved route. Project access is checked before opening a saved editor; deleted or
inaccessible projects open Dashboard after login is confirmed. Saved editor viewports are supplied to Studio during initialization. The canvas
remains covered until its saved zoom and pan are applied after artboards and the
inspector mount. Default initial fitting is skipped for a valid saved viewport;
missing arenas or artboards fall back to the normal initial overview.

## Import from the web

Open the docked browser inside the editor with the Studio sidebar globe button, **View → Import
from the web**, or **Cmd/Ctrl+Shift+U**. Enter an HTTP(S) or localhost URL and
browse normally. The element picker highlights a region; use its breadcrumb to
select a parent. **Import** brings the full page or selected element into a
new independent editable artboard. **Enter** imports a
selected region; **Cmd/Ctrl+Enter** imports its screenshot. With no selection,
the camera menu offers full-page and visible-area capture. The viewport button
cycles Desktop → Phone (390×844) → Tablet (1180×820). Desktop pages reflow to
the panel width; zoom changes page magnification. **Coding Mode**, navigation and recent URLs
stay in the right-side panel. It reserves space beside the editor and keeps an
8 px gap to the window's top, bottom and right edges. Drag its left edge to resize.
Application header rows are 42 px high with 28 px primary controls across the
dashboard, CMS, editor, preview and sign-in screens. macOS window buttons use
the same position on every page and retain it through activation, resize,
minimize/restore and fullscreen transitions.
Coding Mode fills the workspace with the same 8 px margins. Its single header
keeps the native window controls, app menu and project workspace entry beside
the browser controls. The underlying editor is hidden and inert until exit. Hiding it restores the
editor's full width and preserves the current reference page and session.
Selection breadcrumbs navigate to ancestors. The property strip copies computed
styles, classes, dimensions, position, padding, margin and typography. Drag the
bottom grip to limit import height; the unused area shows a hatch pattern.
Double-click the grip to restore full-page import. The limit applies to full-page
editable imports and screenshots, starting at the top of the page; selected elements
keep their own bounds. The grip also supports arrow keys, Home (minimum) and End
or Enter (full page). The privacy note scrolls with the start page. Escape
clears the selection; the picker remains active after a click until stopped.
Menus, tooltips, import details and copy feedback follow Desktop's resolved theme.
Button and icon transitions respect the system reduced-motion preference. The
property strip scrolls horizontally; recent pages and long menus use the shared
Scrollbar component with bounded vertical scrolling.

Imports reuse Studio's HTML importer and create one undo step, including the
new artboard. The receipt locates the imported layers, reports conversion details and
can undo the import while it remains the latest edit. Source interactions are
removed, and source text is treated literally. Grid, generated pseudo-elements,
embedded frames, video and canvas may need adjustment or a screenshot instead.
The reference page has its own browser session and no Desktop preload or Studio
cookies.

Successful browser `capture` reads show a two-second border and a single downward
scan over the selected element, or the current viewport for whole-page reads.
DOM/CSS/accessibility CDP reads, `Page.captureScreenshot`, and `Runtime.evaluate`
with `throwOnSideEffect: true` use the same feedback. CDP reads use the viewport
unless a selector or selection target is specified. Feedback starts after a
successful read without delaying its result; imports keep their separate loading
state. Scans follow the element's bounds and are removed on completion, browser
close, navigation or the next capture. Captures exclude both the picker and read
feedback. Reduced motion replaces the scan with a static border.

MCP reference reads use `reference_browser` with this same visible browser and selection:

```json
{"action":"load_page","url":"http://localhost:3000"}
{"action":"select_element","selector":"main"}
```

An explicit `import_reference` call with
`{"action":"editable","target":"selection","name":"ImportedSection"}` imports
the selection. Whole-page and selection imports both create an
independent editable artboard in the current mixed canvas. From page/component
detail, imports use an associated canvas, or create and reuse Free canvas with
a reference to the original page/component. The result includes `canvasName`
and `frameUuid`. Artboard content can be dragged into a page, or the artboard
can be converted to a page or reusable component through its existing menu.
`get_state` reads the live selection and import height. `set_import_height` accepts
`height` in panel CSS pixels (minimum 240); omit it to reset to the full page. `import_reference` with action `screenshot` accepts `full_page`,
`selection` or `visible_area` and imports an image with
the same destination contract; `close` hides the browser. `capture_browser`
remains a separate, temporary reference capture without canvas writes.

Use `preview` for the existing authenticated native Preview: paged snapshots,
click/hover/fill/select/press/scroll, DOM assertions and viewport screenshots.
The Preview toolbar offers Back, Forward, Refresh and Exit preview. Back/Forward
traverse only the current Preview session’s business page history; device changes
and refresh do not create history entries. Refresh remounts only the runtime iframe.
MCP `preview` supports `back`, `forward`, `refresh` and `close`; query `state` for
`canGoBack`/`canGoForward` before navigating. Navigation actions return the updated
flags, and boundary actions are safe no-ops. Closing clears that session’s history.
The reference browser rejects Studio Preview URLs and exposes read-only CDP.
It cannot verify authenticated business behavior. Imports are separate operations.

`design_reference` reads supplied `.pen` files through the installed Pen MCP with
fixed read-only snippets, bounded layout reads and frame screenshots. macOS
discovers Pen.app; other installs configure an absolute command and args in
user-data/design-reference.json. It never parses raw Pen documents.

Generation plans, progress and acceptance records belong to the agent's local
working directory. Desktop MCP checks each operation's target, permissions and
current editor context. Model, layout and reference verifiers inspect explicit
inputs and write local reports without locking project navigation.

Optional `PLASMIC_MCP_METRICS=/absolute/private/metrics.jsonl` in the MCP process
records tool/operation, input/wire/text/image bytes and elapsed time without
payload text. RPC counts include verifier traffic; provider/cache token
usage must be read from the actual model client, not inferred from byte counts.

Run `npm test` for Desktop checks and `npx electron tests/reference-browser-native.cjs`
for actual Chromium selection, navigation, isolation and import integration.

## NAS updates and releases

Updates use `desktop.config.json`'s HTTPS `updateUrl`. Feeds are partitioned by
platform and architecture. macOS selects `darwin/arm64/` or `darwin/x64/`; an Intel
process running under Rosetta selects the native arm64 feed. GitHub is not contacted when checking, downloading or installing.
The application checks immediately at startup and every ten minutes, then downloads
new versions automatically in the background. Update controls mount only in explicit
page slots: beside the brand on the dashboard and CMS, after the editor's top-left brand capsule,
and in the preview toolbar. All download controls show only a progress ring.
Hover or keyboard focus shows the download percentage and version in a tooltip.
When the verified download finishes, the main window's Software Update dialog opens with
**Restart and Install** and **Later**. Choosing Later leaves a blue download icon.
Clicking the update control reopens the dialog; it does not restart the app directly. Update failures are logged locally and treated as no update; no error indicator or exception is displayed. Automatic checks continue every ten minutes. The dialog uses bundled local frontend
resources, a light appearance and isolated styles in the main document; it creates no
additional Electron window and works on the login page without a server request.
Closing the dialog leaves background downloads running. Installation remains in the
main process behind the validated main-frame IPC and saves the current design first.
On macOS, **Check for Updates…**
is in the Plasmic menu immediately below **About Plasmic**. Other platforms use
the **Updates** menu. These menus also work on the login page.
Development launches disable installation.

Desktop releases use `desktop-v<version>` tags. Set a higher stable version in
`package.json` and `package-lock.json`, pin the compatible Studio `webImage` in
`desktop.config.json`, and add `release-notes/<version>.md` with English notes and
`release-notes/<version>.json` with Markdown strings for `en`, `zh-CN`, `zh-TW`,
`ja` and `ko`. Distribution validation requires all five languages. Each platform
feed carries these strings in `localizedReleaseNotes`; the desktop selects the
active UI language and refreshes open release notes when that language changes.

Release notes contain the update body only. The dialog supplies the "What's new"
heading; do not repeat it in the Markdown file. Use `##` headings for subsections.

For a Studio frontend release, pin the new Studio image and bump Desktop in the
same commit, then push only the numeric Studio tag. The Studio workflow builds the
images before creating the Desktop tag and calling the installer workflow. Do not
push a second Desktop tag for that linked release. A backend-only Studio release
does not rebuild the App.

For a Desktop-only change, push the commit and Desktop tag:

```sh
git tag desktop-v0.0.23
git push origin master desktop-v0.0.23
```

The workflow compares production inputs with the previous Desktop tag and skips
unchanged releases. `.github/workflows/publish-desktop.yml` extracts the pinned Studio image once, then
builds macOS arm64 on Apple Silicon, macOS x64 on Intel, Windows x64 on Windows,
and Linux x64 on Linux. macOS installers and updates use only
`darwin/arm64/` and `darwin/x64/`; Rosetta launches select arm64.
Each native runner tests the desktop and packages its installer. The final job verifies
all installer sizes and SHA-512 hashes, copies installers and Electron update YAML
into `desktop/public/desktop-updates/`, and generates `latest.json` for the website.
The JSON contains the version, platform, architecture, size, SHA-512 and public HTTPS
download URL. Installers and manifests ship together in
`ghcr.io/shiguang-lab/plasmic-desktop-releases:desktop-v<version>`.

The two macOS jobs use ad-hoc signatures and require no certificate secrets,
private keys, fixed certificate fingerprint, or signing keychain. This applies
to both direct Desktop tags and the Studio workflow's reusable call. Packaging
still verifies the application signature, bundle identifier, CPU architecture,
and packaged runtime dependencies. The updater retains its signature, identity,
architecture, version, size and SHA-512 checks. The file-based sign-in lifecycle
acceptance runs on both macOS architectures before installers are packaged.
CI packages are for internal distribution; Developer ID signing and notarization
remain separate from this workflow. Local Apple Development signing is unchanged.

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

NAS deployment verifies the live JSON and all four installers and the two macOS ZIP update feeds. `DESKTOP_RELEASE_TAG`
selects the desktop image independently of the Studio/server `IMAGE_TAG`. The existing
`plasmic-desktop-updates` volume retains only the separate CLI/Skill resource route.
App releases do not rebuild or redeploy the Shiguang website or Studio backend.
Local packaging remains available for development; production installers come from Actions.
`npm run package:mac` builds for the current Mac architecture; `package:mac:arm64`
and `package:mac:x64` select an explicit architecture. Both independent builds
include a DMG for installation and a ZIP for automatic updates. Website release
JSON lists `mac-arm64`, `mac-x64`, `windows` and `linux` separately.

Clicking **Restart and Install** saves an open design before quitting; a failed save blocks
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

Startup checks the saved project's access before restoring its route and viewport.
Unavailable projects are removed from the saved history and open the dashboard.
Expired login sessions keep their saved route for sign-in continuation; network
or server failures open the dashboard without deleting history.

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
The client requests `web:session offline_access`. Its registered device session
policy expires after 30 days without use. The main process writes the rotating
refresh credential directly to `device-session.json` in its user-data directory
(`~/Library/Application Support/Plasmic Desktop/` on macOS). The file is plaintext,
uses mode `0600` on POSIX, and is replaced atomically when the credential rotates.
It is independent of the application version and signing certificate, so updates
reuse it. Desktop does not use the OS keychain or a system keyring for sign-in.
Access tokens remain in memory. The old encrypted `device-credentials` file is
not read or decrypted; existing Cookie sessions remain available, but a user
with only an expired session and an old encrypted credential must sign in once
to establish the JSON credential. Explicit sign-out or server-side authorization
expiry still ends the session. Opening or interacting with the App restores its short-lived
IAM cookie when needed. Background work can restore short cookies without
extending device authorization,
and no keep-alive timer runs while the App is closed or idle.
`npm run test:session-lifecycle` on macOS builds two isolated app versions with
different code hashes and Cookie encryption disabled. It exercises first launch,
PKCE login, restart with expired cookies, the real download/install/relaunch
updater, refresh-token rotation, and sign-out. IAM responses are supplied by a
local fixture; the test rejects any Electron secure-storage access. Reports are
written to `desktop-report/session-lifecycle/`, and macOS Actions runs the check
before packaging installers.
When a Studio API returns 401, Desktop checks IAM's `/api/auth/session`.
For an active user, a confirmed unauthenticated session first attempts silent
restoration and retries the failed request without navigating the editor. Only
when device authorization is absent or rejected does it open the sign-in page, preserving
the current route, query and hash for return after login. Concurrent failures share
one check. Resource permission errors and failed session checks retain their normal
error behavior. The sign-in page does not start browser authorization automatically.
Login navigation stops an unfinished page load before loading the sign-in page.
Startup waits for this replacement navigation, and workspace restoration cannot
replace it with the dashboard.
The registered HTTPS callback is `https://shiguanglab.com/auth/apps/plasmicapp/callback`.
Website displays the registered app's logo and automatically requests
`plasmic-desktop://oauth/callback`, with an **Open Plasmic Desktop** button as a fallback.
That link carries only the single-use code and state. The main process accepts a
callback only for its matching pending login, exchanges the code with its in-memory
PKCE verifier and consumes a one-use IAM web-session ticket. IAM sets its shared
HttpOnly cookie in Electron, then the app returns to the requested design.
The public page confirms browser authorization; the app reports whether session
establishment succeeded. Cancelling ends the pending request; retrying starts a new one.
The refresh credential stays in the main process and encrypted storage; it is
never exposed to the renderer. Account management opens the central `/account`
page. Sign-out revokes the device authorization, clears its cookie and removes
the saved refresh credential. The browser SSO session remains independent.

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

Packaged applications disable DevTools, Chromium remote debugging, Node inspector
arguments, `NODE_OPTIONS` injection and `ELECTRON_RUN_AS_NODE`. Development runs
retain debugging. AI clients use the registered MCP tools through `--mcp`.
On macOS, `npm run test:runtime-security` builds an isolated fixture to verify the
packaged restrictions and MCP startup. `npm run test:session-lifecycle` verifies
download, replacement, restart and cleanup without a remote debugging port.

## MCP

### Display modes

Closing the main window offers **Switch to Dynamic Island**, **Quit Plasmic** or **Cancel**, with **Remember this choice** checked by default. Remembering Dynamic Island also makes subsequent launches open directly in that mode, even after temporarily returning to the main window for editing. Dock activation and reopening the running app preserve the island. Change this preference under **View → When closing the main window**; choosing **Ask every time** restores the close dialog. Explicit Quit still exits the app.

The island hides the main window while its editor, native Preview and MCP remain running. Right-click the capsule or card for Show main window, Exit Dynamic Island mode and Quit application. Show main window keeps the island running and retains its startup preference; closing that main window returns to the island without a dialog. Exit Dynamic Island mode restores the standard window and clears a remembered island close/startup preference back to Ask every time. Quit application uses the normal shutdown flow. The floating surface has no window/mode icon. **View → Display mode** remains a secondary entry for Standard window, Full screen and Dynamic Island. The floating position is remembered locally.

The island starts as a compact capsule. Every tool invocation through the Desktop dispatcher expands the 420 × 136 card, including state queries. Queued and concurrent calls keep it open; after the last call finishes (success or failure), it collapses only after ten minutes without another call. Pointer hover also expands it and prevents expiry from collapsing it under the cursor; leaving has a 350 ms grace period. Hover does not renew the MCP idle timer. Internal metadata polling and captures do not count as calls. Page changes, loading and task-status metadata never independently choose the shape. Editing and native in-app Preview provide the current canvas; other pages show operation information and No canvas open. Loading clears old pixels and shows a loading placeholder. The capsule retains actual operation/task name, execution/result/error state, activity indicator and queued count; its tooltip includes the resource name, actual stage and error. Successful results briefly acknowledge completion; failures remain until a meaningful operation replaces them. The capsule handle opens the same context menu and also supports dragging. Read/write stages and actual errors come from the Desktop dispatcher; `report_task` adds the caller's actual task/stage and optional known plan. No tool-count progress is inferred.

The readonly mirror captures the current canvas viewport or native Preview, including existing cursor/inspection feedback, without invoking screenshot tools or modifying selection, zoom, pan or model state. It uses contain sizing to preserve aspect ratio. Multi-page/freeform arenas mirror the whole currently visible canvas viewport, including all visible artboards with their real spacing and offsets; it does not crop to the active page or change zoom to fit offscreen pages. Page/session changes clear the previous image; a failed capture of the same view labels its last image as Previous frame. Idle cards show the real project name, current page/canvas name, local Page and editable-component counts, Studio save status and either editor zoom or Preview viewport dimensions. Counts exclude registered code components and internal frame components. Native model metadata supplies these values without additional read tools; loading hides previous counts/save state. Active tasks, operations and errors replace the idle summary. Idle cards show no execution progress. Writes report Changes applied; only explicit successful saves report Saved.

The island draws readable feedback over the contained image using real operation targets: model UUIDs, frame identities and native Preview refs. Reads scan the inspected view or node; writes and interactions highlight their visible targets. Untargeted reads scan the current viewport. Offscreen/missing targets, dependency reads, failed calls and stale images do not produce target highlights. Running feedback follows the actual call; successful calls briefly acknowledge completion and then stop. Task reports alone never start scans. Geometry reads do not mutate or save the design, and reduced-motion mode uses static outlines.

Run `npm run test:island` for isolated native window, hidden capture, stdio MCP activity, ten-minute expiry, native hover, canvas route gating and mode-transition acceptance. Its deterministic editor is a fixture; full Studio acceptance requires a signed-in backend session.
Run `npm run test:close-mode` for real main-window close, remembered choices and cold/warm reopen acceptance across separate Electron processes.

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

Failed tool calls set `isError:true`; the JSON in `content[0].text` is
`{ "msg": "Tool call failed.", "detail": { "message": "Original exception" } }`.
Show the short `msg` in user-facing feedback. Inspect `detail` for the original
message, name, stack, cause, error code, execution status, context and recovery
steps when available. These diagnostic fields belong inside `detail`.
If `detail.__type` is `ResultReference`, retrieve it with
`read_result({resultId: detail.resultId})` and follow its pagination before
choosing recovery or retry. Retry a mutation only when
`detail.operationExecuted === false` or readback confirms its outcome.
The server also publishes these rules in MCP initialization `instructions`, so
AI clients receive the error contract when connecting. See the
[context and recovery contract](../ai/plasmic/references/desktop-context.md)
for a complete example.

The server provides these tools:

| Tool                                                      | Function                                                                                                  |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `get_app_state` | Compact status/buildId; view:tools lists operations, toolNames selects contracts, schemaView:full adds public output schemas |
| `get_build_info` / `get_image_service_status` / `get_editor_view` | Explicit build provenance, image-service availability and editor viewport reads |
| `get_org` / `list_orgs`                                   | Read an organization by ID or list accessible organizations with an optional name query                   |
| `create_org` / `open_org`                                 | Create an organization or open its dashboard                                                              |
| `create_workspace` / `list_workspaces` / `open_workspace` | Create, list or open workspaces; lists can be scoped to an organization                                   |
| `create_project`                                          | Create an empty project in a workspace or the account's personal workspace                                |
| `list_projects` / `open_design`                           | List accessible NAS projects, optionally in a workspace, and open a design                                |
| `read_skill` / `get_style`                                | Editing workflow and local palette/spacing presets                                                        |
| `execute` / `execute_batch`                               | Validated edits; a batch rolls back completely on failure and is one undo step                            |
| `read_result` | Read retained JSON/SVG/HTML results by path and pagination without rerunning operations |
| `snapshot_layout`                                         | Rendered desktop/mobile geometry and image load status                                                    |
| `get_screenshot`                                          | Clean static artboard WebP preview; `fullContent: true` captures expanded scroll content; `fullResolution` requests lossless pixels; `mode: "workspace"` captures the editor                                        |
| `import_image` / `read_image`                             | Import a local raster into NAS and read design image pixels                                               |
| `export_design` / `export_pages`                          | Static exports and ordered multi-page PDF                                                                 |
| `export_code`                                             | Editable React/TypeScript/CSS from NAS codegen                                                            |
| `capture_browser` / `reference_browser`                   | External reference WebP/DOM and read-only isolated browser CDP                                             |
| `import_reference`                                      | Explicit editable/raster import into an independent artboard                                                |
| `design_reference`                                      | Read-only Pen MCP frame layout, children and source screenshots                                              |
| `preview`                                               | Authenticated native Preview snapshots, user interactions and DOM assertions                                 |
| `search_stock_images`                                     | Commons images with license/source/attribution metadata                                                   |
| `vectorize_image`                                         | Local raster tracing to SVG paths                                                                         |
| `make_vector`                                             | SVG paths and union/intersection/subtraction/xor geometry                                                 |
| `generate_image`                                          | Configured Images generation/edit/background service                                                      |

Organization tools use `orgId`; the platform stores organizations as Teams and
returns team/teams identities only. Queries and creation whitelist identities,
hierarchy. No permissions, members, billing,
configuration, credentials or full-detail bypass is returned.
`list_orgs` accepts an optional `query` for
case-insensitive name matching. `create_org` requires `name`; the platform also
creates the organization's default workspace.

`create_workspace` requires `orgId` and `name`, with optional `description`.
`list_workspaces` accepts optional `orgId`; omitting it lists all accessible
workspaces. `open_workspace` requires `workspaceId`. Workspace creation reports
plan restrictions as errors even when the API returns HTTP 200.

Resolve the design target as Team → Workspace → Project. Look up requested names
or IDs in each selected parent's scope and reuse a unique match. If an item is
missing or ambiguous, show the scoped list for selection or authorized creation.
`list_projects({workspaceId})` lists only that Workspace's projects; omitting
the ID lists all accessible projects. Resolve the Project before `open_design`,
then verify its identity, readiness and edit permission before design writes.

`create_project` requires `name`, with optional `workspaceId`, and creates a
private project. Without a workspace ID, the platform uses the account's
personal workspace. It returns project identity; call `open_design` with
`project.id` to open the editor. Creation and query tools do not navigate or
save the active design. `open_org` and `open_workspace` check access before
saving the active editable design and opening their dashboard; a failed save
prevents navigation. All management tools use the signed-in Desktop session
and the platform's existing permission checks.

`get_app_state` supplies readiness, target/session/model identity, selection,
active operations and a buildId. view:tools lists operations; toolNames selects
input contracts without unrelated status. executeBatch discovery points to the
existing execute_batch envelope; read constituent contracts. schemaView:full
retains complete operation inputs and public output schemas. get_build_info
provides full provenance, get_image_service_status configured/model, and
get_editor_view a view snapshot for restoreEditorView. Public getEditorContext
excludes import destinations and viewport persistence; native UI persistence
and browser import flows retain their internal context.

Native read/queryElements tree projections contain structural node identities,
children and named slot references, without property values/styles/text. Component
tree reads expose tree and rootElementUuid. `view:"properties"` reads the target
node's values (the root for a component target); propNames limits instance values,
fields selects styles/attributes/text. Registered contract.props remains separate.
Inherited nodes retain editable:false and source slot identity. Full reads keep
canonical markup, rich text, expressions and interactions. Project dependencies
remain identity/version references; read each via fromProject; the verifier requests only Project identity,
components, canvases, pageFrames and devicePresets, while preserving complete Pages
and layouts in evidence files.

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

For inspection timeout diagnosis, run `node desktop/scripts/diagnose-inspection.cjs --profile /absolute/path/to/user-data --project-id PROJECT_ID --output /absolute/path/to/new-report-directory --rounds 3` from the repository root with the intended project already open. It records stage durations for direct targeted snapshots and immediate snapshots after navigation, with and without component targeting. It temporarily navigates pages and restores the editor view; it never saves or switches projects. Use an idle editor and retain `report.json`, including any failing stage, before changing retry/readiness behavior. A successful probe does not establish that intermittent timeouts cannot occur.

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
captures a WebP, reloads it from the NAS, and checks rejection of arbitrary code.
It adds a uniquely named page to the acceptance project. Reports and screenshots
are written to `PLASMIC_REPORT_DIR` (default `/tmp/plasmic-desktop-mcp-report`).

`pnpm run test:preview-navigation` runs an isolated Electron regression against a
local fixture server. It verifies recovery after navigation to a missing route
and a renderer Promise that never settles: Preview reaches its 30-second runtime
deadline, then queued close and read commands complete. It uses no NAS project or
credentials. Set `PLASMIC_REPORT_DIR` to retain its JSON result.

On macOS the bundle starts with `LSUIElement:true`, so a transport has no Dock
identity before JavaScript executes. Only the GUI process holding the single
instance lock promotes itself to a regular app. With one installed GUI running,
`pnpm run test:macos-activation` checks the bundle flag and observes macOS
activation policies during the discovery probe and initialized MCP startup.
`PLASMIC_APP_PATH` selects a bundle; `PLASMIC_REPORT_DIR` retains the trace.

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

The chosen service must implement JSON `/images/generations`, multipart `/images/edits`, and `data[0].b64_json` PNG output. Background removal requires transparency support. `get_image_service_status` reports whether it is configured, without returning credentials. No image service is enabled by default.
