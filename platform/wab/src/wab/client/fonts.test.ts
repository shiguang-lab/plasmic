import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { FontManager } from "@/wab/client/fonts";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ensure } from "@/wab/shared/common";
import { createSite } from "@/wab/shared/core/sites";
import { ProjectDependency, Site } from "@/wab/shared/model/classes";
import { notification } from "antd";
import $ from "jquery";
import { mock } from "vitest-mock-extended";

beforeEach(() => {
  // jsdom cannot measure fonts. Named fonts are unavailable in this fixture.
  document.body.innerHTML = '<span class="fontTester"></span>';
  vi.spyOn($.fn, "width").mockReturnValue(100);
});

afterEach(() => {
  document.body.innerHTML = "";
});

it.each([
  "monospace",
  "serif",
  "sans-serif",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-serif",
  "ui-sans-serif",
  "ui-monospace",
  "ui-rounded",
  "MONOSPACE",
])("does not report %s as missing when a project opens", async (family) => {
  const site = createSite();
  ensure(site.activeTheme, "theme").defaultStyle.rs.values["font-family"] =
    family;
  const warn = vi.spyOn(notification, "warning");
  const manager = new FontManager(site);

  // Exercise installs queued before the local-font check completes.
  manager.installAllUsedFonts([]);
  await Promise.resolve();
  manager.installAllUsedFonts([]);
  manager.installAllUsedFonts([]);

  expect(manager.isUserManagedFontInstalled(family)).toBe(true);
  expect(manager.missingUsedFonts()).not.toContain(family);
  expect(warn).not.toHaveBeenCalled();
});

it("does not warn when switching to a generic family after opening", async () => {
  const site = createSite();
  const manager = new FontManager(site);
  await Promise.resolve();
  const warn = vi.spyOn(notification, "warning");
  const studioCtx = mock<StudioCtx>({ site });
  Object.defineProperty(studioCtx, "viewCtxs", { value: [] });

  manager.loadFont(studioCtx, "ui-monospace");
  manager.installAllUsedFonts([]);

  expect(manager.missingUsedFonts()).not.toContain("ui-monospace");
  expect(warn).not.toHaveBeenCalled();
});

it("still reports and warns about a missing named font", async () => {
  const site = createSite();
  ensure(site.activeTheme, "theme").defaultStyle.rs.values["font-family"] =
    "Missing Font";
  const warn = vi.spyOn(notification, "warning");
  const manager = new FontManager(site);
  manager.installAllUsedFonts([]);
  await Promise.resolve();
  manager.installAllUsedFonts([]);

  expect(manager.isUserManagedFontInstalled("Missing Font")).toBe(false);
  expect(manager.missingUsedFonts()).toContain("Missing Font");
  expect(warn).toHaveBeenCalledWith({
    message: 'Font "Missing Font" is not available on this machine',
    description: "This font won't be rendered correctly.",
  });
});

it("recognizes installed fonts outside the common font list on project open", async () => {
  vi.mocked($.fn.width).mockImplementation(function (this: JQuery) {
    return this.css("font-family").includes("Menlo") ? 200 : 100;
  } as any);
  const site = createSite();
  ensure(site.activeTheme, "theme").defaultStyle.rs.values["font-family"] =
    "Menlo";
  const warn = vi.spyOn(notification, "warning");
  const manager = new FontManager(site);
  manager.installAllUsedFonts([]);
  await Promise.resolve();
  manager.installAllUsedFonts([]);
  manager.installAllUsedFonts([]);

  expect(manager.isUserManagedFontInstalled("Menlo")).toBe(true);
  expect(manager.missingUsedFonts()).not.toContain("Menlo");
  expect(warn).not.toHaveBeenCalled();
});

it.each([true, false])(
  "waits for a newly used font to be checked (installed: %s)",
  async (installed) => {
    vi.mocked($.fn.width).mockImplementation(function (this: JQuery) {
      return installed && this.css("font-family").includes("Menlo")
        ? 200
        : 100;
    } as any);
    const site = createSite();
    const manager = new FontManager(site);
    await Promise.resolve();
    const warn = vi.spyOn(notification, "warning");
    const studioCtx = mock<StudioCtx>({ site });
    Object.defineProperty(studioCtx, "viewCtxs", { value: [] });

    manager.loadFont(studioCtx, "Menlo");
    manager.installAllUsedFonts([]);
    expect(warn).not.toHaveBeenCalled();
    await Promise.resolve();
    manager.installAllUsedFonts([]);

    expect(manager.isUserManagedFontInstalled("Menlo")).toBe(installed);
    expect(manager.missingUsedFonts().includes("Menlo")).toBe(!installed);
    if (installed) {
      expect(warn).not.toHaveBeenCalled();
    } else {
      expect(warn).toHaveBeenCalledWith({
        message: 'Font "Menlo" is not available on this machine',
        description: "This font won't be rendered correctly.",
      });
    }
  },
);

