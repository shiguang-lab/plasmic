# NAS project covers

The project list requests a WebP from the Studio API after the card becomes visible. Studio checks project viewer permission before every read. The screenshot page and its model require a short-lived, project-scoped service credential. Both NAS services use the internal Studio network.

The project list shares one authenticated event stream across its mounted cover cards. It closes the stream when the last card unmounts, the document is hidden, or Desktop deactivates its Dashboard. The snapshot service emits the published revision after the file is durable. Studio checks viewer permission before forwarding it. Visible cards reconcile revisions after the publisher connects or reconnects and request a WebP only when needed.

Every 15 seconds the service checks committed main revisions using project metadata. Changes since installation wait for 45 seconds of quiet, with a five-minute limit from the first observed change. The first visible card requests a missing historical cover immediately. The queue coalesces revisions and allows one browser job at a time. A restart reloads the successful revisions from disk and reconciles current saves.

Each job opens a fresh context in resident Chromium, loads the complete saved canvas, waits for the artboards and gives images and fonts a shared five-second loading budget, screenshots it once and encodes a lossless 640 × 360 WebP. Project images, stylesheets, fonts and media can use any public HTTP(S) domain. Their requests use the server’s public-address filter. An unavailable image retains its layout box and the worker reports the count in the capture result. The file and directory are synced before the new revision is published. A failure retains the last cover. Retries wait 15 seconds, one minute and five minutes, then stop until a newer revision or service restart. The two most recent successful WebPs are retained.

## First deployment

Install the Compose file under the existing NAS Studio deployment's `canvas-snapshot/`. Create private writable `jobs/` and `covers/` directories for UID 1000. Provision `secrets/key` (32 random bytes encoded as 64 lowercase hex digits) and `secrets/db`; restrict access to the service owner. Run `reader.sql` as database owner with its psql variable `password` set to the database secret. Compose mounts the NAS Playwright/Chromium 1080 installation from `../../browser/`, Chromium shared libraries in `browser-lib/` and the host fonts.

## Upgrade and verification

Roll out the matching Studio release with the repository's `deploy/rollout.py` and `deploy/nginx.conf`. The web image contains the snapshot bundle and the server image contains the worker and page service. From the NAS snapshot directory run `docker compose --env-file ../.env up -d`.

An anonymous request to either `/canvas-snapshot/<id>` or its `/model` must return 403. Open a visible project card with viewer access to request its cover. To explicitly run a full capture on the NAS:

```sh
curl --fail-with-body --unix-socket jobs/screenshot.sock -X POST "http://localhost/covers/$PROJECT_ID"
```

The result names the saved revision and its WebP in `covers/`.
