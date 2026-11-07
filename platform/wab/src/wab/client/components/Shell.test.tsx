import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { createMemoryHistory, type History } from "history";
import React from "react";
import type { Root } from "react-dom/client";

const fixture = vi.hoisted(() => ({
  top: true,
  host: undefined as { history: History } | undefined,
  roots: [] as Root[],
  renderError: undefined as Error | undefined,
  handleError: vi.fn(),
  log: Object.getOwnPropertyDescriptor(console, "log"),
}));
vi.mock("@/wab/client/ErrorNotifications", () => ({
  handleError: fixture.handleError,
  normalizeError: (error: unknown) => error instanceof Error ? error : new Error(String(error)),
}));
vi.mock("react-dom/client", async (original) => {
  const actual = await original<typeof import("react-dom/client")>();
  return { ...actual, createRoot: vi.fn((...args: Parameters<typeof actual.createRoot>) => {
    const root = actual.createRoot(...args);
    fixture.roots.push(root);
    return root;
  }) };
});
vi.mock("@/wab/client/cli-routes", () => ({ isTopFrame: () => fixture.top }));
vi.mock("@/wab/client/desktop-navigation", () => ({ installDesktopNavigation: vi.fn() }));
vi.mock("@/wab/client/observability", () => ({ initObservability: vi.fn() }));
vi.mock("@/wab/client/client-dev-flags", () => ({ initClientFlags: () => ({}) }));
vi.mock("@/wab/client/components/widgets/TriggerAnchor", () => ({ watchUnanchoredPopups: vi.fn() }));
vi.mock("@/wab/client/components/live/PresentationEntry", () => ({ PresentationEntry: ({ children }: React.PropsWithChildren) => <div data-testid="presentation-entry">{children}</div> }));
vi.mock("@/wab/client/components/studio/StudioChrome", () => ({ StudioStartupBoundary: ({ children }: React.PropsWithChildren) => <section data-testid="startup-boundary">{children}</section> }));
vi.mock("@/wab/client/frame-ctx/host-frame-ctx", () => ({
  HostFrameCtxProvider: ({ children }: React.PropsWithChildren) => <section data-testid="host-frame">{children}</section>,
  useHostFrameCtxIfHostFrame: () => fixture.top ? undefined : fixture.host,
}));
vi.mock("@/wab/client/components/root-view", () => ({ Root: () => {
  const [count, setCount] = React.useState(0);
  if (fixture.renderError) {
    throw fixture.renderError;
  }
  return <button onClick={() => setCount(count + 1)}>Count {count}</button>;
} }));

afterEach(() => {
  act(() => fixture.roots.splice(0).forEach((root) => root.unmount()));
  document.querySelector(".app-container")?.remove();
  fixture.renderError = undefined;
  fixture.handleError.mockClear();
  if (fixture.log) {
    Object.defineProperty(console, "log", fixture.log);
  }
});

it("reports an uncaught React 19 render failure once through application error handling", async () => {
  fixture.top = false;
  fixture.host = { history: createMemoryHistory() };
  fixture.renderError = new Error("uncaught render failure");
  vi.resetModules();
  const { main } = await import("@/wab/client/components/Shell");
  const container = document.createElement("div");
  container.className = "app-container";
  document.body.append(container);
  // act rethrows uncaught render errors instead of calling root.onUncaughtError.
  // Let the real scheduler commit this failure, as it does in the application.
  const actEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  try {
    main();
    await waitFor(() => expect(fixture.handleError).toHaveBeenCalledExactlyOnceWith(fixture.renderError));
  } finally {
    globalThis.IS_REACT_ACT_ENVIRONMENT = actEnvironment;
  }
  expect(container.childElementCount).toBe(0);
});

it.each([true, false])("mounts and reuses one application root, top frame: %s", async (top) => {
  fixture.top = top;
  fixture.host = { history: createMemoryHistory() };
  vi.resetModules();
  const { main } = await import("@/wab/client/components/Shell");
  const container = document.createElement("div");
  container.className = "app-container";
  document.body.append(container);
  act(() => main());
  fireEvent.click(screen.getByRole("button", { name: "Count 0" }));
  act(() => main());
  expect(fixture.roots).toHaveLength(1);
  expect(screen.getByRole("button", { name: "Count 1" })).toBeTruthy();
  expect(!!screen.queryByTestId("host-frame")).toBe(!top);
  expect(!!screen.getByTestId("presentation-entry").closest('[data-testid="startup-boundary"]')).toBe(top);
});
