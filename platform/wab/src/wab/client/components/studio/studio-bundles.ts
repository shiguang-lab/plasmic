import { ENV } from "@/wab/client/env";
import { sortAs } from "@/wab/shared/common";
import { fstPartyHostLessComponents } from "@/wab/shared/core/hostless-components";
import { getStaticBaseUrl } from "@/wab/shared/urls";
import { memoize } from "lodash";
import memoizeOne from "memoize-one";
import { DEVFLAGS } from "@/wab/shared/devflags";
import { walkDependencyTree } from "@/wab/shared/core/project-deps";
import type { Site } from "@/wab/shared/model/classes";

const fetchCanvasPkgs = memoize(() =>
  fetch(
    `${getStaticBaseUrl()}/canvas-packages/build/client.${ENV.COMMITHASH}.js`,
  ).then((res) => {
    if (!res.ok) {
      throw new Error(`Unable to load component library runtime: ${res.status}`);
    }
    return res.text();
  }).catch((error) => {
    fetchCanvasPkgs.cache.delete(undefined);
    throw error;
  }),
);
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

const fetchHostLessPkg = memoize(
  async (pkg: string, version: string, libraryVersion?: string) => {
    try {
      const managed = (DEVFLAGS.hostLessComponents ?? []).some((entry) => entry.codeName === pkg && entry.hasCodeArtifacts);
      const url = managed
        ? `/api/v1/hostless-libraries/${encodeURIComponent(pkg)}/canvas${libraryVersion ? `?version=${encodeURIComponent(libraryVersion)}` : ""}`
        : `${getStaticBaseUrl()}/canvas-packages/build/${pkg}${version}.${ENV.COMMITHASH}.js`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Unable to load component library ${pkg}${libraryVersion ? `@${libraryVersion}` : ""}: ${response.status}`);
      }
      return withLibraryRegistrations(pkg, await response.text());
    } catch (error) {
      fetchHostLessPkg.cache.delete(`${pkg}:${version}:${libraryVersion ?? "latest"}`);
      throw error;
    }
  },
  (pkg, version, libraryVersion) => `${pkg}:${version}:${libraryVersion ?? "latest"}`,
);

export function getCanvasPkgs() {
  return fetchCanvasPkgs();
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

function withCanvasRuntime(source: string, runtime: string) {
  return `if (!window.__CanvasPkgs) {\n${runtime}\n}\n${source}`;
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

export async function getHostLessPkg(pkg: string, version: string, libraryVersion?: string) {
  const [source, runtime] = await Promise.all([
    fetchHostLessPkg(pkg, version, libraryVersion),
    needsCanvasRuntime(pkg) ? getCanvasPkgs() : undefined,
  ]);
  return runtime === undefined ? source : withCanvasRuntime(source, runtime);
}

export function getHostLessPkgIdentity(pkg: string, site: Site) {
  const managed = (DEVFLAGS.hostLessComponents ?? []).some((entry) => entry.codeName === pkg && entry.hasCodeArtifacts);
  const dep = managed && walkDependencyTree(site, "all").find((d) => d.site.hostLessPackageInfo?.name === pkg);
  return dep ? `${pkg}@${dep.version}` : pkg;
}

export async function getSortedHostLessPkgs(
  pkgs: string[],
  version: string,
  site?: Site,
  opts?: {
    /**
     * The destination already executed getCanvasPkgs(). The bootstrap would
     * be skipped by its `window.__CanvasPkgs` guard, but its multi-MB source
     * would still be parsed, so leave it out.
     */
    canvasRuntimeLoaded?: boolean;
  },
) {
  const sortedPkgs = sortAs(pkgs, fstPartyHostLessComponents, (t) => t);
  const [modules, runtime] = await Promise.all([
    Promise.all(
    sortedPkgs.map(async (pkg) => {
      const dep = site && walkDependencyTree(site, "all").find((d) => d.site.hostLessPackageInfo?.name === pkg);
      return [site ? getHostLessPkgIdentity(pkg, site) : pkg, await fetchHostLessPkg(pkg, version, dep?.version)];
    }),
    ),
    !opts?.canvasRuntimeLoaded && sortedPkgs.some(needsCanvasRuntime)
      ? getCanvasPkgs()
      : undefined,
  ]);
  // Each destination executes modules in order. Carry the shared bootstrap in
  // one source, rather than copying and parsing it for every registration.
  if (runtime !== undefined && modules.length > 0) {
    modules[0][1] = withCanvasRuntime(modules[0][1], runtime);
  }
  return modules;
}

// Versioning based on bundling made on platform/canvas-packages/esbuild.js
export function getVersionForCanvasPackages(window: Window | null) {
  if (!!(window as any)?.__Sub?.jsxRuntime) {
    return "-v2";
  }

  return "";
}
