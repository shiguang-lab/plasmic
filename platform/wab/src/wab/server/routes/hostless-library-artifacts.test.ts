import { expect, it, vi } from "vitest";
import express from "express";
import { get } from "node:http";
const state = vi.hoisted(() => ({ perms: vi.fn(), versions: vi.fn(async (_id: string, version?: string) => ({ id: version ?? "latest", version: version ?? "2.0.0" })), missing: false }));
vi.mock("@/wab/server/entities/CustomEntities", () => ({ HostlessLibraryVersion: class {} }));
vi.mock("@/wab/shared/devflags", () => ({ DEVFLAGS: { hostLessComponents: [{ codeName: "new-library", projectId: ["library-project"], hasCodeArtifacts: true }] } }));
vi.mock("@/wab/server/routes/util", () => ({ userDbMgr: () => ({
  tryGetDevFlagOverrides: async () => undefined, checkProjectPerms: state.perms,
  getPkgByProjectId: async () => ({ id: "library-package" }), getPkgVersion: state.versions,
  getEntMgr: () => ({ findOne: async (_entity: any, where: any) => state.missing ? undefined : { artifact: { digest: `digest-${where.pkgVersionId}`, canvas: `registration-${where.pkgVersionId}`, server: "private server code" } } }),
}) }));
import { getHostlessLibraryCanvas } from "@/wab/server/routes/hostless-library-artifacts";
import { getHostlessLibraryRelease } from "@/wab/server/routes/hostless-library-artifacts";
import { createHash } from "crypto";

it("serves only the requested version's browser registration after checking access", async () => {
  state.perms.mockReset(); state.versions.mockClear(); state.missing = false;
  const res = { setHeader: vi.fn(), send: vi.fn() };
  await getHostlessLibraryCanvas({ params: { name: "new-library" }, query: { version: "1.2.3" } } as any, res as any);
  expect(state.perms).toHaveBeenCalledWith("library-project", "viewer", "read component library code");
  expect(state.versions).toHaveBeenCalledWith("library-package", "1.2.3");
  expect(res.send).toHaveBeenCalledWith("registration-1.2.3");
  expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "private, no-cache");
  expect(res.setHeader).toHaveBeenCalledWith("ETag", '"digest-1.2.3"');
  expect(res.setHeader).toHaveBeenCalledWith("X-Plasmic-Library-Release", JSON.stringify({
    pkgId: "library-package", version: "1.2.3",
    digest: createHash("sha256").update("registration-1.2.3").digest("hex"),
  }));
  state.perms.mockRejectedValueOnce(new Error("Forbidden"));
  await expect(getHostlessLibraryCanvas({ params: { name: "new-library" }, query: {} } as any, res as any)).rejects.toThrow("Forbidden");
});

it("rejects another package's same-name version and resolves authoring latest to a concrete release", async () => {
  state.perms.mockReset(); state.versions.mockClear(); state.missing = false;
  await expect(getHostlessLibraryCanvas({ params: { name: "new-library" }, query: { pkgId: "other-package", version: "1.0.0" } } as any, {} as any)).rejects.toThrow("does not match");
  expect(state.versions).not.toHaveBeenCalled();
  await expect(getHostlessLibraryCanvas({ params: { name: "new-library" }, query: { version: "latest" } } as any, {} as any)).rejects.toThrow("exact");
  const res = { setHeader: vi.fn(), json: vi.fn() };
  await getHostlessLibraryRelease({ params: { name: "new-library" }, query: {} } as any, res as any);
  expect(res.json).toHaveBeenCalledWith({ pkgId: "library-package", version: "2.0.0" });
  expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "private, no-store");
});

it("revalidates permissions before returning a cached artifact and rejects revoked access", async () => {
  state.perms.mockReset(); state.versions.mockClear(); state.missing = false;
  const app = express();
  app.get("/libraries/:name", (req, res, next) => getHostlessLibraryCanvas(req, res).catch(next));
  app.use((_error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => res.status(403).send("Forbidden"));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") { throw new Error("Missing test server address"); }
  const url = `http://127.0.0.1:${address.port}/libraries/new-library?version=1.2.3`;
  try {
    const first = await fetch(url);
    expect(first.status).toBe(200);
    expect(await first.text()).toBe("registration-1.2.3");
    const etag = first.headers.get("etag");
    if (!etag) { throw new Error("Missing artifact ETag"); }
    // Node fetch adds Cache-Control: no-cache to manual conditional requests.
    // Use an ordinary HTTP conditional GET, as browser cache revalidation does.
    const cached = await new Promise<{ status: number | undefined; body: string }>((resolve, reject) => {
      get(url, { headers: { "If-None-Match": etag } }, (response) => {
        let body = "";
        response.on("data", (chunk) => { body += chunk; });
        response.on("end", () => resolve({ status: response.statusCode, body }));
      }).on("error", reject);
    });
    expect(cached.status).toBe(304);
    expect(cached.body).toBe("");
    expect(state.perms).toHaveBeenCalledTimes(2);
    state.perms.mockRejectedValueOnce(new Error("Forbidden"));
    const revoked = await fetch(url, { headers: { "If-None-Match": etag } });
    expect(revoked.status).toBe(403);
    expect(await revoked.text()).toBe("Forbidden");
    expect(state.versions).toHaveBeenCalledTimes(2);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

it("does not substitute a missing version with the latest registration", async () => {
  state.missing = true;
  await expect(getHostlessLibraryCanvas({ params: { name: "new-library" }, query: { version: "0.1.0" } } as any, {} as any)).rejects.toThrow("no code artifact");
  state.missing = false;
});
