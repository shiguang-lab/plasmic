# NAS image deployment

One numeric Git tag, such as `0.4.3`, starts `.github/workflows/publish-images.yml`.
Major/minor advances publish Studio images, Desktop, CLI and workflow resources.
Patch versions compare production inputs and publish only changed products:
backend-only changes publish Studio; frontend/shared renderer changes also publish
Desktop; CLI or thin Skill changes also refresh the resource bundle; references-only
changes publish resources. Documentation, tests and workflow-only changes publish
nothing. The workflow dispatch input `force-all` explicitly selects every product
for an existing numeric tag, including an unchanged patch.

The plan compares each product's source against the preceding numeric release,
using a more recent historical product tag as its initial comparison point when
necessary. Preview it with `node scripts/release-plan.mjs <tag>`; set
`RELEASE_FORCE_ALL=true` for the full plan. When Desktop is selected, its package
and lockfile version must equal the numeric tag and five-language release notes
must exist. Pin `desktop.config.json.webImage` to that tag when Studio is being
built, or to an existing Studio image for a Desktop-only patch.

CLI publication compares actual npm contents. Full releases publish the selected
version even if contents are unchanged. Resources wait for CLI publication and
reuse npm's verified original artifact; a resources-only patch reuses npm latest.
All jobs use one verified source commit. Desktop OS tests run alongside Studio
builds and are reused by the installer workflow only for the same commit.

After all selected jobs succeed, one GitHub Release is published under the numeric
tag. It contains selected products' installers, update ZIPs/blockmaps and resource
packages, plus all six public feeds: `desktop-latest.json`, `latest-mac-arm64.yml`,
`latest-mac-x64.yml`, `latest.yml`, `latest-linux.yml` and `plasmic-latest.json`.
Unchanged products reuse their preceding published feeds byte-for-byte, preserving
their product versions and download URLs without rebuilding or copying installers.
Studio image references appear in the notes.
Uploads are verified by size and SHA-256 before the draft becomes public. Ordinary
reruns reuse identical assets and reject different published bytes. An explicitly
forced tag update permits rebuilding the Desktop image and replacing Release
assets; npm versions and content-hash resource assets remain immutable. Rebuild
only versions not deployed on NAS. Publication advances GitHub latest only after
the feeds and resource assets pass verification; the fixed proxy follows it
automatically. It does not deploy NAS services.

If the final Release step fails after every build succeeds, manually run
`Publish existing release artifacts` with the numeric tag and the original
`Publish release` run ID. It verifies the tag's source revision and successful
build/test results, then publishes those artifacts with the current publisher.
This recovery workflow does not rebuild images or installers or deploy services.

The workflow uses `deploy/docker-bake.hcl` to build server/web/preview in one BuildKit
invocation: the shared builder runs once, then the image targets run concurrently.
Each image stores a `mode=max` registry cache at its GHCR `:buildcache` tag, so
intermediate layers can be reused across release tags. Keep these cache tags when
cleaning up registry versions. Dependencies are fetched into an image layer from
the five pnpm lockfiles before copying source; source-only edits reuse that layer.
The first build populates the cache. The temporary GitHub runner is discarded
without spending time deleting the BuildKit cache at job completion.

Validate release configuration without publishing:

```sh
docker buildx bake --file deploy/docker-bake.hcl --print
docker buildx bake --file deploy/docker-bake.hcl --check
node --test scripts/release-plan.test.mjs
node --test scripts/github-release.test.mjs scripts/release-downloads.test.mjs
node --test scripts/release-downloads.integration.test.mjs
```

The server target skips frontend bundling and copies the platform runtime
workspaces and built-in library sources plus the locally built SDK host package. The host
shares the server's React dependencies through NODE_PATH. The workflow uses the
built-in GITHUB_TOKEN with packages:write.
For a newly forked repository, enable Actions in the GitHub Actions tab first.
New GHCR packages are private by default. Make all three packages public for anonymous
NAS pulls, or log in on the NAS with a token that has read:packages.

