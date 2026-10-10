import LivePopOutButton from "@/wab/client/components/top-bar/LivePopOutButton";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { notification } from "antd";
import React from "react";

const mocks = vi.hoisted(() => ({
  studio: {
    save: vi.fn(),
    hasUnsavedChanges: vi.fn(),
    appCtx: { api: { getStudioUrl: vi.fn() } },
    currentArenaEmpty: false,
  },
  preview: { popup: undefined, isLive: false, setPopup: vi.fn() },
  history: {
    location: { pathname: "/projects/project", search: "", hash: "" },
  },
  getUrls: vi.fn(),
}));

vi.mock("@/wab/client/studio-ctx/StudioCtx", () => ({
  useStudioCtx: () => mocks.studio,
}));
vi.mock("@/wab/client/route/HistoryProvider", () => ({
  useHistory: () => mocks.history,
}));
vi.mock("@/wab/client/components/live/PreviewCtx", () => ({
  usePreviewCtx: () => mocks.preview,
  getUrlsForLiveMode: mocks.getUrls,
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

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
    "PlasmicDesktop/darwin",
  );
  mocks.studio.save.mockResolvedValue("Success");
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
  expect(window.open).not.toHaveBeenCalled();
  finishSave("Success");
  await waitFor(() =>
    expect(window.open).toHaveBeenCalledWith(
      "https://studio.example/projects/project/preview-full/groups/123?market=MX#branch=design&variants=%7B%22tab%22%3A%22mine%22%7D",
      "_blank",
      "noopener,noreferrer",
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
    expect(window.open).toHaveBeenCalledWith(
      "https://studio.example/projects/project/preview-full/details/123?tab=history#branch=design&pageHash=activity",
      "_blank",
      "noopener,noreferrer",
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
  expect(window.open).not.toHaveBeenCalled();
});
