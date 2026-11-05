import { useLocalAiStatus } from "@/wab/client/copilot/use-local-ai-status";
import { LocalAiModel, LocalAiStatus } from "@/wab/shared/copilot/local-edit";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";

const request = vi.hoisted(() => vi.fn());
vi.mock("@/wab/client/copilot/local-edit-session", () => ({
  localAiFetch: request,
}));
const options = (...ids: string[]): LocalAiModel[] => ids.map(id => ({ id }));
const status: LocalAiStatus = {
  configured: true,
  model: "model",
  models: options("model", "alternate"),
  pageGenerationEnabled: true,
};
afterEach(cleanup);
beforeEach(() => {
  request.mockReset();
  request.mockImplementation(async (_project: string, action: string) =>
    action === "models" ? status.models : status,
  );
});

it("fetches again on every mount, including simultaneous views of the same project", async () => {
  const first = renderHook(() => useLocalAiStatus("project", true));
  await waitFor(() => expect(first.result.current.data?.models).toEqual(status.models));
  const second = renderHook(() => useLocalAiStatus("project", true));
  await waitFor(() => expect(second.result.current.data?.models).toEqual(status.models));
  expect(request).toHaveBeenCalledTimes(4);
  first.unmount();
  second.unmount();
  request.mockImplementation(async (_project: string, action: string) =>
    action === "models" ? options("new-model") : status,
  );
  const reopened = renderHook(() => useLocalAiStatus("project", true));
  await waitFor(() => expect(reopened.result.current.data?.models).toEqual(options("new-model")));
  expect(request).toHaveBeenCalledTimes(6);
});

it("clears metadata while disabled and fetches again on enablement and project changes", async () => {
  const { result, rerender } = renderHook(
    ({ project, enabled }) => useLocalAiStatus(project, enabled),
    { initialProps: { project: "first", enabled: false } },
  );
  expect(request).not.toHaveBeenCalled();
  rerender({ project: "first", enabled: true });
  await waitFor(() => expect(result.current.modelsLoaded).toBe(true));
  rerender({ project: "second", enabled: true });
  expect(result.current.data).toBeUndefined();
  expect(result.current.modelsLoaded).toBe(false);
  await waitFor(() => expect(result.current.modelsLoaded).toBe(true));
  expect(request).toHaveBeenCalledWith("second", "status");
  expect(request).toHaveBeenCalledWith("second", "models");
  rerender({ project: "second", enabled: false });
  expect(result.current.data).toBeUndefined();
  expect(result.current.modelsLoaded).toBe(false);
  rerender({ project: "second", enabled: true });
  await waitFor(() => expect(result.current.modelsLoaded).toBe(true));
  expect(request).toHaveBeenCalledTimes(6);
});

it("loads status and models independently so discovery does not block editing", async () => {
  let finishStatus: (value: LocalAiStatus) => void = () => { throw new Error("Missing status request"); };
  let finishModels: (value: LocalAiModel[]) => void = () => { throw new Error("Missing models request"); };
  request.mockImplementation((_project: string, action: string) => action === "status"
    ? new Promise<LocalAiStatus>(resolve => { finishStatus = resolve; })
    : new Promise<LocalAiModel[]>(resolve => { finishModels = resolve; }));
  const { result } = renderHook(() => useLocalAiStatus("project", true));
  expect(request).toHaveBeenCalledWith("project", "status");
  expect(request).toHaveBeenCalledWith("project", "models");
  expect(result.current.data).toBeUndefined();
  await act(async () => { finishStatus({ ...status, models: options("model") }); });
  expect(result.current.data?.configured).toBe(true);
  expect(result.current.data?.models).toEqual(options("model"));
  expect(result.current.modelsLoaded).toBe(false);
  await act(async () => { finishModels(status.models); });
  expect(result.current.data?.models).toEqual(status.models);
  expect(result.current.modelsLoaded).toBe(true);
});

it.each(["fallback", "error"])("requests a fresh catalog explicitly after a %s", async failure => {
  let attempts = 0;
  request.mockImplementation(async (_project: string, action: string) => {
    if (action === "status") {
      return { ...status, models: options("model") };
    }
    if (++attempts === 1) {
      if (failure === "error") {
        throw new Error("Discovery unavailable");
      }
      return options("model");
    }
    return status.models;
  });
  const { result } = renderHook(() => useLocalAiStatus("project", true));
  await waitFor(() => expect(result.current.data?.models).toEqual(options("model")));
  expect(result.current.error).toBeUndefined();
  act(() => result.current.refreshModels());
  await waitFor(() => expect(result.current.data?.models).toEqual(status.models));
  expect(attempts).toBe(2);
  expect(request).toHaveBeenCalledTimes(3);
});

it.each(["focus", "online"])("requests models directly on %s", async event => {
  const { result } = renderHook(() => useLocalAiStatus("project", true));
  await waitFor(() => expect(result.current.modelsLoaded).toBe(true));
  request.mockImplementation(async () => options("recovered"));
  act(() => { window.dispatchEvent(new Event(event)); });
  await waitFor(() => expect(result.current.data?.models).toEqual(options("recovered")));
  expect(request).toHaveBeenCalledTimes(3);
});

it("ignores late status and model responses from a previous project", async () => {
  let finishStatus: (value: LocalAiStatus) => void = () => { throw new Error("Missing status request"); };
  let finishModels: (value: LocalAiModel[]) => void = () => { throw new Error("Missing models request"); };
  request.mockImplementation((project: string, action: string) => {
    if (project === "first") {
      return action === "status"
        ? new Promise<LocalAiStatus>(resolve => { finishStatus = resolve; })
        : new Promise<LocalAiModel[]>(resolve => { finishModels = resolve; });
    }
    return Promise.resolve(action === "status" ? status : options("second-model"));
  });
  const { result, rerender } = renderHook(project => useLocalAiStatus(project, true), { initialProps: "first" });
  rerender("second");
  await waitFor(() => expect(result.current.data?.models).toEqual(options("second-model")));
  await act(async () => {
    finishStatus({ ...status, model: "first-model" });
    finishModels(options("first-model"));
  });
  expect(result.current.data?.model).toBe("model");
  expect(result.current.data?.models).toEqual(options("second-model"));
});

it("ignores an older catalog request when a newer request has already completed", async () => {
  let finish: (value: LocalAiModel[]) => void = () => { throw new Error("Missing models request"); };
  request.mockImplementation((_project: string, action: string) => action === "status"
    ? Promise.resolve(status) : new Promise<LocalAiModel[]>(resolve => { finish = resolve; }));
  const { result } = renderHook(() => useLocalAiStatus("project", true));
  const finishOld = finish;
  request.mockResolvedValue(options("new-model"));
  act(() => result.current.refreshModels());
  await waitFor(() => expect(result.current.data?.models).toEqual(options("new-model")));
  await act(async () => { finishOld(options("old-model")); });
  expect(result.current.data?.models).toEqual(options("new-model"));
});

it("validates status responses and reports errors without retaining previous status", async () => {
  request.mockImplementation(async (_project: string, action: string) => action === "status" ? {} : status.models);
  const { result } = renderHook(() => useLocalAiStatus("project", true));
  await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
  expect(result.current.data).toBeUndefined();
});
