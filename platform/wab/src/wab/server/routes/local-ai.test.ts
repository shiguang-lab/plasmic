import { localAiModels, localAiStatus } from "@/wab/server/routes/local-ai";
import type { Request, Response } from "express-serve-static-core";
const state = vi.hoisted(() => ({ authorize: vi.fn(), models: vi.fn() }));
vi.mock("@/wab/server/routes/util", () => ({
  getUser: () => ({ id: "user" }),
  userDbMgr: () => ({ checkProjectPerms: state.authorize }),
}));
vi.mock("@/wab/server/copilot/local-edit", () => ({
  getLocalAiConfig: () => ({ model: "fixture", apiKey: "private" }),
  getLocalAiModels: state.models,
}));
const req = {
  params: { projectId: "project" },
  devflags: { enableLocalAiEditing: true, enableLocalAiPageGeneration: true },
} as unknown as Request;
beforeEach(() => {
  state.authorize.mockReset();
  state.models.mockReset().mockResolvedValue(["fixture", "alternate"]);
});
it("returns authorized configuration without waiting for discovery or exposing credentials", async () => {
  state.models.mockReturnValue(new Promise(() => {}));
  const res = { json: vi.fn() } as unknown as Response;
  await localAiStatus(req, res);
  expect(state.authorize).toHaveBeenCalledWith("project","viewer","read AI service status");
  expect(state.models).not.toHaveBeenCalled();
  expect(res.json).toHaveBeenCalledWith({ configured: true,model: "fixture",models: ["fixture"],pageGenerationEnabled: true });
});
it("loads the model catalog separately after checking project permissions", async () => {
  const res = { json: vi.fn() } as unknown as Response;
  await localAiModels(req, res);
  expect(state.authorize).toHaveBeenCalledWith("project", "viewer", "read AI service status");
  expect(res.json).toHaveBeenCalledWith(["fixture", "alternate"]);
});
it.each([localAiStatus, localAiModels])("rejects unauthorized metadata requests", async (route) => {
  state.authorize.mockRejectedValue(new Error("Access denied"));
  const res = { json: vi.fn() } as unknown as Response;
  await expect(route(req, res)).rejects.toThrow("Access denied");
  expect(res.json).not.toHaveBeenCalled();
  expect(state.models).not.toHaveBeenCalled();
});
