import LivePopOutButton from "@/wab/client/components/top-bar/LivePopOutButton";
import { STUDIO_SHORTCUTS } from "@/wab/client/shortcuts/studio/studio-shortcuts";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { notification } from "antd";
import React from "react";

const mocks = vi.hoisted(() => ({
  studio: {
    save: vi.fn(),
    hasUnsavedChanges: vi.fn(),
    appCtx: { api: { getStudioUrl: vi.fn() } },
    currentArenaEmpty: false,
    currentArena: {},
    isDevMode: true,
    focusedViewCtx: () => undefined,
    getHostUrl: () => "https://canvas.example",
  },
  preview: { popup: undefined, isLive: false, setPopup: vi.fn() },
  history: {
    location: { pathname: "/projects/project", search: "", hash: "" },
  },
  getUrls: vi.fn(),
  openDesktopPreview: vi.fn(),
}));

vi.mock("@/wab/client/platform", () => ({ PLATFORM: "osx" }));
vi.mock("@/wab/client/observability", () => ({
  analytics: () => ({ track: vi.fn() }),
}));

vi.mock("@/wab/client/contexts/AppContexts", () => ({
  useTopFrameApi: () => ({ openDesktopPreview: mocks.openDesktopPreview }),
}));
vi.mock("@/wab/client/contexts/StudioContexts", () => ({
  useStudioCtx: () => mocks.studio,
}));
vi.mock("@/wab/client/route/HistoryProvider", () => ({
  useHistory: () => mocks.history,
}));
vi.mock("@/wab/client/components/live/PreviewCtx", () => ({
  usePreviewCtx: () => mocks.preview,
  getUrlsForLiveMode: mocks.getUrls,
  isLiveMode: () => false,
}));
vi.mock("@/wab/client/components/live/PreviewFrame", () => ({
  useLivePreview: () => ({
    frameRef: { current: null },
    onLoad: vi.fn(),
    reset: vi.fn(),
  }),
  useFrameBgColor: vi.fn(),
}));
vi.mock(
  "@/wab/client/plasmic/plasmic_kit_top_bar/PlasmicLivePopOutButton",
  () => ({
    PlasmicLivePopOutButton: ({ onClick, root }: any) => (
      <button onClick={onClick} {...root.props} />
    ),
  }),
);

// The header shell is outside these action tests; keep the real action buttons.
vi.mock("@/wab/client/components/BrandLink", () => ({ BrandLink: () => null }));
vi.mock("@/wab/client/components/studio/Avatar", () => ({
  AnonymousAvatar: () => null,
  AvatarGallery: () => null,
}));
vi.mock("@/wab/client/plasmic/plasmic_kit_top_bar/PlasmicTopBar", () => ({
  default: () => null,
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
    "PlasmicDesktop/darwin",
  );
  mocks.studio.save.mockResolvedValue("Success");
  mocks.openDesktopPreview.mockResolvedValue(undefined);
  mocks.studio.hasUnsavedChanges.mockReturnValue(false);
  mocks.studio.appCtx.api.getStudioUrl.mockResolvedValue(
    "https://studio.example",
  );
  mocks.getUrls.mockResolvedValue({
    pathname: "/projects/project/preview-full/groups/123",
    search: "?market=MX",
    hash: "#branch=design&variants=%7B%22tab%22%3A%22mine%22%7D",
  });
  mocks.preview.isLive = false;
  mocks.studio.currentArenaEmpty = false;
  mocks.studio.isDevMode = true;
  mocks.history.location = {
    pathname: "/projects/project",
    search: "",
    hash: "",
  };
  vi.spyOn(window, "open").mockReturnValue(null);
});

