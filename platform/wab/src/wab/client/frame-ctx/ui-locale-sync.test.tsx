import { FrameMessage } from "@/wab/client/frame-ctx/frame-message-types";
import {
  TopFrameApi,
  TopFrameFullApi,
} from "@/wab/client/frame-ctx/top-frame-api";
import { TopFrameCtxProvider } from "@/wab/client/frame-ctx/top-frame-ctx";
import { setLanguagePreference } from "@/wab/client/i18n";
import { ensure } from "@/wab/shared/common";
import { act, cleanup, render } from "@testing-library/react";
import * as React from "react";

const wire = vitest.hoisted(() => ({
  exposed: undefined as TopFrameFullApi | undefined,
}));
vitest.mock("@/wab/client/cli-routes", () => ({
  ensureIsTopFrame: vitest.fn(),
}));
vitest.mock("@/wab/client/api", () => ({ filteredApi: () => ({}) }));
vitest.mock("@/wab/client/contexts/AppContexts", () => ({
  useAppCtx: () => ({ api: {}, appConfig: {} }),
}));
vitest.mock("comlink", () => ({
  windowEndpoint: () => ({
    addEventListener: vitest.fn(),
    removeEventListener: vitest.fn(),
  }),
  expose: (api: TopFrameFullApi) => {
    wire.exposed = api;
  },
  proxy: (value: unknown) => value,
}));

function connect() {
  const mounted = render(
    <TopFrameCtxProvider projectId="project" topFrameApi={{} as TopFrameApi}>
      <div>Host placeholder</div>
    </TopFrameCtxProvider>,
  );
  act(() => {
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: FrameMessage.PlasmicHostRegister },
        source: window,
      }),
    );
  });
  return {
    mounted,
    api: ensure(wire.exposed, "Expected exposed top frame API"),
  };
}
afterEach(() => {
  cleanup();
  wire.exposed = undefined;
});
it("awaits the initial locale callback before allowing the host registration to finish", async () => {
  setLanguagePreference("zh-CN");
  const { api } = connect();
  let finish: (() => void) | undefined;
  const initial = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const listener = vitest.fn(() => initial);
  let registered = false;
  const registration = api
    .registerUiLocaleListener(listener)
    .then((unregister) => {
      registered = true;
      return unregister;
    });
  expect(listener).toHaveBeenCalledWith("zh-CN");
  await Promise.resolve();
  expect(registered).toBe(false);
  ensure(finish, "Expected pending initial locale callback")();
  const unregister = await registration;
  expect(registered).toBe(true);
  unregister();
});
it("keeps the editor synchronized and removes its listener when the frame is disposed", async () => {
  setLanguagePreference("en");
  const { api, mounted } = connect();
  const listener = vitest.fn();
  await api.registerUiLocaleListener(listener);
  act(() => setLanguagePreference("ko"));
  expect(listener).toHaveBeenLastCalledWith("ko");
  mounted.unmount();
  listener.mockClear();
  act(() => setLanguagePreference("ja"));
  expect(listener).not.toHaveBeenCalled();
});