function mkDependency(site: Site, suffix: string) {
  return new ProjectDependency({
    name: `Dependency ${suffix}`,
    pkgId: `pkg-${suffix}`,
    projectId: `project-${suffix}`,
    version: "0.0.1",
    uuid: `dep-${suffix}`,
    site,
  });
}

it("derives immutable own and imported font lists with noop structural sharing", async () => {
  const importedSite = createSite({
    userManagedFonts: ["Imported B", "Own A", "Imported A", "Imported B"],
  });
  const site = createSite({
    userManagedFonts: ["Own A", "Own B", "Own A"],
    projectDependencies: [mkDependency(importedSite, "initial")],
  });
  const manager = new FontManager(site);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const initial = manager.store.getState();

  expect(initial.ownUserManagedFonts).toEqual(["Own A", "Own B", "Own A"]);
  expect(initial.importedUserManagedFonts).toEqual([
    "Imported B",
    "Imported A",
  ]);
  expect(initial.userManagedFonts).toEqual([
    "Own A",
    "Own B",
    "Imported B",
    "Imported A",
  ]);
  expect(Object.isFrozen(initial.ownUserManagedFonts)).toBe(true);
  expect(Object.isFrozen(initial.importedUserManagedFonts)).toBe(true);
  expect(Object.isFrozen(initial.userManagedFonts)).toBe(true);

  const publish = vi.fn();
  const stop = manager.store.subscribe(publish);
  manager.syncSite(site);
  expect(manager.store.getState()).toBe(initial);
  expect(publish).not.toHaveBeenCalled();

  manager.dispose();
  manager.syncSite(site);
  expect(manager.store.getState()).toBe(initial);
  expect(publish).not.toHaveBeenCalled();
  stop();
});

it("tracks committed same-length font edits and ignores unrelated sources", async () => {
  const importedSite = createSite({
    userManagedFonts: ["Imported A", "Own A"],
  });
  const site = createSite({
    userManagedFonts: ["Own A"],
    projectDependencies: [mkDependency(importedSite, "initial")],
  });
  const { studioCtx } = fakeStudioCtx({ site });
  await vi.waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
  const manager = studioCtx.fontManager;
  const publish = vi.fn();
  const stop = manager.store.subscribe(publish);

  expect(manager.store.getState().ownUserManagedFonts).toEqual(["Own A"]);
  expect(manager.store.getState().importedUserManagedFonts).toEqual([
    "Imported A",
  ]);

  await studioCtx.changeUnsafe(() => {
    site.userManagedFonts.splice(0, 1, "Own B");
  });
  expect(manager.store.getState().ownUserManagedFonts).toEqual(["Own B"]);
  expect(manager.store.getState().importedUserManagedFonts).toEqual([
    "Imported A",
    "Own A",
  ]);
  expect(manager.store.getState().userManagedFonts).toEqual([
    "Own B",
    "Imported A",
    "Own A",
  ]);

  const settled = manager.store.getState();
  publish.mockClear();
  await studioCtx.changeUnsafe(() => {
    site.flags = { ...site.flags, fontStateUnrelated: true };
  });
  expect(manager.store.getState()).toBe(settled);
  expect(publish).not.toHaveBeenCalled();
  stop();
});

it("refreshes imported fonts when direct dependencies are replaced or removed", async () => {
  const initialDep = mkDependency(
    createSite({ userManagedFonts: ["Imported A", "Own A"] }),
    "initial",
  );
  const site = createSite({
    userManagedFonts: ["Own A"],
    projectDependencies: [initialDep],
  });
  const manager = new FontManager(site);
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(manager.store.getState().ownUserManagedFonts).toEqual(["Own A"]);
  expect(manager.store.getState().importedUserManagedFonts).toEqual([
    "Imported A",
  ]);

  site.projectDependencies = [
    mkDependency(
      createSite({
        userManagedFonts: ["Imported B", "Own A", "Imported B"],
      }),
      "replacement",
    ),
  ];
  manager.syncSite(site);
  expect(manager.store.getState().ownUserManagedFonts).toEqual(["Own A"]);
  expect(manager.store.getState().importedUserManagedFonts).toEqual([
    "Imported B",
  ]);

  site.projectDependencies = [];
  manager.syncSite(site);
  expect(manager.store.getState().importedUserManagedFonts).toEqual([]);
  manager.dispose();
});
