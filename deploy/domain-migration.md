# Plasmic domain deployment

| Service | Public origin |
| --- | --- |
| Studio/API/Desktop updates/CLI resources | `https://plasmic-studio.shiguanglab.com` |
| Canvas | `https://plasmic-canvas.shiguanglab.com` |
| Published websites | `https://plasmic-preview.shiguanglab.com` |

Cloudflare DNS, edge certificates and proxy settings are managed separately.
This procedure does not change project IDs, node IDs, routes, IAM subjects, OAuth
client IDs, Tailscale addresses or component contracts.

## Prepare

Publish the server/web/preview images, Desktop installers, CLI and workflow
resources from the changed sources using their independent release procedures.
Desktop must regenerate its bundled assets from the new configuration before
packaging. The website, auth-service and access-gateway have changes in their own
repositories; publish those artifacts as well. Select new release versions using
the release-plan tools; this change does not select or push release tags.

Stage the private NAS environment files using the checked-out migration tools:

```sh
node deploy/prepare-domain-files.cjs \
  /volume1/docker/plasmic/images/.env \
  /volume1/docker/shiguang-auth/source/deploy/auth.env
```

The command writes sibling `.plasmic-domain-next` files with the same permissions,
leaving the originals untouched. It replaces the three exact hostnames, including
values inside `ALLOWED_RETURN_ORIGINS` and `OAUTH_CLIENTS_JSON`, without printing
secrets. Preserve all other environment values. Also update explicit website
`VITE_PLASMIC_WEB_URL` / `VITE_PLASMIC_UPDATE_URL` overrides, if configured; Vite
values are consumed when building the website.

Copy the updated `shiguang/deploy/access-gateway/routes.json` and the relay's
`umami/Caddyfile` / `umami/haproxy.cfg` into their deployed locations. Preserve
unrelated routes and changes. The current NAS gateway file is
`/volume1/docker/shiguang-deploy/access-gateway/routes.json`; the Seoul relay
directory is `/home/ubuntu/umami-relay`.

The new relay uses HTTP-01 through HAProxy public port 80 and Caddy's loopback
port 8088 for the three Plasmic certificates. Keep
`/.well-known/acme-challenge/*` reachable through the public edge without an
authentication/challenge rule or a redirect that prevents HTTP-01 validation.
Other products' TLS-ALPN policies are unchanged. This supports Cloudflare
Full (strict) with publicly trusted origin certificates.

## Cut over

Schedule a write-free window. Back up PostgreSQL and the existing deployment
configuration before installing the staged files. Close Studio/Desktop editors
and stop the backend, worker, web and preview services so old clients cannot
save revisions during migration:

```sh
cd /volume1/docker/plasmic/images
docker compose stop web server preview ai-worker
umask 077
docker compose exec -T db pg_dump -U wab -d wab -Fc > wab-before-domain-migration.dump
```

Keep the dump private. Install `.env.plasmic-domain-next` as `.env`, retaining a
private backup of the original, and set `IMAGE_TAG` to the
releases published above. Apply the auth environment in the same way. Pull the
new images and run normal schema migrations before the domain data migration:

```sh
docker compose pull
docker compose run --rm server node_modules/typeorm/cli.js migration:run
docker compose run --rm --entrypoint node server /plasmic/deploy/migrate-domains.cjs
docker compose run --rm --entrypoint node server /plasmic/deploy/migrate-domains.cjs --apply
docker compose run --rm --entrypoint node server /plasmic/deploy/migrate-domains.cjs
```

The first/last commands only report counts in a read-only transaction. The final
report must show zero old-domain rows. The apply command runs in one transaction,
preserves IDs, updates serialized model lengths and invalidates partial revision
caches. Immutable library artifacts are checked, including base64 source files;
if one contains an old domain, migration stops without changes and requires a
corrected library release. Existing publication bundles are updated only for URL
references; their publication codes and versions are retained.

Activate the new gateway routes, auth-service configuration and relay files.
Validate before reloading the relay:

```sh
cd /home/ubuntu/umami-relay
docker compose -f docker-compose.seoul.yml exec -T caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
docker compose -f docker-compose.seoul.yml exec -T haproxy haproxy -c -f /usr/local/etc/haproxy/haproxy.cfg
docker compose -f docker-compose.seoul.yml exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
docker compose -f docker-compose.seoul.yml kill -s USR2 haproxy
```

Recreate auth-service/access-gateway using their deployment procedures, and start
the new Plasmic services after the configuration and data agree:

```sh
cd /volume1/docker/plasmic/images
docker compose up -d temporal server ai-worker preview web
```

Deploy the matching website build and Desktop release image. The central OAuth
HTTPS callback `https://shiguanglab.com/auth/apps/plasmicapp/callback` and native
callback `plasmic-desktop://oauth/callback` retain their existing values.

## Acceptance and installed clients

Verify with VPN/TUN disabled: website login return, Studio login, existing project
open/save/reopen, canvas libraries and images, live WebSockets, website publishing,
an existing `/s/<code>` link on the new Preview origin, Desktop login, update
manifest/artifact downloads and CLI resource installation.

Existing Desktop installations and CLI installations contain the old endpoints.
Install the new Desktop installer manually and update the CLI through npm before
using the new domains. There are no legacy host aliases or redirects in this
configuration; old auto-update feeds and previously shared full URLs stop working
when their old hostnames are removed. Shared publication codes remain valid under
the new Preview hostname. Install refreshed workflow resources after updating CLI.

Rollback requires restoring the database dump and deployment configuration/images
together before reopening writes. Retain existing library artifacts and asset
objects; asset keys and project IDs have not changed.
