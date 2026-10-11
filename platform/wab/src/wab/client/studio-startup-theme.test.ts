import { readFileSync } from "fs";
import { resolve } from "path";

const html = readFileSync(resolve(process.cwd(), "public/index.html"), "utf8");
const script = html.slice(
  html.indexOf("      // Resolve appearance"),
  html.indexOf("    </script>"),
);

it.each([
  [null, false, "light"],
  [null, true, "dark"],
  ["dark", false, "dark"],
  ["light", true, "light"],
  ["system", true, "dark"],
  ["system", false, "light"],
  ["invalid", false, "light"],
  ["invalid", true, "dark"],
])(
  "resolves initial appearance %s before React mounts",
  (stored, matches, expected) => {
    const root = { dataset: {} as Record<string, string> };
    const media = { matches, addEventListener: vi.fn() };
    const run = new Function("window", "document", "localStorage", "maybeParams", script);
    run(
      { matchMedia: () => media, addEventListener: vi.fn() },
      { documentElement: root },
      { getItem: () => stored },
    );
    expect(root.dataset.uiAppearance).toBe(expected);
  },
);

it.each([false, true])(
  "follows the system when storage is unavailable (dark: %s)",
  (matches) => {
    const root = { dataset: {} as Record<string, string> };
    new Function("window", "document", "localStorage", "maybeParams", script)(
      {
        matchMedia: () => ({ matches, addEventListener: vi.fn() }),
        addEventListener: vi.fn(),
      },
      { documentElement: root },
      {
        getItem: () => {
          throw new Error("Storage denied");
        },
      },
    );
    expect(root.dataset.uiAppearance).toBe(matches ? "dark" : "light");
  },
);

it.each(["dark", "light"])(
  "paints the inherited host appearance %s before accessing host storage",
  (appearance) => {
    const root = { dataset: {} as Record<string, string> };
    const getItem = vi.fn(() => {
      throw new Error("Host storage unavailable");
    });
    new Function("window", "document", "localStorage", "maybeParams", script)(
      { matchMedia: () => ({ matches: appearance !== "dark" }) },
      { documentElement: root },
      { getItem },
      new URLSearchParams({ uiAppearance: appearance }),
    );
    expect(root.dataset.uiAppearance).toBe(appearance);
    expect(getItem).not.toHaveBeenCalled();
  },
);

it("ignores an invalid inherited appearance and resolves the stored preference", () => {
  const root = { dataset: {} as Record<string, string> };
  new Function("window", "document", "localStorage", "maybeParams", script)(
    { matchMedia: () => ({ matches: false }) },
    { documentElement: root },
    { getItem: () => "dark" },
    new URLSearchParams({ uiAppearance: "invalid" }),
  );
  expect(root.dataset.uiAppearance).toBe("dark");
});

it("tracks system changes while retaining the host's inherited appearance", async () => {
  let onChange: () => void = () => {};
  const media = {
    matches: false,
    addEventListener: (_event: string, listener: () => void) => {
      onChange = listener;
    },
  };
  const matchMedia = vi
    .spyOn(window, "matchMedia")
    .mockReturnValue(media as MediaQueryList);
  localStorage.removeItem("shiguang.ui.appearance");
  const { setAppearancePreference, setUiAppearance, getUiAppearance } =
    await import("@/wab/client/ui-theme");
  try {
    expect(getUiAppearance()).toBe("light");
    media.matches = true;
    onChange();
    expect(document.documentElement.dataset.uiAppearance).toBe("dark");
    setAppearancePreference("light");
    onChange();
    expect(getUiAppearance()).toBe("light");
    setAppearancePreference("dark");
    media.matches = false;
    onChange();
    expect(getUiAppearance()).toBe("dark");
    setAppearancePreference("system");
    expect(getUiAppearance()).toBe("light");
    setUiAppearance("light");
    onChange();
    expect(getUiAppearance()).toBe("light");
    expect(document.documentElement.dataset.uiAppearance).toBe("light");
  } finally {
    setAppearancePreference("dark");
    matchMedia.mockRestore();
  }
});
