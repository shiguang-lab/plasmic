import { getLocalAiModels } from "@/wab/server/copilot/local-edit";
import { ensure } from "@/wab/shared/common";

const { config, warn } = vi.hoisted(() => ({
  config: {
    baseUrl: "",
    apiKey: "catalog-key",
    model: "default",
    models: undefined as string[] | undefined,
  },
  warn: vi.fn(),
}));
vi.mock("@/wab/server/secrets", () => ({
  loadSecrets: () => ({ localAiEditing: config }),
}));
vi.mock("@/wab/server/observability", () => ({
  logger: () => ({ warn }),
}));

const fetchMock = vi.fn<typeof fetch>();
let sequence = 0;

function catalog(...models: string[]) {
  return new Response(JSON.stringify({ data: models.map((id) => ({ id })) }));
}

async function seedCatalog(...models: string[]) {
  fetchMock.mockResolvedValueOnce(catalog(...models));
  await getLocalAiModels();
  await vi.waitFor(async () => {
    expect(await getLocalAiModels()).toEqual([config.model, ...models]);
  });
}

beforeEach(() => {
  config.baseUrl = `https://catalog-${sequence++}.example/v1`;
  config.apiKey = "catalog-key";
  config.model = "default";
  config.models = undefined;
  fetchMock.mockReset();
  warn.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  // Keep real abort deadlines; only move the cache clock.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-03T00:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("shares one cold refresh across concurrent projects and protects cached arrays", async () => {
  let complete: ((response: Response) => void) | undefined;
  fetchMock.mockImplementation(() => new Promise((resolve) => { complete = resolve; }));
  const pending = Array.from({ length: 32 }, () => getLocalAiModels());
  expect(fetchMock).toHaveBeenCalledOnce();
  const results = await Promise.all(pending);
  expect(results).toEqual(Array.from({ length: 32 }, () => ["default"]));
  ensure(complete, "Cold refresh must be pending")(catalog("alternate", "alternate"));
  await vi.waitFor(async () => {
    expect(await getLocalAiModels()).toEqual(["default", "alternate"]);
  });
  const cached = await getLocalAiModels();
  cached.push("mutated");
  expect(await getLocalAiModels()).toEqual(["default", "alternate"]);
  expect(fetchMock).toHaveBeenCalledOnce();
});

