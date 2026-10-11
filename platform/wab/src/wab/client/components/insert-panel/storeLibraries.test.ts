import type { AddItemGroup } from "@/wab/client/components/insert-panel/InsertPanel";
import {
  getStoreLibraryContents,
  groupStoreLibraries,
  groupStoreLibrarySections,
} from "@/wab/client/components/insert-panel/storeLibraries";
import { AddItemType } from "@/wab/client/definitions/insertables";

function group(key: string, installOnly = false): AddItemGroup {
  return {
    key,
    label: "Ant Design 6",
    familyKey: "hostless-packages",
    hostLessPackageInfo: {
      type: "hostless-package",
      name: "Ant Design 6",
      projectId: ["antd6-project"],
      sectionLabel: installOnly ? "Design systems" : "Ant Design",
      isInstallOnly: installOnly,
      items: [],
    },
    items: [
      {
        type: AddItemType.fake,
        key: installOnly ? "cover" : "button",
        label: "Button",
        icon: null,
        isPackage: installOnly,
        factory: () => true,
      },
    ],
  };
}

it("merges a library cover and component listing by project identity, independent of catalog order", () => {
  for (const groups of [
    [group("cover", true), group("components")],
    [group("components"), group("cover", true)],
  ]) {
    const libraries = groupStoreLibraries(groups);
    expect(libraries).toHaveLength(1);
    expect(libraries[0].category).toBe("Design systems");
    expect(
      getStoreLibraryContents(libraries[0])
        .flatMap((g) => g.items)
        .map((item) => item.key),
    ).toEqual(["button"]);
  }
});

it("groups real libraries by catalog category and keeps temporary built-ins separate", () => {
  const groups = [
    "Icons",
    "Business components",
    "Design systems",
    "UI kits",
  ].map((category) => {
    const entry = group(category, true);
    if (entry.hostLessPackageInfo) {
      Object.assign(entry.hostLessPackageInfo, {
        projectId: [category],
        sectionLabel: category,
      });
    }
    return entry;
  });
  const builtin = group("builtin", true);
  if (builtin.hostLessPackageInfo) {
    Object.assign(builtin.hostLessPackageInfo, {
      syntheticPackage: true,
      codeName: "plume",
      projectId: [],
    });
  }
  const sections = groupStoreLibrarySections(
    groupStoreLibraries([builtin, ...groups]),
  );
  expect(sections.map((section) => section.category)).toEqual([
    "Design systems",
    "UI kits",
    "Business components",
    "Icons",
    "Built-in components",
  ]);
  expect(sections.flatMap((section) => section.libraries)).toHaveLength(5);
  expect(sections[4].libraries[0].synthetic).toBe(true);
});

it("keeps distinct UI kits and versions separate and does not invent a component catalog", () => {
  const secondVersion = group("antd5", true);
  if (secondVersion.hostLessPackageInfo) {
    secondVersion.hostLessPackageInfo.projectId = ["antd5-project"];
  }
  const kits: AddItemGroup = {
    key: "ui-kits",
    label: "UI kits",
    items: ["kit-a", "kit-b"].map((key) => ({
      type: AddItemType.installable,
      key,
      label: key,
      projectId: key,
      isPackage: true,
      icon: null,
      factory: () => undefined,
    })),
  };
  const libraries = groupStoreLibraries([
    group("antd6", true),
    secondVersion,
    kits,
  ]);
  expect(libraries).toHaveLength(4);
  expect(getStoreLibraryContents(libraries[0])).toEqual([]);
  expect(libraries.slice(2).map((library) => library.name)).toEqual([
    "kit-a",
    "kit-b",
  ]);
});

it("uses real installed contents when store listings have been suppressed after installation", () => {
  const contents = group("installed-components");
  contents.hostLessPackageInfo = undefined;
  contents.familyKey = "installed";
  contents.projectIds = ["antd6-project"];
  const unrelated = {
    ...contents,
    key: "other",
    projectIds: ["other-project"],
  };
  const library = groupStoreLibraries(
    [group("cover", true)],
    [contents, unrelated],
  )[0];
  expect(
    getStoreLibraryContents(library)
      .flatMap((g) => g.items)
      .map((item) => item.key),
  ).toEqual(["button"]);
});

it("separates synthetic entry points without treating empty project IDs as the same library", () => {
  const groups = ["plume", "unstyled"].map((codeName) => {
    const entry = group(codeName, true);
    if (entry.hostLessPackageInfo) {
      Object.assign(entry.hostLessPackageInfo, {
        projectId: [],
        codeName,
        syntheticPackage: true,
      });
    }
    return entry;
  });
  expect(
    groupStoreLibraries(groups).map((library) => library.category),
  ).toEqual(["Customizable components", "Basic elements"]);
});
