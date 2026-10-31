import { Api, filteredApi } from "@/wab/client/api";
import { NetworkError } from "@/wab/shared/ApiErrors/ApiError";
import { ForbiddenError } from "@/wab/shared/ApiErrors/errors";
const calls = vi.hoisted(() => ({ fetch: vi.fn(), clear: vi.fn(), ajax: vi.fn() }));
vi.mock("@/wab/client/resource-cache", () => ({ fetchLibraryResource: calls.fetch, clearResourceCache: calls.clear, setResourceCacheUser: vi.fn() }));
vi.mock("@/wab/client/cli-routes", () => ({ ensureIsTopFrame: vi.fn(), isHostFrame: () => false }));
vi.mock("@/wab/client/observability", () => ({ analytics: () => ({ setAnonymousUser: vi.fn(), setUser: vi.fn() }) }));
vi.mock("jquery", () => ({ default: { ajax: calls.ajax } }));
beforeEach(() => vi.resetAllMocks());
it("loads model JSON through the unified resource cache without invoking jQuery", async () => {
  const model = { version: "schema", map: {} };
  calls.fetch.mockResolvedValue(new Response(JSON.stringify(model)));
  expect(await new Api().get("/dependency-models/resource")).toEqual(model);
  expect(calls.fetch).toHaveBeenCalledWith("/api/v1/dependency-models/resource", expect.any(Object));
  expect(calls.ajax).not.toHaveBeenCalled();
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
  calls.fetch.mockResolvedValue(new Response("window.registration = true"));
  const release = { pkgId: "library", version: "1.2.3" };
  expect(await allowed.getHostlessLibraryCanvas("antd6", release)).toBe("window.registration = true");
  expect(calls.fetch).toHaveBeenCalledWith("/api/v1/hostless-libraries/antd6/canvas?version=1.2.3&pkgId=library");
  expect(calls.ajax).not.toHaveBeenCalled();
  calls.fetch.mockResolvedValue(new Response("missing", {status:404}));
  await expect(allowed.getHostlessLibraryCanvas("antd6", release)).rejects.toThrow("antd6@1.2.3: 404");
});
