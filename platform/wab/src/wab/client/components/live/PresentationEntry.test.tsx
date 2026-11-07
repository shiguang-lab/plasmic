import { PresentationEntry } from "@/wab/client/components/live/PresentationEntry";
import { StudioStartupBoundary } from "@/wab/client/components/studio/StudioChrome";
import { HistoryProvider } from "@/wab/client/route/HistoryProvider";
import { presentationProject } from "@/wab/client/route/presentation-projects";
import { HttpError } from "@/wab/shared/ApiErrors/ApiError";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { createMemoryHistory } from "history";
import * as React from "react";
const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/wab/client/api", () => ({
  Api: class {
    getPresentation = mocks.get;
  },
}));
vi.mock("@/wab/client/frame-ctx/host-frame-ctx", () => ({
  useHostFrameCtxIfHostFrame: () => null,
}));
vi.mock("@/wab/client/ErrorNotifications", () => ({ reportError: vi.fn() }));
vi.mock("@/wab/client/components/live/PreviewLoading", () => ({
  PreviewLoading: ({ children, loading = true }) =>
    children || (loading && <div role="status">Loading presentation</div>),
}));
function setup() {
  const history = createMemoryHistory({
    initialEntries: [
      "/d/entry12345?branch=design#/coupons/42?tag=a&tag=b#rules",
    ],
  });
  const view = render(
    <HistoryProvider history={history}>
      <StudioStartupBoundary>
        <PresentationEntry>
          <div>Project consumers</div>
        </PresentationEntry>
      </StudioStartupBoundary>
    </HistoryProvider>,
  );
  return { history, ...view };
}
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it("resolves the short identifier before mounting project consumers and preserves the full route", async () => {
  let release!: (value: { code: string; projectId: string }) => void;
  mocks.get.mockReturnValue(
    new Promise((resolve) => {
      release = resolve;
    }),
  );
  const { history } = setup();
  const initial = history.location;
  expect(screen.queryByText("Project consumers")).toBeNull();
  expect(screen.getByRole("status")).toBeTruthy();
  await act(async () => release({ code: "entry12345", projectId: "project" }));
  expect(screen.getByText("Project consumers")).toBeTruthy();
  expect(presentationProject("entry12345")).toBe("project");
  expect(history.location).toBe(initial);
});
it("does not mount the editor when the presentation cannot be accessed", async () => {
  mocks.get.mockRejectedValue(new HttpError(403, "Access denied"));
  setup();
  await screen.findByRole("alert");
  expect(screen.queryByText("Project consumers")).toBeNull();
});
it("keeps the bootstrap logo while the presentation identifier resolves", async () => {
  const pending = Promise.withResolvers<{ code: string; projectId: string }>();
  mocks.get.mockReturnValue(pending.promise);
  const bootstrap = document.createElement("div");
  bootstrap.id = "preview-startup-loading";
  bootstrap.className = "preview-loading visible";
  bootstrap.setAttribute("role", "status");
  bootstrap.innerHTML = "<svg></svg>";
  document.body.append(bootstrap);
  try {
    const logo = bootstrap.firstElementChild;
    setup();
    expect(screen.getAllByRole("status")).toEqual([bootstrap]);
    expect(bootstrap.classList.contains("fadeOut")).toBe(false);
    await act(async () => pending.resolve({ code: "entry12345", projectId: "project" }));
    expect(screen.getByText("Project consumers")).toBeTruthy();
    expect(screen.getAllByRole("status")).toEqual([bootstrap]);
    expect(bootstrap.firstElementChild).toBe(logo);
    expect(bootstrap.classList.contains("fadeOut")).toBe(false);
  } finally {
    cleanup();
    bootstrap.remove();
  }
});
it("keeps an expired session retryable through the sign-in continuation", async () => {
  window.history.replaceState(
    null,
    "",
    "/d/entry12345?branch=design#/coupons/42?tag=a&tag=b#rules",
  );
  mocks.get.mockRejectedValue(new HttpError(401, "Unauthorized"));
  const { history } = setup();
  try {
    await waitFor(() => expect(history.location.pathname).toBe("/login"));
    expect(new URLSearchParams(history.location.search).get("continueTo")).toBe(
      "/d/entry12345?branch=design#/coupons/42?tag=a&tag=b#rules",
    );
    expect(screen.queryByText("Project consumers")).toBeTruthy();
  } finally {
    window.history.replaceState(null, "", "/");
  }
});
