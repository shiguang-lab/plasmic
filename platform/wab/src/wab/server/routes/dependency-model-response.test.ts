import { withDependencyModelResources } from "@/wab/server/routes/dependency-model-resources";
import type { Request, Response } from "express";
import { createHash } from "crypto";
const model = { version: "schema", map: {} };
function fixture() {
  const order: string[] = [];
  const find = vi.fn(async () => {
    expect(req.txMgr).toBeUndefined();
    order.push("resource");
    return [{ id: "resource", pkgVersionId: "release", digest: createHash("sha256").update(JSON.stringify(model)).digest("hex") }];
  });
  const req = { noTxMgr: { getRepository: () => ({ find }) }, con: { transaction: async (fn: Function) => { const value = await fn({}); order.push("commit"); return value; } } } as unknown as Request;
  const res = { json: vi.fn(() => { order.push("send"); return res; }), setHeader: vi.fn(), status: vi.fn(() => res), end: vi.fn(() => { order.push("end"); }) } as unknown as Response;
  return { req, res, find, order, next: vi.fn() };
}
it("commits the project read before materializing resource URLs and sending the response", async () => {
  const { req, res, order, next } = fixture();
  await withDependencyModelResources(async (request, response) => {
    expect(request.txMgr).toBeDefined();
    order.push("read");
    response.json({ depPkgs: [{ id: "release", pkgId: "pkg", model }] });
  })(req, res, next);
  expect(order).toEqual(["read", "commit", "resource", "send"]);
  expect(res.json).toHaveBeenCalledWith({ depPkgs: [{ id: "release", pkgId: "pkg", modelResourceId: "resource" }] });
  expect(next).not.toHaveBeenCalled();
});
it("restores response/error handling and creates no resources after a failed read", async () => {
  const { req, res, find, next } = fixture();
  const original = res.json, error = new Error("Permission denied");
  await withDependencyModelResources(async () => { throw error; })(req, res, next);
  expect(res.json).toBe(original);
  expect(next).toHaveBeenCalledWith(error);
  expect(find).not.toHaveBeenCalled();
  expect(res.json).not.toHaveBeenCalled();
});
it("preserves bodyless 304 responses without creating a model envelope", async () => {
  const { req, res, find, next, order } = fixture();
  const original = res.end;
  await withDependencyModelResources(async (_req, response) => {
    response.status(304).end();
    expect(original).not.toHaveBeenCalled();
  })(req, res, next);
  expect(res.end).toBe(original);
  expect(order).toEqual(["commit", "end"]);
  expect(res.end).toHaveBeenCalledOnce();
  expect(res.json).not.toHaveBeenCalled();
  expect(find).not.toHaveBeenCalled();
  expect(next).not.toHaveBeenCalled();
});
it("does not send a prepared 304 when committing the read transaction fails", async () => {
  const { req, res, find, next } = fixture();
  const original = res.end, error = new Error("Commit failed");
  vi.spyOn(req.con, "transaction").mockImplementationOnce(async (run: any) => {
    await run({});
    throw error;
  });
  await withDependencyModelResources(async (_req, response) => { response.status(304).end(); })(req, res, next);
  expect(res.end).toBe(original);
  expect(res.end).not.toHaveBeenCalled();
  expect(res.json).not.toHaveBeenCalled();
  expect(find).not.toHaveBeenCalled();
  expect(next).toHaveBeenCalledWith(error);
});
