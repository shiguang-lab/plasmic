FROM golang:1.26.5-bookworm AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY *.go ./
RUN CGO_ENABLED=0 go test ./... && CGO_ENABLED=0 go build -trimpath -o /cover-worker .

FROM debian:bookworm-slim AS browser
RUN apt-get update && apt-get install -y --no-install-recommends unzip && rm -rf /var/lib/apt/lists/*
ADD --checksum=sha256:88817c574c1838a39f88fda0bbd043b4481fd385fb10e92c323e230844d636ce https://storage.googleapis.com/chrome-for-testing-public/148.0.7778.96/linux64/chrome-headless-shell-linux64.zip /tmp/shell.zip
RUN unzip -q /tmp/shell.zip -d /opt && mv /opt/chrome-headless-shell-linux64 /opt/chrome-headless-shell

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates libwebp7 libasound2 libatk-bridge2.0-0 libatk1.0-0 libcairo2 libcups2 libdbus-1-3 libdrm2 libexpat1 libgbm1 libglib2.0-0 libnspr4 libnss3 libpango-1.0-0 libx11-6 libxcb1 libxcomposite1 libxdamage1 libxext6 libxfixes3 libxkbcommon0 libxrandr2 fonts-liberation fonts-noto-cjk && rm -rf /var/lib/apt/lists/*
COPY 65-plasmic-font-aliases.conf /etc/fonts/conf.d/65-plasmic-font-aliases.conf
RUN fc-cache -f
COPY --from=browser /opt/chrome-headless-shell /opt/chrome-headless-shell
COPY --from=build /cover-worker /usr/local/bin/cover-worker
USER 1000:1000
ENTRYPOINT ["/usr/local/bin/cover-worker"]
