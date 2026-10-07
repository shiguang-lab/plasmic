import { FontManager } from "@/wab/client/fonts";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ensure } from "@/wab/shared/common";
import { createSite } from "@/wab/shared/core/sites";
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
  const studioCtx = mock<StudioCtx>({ site, viewCtxs: [] });

  manager.useFont(studioCtx, "ui-monospace");
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
