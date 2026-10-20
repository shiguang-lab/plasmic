import { fakeAppCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { useTopFrameState } from "@/wab/client/components/TopFrame/TopFrameChrome";
import type { AiSessionSnapshot } from "@/wab/client/copilot/ai-session-view";
import { getLocalEditSession } from "@/wab/client/copilot/local-edit-session";
import { HistoryProvider } from "@/wab/client/route/HistoryProvider";
import { toOpaque } from "@/wab/commons/types";
import { ApiProject } from "@/wab/shared/ApiSchema";
import { act, renderHook } from "@testing-library/react";
import * as React from "react";
import { mock } from "vitest-mock-extended";

it("relays one authenticated AI session to the host panel without changing history", async () => {
  const { appCtx, history } = fakeAppCtx();
  const project = mock<ApiProject>({ id: toOpaque("panel-project") });
  const location = history.location;
  const mounted = renderHook(
    () => useTopFrameState({ appCtx, project, forceUpdate: vi.fn() }),
    {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <HistoryProvider history={history}>{children}</HistoryProvider>
      ),
    },
  );
  const api = mounted.result.current.topFrameApi;
  const snapshots: AiSessionSnapshot[] = [];
  const dispose = await api.subscribeAiSession(project.id, (snapshot) => {
    snapshots.push(snapshot);
  });
  expect(snapshots).toHaveLength(1);
  await api.updateAiSession(project.id, {
    type: "draft",
    value: { prompt: "Keep this draft", attachments: [] },
  });
  expect(snapshots.at(-1)?.draft.prompt).toBe("Keep this draft");
  expect(getLocalEditSession(project.id).draft.prompt).toBe("Keep this draft");
  await act(() => api.setAiPanelOpen(true));
  expect(mounted.result.current.aiPanelOpen).toBe(true);
  await act(() => api.setAiPanelOpen(false));
  expect(history.location).toBe(location);
  await dispose();
  const count = snapshots.length;
  await api.updateAiSession(project.id, {
    type: "model",
    value: "another-model",
  });
  expect(snapshots).toHaveLength(count);
  await expect(
    api.subscribeAiSession("other-project", () => undefined),
  ).rejects.toThrow("current project");
  mounted.unmount();
});

it("opens the Desktop browser through the existing host-to-top-frame API", async () => {
  const { appCtx, history } = fakeAppCtx();
  const open = vi.fn().mockResolvedValue({ visible: true });
  vi.stubGlobal("desktopBrowser", { open });
  const location = history.location;
  const mounted = renderHook(
    () =>
      useTopFrameState({
        appCtx,
        project: mock<ApiProject>(),
        forceUpdate: vi.fn(),
      }),
    {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <HistoryProvider history={history}>{children}</HistoryProvider>
      ),
    },
  );
  try {
    await mounted.result.current.topFrameApi.openDesktopBrowser();
    expect(open).toHaveBeenCalledOnce();
    expect(history.location).toBe(location);
  } finally {
    mounted.unmount();
    vi.unstubAllGlobals();
  }
});


it("awaits the native preview handoff across the host-to-top-frame API", async () => {
  const { appCtx, history } = fakeAppCtx();
  let finish: () => void = vi.fn();
  const openPreview = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
  vi.stubGlobal("desktopBrowser", { openPreview });
  const mounted = renderHook(
    () => useTopFrameState({ appCtx, project: mock<ApiProject>(), forceUpdate: vi.fn() }),
    { wrapper: ({ children }: { children: React.ReactNode }) => <HistoryProvider history={history}>{children}</HistoryProvider> },
  );
  try {
    const url = "https://studio.example/projects/test/preview-full";
    let done = false;
    const pending = mounted.result.current.topFrameApi.openDesktopPreview(url).then(() => { done = true; });
    await Promise.resolve();
    expect(openPreview).toHaveBeenCalledWith(url);
    expect(done).toBe(false);
    finish();
    await pending;
    expect(done).toBe(true);
    openPreview.mockRejectedValueOnce(new Error("Launch failed"));
    await expect(mounted.result.current.topFrameApi.openDesktopPreview(url)).rejects.toThrow("Launch failed");
  } finally {
    mounted.unmount();
    vi.unstubAllGlobals();
  }
});
