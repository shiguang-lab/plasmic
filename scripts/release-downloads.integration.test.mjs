import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { sha256 } from "../packages/plasmic-cli/src/protocol.mjs";
import { publishGitHubRelease } from "./github-release.mjs";
import {
  DESKTOP_FEEDS,
  RESOURCE_FILES,
  RESOURCE_RELEASE,
} from "./release-download-contract.mjs";
import { renderDownloadProxy } from "./release-downloads.mjs";
import { fixture, githubFixture } from "./test-fixtures/github-release.mjs";

// Exercise the production publisher and real Caddy; only GitHub HTTP is local.
test(
  "one fixed Caddy configuration serves successive partial releases and immutable history",
  { timeout: 120_000 },
  async (t) => {
    const remote = await githubFixture(t),
      requests = [],
      redirects = new Map();
    const directory = await mkdtemp(path.join(tmpdir(), "plasmic-caddy-test-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    let upstream;
    const server = createServer((req, res) => {
      const url = new URL(req.url, "http://fixture");
      requests.push({
        path: url.pathname,
        query: url.search,
        method: req.method,
        headers: req.headers,
      });
      const redirect = (location) => {
        res.writeHead(302, {
          Location: location,
          "Set-Cookie": "private=value",
        });
        res.end();
      };
      const latest = url.pathname.match(
        /^\/shiguang-lab\/plasmic\/releases\/latest\/download\/([^/]+)$/,
      );
      if (latest)
        return redirect(
          redirects.get(latest[1]) ??
            `${upstream}/shiguang-lab/plasmic/releases/download/${remote.latest()}/${latest[1]}`,
        );
      const asset = url.pathname.match(
        /^\/shiguang-lab\/plasmic\/releases\/download\/([^/]+)\/([^/]+)$/,
      );
      if (asset) {
        if (asset[2] === "Plasmic-1.2.5-mac-x64.dmg")
          return redirect("https://unexpected.example/private");
        const release = remote.release(asset[1]);
        if (
          release &&
          !release.draft &&
          remote.bodies.has(`${asset[1]}/${asset[2]}`)
        )
          return redirect(
            `${upstream}/blob/${asset[1]}/${asset[2]}?signature=a%2Bb&expires=42`,
          );
      }
      const blob = url.pathname.match(/^\/blob\/([^/]+)\/([^/]+)$/);
      if (blob) {
        if (url.search !== "?signature=a%2Bb&expires=42") {
          res.writeHead(403);
          res.end("Invalid signature");
          return;
        }
        const bytes = remote.bodies.get(`${blob[1]}/${blob[2]}`);
        if (bytes) {
          const headers = {
            "Content-Length": bytes.length,
            "Accept-Ranges": "bytes",
            ETag: `"${sha256(bytes)}"`,
            "Set-Cookie": "private=value",
            Location: "https://unexpected.example/leak",
          };
          if (req.headers.range === "bytes=0-3") {
            res.writeHead(206, {
              ...headers,
              "Content-Length": 4,
              "Content-Range": `bytes 0-3/${bytes.length}`,
            });
            res.end(req.method === "HEAD" ? undefined : bytes.subarray(0, 4));
          } else {
            res.writeHead(200, headers);
            res.end(req.method === "HEAD" ? undefined : bytes);
          }
          return;
        }
      }
      res.writeHead(404, {
        "Set-Cookie": "private=value",
        "Cache-Control": "public, max-age=999",
      });
      res.end("missing");
    });
    await new Promise((resolve) => server.listen(0, "0.0.0.0", resolve));
    t.after(() => {
      server.closeAllConnections();
      return new Promise((resolve) => server.close(resolve));
    });
    const port = server.address().port;
    upstream = `http://host.docker.internal:${port}`;
    const block = renderDownloadProxy()
      .replaceAll("https://github.com", upstream)
      .replaceAll(
        "https://github[.]com",
        `http://host[.]docker[.]internal:${port}`,
      )
      .replaceAll("https://release-assets.githubusercontent.com", upstream)
      .replaceAll(
        "https://release-assets[.]githubusercontent[.]com",
        `http://host[.]docker[.]internal:${port}`,
      );
    const file = path.join(directory, "Caddyfile");
    await writeFile(
      file,
      `{\n admin off\n auto_https off\n}\n:8080 {\n${block}\n handle {\n reverse_proxy ${upstream}\n }\n}\n`,
    );
    const docker = (args) =>
      execFileSync("docker", args, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }).trim();
    const container = docker([
      "run",
      "-d",
      "--add-host",
      "host.docker.internal:host-gateway",
      "-p",
      "127.0.0.1::8080",
      "--mount",
      `type=bind,source=${file},target=/etc/caddy/Caddyfile,readonly`,
      "caddy:2.10.2-alpine",
    ]);
    t.after(() => docker(["rm", "-f", "-v", container]));
    const address = "http://" + docker(["port", container, "8080/tcp"]);
    const started = docker([
        "inspect",
        container,
        "--format",
        "{{.State.StartedAt}}",
      ]),
      configHash = sha256(await readFile(file));
    const sensitive = {
      Cookie: "session=secret",
      Authorization: "Bearer secret",
      "X-SG-User": "secret",
      "X-SG-Subject": "secret",
      "X-Forwarded-User": "secret",
      Forwarded: "secret",
    };
    const get = async (route, options = {}) => {
      const response = await fetch(address + route, {
        redirect: "manual",
        signal: AbortSignal.timeout(5000),
        ...options,
        headers: { ...sensitive, ...options.headers },
      });
      const bytes = Buffer.from(await response.arrayBuffer());
      return { response, bytes };
    };
    const successful = (result, cache, status = 200) => {
      assert.equal(result.response.status, status, result.bytes.toString());
      assert.equal(result.response.headers.get("cache-control"), cache);
      assert.equal(
        result.response.headers.get("access-control-allow-origin"),
        "*",
      );
      assert.equal(result.response.headers.get("location"), null);
      assert.equal(result.response.headers.get("set-cookie"), null);
    };
    const publish = async (products, tag) =>
      publishGitHubRelease(await fixture(t, products, tag), remote.run);
    const feeds = {
      ...DESKTOP_FEEDS,
      "plasmic/latest.json": "plasmic-latest.json",
    };
    const verifyFeeds = async (desktopTag, resourceTag) => {
      for (const [route, name] of Object.entries(feeds)) {
        const result = await get(
          "/desktop-updates/" + route + "?client=ignored",
        );
        successful(result, "no-store");
        assert.deepEqual(
          result.bytes,
          remote.bodies.get(
            `${route.startsWith("plasmic/") ? resourceTag : desktopTag}/${name}`,
          ),
        );
      }
    };
    const verifyResources = async (tag) => {
      const manifest = JSON.parse(
        remote.bodies.get(`${tag}/plasmic-manifest.json`),
      );
      for (const name of RESOURCE_FILES) {
        const result = await get(
          `/desktop-updates/plasmic/releases/${manifest.releaseId}/${name}`,
        );
        successful(result, "public, max-age=31536000, immutable");
        assert.deepEqual(
          result.bytes,
          remote.bodies.get(
            `${RESOURCE_RELEASE}/${manifest.releaseId}-${name}`,
          ),
        );
        if (name !== "manifest.json")
          assert.equal(
            sha256(result.bytes),
            Object.values(manifest.artifacts).find(
              (artifact) => artifact.file === name,
            ).sha256,
          );
      }
    };
    try {
      const readyDeadline = Date.now() + 15_000;
      for (;;) {
        try {
          const response = await fetch(address + "/", {
            signal: AbortSignal.timeout(1000),
          });
          await response.arrayBuffer();
          if (response.status === 404) break;
        } catch {}
        assert.ok(Date.now() < readyDeadline, "Caddy did not become ready");
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      await publish({ studio: true }, "1.2.3");
      await verifyFeeds("1.2.2", "1.2.2");
      await verifyResources("1.2.2");
      await publish({ resources: true }, "1.2.4");
      await verifyFeeds("1.2.2", "1.2.4");
      await verifyResources("1.2.2");
      await verifyResources("1.2.4");
      await publish({ desktop: true }, "1.2.5");
      await verifyFeeds("1.2.5", "1.2.4");
      await publish({ studio: true }, "1.2.6");
      await verifyFeeds("1.2.5", "1.2.4");
      await verifyResources("1.2.2");
      await verifyResources("1.2.4");
      for (const tag of ["1.2.2", "1.2.5"])
        for (const [platform, suffix] of [
          ["darwin/arm64", "mac-arm64.zip"],
          ["darwin/x64", "mac-x64.zip"],
          ["win32/x64", "win-x64.exe"],
          ["linux/x64", "linux-x86_64.AppImage"],
        ])
          for (const sidecar of ["", ".blockmap"]) {
            const name = `Plasmic-${tag}-${suffix}${sidecar}`,
              result = await get(`/desktop-updates/${platform}/${name}`);
            successful(result, "public, max-age=31536000, immutable");
            assert.deepEqual(result.bytes, remote.bodies.get(`${tag}/${name}`));
          }
      const installer =
        "/desktop-updates/darwin/arm64/Plasmic-1.2.5-mac-arm64.zip";
      const head = await get(installer, { method: "HEAD" });
      successful(head, "public, max-age=31536000, immutable");
      assert.equal(head.bytes.length, 0);
      assert.equal(head.response.headers.get("content-length"), "9");
      const range = await get(installer, { headers: { Range: "bytes=0-3" } });
      successful(range, "public, max-age=31536000, immutable", 206);
      assert.equal(range.bytes.toString(), "inst");
      assert.equal(range.response.headers.get("content-range"), "bytes 0-3/9");
      const before = requests.length;
      successful(await get(installer, { method: "OPTIONS" }), "no-store", 204);
      successful(await get(installer, { method: "POST" }), "no-store", 405);
      assert.equal(requests.length, before);
      const missingStart = requests.length;
      successful(await get("/desktop-updates/darwin/arm64/Plasmic-0.4.1-mac-arm64.zip?legacy=yes"), "no-store", 404);
      assert.ok(requests.slice(missingStart).every(request => request.path.startsWith("/shiguang-lab/")), "missing assets must never reach the NAS gateway");
      for (const route of [
        "/desktop-updates/darwin/arm64/Plasmic-9.9.9-mac-arm64.zip",
        `/desktop-updates/plasmic/releases/${"f".repeat(64)}/manifest.json`,
      ])
        successful(await get(route), "no-store", 404);
      successful(
        await get("/desktop-updates/darwin/x64/Plasmic-1.2.5-mac-x64.dmg"),
        "no-store",
        502,
      );
      redirects.set(
        "desktop-latest.json",
        upstream +
          "/shiguang-lab/plasmic/releases/download/not-a-version/private",
      );
      successful(await get("/desktop-updates/latest.json"), "no-store", 502);
      redirects.clear();
      for (const request of requests.filter(
        (request) =>
          request.path.startsWith("/shiguang-lab/") ||
          request.path.startsWith("/blob/"),
      )) {
        for (const header of [
          "cookie",
          "authorization",
          "x-sg-user",
          "x-sg-subject",
          "x-forwarded-user",
          "forwarded",
        ])
          assert.equal(
            request.headers[header],
            undefined,
            header + " leaked to " + request.path,
          );
      }
      for (const request of requests.filter((request) =>
        request.path.startsWith("/shiguang-lab/"),
      ))
        assert.match(request.query, /^\?plasmic_proxy=[0-9a-f-]+$/);
      assert.equal(sha256(await readFile(file)), configHash);
      assert.equal(
        docker(["inspect", container, "--format", "{{.State.StartedAt}}"]),
        started,
      );
    } catch (error) {
      t.diagnostic(JSON.stringify(requests.slice(-5)));
      const logs = spawnSync("docker", ["logs", container], {
        encoding: "utf8",
      });
      t.diagnostic(logs.stdout + logs.stderr);
      throw error;
    }
  },
);
