import { localAiFetch } from "@/wab/client/copilot/local-edit-session";
import {
  LocalAiStatus,
  localAiStatusSchema,
} from "@/wab/shared/copilot/local-edit";
import { useMemo } from "react";
import useSWR from "swr";

/** Project-scoped service metadata, prefetched by Studio and shared by AI views. */
export function useLocalAiStatus(
  projectId: string | undefined,
  enabled: boolean,
  fetchStatus?: () => Promise<LocalAiStatus>,
  fetchModels?: () => Promise<string[]>,
) {
  const status = useSWR<LocalAiStatus, Error>(
    enabled && projectId ? ["local-ai-status", projectId] : null,
    async ([, id]: [string, string]) => {
      const response = fetchStatus
        ? await fetchStatus()
        : await localAiFetch<unknown>(id, "status");
      const parsed = localAiStatusSchema.safeParse(response);
      if (!parsed.success) {
        throw new Error(
          "The AI service returned an invalid status. Update the server and reload the assistant.",
        );
      }
      return parsed.data;
    },
    {
      shouldRetryOnError: false,
    },
  );
  const models = useSWR<string[], Error>(
    enabled && projectId && status.data?.configured
      ? ["local-ai-models", projectId]
      : null,
    async ([, id]: [string, string]) =>
      localAiStatusSchema.shape.models.parse(fetchModels ? await fetchModels() : await localAiFetch<unknown>(id, "models")),
    { shouldRetryOnError: false },
  );
  const data = useMemo(
    () => status.data && models.data ? { ...status.data, models: models.data } : status.data,
    [status.data, models.data],
  );
  return {
    ...status,
    modelsLoaded: !!models.data,
    data,
  };
}
