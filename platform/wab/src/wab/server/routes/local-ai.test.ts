import { localAiStatus, localAiStep } from "@/wab/server/routes/local-ai";
import { LocalEditRequest } from "@/wab/shared/copilot/local-edit";
import express from "express";
import type { Request, Response } from "express-serve-static-core";
import { EventEmitter } from "node:events";
import { createServer, request as httpRequest } from "node:http";
import { AddressInfo } from "node:net";
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
    setHeader: vi.fn(),
    end: vi.fn(),
    write: vi.fn(),
    headersSent: false,
    writableEnded: false,
  }) as unknown as Response;
  res.status = vi.fn(() => res);
  vi.mocked(res.write).mockImplementation(() => {
    Object.defineProperty(res, "headersSent", {
      value: true,
      configurable: true,
    });
    return true;
  });
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

afterEach(() => vi.useRealTimers());

it("keeps a long model response alive as one valid JSON document and cleans up timers", async () => {
  vi.useFakeTimers();
  const { req, res } = fixture();
  let resolveModel: ((value: unknown) => void) | undefined;
  state.generate.mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveModel = resolve;
      }),
  );
  const task = localAiStep(req, res);
  await vi.waitFor(() => expect(state.generate).toHaveBeenCalledOnce());
  await vi.advanceTimersByTimeAsync(70000);
  expect(res.write).toHaveBeenCalledTimes(7);
  expect(res.setHeader).toHaveBeenCalledWith("X-Accel-Buffering", "no");
  expect(res.setHeader).toHaveBeenCalledWith("Content-Encoding", "identity");
  if (!resolveModel) {
    throw new Error("Provider did not start");
  }
  resolveModel({ text: "Done", calls: [] });
  await task;
  const streamed =
    vi
      .mocked(res.write)
      .mock.calls.map(([chunk]) => chunk)
      .join("") + vi.mocked(res.end).mock.calls[0][0];
  expect(JSON.parse(streamed)).toEqual({ text: "Done", calls: [] });
  expect(res.listenerCount("close")).toBe(0);
  const count = vi.mocked(res.write).mock.calls.length;
  await vi.advanceTimersByTimeAsync(30000);
  expect(res.write).toHaveBeenCalledTimes(count);
});

it("returns a sanitized error in an already started JSON response", async () => {
  vi.useFakeTimers();
  const { req, res } = fixture();
  let rejectModel: ((error: Error) => void) | undefined;
  state.generate.mockImplementation(
    () =>
      new Promise((_resolve, reject) => {
        rejectModel = reject;
      }),
  );
  const task = localAiStep(req, res);
  await vi.waitFor(() => expect(state.generate).toHaveBeenCalledOnce());
  await vi.advanceTimersByTimeAsync(10000);
  if (!rejectModel) {
    throw new Error("Provider did not start");
  }
  rejectModel(new Error("Invalid key: never-return-this"));
  await task;
  const result = JSON.parse(String(vi.mocked(res.end).mock.calls[0][0]));
  expect(result.error.message).toContain("AI service request failed");
  expect(JSON.stringify(result)).not.toContain("never-return-this");
  expect(res.json).not.toHaveBeenCalled();
  expect(res.listenerCount("close")).toBe(0);
});

it("completes a real HTTP response through a shorter idle proxy", async () => {
  const app = express();
  app.use(express.json());
  app.post("/projects/:projectId/step", (req, res) => {
    req.devflags = { enableLocalAiEditing: true } as Request["devflags"];
    void localAiStep(req, res).catch((error) =>
      res.status(500).end(String(error)),
    );
  });
  state.generate.mockImplementation(
    () =>
      new Promise((resolve) =>
        setTimeout(
          () => resolve({ text: "Long model result", calls: [] }),
          18000,
        ),
      ),
  );
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  const proxy = createServer((req, res) => {
    const upstream = httpRequest(
      {
        hostname: "127.0.0.1",
        port,
        path: "/projects/project/step",
        method: "POST",
        headers: req.headers,
      },
      (reply) => {
        res.writeHead(reply.statusCode ?? 500, reply.headers);
        reply.pipe(res);
      },
    );
    upstream.setTimeout(12000, () =>
      upstream.destroy(new Error("Idle timeout")),
    );
    upstream.on("error", () => {
      res.statusCode = 504;
      res.end("Idle timeout");
    });
    req.pipe(upstream);
  });
  await new Promise<void>((resolve) => proxy.listen(0, "127.0.0.1", resolve));
  try {
    const response = await fetch(
      `http://127.0.0.1:${(proxy.address() as AddressInfo).port}/step`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      text: "Long model result",
      calls: [],
    });
  } finally {
    await Promise.all([
      new Promise<void>((resolve) => server.close(() => resolve())),
      new Promise<void>((resolve) => proxy.close(() => resolve())),
    ]);
  }
});
