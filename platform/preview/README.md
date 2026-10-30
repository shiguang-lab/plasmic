# Published websites

`plasmic-preview.shiguanglab.com` serves public, interactive published pages without
Studio controls. Set `PREVIEW_ORIGIN=https://plasmic-preview.shiguanglab.com` in the
NAS `.env`. Run the database migration and deploy matching server, web and preview
images. The server advertises the configured origin to Studio on existing databases;
bootstrap is not needed for an upgrade.

In Studio or Desktop, open **Publish → Published website** from any arena. Choose
an entry page and click **Publish website** or **Update website**. This saves current
changes and creates a project version when needed before building the website;
it also works for projects that have never published a version. Use **Copy link**
to share the result. Select **Update website when publishing a version** to include
the website in the dialog's main **Publish** action.
The link has the form `https://plasmic-preview.shiguanglab.com/s/<code>` and stays at `/s/<code>#/<page-path>`. The fragment contains the design page path,
business query parameters and optional anchor; the server resolves only the publication code. Updating the website keeps that link. **Unpublish website**
disables the public routes and removes the stored bundle; republishing reuses the link.

Studio's publishing pipeline saves the project version, then updates a selected
website. Draft saves never update it. If website generation fails, the previous
website remains available and the dialog displays the error; **Update website**
retries with current editor changes. Saving or version publication failures stop
website publication. Branch versions are not published here.
Publishing through the API requires an editor role and a separate POST to
`/api/v1/projects/<projectId>/preview-publication`, with optional `entryPath`.
GET returns metadata to viewers and DELETE unpublishes for editors.

The shared Next.js runtime reads `preview_publication`, including the pinned
browser Loader bundle. It never reads project revisions or evaluates published
code on the server. Hostless libraries are resolved recursively from the published Project dependency
versions. Each version must have an immutable code artifact; a missing version
fails publication without changing the previously published website. Artifacts
include resolved source modules, transitive dependencies, CSS/assets, a checksum,
and editor/server registrations. The existing Loader pipeline compiles them together,
sharing identical dependency modules and React contexts. Build cache keys include
artifact digests. Publishing never installs npm packages or reads a newer library
from the server environment. Custom components registered only in a separate application host
require their own runtime and are rejected with an explicit publishing error.
Page links and navigation actions share the business URL resolver with Studio previews, preserving
business routes, dynamic parameters and query strings. Browser interactions use
the actual compiled components. Published Loader requests and prefill use the same
artifact resolution, so Studio's version publication can finish before website publication. Existing data services retain their own access rules.

The external route is HAProxy SNI → Caddy on loopback 8456 → NAS access gateway
3600 → NAS Nginx 3902 → preview 3011. Merge the preview entry in
[`shiguang-gateway-routes.json`](../../deploy/shiguang-gateway-routes.json) into the
gateway routes and apply the shared `shiguang/deploy/umami/Caddyfile` and
`haproxy.cfg`. The route is public and does not forward session cookies,
authorization or gateway identity. Nginx also removes cookies and authorization.
Caddy uses the HTTP-01 ACME challenge through HAProxy port 80 and its loopback
HTTP listener on port 8088.

Add a DNS **A** record for `plasmic-preview.shiguanglab.com` pointing to
**43.133.249.44**. Cloudflare proxying is supported; allow the HTTP-01 challenge
path through the edge to the origin.
After DNS resolves and the relay config is active, Caddy obtains the certificate
automatically. Test `/api/healthcheck` and a published short link over HTTPS.

Local verification uses a disposable PostgreSQL database named `plasmic_preview_test`:

```sh
cd platform/preview
pnpm test
pnpm build
DATABASE_URI=postgresql://postgres:password@localhost:5432/plasmic_preview_test pnpm start
# In another terminal, with Playwright Chromium installed in platform/wab:
PREVIEW_TEST_DATABASE_URI=postgresql://postgres:password@localhost:5432/plasmic_preview_test \
  node tests/published-website.e2e.mjs
```

The browser scenario applies the real table migration and checks short links,
styles, forms, tabs, overlays, page links, navigation actions, dynamic route
refresh, business queries, draft isolation, updates, unpublish and project deletion.
To include the actual Overseas AppShell and React UI ActionGroup, first run
`preview-libraries.test.ts` from `platform/wab` with
`PREVIEW_TEST_LIBRARY_BUNDLE=/tmp/preview-libraries.json`, then pass that same
environment variable to the browser scenario. The library test requires the normal
root `pnpm setup` builds, including Loader's internal noop registration package.

## Component library publication

