import { localAiFetch } from "@/wab/client/copilot/local-edit-session";
import {
  LocalAiStatus,
  LocalAiModel,
  localAiStatusSchema,
} from "@/wab/shared/copilot/local-edit";
import { useCallback, useEffect, useMemo, useEffectEvent, useState } from "react";

/** Each mounted AI view reads service metadata directly; caching belongs to the server. */
export function useLocalAiStatus(
  projectId: string | undefined,
  enabled: boolean,
  fetchStatus?: () => Promise<LocalAiStatus>,
  fetchModels?: () => Promise<LocalAiModel[]>,
) {
  const readStatus = useEffectEvent((id: string) => fetchStatus ? fetchStatus() : localAiFetch<unknown>(id, "status"));
  const readModels = useEffectEvent((id: string) => fetchModels ? fetchModels() : localAiFetch<unknown>(id, "models"));
  const [status, setStatus] = useState<{
    projectId: string;
    data?: LocalAiStatus;
    error?: unknown;
  }>();
  const [catalog, setCatalog] = useState<{
    projectId: string;
    revision: number;
    models: LocalAiModel[];
  }>();
  const [revision, setRevision] = useState(0);
  const refreshModels = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    setStatus(undefined);
    if (!enabled || !projectId) {
      return;
    }
    let active = true;
    const pending = (async () => {
        const response = await readStatus(projectId);
        const parsed = localAiStatusSchema.safeParse(response);
        if (!parsed.success) {
          throw new Error(
            "The AI service returned an invalid status. Update the server and reload the assistant.",
          );
        }
        if (active) {
          setStatus({ projectId, data: parsed.data });
        }
    })().catch((error) => {
      if (active) { setStatus({ projectId, error }); }
    });
    void pending;
    return () => { active = false; };
  }, [enabled, projectId]);

  useEffect(() => {
    setCatalog(undefined);
    if (!enabled || !projectId) {
      return;
    }
    let active = true;
    const pending = (async () => {
        const response = await readModels(projectId);
        const models = localAiStatusSchema.shape.models.parse(response);
        if (active) {
          setCatalog({ projectId, revision, models });
        }
    })().catch(() => {
      // Keep editing with the status response; reopening the menu requests again.
    });
    void pending;
    return () => { active = false; };
  }, [enabled, projectId, revision]);

  useEffect(() => {
    window.addEventListener("focus", refreshModels);
    window.addEventListener("online", refreshModels);
    return () => {
      window.removeEventListener("focus", refreshModels);
      window.removeEventListener("online", refreshModels);
    };
  }, [refreshModels]);

  const currentStatus = enabled && status?.projectId === projectId ? status : undefined;
  const models = enabled && catalog?.projectId === projectId && catalog?.revision === revision
    ? catalog.models : undefined;
  const data = useMemo(
    () => currentStatus?.data && models
      ? { ...currentStatus.data, models } : currentStatus?.data,
    [currentStatus, models],
  );
  return {
    data,
    error: currentStatus?.error,
    modelsLoaded: !!models,
    refreshModels,
  };
}