it("returns stale models immediately while sharing one background refresh", async () => {
  await seedCatalog("old");
  vi.setSystemTime(Date.now() + 5 * 60_000);
  let complete: ((response: Response) => void) | undefined;
  fetchMock.mockImplementation(() => new Promise((resolve) => { complete = resolve; }));
  expect(await Promise.all(Array.from({ length: 32 }, () => getLocalAiModels())))
    .toEqual(Array.from({ length: 32 }, () => ["default", "old"]));
  expect(fetchMock).toHaveBeenCalledTimes(2);
  ensure(complete, "Background refresh must be pending")(catalog("new"));
  await vi.waitFor(async () => {
    expect(await getLocalAiModels()).toEqual(["default", "new"]);
  });
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it.each(["network", "http", "json", "schema"])(
  "cools down %s failures and recovers after 30 seconds",
  async (failure) => {
    const response = failure === "http"
      ? new Response("Provider unavailable", { status: 503 })
      : failure === "json"
        ? new Response("invalid JSON")
        : new Response(JSON.stringify({ data: [{ id: "" }] }));
    if (failure === "network") {
      fetchMock.mockRejectedValueOnce(new Error("Do not log catalog-key"));
    } else {
      fetchMock.mockResolvedValueOnce(response);
    }
    fetchMock.mockResolvedValue(catalog("recovered"));
    const started = Date.now();
    expect(await getLocalAiModels()).toEqual(["default"]);
    await vi.waitFor(() => expect(warn).toHaveBeenCalledOnce());
    expect(await getLocalAiModels()).toEqual(["default"]);
    vi.setSystemTime(started + 29_999);
    expect(await getLocalAiModels()).toEqual(["default"]);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledOnce();
    expect(JSON.stringify(warn.mock.calls)).not.toContain("catalog-key");
    vi.setSystemTime(started + 30_000);
    expect(await getLocalAiModels()).toEqual(["default"]);
    await vi.waitFor(async () => {
      expect(await getLocalAiModels()).toEqual(["default", "recovered"]);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  },
);

it("retains old models on refresh failure without extending their one-hour maximum age", async () => {
  await seedCatalog("old");
  vi.setSystemTime(Date.now() + 5 * 60_000);
  fetchMock.mockRejectedValue(new Error("Offline"));
  expect(await getLocalAiModels()).toEqual(["default", "old"]);
  await vi.waitFor(() => expect(warn).toHaveBeenCalledOnce());
  expect(await getLocalAiModels()).toEqual(["default", "old"]);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  vi.setSystemTime(Date.now() + 55 * 60_000);
  expect(await getLocalAiModels()).toEqual(["default"]);
  await vi.waitFor(() => expect(warn).toHaveBeenCalledTimes(2));
  expect(fetchMock).toHaveBeenCalledTimes(3);
  fetchMock.mockResolvedValue(catalog("recovered"));
  vi.setSystemTime(Date.now() + 30_000);
  expect(await getLocalAiModels()).toEqual(["default"]);
  await vi.waitFor(async () => {
    expect(await getLocalAiModels()).toEqual(["default", "recovered"]);
  });
});

it.each(["baseUrl", "apiKey", "model"] as const)(
  "invalidates cached models when %s changes",
  async (field) => {
    await seedCatalog("old");
    config[field] += "-changed";
    fetchMock.mockResolvedValue(catalog("new"));
    expect(await getLocalAiModels()).toEqual([config.model]);
    await vi.waitFor(async () => {
      expect(await getLocalAiModels()).toEqual([config.model, "new"]);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  },
);

it("does not let a late old-credential response overwrite a new cache", async () => {
  let complete: ((response: Response) => void) | undefined;
  fetchMock.mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }));
  expect(await getLocalAiModels()).toEqual(["default"]);
  config.apiKey = "new-key";
  fetchMock.mockResolvedValue(catalog("new"));
  expect(await getLocalAiModels()).toEqual(["default"]);
  await vi.waitFor(async () => {
    expect(await getLocalAiModels()).toEqual(["default", "new"]);
  });
  ensure(complete, "Old credential refresh must be pending")(catalog("old"));
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(await getLocalAiModels()).toEqual(["default", "new"]);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it("uses explicit models immediately and rediscovers after discovery is re-enabled", async () => {
  await seedCatalog("old");
  config.models = ["configured", "configured"];
  expect(await getLocalAiModels()).toEqual(["default", "configured"]);
  expect(fetchMock).toHaveBeenCalledOnce();
  config.models = undefined;
  fetchMock.mockResolvedValue(catalog("new"));
  expect(await getLocalAiModels()).toEqual(["default"]);
  await vi.waitFor(async () => {
    expect(await getLocalAiModels()).toEqual(["default", "new"]);
  });
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it("returns immediately on a cold cache while a hung background request times out", async () => {
  fetchMock.mockImplementation((_url, options) => new Promise((_resolve, reject) => {
    const signal = ensure(options?.signal, "Background request must have a deadline");
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  }));
  const started = performance.now();
  expect(await getLocalAiModels()).toEqual(["default"]);
  const catalogRequest = getLocalAiModels({ waitForCatalog: true });
  expect(performance.now() - started).toBeLessThan(500);
  expect(await getLocalAiModels()).toEqual(["default"]);
  expect(fetchMock).toHaveBeenCalledOnce();
  await vi.waitFor(() => {
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(warn).toHaveBeenCalledOnce();
  }, { timeout: 5_000 });
  expect(await catalogRequest).toEqual(["default"]);
  expect(warn).toHaveBeenCalledWith("AI model catalog refresh failed", {
    stage: "request", status: undefined, timeout: true,
  });
  expect(await getLocalAiModels()).toEqual(["default"]);
  expect(fetchMock).toHaveBeenCalledOnce();
});

it("waits for one shared cold refresh for catalog requests while status stays immediate", async () => {
  let complete: ((response: Response) => void) | undefined;
  fetchMock.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
  expect(await getLocalAiModels()).toEqual(["default"]);
  const pending = Array.from({ length: 32 }, () => getLocalAiModels({ waitForCatalog: true }));
  let settled = false;
  void Promise.all(pending).then(() => { settled = true; });
  await Promise.resolve();
  expect(settled).toBe(false);
  expect(await getLocalAiModels()).toEqual(["default"]);
  ensure(complete, "Cold refresh must be pending")(catalog("alternate"));
  expect(await Promise.all(pending)).toEqual(Array.from({ length: 32 }, () => ["default", "alternate"]));
  expect(fetchMock).toHaveBeenCalledOnce();
  // A stale but usable catalog must never wait for its background refresh.
  vi.setSystemTime(Date.now() + 5 * 60_000);
  expect(await getLocalAiModels({ waitForCatalog: true })).toEqual(["default", "alternate"]);
});

it("finishes cold catalog requests on discovery failure and uses the cooldown", async () => {
  fetchMock.mockRejectedValue(new Error("Offline"));
  expect(await getLocalAiModels({ waitForCatalog: true })).toEqual(["default"]);
  expect(await getLocalAiModels({ waitForCatalog: true })).toEqual(["default"]);
  expect(fetchMock).toHaveBeenCalledOnce();
});
