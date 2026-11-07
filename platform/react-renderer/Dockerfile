FROM node:24-alpine AS builder

RUN apk add --no-cache bubblewrap~=0.12 bash~=5 make~=4 python3 g++ libseccomp-dev
RUN corepack enable
ENV CI=1 PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 PUPPETEER_SKIP_DOWNLOAD=1 CYPRESS_INSTALL_BINARY=0
WORKDIR /plasmic
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml build.mjs tsconfig.types.json ./
COPY packages ./packages
COPY plasmicpkgs ./plasmicpkgs
COPY plasmicpkgs-dev ./plasmicpkgs-dev
COPY vendor ./vendor
COPY platform/patches ./platform/patches
COPY platform/react-renderer/package.json ./platform/react-renderer/package.json
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    --mount=type=cache,target=/root/.cache/pnpm \
    pnpm install --frozen-lockfile --ignore-scripts --filter react-renderer...
RUN pnpm --filter @plasmicapp/loader-react... build
COPY platform/react-renderer ./platform/react-renderer
RUN pnpm --filter react-renderer build
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    --mount=type=cache,target=/root/.cache/pnpm \
    pnpm --filter react-renderer deploy --legacy --prod --frozen-lockfile --ignore-scripts /opt/react-renderer

FROM node:24-alpine
RUN apk add --no-cache bubblewrap~=0.12 bash~=5 libseccomp && adduser -D normaluser
WORKDIR /home/normaluser/react-renderer
COPY --from=builder --chown=normaluser:normaluser /opt/react-renderer ./
USER normaluser
ENV BWRAP_ARGS='--ro-bind /home /home'
ENV REACT_RENDERER_PORT=3010
EXPOSE 3010
CMD ["bash", "tools/run.bash", "src/main.ts", "-c", "src/config.prod.json"]
