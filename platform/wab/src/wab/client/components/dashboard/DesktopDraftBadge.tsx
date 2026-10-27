import { desktopDraftBridge } from "@/wab/client/desktop-drafts";
import { useAppCtx } from "@/wab/client/contexts/AppContexts";
import { useI18n } from "@/wab/client/i18n";
import { useHistory } from "@/wab/client/route/HistoryProvider";
import { APP_ROUTES, SEARCH_PARAM_BRANCH } from "@/wab/shared/route/app-routes";
import type { ProjectId } from "@/wab/shared/ApiSchema";
import { Button, Tooltip, message } from "antd";
import React from "react";
import useSWR from "swr";

export function DesktopDraftBadge({ projectId }: { projectId: ProjectId }) {
  const { t, locale } = useI18n();
  const appCtx = useAppCtx();
  const history = useHistory();
  const bridge = desktopDraftBridge();
  const userId = appCtx.selfInfo?.id;
  const { data } = useSWR(bridge && userId ? ["desktop-drafts", userId] : null,
    () => bridge && userId ? bridge.list(userId) : []);
  const drafts = data?.filter(draft => draft.projectId === projectId) ?? [];
  const draft = drafts[0];
  if (!draft) {return null;}
  const attention = drafts.some(item => item.needsAttention);
  return <Tooltip title={<>
    <div>{t("Unsynced edits are stored only on this device and account. Open the project to recover or review them.")}</div>
    <div>{t("Last local backup: {time}", { time: new Date(draft.savedAt).toLocaleString(locale) })}</div>
  </>}>
    <Button size="small" color="orange" variant="filled" style={{ flexShrink: 0 }} onClick={async event => {
      event.stopPropagation();
      try {
        let url = APP_ROUTES.project.fill({ projectId });
        if (draft.branchId) {
          const { branches } = await appCtx.api.listBranchesForProject(projectId);
          const branch = branches.find(item => item.id === draft.branchId);
          if (!branch) {throw new Error(t("The draft branch is no longer available."));}
          url += "?" + new URLSearchParams({ [SEARCH_PARAM_BRANCH]: branch.name });
        }
        history.push(url);
      } catch (error) { void message.error(String(error)); }
    }}>{attention ? t("Drafts need attention") : t("Local draft")}</Button>
  </Tooltip>;
}
