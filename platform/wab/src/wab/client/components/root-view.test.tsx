import { Root } from "@/wab/client/components/root-view";
import { HistoryProvider } from "@/wab/client/route/HistoryProvider";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createMemoryHistory } from "history";
import * as React from "react";

const mocks = vi.hoisted(() => ({
  getLastBundleVersion: vi.fn(),
  loadAppCtx: vi.fn(),
  reportError: vi.fn(),
}));
vi.mock("@/wab/client/api", () => ({
  Api: class {
    getLastBundleVersion = mocks.getLastBundleVersion;
  },
}));
vi.mock("@/wab/client/app-ctx", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/wab/client/app-ctx")>()),
  loadAppCtx: mocks.loadAppCtx,
  withHostFrameCache: (_key, _caching, _api, loader) => loader(),
}));
vi.mock("@/wab/client/ErrorNotifications", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/wab/client/ErrorNotifications")>()),
  reportError: mocks.reportError,
}));
vi.mock("@/wab/client/frame-ctx/host-frame-ctx", () => ({
  useHostFrameCtxIfHostFrame: () => null,
}));
vi.mock("@/wab/client/components/ApplicationPageLoading", () => ({
  ApplicationPageLoading: ({ failure }) => (
    <main>
      <nav>Application navigation</nav>
      {failure ?? <div role="status">Loading</div>}
    </main>
  ),
}));
vi.mock("@/wab/client/i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/wab/client/i18n")>()),
  useI18n: () => ({ t: (message: string) => message }),
}));
vi.mock("@/wab/client/components/pages/ShiguangSignIn", () => ({
  ShiguangSignIn: () => <div>Ready</div>,
}));

beforeEach(() => {
  mocks.getLastBundleVersion.mockResolvedValue({
    latestBundleVersion: "version",
  });
  mocks.loadAppCtx.mockResolvedValue({ selfInfo: null });
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
function setup() {
  render(
    <HistoryProvider
      history={createMemoryHistory({ initialEntries: ["/login"] })}
    >
      <Root />
    </HistoryProvider>,
  );
}

it("recovers from the startup bundle-version failure without reloading the window", async () => {
  mocks.getLastBundleVersion.mockRejectedValueOnce(
    new Error("502 Bad Gateway"),
  );
  setup();
  await screen.findByRole("alert");
  expect(screen.getByText("Application navigation")).toBeTruthy();
  expect(mocks.loadAppCtx).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByText("Ready")).toBeTruthy();
  expect(mocks.getLastBundleVersion).toHaveBeenCalledTimes(2);
});

it("retries application data without repeating successful startup initialization", async () => {
  mocks.loadAppCtx.mockRejectedValueOnce(new Error("App context unavailable"));
  setup();
  await screen.findByRole("alert");
  expect(screen.getByText("Application navigation")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByText("Ready")).toBeTruthy();
  expect(mocks.getLastBundleVersion).toHaveBeenCalledOnce();
  expect(mocks.loadAppCtx).toHaveBeenCalledTimes(2);
});
