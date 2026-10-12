import { localAiStatus, localAiStep } from "@/wab/server/routes/local-ai";
import { LocalEditRequest } from "@/wab/shared/copilot/local-edit";
import type { Request, Response } from "express-serve-static-core";
import { EventEmitter } from "node:events";
const state = vi.hoisted(() => ({
  authorize: vi.fn(),
  user: vi.fn(),
  generate: vi.fn(),
  config: { model: "fixture-model", apiKey: "never-return-this" },
}));
vi.mock("@/wab/server/routes/util", () => ({
  getUser: state.user,
  userDbMgr: () => ({ checkProjectPerms: state.authorize }),
}));
vi.mock("@/wab/server/copilot/local-edit", () => ({
  generateLocalEditStep: state.generate,
  getLocalAiConfig: () => state.config,
}));

const body: LocalEditRequest = {
  binding: {
    projectId: "project",
    branchId: null,
    sessionId: "session",
    changeCounter: 0,
    componentUuid: "page",
    elementUuids: [],
  },
  prompt: "Update",
  resources: "Resource",
  history: [],
};
function fixture(enabled = true) {
  const req = {
    params: { projectId: "project" },
    devflags: { enableLocalAiEditing: enabled },
    body,
  } as unknown as Request;
  const res = Object.assign(new EventEmitter(), {
    json: vi.fn(),
    writableEnded: false,
  }) as unknown as Response;
  res.status = vi.fn(() => res);
  return { req, res };
}
beforeEach(() => {
  vi.clearAllMocks();
  state.authorize.mockResolvedValue(undefined);
});
it("requires editor permission and returns only public model status", async () => {
  const { req, res } = fixture();
  await localAiStatus(req, res);
  expect(state.authorize).toHaveBeenCalledWith(
    "project",
    "editor",
    "edit with AI",
  );
  expect(res.json).toHaveBeenCalledWith({
    configured: true,
    model: "fixture-model",
    pageGenerationEnabled: false,
  });
  expect(JSON.stringify(vi.mocked(res.json).mock.calls)).not.toContain(
    state.config.apiKey,
  );
});
it("rejects a disabled feature before using the model", async () => {
  const { req, res } = fixture(false);
  await expect(localAiStep(req, res)).rejects.toThrow("disabled");
  expect(state.generate).not.toHaveBeenCalled();
});
it("rejects an unauthorized user before using the model", async () => {
  state.authorize.mockRejectedValueOnce(new Error("Not an editor"));
  const { req, res } = fixture();
  await expect(localAiStep(req, res)).rejects.toThrow("Not an editor");
  expect(state.generate).not.toHaveBeenCalled();
});
it("rejects a mismatched project identity", async () => {
  const { req, res } = fixture();
  req.body = { ...body, binding: { ...body.binding, projectId: "other" } };
  await expect(localAiStep(req, res)).rejects.toThrow("Invalid");
  expect(state.generate).not.toHaveBeenCalled();
});
it("aborts the provider when the Web client disconnects", async () => {
  const { req, res } = fixture();
  let started = () => {};
  const entered = new Promise<void>((resolve) => {
    started = resolve;
  });
  state.generate.mockImplementation(async (_request, signal: AbortSignal) => {
    started();
    return new Promise((resolve) =>
      signal.addEventListener("abort", () => resolve({ text: "", calls: [] }), {
        once: true,
      }),
    );
  });
  const pending = localAiStep(req, res);
  await entered;
  res.emit("close");
  await pending;
  expect(state.generate.mock.calls[0][1].aborted).toBe(true);
  expect(res.json).not.toHaveBeenCalled();
  expect(res.listenerCount("close")).toBe(0);
});
it("does not return provider errors containing credentials", async () => {
  const { req, res } = fixture();
  state.generate.mockRejectedValueOnce(
    new Error("Invalid key: never-return-this"),
  );
  await localAiStep(req, res);
  expect(res.status).toHaveBeenCalledWith(502);
  expect(JSON.stringify(vi.mocked(res.json).mock.calls)).not.toContain(
    "never-return-this",
  );
});
it("does not start the model if the client disconnected during authorization", async () => {
  const { req, res } = fixture();
  state.authorize.mockImplementationOnce(async () => {
    Object.defineProperty(res, "destroyed", { value: true });
  });
  await localAiStep(req, res);
  expect(state.generate).not.toHaveBeenCalled();
});

it("gates whole-page requests separately and rejects an uncreated page", async () => {
  const { req, res } = fixture();
  req.body = { ...body, binding: { ...body.binding, mode: "page" } };
  await expect(localAiStep(req, res)).rejects.toThrow(
    "page generation is disabled",
  );
  expect(state.generate).not.toHaveBeenCalled();
  req.devflags.enableLocalAiPageGeneration = true;
  state.generate.mockResolvedValue({ text: "Done", calls: [] });
  await localAiStep(req, res);
  expect(state.generate).toHaveBeenCalledOnce();
  req.body = {
    ...body,
    binding: { ...body.binding, mode: "page", componentUuid: null },
  };
  await expect(localAiStep(req, res)).rejects.toThrow("Invalid");
});
