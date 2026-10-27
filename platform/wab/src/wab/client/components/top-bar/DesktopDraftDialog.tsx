import { showError } from "@/wab/client/ErrorNotifications";
import { Modal } from "@/wab/client/components/widgets/Modal";
import { downloadBlob } from "@/wab/client/dom-utils";
import { useI18n } from "@/wab/client/i18n";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ensure } from "@/wab/shared/common";
import type { DesktopDraftSummary } from "@/wab/shared/desktop-drafts";
import { APP_ROUTES } from "@/wab/shared/route/app-routes";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import { Alert, Button, Flex, Popconfirm, Typography } from "antd";
import { observer } from "mobx-react";
import React from "react";

export const DesktopDraftDialog = observer(function DesktopDraftDialog({ studioCtx }: { studioCtx: StudioCtx }) {
  const { t, locale } = useI18n();
  const controller = studioCtx.desktopDraft;
  const [busy, setBusy] = React.useState<string>();
  if (!controller?.enabled) {return null;}
  const perform = async (draft: DesktopDraftSummary, action: "export" | "copy" | "discard") => {
    setBusy(draft.id);
    try {
      if (action === "discard") {
        if (controller.isCurrentDraft(draft)) {await studioCtx.useRemoteVersion();}
        await controller.discard(draft);
      }
      else if (action === "copy") {
        const topFrameApi = ensure(studioCtx.appCtx.topFrameApi, "Missing top frame API");
        const id = await topFrameApi.copyDesktopDraft(ensure(controller.session, "Missing draft session").handle, draft.id);
        if (!controller.isCurrentDraft(draft)) {await controller.discard(draft);}
        topFrameApi.pushLocation(APP_ROUTES.project.fill({ projectId: id }));
      } else {
        const content = ensure(await controller.read(draft), "Local draft not found");
        downloadBlob(new Blob([JSON.stringify({
          format: "plasmic/project", version: 1, name: draft.projectName,
          bundles: [...content.dependencies.map(dep => [dep.id, dep.model]), [content.projectId, content.bundle]],
        })], { type: "application/json" }), `${draft.projectName.replace(/[\\/:*?"<>|]/g, "_")}.plasmic`);
      }
    } catch (e) { showError(e); }
    finally { setBusy(undefined); }
  };
  return <Modal
    title={t("Local drafts")}
    open={controller.dialogOpen}
    onCancel={() => { controller.dialogOpen = false; }}
    footer={<Button disabled={!!busy} onClick={async () => {
      setBusy("remote");
      try { await studioCtx.useRemoteVersion(); controller.dialogOpen = false; }
      catch (e) { showError(e); }
      finally { setBusy(undefined); }
    }}>{t("Continue with remote version")}</Button>}
    width={580}
  >
    <Flex vertical gap={16}>
      <Alert type="warning" showIcon title={t("Local drafts need attention")} description={t("The remote project has changed or multiple local drafts exist. Your drafts are kept on this device. Open a copy to inspect your edits without replacing the remote project.")} />
      <div style={{ height: Math.min(320, Math.max(80, controller.drafts.length * 100)), minHeight: 0 }}>
        <Scrollbar style={{ height: "100%" }}>
          <Flex vertical gap={16}>
            {controller.drafts.map(draft => <Flex key={draft.id} vertical gap={8}>
              <Typography.Text>{draft.projectName} · {new Date(draft.savedAt).toLocaleString(locale)}</Typography.Text>
              <Flex gap={8} wrap>
                <Button loading={busy === draft.id} disabled={!!busy} onClick={() => void perform(draft, "copy")}>{t("Open as copy")}</Button>
                <Button disabled={!!busy} onClick={() => void perform(draft, "export")}>{t("Export .plasmic")}</Button>
                <Popconfirm title={t("Discard this local draft?")} description={t("Unsynced edits in this draft will be permanently removed.")} onConfirm={() => perform(draft, "discard")}>
                  <Button danger disabled={!!busy}>{t("Discard draft")}</Button>
                </Popconfirm>
              </Flex>
            </Flex>)}
          </Flex>
        </Scrollbar>
      </div>
    </Flex>
  </Modal>;
});
