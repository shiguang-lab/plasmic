import { HostLoadTimeoutPrompt } from "@/wab/client/components/TopFrame/HostLoadTimeoutPrompt";
import { setLanguagePreference } from "@/wab/client/i18n";
import { ApiProject } from "@/wab/shared/ApiSchema";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { notification } from "antd";
import * as React from "react";
import { mock } from "vitest-mock-extended";

const frame = vi.hoisted(() => ({ hostConnected: false }));
vi.mock("@/wab/client/frame-ctx/top-frame-ctx", () => ({
  useTopFrameCtx: () => frame,
}));
vi.mock("@/wab/client/contexts/AppContexts", () => ({
  useAppCtx: () => ({}),
}));
vi.mock("@/wab/client/components/HostConfig", () => ({
  HostConfig: () => null,
}));
vi.mock("@/wab/client/components/quick-modals", () => ({
  showTemporaryPrompt: vi.fn(),
}));

beforeEach(() => {
  vi.useFakeTimers();
  frame.hostConnected = false;
  setLanguagePreference("en");
  vi.spyOn(notification, "warning").mockImplementation(() => undefined);
  vi.spyOn(notification, "destroy").mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const project = mock<ApiProject>();

it.each([true, false])(
  "offers a Studio reload after a stalled host, including viewer access (%s)",
  async (editorPerm) => {
    const refreshStudio = vi.fn().mockResolvedValue(undefined);
    render(
      <HostLoadTimeoutPrompt
        project={project}
        editorPerm={editorPerm}
        refreshStudio={refreshStudio}
      />,
    );
    await act(() => vi.advanceTimersByTime(9999));
    expect(notification.warning).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTime(1));
    expect(notification.warning).toHaveBeenCalledOnce();
    const prompt = vi.mocked(notification.warning).mock.calls[0][0];
    expect(prompt.key).toBeTruthy();
    expect(!!prompt.description).toBe(editorPerm);
    render(<>{prompt.actions}</>);
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    expect(refreshStudio).toHaveBeenCalledOnce();
    expect(notification.destroy).toHaveBeenCalledWith(prompt.key);
  },
);

it("cancels pending warnings and removes an existing warning when the host connects", async () => {
  const refreshStudio = vi.fn().mockResolvedValue(undefined);
  const view = () => (
    <HostLoadTimeoutPrompt
      project={project}
      editorPerm={false}
      refreshStudio={refreshStudio}
    />
  );
  const { rerender } = render(view());
  frame.hostConnected = true;
  rerender(view());
  await act(() => vi.advanceTimersByTime(10000));
  expect(notification.warning).not.toHaveBeenCalled();
  frame.hostConnected = false;
  rerender(view());
  await act(() => vi.advanceTimersByTime(10000));
  const prompt = vi.mocked(notification.warning).mock.calls[0][0];
  frame.hostConnected = true;
  rerender(view());
  expect(notification.destroy).toHaveBeenCalledWith(prompt.key);
  expect(refreshStudio).not.toHaveBeenCalled();
});

it("does not time out in a background tab and restarts the interval on return", async () => {
  const visibility = vi.spyOn(document, "visibilityState", "get");
  visibility.mockReturnValue("hidden");
  const { unmount } = render(
    <HostLoadTimeoutPrompt
      project={project}
      editorPerm={true}
      refreshStudio={vi.fn().mockResolvedValue(undefined)}
    />,
  );
  await act(() => vi.advanceTimersByTime(60000));
  expect(notification.warning).not.toHaveBeenCalled();
  visibility.mockReturnValue("visible");
  await act(() => document.dispatchEvent(new Event("visibilitychange")));
  await act(() => vi.advanceTimersByTime(5000));
  visibility.mockReturnValue("hidden");
  await act(() => document.dispatchEvent(new Event("visibilitychange")));
  await act(() => vi.advanceTimersByTime(60000));
  expect(notification.warning).not.toHaveBeenCalled();
  visibility.mockReturnValue("visible");
  await act(() => document.dispatchEvent(new Event("visibilitychange")));
  await act(() => vi.advanceTimersByTime(9999));
  expect(notification.warning).not.toHaveBeenCalled();
  await act(() => vi.advanceTimersByTime(1));
  const prompt = vi.mocked(notification.warning).mock.calls[0][0];
  visibility.mockReturnValue("hidden");
  await act(() => document.dispatchEvent(new Event("visibilitychange")));
  expect(notification.destroy).toHaveBeenCalledWith(prompt.key);
  unmount();
  visibility.mockReturnValue("visible");
  await act(() => document.dispatchEvent(new Event("visibilitychange")));
  await act(() => vi.advanceTimersByTime(10000));
  expect(notification.warning).toHaveBeenCalledOnce();
});
