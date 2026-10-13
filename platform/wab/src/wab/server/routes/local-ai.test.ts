import { localAiStatus } from "@/wab/server/routes/local-ai";
import type { Request,Response } from "express-serve-static-core";
const state = vi.hoisted(() => ({ authorize: vi.fn() }));
vi.mock("@/wab/server/routes/util",() => ({ getUser: () => ({ id: "user" }),userDbMgr: () => ({ checkProjectPerms: state.authorize }) }));
vi.mock("@/wab/server/copilot/local-edit",() => ({ getLocalAiConfig: () => ({ model: "fixture",apiKey: "private" }),getLocalAiModels: async () => ["fixture"] }));
it("authorizes model metadata and returns no credentials",async () => {
  const res = { json: vi.fn() } as unknown as Response;
  await localAiStatus({ params: { projectId: "project" },devflags: { enableLocalAiEditing: true,enableLocalAiPageGeneration: true } } as unknown as Request,res);
  expect(state.authorize).toHaveBeenCalledWith("project","viewer","read AI service status");
  expect(res.json).toHaveBeenCalledWith({ configured: true,model: "fixture",models: ["fixture"],pageGenerationEnabled: true });
});
