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

FROM dependencies AS builder
COPY . .
RUN mkdir -p /tmp/.plasmic && cp platform/wab/tools/docker-dev/secrets.json /tmp/.plasmic/secrets.json
# Optional build CA is a local trust input only; never copy it into release images.
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    --mount=type=secret,id=build-ca \
    if [ -f /run/secrets/build-ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build-ca; fi; \
    pnpm run setup
RUN pnpm setup:canvas-packages
RUN --mount=type=secret,id=build-ca \
    if [ -f /run/secrets/build-ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build-ca; fi; \
    node scripts/deploy-loader-sdk.mjs /opt/plasmic-loader-react \
    && pnpm install --frozen-lockfile --ignore-scripts --prefer-offline --prod=false
RUN mkdir -p platform/wab/public/static/packages && cd plasmicpkgs/antd6 && pnpm pack --pack-destination ../../platform/wab/public/static/packages
RUN cd plasmicpkgs/overseas && pnpm pack --pack-destination ../../platform/wab/public/static/packages
RUN cd plasmicpkgs/react-ui && pnpm pack --pack-destination ../../platform/wab/public/static/packages
RUN cd plasmicpkgs/material-ui && pnpm pack --pack-destination ../../platform/wab/public/static/packages

RUN node deploy/component-search/generate-documents.mjs

FROM node:24.16.0-bookworm-slim AS component-model
RUN apt-get update && apt-get install -y --no-install-recommends cmake build-essential git ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /plasmic
RUN git clone --depth 1 --branch v0.9.0 https://github.com/ggml-org/llama.cpp.git /tmp/llama \
    && test "$(git -C /tmp/llama rev-parse HEAD)" = cd959bae99ff4bed22bef2604f45241c09bbb8c8 \
    && cmake -S /tmp/llama -B /tmp/build -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF -DGGML_NATIVE=OFF -DGGML_BACKEND_DL=OFF -DLLAMA_BUILD_TESTS=OFF -DLLAMA_BUILD_EXAMPLES=OFF -DLLAMA_USE_PREBUILT_UI=OFF -DLLAMA_OPENSSL=OFF -DLLAMA_CURL=OFF \
    && cmake --build /tmp/build --target llama-server -j 4 \
    && mkdir /opt/plasmic-component-search \
    && cp /tmp/build/bin/llama-server /opt/plasmic-component-search/ \
    && cp /tmp/llama/LICENSE /opt/plasmic-component-search/LICENSE.llama.cpp \
    && git -C /tmp/llama rev-parse HEAD > /opt/plasmic-component-search/llama-commit
ADD --chmod=0644 --checksum=sha256:ea905fd08e8061db77a0031cbb5096d459d7cfd2bdd0ad2ba66e483f16719493 https://huggingface.co/unsloth/embeddinggemma-2-GGUF/resolve/031f0d4b35536f69ab3509d4893c923264fcf253/embeddinggemma-2-UD-Q4_K_XL.gguf?download=true /opt/plasmic-component-search/embeddinggemma-2-UD-Q4_K_XL.gguf
COPY deploy/component-search deploy/component-search
COPY --from=builder /plasmic/platform/wab/src/wab/server/component-reuse platform/wab/src/wab/server/component-reuse
RUN node deploy/component-search/prepare-model.mjs /opt/plasmic-component-search

FROM node:24.16.0-bookworm-slim AS server
ENV COMPONENT_MODEL_DIRECTORY=/opt/plasmic-component-search
RUN apt-get update && apt-get install -y --no-install-recommends bash git ca-certificates libssl3 libgomp1 && rm -rf /var/lib/apt/lists/* && corepack enable
WORKDIR /plasmic/platform/wab
COPY --from=component-model /opt/plasmic-component-search /opt/plasmic-component-search
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
COPY --chown=node:node deploy/nas-material-ui.ts src/wab/server/nas-material-ui.ts
COPY --chown=node:node deploy/nas-platform-libraries.ts src/wab/server/nas-platform-libraries.ts
COPY --chown=node:node deploy/nas-ai-init.ts src/wab/server/nas-ai-init.ts
COPY --chown=node:node deploy/ai-chat/migrate-message-channels.cjs /plasmic/deploy/ai-chat/migrate-message-channels.cjs
COPY --chown=node:node deploy/migrate-domains.cjs /plasmic/deploy/migrate-domains.cjs
COPY deploy/server-entrypoint.sh /usr/local/bin/plasmic-server
RUN chmod +x /usr/local/bin/plasmic-server && install -d -o node -g node /home/node/.cache/plasmic/component-vectors
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
