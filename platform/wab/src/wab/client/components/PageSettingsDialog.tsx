import PageSettings from "@/wab/client/components/PageSettings";
import { PopoverFrameProvider } from "@/wab/client/components/sidebar/PopoverFrame";
import { Modal } from "@/wab/client/components/widgets/Modal";
import { useI18n } from "@/wab/client/i18n";
import { useStudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { PageComponent } from "@/wab/shared/core/components";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import { Button, Typography } from "antd";
import { observer } from "mobx-react";
import React from "react";

export const PageSettingsDialog = observer(function PageSettingsDialog({
  open,
  page,
  onClose,
}: {
  open: boolean;
  page: PageComponent | undefined;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const studioCtx = useStudioCtx();
  const viewCtx = studioCtx.viewCtxs.find((vc) => vc.component === page);
  return (
    <Modal
      open={open}
      centered
      width={640}
      title={
        page
          ? t("Page settings: {name}", { name: page.name })
          : t("Page settings")
      }
      onCancel={onClose}
      styles={{ body: { overflow: "hidden" } }}
      footer={
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <Typography.Text type="secondary">
            {t("Changes are saved automatically.")}
          </Typography.Text>
          <Button type="primary" onClick={onClose}>
            {t("Done")}
          </Button>
        </div>
      }
    >
      <PopoverFrameProvider containerSelector=".ant-modal-content">
        <Scrollbar
          scrollX={false}
          className="studio-scrollbar"
          style={{ maxHeight: "calc(100dvh - 200px)" }}
        >
          {page && (
            <PageSettings key={page.uuid} page={page} viewCtx={viewCtx} />
          )}
        </Scrollbar>
      </PopoverFrameProvider>
    </Modal>
  );
});
