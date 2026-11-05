import { getLocalAiModels } from "@/wab/server/copilot/local-edit";
import { ensure } from "@/wab/shared/common";
import type { LocalAiModel } from "@/wab/shared/copilot/local-edit";

const { config, persisted, warn, lock } = vi.hoisted(() => ({
  config: {
    baseUrl: "",
    apiKey: "catalog-key",
    model: "default",
    models: undefined as string[] | undefined,
  },
  persisted: new Map<string, string>(),
  warn: vi.fn(),
  lock: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/wab/server/secrets", () => ({ loadSecrets: () => ({ localAiEditing: config }) }));
vi.mock("@/wab/server/observability", () => ({ logger: () => ({ warn }) }));
vi.mock("@/wab/server/db/DbMgr", () => ({ DbMgr: class {}, SUPER_USER: {} }));
vi.mock("@/wab/server/simple-cache", () => ({
  DbMgrCache: class {
    async get(key: string) { return persisted.get(key); }
    async put(key: string, value: string) { persisted.set(key, value); }
  },
}));
vi.mock("typeorm", () => ({
  getConnection: () => ({ manager: {}, transaction: async (fn: (db: { query: typeof lock }) => unknown) => fn({ query: lock }) }),
}));
const fetchMock = vi.fn<typeof fetch>();
const options = (...ids: string[]): LocalAiModel[] => ids.map(id => ({ id }));
let sequence = 0;
function catalog(...models: LocalAiModel[]) {
  return new Response(JSON.stringify({ data: models }));
}
async function seedCatalog(...models: LocalAiModel[]) {
  fetchMock.mockResolvedValueOnce(catalog(...models));
  expect(await getLocalAiModels({ waitForCatalog: true })).toEqual([{ id: config.model }, ...models]);
}
beforeEach(() => {
  config.baseUrl = `https://catalog-${sequence++}.example/v1`;
  config.apiKey = "catalog-key";
  config.model = "default";
  config.models = undefined;
  persisted.clear();
  fetchMock.mockReset();
  warn.mockClear();
  lock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-05T00:00:00Z"));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it("persists IDs and names, preserving the default model's upstream name and deduplicating by ID", async () => {
  fetchMock.mockResolvedValue(catalog(
    { id: "default", name: "Default Name" },
    { id: "muse/muse", name: "Muse Agent" },
    { id: "muse/muse", name: "Muse Agent" },
    { id: "unnamed" },
  ));
  const models = await getLocalAiModels({ waitForCatalog: true });
  expect(models).toEqual([{ id: "default", name: "Default Name" }, { id: "muse/muse", name: "Muse Agent" }, { id: "unnamed" }]);
  models[0].name = "mutated";
  expect(await getLocalAiModels()).toEqual([{ id: "default", name: "Default Name" }, { id: "muse/muse", name: "Muse Agent" }, { id: "unnamed" }]);
  expect(fetchMock).toHaveBeenCalledOnce();
  expect(lock).toHaveBeenCalledWith(expect.stringContaining("pg_advisory_xact_lock"), [expect.stringMatching(/^local-ai-model-catalog:[a-f0-9]{64}$/)]);
  expect(JSON.stringify([...persisted])).not.toContain("catalog-key");
  expect(JSON.stringify([...persisted])).not.toContain(config.baseUrl);
});

it("shares pending cold discovery while status returns a fallback immediately", async () => {
  let complete: ((response: Response) => void) | undefined;
  fetchMock.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
  expect(await Promise.all(Array.from({ length: 32 }, () => getLocalAiModels())))
    .toEqual(Array.from({ length: 32 }, () => options("default")));
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
  const pending = getLocalAiModels({ waitForCatalog: true });
  let settled = false;
  void pending.then(() => { settled = true; });
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(settled).toBe(false);
  ensure(complete, "Discovery must be pending")(catalog({ id: "alternate", name: "Alternate" }));
  expect(await pending).toEqual([{ id: "default" }, { id: "alternate", name: "Alternate" }]);
  expect(fetchMock).toHaveBeenCalledOnce();
});

it("serves stale successful models immediately while refreshing in the background", async () => {
  await seedCatalog({ id: "old", name: "Old" });
  vi.setSystemTime(Date.now() + 5 * 60_000);
  let complete: ((response: Response) => void) | undefined;
  fetchMock.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
  expect(await getLocalAiModels({ waitForCatalog: true })).toEqual([{ id: "default" }, { id: "old", name: "Old" }]);
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  ensure(complete, "Refresh must be pending")(catalog({ id: "new", name: "New" }));
  await vi.waitFor(async () => { expect(await getLocalAiModels()).toEqual([{ id: "default" }, { id: "new", name: "New" }]); });
});

it.each(["network", "http", "json", "schema", "empty"])("keeps the successful catalog indefinitely after a %s failure and retries after cooldown", async failure => {
  await seedCatalog({ id: "old", name: "Old" });
  vi.setSystemTime(Date.now() + 90 * 24 * 60 * 60_000);
  if (failure === "network") {
    fetchMock.mockRejectedValueOnce(new Error("Do not log catalog-key"));
  } else {
    fetchMock.mockResolvedValueOnce(failure === "http" ? new Response("unavailable", { status: 503 })
      : failure === "json" ? new Response("invalid JSON")
      : failure === "schema" ? catalog({ id: "" }) : catalog());
  }
  fetchMock.mockResolvedValue(catalog({ id: "recovered" }));
  const old = [{ id: "default" }, { id: "old", name: "Old" }];
  expect(await getLocalAiModels()).toEqual(old);
  await vi.waitFor(() => expect(warn).toHaveBeenCalledOnce());
  await vi.waitFor(async () => { expect(await getLocalAiModels()).toEqual(old); });
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(warn.mock.calls)).not.toContain("catalog-key");
  vi.setSystemTime(Date.now() + 30_000);
  expect(await getLocalAiModels()).toEqual(old);
  await vi.waitFor(async () => { expect(await getLocalAiModels()).toEqual(options("default", "recovered")); });
  expect(fetchMock).toHaveBeenCalledTimes(3);
});

it("reloads the persisted named catalog after a process restart while upstream is offline", async () => {
  await seedCatalog({ id: "muse/muse", name: "Muse Agent" });
  vi.setSystemTime(Date.now() + 90 * 24 * 60 * 60_000);
  fetchMock.mockRejectedValue(new Error("Offline"));
  vi.resetModules();
  const restarted = await import("@/wab/server/copilot/local-ai-model-catalog");
  expect(await restarted.getLocalAiModelCatalog(config, true)).toEqual([{ id: "muse/muse", name: "Muse Agent" }]);
  await vi.waitFor(() => expect(warn).toHaveBeenCalledOnce());
  vi.resetModules();
  const restartedAgain = await import("@/wab/server/copilot/local-ai-model-catalog");
  expect(await restartedAgain.getLocalAiModelCatalog(config, true)).toEqual([{ id: "muse/muse", name: "Muse Agent" }]);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it("only falls back without a successful catalog and persists the failure cooldown, never the fallback", async () => {
  fetchMock.mockRejectedValue(new Error("Offline"));
  expect(await getLocalAiModels({ waitForCatalog: true })).toEqual(options("default"));
  expect(await getLocalAiModels({ waitForCatalog: true })).toEqual(options("default"));
  expect(fetchMock).toHaveBeenCalledOnce();
  expect([...persisted.values()].map(value => JSON.parse(value))).toEqual([{ refreshAfter: expect.any(Number) }]);
});

it.each(["baseUrl", "apiKey"] as const)("isolates persisted models when %s changes", async field => {
  await seedCatalog({ id: "old" });
  config[field] += "-changed";
  fetchMock.mockRejectedValue(new Error("Offline"));
  expect(await getLocalAiModels({ waitForCatalog: true })).toEqual(options("default"));
  expect(persisted.size).toBe(2);
});

it("uses explicit IDs without discovery and keeps provider labels when only the default changes", async () => {
  await seedCatalog({ id: "alternate", name: "Alternate" });
  config.model = "new-default";
  expect(await getLocalAiModels()).toEqual([{ id: "new-default" }, { id: "alternate", name: "Alternate" }]);
  config.models = ["configured", "configured"];
  expect(await getLocalAiModels()).toEqual(options("new-default", "configured"));
  expect(fetchMock).toHaveBeenCalledOnce();
});

it("retains a persisted catalog on request timeout", async () => {
  await seedCatalog({ id: "old", name: "Old" });
  vi.setSystemTime(Date.now() + 5 * 60_000);
  fetchMock.mockImplementation((_url, init) => new Promise((_resolve, reject) => {
    const signal = ensure(init?.signal, "Discovery requires a deadline");
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  }));
  expect(await getLocalAiModels()).toEqual([{ id: "default" }, { id: "old", name: "Old" }]);
  await vi.waitFor(() => expect(warn).toHaveBeenCalledWith("AI model catalog refresh failed", { stage: "request", status: undefined, timeout: true }), { timeout: 5_000 });
  expect(await getLocalAiModels()).toEqual([{ id: "default" }, { id: "old", name: "Old" }]);
});
