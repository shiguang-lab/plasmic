import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import type { GetProjectResponse } from "@/wab/shared/ApiSchema";
import { act, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";
import { useStore } from "zustand";

it("publishes token-only metadata refreshes without rendering name subscribers and retains equal responses", async () => {
  const { studioCtx, api } = fakeStudioCtx({ siteInfo: { projectApiToken: "initial-test-token" } });
  await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
  const tokenCommits = vi.fn(), nameCommits = vi.fn();
  function Token() {
    const token = useStore(studioCtx.projectMetadataStore, (state) => state.projectApiToken);
    return <React.Profiler id="token" onRender={tokenCommits}><output aria-label="token">{token}</output></React.Profiler>;
  }
  function Name() {
    const name = useStore(studioCtx.projectMetadataStore, (state) => state.name);
    return <React.Profiler id="name" onRender={nameCommits}><output aria-label="name">{name}</output></React.Profiler>;
  }
  const view = render(<React.StrictMode><Token /><Name /></React.StrictMode>);
  const publish = vi.fn();
  const stop = studioCtx.projectMetadataStore.subscribe(publish);
  const response = () => mock<GetProjectResponse>({
    project: { ...studioCtx.siteInfo, projectApiToken: "refreshed-test-token" },
    perms: [], owner: undefined, latestRevisionSynced: 0, hasAppAuth: false,
    appAuthProvider: undefined, isMainBranchProtected: false,
  });
  try {
    tokenCommits.mockClear(); nameCommits.mockClear();
    api.getSiteInfo.mockResolvedValueOnce(response());
    await act(async () => { await studioCtx.refreshSiteInfo(); });
    expect(screen.getByLabelText("token").textContent).toBe("refreshed-test-token");
    expect(tokenCommits).toHaveBeenCalledOnce();
    expect(nameCommits).not.toHaveBeenCalled();
    expect(publish).toHaveBeenCalledOnce();
    const snapshot = studioCtx.projectMetadataStore.getState();
    expect(Object.isFrozen(snapshot)).toBe(true);
    api.getSiteInfo.mockResolvedValueOnce(response());
    await act(async () => { await studioCtx.refreshSiteInfo(); });
    expect(studioCtx.projectMetadataStore.getState()).toBe(snapshot);
    expect(publish).toHaveBeenCalledOnce();
    api.getSiteInfo.mockRejectedValueOnce(new Error("metadata request failed"));
    await expect(studioCtx.refreshSiteInfo()).rejects.toThrow("metadata request failed");
    expect(studioCtx.projectMetadataStore.getState()).toBe(snapshot);
    expect(publish).toHaveBeenCalledOnce();
  } finally { stop(); view.unmount(); studioCtx.dispose(); }
});
