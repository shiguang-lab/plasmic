import { LoadingAnimationContext } from "@/wab/client/contexts/LoadingAnimationContext";
import { HostFrameCtx, HostFrameCtxProvider, useHostFrameCtx } from "@/wab/client/frame-ctx/host-frame-ctx";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";

const api = vi.hoisted(() => ({
  registerUiLocaleListener: vi.fn(),
  registerUiAppearanceListener: vi.fn(),
  registerLocationListener: vi.fn(),
  setStudioReady: vi.fn(),
}));
vi.mock("comlink", async (original) => ({
  ...(await original<typeof import("comlink")>()),
  wrap: () => api,
  windowEndpoint: () => ({}),
  proxy: (value: unknown) => value,
}));
vi.mock("@/wab/client/cli-routes", async (original) => ({
  ...(await original<typeof import("@/wab/client/cli-routes")>()),
  ensureIsHostFrame: vi.fn(),
}));
vi.mock("@/wab/client/frame-ctx/plasmic-studio-args", async (original) => ({
  ...(await original<typeof import("@/wab/client/frame-ctx/plasmic-studio-args")>()),
  getPlasmicStudioArgs: () => ({ origin: "http://localhost" }),
}));

let contexts: HostFrameCtx[];
let unsubscribe: ReturnType<typeof vi.fn>;
beforeEach(() => {
  contexts = [];
  unsubscribe = vi.fn();
  api.registerUiLocaleListener.mockResolvedValue(unsubscribe);
  api.registerUiAppearanceListener.mockResolvedValue(unsubscribe);
  api.registerLocationListener.mockResolvedValue(unsubscribe);
});
afterEach(cleanup);

function Consumer() {
  const context = useHostFrameCtx();
  const enabled = React.useContext(LoadingAnimationContext);
  contexts.push(context);
  return <button onClick={() => { void context.revealStudio(); }}>{enabled ? "Local loading enabled" : "Covered by startup"}</button>;
}

it("keeps covered animations disabled until the outer owner acknowledges reveal, without replacing the host context", async () => {
  const pending = Promise.withResolvers<void>();
  api.setStudioReady.mockReturnValue(pending.promise);
  render(<HostFrameCtxProvider><Consumer /></HostFrameCtxProvider>);
  const button = await screen.findByRole("button", { name: "Covered by startup" });
  const context = contexts[0];
  fireEvent.click(button);
  expect(api.setStudioReady).toHaveBeenCalledOnce();
  expect(screen.queryByRole("button", { name: "Local loading enabled" })).toBeNull();
  await act(async () => { pending.resolve(); await pending.promise; });
  expect(screen.getByRole("button", { name: "Local loading enabled" })).toBeTruthy();
  expect(contexts.every(value => value === context)).toBe(true);
});

it("ignores a late reveal after the host has unmounted and releases subscriptions", async () => {
  const pending = Promise.withResolvers<void>();
  api.setStudioReady.mockReturnValue(pending.promise);
  const { unmount } = render(<HostFrameCtxProvider><Consumer /></HostFrameCtxProvider>);
  fireEvent.click(await screen.findByRole("button", { name: "Covered by startup" }));
  unmount();
  const renders = contexts.length;
  await act(async () => { pending.resolve(); await pending.promise; });
  expect(contexts).toHaveLength(renders);
  expect(unsubscribe).toHaveBeenCalledTimes(3);
});
