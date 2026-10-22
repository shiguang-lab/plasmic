import { Root } from "@/wab/client/components/root-view";
import { HistoryProvider } from "@/wab/client/route/HistoryProvider";
import { HttpError } from "@/wab/shared/ApiErrors/ApiError";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryHistory } from "history";
import * as React from "react";

const mocks = vi.hoisted(() => ({
  getLastBundleVersion: vi.fn(),
  getEditorBootstrap: vi.fn(),
  getSiteInfo: vi.fn(),
  loadAppCtx: vi.fn(),
  loadAppCtxData: vi.fn(),
  reportError: vi.fn(),
}));
vi.mock("@/wab/client/api", () => ({
  setUser: vi.fn(),
  Api: class {
    getEditorBootstrap = mocks.getEditorBootstrap;
    getSiteInfo = mocks.getSiteInfo;
    getLastBundleVersion = mocks.getLastBundleVersion;
  },
}));
vi.mock("@/wab/client/app-ctx", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/wab/client/app-ctx")>()),
  loadAppCtx: mocks.loadAppCtx,
  loadAppCtxData: mocks.loadAppCtxData,
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
  ShiguangSignIn: ({ returnTo }: { returnTo?: string }) => <div data-return-to={returnTo}>Ready</div>,
}));

beforeEach(() => {
  mocks.getSiteInfo.mockResolvedValue({});
  mocks.getLastBundleVersion.mockResolvedValue({
    latestBundleVersion: "version",
  });
  mocks.loadAppCtx.mockResolvedValue({ selfInfo: null });
  mocks.loadAppCtxData.mockResolvedValue([
    null,
    { config: {} },
    { teams: [], workspaces: [], perms: [] },
  ]);
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
function setup(path = "/login") {
  render(
    <HistoryProvider
      history={createMemoryHistory({ initialEntries: [path] })}
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

it("starts app data before bundle version resolves and reuses the fetched data", async () => {
  let release!: (value: { latestBundleVersion: string }) => void;
  mocks.getLastBundleVersion.mockReturnValue(
    new Promise((resolve) => {
      release = resolve;
    }),
  );
  setup();
  await waitFor(() => expect(mocks.loadAppCtxData).toHaveBeenCalledOnce());
  expect(mocks.loadAppCtx).not.toHaveBeenCalled();
  release({ latestBundleVersion: "version" });
  expect(await screen.findByText("Ready")).toBeTruthy();
  expect(mocks.loadAppCtx).toHaveBeenCalledWith(expect.anything(), true, [
    null,
    { config: {} },
    { teams: [], workspaces: [], perms: [] },
  ]);
});

it("retries failed parallel app data without repeating the successful bundle fetch", async () => {
  mocks.loadAppCtxData.mockRejectedValueOnce(new Error("App data unavailable"));
  setup();
  await screen.findByRole("alert");
  expect(mocks.loadAppCtx).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByText("Ready")).toBeTruthy();
  expect(mocks.getLastBundleVersion).toHaveBeenCalledOnce();
  expect(mocks.loadAppCtx).toHaveBeenCalledWith(
    expect.anything(),
    true,
    undefined,
  );
});

it("uses the project bootstrap once and reuses its permission and host metadata", async () => {
  const data = { selfInfo: null, appConfig: { config: {} }, appCtx: { teams: [], workspaces: [], perms: [] }, latestBundleVersion: "version", projectId: "project", branchName: "main", projectData: { projects: [], perms: [] }, hosts: { trustedHosts: [] }, branches: [] };
  mocks.getEditorBootstrap.mockResolvedValue(data);
  mocks.loadAppCtx.mockRejectedValue(new Error("Stop after bootstrap"));
  setup("/projects/project");
  await screen.findByRole("alert");
  expect(mocks.getEditorBootstrap).toHaveBeenCalledExactlyOnceWith("project", "main");
  expect(mocks.getLastBundleVersion).not.toHaveBeenCalled();
  expect(mocks.loadAppCtxData).not.toHaveBeenCalled();
  expect(mocks.loadAppCtx).toHaveBeenCalledWith(expect.objectContaining({ initialProjectInfo: data, lastBundleVersion: "version" }), true, [undefined, data.appConfig, data.appCtx]);
});

it.each([401, 403])("initializes identity after a denied project bootstrap (%s) so project access can be handled", async (status) => {
  mocks.getEditorBootstrap.mockRejectedValue(new HttpError(status, "Access denied"));
  mocks.loadAppCtx.mockRejectedValue(new Error("Stop after identity initialization"));
  setup("/projects/project/preview-full/customer-groups?branch=main");
  await screen.findByRole("alert");
  expect(mocks.loadAppCtxData).toHaveBeenCalledOnce();
  expect(mocks.getSiteInfo).not.toHaveBeenCalled();
  expect(mocks.loadAppCtx).toHaveBeenCalledOnce();
  const [ctx, caching, data] = mocks.loadAppCtx.mock.calls[0];
  expect(ctx.initialProjectInfo).toBeUndefined();
  expect(caching).toBe(true);
  expect(data).toEqual([null, { config: {} }, { teams: [], workspaces: [], perms: [] }]);
});

it("keeps a failed project service retryable without treating it as an access denial", async () => {
  mocks.getEditorBootstrap.mockRejectedValueOnce(new HttpError(502, "Bad Gateway"));
  setup("/projects/project");
  await screen.findByRole("alert");
  expect(mocks.loadAppCtxData).not.toHaveBeenCalled();
  expect(mocks.loadAppCtx).not.toHaveBeenCalled();
});

it.each(["bundle", "app-data", "app-context"])(
  "sends an expired %s startup session to sign-in with the full preview location",
  async (stage) => {
    const denied = new HttpError(401, "Unauthorized");
    mocks.getEditorBootstrap.mockRejectedValue(denied);
    if (stage === "bundle") {
      mocks.getLastBundleVersion.mockRejectedValue(denied);
    } else if (stage === "app-data") {
      mocks.loadAppCtxData.mockRejectedValue(denied);
    } else {
      mocks.loadAppCtx.mockRejectedValue(denied);
    }
    const path = "/projects/project/preview-full/audiences?market=MX#width=1440";
    setup(path);
    expect((await screen.findByText("Ready")).getAttribute("data-return-to")).toBe(path);
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  },
);

it("does not treat a forbidden startup request as an expired session", async () => {
  mocks.getLastBundleVersion.mockRejectedValue(new HttpError(403, "Forbidden"));
  setup();
  expect(await screen.findByRole("button", { name: "Retry" })).toBeTruthy();
  expect(screen.queryByText("Ready")).toBeNull();
});
