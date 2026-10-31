import { fetchLibraryResource, resourceCacheIdentity } from "@/wab/client/resource-cache";
import { ENV } from "@/wab/client/env";
import { scriptExec } from "@/wab/client/script-exec";
import { assert, sortAs, withTimeout } from "@/wab/shared/common";
import { fstPartyHostLessComponents } from "@/wab/shared/core/hostless-components";
import { getStaticBaseUrl } from "@/wab/shared/urls";
import { memoize } from "lodash";
import memoizeOne from "memoize-one";
import { DEVFLAGS } from "@/wab/shared/devflags";
import { walkDependencyTree } from "@/wab/shared/core/project-deps";
import type { Site } from "@/wab/shared/model/classes";

const fetchCanvasPkgs = memoize(() => {
  const request = new AbortController();
  return withTimeout(
    fetch(
      `${getStaticBaseUrl()}/canvas-packages/build/client.${ENV.COMMITHASH}.js`,
      { signal: request.signal },
    ).then((res) => {
      if (!res.ok) {
        throw new Error(`Unable to load component library runtime: ${res.status}`);
      }
      return res.text();
    }),
    "Couldn't get canvasPkgs.",
    3 * 60 * 1000,
  ).catch((error) => {
    request.abort();
    fetchCanvasPkgs.cache.delete(undefined);
    throw error;
  });
});
const fetchReactWebBundle = memoizeOne(() =>
  fetch(
    `${getStaticBaseUrl()}/react-web-bundle/build/client.${ENV.COMMITHASH}.js`,
  ).then((res) => res.text()),
);
const fetchLiveFrameClient = memoizeOne(() =>
  fetch(
    `${getStaticBaseUrl()}/live-frame/build/client.${ENV.COMMITHASH}.js`,
  ).then((res) => res.text()),
);

interface LibraryRelease {
  pkgId: string;
  version: string;
}

function isManagedLibrary(pkg: string) {
  return (DEVFLAGS.hostLessComponents ?? []).some((entry) => entry.codeName === pkg && entry.hasCodeArtifacts);
}

async function resolveLibraryRelease(pkg: string): Promise<LibraryRelease> {
  const response = await fetch(`/api/v1/hostless-libraries/${encodeURIComponent(pkg)}/release`);
  assert(response.ok, `Unable to resolve component library ${pkg}: ${response.status}`);
  const release = await response.json();
  assert(release.pkgId && release.version, `Missing component library release for ${pkg}`);
  return release;
}

const libraryKey = (pkg: string, version: string, release?: LibraryRelease) =>
  JSON.stringify([resourceCacheIdentity(), pkg, version, release?.pkgId, release?.version]);

const fetchHostLessPkg = memoize(
  async (pkg: string, version: string, release?: LibraryRelease) => {
    const key = libraryKey(pkg, version, release);
    try {
      const managed = isManagedLibrary(pkg);
      assert(!managed || release?.pkgId && release.version, `Missing exact component library release for ${pkg}`);
      const url = managed && release
        ? `/api/v1/hostless-libraries/${encodeURIComponent(pkg)}/canvas?${new URLSearchParams({ version: release.version, pkgId: release.pkgId })}`
        : `${getStaticBaseUrl()}/canvas-packages/build/${pkg}${version}.${ENV.COMMITHASH}.js`;
      const response = await fetchLibraryResource(url);
      if (!response.ok) {
        throw new Error(`Unable to load component library ${pkg}${release ? `@${release.version}` : ""}: ${response.status}`);
      }
      return withLibraryRegistrations(pkg, await response.text());
    } catch (error) {
      fetchHostLessPkg.cache.delete(key);
      throw error;
    }
  },
  libraryKey,
);

export function getCanvasPkgs() {
  return fetchCanvasPkgs();
}

const canvasRuntimeLoads = new WeakMap<Document, Promise<void>>();

/** A frame navigation owns a new runtime, even when its WindowProxy is reused. */
export function ensureCanvasRuntime(win: Window): Promise<void> {
  const doc = win.document;
  const pending = canvasRuntimeLoads.get(doc);
  if (pending) {
    return pending;
  }
  const target = win as Window & { __CanvasPkgs?: unknown };
  if (target.__CanvasPkgs) {
    return Promise.resolve();
  }
  // Defer the work so the task is stored before fetch or script execution starts.
  const task = Promise.resolve().then(async () => {
    const source = await getCanvasPkgs();
    assert(win.document === doc, "Canvas runtime target navigated while loading");
    if (!target.__CanvasPkgs) {
      try {
        scriptExec(win, source);
        assert(target.__CanvasPkgs, "Canvas runtime did not initialize");
      } catch (error) {
        delete target.__CanvasPkgs;
        throw error;
      }
    }
  }).finally(() => {
    // Success is represented by __CanvasPkgs; failures must remain retryable.
    canvasRuntimeLoads.delete(doc);
  });
  canvasRuntimeLoads.set(doc, task);
  return task;
}

