import {
  createPresentation,
  getPresentation,
} from "@/wab/server/routes/presentations";
import {
  ForbiddenError,
  UnauthorizedError,
} from "@/wab/shared/ApiErrors/errors";
import type { Request, Response } from "express";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  project: { id: "project" },
  getProject: vi.fn(),
  find: vi.fn(),
  query: vi.fn(),
}));
vi.mock("@/wab/server/entities/Entities", () => ({ Project: class {} }));
vi.mock("@/wab/server/routes/util", () => ({
  userDbMgr: () => ({
    getProjectById: mocks.getProject,
    getEntMgr: () => ({ findOne: mocks.find, query: mocks.query }),
  }),
}));
function fixture(user = true) {
  return {
    req: {
      params: { projectId: "project", code: "0123456789" },
      user: user ? { id: "user" } : undefined,
    } as unknown as Request,
    res: { setHeader: vi.fn(), json: vi.fn() } as unknown as Response,
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getProject.mockResolvedValue(mocks.project);
  mocks.find.mockResolvedValue(mocks.project);
  mocks.query.mockResolvedValue([[{ code: "0123456789" }], 1]);
});
it("allocates a stable draft identifier only after normal project permission checks", async () => {
  const { req, res } = fixture();
  await createPresentation(req, res);
  expect(mocks.getProject).toHaveBeenCalledExactlyOnceWith("project");
  expect(mocks.query.mock.calls[0][0]).toContain(
    'COALESCE("presentationCode", $2)',
  );
  expect(res.json).toHaveBeenCalledWith({
    projectId: "project",
    code: "0123456789",
  });
  expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
});
it("never allocates an identifier when access is denied", async () => {
  mocks.getProject.mockRejectedValue(new ForbiddenError());
  const { req, res } = fixture();
  await expect(createPresentation(req, res)).rejects.toBeInstanceOf(
    ForbiddenError,
  );
  expect(mocks.query).not.toHaveBeenCalled();
});
it("a known short code cannot bypass project permissions or read a deleted project", async () => {
  mocks.getProject.mockRejectedValue(new ForbiddenError());
  const { req, res } = fixture();
  await expect(getPresentation(req, res)).rejects.toBeInstanceOf(
    ForbiddenError,
  );
  expect(res.json).not.toHaveBeenCalled();
});
it("prompts anonymous private-project visitors to sign in", async () => {
  mocks.getProject.mockRejectedValue(new ForbiddenError());
  const { req, res } = fixture(false);
  await expect(getPresentation(req, res)).rejects.toBeInstanceOf(
    UnauthorizedError,
  );
});
it("resolves a viewer without granting editor permission or changing publication state", async () => {
  const { req, res } = fixture();
  await getPresentation(req, res);
  expect(res.json).toHaveBeenCalledWith({
    projectId: "project",
    code: "0123456789",
  });
  expect(mocks.query).not.toHaveBeenCalled();
});
it("rejects invalid or nonexistent codes", async () => {
  const { req, res } = fixture();
  req.params.code = "../project";
  await expect(getPresentation(req, res)).rejects.toMatchObject({
    statusCode: 404,
  });
  expect(mocks.find).not.toHaveBeenCalled();
  req.params.code = "0123456789";
  mocks.find.mockResolvedValue(undefined);
  await expect(getPresentation(req, res)).rejects.toMatchObject({
    statusCode: 404,
  });
});
