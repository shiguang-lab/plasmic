import { shouldShowHostLessPackage } from "@/wab/client/components/studio/add-drawer/AddDrawer";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { FastBundler } from "@/wab/shared/bundler";
import { assert, ensure, ensureArray } from "@/wab/shared/common";
import type { PROTOTYPE_TOOL_META } from "@/wab/shared/copilot/prototype-tools";
import { isCodeComponent, isFrameComponent } from "@/wab/shared/core/components";
import { unbundleProjectDependency } from "@/wab/shared/core/tagged-unbundle";
import { DEVFLAGS } from "@/wab/shared/devflags";
import type { Component, ProjectDependency } from "@/wab/shared/model/classes";
import { chunk } from "lodash";
import type { z } from "zod";

type LibrarySummary = z.infer<typeof PROTOTYPE_TOOL_META.listLibraries.outputSchema>["libraries"][number];

// Code names such as react-ui must also be discoverable as "React UI"/"reactUI".
const searchKey = (value: string) => value.toLowerCase().replace(/[\s\p{P}\p{S}]/gu, "");
const matches = (query: string | undefined, values: (string | undefined)[]) =>
  !query || values.some((value) => value && searchKey(value).includes(searchKey(query)));

function page<T>(items: T[], input: { offset: number; limit: number }) {
  const end = input.offset + input.limit;
  return { items: items.slice(input.offset, end), total: items.length, nextOffset: end < items.length ? end : undefined };
}

function availableLibraries(studio: StudioCtx): LibrarySummary[] {
  const catalog = studio.appCtx.appConfig.hostLessComponents ?? DEVFLAGS.hostLessComponents ?? [];
  const libraries = new Map<string, LibrarySummary>();
  for (const entry of catalog) {
    if (entry.syntheticPackage || entry.onlyShownIn === "old" || !shouldShowHostLessPackage(studio, entry)) {
      continue;
    }
    const projectIds = ensureArray(entry.projectId);
    if (!projectIds.length) {
      continue;
    }
    const key = entry.codeName ?? [...projectIds].sort().join(":");
    const previous = libraries.get(key);
    libraries.set(key, {
      name: entry.isInstallOnly || !previous ? entry.name : previous.name,
      codeName: entry.codeName,
      category: entry.isInstallOnly || !previous ? entry.sectionLabel : previous.category,
      projectIds: [...new Set([...(previous?.projectIds ?? []), ...projectIds])],
      installed: false,
      installedProjects: [],
    });
  }
  // Published design libraries installed by ID need not be in the store catalog.
  for (const dep of studio.site.projectDependencies) {
    if (![...libraries.values()].some((library) => library.projectIds.includes(dep.projectId))) {
      libraries.set(dep.projectId, { name: dep.name, projectIds: [dep.projectId], installed: true, installedProjects: [] });
    }
  }
  return [...libraries.values()].map((library) => {
    const installedProjects = studio.site.projectDependencies
      .filter((dep) => library.projectIds.includes(dep.projectId))
      .map((dep) => ({ projectId: dep.projectId, version: dep.version }));
    return { ...library, installedProjects, installed: library.projectIds.every((id) => installedProjects.some((dep) => dep.projectId === id)) };
  });
}

export async function listLibraries(studio: StudioCtx, input: z.infer<typeof PROTOTYPE_TOOL_META.listLibraries.inputSchema>) {
  const libraries = availableLibraries(studio).filter((library) =>
    (input.installed === undefined || library.installed === input.installed) &&
    matches(input.query, [library.name, library.codeName, library.category]),
  );
  const result = page(libraries, input);
  return { libraries: result.items, total: result.total, nextOffset: result.nextOffset };
}

async function publishedLibrary(studio: StudioCtx, projectId: string) {
  const { pkg } = await studio.appCtx.api.getPkgByProjectId(projectId);
  const publication = await studio.appCtx.api.getPkgVersion(ensure(pkg, `Library ${projectId} has no published versions`).id);
  // Browsing a newer publication must not update objects in the active design.
  const { projectDependency } = unbundleProjectDependency(new FastBundler(), publication.pkg, publication.depPkgs);
  assert(projectDependency.projectId === projectId && projectDependency.pkgId === pkg?.id, "Published package does not match requested library");
  return projectDependency;
}

function publicationSummary(studio: StudioCtx, library: ProjectDependency) {
  const installed = studio.site.projectDependencies.find((dep) => dep.projectId === library.projectId);
  return { projectId: library.projectId, name: library.name, version: library.version,
    installedVersion: installed?.version ?? null,
    updateAvailable: !!installed && installed.version !== library.version };
}

function componentSummary(component: Component) {
  const meta = isCodeComponent(component) ? component.codeComponentMeta : undefined;
  return {
    name: component.name,
    displayName: meta?.displayName ?? component.name,
    description: meta?.description ?? undefined,
    importPath: meta?.importPath,
    importName: meta?.importName ?? undefined,
    section: meta?.section ?? undefined,
    isContext: !!meta?.isContext,
  };
}

function libraryComponents(studio: StudioCtx, library: ProjectDependency, query?: string) {
  const catalog = studio.appCtx.appConfig.hostLessComponents ?? DEVFLAGS.hostLessComponents ?? [];
  const hidden = new Set(catalog
    .filter((entry) => ensureArray(entry.projectId).includes(library.projectId))
    .flatMap((entry) => entry.items.filter((item) => item.hidden || item.hiddenOnStore || item.onlyShownIn === "old").map((item) => item.componentName)));
  return library.site.components.filter((component) => !isFrameComponent(component) && !hidden.has(component.name))
    .map(componentSummary)
    .filter((component) => matches(query, [component.name, component.displayName, component.importName, component.importPath, component.description, component.section]));
}

export async function getLibrary(studio: StudioCtx, input: z.infer<typeof PROTOTYPE_TOOL_META.getLibrary.inputSchema>) {
  const library = await publishedLibrary(studio, input.projectId);
  const result = page(libraryComponents(studio, library, input.query), input);
  return {
    ...publicationSummary(studio, library),
    packages: library.site.hostLessPackageInfo?.npmPkg ?? [],
    dependencies: library.site.projectDependencies.map((dep) => ({ projectId: dep.projectId, name: dep.name, version: dep.version })),
    components: result.items, total: result.total, nextOffset: result.nextOffset,
  };
}

export async function searchLibraryComponents(studio: StudioCtx, input: z.infer<typeof PROTOTYPE_TOOL_META.searchLibraryComponents.inputSchema>) {
  const projectIds = input.projectId ? [input.projectId] : [...new Set(availableLibraries(studio).flatMap((library) => library.projectIds))];
  const components: (ReturnType<typeof componentSummary> & { projectId: string; libraryName: string; version: string })[] = [];
  const libraries: ReturnType<typeof publicationSummary>[] = [];
  const failures: { projectId: string; message: string }[] = [];
  // Bound publication downloads; a large store must not flood the API.
  for (const batch of chunk(projectIds, 4)) {
    const results = await Promise.allSettled(batch.map((id) => publishedLibrary(studio, id)));
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        failures.push({ projectId: batch[index], message: result.reason instanceof Error ? result.reason.message : String(result.reason) });
        return;
      }
      const library = result.value;
      libraries.push(publicationSummary(studio, library));
      components.push(...libraryComponents(studio, library, input.query).map((component) => ({
        ...component, projectId: library.projectId, libraryName: library.name, version: library.version,
      })));
    });
  }
  const result = page(components, input);
  return { components: result.items, libraries, failures, total: result.total, nextOffset: result.nextOffset };
}
