const { randomUUID } = require("node:crypto");
const { createLifecycleLog } = require("./lifecycle-log.cjs");

const prefix = "[Studio startup] ";
const maxRequests = 200;
const maxStages = 80;
const knownRoutes = [
  /^\/api\/v1\/(?:auth\/self|plume-pkg|trusted-hosts|latest-bundle-version)$/,
  /^\/static\/(?:host|studio)(?:\.[\da-f]+)?\.html$/,
  /^\/static\/(?:js|css|desktop-fonts)\/[\w.~@-]+\.[\da-f]{6,}\.(?:js|css|woff2?|ttf)$/,
];

function requestRoute(url, resourceType) {
  const pathname = url.pathname;
  if (resourceType === "mainFrame") return "/projects/:id";
  if (pathname === "/api/v1/projects") return pathname;
  const projectRoute = /^\/api\/v1\/projects\/[\w-]+(\/(?:revs\/unpublished|branches|pkg|ai\/edit\/(?:status|models)))?$/.exec(pathname);
  if (projectRoute) return "/api/v1/projects/:id" + (projectRoute[1] ?? "");
  const resourceRoute = /^\/api\/v1\/(pkgs|comments|dependency-models)\/[\w-]+$/.exec(pathname);
  if (resourceRoute) return `/api/v1/${resourceRoute[1]}/:id`;
  if (/^\/api\/v1\/hostless-libraries\/[\w%.-]+\/canvas$/.test(pathname)) return "/api/v1/hostless-libraries/:name/canvas";
  return knownRoutes.some(route => route.test(pathname)) ? pathname : undefined;
}

function responseHeader(details, name) {
  const header = Object.entries(details.responseHeaders ?? {}).find(([key]) => key.toLowerCase() === name);
  return header?.[1][0];
}

function networkError(error) {
  return typeof error === "string" && /^(?:net::)?ERR_[A-Z0-9_]{1,60}$/.test(error) ? error : undefined;
}

