import {
  getUiAppearance,
  setAppearancePreference,
} from "@/wab/client/ui-theme";
afterEach(() => {
  Reflect.deleteProperty(window, "desktopEnvironment");
  setAppearancePreference("dark");
});
it("sends the resolved Studio appearance to the native desktop bridge", () => {
  const setUiAppearance = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(window, "desktopEnvironment", {
    configurable: true,
    value: { setUiAppearance },
  });
  setAppearancePreference("light");
  expect(setUiAppearance).toHaveBeenLastCalledWith("light");
  setAppearancePreference("dark");
  expect(setUiAppearance).toHaveBeenLastCalledWith("dark");
  setAppearancePreference("system");
  expect(setUiAppearance).toHaveBeenLastCalledWith(getUiAppearance());
});
it("syncs external preference changes through the same appearance source", () => {
  const setUiAppearance = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(window, "desktopEnvironment", {
    configurable: true,
    value: { setUiAppearance },
  });
  localStorage.setItem("shiguang.ui.appearance", "light");
  window.dispatchEvent(
    new StorageEvent("storage", { key: "shiguang.ui.appearance" }),
  );
  expect(getUiAppearance()).toBe("light");
  expect(setUiAppearance).toHaveBeenLastCalledWith("light");
});
