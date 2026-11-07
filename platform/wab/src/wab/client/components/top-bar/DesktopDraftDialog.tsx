import { showError } from "@/wab/client/ErrorNotifications";
import { Modal } from "@/wab/client/components/widgets/Modal";
import { downloadBlob } from "@/wab/client/dom-utils";
import { useI18n } from "@/wab/client/i18n";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { DesktopDraftController } from "@/wab/client/studio-ctx/desktop-drafts";
import {
  useDesktopDraftController,
  useDesktopDraftSelector,
} from "@/wab/client/studio-ctx/desktop-drafts-react";
import { ensure } from "@/wab/shared/common";
import type { DesktopDraftSummary } from "@/wab/shared/desktop-drafts";
import { APP_ROUTES } from "@/wab/shared/route/app-routes";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import { Alert, Button, Flex, Popconfirm, Typography } from "antd";
import React from "react";
import { useShallow } from "zustand/react/shallow";

async function performDraftAction(
  studioCtx: StudioCtx,
  controller: DesktopDraftController,
  draft: DesktopDraftSummary,
  action: "export" | "copy" | "discard",
) {
  if (action === "discard") {
    if (controller.isCurrentDraft(draft)) {
      await studioCtx.restoreRemoteVersion();
    }
    await controller.discard(draft);
  } else if (action === "copy") {
    const topFrameApi = ensure(
      studioCtx.appCtx.topFrameApi,
      "Missing top frame API",
    );
    const id = await topFrameApi.copyDesktopDraft(
      ensure(controller.session, "Missing draft session").handle,
      draft.id,
    );
    if (!controller.isCurrentDraft(draft)) {
      await controller.discard(draft);
    }
    topFrameApi.pushLocation(APP_ROUTES.project.fill({ projectId: id }));
  } else {
    const content = ensure(
      await controller.read(draft),
      "Local draft not found",
    );
    downloadBlob(
      new Blob(
        [
          JSON.stringify({
            format: "plasmic/project",
            version: 1,
            name: draft.projectName,
            bundles: [
              ...content.dependencies.map((dep) => [dep.id, dep.model]),
              [content.projectId, content.bundle],
            ],
          }),
        ],
        { type: "application/json" },
      ),
      `${draft.projectName.replace(/[\\/:*?"<>|]/g, "_")}.plasmic`,
    );
  }
}

export function DesktopDraftDialog({ studioCtx }: { studioCtx: StudioCtx }) {
  "use memo";
  const { t, locale } = useI18n();
  const controller = useDesktopDraftController(studioCtx);
  const [busy, setBusy] = React.useState<string>();
  const [enabled, dialogOpen, drafts] = useDesktopDraftSelector(
    controller,
    useShallow(
      (state) => [state.enabled, state.dialogOpen, state.drafts] as const,
    ),
  );
  if (!controller || !enabled) {
    return null;
  }
  const perform = (
    draft: DesktopDraftSummary,
    action: "export" | "copy" | "discard",
  ) => {
    setBusy(draft.id);
    return performDraftAction(studioCtx, controller, draft, action)
      .catch(showError)
      .finally(() => setBusy(undefined));
  };
  return (
    <Modal
      title={t("Local drafts")}
      open={dialogOpen}
      onCancel={() => {
        controller.setDialogOpen(false);
      }}
      footer={
        <Button
          disabled={!!busy}
          onClick={() => {
            setBusy("remote");
            void studioCtx
              .restoreRemoteVersion()
              .then(() => controller.setDialogOpen(false))
              .catch(showError)
              .finally(() => setBusy(undefined));
          }}
        >
          {t("Continue with remote version")}
        </Button>
      }
      width={580}
    >
      <Flex vertical gap={16}>
        <Alert
          type="warning"
          showIcon
          title={t("Local drafts need attention")}
          description={t(
            "The remote project has changed or multiple local drafts exist. Your drafts are kept on this device. Open a copy to inspect your edits without replacing the remote project.",
          )}
        />
        <div
          style={{
            height: Math.min(320, Math.max(80, drafts.length * 100)),
            minHeight: 0,
          }}
        >
          <Scrollbar style={{ height: "100%" }}>
            <Flex vertical gap={16}>
              {drafts.map((draft) => (
                <Flex key={draft.id} vertical gap={8}>
                  <Typography.Text>
                    {draft.projectName} ·{" "}
                    {new Date(draft.savedAt).toLocaleString(locale)}
                  </Typography.Text>
                  <Flex gap={8} wrap>
                    <Button
                      loading={busy === draft.id}
                      disabled={!!busy}
                      onClick={() => void perform(draft, "copy")}
                    >
                      {t("Open as copy")}
                    </Button>
                    <Button
                      disabled={!!busy}
                      onClick={() => void perform(draft, "export")}
                    >
                      {t("Export .plasmic")}
                    </Button>
                    <Popconfirm
                      title={t("Discard this local draft?")}
                      description={t(
                        "Unsynced edits in this draft will be permanently removed.",
                      )}
                      onConfirm={() => perform(draft, "discard")}
                    >
                      <Button danger disabled={!!busy}>
                        {t("Discard draft")}
                      </Button>
                    </Popconfirm>
                  </Flex>
                </Flex>
              ))}
            </Flex>
          </Scrollbar>
        </div>
      </Flex>
    </Modal>
  );
}
