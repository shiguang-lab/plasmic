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
revalidated. Cloud hosting is separate and is not provided by these images.

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

## Ant Design 6

The images include `@shiguang-lab/plasmic-antd6` and the antd6 canvas bundle.
After deploying the images, add the library to an existing database:

```sh
docker compose run --rm server src/wab/server/nas-antd6.ts
```

This creates and publishes the component library and adds its entry to the
design-system catalog while preserving existing projects and dev flags. Running
it again leaves the installed library unchanged. Reload Studio and install
**Ant Design 6** from the component library panel.

The registration package is distributed with the web image. For a separate
Codegen or Loader application, install it before syncing/rendering components:

```sh
npm install https://plasmic.studio.publib.cn/static/packages/shiguang-lab-plasmic-antd6-0.0.1.tgz
```
