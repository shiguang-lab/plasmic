import type { ProjectOpeningResponse } from "@/wab/shared/ApiSchema";
import { Api, filteredApi } from "@/wab/client/api";
import { NetworkError } from "@/wab/shared/ApiErrors/ApiError";
import { ForbiddenError } from "@/wab/shared/ApiErrors/errors";
const calls = vi.hoisted(() => ({ fetch: vi.fn(), clear: vi.fn(), ajax: vi.fn() }));
vi.mock("@/wab/client/resource-cache", () => ({ fetchLibraryResource: calls.fetch, clearResourceCache: calls.clear, setResourceCacheUser: vi.fn() }));
vi.mock("@/wab/client/cli-routes", () => ({ ensureIsTopFrame: vi.fn(), isHostFrame: () => false }));
vi.mock("@/wab/client/observability", () => ({ analytics: () => ({ setAnonymousUser: vi.fn(), setUser: vi.fn() }) }));
vi.mock("jquery", () => ({ default: { ajax: calls.ajax } }));
beforeEach(() => vi.resetAllMocks());
afterEach(() => window.history.replaceState(null, "", "/"));
it("project reads carry presentation access while writes and editor routes do not", async () => {
  const transport = { done(callback: Function) { callback({}); return transport; }, fail: vi.fn() };
  calls.ajax.mockReturnValue(transport);
  window.history.replaceState(null, "", "/d/0123456789?branch=design#/details/42");
  const api = new Api();
  await api.get("/projects/project");
  expect(calls.ajax.mock.lastCall?.[0].headers).toEqual({
    "x-plasmic-presentation-code": "0123456789",
    "x-plasmic-presentation-branch": "design",
  });
  await api.post("/projects/project", {});
  expect(calls.ajax.mock.lastCall?.[0].headers).toEqual({});
  window.history.replaceState(null, "", "/projects/project");
  await api.get("/projects/project");
  expect(calls.ajax.mock.lastCall?.[0].headers).toEqual({});
});
it("loads model JSON through the unified resource cache without invoking jQuery", async () => {
  const model = { version: "schema", map: {} };
  calls.fetch.mockResolvedValue(new Response(JSON.stringify(model)));
  expect(await new Api().get("/dependency-models/resource")).toEqual(model);
  expect(calls.fetch).toHaveBeenCalledWith("/api/v1/dependency-models/resource", expect.any(Object));
  expect(calls.ajax).not.toHaveBeenCalled();
});
it("prefetches shared startup dependencies as bytes through the resource cache", async () => {
  const response = new Response(JSON.stringify({ name: "按钮" }));
  const parse = vi.spyOn(response, "json");
  calls.fetch.mockResolvedValue(response);
  const opening = {
    startup: {},
    depPkgs: [
      { id: "first", modelResourceId: "resource" },
      { id: "second", modelResourceId: "resource" },
    ],
  } as ProjectOpeningResponse;
  const api = new Api();
  api.expectFailure = true;
  const { source } = await api.prepareProjectModel(opening);

  expect(calls.fetch).toHaveBeenCalledExactlyOnceWith(
    "/api/v1/dependency-models/resource",
    { headers: { "x-expect-failure": "true" } },
  );
  expect(parse).not.toHaveBeenCalled();
  expect(calls.ajax).not.toHaveBeenCalled();
  expect(source.project).not.toHaveProperty("startup");
  expect(source.dependencies.map(({ info }) => info)).toEqual([
    { id: "first" },
    { id: "second" },
  ]);
  expect(source.dependencies[0].bytes).toBe(source.dependencies[1].bytes);
  expect(new TextDecoder().decode(source.dependencies[0].bytes)).toBe(
    '{"name":"按钮"}',
  );
});
it("preserves business HTTP error identity and request details for failed resource GETs", async () => {
  calls.fetch.mockResolvedValue(new Response(JSON.stringify({ error: {name:"ForbiddenError",message:"Revoked"} }), {status:403}));
  const error = await new Api().get("/dependency-models/resource").catch(e => e);
  expect(error).toBeInstanceOf(ForbiddenError);
  expect(error.statusCode).toBe(403);
  expect(error.request).toEqual({method:"GET",url:"/api/v1/dependency-models/resource"});
  expect(calls.fetch).toHaveBeenCalledOnce();
});
it("retains network failure classification for resource GETs", async () => {
  calls.fetch.mockRejectedValue(new TypeError("Failed to fetch"));
  await expect(new Api().get("/dependency-models/resource")).rejects.toBeInstanceOf(NetworkError);
});
it("ordinary project reads keep the existing API transport", async () => {
  const transport = { done(callback: Function) { callback({rev:{revision:4},depPkgs:[]}); return transport; }, fail: vi.fn() };
  calls.ajax.mockReturnValue(transport);
  expect(await new Api().getSiteInfo("project")).toMatchObject({rev:{revision:4}});
  expect(calls.ajax).toHaveBeenCalledOnce();
  expect(calls.fetch).not.toHaveBeenCalled();
});
it("sign-out waits for resource cleanup before completing", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response('{}')));
  const pending = Promise.withResolvers<void>();
  calls.clear.mockReturnValue(pending.promise);
  const finished = vi.fn();
  const logout = new Api().logout().then(finished);
  await vi.waitFor(() => expect(calls.clear).toHaveBeenCalledOnce());
  expect(finished).not.toHaveBeenCalled();
  pending.resolve(); await logout;
  expect(finished).toHaveBeenCalledOnce();
  vi.unstubAllGlobals();
});

it("exposes only named library downloads through the Studio API bridge and retains cache/status handling", async () => {
  const api = new Api();
  const allowed = filteredApi("project", api as any, {} as any);
  expect(() =>
    allowed.prepareProjectModel({} as ProjectOpeningResponse),
  ).toThrow("unauthorizedMethod prepareProjectModel");
  calls.fetch.mockResolvedValue(new Response("window.registration = true"));
  const release = { pkgId: "library", version: "1.2.3" };
  expect(await allowed.getHostlessLibraryCanvas("antd6", release)).toBe("window.registration = true");
  expect(calls.fetch).toHaveBeenCalledWith("/api/v1/hostless-libraries/antd6/canvas?version=1.2.3&pkgId=library");
  expect(calls.ajax).not.toHaveBeenCalled();
  calls.fetch.mockResolvedValue(new Response("missing", {status:404}));
  await expect(allowed.getHostlessLibraryCanvas("antd6", release)).rejects.toThrow("antd6@1.2.3: 404");
});
