FROM node:24.16.0-alpine AS builder
RUN apk add --no-cache bash git curl wget python3 py3-pip postgresql-client build-base
RUN corepack enable
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 PUPPETEER_SKIP_DOWNLOAD=1 CYPRESS_INSTALL_BINARY=0
WORKDIR /plasmic
COPY . .
RUN mkdir -p /tmp/.plasmic && cp platform/wab/tools/docker-dev/secrets.json /tmp/.plasmic/secrets.json
RUN pnpm setup

FROM node:24.16.0-alpine AS server
RUN apk add --no-cache bash git && corepack enable
WORKDIR /plasmic/platform/wab
COPY --from=builder --chown=node:node /plasmic/platform/node_modules /plasmic/platform/node_modules
COPY --from=builder --chown=node:node /plasmic/platform/package.json /plasmic/platform/pnpm-lock.yaml /plasmic/platform/pnpm-workspace.yaml /plasmic/platform/
COPY --from=builder --chown=node:node /plasmic/platform/shared /plasmic/platform/shared
COPY --from=builder --chown=node:node /plasmic/platform/wab /plasmic/platform/wab
COPY --from=builder --chown=node:node /plasmic/platform/loader-bundle-env /plasmic/platform/loader-bundle-env
COPY --from=builder --chown=node:node /plasmic/platform/loader-html-hydrate /plasmic/platform/loader-html-hydrate
COPY --chown=node:node deploy/nas-init.ts src/wab/server/nas-init.ts
COPY deploy/server-entrypoint.sh /usr/local/bin/plasmic-server
RUN chmod +x /usr/local/bin/plasmic-server
USER node
ENV NODE_ENV=development MAX_HEAP_SIZE=1536
EXPOSE 3004
ENTRYPOINT ["plasmic-server"]
CMD ["src/wab/server/main.ts"]

FROM builder AS web-build
RUN pnpm setup:canvas-packages
ARG PLASMIC_COMMIT
ENV PLASMIC_COMMIT=$PLASMIC_COMMIT
WORKDIR /plasmic/platform/wab
RUN pnpm build-css
RUN NODE_ENV=development PUBLIC_URL=http://plasmic-origin.invalid STATIC_URL=http://plasmic-origin.invalid NODE_OPTIONS=--max-old-space-size=8192 pnpm build

FROM nginx:1.29-alpine AS web
RUN apk add --no-cache python3
COPY --from=web-build /plasmic/platform/wab/build /opt/plasmic-web
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/configure-web.py /opt/configure-web.py
RUN printf '#!/bin/sh\nset -eu\npython3 /opt/configure-web.py\n' > /docker-entrypoint.d/40-plasmic.sh && chmod +x /docker-entrypoint.d/40-plasmic.sh
EXPOSE 8080 8081
