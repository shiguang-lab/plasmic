# NAS image deployment

Release tags use version numbers starting at `0.0.1` (without a `v` prefix).
Pushing a new Git tag runs `.github/workflows/publish-images.yml` and publishes
`ghcr.io/shiguang-lab/plasmic-server:<tag>` and
`ghcr.io/shiguang-lab/plasmic-web:<tag>` for Linux amd64.
The same stable numeric tag also runs `.github/workflows/publish-plasmic-cli.yml`,
publishing a matching CLI version to npm and references/CLI artifacts to NAS.
See [release setup and version checks](../ai/plasmic/README.md#tag-自动发布).
The workflow publishes server/web through one matrix step, with separate mode=min
GHA caches. The server target skips frontend/canvas bundling and copies the
platform runtime workspaces plus the locally built SDK host package. The host
shares the server's React dependencies through NODE_PATH. The workflow uses the
built-in GITHUB_TOKEN with packages:write.
For a newly forked repository, enable Actions in the GitHub Actions tab first.
New GHCR packages are private by default. Make both packages public for anonymous
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
docker compose up -d server web
```

Bootstrap runs migrations and creates business workspaces and component packages
for the existing IAM subject in `SG_BOOTSTRAP_SUB`. It refuses a populated database. Container restarts never seed
or truncate the database. Keep the canvas origin separate from the Studio origin. The S3 service uses
virtual-host bucket addresses; its storage domain and Docker network aliases must
match the endpoint hostname. The web health check waits for address injection and
Nginx startup.

For an existing deployment, back up the database and assets first. Change IMAGE_TAG,
then run migrations before starting the new server:

Remove any local-image or source-file overrides from `compose.override.yml`
before upgrading. Both services must resolve to the published GHCR tag;
runtime source and component bundles are supplied by the release images.

```sh
docker compose pull
docker compose stop server web
docker compose run --rm server node_modules/typeorm/cli.js migration:run
docker compose up -d server web
```

The server runs in development mode to retain the public-source self-hosting
behavior. The frontend uses a production build; `PLASMIC_SELF_HOSTED=1` allows
optional cloud analytics and billing build variables to remain unset. Versioned
static resources use immutable caching; HTML and unversioned entry points are
revalidated. Nginx compresses text resources before they cross the NAS relay.
Copy the current `nginx.conf` when upgrading; Compose mounts this deployment
configuration over the image default. Cloud hosting is separate and is not
provided by these images.

## Shared hosting package

Upstream commit cfd0a4c76d8669f191c27eebb7c78626b48b7532 moved the hosting
settings type out of ApiSchema.ts but omitted the new workspace package from the
public tree. `platform/shared/hosting` preserves the earlier favicon contract
(including optional mimeType) and adds that commit's textFiles map. This is a type
contract; it does not implement the cloud hosting API.

## Public domains

Studio uses https://studio.plasmic.shiguanglab.com and its canvas uses the separate origin
https://canvas.plasmic.shiguanglab.com. Configure both DNS A records to point to Seoul (43.128.155.40).
The shared relay config is maintained in `shiguang/deploy/umami`: HAProxy routes
SNI to Caddy on loopback ports 8454/8455, and Caddy forwards over Tailscale to
the access gateway on NAS port 3600. Its Plasmic routes forward to NAS ports
3900/3901. Caddy terminates HTTPS and supports WebSocket upgrades.
Nginx preserves the forwarded HTTPS protocol.

## Desktop update hosting

The web container mounts the NAS Docker volume `plasmic-desktop-updates` read-only
at `/srv/desktop-updates`. This avoids shared-folder ACL restrictions on Nginx workers.
`/desktop-updates/<platform>/<arch>/latest*.yml` serves uncached update manifests;
versioned ZIP, DMG, NSIS, AppImage and blockmap files use immutable caching and
support ranged downloads. Missing files return 404; directory listing and writes
are disabled. Desktop updates do not require changing the NAS backend image tag.

Run `npm run setup:nas-updates` from `desktop` to configure an existing NAS deployment,
then `npm run release -- darwin universal` to build and publish a new desktop version.
See [desktop release instructions](../desktop/README.md#nas-updates-and-releases)
for versioning, other platforms and installation behavior.

For an existing deployment, set `STUDIO_ORIGIN=https://studio.plasmic.shiguanglab.com`
and `CANVAS_ORIGIN=https://canvas.plasmic.shiguanglab.com` in the NAS `.env`.
Changing `.env` alone does not change persisted database URLs. Update
`defaultHostUrl` to `https://canvas.plasmic.shiguanglab.com/static/host.html` and
`codegenOriginHost` to `https://studio.plasmic.shiguanglab.com` in the dev flag
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
`OAUTH_CLIENTS_JSON`. Keep existing clients. The loopback redirect URI is
`http://127.0.0.1/callback`; IAM accepts the ephemeral loopback port. Desktop uses
S256 PKCE, scope `web:session`, and a one-use IAM web-session ticket to establish
its Electron session. It does not persist OAuth access or refresh tokens.
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
Use `SG_IDENTITY_JWKS_URL` for signing keys and `INTEGRATION_SESSION_SECRET` solely
for ten-minute external data-source OAuth state. Browser sign-out is POST
`/api/auth/logout` on Studio, routed directly to IAM; it signs out the shared session.

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
catalog without creating duplicate libraries. Existing projects upgrade their installed library through the desktop MCP `execute` → `upgradeLibrary` with the library project ID, then `save`; `read` confirms the new component contracts.

The registration package is distributed with the web image. For a separate
Codegen or Loader application, install it before syncing/rendering components:

```sh
npm install https://studio.plasmic.shiguanglab.com/static/packages/shiguang-lab-plasmic-antd6-0.0.1.tgz
```

## AI prototype editing

Studio exposes `window.PLASMIC_AI_TOOLS` on an open, authorized project after its
host frame connects. Connect an AI client through the Desktop MCP and install
the thin [`plasmic` skill](../ai/plasmic/README.md). The AI client's
model generates designs; this does not enable the official cloud Copilot chat.
No model key is stored in the NAS deployment.

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
