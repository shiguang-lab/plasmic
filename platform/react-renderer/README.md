# React rendering service

The service belongs to the root pnpm workspace and builds with that checkout's
`@plasmicapp/loader-react`, query and native React 19 prepass packages. Install
dependencies from the repository root. Its image contains the deployed production
dependency closure and the Linux seccomp addon.

Build from the repository root:

```sh
node scripts/build-html-hydrate.mjs
docker build -f platform/react-renderer/Dockerfile -t plasmic-react-renderer:local .
RENDERER_TEST_IMAGE=plasmic-react-renderer:local node platform/react-renderer/tests/render.e2e.mjs
```

The seccomp BPF policy supports x86 and ARM64 Linux. The test runs natively, starts
an isolated container without the production configuration, and removes it on exit.
Docker grants the container the namespace capabilities required by bubblewrap;
the rendering child still runs inside bubblewrap and loads the native seccomp
policy. Tests never set `DISABLE_BWRAP` or `DISABLE_SECCOMP`.

Run the image with `--cap-add SYS_ADMIN` and
`--security-opt seccomp=platform/react-renderer/docker-seccomp.json`.
The profile is the [official Moby default profile at 4b8214f](https://github.com/moby/profiles/blob/4b8214fc4971e06172938a1f1554ccff6647ee80/seccomp/default.json),
with only `pivot_root` added under `CAP_SYS_ADMIN` for bubblewrap. Its upstream
SHA-256 is `6416b47770785a41ac59073cdc77d9fe98517df2799dc83ef207e622de3053f6`;
the license is in `docker-seccomp.LICENSE`. Keep the outer profile enabled:
it blocks creation of io_uring before Node initializes its event loop. The
inner rendering policy continues to reject io_uring and forbidden syscalls.

`POST /api/v1/render` returns `{html}` after the rendering child completes. Each
request has its own loader and prepass cache. Failed rendering returns an error;
the service remains available. Child execution is limited to 30 seconds and
bubblewrap terminates when its parent dies. The browser hydration regression uses
the same checkout's verified production hydration script and embedded query data.
The prepass regression performs real HTTP requests from the sandboxed child.
