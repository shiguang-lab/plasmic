import { dependencyModelResources, getDependencyModelResource } from "@/wab/server/routes/dependency-model-resources";
import { createHash } from "crypto";
import type { Request, Response } from "express";
import { mock } from "vitest-mock-extended";
const db = vi.hoisted(() => ({ rows: new Map<string, any>(), permission: vi.fn(), find: vi.fn(), findOne: vi.fn() }));
const repository = {
  find: db.find, findOne: db.findOne,
  createQueryBuilder() {
    let row: any;
    const query = { insert: () => query, values: (value: any) => { row = value; return query; }, orIgnore: () => query,
      execute: async () => { if (![...db.rows.values()].some(value => value.pkgVersionId === row.pkgVersionId && value.digest === row.digest)) { db.rows.set(row.id, row); } } };
    return query;
  },
};
vi.mock("@/wab/server/routes/util", () => ({ userDbMgr: () => ({ getPkgById: db.permission, getEntMgr: () => ({ getRepository: () => repository }) }) }));
const request = () => ({ noTxMgr: { getRepository: () => repository } } as unknown as Request);
const model = { version: "schema", map: { root: { name: "Button" } } };
beforeEach(() => {
  db.rows.clear(); vi.clearAllMocks();
  db.permission.mockResolvedValue({});
  db.find.mockImplementation(async ({ where }) => [...db.rows.values()].filter(value => where.some((test: any) => test.pkgVersionId === value.pkgVersionId && test.digest === value.digest)));
  db.findOne.mockImplementation(async key => typeof key === "string" ? db.rows.get(key) : [...db.rows.values()].find(value => Object.entries(key).every(([k,v]) => value[k] === v)));
});
it("returns project metadata plus resource IDs, without reading a client inventory", async () => {
  const pkg = { id: "release", pkgId: "pkg", version: "1.0.0", model: JSON.stringify(model), toJSON() { return { id: this.id, pkgId: this.pkgId, version: this.version, model }; } };
  const payload = { rev: { revision: 1 }, depPkgs: [pkg] };
  const result = await dependencyModelResources(request(), payload);
  expect(result.rev).toBe(payload.rev);
  expect(result.depPkgs?.[0]).toEqual({ id: "release", pkgId: "pkg", version: "1.0.0", modelResourceId: expect.any(String) });
  expect(pkg.model).toBe(JSON.stringify(model));
  expect(db.rows.size).toBe(1);
  expect((await dependencyModelResources(request(), payload)).depPkgs).toEqual(result.depPkgs);
  expect(db.rows.size).toBe(1);
});
it("migration changes produce a different resource while old resource bytes remain immutable", async () => {
  const old = await dependencyModelResources(request(), { pkg: { id: "release", pkgId: "pkg", model } });
  const current = await dependencyModelResources(request(), { pkg: { id: "release", pkgId: "pkg", model: { ...model, version: "schema-2" } } });
  const oldId = (old.pkg as any).modelResourceId;
  expect((current.pkg as any).modelResourceId).not.toBe(oldId);
  const res = mock<Response>();
  await getDependencyModelResource({ params: { resourceId: oldId } } as any, res);
  expect(db.permission).toHaveBeenCalledWith("pkg");
  expect(res.send).toHaveBeenCalledWith(JSON.stringify(model));
  expect(res.setHeader).toHaveBeenCalledWith("X-Plasmic-Model-Resource", JSON.stringify({ id: oldId, digest: createHash("sha256").update(JSON.stringify(model)).digest("hex") }));
});
it("does not share resource identities across differently authorized packages", async () => {
  const body = await dependencyModelResources(request(), { depPkgs: [{ id: "a", pkgId: "public", model }, { id: "b", pkgId: "private", model }] });
  expect((body.depPkgs?.[0] as any).modelResourceId).not.toBe((body.depPkgs?.[1] as any).modelResourceId);
});
it("refuses revoked package access before reading/sending resource bytes", async () => {
  db.rows.set("resource", { id: "resource", pkgId: "private", model: JSON.stringify(model) });
  db.permission.mockRejectedValue(new Error("Access denied"));
  const res = mock<Response>();
  await expect(getDependencyModelResource({ params: { resourceId: "resource" } } as any, res)).rejects.toThrow("Access denied");
  expect(db.findOne).toHaveBeenCalledTimes(1);
  expect(res.send).not.toHaveBeenCalled();
});
it("rejects missing resources and leaves metadata-only envelopes untouched", async () => {
  const payload = { pkg: { id: "meta" }, data: null };
  expect(await dependencyModelResources(request(), payload)).toBe(payload);
  expect(db.find).not.toHaveBeenCalled();
  await expect(getDependencyModelResource({ params: { resourceId: "missing" } } as any, mock<Response>())).rejects.toThrow("Dependency model resource not found");
});
