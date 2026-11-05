import { getLocalAiModelCatalog } from "@/wab/server/copilot/local-ai-model-catalog";
import { GenericKeyValue } from "@/wab/server/entities/Entities";
import { ensure } from "@/wab/shared/common";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Connection, createConnection } from "typeorm";

const exec = promisify(execFile);
describe.skipIf(!process.env.AI_MODEL_CATALOG_TEST_DB)("model catalog persistence in real PostgreSQL", () => {
  let connection: Connection;
  beforeAll(async () => {
    const url = new URL(ensure(process.env.AI_MODEL_CATALOG_TEST_DB, "Test database required"));
    if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || url.pathname !== "/plasmic_catalog_test") {
      throw new Error("Catalog integration tests require the isolated local plasmic_catalog_test database");
    }
    connection = await createConnection({ type: "postgres", url: url.href, entities: [GenericKeyValue], synchronize: true });
  });
  afterAll(async () => { if (connection?.isConnected) { await connection.close(); } });
  afterEach(() => vi.unstubAllGlobals());

  it("loads the named catalog in new server processes and shares the failed-refresh cooldown", async () => {
    const config = { baseUrl: "https://catalog.integration.example/v1", apiKey: "integration-key" };
    const models = [{ id: "muse/muse", name: "Muse Agent" }, { id: "id-only" }];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: models }))));
    expect(await getLocalAiModelCatalog(config, true)).toEqual(models);
    const repository = connection.getRepository(GenericKeyValue);
    const row = ensure(await repository.findOne({ namespace: "copilot-cache" }), "Persisted catalog required");
    expect(JSON.stringify(row)).not.toContain(config.apiKey);
    row.value = JSON.stringify({ ...JSON.parse(row.value), refreshAfter: 0 });
    await repository.save(row);

    const script = `
      const { createConnection } = require('typeorm');
      const { GenericKeyValue } = require('./src/wab/server/entities/Entities.ts');
      const { getLocalAiModelCatalog } = require('./src/wab/server/copilot/local-ai-model-catalog.ts');
      (async () => {
        const connection = await createConnection({ type: 'postgres', url: process.env.AI_MODEL_CATALOG_TEST_DB, entities: [GenericKeyValue] });
        let requests = 0;
        global.fetch = async () => { requests++; throw new Error('Provider offline after deployment'); };
        const models = await getLocalAiModelCatalog(${JSON.stringify(config)}, true);
        let refreshed = false;
        for (let i = 0; i < 500; i++) {
          const row = await connection.getRepository(GenericKeyValue).findOne({ namespace: 'copilot-cache' });
          if (row && JSON.parse(row.value).refreshAfter > Date.now()) { refreshed = true; break; }
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        if (!refreshed) throw new Error('Persisted failure cooldown missing');
        console.log('CATALOG_RESULT ' + JSON.stringify({ models, requests }));
        await connection.close();
      })().catch(error => { console.error(error); process.exitCode = 1; });
    `;
    const runs = await Promise.all(Array.from({ length: 2 }, () => exec(process.execPath, ["-r", "esbuild-register", "-e", script], { cwd: process.cwd(), env: process.env, timeout: 20_000 })));
    const results = runs.map(run => JSON.parse(ensure(run.stdout.split("\n").find(line => line.startsWith("CATALOG_RESULT ")), "Child result required").slice("CATALOG_RESULT ".length)));
    expect(results.map(result => result.models)).toEqual([models, models]);
    expect(results.reduce((count, result) => count + result.requests, 0)).toBe(1);
    const records = await repository.find({ namespace: "copilot-cache", key: row.key });
    expect(records).toHaveLength(1);
    expect(JSON.parse(records[0].value).models).toEqual(models);
    await repository.delete(row.id);
  }, 30_000);
});
