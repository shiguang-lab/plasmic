import { ENV } from "@/wab/client/env";
import { sortAs } from "@/wab/shared/common";
import { fstPartyHostLessComponents } from "@/wab/shared/core/hostless-components";
import { getStaticBaseUrl } from "@/wab/shared/urls";
import { memoize } from "lodash";
import memoizeOne from "memoize-one";
import { DEVFLAGS } from "@/wab/shared/devflags";
import { walkDependencyTree } from "@/wab/shared/core/project-deps";
import type { Site } from "@/wab/shared/model/classes";

const fetchCanvasPkgs = memoizeOne(() =>
  fetch(
    `${getStaticBaseUrl()}/canvas-packages/build/client.${ENV.COMMITHASH}.js`,
  ).then((res) => res.text()),
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
    const managed = (DEVFLAGS.hostLessComponents ?? []).some((entry) => entry.codeName === pkg && entry.hasCodeArtifacts);
    if (managed) {
      const response = await fetch(`/api/v1/hostless-libraries/${encodeURIComponent(pkg)}/canvas${libraryVersion ? `?version=${encodeURIComponent(libraryVersion)}` : ""}`);
      if (!response.ok) {
        throw new Error(`Unable to load component library ${pkg}${libraryVersion ? `@${libraryVersion}` : ""}: ${response.status}`);
      }
      return response.text();
    }
    const source = await fetch(
      `${getStaticBaseUrl()}/canvas-packages/build/${pkg}${version}.${
        ENV.COMMITHASH
      }.js`,
    ).then((res) => res.text());
    return source;
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

export async function getSortedHostLessPkgs(pkgs: string[], version: string, site?: Site) {
  const sortedPkgs = sortAs(pkgs, fstPartyHostLessComponents, (t) => t);
  const [modules, runtime] = await Promise.all([
    Promise.all(
    sortedPkgs.map(async (pkg) => {
      const dep = site && walkDependencyTree(site, "all").find((d) => d.site.hostLessPackageInfo?.name === pkg);
      return [site ? getHostLessPkgIdentity(pkg, site) : pkg, await fetchHostLessPkg(pkg, version, dep?.version)];
    }),
    ),
    sortedPkgs.some(needsCanvasRuntime) ? getCanvasPkgs() : undefined,
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