test("desktop saves and opens the full preview route without tracking a popup", async () => {
  let finishSave: (result: string) => void = vi.fn();
  mocks.studio.save.mockReturnValue(
    new Promise((resolve) => {
      finishSave = resolve;
    }),
  );
  render(<LivePopOutButton showLabel />);
  fireEvent.click(
    screen.getByRole("button", { name: "Open preview in browser" }),
  );
  expect(mocks.openDesktopPreview).not.toHaveBeenCalled();
  finishSave("Success");
  await waitFor(() =>
    expect(mocks.openDesktopPreview).toHaveBeenCalledWith(
      "https://studio.example/projects/project/preview-full/groups/123?market=MX#branch=design&variants=%7B%22tab%22%3A%22mine%22%7D",
    ),
  );
  expect(mocks.getUrls).toHaveBeenCalledWith(mocks.studio, true);
  expect(mocks.preview.setPopup).not.toHaveBeenCalled();
  expect(mocks.preview.popup).toBeUndefined();
});

test("desktop browser preview preserves the currently navigated preview page", async () => {
  mocks.preview.isLive = true;
  mocks.history.location = {
    pathname: "/projects/project/preview/details/123",
    search: "?tab=history",
    hash: "#branch=design&pageHash=activity",
  };
  render(<LivePopOutButton />);
  fireEvent.click(
    screen.getByRole("button", { name: "Open preview in browser" }),
  );
  await waitFor(() =>
    expect(mocks.openDesktopPreview).toHaveBeenCalledWith(
      "https://studio.example/projects/project/preview-full/details/123?tab=history#branch=design&pageHash=activity",
    ),
  );
  expect(mocks.getUrls).not.toHaveBeenCalled();
});

test("desktop does not open stale preview content when changes remain unsaved", async () => {
  mocks.studio.hasUnsavedChanges.mockReturnValue(true);
  const error = vi.spyOn(notification, "error");
  render(<LivePopOutButton />);
  fireEvent.click(
    screen.getByRole("button", { name: "Open preview in browser" }),
  );
  await waitFor(() => expect(error).toHaveBeenCalled());
  expect(mocks.openDesktopPreview).not.toHaveBeenCalled();
});

function pressPresent(target: HTMLElement = document.body) {
  fireEvent.keyDown(target, {
    key: "Enter",
    keyCode: 13,
    which: 13,
    metaKey: true,
  });
  fireEvent.keyUp(target, {
    key: "Enter",
    keyCode: 13,
    which: 13,
    metaKey: true,
  });
}

test("presents from the play button and shows the matching shortcut", async () => {
  render(<LivePopOutButton iconOnly />);
  const button = screen.getByRole("button", { name: "Present" });
  expect(button.getAttribute("aria-keyshortcuts")).toBe("Meta+Enter");
  fireEvent.focus(button);
  const tooltip = await screen.findByRole("tooltip");
  expect(tooltip.textContent).toBe("Present⌘Enter");
  expect(tooltip.querySelector(".shortcut-combo")).toBeNull();
  fireEvent.click(button);
  await waitFor(() => expect(mocks.openDesktopPreview).toHaveBeenCalledTimes(1));
});

test("Command+Enter runs the same saved browser preview and unbinds on unmount", async () => {
  const { unmount } = render(<LivePopOutButton iconOnly />);
  pressPresent();
  await waitFor(() => expect(mocks.openDesktopPreview).toHaveBeenCalledTimes(1));
  expect(mocks.studio.save).toHaveBeenCalledTimes(1);
  expect(mocks.getUrls).toHaveBeenCalledWith(mocks.studio, true);
  unmount();
  pressPresent();
  expect(mocks.studio.save).toHaveBeenCalledTimes(1);
});

test("does not present while editing an input", () => {
  render(<LivePopOutButton iconOnly />);
  const input = document.createElement("input");
  document.body.append(input);
  pressPresent(input);
  input.remove();
  expect(mocks.studio.save).not.toHaveBeenCalled();
});