export function getReactWebBundle() {
  return fetchReactWebBundle();
}

export function getLiveFrameClientJs() {
  return fetchLiveFrameClient();
}

function needsCanvasRuntime(pkg: string) {
  return ["antd6", "overseas", "react-ui"].includes(pkg) ||
    (DEVFLAGS.hostLessComponents ?? []).some((entry) => entry.codeName === pkg && entry.hasCodeArtifacts);
}

// Each destination window owns its registrations. Replacing one library must
// remove its previous definitions (including removed components) without
// discarding the other libraries or app-host registrations in that window.
function withLibraryRegistrations(pkg: string, source: string) {
  return `(function(){
    var keys = ["__PlasmicComponentRegistry", "__PlasmicContextRegistry", "__PlasmicFunctionsRegistry", "__PlasmicTokenRegistry", "__PlasmicTraitRegistry", "__PlasmicLibraryRegistry"];
    var owned = window.__PlasmicHostlessRegistrations || (window.__PlasmicHostlessRegistrations = {});
    var previous = owned[${JSON.stringify(pkg)}] || {};
    var before = {};
    keys.forEach(function(key){
      before[key] = (window[key] || []).slice();
      window[key] = before[key].filter(function(entry){ return !(previous[key] || []).includes(entry); });
    });
    try {
      (function(){ ${source}\n })();
      var current = {};
      keys.forEach(function(key){
        current[key] = (window[key] || []).filter(function(entry){ return !before[key].includes(entry); });
      });
      owned[${JSON.stringify(pkg)}] = current;
    } catch (error) {
      keys.forEach(function(key){ window[key] = before[key]; });
      throw error;
    }
  })();`;
}

export async function getHostLessPkg(win: Window, pkg: string, version: string, release?: LibraryRelease) {
  const doc = win.document;
  const [source] = await Promise.all([
    (async () => fetchHostLessPkg(pkg, version, release ?? (isManagedLibrary(pkg) ? await resolveLibraryRelease(pkg) : undefined)))(),
    needsCanvasRuntime(pkg) ? ensureCanvasRuntime(win) : undefined,
  ]);
  assert(win.document === doc, "Component library target navigated while loading");
  return source;
}

export function getHostLessPkgIdentity(pkg: string, site: Site) {
  const release = getDependencyRelease(pkg, site);
  return release ? `${pkg}@${release.pkgId}:${release.version}` : pkg;
}

function getDependencyRelease(pkg: string, site: Site): LibraryRelease | undefined {
  if (!isManagedLibrary(pkg) || site.hostLessPackageInfo?.name === pkg) {
    return undefined;
  }
  const dep = walkDependencyTree(site, "all").find((d) => d.site.hostLessPackageInfo?.name === pkg);
  assert(dep?.pkgId && dep.version, `Missing exact component library dependency for ${pkg}`);
  return { pkgId: dep.pkgId, version: dep.version };
}

export async function getSortedHostLessPkgs(
  win: Window,
  pkgs: string[],
  version: string,
  site?: Site,
) {
  const doc = win.document;
  const sortedPkgs = sortAs(pkgs, fstPartyHostLessComponents, (t) => t);
  const [modules] = await Promise.all([
    Promise.all(
    sortedPkgs.map(async (pkg) => {
      const dependency = site ? getDependencyRelease(pkg, site) : undefined;
      const release = dependency ?? (isManagedLibrary(pkg) ? await resolveLibraryRelease(pkg) : undefined);
      return [site ? getHostLessPkgIdentity(pkg, site) : release ? `${pkg}@${release.pkgId}:${release.version}` : pkg, await fetchHostLessPkg(pkg, version, release)];
    }),
    ),
    sortedPkgs.some(needsCanvasRuntime)
      ? ensureCanvasRuntime(win)
      : undefined,
  ]);
  assert(win.document === doc, "Component library target navigated while loading");
  // Only registration sources reach scriptExec; the runtime is already ready.
  return modules;
}

// Versioning based on bundling made on platform/canvas-packages/esbuild.js
export function getVersionForCanvasPackages(window: Window | null) {
  if (!!(window as any)?.__Sub?.jsxRuntime) {
    return "-v2";
  }

  return "";
}
