import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { parseBundledFontsManifest } from "@/wab/client/bundled-fonts";
import { FontManager } from "@/wab/client/fonts";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ensure } from "@/wab/shared/common";
import { createSite } from "@/wab/shared/core/sites";
import { ProjectDependency, Site } from "@/wab/shared/model/classes";
import { getStaticBaseUrl } from "@/wab/shared/urls";
import { notification } from "antd";
import fs from "fs";
import $ from "jquery";
import path from "path";
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
  "-apple-system",
  "BlinkMacSystemFont",
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

it("offers generic families and detected common local fonts in the picker", async () => {
  vi.mocked($.fn.width).mockImplementation(function (this: JQuery) {
    return this.css("font-family").includes("PingFang SC") ? 200 : 100;
  } as any);
  const manager = new FontManager(createSite());
  await Promise.resolve();

  const families = manager.availFonts().map((font) => font.fontFamily);
  expect(families).toEqual(
    expect.arrayContaining([
      "system-ui", "serif", "sans-serif", "monospace", "PingFang SC",
    ]),
  );
  expect(families).not.toContain("Microsoft YaHei");
  manager.dispose();
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

it("suppresses missing-font notifications when warnMissingFonts is false", async () => {
  const site = createSite();
  ensure(site.activeTheme, "theme").defaultStyle.rs.values["font-family"] =
    "Missing Font";
  const warn = vi.spyOn(notification, "warning");
  try {
    const manager = new FontManager(site, { warnMissingFonts: false });
    manager.installAllUsedFonts([]);
    await Promise.resolve();
    manager.installAllUsedFonts([]);

    expect(manager.missingUsedFonts()).toContain("Missing Font");
    expect(warn).not.toHaveBeenCalled();

    const studioCtx = mock<StudioCtx>({ site });
    Object.defineProperty(studioCtx, "viewCtxs", { value: [] });
    manager.loadFont(studioCtx, "Another Missing Font");
    await Promise.resolve();
    manager.installAllUsedFonts([]);

    expect(warn).not.toHaveBeenCalled();
    manager.dispose();
  } finally {
    warn.mockRestore();
  }
});

it("uses bundled stylesheets for built-in google fonts without duplicating links", async () => {
  const site = createSite();
  ensure(site.activeTheme, "theme").defaultStyle.rs.values["font-family"] =
    "Roboto";
  const head = document.createElement("head");
  const manager = new FontManager(site, {
    bundledFonts: {
      families: { Roboto: "roboto.css" },
      fallbacks: {},
    },
  });
  await Promise.resolve();

  manager.installAllUsedFonts([$(head)]);
  manager.installAllUsedFonts([$(head)]);

  const links = Array.from(head.querySelectorAll('link[rel="stylesheet"]'));
  const hrefs = links.map((link) => link.getAttribute("href"));
  expect(
    hrefs.filter(
      (href) => href === `${getStaticBaseUrl()}/desktop-fonts/roboto.css`,
    ),
  ).toHaveLength(1);
  expect(
    hrefs.filter((href) =>
      href?.startsWith("https://fonts.googleapis.com/css?family=Inconsolata"),
    ),
  ).toHaveLength(1);
  expect(hrefs).toHaveLength(2);
  manager.dispose();
});

it("treats local fonts with bundled metric fallbacks as available and injects fallback CSS only when absent", async () => {
  const site = createSite();
  ensure(site.activeTheme, "theme").defaultStyle.rs.values["font-family"] =
    "Arial";
  const warn = vi.spyOn(notification, "warning");
  try {
    const head = document.createElement("head");
    const manager = new FontManager(site, {
      bundledFonts: {
        families: { Arimo: "arimo.css" },
        fallbacks: { Arial: "aliases/arial.css" },
      },
    });
    manager.installAllUsedFonts([$(head)]);
    await Promise.resolve();
    manager.installAllUsedFonts([$(head)]);

    expect(manager.isUserManagedFontInstalled("Arial")).toBe(true);
    expect(manager.missingUsedFonts()).not.toContain("Arial");
    expect(warn).not.toHaveBeenCalled();

    const links = Array.from(head.querySelectorAll('link[rel="stylesheet"]'));
    expect(
      links.some(
        (link) =>
          link.getAttribute("href") ===
          `${getStaticBaseUrl()}/desktop-fonts/aliases/arial.css`,
      ),
    ).toBe(true);
    manager.dispose();
  } finally {
    warn.mockRestore();
  }
});

it("skips bundled fallback stylesheet once the local font is detected on the machine", async () => {
  vi.mocked($.fn.width).mockImplementation(function (this: JQuery) {
    return this.css("font-family").includes("Arial") ? 200 : 100;
  } as any);
  const site = createSite();
  ensure(site.activeTheme, "theme").defaultStyle.rs.values["font-family"] =
    "Arial";
  const head = document.createElement("head");
  const manager = new FontManager(site, {
    bundledFonts: {
      families: { Arimo: "arimo.css" },
      fallbacks: { Arial: "aliases/arial.css" },
    },
  });
  await Promise.resolve();
  manager.installAllUsedFonts([$(head)]);

  const hrefs = Array.from(head.querySelectorAll('link[rel="stylesheet"]')).map(
    (link) => link.getAttribute("href"),
  );
  expect(hrefs.some((href) => href?.includes("aliases/arial.css"))).toBe(false);
  manager.dispose();
});

it("creates a fallback fontTester element when none exists in the document", async () => {
  document.body.innerHTML = "";
  vi.mocked($.fn.width).mockImplementation(function (this: JQuery) {
    return this.css("font-family").includes("Menlo") ? 200 : 100;
  } as any);
  const site = createSite();
  ensure(site.activeTheme, "theme").defaultStyle.rs.values["font-family"] =
    "Menlo";
  const manager = new FontManager(site);
  await Promise.resolve();

  expect(document.querySelector(".fontTester")).not.toBeNull();
  expect(manager.isUserManagedFontInstalled("Menlo")).toBe(true);
  manager.dispose();
});

it("parses bundled fonts manifests and ignores unreplaced placeholders", () => {
  expect(parseBundledFontsManifest("__PLASMIC_BUNDLED_FONTS__")).toEqual({
    families: {},
    fallbacks: {},
  });
  expect(parseBundledFontsManifest("not-valid-base64!!!")).toEqual({
    families: {},
    fallbacks: {},
  });

  const encoded = Buffer.from(
    JSON.stringify({
      families: { Inter: "inter.css" },
      fallbacks: { Arial: "aliases/arial.css" },
    }),
    "utf8",
  ).toString("base64");
  expect(parseBundledFontsManifest(encoded)).toEqual({
    families: { Inter: "inter.css" },
    fallbacks: { Arial: "aliases/arial.css" },
  });
});

it("resolves bundled fonts and fallbacks case-insensitively", async () => {
  const site = createSite();
  ensure(site.activeTheme, "theme").defaultStyle.rs.values["font-family"] =
    "arial";
  const head = document.createElement("head");
  const manager = new FontManager(site, {
    bundledFonts: {
      families: { roboto: "roboto.css" },
      fallbacks: { Arial: "aliases/arial.css" },
    },
  });
  await Promise.resolve();
  expect(manager.hasBundledFallback("arial")).toBe(true);
  expect(manager.isUserManagedFontInstalled("arial")).toBe(true);
  expect(manager.missingUsedFonts()).not.toContain("arial");

  manager.installAllUsedFonts([$(head)]);
  const links = Array.from(head.querySelectorAll('link[rel="stylesheet"]'));
  expect(
    links.some(
      (link) =>
        link.getAttribute("href") ===
          `${getStaticBaseUrl()}/desktop-fonts/aliases/arial.css` &&
        link.getAttribute("data-plasmic-bundled-fallback") === "arial",
    ),
  ).toBe(true);

  const studioCtx = mock<StudioCtx>({ site });
  Object.defineProperty(studioCtx, "viewCtxs", { value: [] });
  try {
    manager.loadFont(studioCtx, "Roboto");
    expect(
      Array.from(document.head.querySelectorAll('link[rel="stylesheet"]')).some(
        (link) =>
          link.getAttribute("href") ===
          `${getStaticBaseUrl()}/desktop-fonts/roboto.css`,
      ),
    ).toBe(true);
  } finally {
    document.head.innerHTML = "";
    manager.dispose();
  }
});

it("temporarily disables matching host bundled fallback links while probing local fonts", async () => {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `${getStaticBaseUrl()}/desktop-fonts/aliases/arial.css`;
  link.setAttribute("data-plasmic-bundled-fallback", "arial");
  document.head.appendChild(link);

  // Only treat Arial as available if the bundled fallback link stayed enabled during measurement.
  vi.mocked($.fn.width).mockImplementation(function (this: JQuery) {
    if (this.css("font-family").includes("Arial")) {
      return link.disabled ? 100 : 200;
    }
    return 100;
  } as any);

  const site = createSite();
  const manager = new FontManager(site, {
    bundledFonts: {
      families: { Arimo: "arimo.css" },
      fallbacks: { Arial: "aliases/arial.css" },
    },
  });
  try {
    await Promise.resolve();
    await manager.addUserManagedFont("Arial");

    expect(manager.store.getState().localFonts.has("Arial")).toBe(false);
    expect(link.disabled).toBe(false);
  } finally {
    link.remove();
    manager.dispose();
  }
});

it("includes the fontTester probe in canvas-snapshot.html", () => {
  const html = fs.readFileSync(
    path.resolve(process.cwd(), "public/canvas-snapshot.html"),
    "utf8",
  );
  expect(html).toContain("plasmicTestFont");
  expect(html).toContain('class="fontTester"');
});
