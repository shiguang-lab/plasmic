# syntax=docker/dockerfile:1
#
# Build context is the repository root, including the local loader SDK workspace:
#   docker build -f platform/wab/Dockerfile .
# The platform packages retain their sibling layout; the deployed SDK closure
# lives at /plasmic/packages/loader-react for the platform link dependencies.

# See https://hub.docker.com/_/node/
# Pinned to an exact patch (not the floating node:24-alpine tag) to avoid silently
# pulling in Node patch regressions on rebuild. Node 24.17.0 introduced an http.Agent
# keep-alive regression (nodejs/node#63989) that broke node-fetch outbound requests with
# ERR_STREAM_PREMATURE_CLOSE. Bump deliberately once a fixed 24.17.x+ is verified.
FROM node:24.16.0-alpine AS builder

ENV CI=1
ENV PUPPETEER_SKIP_DOWNLOAD=1
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV CYPRESS_INSTALL_BINARY=0
ENV PLAYWRIGHT_DOWNLOAD_HOST=https://playwright-akamai.azureedge.net

# make + bubblewrap for wab codegen and the runtime code-eval sandbox;
# build-base/g++/gcc/python3/libc-dev to compile native addons (bcrypt, sharp,
# @swc/core, ...) during pnpm install.
RUN apk add --no-cache make~=4 bubblewrap~=0.12 python3 build-base bash g++ gcc libc-dev

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /plasmic
COPY . .
RUN mkdir -p /tmp/.plasmic && cp platform/wab/tools/docker-dev/secrets.json /tmp/.plasmic/secrets.json
# setup builds local component packages, SDK dependencies and the canonical hydration output.
# Optional build CA is a local trust input only; never copy it into release images.
RUN --mount=type=cache,id=plasmic-alpine-store,target=/root/.local/share/pnpm/store,sharing=locked \
    --mount=type=cache,id=plasmic-alpine-metadata,target=/root/.cache/pnpm,sharing=locked \
    --mount=type=secret,id=npmrc,target=/root/.npmrc \
    --mount=type=secret,id=build-ca \
    if [ -f /run/secrets/build-ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build-ca; fi; \
    pnpm run setup
RUN --mount=type=cache,id=plasmic-alpine-store,target=/root/.local/share/pnpm/store,sharing=locked \
    --mount=type=cache,id=plasmic-alpine-metadata,target=/root/.cache/pnpm,sharing=locked \
    --mount=type=secret,id=build-ca \
    if [ -f /run/secrets/build-ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build-ca; fi; \
    node scripts/deploy-loader-sdk.mjs /opt/plasmic-loader-react \
    && pnpm install --frozen-lockfile --ignore-scripts --prefer-offline --prod=false
RUN pnpm --filter @plasmicapp/host pack --out /tmp/plasmic-host.tgz && mkdir /opt/plasmic-host && tar -xzf /tmp/plasmic-host.tgz --strip-components=1 -C /opt/plasmic-host
WORKDIR /plasmic/platform

# Re-resolve without devDependencies for the runtime image, and only for the
# three packages that actually ship in it — this keeps canvas-packages',
# analytics-rproxy's and mini-cache's prod deps out of the copied store.
# NB: `pnpm deploy` would be tidier but flattens node_modules and breaks wab's
# sibling-dir resolution (../loader-bundle-env/node_modules); see
# https://github.com/pnpm/pnpm/issues/9283
WORKDIR /plasmic/platform
RUN --mount=type=cache,id=plasmic-alpine-store,target=/root/.local/share/pnpm/store,sharing=locked \
    --mount=type=cache,id=plasmic-alpine-metadata,target=/root/.cache/pnpm,sharing=locked \
    --mount=type=secret,id=npmrc,target=/root/.npmrc --mount=type=secret,id=build-ca \
    if [ -f /run/secrets/build-ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build-ca; fi; \
    rm -rf node_modules wab/node_modules loader-bundle-env/node_modules \
      loader-html-hydrate/node_modules canvas-packages/node_modules \
    && pnpm install --frozen-lockfile --prefer-offline --prod \
      --filter "wab..." --filter "loader-bundle-env..." \
      --filter "@plasmicapp/loader-html-hydrate..." \
      --config.confirmModulesPurge=false

FROM node:24.16.0-alpine AS runner

# make + bubblewrap for the runtime code-eval sandbox; toolchain kept so native
# addons that resolve a prebuilt binary at load time still have their deps.
RUN apk add --no-cache make~=4 bubblewrap~=0.12 python3 build-base bash g++ gcc libc-dev

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
# Keep corepack's cache in a world-readable location so the pnpm dist baked in
# below (as root) is usable by the unprivileged node user at runtime.
ENV COREPACK_HOME="/pnpm/corepack"
RUN corepack enable

WORKDIR /plasmic/platform

# Workspace-root store plus manifests, then the three peer packages wab needs at
# runtime. Symlinks inside each package's node_modules point back into
# /plasmic/platform/node_modules/.pnpm, so both must be copied together.
COPY --from=builder --chown=node:node /plasmic/plasmicpkgs /plasmic/plasmicpkgs
COPY --from=builder --chown=node:node /opt/plasmic-host /plasmic/packages/host
COPY --from=builder --chown=node:node /opt/plasmic-loader-react /plasmic/packages/loader-react
COPY --from=builder --chown=node:node /plasmic/platform/node_modules ./node_modules
COPY --from=builder --chown=node:node /plasmic/platform/pnpm-workspace.yaml /plasmic/platform/pnpm-lock.yaml /plasmic/platform/package.json ./

# Bake the pinned pnpm dist into the image; otherwise the first `pnpm ...` in a
# pod (e.g. `pnpm db:one-time-job`) would download it from the registry at
# container runtime.
RUN --mount=type=cache,id=plasmic-alpine-store,target=/root/.local/share/pnpm/store,sharing=locked \
    --mount=type=cache,id=plasmic-alpine-metadata,target=/root/.cache/pnpm,sharing=locked \
    --mount=type=secret,id=build-ca \
    if [ -f /run/secrets/build-ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build-ca; fi; \
    pnpm --version && chmod -R a+rX "$COREPACK_HOME"
COPY --from=builder --chown=node:node /plasmic/platform/shared ./shared
COPY --from=builder --chown=node:node /plasmic/platform/wab ./wab
COPY --from=builder --chown=node:node /plasmic/platform/loader-bundle-env ./loader-bundle-env
COPY --from=builder --chown=node:node /plasmic/platform/loader-html-hydrate ./loader-html-hydrate

# Expose main server port
EXPOSE 3004

# Switch workdir back to wab
WORKDIR /plasmic/platform/wab

USER node

CMD ["node", "-r", "esbuild-register", "src/wab/server/main.ts"]
