import { createHash } from "crypto";
import { expect, it, vi } from "vitest";
import { sendWithDependencyModels } from "@/wab/server/routes/dependency-model-cache";

const model = { version: "schema-1", map: { root: { name: "Button" } } };
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
function send(digests: string[] | undefined, payload: any) {
  const res = { json: vi.fn(), setHeader: vi.fn(), vary: vi.fn() };
  sendWithDependencyModels({ get: () => digests ? "1" : undefined, method: digests ? "POST" : "GET", body: { modelDigests: digests } } as any, res as any, payload);
  return { body: res.json.mock.calls[0][0], res };
}

it("keeps the ordinary API contract and never stores mutable project metadata", () => {
  const payload = { rev: { data: "business-project", revision: 10 }, perms: ["viewer"], depPkgs: [{ id: "library-v1", model }] };
  expect(send(undefined, payload).body).toBe(payload);
  const { body, res } = send([], payload);
  expect(body.rev).toBe(payload.rev);
  expect(body.perms).toBe(payload.perms);
  expect(body.depPkgs[0].model).toEqual(model);
  expect(body.modelSnapshots).toEqual({ "library-v1": hash(model) });
  expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "private, no-store");
});

it("omits only exact known model contents, retains release metadata and order, without mutating entities", () => {
  const a = { id: "a", pkgId: "pkg", version: "1.0.0", model: JSON.stringify(model), toJSON() { return { ...this, model }; } };
  const b = { id: "b", version: "2.0.0", model: { ...model, version: "schema-2" } };
  const { body } = send([hash(model)], { pkg: a, depPkgs: [a, b] });
  expect(body.pkg).not.toHaveProperty("model");
  expect(body.pkg.version).toBe("1.0.0");
  expect(body.depPkgs.map((pkg: any) => pkg.id)).toEqual(["a", "b"]);
  expect(body.depPkgs[1].model).toEqual(b.model);
  expect(a.model).toBe(JSON.stringify(model));
});

it("uses actual migrated content rather than semver as model identity", () => {
  const original = { id: "release", version: "1.0.0", model };
  const migrated = { ...original, model: { ...model, version: "schema-2" } };
  const { body } = send([hash(model)], { depPkgs: [migrated] });
  expect(body.depPkgs[0].model).toEqual(migrated.model);
  expect(body.modelSnapshots.release).not.toBe(hash(model));
  expect(send([], { pkg: { id: "meta-only", version: "1.0.0" } }).body.modelSnapshots).toEqual({});
});

it("honors every cached digest beyond 64 model definitions", () => {
  const deps = Array.from({ length: 160 }, (_, i) => ({ id: String(i), model: { ...model, library: i } }));
  const { body } = send(deps.map(dep => hash(dep.model)), { depPkgs: deps });
  expect(body.depPkgs.filter((pkg: any) => pkg.model !== undefined)).toHaveLength(0);
});

it("rejects malformed negotiated bodies and keeps GET responses complete", () => {
  const res = { json: vi.fn(), setHeader: vi.fn(), vary: vi.fn() };
  const payload = { depPkgs: [{ id: "release", model }] };
  sendWithDependencyModels({ get: () => "1", method: "GET" } as any, res as any, payload);
  expect(res.json).toHaveBeenCalledWith(payload);
  for (const digests of [undefined, "invalid", [null], ["invalid"]]) {
    expect(() => sendWithDependencyModels({ get: () => "1", method: "POST", body: { modelDigests: digests } } as any, res as any, payload)).toThrow("Invalid dependency model cache digests");
  }
});