function createProjectOpenLog(profile, { studioOrigin, canvasOrigin, slowMs = 10_000, timeoutMs = 120_000 }) {
  const log = createLifecycleLog(profile, 2 * 1024 * 1024, "project-open.log");
  const origins = new Set([studioOrigin, canvasOrigin]);
  const active = new Map();
  const requests = new Map();
  const elapsed = start => Math.round(performance.now() - start);

  function snapshot(attempt, event, outcome) {
    log(event, {
      ...attempt.identity, outcome, durationMs: elapsed(attempt.started),
      stages: [...attempt.stages.values()],
      requests: attempt.completed,
      pending: [...attempt.pending.values()].map(({ record, started }) => ({ ...record, elapsedMs: elapsed(started) })),
      omittedRequests: attempt.omittedRequests,
      omittedStages: attempt.omittedStages,
    });
  }

  function finish(contentsId, outcome) {
    const attempt = active.get(contentsId);
    if (!attempt) return;
    active.delete(contentsId);
    clearTimeout(attempt.slow);
    clearTimeout(attempt.timeout);
    snapshot(attempt, "project-open.end", outcome);
    for (const id of attempt.pending.keys()) requests.delete(id);
  }

  function attachContents(contents, projectId) {
    const contentsId = contents.id;
    contents.on("did-start-navigation", details => {
      if (!details.isMainFrame || details.isSameDocument) return;
      finish(contentsId, "superseded");
      const project = /^\/projects\/[\w-]+(?:\/-\/[^/]+)?\/?$/.test(new URL(details.url).pathname)
        ? projectId(details.url)
        : undefined;
      if (!project) return;
      const identity = { openId: randomUUID(), projectId: project, contentsId };
      const attempt = {
        identity, started: performance.now(), stages: new Map(), pending: new Map(),
        completed: [], omittedRequests: 0, omittedStages: 0,
        slow: setTimeout(() => snapshot(attempt, "project-open.slow", "loading"), slowMs).unref(),
        timeout: setTimeout(() => finish(contentsId, "timed-out"), timeoutMs).unref(),
      };
      active.set(contentsId, attempt);
      log("project-open.start", identity);
    });
    contents.on("console-message", details => {
      const attempt = active.get(contentsId);
      if (!attempt || !details.message.startsWith(prefix) || details.message.length > 300) return;
      const frame = details.frame;
      if (!frame || !URL.canParse(frame.url) || !origins.has(new URL(frame.url).origin)) return;
      let data;
      try { data = JSON.parse(details.message.slice(prefix.length)); } catch { return; }
      if (!Array.isArray(data)) return;
      const [source, phase, startMs, durationMs, frameId] = data;
      if ((source !== "host" && (source !== "top" || frame !== contents.mainFrame)) ||
          typeof phase !== "string" || !/^[a-z][a-z-]{1,48}$/.test(phase) ||
          !Number.isFinite(startMs) || startMs < 0 || !Number.isFinite(durationMs) || durationMs < 0 ||
          (frameId !== undefined && (typeof frameId !== "string" || !/^[\w-]{1,64}$/.test(frameId)))) return;
      const key = `${source}:${phase}:${frameId ?? ""}`;
      if (source === "top" && phase === "studio-ready") {
        // Keep the terminal mark even on projects with many initial frames.
        attempt.stages.set(key, { source, phase, atMs: elapsed(attempt.started) });
        finish(contentsId, "ready");
      } else if (!attempt.stages.has(key)) {
        if (attempt.stages.size < maxStages) {
          attempt.stages.set(key, {
            source, phase, frameId, atMs: elapsed(attempt.started),
            startMs: Math.round(startMs), durationMs: Math.round(durationMs),
          });
        } else {
          attempt.omittedStages++;
        }
        if (source === "top" && phase === "studio-load-error") {
          snapshot(attempt, "project-open.error", "studio-error");
        }
      }
    });
    contents.on("did-fail-load", (_event, code, _description, url, isMainFrame) => {
      const attempt = active.get(contentsId);
      if (attempt && isMainFrame && code !== -3 && projectId(url) === attempt.identity.projectId) {
        attempt.stages.set("navigation-error", { phase: "navigation-error", code, atMs: elapsed(attempt.started) });
        finish(contentsId, "navigation-error");
      }
    });
    contents.on("render-process-gone", () => finish(contentsId, "renderer-gone"));
    contents.once("destroyed", () => finish(contentsId, "closed"));
  }

  function attachSession(session) {
    const filter = { urls: ["https://*/*", "http://*/*"], types: ["mainFrame", "subFrame", "script", "stylesheet", "font", "xhr"] };
    const complete = details => {
      const entry = requests.get(details.id);
      if (!entry) return;
      const { attempt, record, started } = entry;
      requests.delete(details.id);
      attempt.pending.delete(details.id);
      const requestId = responseHeader(details, "x-sg-request-id") ?? responseHeader(details, "x-request-id");
      const resourceCache = responseHeader(details, "x-plasmic-resource-cache");
      attempt.completed.push({
        ...record, durationMs: elapsed(started), status: details.statusCode,
        error: networkError(details.error), fromCache: details.fromCache,
        localAsset: responseHeader(details, "x-plasmic-desktop-asset") === "local",
        resourceCache: resourceCache === "hit" || resourceCache === "miss" ? resourceCache : undefined,
        requestId: /^[\w-]{1,80}$/.test(requestId ?? "") ? requestId : undefined,
      });
    };
    session.webRequest.onBeforeRequest(filter, (details, callback) => {
      callback({});
      const attempt = active.get(details.webContentsId);
      if (!attempt || requests.has(details.id)) return;
      const url = new URL(details.url);
      const firstParty = origins.has(url.origin);
      if (!firstParty && details.resourceType !== "subFrame") return;
      if (attempt.completed.length + attempt.pending.size >= maxRequests) {
        attempt.omittedRequests++;
        return;
      }
      const started = performance.now();
      const record = {
        origin: firstParty ? (url.origin === studioOrigin ? "studio" : "canvas") : "external",
        route: firstParty ? requestRoute(url, details.resourceType) : undefined,
        type: details.resourceType, method: details.method, startMs: elapsed(attempt.started),
      };
      const entry = { attempt, record, started };
      requests.set(details.id, entry);
      attempt.pending.set(details.id, entry);
    });
    session.webRequest.onCompleted(filter, complete);
    session.webRequest.onErrorOccurred(filter, complete);
  }

  return { attachContents, attachSession, preflight: detail => log("project-open.preflight", detail) };
}

module.exports = { createProjectOpenLog };
