import { dependencyModelResources, getDependencyModelResource } from "@/wab/server/routes/dependency-model-resources";
import { PkgVersion } from "@/wab/server/entities/Entities";
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
it("reuses exact entity bytes without parsing a materialized model and preserves metadata", async () => {
  const pkg = Object.assign(new PkgVersion(), { id: "release", pkgId: "pkg", version: "1.0.0", createdAt: new Date("2026-01-01T00:00:00Z"), model: JSON.stringify(model) });
  const { model: _model, ...meta } = pkg.toJSON();
  const first = await dependencyModelResources(request(), { pkg });
  const parse = vi.spyOn(JSON, "parse");
  const current = await dependencyModelResources(request(), { pkg });
  expect(parse.mock.calls.filter(([text]) => text === pkg.model)).toHaveLength(0);
  expect(current.pkg).toEqual({ ...meta, modelResourceId: (first.pkg as any).modelResourceId });
  expect(db.find).toHaveBeenCalledTimes(2);
  expect(pkg.model).toBe(JSON.stringify(model));
});
it("retains canonical identity for legacy whitespace, escaped strings and number formatting", async () => {
  const raw = '{ "version":"schema", "map":{"root":{"name":"\\u0042utton", "number":1.00}} }';
  const canonical = JSON.stringify(JSON.parse(raw));
  const first = await dependencyModelResources(request(), { pkg: { id: "release", pkgId: "pkg", model: JSON.parse(raw) } });
  const pkg = Object.assign(new PkgVersion(), { id: "release", pkgId: "pkg", model: raw });
  const current = await dependencyModelResources(request(), { pkg });
  expect((current.pkg as any).modelResourceId).toBe((first.pkg as any).modelResourceId);
  expect(db.rows.size).toBe(1);
  expect([...db.rows.values()][0].model).toBe(canonical);
  expect(pkg.model).toBe(raw);
});
it("canonicalizes a new entity and creates a new resource after its migrated bytes change", async () => {
  const pkg = Object.assign(new PkgVersion(), { id: "release", pkgId: "pkg", model: JSON.stringify(model, null, 2) });
  const first = await dependencyModelResources(request(), { pkg });
  expect([...db.rows.values()][0].model).toBe(JSON.stringify(model));
  pkg.model = JSON.stringify({ ...model, version: "schema-2" });
  const changed = await dependencyModelResources(request(), { pkg });
  expect((changed.pkg as any).modelResourceId).not.toBe((first.pkg as any).modelResourceId);
  expect(db.rows.size).toBe(2);
});
