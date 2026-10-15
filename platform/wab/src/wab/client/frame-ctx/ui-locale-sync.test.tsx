import { FrameMessage } from "@/wab/client/frame-ctx/frame-message-types";
import {
  TopFrameApi,
  TopFrameFullApi,
} from "@/wab/client/frame-ctx/top-frame-api";
import { TopFrameCtxProvider } from "@/wab/client/frame-ctx/top-frame-ctx";
import { setLanguagePreference } from "@/wab/client/i18n";
import { BranchId } from "@/wab/shared/ApiSchema";
import { ensure } from "@/wab/shared/common";
import { act, cleanup, render } from "@testing-library/react";
import * as React from "react";

const wire = vitest.hoisted(() => ({
  exposed: undefined as TopFrameFullApi | undefined,
  getSiteInfo: vitest.fn().mockResolvedValue({}),
}));
vitest.mock("@/wab/client/cli-routes", () => ({
  ensureIsTopFrame: vitest.fn(),
}));
vitest.mock("@/wab/client/api", () => ({
  filteredApi: () => ({ getSiteInfo: wire.getSiteInfo }),
}));
vitest.mock("@/wab/client/contexts/AppContexts", () => ({
  useAppCtx: () => ({ api: {}, appConfig: {} }),
}));
vitest.mock("comlink", () => ({
  windowEndpoint: () => ({
    addEventListener: vitest.fn(),
    removeEventListener: vitest.fn(),
  }),
  expose: (api: TopFrameFullApi) => {
    wire.exposed = api;
  },
  proxy: (value: unknown) => value,
}));

function connect(initialBranchId?: BranchId) {
  const mounted = render(
    <TopFrameCtxProvider
      projectId="project"
      initialBranchId={initialBranchId}
      topFrameApi={{} as TopFrameApi}
    >
      <div>Host placeholder</div>
    </TopFrameCtxProvider>,
  );
  act(() => {
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: FrameMessage.PlasmicHostRegister },
        source: window,
      }),
    );
  });
  return {
    mounted,
    api: ensure(wire.exposed, "Expected exposed top frame API"),
  };
}
afterEach(() => {
  cleanup();
  wire.exposed = undefined;
  wire.getSiteInfo.mockReset().mockResolvedValue({});
});

it("starts the model request before host registration and consumes it only once", async () => {
  const { api } = connect();
  expect(wire.getSiteInfo).toHaveBeenCalledExactlyOnceWith("project", {
    branchId: undefined,
  });
  await api.getSiteInfo("project");
  expect(wire.getSiteInfo).toHaveBeenCalledOnce();
  await api.getSiteInfo("project");
  expect(wire.getSiteInfo).toHaveBeenCalledTimes(2);
});

it("keeps branch, revision and other project reads distinct from the initial model", async () => {
  const branchId = "branch" as BranchId;
  const { api } = connect(branchId);
  await api.getSiteInfo("project", { branchId: "other" as BranchId });
  await api.getSiteInfo("project", { branchId, revisionNum: 10 });
  await api.getSiteInfo("project", { branchId, dontMigrateProject: true });
  await api.getSiteInfo("other-project", { branchId });
  expect(wire.getSiteInfo).toHaveBeenCalledTimes(5);
  await api.getSiteInfo("project", { branchId });
  expect(wire.getSiteInfo).toHaveBeenCalledTimes(5);
});

it("reports a failed initial model and fetches again on retry", async () => {
  const error = new Error("Offline");
  wire.getSiteInfo.mockRejectedValueOnce(error);
  const { api } = connect();
  await expect(api.getSiteInfo("project")).rejects.toBe(error);
  await expect(api.getSiteInfo("project")).resolves.toEqual({});
  expect(wire.getSiteInfo).toHaveBeenCalledTimes(2);
});
it("awaits the initial locale callback before allowing the host registration to finish", async () => {
  await setLanguagePreference("zh-CN");
  const { api } = connect();
  let finish: (() => void) | undefined;
  const initial = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const listener = vitest.fn(() => initial);
  let registered = false;
  const registration = api
    .registerUiLocaleListener(listener)
    .then((unregister) => {
      registered = true;
      return unregister;
    });
  expect(listener).toHaveBeenCalledWith("zh-CN");
  await Promise.resolve();
  expect(registered).toBe(false);
  ensure(finish, "Expected pending initial locale callback")();
  const unregister = await registration;
  expect(registered).toBe(true);
  unregister();
});
it("keeps the editor synchronized and removes its listener when the frame is disposed", async () => {
  await setLanguagePreference("en");
  const { api, mounted } = connect();
  const listener = vitest.fn();
  await api.registerUiLocaleListener(listener);
  await act(async () => { await setLanguagePreference("ko"); });
  expect(listener).toHaveBeenLastCalledWith("ko");
  mounted.unmount();
  listener.mockClear();
  await act(async () => { await setLanguagePreference("ja"); });
  expect(listener).not.toHaveBeenCalled();
});

it("sends the resolved appearance before host registration and keeps it synchronized", async () => {
  const { setAppearancePreference } = await import("@/wab/client/ui-theme");
  setAppearancePreference("dark");
  const { api, mounted } = connect();
  const listener = vitest.fn();
  const unregister = await api.registerUiAppearanceListener(listener);
  expect(listener).toHaveBeenCalledWith("dark");
  act(() => setAppearancePreference("light"));
  expect(listener).toHaveBeenLastCalledWith("light");
  unregister();
  listener.mockClear();
  act(() => setAppearancePreference("dark"));
  expect(listener).not.toHaveBeenCalled();
  mounted.unmount();
});
