import { ensure } from "@/wab/shared/common";
import { Pt } from "@/wab/shared/geom";
import { createStudioUiEnvironmentFixture } from "@/wab/client/__testonly__/studio-ui-environment";
import { AntdConfigProvider } from "@/wab/client/antd-theme";
import { createViewportFixture } from "@/wab/client/__testonly__/viewport";
import { ZoomButton } from "@/wab/client/components/top-bar/ZoomButton";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import {
  act,
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
  Object.defineProperties(ctx, Object.getOwnPropertyDescriptors(createViewportFixture(0.34)));
  Object.assign(ctx, createStudioUiEnvironmentFixture());
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


it("selects native arena availability and zoom without a parent rerender", async () => {
  const ctx = mock<StudioCtx>();
  const environment = createStudioUiEnvironmentFixture();
  const geometry = createViewportFixture(0.5);
  const viewport = ensure(geometry.viewportCtx, "Viewport fixture");
  Object.defineProperties(ctx, Object.getOwnPropertyDescriptors(geometry));
  Object.assign(ctx, environment);
  const view = render(<AntdConfigProvider productUI><StudioCtxContext.Provider value={ctx}><ZoomButton /></StudioCtxContext.Provider></AntdConfigProvider>);
  const button = screen.getByRole("button", { name: "Zoom" }) as HTMLButtonElement;
  expect(button.disabled).toBe(false);
  expect(button.textContent).toContain("50%");
  act(() => { environment.uiEnvironment.store.setState({ currentArenaEmpty: true }); });
  expect(button.disabled).toBe(true);
  act(() => { viewport.enqueueTransform(0.75, Pt.zero(), false); });
  expect(button.textContent).toContain("75%");
  act(() => { environment.uiEnvironment.store.setState({ currentArenaEmpty: false }); });
  expect(button.disabled).toBe(false);
  fireEvent.click(button);
  const input = await screen.findByRole("spinbutton", { name: "Zoom" });
  expect((input as HTMLInputElement).value).toContain("75%");
  view.unmount();
});
