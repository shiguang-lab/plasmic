import LeftTabStrip from "@/wab/client/components/studio/LeftTabStrip";
import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { observable } from "mobx";
import React from "react";
const mocks = vi.hoisted(() => ({
  ctx: undefined as any,
  toggleAi: vi.fn().mockResolvedValue(undefined),
  importFigmaFile: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/wab/client/contexts/StudioContexts", () => ({
  useStudioCtx: () => mocks.ctx,
}));
vi.mock("@/wab/client/i18n", () => ({
  useI18n: () => ({ t: (text: string) => text }),
}));
vi.mock("@/wab/client/contexts/AppContexts", () => ({
  useTopFrameApi: () => ({ toggleCopilotChat: mocks.toggleAi }),
}));
vi.mock("@/wab/client/figma-importer/import-file", () => ({
  importFigmaFile: mocks.importFigmaFile,
}));
vi.mock("@/wab/client/components/widgets", () => ({}));
vi.mock("@/wab/client/components/ui/layout-styles", () => ({
  useEditorPopupStyles: () => ({ styles: { root: "popup" } }),
}));
vi.mock(
  "@/wab/client/plasmic/plasmic_kit_left_pane/PlasmicLeftTabStrip",
  () => ({ PlasmicLeftTabStrip: ({ buttons }: any) => <div>{buttons}</div> }),
);
vi.mock("@/wab/client/components/studio/LeftTabButton", () => ({
  default: ({
    label,
    onClick,
    expanded,
    disabled,
    isSelected,
    ...props
  }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-expanded={expanded}
      aria-current={isSelected ? "true" : undefined}
      data-test-tabkey={props["data-test-tabkey"]}
    >
      {label}
    </button>
  ),
}));
beforeEach(() => {
  mocks.toggleAi.mockClear();
  mocks.importFigmaFile.mockClear();
  mocks.ctx = observable({
    appCtx: { selfInfo: {} },
    site: { globalContexts: [] },
    fontManager: { missingUsedFonts: () => [] },
    contentEditorMode: false,
    leftTabKey: undefined as string | undefined,
    libraryTab: "imports",
    setLibraryTab(tab: string) {
      this.libraryTab = tab;
    },
    leftTabGroup: undefined as string | undefined,
    setLeftTabGroup(group: string | undefined) {
      this.leftTabGroup = group;
    },
    panelsHidden: false,
    drawer: true,
    canvasTool: "select",
    isCopilotChatOpen: false,
    config: {} as any,
    getCurrentUiConfig() {
      return this.config;
    },
    showAddDrawer() {
      return this.drawer;
    },
    setShowAddDrawer(show: boolean) {
      this.drawer = show;
    },
    changeUnsafe: async (fn: () => any) => fn(),
    switchLeftTab(tab: string | undefined) {
      this.leftTabKey = tab;
      if (tab) {
        this.leftTabGroup = undefined;
        this.isCopilotChatOpen = false;
      }
    },
    togglePanels() {
      this.panelsHidden = !this.panelsHidden;
    },
    toggleCopilotChat: mocks.toggleAi,
    chatCopilotEnabled: () => false,
  });
});
afterEach(cleanup);
it.each([false, true])(
  "imports .fig from the existing Figma entry in web and Desktop (Desktop: %s)",
  async (desktop) => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      desktop ? "PlasmicDesktop/darwin" : "Mozilla/5.0",
    );
    render(<LeftTabStrip useVersionsCTA={false} />);
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    const input = screen.getByLabelText("Import from Figma", {
      selector: "input",
    });
    const click = vi.spyOn(input, "click");
    fireEvent.click(
      await screen.findByRole("button", { name: "Import from Figma" }),
    );
    expect(click).toHaveBeenCalledOnce();
    expect(input).toHaveAttribute("type", "file");
    expect(input).toHaveAttribute("accept", ".fig");
    const file = new File(["fig-kiwi"], "Design.fig");
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() =>
      expect(mocks.importFigmaFile).toHaveBeenCalledWith(mocks.ctx, file),
    );
    expect(input).toHaveValue("");
    vi.restoreAllMocks();
  },
);

