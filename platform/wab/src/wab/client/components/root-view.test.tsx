import { registerPresentationProject } from "@/wab/client/route/presentation-projects";
import { Root } from "@/wab/client/components/root-view";
import { HistoryProvider } from "@/wab/client/route/HistoryProvider";
import { HttpError } from "@/wab/shared/ApiErrors/ApiError";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryHistory } from "history";
import * as React from "react";

const mocks = vi.hoisted(() => ({
  getLastBundleVersion: vi.fn(),
  getProjectStartup: vi.fn(),
  getSiteInfo: vi.fn(),
  resolveProjectModel: vi.fn(),
  loadAppCtx: vi.fn(),
  loadAppCtxData: vi.fn(),
  reportError: vi.fn(),
}));
vi.mock("@/wab/client/api", () => ({
  setUser: vi.fn(),
  Api: class {
    getProjectStartup = mocks.getProjectStartup;
    getSiteInfo = mocks.getSiteInfo;
    resolveProjectModel = mocks.resolveProjectModel;
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
  mocks.resolveProjectModel.mockResolvedValue({});
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

it("uses the project opening response once and reuses its permission and host metadata", async () => {
  const data = { selfInfo: null, appConfig: { config: {} }, appCtx: { teams: [], workspaces: [], perms: [] }, latestBundleVersion: "version", projectId: "project", branchName: "main", projectData: { projects: [], perms: [] }, hosts: { trustedHosts: [] }, branches: [] };
  const opening = { startup: data, rev: {}, depPkgs: [] };
  mocks.getProjectStartup.mockResolvedValue(opening);
  mocks.resolveProjectModel.mockReturnValue(new Promise(() => undefined));
  mocks.loadAppCtx.mockRejectedValue(new Error("Stop after opening"));
  setup("/projects/project");
  await screen.findByRole("alert");
  expect(mocks.getProjectStartup).toHaveBeenCalledExactlyOnceWith("project", "main");
  expect(mocks.getSiteInfo).not.toHaveBeenCalled();
  expect(mocks.resolveProjectModel).toHaveBeenCalledExactlyOnceWith(opening);
  expect(mocks.getLastBundleVersion).not.toHaveBeenCalled();
  expect(mocks.loadAppCtxData).not.toHaveBeenCalled();
  expect(mocks.loadAppCtx).toHaveBeenCalledWith(expect.objectContaining({ initialProjectInfo: data, lastBundleVersion: "version" }), true, [undefined, data.appConfig, data.appCtx]);
});

it.each([401, 403])("initializes identity after a denied project opening response (%s) so project access can be handled", async (status) => {
  mocks.getProjectStartup.mockRejectedValue(new HttpError(status, "Access denied"));
  mocks.loadAppCtx.mockRejectedValue(new Error("Stop after identity initialization"));
  setup("/d/0123456789?branch=main#/customer-groups");
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
  mocks.getProjectStartup.mockRejectedValueOnce(new HttpError(502, "Bad Gateway"));
  setup("/projects/project");
  await screen.findByRole("alert");
  expect(mocks.loadAppCtxData).not.toHaveBeenCalled();
  expect(mocks.loadAppCtx).not.toHaveBeenCalled();
});

it.each(["bundle", "app-data", "app-context"])(
  "sends an expired %s startup session to sign-in with the full preview location",
  async (stage) => {
    const denied = new HttpError(401, "Unauthorized");
    mocks.getProjectStartup.mockRejectedValue(denied);
    if (stage === "bundle") {
      mocks.getLastBundleVersion.mockRejectedValue(denied);
    } else if (stage === "app-data") {
      mocks.loadAppCtxData.mockRejectedValue(denied);
    } else {
      mocks.loadAppCtx.mockRejectedValue(denied);
    }
    const path = "/d/0123456789?width=1440#/audiences?market=MX";
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

beforeEach(() => registerPresentationProject("0123456789", "project" as import("@/wab/shared/ApiSchema").ProjectId));

it("consumes the desktop opening response without repeating the project GET", async () => {
  const opening = { startup: { selfInfo: null, appConfig: { config: {} }, appCtx: { teams: [], workspaces: [], perms: [] }, latestBundleVersion: "version", projectId: "project", branchName: "feature", projectData: { projects: [], perms: [] }, hosts: { trustedHosts: [] }, branches: [{ id: "branch", name: "feature" }] }, depPkgs: [], rev: {} };
  const consumeStartupData = vi.fn().mockResolvedValue(opening);
  Object.defineProperty(window, "desktopEnvironment", { configurable: true, value: { consumeStartupData } });
  try {
    mocks.loadAppCtx.mockRejectedValue(new Error("Stop after opening"));
    setup("/projects/project?branch=feature");
    await screen.findByRole("alert");
    expect(consumeStartupData).toHaveBeenCalledExactlyOnceWith("project", "feature");
    expect(mocks.getProjectStartup).not.toHaveBeenCalled();
    expect(mocks.getSiteInfo).not.toHaveBeenCalled();
    expect(mocks.resolveProjectModel).toHaveBeenCalledExactlyOnceWith(opening);
    expect(mocks.loadAppCtx.mock.calls[0][0].initialProjectModel.branchId).toBe("branch");
  } finally {
    Reflect.deleteProperty(window, "desktopEnvironment");
  }
});
