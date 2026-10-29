import type { AiSessionView } from "@/wab/client/copilot/ai-session-view";
import { useI18n } from "@/wab/client/i18n";
import { Alert } from "antd";
import * as React from "react";

export function AiSyncNotice({ session }: { session: AiSessionView }) {
  const { t } = useI18n();
  if (!session.syncError) {
    return null;
  }
  return (
    <Alert
      type="warning"
      role="status"
      message={t(session.activeRun
        ? "AI task status is temporarily unavailable. Retrying…"
        : "AI conversation sync was interrupted. Retrying…")}
    />
  );
}
