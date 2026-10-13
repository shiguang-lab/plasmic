import { fakeAppCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { useTopFrameState } from "@/wab/client/components/TopFrame/TopFrameChrome";
import { HistoryProvider } from "@/wab/client/route/HistoryProvider";
import { act, renderHook } from "@testing-library/react";
import * as React from "react";

it("keeps AI visibility out of history and starts closed after reopening", async () => {
  const { appCtx, history } = fakeAppCtx();
  history.replace("/projects/project?copilot_chat=true&arena=page");
  const location = history.location;
  const mount = () => renderHook(
    () => useTopFrameState({ appCtx, project: undefined, forceUpdate: vi.fn() }),
    {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <HistoryProvider history={history}>{children}</HistoryProvider>
      ),
    },
  );
  const first = mount();
  expect(first.result.current.showCopilotChatModal).toBe(false);
  await act(() => first.result.current.topFrameApi.toggleCopilotChat());
  expect(first.result.current.showCopilotChatModal).toBe(true);
  expect(history.location).toBe(location);
  await act(() => first.result.current.topFrameApi.closeCopilotChat());
  expect(first.result.current.showCopilotChatModal).toBe(false);
  await act(() => first.result.current.topFrameApi.openCopilotChat({ prompt: "Edit this page", mode: "starter" }));
  expect(first.result.current.showCopilotChatModal).toBe(true);
  expect(history.location).toBe(location);
  first.unmount();
  const reopened = mount();
  expect(reopened.result.current.showCopilotChatModal).toBe(false);
  expect(reopened.result.current.copilotChatOpenOpts).toBeUndefined();
  reopened.unmount();
});