Run the `1791417600001-AddHostlessLibraryVersion` migration with the other migrations.
The `hostless_library_version` table binds a code artifact to `pkg_version.id`.
Library publication with `PREVIEW_ORIGIN` configured saves the metadata and code
artifact together. Code or transitive dependency changes publish a new library
version even if the component prop metadata is unchanged. Existing artifacts are
never overwritten. Libraries in the platform library workspace (`hostLessWorkspaceId`)
upgrade every importing Project to the new version the next time it is loaded; a
published website keeps its result until it is published again. See
[Platform component library upgrades](../../deploy/README.md#platform-component-library-upgrades).

New libraries use one administrator command; no preview dependency list, canvas
entry file or Dockerfile change is required. The package must export `registerAll`
(or the configured `registerCalls`) and register real component/context metadata,
including resolvable `importPath` and export names. Props/slots/events continue to
use that registration contract. App-host-only source files must first be packaged.

Example configuration saved as `library.json`:

```json
{
  "name": "business-ui",
  "displayName": "Business UI",
  "packages": { "@your-company/business-ui": "1.2.3" },
  "cssImport": ["@your-company/business-ui/styles.css"],
  "minimumReactVersion": "18.0.0"
}
```

From `platform/wab`, with the normal database/preview environment configured:

```sh
bash tools/run.bash src/wab/server/db/publish-library.ts /absolute/path/library.json
```

The command installs the exact packages in a temporary source environment with
install scripts disabled, builds and validates their browser module graph, creates
or updates the hostless library project and catalog, and stores its fixed code
artifact in the same database transaction. A compiled local package can be supplied
as `file:/absolute/path/library.tgz`; registry credentials use the operator's normal
npm configuration. `moduleRoot` can point to an existing built workspace containing
`node_modules`; configured exact package versions must match the installed manifests.
For example, current NAS libraries can use `/plasmic/platform/canvas-packages` with
`@shiguang-lab/plasmic-overseas`, `@shiguang-lab/plasmic-react-ui` or
`@shiguang-lab/plasmic-antd6`, all currently `0.0.1`.

Studio loads these libraries' registration scripts from
`/api/v1/hostless-libraries/<name>/canvas?version=<Project-dependency-version>&pkgId=<package-id>`.
Access is checked against the library project; only browser registration code is
returned, with the package ID, version and browser-source SHA-256 bound in the
`X-Plasmic-Library-Release` response header. Consumer projects require an exact
dependency release. Library authoring resolves a concrete release through
`/api/v1/hostless-libraries/<name>/release` before using the same code path.
Desktop caches these immutable bodies without network revalidation; project
permissions and automatic library upgrades still run on the server. Dependency
models use the content-hash negotiation described in
[Desktop libraries](../../desktop/README.md#versioned-component-libraries).
Reopen Studio after catalog registration so its library catalog refreshes.

Ordinary registration, Props/Slots, wrapper and bundled-style updates use this
publication command independently of the numeric App release pipeline. Publish
the exact npm version or compiled tarball to the target backend; rebuilding the
App is not a substitute. The matching Desktop loader/backend must be installed
once. Changes to shared Antd/React or the editor protocol still require an App
release. Existing platform-library automatic upgrade rules remain in effect.

For a library version created before artifact storage existed, an administrator
can explicitly attach its matching code once:

```sh
bash tools/run.bash src/wab/server/db/publish-library.ts /absolute/path/library.json --snapshot 0.0.1
```

Use the sources/packages that belong to that exact historical version, specifying
`projectId` when it is not already in the catalog. The command rejects overwriting
an existing artifact. The system never guesses historical code from the latest
installed package. Platform libraries do not need this: their Projects are upgraded
to the latest version, which has an artifact.

To verify the generic npm/tarball registration lifecycle against the disposable
`plasmic_preview_test` database, run from `platform/wab`:

```sh
DATABASE_URI=postgresql://postgres:password@localhost:5432/plasmic_preview_test \
PREVIEW_ORIGIN=https://plasmic-preview.shiguanglab.com \
bash tools/run.bash src/wab/server/db/publish-library.e2e.ts
```

It applies the real migrations, seeds the real Plume metadata needed for library
updates, registers a previously unknown local npm tarball through the generic
command, changes its implementation/Props/Slots, verifies preserved component
identity, checks unchanged-release deduplication and refuses artifact overwrite.
It then serves real package/code routes over HTTP through the Desktop cache and
checks exact/latest selection, code/definition alignment, restart hits and old
version restoration. Warm loads make zero code requests and transfer no cached
model bodies; package permission/version requests continue. This is a disposable-database test; its library/Plume records
remain until that database is removed.
