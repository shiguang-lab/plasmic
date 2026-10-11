import type { AddItemGroup } from "@/wab/client/components/insert-panel/InsertPanel";
import { AddItemType } from "@/wab/client/definitions/insertables";
import { ensureArray } from "@/wab/shared/common";
import { groupBy } from "lodash";

export function groupStoreLibraries(
  groups: AddItemGroup[],
  installedGroups: AddItemGroup[] = [],
) {
  const libraries = new Map<
    string,
    {
      key: string;
      name: string;
      category: string;
      imageUrl?: string;
      projectIds: string[];
      synthetic: boolean;
      groups: AddItemGroup[];
    }
  >();
  for (const group of groups.flatMap((entry) =>
    entry.hostLessPackageInfo
      ? [entry]
      : entry.items.map((item) => ({ ...entry, key: item.key, items: [item] })),
  )) {
    const meta = group.hostLessPackageInfo;
    const projectIds = meta ? ensureArray(meta.projectId) : [];
    const key = meta?.syntheticPackage
      ? `synthetic:${meta.codeName}`
      : meta?.bundleName
        ? `bundle:${meta.bundleName}`
        : projectIds.length
          ? [...projectIds].sort().join(":")
          : group.key;
    const existing = libraries.get(key);
    if (existing) {
      existing.groups.push(group);
      existing.projectIds = [
        ...new Set([...existing.projectIds, ...projectIds]),
      ];
      if (meta?.isInstallOnly) {
        existing.category = meta.sectionLabel;
        existing.imageUrl = meta.imageUrl ?? group.items[0]?.previewImageUrl;
      }
      continue;
    }
    libraries.set(key, {
      key,
      name: meta?.name ?? group.items[0]?.label ?? group.label,
      category: meta?.syntheticPackage
        ? meta.codeName === "unstyled"
          ? "Basic elements"
          : "Customizable components"
        : (meta?.sectionLabel ?? "UI kits"),
      imageUrl: meta?.imageUrl ?? group.items[0]?.previewImageUrl,
      projectIds,
      synthetic: !!meta?.syntheticPackage,
      groups: [group],
    });
  }
  for (const library of libraries.values()) {
    const contents = installedGroups.filter((group) =>
      group.projectIds?.some((id) => library.projectIds.includes(id)),
    );
    if (contents.length) {
      library.groups = [
        ...library.groups.filter(
          (group) => group.hostLessPackageInfo?.isInstallOnly,
        ),
        ...contents,
      ];
    }
  }
  return [...libraries.values()].sort(
    (a, b) => Number(a.synthetic) - Number(b.synthetic),
  );
}

export type StoreLibrary = ReturnType<typeof groupStoreLibraries>[number];

export function groupStoreLibrarySections(libraries: StoreLibrary[]) {
  const order = ["Design systems", "UI kits", "Business components", "Icons"];
  const rank = (category: string) =>
    category === "Built-in components"
      ? order.length + 1
      : order.includes(category)
        ? order.indexOf(category)
        : order.length;
  return Object.entries(
    groupBy(libraries, (library) =>
      library.synthetic ? "Built-in components" : library.category,
    ),
  )
    .sort(([a], [b]) => rank(a) - rank(b))
    .map(([category, entries]) => ({ category, libraries: entries }));
}

export function getStoreLibraryContents(library: StoreLibrary) {
  const seen = new Set<string>();
  return library.groups.flatMap((group) => {
    const items = group.items.filter((item) => {
      if (
        (item.type === AddItemType.fake && item.isPackage) ||
        item.type === AddItemType.installable ||
        seen.has(item.key)
      ) {
        return false;
      }
      seen.add(item.key);
      return true;
    });
    return items.length
      ? [
          {
            ...group,
            isHeaderLess: group.isHeaderLess || group.label === library.name,
            items,
          },
        ]
      : [];
  });
}
