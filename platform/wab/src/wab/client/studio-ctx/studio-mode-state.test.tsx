import { createStudioModeFixture } from "@/wab/client/__testonly__/studio-mode";
import type { StudioAppUser, StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { subscribeStudioLiveMode, useCurrentAppUser, useCurrentAppUserToken, useStudioLiveMode } from "@/wab/client/studio-ctx/studio-mode-state";
import { ensure } from "@/wab/shared/common";
import { act, cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { createStore } from "zustand/vanilla";

afterEach(cleanup);

it("isolates live mode, app user and token subscribers", () => {
  const owner = createStudioModeFixture();
  const user: StudioAppUser = { email: "first@example.test" };
  const userStore = createStore<{ appUser: StudioAppUser; fakeAuthToken?: string }>(() => ({ appUser: user }));
  const studio = { ...owner, currentAppUserStore: userStore } as unknown as StudioCtx;
  const liveCommits = vi.fn(), userCommits = vi.fn(), tokenCommits = vi.fn();
  function Live() {
    const live = useStudioLiveMode(studio);
    return <React.Profiler id="live" onRender={liveCommits}><output aria-label="mode">{String(live)}</output></React.Profiler>;
  }
  function User() {
    const appUser = useCurrentAppUser(studio);
    return <React.Profiler id="user" onRender={userCommits}><output aria-label="user">{appUser.email}</output></React.Profiler>;
  }
  function Token() {
    const token = useCurrentAppUserToken(studio);
    return <React.Profiler id="token" onRender={tokenCommits}><output aria-label="token">{token ?? "none"}</output></React.Profiler>;
  }
  render(<React.StrictMode><Live /><User /><Token /></React.StrictMode>);
  liveCommits.mockClear(); userCommits.mockClear(); tokenCommits.mockClear();
  act(() => { userStore.setState({ fakeAuthToken: "test-token" }); });
  expect(screen.getByLabelText("token").textContent).toBe("test-token");
  expect(tokenCommits).toHaveBeenCalledOnce();
  expect(userCommits).not.toHaveBeenCalled();
  expect(liveCommits).not.toHaveBeenCalled();
  act(() => { ensure(owner.previewOwnerStore.getState(), "Preview").store.setState({ isLive: true }); });
  expect(screen.getByLabelText("mode").textContent).toBe("true");
  expect(liveCommits).toHaveBeenCalledOnce();
  expect(userCommits).not.toHaveBeenCalled();
  expect(tokenCommits).toHaveBeenCalledOnce();
  act(() => { owner.previewOwnerStore.setState(undefined, true); });
  expect(screen.getByLabelText("mode").textContent).toBe("false");
});

it("rebinds live-mode subscriptions and releases old owners", () => {
  const owner = createStudioModeFixture();
  const first = ensure(owner.previewOwnerStore.getState(), "First preview");
  const second = ensure(createStudioModeFixture().previewOwnerStore.getState(), "Second preview");
  const publish = vi.fn();
  const stop = subscribeStudioLiveMode(owner as unknown as StudioCtx, publish);
  first.store.setState({ refreshKey: 1 });
  expect(publish).not.toHaveBeenCalled();
  first.store.setState({ isLive: true });
  expect(publish).toHaveBeenLastCalledWith(true, false);
  owner.previewOwnerStore.setState(second, true);
  expect(publish).toHaveBeenLastCalledWith(false, true);
  first.store.setState({ isLive: false });
  expect(publish).toHaveBeenCalledTimes(2);
  second.store.setState({ isLive: true });
  expect(publish).toHaveBeenCalledTimes(3);
  stop();
  second.store.setState({ isLive: false });
  expect(publish).toHaveBeenCalledTimes(3);
});
