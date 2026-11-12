FROM node:24.16.0-bookworm-slim AS dependencies
RUN apt-get update && apt-get install -y --no-install-recommends bash git curl wget python3 python3-pip postgresql-client build-essential ca-certificates libssl3 libseccomp-dev && rm -rf /var/lib/apt/lists/*
RUN corepack enable
ENV CI=1 PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 PUPPETEER_SKIP_DOWNLOAD=1 CYPRESS_INSTALL_BINARY=0
WORKDIR /plasmic
# Keep fetched packages in a regular layer: cache mounts are not exported to
# the registry cache, and source edits must not force another dependency download.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY platform/package.json platform/pnpm-lock.yaml platform/pnpm-workspace.yaml ./platform/
COPY platform/patches ./platform/patches
COPY platform/sub/package.json platform/sub/pnpm-lock.yaml platform/sub/pnpm-workspace.yaml ./platform/sub/
COPY platform/sub/patches ./platform/sub/patches
COPY platform/react-web-bundle/package.json platform/react-web-bundle/pnpm-lock.yaml platform/react-web-bundle/pnpm-workspace.yaml ./platform/react-web-bundle/
COPY platform/live-frame/package.json platform/live-frame/pnpm-lock.yaml platform/live-frame/pnpm-workspace.yaml ./platform/live-frame/
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    --mount=type=secret,id=build-ca \
    if [ -f /run/secrets/build-ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build-ca; fi; \
    pnpm fetch \
    && pnpm --dir platform fetch \
    && pnpm --dir platform/sub fetch \
    && pnpm --dir platform/react-web-bundle fetch \
    && pnpm --dir platform/live-frame fetch

# Canvas inputs are independent of Studio pages, Desktop code and release tags.
# Regular layers are exported by the existing registry cache (mode=max).
FROM dependencies AS canvas-dependencies
COPY build.mjs tsconfig.types.json ./
COPY scripts/build-canvas-dependencies.mjs scripts/library-thumbnails.mjs ./scripts/
COPY packages ./packages
COPY plasmicpkgs ./plasmicpkgs
COPY plasmicpkgs-dev/package.json ./plasmicpkgs-dev/package.json
COPY vendor/react-ui ./vendor/react-ui
COPY platform/react-renderer ./platform/react-renderer
COPY platform/canvas-packages/package.json ./platform/canvas-packages/package.json
COPY platform/wab/tools/react-compiler.mjs ./platform/wab/tools/react-compiler.mjs
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    --mount=type=secret,id=build-ca \
    if [ -f /run/secrets/build-ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build-ca; fi; \
    pnpm install --frozen-lockfile --prefer-offline
RUN node scripts/build-canvas-dependencies.mjs

FROM canvas-dependencies AS canvas
COPY platform/shared ./platform/shared
COPY platform/wab/package.json ./platform/wab/package.json
COPY platform/wab/src/wab/shared/register-library ./platform/wab/src/wab/shared/register-library
COPY platform/preview/package.json ./platform/preview/package.json
COPY platform/loader-html-hydrate/package.json ./platform/loader-html-hydrate/package.json
COPY platform/loader-bundle-env ./platform/loader-bundle-env
COPY platform/canvas-packages ./platform/canvas-packages
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    --mount=type=secret,id=build-ca \
    if [ -f /run/secrets/build-ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build-ca; fi; \
    pnpm --dir platform install --frozen-lockfile --prefer-offline
WORKDIR /plasmic/platform/canvas-packages
RUN node makePkgTypes.js
RUN pnpm exec tsc
RUN NODE_ENV=production node esbuild.js
WORKDIR /plasmic

FROM canvas AS builder
COPY . .
RUN mkdir -p /tmp/.plasmic && cp platform/wab/tools/docker-dev/secrets.json /tmp/.plasmic/secrets.json
# Canvas already installed both workspaces and built Antd6, icons and React UI.
# Build only the remaining Studio assets; do not repeat those builds/installs.
# Optional build CA is a local trust input only; never copy it into release images.
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    --mount=type=secret,id=build-ca \
    if [ -f /run/secrets/build-ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build-ca; fi; \
    node scripts/build-html-hydrate.mjs \
    && pnpm setup:sub \
    && pnpm setup:react-web-bundle \
    && pnpm setup:live-frame \
    && pnpm --dir platform --filter "loader-bundle-env..." build \
    && pnpm make
RUN --mount=type=secret,id=build-ca \
    if [ -f /run/secrets/build-ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build-ca; fi; \
    node scripts/deploy-loader-sdk.mjs /opt/plasmic-loader-react \
    && pnpm install --frozen-lockfile --ignore-scripts --prefer-offline --prod=false
RUN mkdir -p platform/wab/public/static/packages && cd plasmicpkgs/antd6 && pnpm pack --pack-destination ../../platform/wab/public/static/packages
RUN cd plasmicpkgs/overseas && pnpm pack --pack-destination ../../platform/wab/public/static/packages
RUN cd plasmicpkgs/react-ui && pnpm pack --pack-destination ../../platform/wab/public/static/packages

FROM node:24.16.0-bookworm-slim AS server
RUN apt-get update && apt-get install -y --no-install-recommends bash git ca-certificates libssl3 && rm -rf /var/lib/apt/lists/* && corepack enable
WORKDIR /plasmic/platform/wab
COPY --from=builder --chown=node:node /plasmic/node_modules /plasmic/node_modules
COPY --from=builder --chown=node:node /plasmic/packages /plasmic/packages
COPY --from=builder --chown=node:node /opt/plasmic-loader-react /plasmic/packages/loader-react
COPY --from=builder --chown=node:node /plasmic/platform/node_modules /plasmic/platform/node_modules
COPY --from=builder --chown=node:node /plasmic/platform/package.json /plasmic/platform/pnpm-lock.yaml /plasmic/platform/pnpm-workspace.yaml /plasmic/platform/
COPY --from=builder --chown=node:node /plasmic/platform/shared /plasmic/platform/shared
COPY --from=builder --chown=node:node /plasmic/platform/canvas-packages /plasmic/platform/canvas-packages
COPY --from=builder --chown=node:node /plasmic/platform/wab /plasmic/platform/wab
COPY --from=builder --chown=node:node /plasmic/platform/loader-bundle-env /plasmic/platform/loader-bundle-env
COPY --from=builder --chown=node:node /plasmic/plasmicpkgs /plasmic/plasmicpkgs
COPY --from=builder --chown=node:node /plasmic/platform/loader-html-hydrate /plasmic/platform/loader-html-hydrate
COPY --chown=node:node deploy/nas-init.ts src/wab/server/nas-init.ts
COPY --chown=node:node deploy/nas-antd6.ts src/wab/server/nas-antd6.ts
COPY --chown=node:node deploy/nas-icons.ts src/wab/server/nas-icons.ts
COPY --chown=node:node deploy/nas-react-ui.ts src/wab/server/nas-react-ui.ts
COPY --chown=node:node deploy/nas-platform-libraries.ts src/wab/server/nas-platform-libraries.ts
COPY --chown=node:node deploy/nas-ai-init.ts src/wab/server/nas-ai-init.ts
COPY --chown=node:node deploy/ai-chat/migrate-message-channels.cjs /plasmic/deploy/ai-chat/migrate-message-channels.cjs
COPY --chown=node:node deploy/migrate-domains.cjs /plasmic/deploy/migrate-domains.cjs
COPY deploy/server-entrypoint.sh /usr/local/bin/plasmic-server
RUN chmod +x /usr/local/bin/plasmic-server
USER node
ENV NODE_ENV=development PLASMIC_SELF_HOSTED=1 MAX_HEAP_SIZE=1536 NODE_PATH=/plasmic/platform/wab/node_modules
RUN node -r ./tools/backend-register.cjs -e 'for (const name of ["@plasmicapp/host", "@plasmicapp/query", "@plasmicapp/data-sources", "@plasmicapp/data-sources-context", "@plasmicapp/react-web", "@plasmicapp/loader-react"]) { require(name); console.log("Loaded " + name); }'
EXPOSE 3004
ENTRYPOINT ["plasmic-server"]
CMD ["src/wab/server/main.ts"]

FROM builder AS web-build
ARG PLASMIC_COMMIT
ENV PLASMIC_COMMIT=$PLASMIC_COMMIT
WORKDIR /plasmic/platform/wab
RUN pnpm build-css
RUN NODE_ENV=production PLASMIC_SELF_HOSTED=1 PUBLIC_URL=http://plasmic-origin.invalid STATIC_URL=http://plasmic-origin.invalid REACT_APP_DEFAULT_HOST_URL=http://canvas-origin.invalid/static/host.html NODE_OPTIONS=--max-old-space-size=8192 pnpm build
RUN node ../../desktop/scripts/build-reference-browser-ui.mjs build

RUN node ../../scripts/bundle-studio-fonts.mjs build http://plasmic-origin.invalid

FROM nginx:1.29-alpine AS web
RUN apk add --no-cache python3
COPY --from=web-build /plasmic/platform/wab/build /opt/plasmic-web
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/configure-web.py /opt/configure-web.py
RUN printf '#!/bin/sh\nset -eu\npython3 /opt/configure-web.py\n' > /docker-entrypoint.d/40-plasmic.sh && chmod +x /docker-entrypoint.d/40-plasmic.sh
EXPOSE 8080 8081 8082

FROM builder AS preview-build
RUN pnpm --recursive --workspace-concurrency=2 --filter @plasmicapp/loader-nextjs... run build
WORKDIR /plasmic/platform/preview
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM node:24.16.0-bookworm-slim AS preview
WORKDIR /app
COPY --from=preview-build --chown=node:node /plasmic/platform/preview/.next/standalone ./
COPY --from=preview-build --chown=node:node /plasmic/platform/preview/.next/static ./platform/preview/.next/static
USER node
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3011 HOSTNAME=0.0.0.0
EXPOSE 3011
CMD ["node", "platform/preview/server.js"]