test("disables both click and keyboard presentation when the canvas is empty", () => {
  mocks.studio.currentArenaEmpty = true;
  render(<LivePopOutButton iconOnly />);
  expect(
    screen.getByRole("button", { name: "Present" }).hasAttribute("disabled"),
  ).toBe(true);
  pressPresent();
  expect(mocks.studio.save).not.toHaveBeenCalled();
});

test("Present and Edit component have distinct keyboard shortcuts", () => {
  expect(STUDIO_SHORTCUTS.PRESENT.combos).toEqual(["command+enter"]);
  expect(STUDIO_SHORTCUTS.ENTER_EDIT.combos).toEqual(["option+enter"]);
});

test("shows loading through native browser handoff and prevents repeated clicks and shortcuts", async () => {
  let finishSave: (result: string) => void = vi.fn();
  let finishUrl: (url: string) => void = vi.fn();
  let finishOpen: () => void = vi.fn();
  mocks.openDesktopPreview.mockReturnValue(new Promise<void>((resolve) => { finishOpen = resolve; }));
  mocks.studio.save.mockReturnValue(
    new Promise((resolve) => {
      finishSave = resolve;
    }),
  );
  mocks.studio.appCtx.api.getStudioUrl.mockReturnValue(
    new Promise((resolve) => {
      finishUrl = resolve;
    }),
  );
  render(<LivePopOutButton iconOnly />);
  const button = screen.getByRole("button", { name: "Present" });
  fireEvent.click(button);
  expect(button.getAttribute("aria-busy")).toBe("true");
  expect(button.hasAttribute("disabled")).toBe(true);
  expect(button.querySelector(".anticon-loading")).not.toBeNull();
  fireEvent.click(button);
  pressPresent();
  expect(mocks.studio.save).toHaveBeenCalledTimes(1);
  finishSave("Success");
  await waitFor(() =>
    expect(mocks.studio.appCtx.api.getStudioUrl).toHaveBeenCalledTimes(1),
  );
  expect(button.getAttribute("aria-busy")).toBe("true");
  expect(mocks.openDesktopPreview).not.toHaveBeenCalled();
  pressPresent();
  expect(mocks.studio.save).toHaveBeenCalledTimes(1);
  finishUrl("https://studio.example");
  await waitFor(() => expect(mocks.openDesktopPreview).toHaveBeenCalledTimes(1));
  expect(button.getAttribute("aria-busy")).toBe("true");
  fireEvent.click(button);
  pressPresent();
  expect(mocks.studio.save).toHaveBeenCalledTimes(1);
  finishOpen();
  await waitFor(() => expect(button.getAttribute("aria-busy")).toBe("false"));
  expect(button.hasAttribute("disabled")).toBe(false);
  expect(button.querySelector(".anticon-loading")).toBeNull();
});

test("clears loading and allows retry when unsaved changes prevent presentation", async () => {
  mocks.studio.hasUnsavedChanges.mockReturnValue(true);
  const error = vi.spyOn(notification, "error");
  render(<LivePopOutButton iconOnly />);
  const button = screen.getByRole("button", { name: "Present" });
  fireEvent.click(button);
  await waitFor(() => expect(error).toHaveBeenCalled());
  await waitFor(() => expect(button.getAttribute("aria-busy")).toBe("false"));
  expect(button.hasAttribute("disabled")).toBe(false);
  expect(mocks.openDesktopPreview).not.toHaveBeenCalled();
  mocks.studio.hasUnsavedChanges.mockReturnValue(false);
  fireEvent.click(button);
  await waitFor(() => expect(mocks.openDesktopPreview).toHaveBeenCalledTimes(1));
});

test("clears loading when a web preview window is blocked", async () => {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Chrome");
  render(<LivePopOutButton iconOnly />);
  const button = screen.getByRole("button", { name: "Present" });
  fireEvent.click(button);
  await waitFor(() => expect(window.open).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(button.getAttribute("aria-busy")).toBe("false"));
  expect(button.hasAttribute("disabled")).toBe(false);
});
