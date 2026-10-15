import { localAiFetch } from "@/wab/client/copilot/local-edit-session";
import {
  LocalAiStatus,
  localAiStatusSchema,
} from "@/wab/shared/copilot/local-edit";
import useSWR from "swr";

/** Project-scoped service metadata, prefetched by Studio and shared by AI views. */
export function useLocalAiStatus(
  projectId: string | undefined,
  enabled: boolean,
  fetchStatus?: () => Promise<LocalAiStatus>,
) {
  return useSWR<LocalAiStatus, Error>(
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
}
