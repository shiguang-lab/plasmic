import { useLocalAiStatus } from "@/wab/client/copilot/use-local-ai-status";
import { LocalAiStatus } from "@/wab/shared/copilot/local-edit";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import * as React from "react";
import { SWRConfig } from "swr";

const request = vi.hoisted(() => vi.fn());
vi.mock("@/wab/client/copilot/local-edit-session", () => ({
  localAiFetch: request,
}));
const status: LocalAiStatus = {
  configured: true,
  model: "model",
  models: ["model", "alternate"],
  pageGenerationEnabled: true,
};
afterEach(cleanup);
beforeEach(() => {
  request.mockReset();
  request.mockImplementation(async (_project: string, action: string) => action === "models" ? status.models : status);
});
function View({
  project,
  enabled,
  label,
}: {
  project: string;
  enabled: boolean;
  label: string;
}) {
  const { data } = useLocalAiStatus(project, enabled);
  return (
    <div>
      {label}: {data?.model ?? "loading"}
    </div>
  );
}
function Page({
  project = "project",
  enabled = true,
}: {
  project?: string;
  enabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <View project={project} enabled={enabled} label="Page" />
      <button onClick={() => setOpen(!open)}>Toggle AI</button>
      {open && (
        <>
          <View project={project} enabled={enabled} label="Panel" />
          <View project={project} enabled={enabled} label="Chat" />
        </>
      )}
    </>
  );
}
it("prefetches before opening AI, coalesces pending consumers and reuses data after reopening", async () => {
  let finish: (value: LocalAiStatus) => void = () => {
    throw new Error("Missing deferred request");
  };
  request.mockImplementationOnce(
    () =>
      new Promise<LocalAiStatus>((resolve) => {
        finish = resolve;
      }),
  );
  render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <Page />
    </SWRConfig>,
  );
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith("project", "status"),
  );
  fireEvent.click(screen.getByRole("button", { name: "Toggle AI" }));
  expect(request).toHaveBeenCalledTimes(2);
  expect(request).toHaveBeenCalledWith("project", "models");
  await act(async () => {
    finish(status);
  });
  await screen.findByText("Panel: model");
  await screen.findByText("Chat: model");
  fireEvent.click(screen.getByRole("button", { name: "Toggle AI" }));
  fireEvent.click(screen.getByRole("button", { name: "Toggle AI" }));
  expect(screen.getByText("Panel: model")).toBeTruthy();
  expect(request).toHaveBeenCalledTimes(2);
  expect(request).toHaveBeenCalledWith("project", "models");
});
it("respects feature enablement and fetches a separate catalog when switching projects", async () => {
  const cache = new Map();
  const ui = (project: string, enabled: boolean) => (
    <SWRConfig value={{ provider: () => cache }}>
      <Page project={project} enabled={enabled} />
    </SWRConfig>
  );
  const { rerender } = render(ui("first", false));
  expect(request).not.toHaveBeenCalled();
  rerender(ui("first", true));
  await screen.findByText("Page: model");
  expect(request).toHaveBeenCalledWith("first", "status");
  await waitFor(() => expect(request).toHaveBeenCalledWith("first", "models"));
  rerender(ui("second", true));
  await waitFor(() => expect(request).toHaveBeenCalledWith("second", "models"));
  expect(request).toHaveBeenCalledWith("second", "status");
  expect(request).toHaveBeenCalledTimes(4);
});

it.each(["focus", "online"])(
  "refreshes a fallback model catalog on %s",
  async (event) => {
    let attempts = 0;
    request.mockImplementation(async (_project: string, action: string) =>
      action === "status" ? { ...status, models: [status.model] } : ++attempts === 1 ? [status.model] : status.models,
    );
    const cache = new Map();
    const { result } = renderHook(() => useLocalAiStatus("project", true), {
      wrapper: ({ children }) => (
        <SWRConfig value={{ provider: () => cache, dedupingInterval: 0, focusThrottleInterval: 0 }}>
          {children}
        </SWRConfig>
      ),
    });
    await waitFor(() => expect(result.current.data?.models).toEqual(["model"]));
    await act(() => {
      window.dispatchEvent(new Event(event));
    });
    await waitFor(() => expect(result.current.data?.models).toEqual(status.models));
  },
);

it("makes the default model available while discovery is pending, then updates the catalog", async () => {
  let finish: (models: string[]) => void = () => { throw new Error("Missing model request"); };
  request.mockImplementation(async (_project: string, action: string) =>
    action === "status" ? { ...status, models: [status.model] } : new Promise<string[]>(resolve => { finish = resolve; }),
  );
  const { result } = renderHook(() => useLocalAiStatus("slow-models", true), {
    wrapper: ({ children }) => <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>,
  });
  await waitFor(() => expect(request).toHaveBeenCalledWith("slow-models", "models"));
  expect(result.current.data).toMatchObject({ configured: true, model: "model", models: ["model"] });
  expect(result.current.modelsLoaded).toBe(false);
  expect(result.current.isLoading).toBe(false);
  await act(async () => finish(status.models));
  expect(result.current.data?.models).toEqual(status.models);
  expect(result.current.modelsLoaded).toBe(true);
});
it("keeps configured editing available if model discovery fails", async () => {
  request.mockImplementation(async (_project: string, action: string) => {
    if (action === "models") { throw new Error("Discovery unavailable"); }
    return { ...status, models: [status.model] };
  });
  const { result } = renderHook(() => useLocalAiStatus("failed-models", true), {
    wrapper: ({ children }) => <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>,
  });
  await waitFor(() => expect(request).toHaveBeenCalledWith("failed-models", "models"));
  expect(result.current.data?.configured).toBe(true);
  expect(result.current.data?.model).toBe("model");
  expect(result.current.error).toBeUndefined();
});

it("loads models without waiting for status and exposes a warm catalog during revalidation", async () => {
  let finishStatus: (value: LocalAiStatus) => void = () => { throw new Error("Missing status request"); };
  let finishModels: (value: string[]) => void = () => { throw new Error("Missing models request"); };
  request.mockImplementation((_project: string, action: string) => action === "status"
    ? new Promise<LocalAiStatus>(resolve => { finishStatus = resolve; })
    : new Promise<string[]>(resolve => { finishModels = resolve; }));
  const { result } = renderHook(() => useLocalAiStatus("parallel", true), {
    wrapper: ({ children }) => <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>,
  });
  await waitFor(() => expect(request).toHaveBeenCalledWith("parallel", "models"));
  expect(result.current.data).toBeUndefined();
  await act(async () => finishStatus(status));
  expect(result.current.data?.models).toEqual(status.models);
  expect(result.current.modelsLoaded).toBe(false);
  await act(async () => finishModels([...status.models, "new"]));
  expect(result.current.data?.models).toEqual([...status.models, "new"]);
});
