import { AntdConfigProvider } from "@/wab/client/antd-theme";
import { ZoomButton } from "@/wab/client/components/top-bar/ZoomButton";
import { StudioCtx, StudioCtxContext } from "@/wab/client/studio-ctx/StudioCtx";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import * as React from "react";
import { mock } from "vitest-mock-extended";

beforeEach(() =>
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  ),
);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("keeps the zoom input mounted while editing and ignores a cleared percentage", async () => {
  const ctx = mock<StudioCtx>();
  Object.defineProperties(ctx, {
    currentArena: { value: undefined },
    currentArenaEmpty: { value: false },
    zoom: { value: 0.34 },
  });
  render(
    <AntdConfigProvider productUI>
      <StudioCtxContext.Provider value={ctx}>
        <ZoomButton />
      </StudioCtxContext.Provider>
    </AntdConfigProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Zoom" }));
  const input = await screen.findByRole("spinbutton", { name: "Zoom" });
  expect(screen.queryByText("Pages overview")).toBeNull();
  expect(screen.queryByText("Hide panels")).toBeNull();
  fireEvent.change(input, { target: { value: "50%" } });
  await waitFor(() => expect(ctx.tryZoomWithScale).toHaveBeenCalledWith(0.5));
  expect(screen.getByRole("spinbutton", { name: "Zoom" })).toBe(input);
  ctx.tryZoomWithScale.mockClear();
  fireEvent.change(input, { target: { value: "" } });
  expect(ctx.tryZoomWithScale).not.toHaveBeenCalled();
});