Copy `compose.yml`, `nginx.conf`, `postgres-init.sql`, and `.env.example` to a NAS directory.
Rename `.env.example` to `.env`, set IMAGE_TAG to a published tag, and fill in the
origins and random secrets. Copy `platform/wab/tools/docker-dev/secrets.json` to
`secrets/plasmic.json` and replace its secret values for your deployment. Keep this
file and `.env` private; never commit deployment credentials.

For a new database only:

```sh
docker compose pull
docker compose up -d db storage
docker compose --profile init run --rm bootstrap
docker compose --profile init run --rm ai-bootstrap
docker compose up -d temporal server ai-worker preview web
```

Bootstrap runs migrations and creates business workspaces and component packages
for the existing IAM subject in `SG_BOOTSTRAP_SUB`. It refuses a populated database. Container restarts never seed
or truncate the database. Keep the canvas origin separate from the Studio origin. The S3 service uses
virtual-host bucket addresses; its storage domain and Docker network aliases must
match the endpoint hostname. The web health check waits for address injection and
Nginx startup.

For an existing deployment, back up the database and assets first. Change IMAGE_TAG,
then run migrations before starting the new server:

Set a separate random `TEMPORAL_POSTGRES_PASSWORD` in the private `.env`.
`ai-bootstrap` uses the existing database administrator to create only the
dedicated `temporal_ai` role/databases, assign their public schemas, install
`btree_gin` in visibility, and create the private `plasmic-ai-chat` bucket.
It is safe to repeat and does not seed or reset application data. Temporal stays
on the private Compose network; its health check gates AI Worker startup. The
Node images use Debian because Temporal's native SDK requires glibc.

Remove any local-image or source-file overrides from `compose.override.yml`
before upgrading. All three services must resolve to the published GHCR tag;
runtime source and component bundles are supplied by the release images.

```sh
docker compose pull
docker compose stop server preview web
docker compose run --rm server node_modules/typeorm/cli.js migration:run
docker compose --profile init run --rm ai-bootstrap
docker compose up -d temporal server ai-worker preview web
```

