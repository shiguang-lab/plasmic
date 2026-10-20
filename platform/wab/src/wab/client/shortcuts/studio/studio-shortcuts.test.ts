afterEach(() => {
  vi.doUnmock("@/wab/client/platform");
  vi.resetModules();
});

test.each([
  ["osx", "command+enter", "option+enter"],
  ["windows", "ctrl+enter", "alt+enter"],
  ["linux", "ctrl+enter", "alt+enter"],
])("reserves the presentation shortcut on %s without conflicts", async (platform, present, edit) => {
  vi.resetModules();
  vi.doMock("@/wab/client/platform", () => ({ PLATFORM: platform }));
  const { STUDIO_SHORTCUTS } = await import("@/wab/client/shortcuts/studio/studio-shortcuts");
  expect(STUDIO_SHORTCUTS.PRESENT.combos).toEqual([present]);
  expect(STUDIO_SHORTCUTS.ENTER_EDIT.combos).toEqual([edit]);
  expect(Object.values(STUDIO_SHORTCUTS).filter((shortcut) => shortcut.combos.includes(present))).toEqual([STUDIO_SHORTCUTS.PRESENT]);
});