it("does nothing when the Figma file chooser is cancelled", async () => {
  render(<LeftTabStrip useVersionsCTA={false} />);
  fireEvent.change(
    screen.getByLabelText("Import from Figma", { selector: "input" }),
    { target: { files: [] } },
  );
  expect(mocks.importFigmaFile).not.toHaveBeenCalled();
});
it.each([false, true])(
  "shows web import only in Desktop and before More (Desktop: %s)",
  (desktop) => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      desktop
        ? "PlasmicDesktop/darwin"
        : "Mozilla/5.0 Chrome/130.0.0.0 Safari/537.36",
    );
    try {
      render(<LeftTabStrip useVersionsCTA={false} />);
      const entry = screen.queryByRole("button", {
        name: "Import from the web",
      });
      if (desktop) {
        const labels = screen
          .getAllByRole("button")
          .map((button) => button.textContent);
        expect(entry).toBeTruthy();
        expect(labels.indexOf("More")).toBe(
          labels.indexOf("Import from the web") + 1,
        );
      } else {
        expect(entry).toBeNull();
      }
    } finally {
      vi.restoreAllMocks();
    }
  },
);

it("opens Project settings from More when global contexts are available", async () => {
  mocks.ctx.site.globalContexts.push({});
  render(<LeftTabStrip useVersionsCTA={false} />);
  expect(screen.queryByRole("button", { name: "Project settings" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "More" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "Project settings" }),
  );
  expect(mocks.ctx.leftTabKey).toBe("settings");
  expect(mocks.ctx.drawer).toBe(false);
  expect(screen.getByRole("button", { name: "More" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
});
it.each([false, true])(
  "hides Project settings when unavailable (hidden permission: %s)",
  async (hidden) => {
    if (hidden) {
      mocks.ctx.site.globalContexts.push({});
      mocks.ctx.config = { leftTabs: { settings: "hidden" } };
    }
    render(<LeftTabStrip useVersionsCTA={false} />);
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    await screen.findByRole("button", { name: "Expressions" });
    expect(
      screen.queryByRole("button", { name: "Project settings" }),
    ).toBeNull();
  },
);
it("places Libraries after Assets and opens its two secondary choices", async () => {
  render(<LeftTabStrip useVersionsCTA={false} />);
  const labels = screen
    .getAllByRole("button")
    .map((button) => button.textContent);
  expect(labels.indexOf("Libraries")).toBe(labels.indexOf("Assets") + 1);
  const entry = screen.getByRole("button", { name: "Libraries" });
  expect(entry).not.toHaveAttribute("aria-current");
  fireEvent.click(entry);
  expect(mocks.ctx.leftTabKey).toBeUndefined();
  expect(mocks.ctx.leftTabGroup).toBe("libraries");
  expect(mocks.ctx.drawer).toBe(true);
  expect(entry.getAttribute("aria-expanded")).toBe("true");
  expect(entry).toHaveAttribute("aria-current", "true");
  expect(
    await screen.findByRole("button", { name: "Component store" }),
  ).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Imported projects" }),
  ).toBeTruthy();
  fireEvent.click(entry);
  expect(mocks.ctx.leftTabGroup).toBeUndefined();
  expect(entry).not.toHaveAttribute("aria-current");
});
it("does not highlight Libraries when its panel is hidden or covered by Insert", () => {
  mocks.ctx.leftTabKey = "libraries";
  const { unmount } = render(<LeftTabStrip useVersionsCTA={false} />);
  expect(screen.getByRole("button", { name: "Libraries" })).not.toHaveAttribute(
    "aria-current",
  );
  unmount();
  mocks.ctx.drawer = false;
  mocks.ctx.panelsHidden = true;
  render(<LeftTabStrip useVersionsCTA={false} />);
  expect(screen.getByRole("button", { name: "Libraries" })).not.toHaveAttribute(
    "aria-current",
  );
});
it("restores hidden panels when choosing a Library destination and honors hidden entry permission", async () => {
  mocks.ctx.panelsHidden = true;
  const { unmount } = render(<LeftTabStrip useVersionsCTA={false} />);
  fireEvent.click(screen.getByRole("button", { name: "Libraries" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "Component store" }),
  );
  expect(mocks.ctx.panelsHidden).toBe(false);
  expect(mocks.ctx.leftTabKey).toBe("libraries");
  unmount();
  mocks.ctx.config = { leftTabs: { libraries: "hidden" } };
  render(<LeftTabStrip useVersionsCTA={false} />);
  expect(screen.queryByRole("button", { name: "Libraries" })).toBeNull();
});

it.each(["Component store", "Imported projects"])(
  "opens %s from the Library submenu and keeps the Library tool selected",
  async (label) => {
    render(<LeftTabStrip useVersionsCTA={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Libraries" }));
    fireEvent.click(await screen.findByRole("button", { name: label }));
    expect(mocks.ctx.libraryTab).toBe(
      label === "Component store" ? "store" : "imports",
    );
    expect(mocks.ctx.leftTabKey).toBe("libraries");
    expect(mocks.ctx.leftTabGroup).toBeUndefined();
    expect(mocks.ctx.drawer).toBe(false);
    expect(screen.getByRole("button", { name: "Libraries" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByRole("button", { name: "Libraries" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  },
);

it.each(["hidden", "anonymous"])(
  "hides imported projects in the Library submenu for %s access",
  async (access) => {
    if (access === "hidden") {
      mocks.ctx.config = { leftTabs: { imports: "hidden" } };
    } else {
      mocks.ctx.appCtx.selfInfo = null;
    }
    render(<LeftTabStrip useVersionsCTA={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Libraries" }));
    expect(
      await screen.findByRole("button", { name: "Component store" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Imported projects" }),
    ).toBeNull();
  },
);

it("Escape closes the Library submenu and restores focus to its tool", async () => {
  render(<LeftTabStrip useVersionsCTA={false} />);
  const entry = screen.getByRole("button", { name: "Libraries" });
  fireEvent.click(entry);
  const store = await screen.findByRole("button", { name: "Component store" });
  store.focus();
  fireEvent.keyDown(document, { key: "Escape" });
  await waitFor(() => expect(entry).toHaveFocus());
  expect(mocks.ctx.leftTabGroup).toBeUndefined();
});

it("opening More preserves AI and clicking AI closes More", async () => {
  mocks.ctx.isCopilotChatOpen = true;
  mocks.ctx.chatCopilotEnabled = () => true;
  render(<LeftTabStrip useVersionsCTA={false} />);
  fireEvent.click(screen.getByRole("button", { name: "More" }));
  await screen.findByRole("button", { name: "Expressions" });
  expect(mocks.ctx.isCopilotChatOpen).toBe(true);
  expect(mocks.ctx.leftTabGroup).toBe("more");
  fireEvent.click(screen.getByRole("button", { name: "AI" }));
  expect(mocks.toggleAi).toHaveBeenCalledOnce();
  expect(screen.getByRole("button", { name: "More" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
});

it.each([
  ["store", "Component store", "Imported projects"],
  ["imports", "Imported projects", "Component store"],
])(
  "highlights only %s when Libraries is open with that active tab",
  async (tab, activeLabel, inactiveLabel) => {
    mocks.ctx.leftTabKey = "libraries";
    mocks.ctx.libraryTab = tab;
    mocks.ctx.drawer = false;
    mocks.ctx.leftTabGroup = "libraries";
    render(<LeftTabStrip useVersionsCTA={false} />);
    const activeBtn = await screen.findByRole("button", { name: activeLabel });
    const inactiveBtn = screen.getByRole("button", { name: inactiveLabel });
    expect(activeBtn).toHaveAttribute("aria-current", "true");
    expect(inactiveBtn).not.toHaveAttribute("aria-current");
  },
);

it("switches library destination without closing panel when another choice is selected", async () => {
  mocks.ctx.leftTabKey = "libraries";
  mocks.ctx.libraryTab = "store";
  mocks.ctx.drawer = false;
  mocks.ctx.leftTabGroup = "libraries";
  render(<LeftTabStrip useVersionsCTA={false} />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Imported projects" }),
  );
  expect(mocks.ctx.libraryTab).toBe("imports");
  expect(mocks.ctx.leftTabKey).toBe("libraries");
});

it("keeps panel open when currently active library choice is clicked again", async () => {
  mocks.ctx.leftTabKey = "libraries";
  mocks.ctx.libraryTab = "store";
  mocks.ctx.drawer = false;
  mocks.ctx.leftTabGroup = "libraries";
  render(<LeftTabStrip useVersionsCTA={false} />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Component store" }),
  );
  expect(mocks.ctx.leftTabKey).toBe("libraries");
  expect(mocks.ctx.libraryTab).toBe("store");
});

it("switches destination in Assets menu and clicking active item keeps panel open", async () => {
  mocks.ctx.leftTabKey = "tokens";
  mocks.ctx.drawer = false;
  mocks.ctx.leftTabGroup = "assets";
  render(<LeftTabStrip useVersionsCTA={false} />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Components" }),
  );
  expect(mocks.ctx.leftTabKey).toBe("components");

  mocks.ctx.leftTabGroup = "assets";
  fireEvent.click(
    await screen.findByRole("button", { name: "Components" }),
  );
  expect(mocks.ctx.leftTabKey).toBe("components");
});

it("toggles panel closed only when rail button is clicked directly", async () => {
  mocks.ctx.leftTabKey = "lint";
  mocks.ctx.drawer = false;
  mocks.ctx.panelsHidden = false;
  render(<LeftTabStrip useVersionsCTA={false} />);
  fireEvent.click(screen.getByRole("button", { name: "Issues" }));
  expect(mocks.ctx.leftTabKey).toBeUndefined();
});

