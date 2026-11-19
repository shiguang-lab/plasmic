# NAS project covers

The project list requests a WebP from the Studio API after the card becomes visible. Studio checks project viewer permission before every read. The screenshot page and its model require a short-lived, project-scoped service credential. Both NAS services use the internal Studio network.

The project list shares one authenticated event stream across its mounted cover cards. It closes the stream when the last card unmounts, the document is hidden, or Desktop deactivates its Dashboard. The snapshot service emits the published revision after the file is durable. Studio checks viewer permission before forwarding it. Visible cards reconcile revisions after the publisher connects or reconnects and request a WebP only when needed.

Every 15 seconds the service checks committed main revisions using project metadata. Changes since installation wait for 45 seconds of quiet, with a five-minute limit from the first observed change. The first visible card requests a missing historical cover immediately. The queue coalesces revisions and allows one browser job at a time. A restart reloads the successful revisions from disk and reconciles current saves.

The Go worker reads the protected HTML and saved model for the same project. It serves static Studio assets on a loopback HTTP origin and fulfills the two private responses only for the main frame of the current isolated browser context. This lets Headless Shell load NAS HTTP resources with browser security checks enabled. Public project images, fonts, media and styles are fetched with a public-address-only dialer and a ten-second request timeout. Each batch of frames gets a five-second media readiness budget.

The overview uses all boards from the first nonempty free arena. If there is none, it uses the widest board from each page arena. The snapshot page computes their layout before rendering. The worker captures each active arena before switching. For independent boards, it compares their saved frame, component and shared model dependencies, renderer document, final scale and fractional pixel positions with the last successful cover. Matching rectangles can be copied from that lossless WebP, including integer-pixel moves. Rounded rectangles that overlap require a fresh render. Live expressions and unknown model types fall back to fresh rendering on the static-board path.

For projects with registered libraries or global providers, the worker can reuse a previous capture across a change to saved literal text. It checks the complete model structure, shared inputs, library sources and text outside the displayed boards. Each board that references the edited text gets a new render. Changes to props, structure or shared configuration require a full capture on this path. Reused boards retain the pixels from their previous capture. Newly rendered boards show the content produced by the page at capture time. Snapshot frames wait for running CSS transitions and follow-up transitions from page event handlers to settle naturally. Images that fail to decode or exceed the media deadline retain their page-defined presentation. Running animations, unsettled fonts or unavailable images prevent caching.

The worker holds up to 64 project manifests in memory. Reuse is bounded by five minutes and by the freshness of public resources. An exact repeat with a valid complete manifest can publish the existing pixels without starting a browser. After restart or cache expiry the next capture rebuilds the image. An idle shell exits after two minutes. Each job syncs the new 640 × 360 WebP and its directory before reporting success. A failed job retains the last successful cover. The socket response includes the saved revision, board count, rendered/reused counts, unavailable image count and elapsed milliseconds.

## First deployment

Install the Compose file under the existing NAS Studio deployment's `canvas-snapshot/`. Create private writable `jobs/` and `covers/` directories for UID 1000. Provision `secrets/key` (32 random bytes encoded as 64 lowercase hex digits) and `secrets/db`; restrict access to the service owner. Run `reader.sql` as database owner with its psql variable `password` set to the database secret. The released Linux amd64 cover worker image includes the Go executable, libwebp and checksum-pinned Chrome for Testing Headless Shell. Compose mounts the NAS fonts.

## Upgrade and verification

Roll out the matching Studio release with the repository's `deploy/rollout.py` and `deploy/nginx.conf`. The web image contains the snapshot bundle, and the server image contains the snapshot page service. Pull the matching images with `docker compose --env-file ../.env pull` and start the services with `docker compose --env-file ../.env up -d`.

An anonymous request to either `/canvas-snapshot/<id>` or its `/model` must return 403. Open a visible project card with viewer access to request its cover. To request a cover capture on the NAS:

```sh
curl --fail-with-body --unix-socket jobs/screenshot.sock -X POST "http://localhost/covers/$PROJECT_ID"
```

The result names the saved revision and its WebP in `covers/`.
