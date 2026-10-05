# NAS image deployment

Release tags use version numbers starting at `0.0.1` (without a `v` prefix).
Pushing a new Git tag runs `.github/workflows/publish-images.yml` and publishes
`ghcr.io/shiguang-lab/plasmic-server:<tag>` and
`ghcr.io/shiguang-lab/plasmic-web:<tag>` for Linux amd64.
The workflow publishes server/web through one matrix step, with separate mode=min
GHA caches. The server target skips frontend/canvas bundling and copies only the
platform runtime workspaces. It uses the built-in GITHUB_TOKEN with packages:write.
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

Bootstrap runs migrations and creates the initial administrator, workspace and
component packages. It refuses a populated database. Container restarts never seed
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

Studio uses https://plasmic.studio.publib.cn and its canvas uses the separate origin
https://plasmic.canvas.publib.cn. Both DNS A records point to Seoul (43.128.155.40).
The shared relay config is maintained in `shiguang/deploy/umami`: HAProxy routes
SNI to Caddy on loopback ports 8454/8455, and Caddy forwards over Tailscale to
NAS ports 3900/3901. Caddy terminates HTTPS and supports WebSocket upgrades.
Nginx preserves the forwarded HTTPS protocol.

For an existing database, changing .env alone does not change the stored
`defaultHostUrl` and `codegenOriginHost` dev flag overrides. Update those values
along with STUDIO_ORIGIN and CANVAS_ORIGIN before restarting server/web.

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
npm install https://plasmic.studio.publib.cn/static/packages/shiguang-lab-plasmic-antd6-0.0.1.tgz
```

## AI prototype editing

Studio exposes `window.PLASMIC_AI_TOOLS` on an open, authorized project after its
host frame connects. Connect an AI client through Chrome DevTools MCP and use
[`plasmic-prototype`](../ai/skills/plasmic-prototype/README.md). The AI client's
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

Mount the private deployment `.env` read-only. Use an acceptance project owned by
the configured admin and with Ant Design 6 already installed. The scenario adds
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
