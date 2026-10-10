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
    const run = new Function("window", "document", "localStorage", script);
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
    new Function("window", "document", "localStorage", script)(
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
