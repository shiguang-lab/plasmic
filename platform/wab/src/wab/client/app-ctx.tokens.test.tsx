import { fakeAppCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { AppOps } from "@/wab/client/app-ctx";
import type { PersonalApiToken } from "@/wab/shared/ApiSchema";
import { act, cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { useStore } from "zustand";

afterEach(cleanup);

it("owns token snapshots and skips equivalent results and repeated invalidations", () => {
  const { appCtx } = fakeAppCtx();
  const publish = vi.fn();
  const stop = appCtx.personalApiTokensStore.subscribe(publish);
  const tokens: PersonalApiToken[] = [
    { token: "test-token", createdDate: new Date(100) },
  ];
  appCtx.setPersonalApiTokens(tokens);
  const snapshot = appCtx.personalApiTokensStore.getState();
  expect(snapshot).toEqual(tokens);
  expect(snapshot).not.toBe(tokens);
  tokens[0].token = "changed-input";
  tokens[0].createdDate.setTime(200);
  expect(snapshot?.[0]).toEqual({
    token: "test-token",
    createdDate: new Date(100),
  });
  for (let i = 0; i < 100; i++) {
    appCtx.setPersonalApiTokens([
      { token: "test-token", createdDate: new Date(100) },
    ]);
  }
  expect(appCtx.personalApiTokensStore.getState()).toBe(snapshot);
  expect(publish).toHaveBeenCalledOnce();
  appCtx.setPersonalApiTokens(null);
  appCtx.setPersonalApiTokens(null);
  expect(publish).toHaveBeenCalledTimes(2);
  stop();
});

it.each([
  "createPersonalApiToken",
  "revokePersonalApiToken",
  "emitPersonalApiToken",
] as const)(
  "invalidates only after %s succeeds and preserves the API result",
  async (method) => {
    const { appCtx, api } = fakeAppCtx();
    const ops = new AppOps(appCtx);
    appCtx.setPersonalApiTokens([
      { token: "existing", createdDate: new Date(100) },
    ]);
    const before = appCtx.personalApiTokensStore.getState();
    const failure = new Error("Request failed");
    api[method].mockRejectedValueOnce(failure);
    await expect(ops[method]("input-token")).rejects.toBe(failure);
    expect(appCtx.personalApiTokensStore.getState()).toBe(before);
    const issued = { token: "created-token", createdDate: new Date(100) };
    if (method === "revokePersonalApiToken") {
      api.revokePersonalApiToken.mockResolvedValueOnce(undefined);
    } else {
      api[method].mockResolvedValueOnce(issued);
    }
    expect(await ops[method]("input-token")).toBe(
      method === "revokePersonalApiToken" ? "input-token" : issued,
    );
    expect(appCtx.personalApiTokensStore.getState()).toBeNull();
    expect(api[method]).toHaveBeenCalledTimes(2);
  },
);

it("updates only the owning account and releases the native React subscription", () => {
  const first = fakeAppCtx().appCtx;
  const second = fakeAppCtx().appCtx;
  const commits = vi.fn();
  const subscribe = vi.spyOn(first.personalApiTokensStore, "subscribe");
  function Tokens() {
    const tokens = useStore(first.personalApiTokensStore, (state) => state);
    return (
      <React.Profiler id="tokens" onRender={commits}>
        <output>{tokens?.length ?? "unloaded"}</output>
      </React.Profiler>
    );
  }
  const view = render(<Tokens />);
  expect(screen.getByRole("status").textContent).toBe("unloaded");
  const before = commits.mock.calls.length;
  act(() => second.setPersonalApiTokens([]));
  expect(commits).toHaveBeenCalledTimes(before);
  act(() =>
    first.setPersonalApiTokens([
      { token: "first-token", createdDate: new Date(0) },
    ]),
  );
  expect(screen.getByRole("status").textContent).toBe("1");
  const after = commits.mock.calls.length;
  act(() =>
    first.setPersonalApiTokens([
      { token: "first-token", createdDate: new Date(0) },
    ]),
  );
  expect(commits).toHaveBeenCalledTimes(after);
  expect(subscribe).toHaveBeenCalledOnce();
  view.unmount();
  act(() => first.setPersonalApiTokens(null));
  expect(commits).toHaveBeenCalledTimes(after);
});
