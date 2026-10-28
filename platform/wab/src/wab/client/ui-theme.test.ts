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
  expect(document.documentElement.style.colorScheme).toBe("light");
  setAppearancePreference("dark");
  expect(setUiAppearance).toHaveBeenLastCalledWith("dark");
  expect(document.documentElement.style.colorScheme).toBe("dark");
  setAppearancePreference("system");
  expect(setUiAppearance).toHaveBeenLastCalledWith(getUiAppearance());
  expect(document.documentElement.style.colorScheme).toBe(getUiAppearance());
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
  expect(document.documentElement.style.colorScheme).toBe("light");
  expect(setUiAppearance).toHaveBeenLastCalledWith("light");
});

it.each([null, "invalid"])("defaults to dark for preference %s", (value) => {
  setAppearancePreference("light");
  if (value === null) {
    localStorage.removeItem("shiguang.ui.appearance");
  } else {
    localStorage.setItem("shiguang.ui.appearance", value);
  }
  window.dispatchEvent(
    new StorageEvent("storage", { key: "shiguang.ui.appearance" }),
  );
  expect(getUiAppearance()).toBe("dark");
  expect(document.documentElement.dataset.uiAppearance).toBe("dark");
});

it("retains the startup host appearance until the live frame bridge connects", async () => {
  vi.resetModules();
  Object.defineProperty(window, "__PlasmicStudioArgs", {
    configurable: true,
    value: "#origin=https%3A%2F%2Fstudio.example&uiAppearance=dark",
  });
  localStorage.setItem("shiguang.ui.appearance", "light");
  try {
    const hostTheme = await import("@/wab/client/ui-theme");
    expect(hostTheme.getUiAppearance()).toBe("dark");
    expect(document.documentElement.dataset.uiAppearance).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    window.dispatchEvent(
      new StorageEvent("storage", { key: "shiguang.ui.appearance" }),
    );
    expect(hostTheme.getUiAppearance()).toBe("dark");
    hostTheme.setUiAppearance("light");
    expect(hostTheme.getUiAppearance()).toBe("light");
    expect(document.documentElement.style.colorScheme).toBe("light");
    expect(localStorage.getItem("shiguang.ui.appearance")).toBe("light");
  } finally {
    Reflect.deleteProperty(window, "__PlasmicStudioArgs");
    vi.resetModules();
  }
});
