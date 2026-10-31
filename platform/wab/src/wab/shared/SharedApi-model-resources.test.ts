import { SharedApi } from "@/wab/shared/SharedApi";
import { toOpaque } from "@/wab/commons/types";
const model = { version: "schema", map: {} };
class TestApi extends SharedApi {
  calls: { method: string; url: string; data: unknown }[] = [];
  protected setUser() { return undefined; }
  protected clearUser() { return undefined; }
  protected async req(method: any, url: string, data?: unknown) {
    this.calls.push({ method, url, data });
    if (url.startsWith("/dependency-models/")) { return model; }
    return { ...(url.startsWith("/projects/") && data && (data as any).includeStartup ? { startup: { projectId: "project" } } : {}), rev: { revision: 7 }, depPkgs: [{ id: "pkg-version", modelResourceId: "resource-id" }] };
  }
}
it("loads exactly referenced model resources through GET, without POST, inventory", async () => {
  const api = new TestApi();
  const value = await api.getSiteInfo("project");
  expect(value.depPkgs[0].model).toEqual(model);
  expect(value.depPkgs[0]).not.toHaveProperty("modelResourceId");
  expect(api.calls).toEqual([{ method: "get", url: "/projects/project", data: {} }, { method: "get", url: "/dependency-models/resource-id", data: undefined }]);
});
it("all model readers hydrate resources and preserve original request methods", async () => {
  const api = new TestApi();
  await api.getPkgVersion("pkg", "1.0.0");
  await api.getPkgVersionByProjectId("project", "1.0.0");
  await api.getProjectRevision(toOpaque("project"), "revision");
  await api.getModelUpdates("project", 7, ["existing"], undefined);
  await api.getPlumePkg();
  expect(api.calls).toHaveLength(10);
  expect(api.calls.every(value => value.method === "get")).toBe(true);
  expect(api.calls.filter(value => value.url === "/dependency-models/resource-id")).toHaveLength(5);
});

it("opens with one project GET and defers resource hydration so editor startup can proceed", async () => {
  const api = new TestApi();
  const opening = await api.getProjectStartup("project", "feature");
  expect(opening.startup).toEqual({ projectId: "project" });
  expect(opening.depPkgs[0].modelResourceId).toBe("resource-id");
  expect(api.calls).toEqual([{ method: "get", url: "/projects/project", data: { includeStartup: true, branchName: "feature" } }]);
  const modelResponse = await api.resolveProjectModel(opening);
  expect(modelResponse).not.toHaveProperty("startup");
  expect(modelResponse.depPkgs[0].model).toEqual(model);
  expect(api.calls).toHaveLength(2);
  expect(api.calls[1].url).toBe("/dependency-models/resource-id");
});
