import type { AppCtx } from "@/wab/client/app-ctx";
import { useAppAuthConfig } from "@/wab/client/components/app-auth/app-auth-contexts";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import * as React from "react";
import { SWRConfig } from "swr";
import { mock } from "vitest-mock-extended";

vi.mock("@/wab/client/frame-ctx/top-frame-ctx", () => ({
  useTopFrameCtx: vi.fn(),
}));

afterEach(cleanup);

it("loads only a selected project's auth config while keeping one Hook order", async () => {
  const getAppAuthConfig = vi.fn(async (id: string) => ({ directoryId: id }));
  const appCtx = mock<AppCtx>({ api: mock<AppCtx["api"]>({ getAppAuthConfig }) });
  const cache = new Map();
  const initialProps: { projectId: string | undefined } = { projectId: undefined };
  const view = renderHook(({ projectId }) => useAppAuthConfig(appCtx, projectId), {
    initialProps,
    wrapper: ({ children }) => <SWRConfig value={{ provider: () => cache }}>{children}</SWRConfig>,
  });
  expect(view.result.current.loading).toBe(false);
  expect(getAppAuthConfig).not.toHaveBeenCalled();

  view.rerender({ projectId: "first" });
  await waitFor(() => expect(view.result.current.config?.directoryId).toBe("first"));
  expect(getAppAuthConfig).toHaveBeenCalledWith("first");

  view.rerender({ projectId: undefined });
  expect(view.result.current.config).toBeUndefined();
  expect(view.result.current.loading).toBe(false);
  expect(getAppAuthConfig).toHaveBeenCalledTimes(1);

  view.rerender({ projectId: "second" });
  await waitFor(() => expect(view.result.current.config?.directoryId).toBe("second"));
  expect(getAppAuthConfig).toHaveBeenLastCalledWith("second");
});