Component library versions also require immutable code artifacts before website
publication. Register new libraries with the generic `publish-library.ts` command.
Projects importing platform component libraries are upgraded to each new release
automatically; see [Platform component library upgrades](#platform-component-library-upgrades)
and the [component library publication instructions](../platform/preview/README.md#component-library-publication).

## Platform component library upgrades

Ant Design 6, Overseas, React UI, Ant Design Icons and libraries registered with
`publish-library.ts` are platform component libraries. Their projects live in the
`平台组件库` workspace, configured as the `hostLessWorkspaceId` dev flag. Every
project importing an older version is upgraded to the latest release the next time
it is opened, published as a website or exported; nobody upgrades projects by hand.
Upgrades keep the existing props, data bindings, interactions and styles. Settings of
a prop that the new release no longer declares are removed, so releases are checked
against real projects first. Ant Design 5 is retired: projects keep their installed
version. Studio design libraries keep the accept-update flow. Published websites keep
their published result until they are published again.

`nas-platform-libraries.ts` manages this. `status` is read-only and lists the
libraries, catalog corrections and every project revision or published version that
an upgrade changes, including settings it removes and conditions that block it.
`enable` creates the workspace (in a team without members), moves the libraries into
it, corrects the catalog and turns on automatic upgrades. It refuses blocked upgrades,
and requires `--accept-dropped-args` when settings would be removed. `upgrade` upgrades
all existing projects immediately through the regular bundle migrator, which saves a
backup of each previous model in `bundle_backup`. The server reads the setting at
startup, so keep it stopped while enabling.

### Enabling on an existing deployment

Do this once, after deploying an image that contains this command. Rehearse on a copy
of the database first; the copy needs the services using the database to be stopped.

```sh
docker compose stop server preview ai-worker
docker compose run --rm server node_modules/typeorm/cli.js migration:run
# Publish the latest library releases and correct their catalog entries.
docker compose run --rm server src/wab/server/nas-antd6.ts
docker compose run --rm server src/wab/server/nas-icons.ts
docker compose run --rm server src/wab/server/nas-react-ui.ts
docker compose run --rm server src/wab/server/nas-platform-libraries.ts status

# Rehearsal on a copy.
docker compose exec db createdb -U wab -T wab wab_rehearsal
rehearse() {
  docker compose run --rm --entrypoint sh server -c \
    'export DATABASE_URI="${DATABASE_URI%/wab}/wab_rehearsal"; exec plasmic-server "$@"' \
    sh src/wab/server/nas-platform-libraries.ts "$@"
}
rehearse enable                         # add --accept-dropped-args after review
rehearse upgrade
docker compose exec db dropdb -U wab wab_rehearsal

# Production.
docker compose exec -T db pg_dump -U wab -Fc wab > wab-before-platform-libraries.dump
docker compose run --rm server src/wab/server/nas-platform-libraries.ts enable
docker compose run --rm server src/wab/server/nas-platform-libraries.ts upgrade
docker compose up -d server ai-worker preview
```

`upgrade` exits with status 1 and lists each project it could not upgrade; those
projects would also fail to open. Fix the cause, or restore the dump, before starting
the server. Add `--report /plasmic/report.json` with a mounted volume to keep the
JSON report.

### Releasing a library update

Run the library registration commands (`nas-antd6.ts`, `nas-icons.ts`,
`nas-react-ui.ts` or `publish-library.ts`) with the server stopped, as above. When a
release removes or renames props, run the registration on a `wab_rehearsal` copy
first and check `status` there. Then run `upgrade` and start the server. Open Studio
sessions show the out-of-date banner and must reload before saving.

The server runs in development mode to retain the public-source self-hosting
behavior. The frontend uses a production build; `PLASMIC_SELF_HOSTED=1` allows
optional cloud analytics and billing build variables to remain unset. Versioned
static resources use immutable caching; HTML and unversioned entry points are
revalidated. Nginx compresses text resources before they cross the NAS relay.
Copy the current `nginx.conf` when upgrading; Compose mounts this deployment
configuration over the image default. Cloud hosting is separate and is not
provided by these images.

The server image and Compose environment set `PLASMIC_SELF_HOSTED=1`, matching
the frontend build. Self-hosted deployments have no subscription requirement:
organization creation, organization/project transfers, AI request quotas,
analytics, localization, experimentation, content editing roles, UI customization
and version history are available without plan limits. Capabilities are resolved
when serving API data; no paid subscription or feature tier is written to the
database. Resource authentication and role permissions still apply.

## Release download routing

Public Desktop and CLI/Skill downloads use Seoul Caddy to fetch GitHub Release
assets. Clients retain the existing Studio domain and `/desktop-updates/` paths.
Caddy handles GitHub latest's redirect to the numeric tag and the subsequent
signed redirect to `release-assets.githubusercontent.com` internally; clients
receive the file without a redirect. Upstream connections verify TLS.
Cookies, authorization and identity headers are removed before either upstream.
Only the explicitly registered public download paths accept GET, HEAD and OPTIONS.
Application, API, canvas and preview traffic continues through the NAS gateway.

Install the fixed rules once into a copy of the current relay Caddyfile:

```sh
node scripts/release-downloads.mjs /absolute/path/to/Caddyfile
```

No version or release state is stored in Caddy. Installer filenames contain their
numeric tag, so fixed platform rules derive the matching Release URL. The six
unversioned feed paths use GitHub `/releases/latest/download/<asset>`. Every real
release supplies all six, carrying unchanged product feeds forward without changing
their contents. A resource-only patch therefore retains the Desktop version;
a Studio-only patch retains both product versions.

CLI/Skill URLs contain a content hash instead of a version. Their fixed rule uses
the `plasmic-resources` Release with assets named `<releaseId>-manifest.json`,
`<releaseId>-plasmic-cli.tgz` and `<releaseId>-resources.json.gz`. The publisher
seeds historical numeric resource releases and appends new hashes there. Existing
hashes cannot be replaced, including during a forced numeric rebuild. This shared
Release is always published with `--latest=false`.

Before enabling these rules, run the current publisher for the latest numeric
release to fill missing feeds and seed the resource Release. The recovery workflow
can reuse its verified build artifacts. Subsequent releases need no Caddy edits,
reloads, server-local release files or NAS uploads.

The relay source lives at `shiguang/deploy/umami/Caddyfile`; the running copy is
`/home/ubuntu/umami-relay/Caddyfile` on SSH host `seoul`. Start from the running copy
when applying a change, preserve unrelated sites, back it up, validate the candidate
with the running Caddy image, and then reload Caddy. Write its bind-mounted file
in place. Check the public feeds, all file sizes, hashes, byte ranges and CORS after
the switch. A rollback restores the saved Caddyfile and reloads it.

Feeds use `no-store`; only successful versioned responses receive immutable caching. The proxy preserves
HEAD, Range, Content-Length and Content-Range. Caddy 2.10 requires an explicit `?`
on the internal signed-URL rewrite so the query remains intact. GitHub requests
include a per-request identifier to avoid reusing an expired cached redirect.
Both GitHub upstreams retry connection failures for at most ten seconds.

Download assets are hosted exclusively on GitHub Release. Missing assets return
404, and upstream failures are not redirected to NAS.

The integration test runs the actual publisher against a GitHub HTTP fixture and
the production Caddy version in Docker. It verifies successive Studio-only,
resources-only and Desktop-only releases with the same running configuration,
all six feeds, historical hashes, signed queries, HEAD, ranges, CORS, header
stripping, rejected redirects and missing-asset 404 responses. No GitHub credentials are needed.

## Product branding

Studio uses `platform/wab/public/favicon.svg` and `favicon.ico`. The mark matches
Studio's editor and dashboard. Shiguang Website uses the same mark in
`ZhijieMark` and `/assets/plasmic-app-mark.png`; the desktop OAuth registration's
`logoUrl` points to that PNG.

## Shared hosting package

Upstream commit cfd0a4c76d8669f191c27eebb7c78626b48b7532 moved the hosting
settings type out of ApiSchema.ts but omitted the new workspace package from the
public tree. `platform/shared/hosting` preserves the earlier favicon contract
(including optional mimeType) and adds that commit's textFiles map. This is a type
contract; it does not implement the cloud hosting API.

## Published websites

The preview service serves interactive published pages at
`plasmic-preview.shiguanglab.com`. See the [runtime and deployment instructions](../platform/preview/README.md)
for publishing, gateway routing, DNS/TLS and verification. Deploy all three images
and run migrations before starting preview.

## Public domains

For a deployment moving from the former multi-level domains, follow the
[domain deployment procedure](domain-migration.md), including private environment
files, database URLs and installed Desktop/CLI clients.

Studio uses https://plasmic-studio.shiguanglab.com and its canvas uses the separate origin
https://plasmic-canvas.shiguanglab.com. Configure both DNS A records to point to Seoul (43.133.249.44).
The shared relay config is maintained in `shiguang/deploy/umami`: HAProxy routes
SNI to Caddy on loopback ports 8454/8455, and Caddy forwards over Tailscale to
the access gateway on NAS port 3600. Its Plasmic routes forward to NAS ports
3900/3901. Caddy terminates HTTPS and supports WebSocket upgrades.
Nginx preserves the forwarded HTTPS protocol.

## Desktop update hosting

The public feeds and files are routed through the [Release download proxy](#release-download-routing).
The website offers independent Apple Silicon and Intel DMGs, with matching ZIPs
for in-app updates. Desktop deployment advances its download routes independently
of the NAS backend `IMAGE_TAG`. Missing GitHub files return 404. NAS does not host
Desktop or CLI/Skill downloads.

For an existing deployment, set `STUDIO_ORIGIN=https://plasmic-studio.shiguanglab.com`
and `CANVAS_ORIGIN=https://plasmic-canvas.shiguanglab.com` in the NAS `.env`.
Changing `.env` alone does not change persisted database URLs. Update
`defaultHostUrl` to `https://plasmic-canvas.shiguanglab.com/static/host.html` and
`codegenOriginHost` to `https://plasmic-studio.shiguanglab.com` in the dev flag
overrides, along with component catalog image URLs, project host URLs and asset
URLs that use these origins. Preserve external project hosts and unrelated URLs.
Apply the shared HAProxy/Caddy configuration and recreate server/web so their
environment and generated web assets use the new origins.

## Shiguang unified authentication

Studio redirects `/login?continueTo=...` to `https://shiguanglab.com/login?return_to=...`.
Account creation, passwords, email verification and profile editing belong to the
central website. The account link opens `https://shiguanglab.com/account`.
Plasmic stores project/team permissions against IAM `sub`, plus editor preferences
and business trial claims; it stores no account profile, password or login session.
Published applications' end-user directories and data-source OAuth connections are
separate business features and retain their own tables.

Deploy the matching `shiguang/auth-service` and `shiguang/access-gateway` changes.
Merge [gateway routes](shiguang-gateway-routes.json) into the gateway configuration;
do not replace other products' routes. The public `/api/v1/` route uses
`authenticate_public: true`: a shared cookie yields an RS256 assertion with
`typ=sg-identity+jwt`, issuer `https://shiguanglab.com`, audience `plasmic-api` and
entitlement `plasmic:access`. Anonymous loader/project-token requests remain public
and use Plasmic resource authorization. Static Studio and canvas files are public.
The gateway strips client-supplied identity headers and the shared session cookie.
BFF and WebSocket handshakes verify the JWT; browser writes check the Studio/canvas
origin. All external traffic must enter through the gateway.

Merge [Desktop OAuth registration](shiguang-oauth-client.json) into auth-service
`OAUTH_CLIENTS_JSON`. Keep existing clients. Register the exact HTTPS callback
`https://shiguanglab.com/auth/apps/plasmicapp/callback`, `logoUrl` and `appCallbackUrl`
from that policy. Website owns app authorization and callback pages; auth-service
owns registered app metadata, consent validation and token exchange. Desktop uses
S256 PKCE, scopes `web:session offline_access`, and a one-use IAM web-session
ticket to establish its Electron session. The `plasmicapp` registration opts in
to `sessionPolicy: {"type":"device","idleTimeoutSeconds":2592000}`. IAM issues
a device grant independent of the browser session and short-lived product
cookies; Desktop keeps its rotating refresh credential encrypted with the OS
credential store. Access tokens stay in memory. Device grants expire after
30 days without use; idle/background requests do not renew them. Clients without
this registration policy retain their existing browser-session lifetime.
Deploy auth-service with device-policy support and merge the registration before
shipping the Desktop build that requests `offline_access`. Existing credentials
retain their original lifetime; a new authorization establishes a device grant.
Add both Studio and canvas to auth-service `ALLOWED_RETURN_ORIGINS`, and grant
`plasmic:access` through the central entitlement policy. Existing explicit environment
values must be updated even though the service defaults now include Plasmic.

Set `SG_IDENTITY_API_URL` to the private auth-service address reachable from the
Plasmic container, and `SG_IDENTITY_API_TOKEN` to its `IDENTITY_API_TOKEN` service
credential. Server and bootstrap containers join the existing `shiguang-auth-edge`
network; on the NAS use `http://shiguang-auth-auth-service-1:8081`.
Directory APIs are POST `/v1/identity/users/batch-get` (`ids`, max 200),
`/v1/identity/users/by-email` (`email`, exact verified active account), and
`/v1/identity/users/query` (`query`, bounded admin search). The batch profile contains
`id`, `loginName`, `displayName`, `email`, `emailVerified` and `state`.
Set `SG_IDENTITY_JWKS_URL` to the private auth-service signing-key endpoint
`http://shiguang-auth-auth-service-1:8081/.well-known/jwks.json` on the NAS,
using the same auth-edge network as the identity directory. This avoids routing
server-side verification through the public relay. The public endpoint is
`https://shiguanglab.com/.well-known/sg-identity-jwks.json` for external consumers.
Use `INTEGRATION_SESSION_SECRET` solely for ten-minute external data-source OAuth
state. Browser sign-out is POST
`/api/auth/logout` on Studio, routed directly to IAM; it signs out the shared
browser session. A device cookie signs out only its device grant.

Before migrating an existing database, back it up and explicitly set
`SG_LEGACY_USER_MAPPING` to a JSON object mapping **every local user ID** to a
**existing IAM sub**, for example `{"local-id":"iam-sub"}`. Inspect this
mapping as an ownership decision; migration never infers it from email addresses.
Multiple old IDs may map to one IAM subject. The account with the matching IAM email
provides personal-team designation, editor preferences and a conflicting data-source
connection; other teams and projects keep their IDs and ownership permissions.
Trial claims retain the earliest date.
The NAS [user mapping](shiguang-user-mapping.json) assigns its two existing accounts
to the verified IAM account `yanxianliang` (`382914060758286339`). Set
`SG_BOOTSTRAP_SUB` to that subject and `SG_LEGACY_USER_MAPPING` to this JSON object.
The migration stops before deleting accounts if the mapping is missing, incomplete
or refers to unknown subjects. It updates business foreign-key values, retains editor
preferences and trial claims, removes local account/password/email-verification/SSO/
sign-up/session tables and obsolete login OAuth tokens. Only Airtable and Google Sheets
OAuth connections remain. Account deletion cannot be reversed by a down migration;
rollback requires restoring the backup. Do not run ORM schema synchronization on an
existing deployment. Empty databases need no legacy mapping.

Rebuild Desktop and the web/server images together before distributing this release.
External Google Sheets and Airtable integrations continue to use their callback URLs
on the Studio origin; configure those integration clients accordingly.

## Ant Design 5 and 6

The images include `@shiguang-lab/plasmic-antd6` and the antd6 canvas bundle.
After deploying the images, add the library to an existing database:

```sh
docker compose run --rm server src/wab/server/nas-antd6.ts
```

This registers both versions and publishes changed Ant Design 6 registrations into the existing library. It updates
the catalog while preserving other entries and dev flags, and restores the
default Plume and HTML entries if missing. Design systems shows one cover card
per version; Ant Design lists components grouped under Ant Design 5 and Ant
Design 6. Reload Studio after running the command. Re-running refreshes the
catalog without creating duplicate libraries. Existing projects receive new Ant Design 6 and Overseas releases automatically; see [Platform component library upgrades](#platform-component-library-upgrades).

The registration package is distributed with the web image. For a separate
Codegen or Loader application, install it before syncing/rendering components:

```sh
npm install https://plasmic-studio.shiguanglab.com/static/packages/shiguang-lab-plasmic-antd6-0.0.1.tgz
```

## AI prototype editing

Studio exposes `window.PLASMIC_AI_TOOLS` on an open, authorized project after its
host frame connects. Connect an AI client through the Desktop MCP and install
the thin [`plasmic` skill](../ai/plasmic/README.md). The AI client's
model generates designs through the same Studio operations used by the built-in Web assistant.

### Built-in Web local editing

Enable `enableLocalAiEditing` through the existing server devflag configuration;
it defaults to false. Reload Studio after enabling it. The canvas composer and
AI shortcut open the same browser assistant. No Electron, Desktop MCP process,
local RPC socket or App login is required.

Configure an OpenAI-compatible service in the server's `PLASMIC_SECRETS_FILE`:

```json
{
  "localAiEditing": {
    "baseUrl": "https://YOUR_AI_SERVICE/v1",
    "apiKey": "YOUR_SERVER_SIDE_KEY",
    "model": "YOUR_TOOL_CALLING_MODEL"
  }
}
```

Preserve other fields in that file, keep it outside Git, and restrict its file
permissions. `PLASMIC_AI_BASE_URL`, `PLASMIC_AI_API_KEY` and `PLASMIC_AI_MODEL`
override those three fields. Use HTTPS except for local HTTP test services.
The browser status endpoint returns configuration status and model name only.

The assistant binds the project, branch, editor session, change counter, page,
artboard and selected subtree at submission. Read, selection and scroll tools
use the existing Studio contracts. Local writes permit element changes,
insertion and deletion; related operations can form one atomic `executeBatch`.
Plain native text uses `changeElement.text`, preserving node identity. Reads
show the existing blue activity scan, edits the purple scan, and selection uses
the native selection outline. Registered component contracts remain English.

Stale context and out-of-scope writes are rejected again inside the transaction,
after asynchronous HTML preparation. The assistant and external MCP share the
browser edit queue. Local JSON responses do not change an external agent's
preferred XML serialization. Stop aborts the model request and skips queued
operations; an already executing transaction completes or rolls back normally.
Completed edits remain in Studio and may already have been automatically saved.

The browser panel records progress, actual before/after subtree models, errors
and confirmed saved revisions. It checks model structure before explicitly
confirming save; it does not claim visual or Preview interaction acceptance.
Undo is available for the latest unchanged transaction and refuses to overwrite
intervening edits. Task history is retained in browser memory while navigating
or reopening the panel; reload clears it. Reloading or closing the editor stops
execution, and continuing requires a new request with fresh context. The local
editing scope does not create pages, install libraries, change global tokens,
connect business APIs or publish designs.

The model loop has a 12-step limit, a 90-second provider request timeout and a
three-minute task budget. Provider requests are not automatically retried;
duplicate tool-call identities within a task reuse the recorded result.
Provider error bodies are not returned to the browser because they may contain
credentials or request data.

For comparison, pen.dev exposes current document/selection state plus native
read/write operations through its [editor tools](https://docs.pen.dev/for-developers/pen-cli).
Figma exposes [page selection](https://developers.figma.com/docs/plugins/api/PageNode/#selection)
and [viewport operations](https://developers.figma.com/docs/plugins/api/figma-viewport/).
The Web assistant follows this separation of view operations and document
mutations using Studio's own tools and selection contracts.

Implementation verification on 2026-10-12: 94 tests in ten relevant suites,
targeted ESLint, Studio and Preview production builds passed. Browser testing
used the production dialog with controlled editor/API fixtures; a separate
live-provider test completed selection, text editing and summary against
synthetic tool results. [Verification data](../docs/prototype-acceptance/local-ai-editing/verification.json)
and [browser fixture screenshot](../docs/prototype-acceptance/local-ai-editing/web-completed-fixture.png)
record those boundaries. Authenticated project save/reopen through the new Web
UI has not been verified. Full WAB typecheck reports nine diagnostics in
unchanged files and no diagnostics in the changed files; it is not a passing
repository typecheck. Deployment and authenticated persistence acceptance are
separate checks from this implementation verification.

The authenticated Web acceptance runner uses the built-in AI composer and the
actual configured model. It creates a separate acceptance page in the specified
project, verifies an edit after save/reopen, then verifies a second edit after
undo/save/reopen. It checks the original node UUID and persisted text and writes
screenshots and a machine-readable report. It does not use Desktop or mocked
editor/model responses:

```sh
PLASMIC_ENV_FILE=/private/path/acceptance.env \
PLASMIC_PROJECT_ID=<acceptance-project-id> \
PLASMIC_PLAYWRIGHT_PATH=<installed-playwright-module-path> \
PLASMIC_REPORT_DIR=./local-ai-web-report \
node deploy/verify-local-ai-web.cjs
```

The private env file supplies `STUDIO_ORIGIN` and an IAM-issued `SG_SESSION`.
Alternatively use `STUDIO_ORIGIN` with a private `PLASMIC_STORAGE_STATE` file.
The target must run the AI changes with `enableLocalAiEditing` enabled and the
server model configured. `PLASMIC_E2E_DEVFLAGS=1` uses the existing test flags;
it does not bypass authentication or project permissions. The created page is
retained for inspection. A passing runner report is required before claiming
authenticated persistence acceptance.

Tools read the installed component contracts and use Studio's model operations,
permissions, transaction rollback and undo. Use Ant Design 6 registered props;
invalid props or HTML import errors fail the call. `save` confirms persistence
and returns the project revision. `validate` reports structural correctness and
component usage; screenshots and task-specific behavior still need review.

Run the fixed tool-chain acceptance scenario in a NAS container with Playwright
and Chrome installed:

```sh
PLASMIC_ENV_FILE=/run/plasmic.env \
PLASMIC_PROJECT_ID=YOUR_ACCEPTANCE_PROJECT_ID \
PLASMIC_PLAYWRIGHT_PATH=/verify/runtime/playwright-core \
PLASMIC_CHROMIUM_PATH=/verify/runtime/chromium-1080/chrome-linux/chrome \
PLASMIC_REPORT_DIR=/verify/ai-prototype-report \
node /verify/verify-ai-prototype.cjs
```

Use a private acceptance env file containing `STUDIO_ORIGIN` and an IAM-issued
`SG_SESSION`. Mount it read-only. Use an acceptance project owned by that IAM user and with Ant Design 6 already installed. The scenario adds
uniquely named pages, never replaces existing pages, and leaves them saved for
review. Its transcript and screenshots are stored in the report directory. It
checks the browser/editor tool chain; evaluate model generation quality separately
with natural-language requests through the AI client.

## Overseas business components

The NAS `nas-antd6.ts` registration command also publishes the independent Overseas library from `@shiguang-lab/plasmic-overseas`. AppShell is listed in Overseas with a thumbnail. Ant Design 6 retains its General, Layout, Navigation, Data Entry, Data Display, Feedback and Other sections, with static subcomponents grouped under their parent.

MCP `installLibrary` installs the published Overseas project; `upgradeLibrary` refreshes an installed library. Read exact contracts before inserting `plasmic-overseas-app-shell`, and save explicitly. Previously published Ant Design AppShell contracts are hidden in the catalog to preserve saved revisions; new page instances belong to Overseas.

## Ant Design Icons

The images include the independent `antd-icons` hostless canvas and server bundles.
After deploying, register its library and Component Store card:

```sh
docker compose run --rm server src/wab/server/nas-icons.ts
```

The command creates or updates only Ant Design Icons and its catalog entry, within
one transaction. Re-running preserves other libraries and dev flags and reuses
the existing icons library. Component Store → Icons shows one `@ant-design/icons`
preview card with the standard install action. Installation adds **Ant Design Icons**
to Installed. Its components use the standard thumbnail cards and are grouped by
Outlined, Filled and Two Tone. Additional icon libraries each have their own
Installed entry. No icon library is injected into every project, and the original
top-level Icons entry continues to show project SVG assets.

## React UI business components

React UI is an independent hostless library from `@shiguang-lab/plasmic-react-ui`.
The default host and Overseas do not register its ActionGroup. After deploying,
register its project and catalog card:

```sh
docker compose run --rm server src/wab/server/nas-react-ui.ts
```

Component Store → Business components lists React UI beside Overseas. Installing
the card adds React UI to Installed. The command updates only this library and its
catalog entry, preserving other flags and reusing an existing library project.
The vendored source scope is documented in [vendor/react-ui](../vendor/react-ui/README.md).

### Built-in Host cache

The Web container requires both `STUDIO_ORIGIN` and `CANVAS_ORIGIN`. Startup configuration renders these origins, recomputes the content hash of the built-in Host HTML, and updates its compiled references before Nginx starts. Deploy the updated Compose and Nginx configuration with the Web image. Only `host.<sha256>.html` uses immutable HTML caching; the stable Host and Studio entry stay updateable. Retain immutable files needed by already-open builds.
