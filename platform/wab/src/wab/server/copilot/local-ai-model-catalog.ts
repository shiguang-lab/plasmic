import { DbMgr, SUPER_USER } from "@/wab/server/db/DbMgr";
import { logger } from "@/wab/server/observability";
import { DbMgrCache } from "@/wab/server/simple-cache";
import { LocalAiModel, localAiModelSchema } from "@/wab/shared/copilot/local-edit";
import { createHash } from "node:crypto";
import { getConnection } from "typeorm";
import { z } from "zod";

const catalogSchema = z.object({
  models: z.array(localAiModelSchema).min(1).optional(),
  refreshAfter: z.number(),
});
const refreshing = new Map<string, Promise<void>>();

async function readCatalog(cache: DbMgrCache, key: string) {
  const value = await cache.get(key);
  return value ? catalogSchema.parse(JSON.parse(value)) : undefined;
}

async function refreshCatalog(
  key: string,
  config: { baseUrl: string; apiKey: string },
) {
  await getConnection().transaction(async (db) => {
    // Serialize refreshes across server/worker processes and rolling releases.
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [key]);
    const cache = new DbMgrCache(new DbMgr(db, SUPER_USER));
    const previous = await readCatalog(cache, key);
    if (previous && Date.now() < previous.refreshAfter) {
      return;
    }
    let models = previous?.models;
    let refreshAfter: number;
    let stage = "request";
    let status: number | undefined;
    const signal = AbortSignal.timeout(3_000);
    try {
      const response = await fetch(`${config.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${config.apiKey}` },
        redirect: "error",
        signal,
      });
      status = response.status;
      if (!response.ok) {
        stage = "http";
        await response.body?.cancel();
        throw new Error("Model catalog request failed");
      }
      stage = "response";
      const catalog = z.object({ data: z.array(localAiModelSchema).min(1) })
        .parse(await response.json());
      models = [...new Map(catalog.data.map(model => [model.id, model])).values()];
      refreshAfter = Date.now() + 5 * 60_000;
    } catch {
      refreshAfter = Date.now() + 30_000;
      // Keep the last successful catalog indefinitely. Never persist a fallback
      // or log credentials, the service URL, upstream bodies or raw errors.
      logger().warn("AI model catalog refresh failed", { stage, status, timeout: signal.aborted });
    }
    await cache.put(key, JSON.stringify({ models, refreshAfter }));
  });
}

/** PostgreSQL owns catalog data and retry deadlines; memory only tracks in-flight work. */
export async function getLocalAiModelCatalog(
  config: { baseUrl: string; apiKey: string },
  waitForCatalog: boolean,
): Promise<LocalAiModel[]> {
  const key = "local-ai-model-catalog:" + createHash("sha256")
    .update(JSON.stringify([config.baseUrl, config.apiKey])).digest("hex");
  const cache = new DbMgrCache(new DbMgr(getConnection().manager, SUPER_USER));
  const catalog = await readCatalog(cache, key);
  if ((!catalog || Date.now() >= catalog.refreshAfter) && !refreshing.has(key)) {
    const refresh = refreshCatalog(key, config)
      .catch(() => { logger().warn("AI model catalog persistence failed"); })
      .finally(() => { refreshing.delete(key); });
    refreshing.set(key, refresh);
  }
  if (waitForCatalog && !catalog?.models) {
    await refreshing.get(key);
    return (await readCatalog(cache, key))?.models ?? [];
  }
  return catalog?.models ?? [];
}
