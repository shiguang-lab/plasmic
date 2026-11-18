import { useInspectorTitle } from "@/wab/client/components/studio/inspector-title-inputs";
import PageSettings from "@/wab/client/components/PageSettings";
import styles from "@/wab/client/components/PageSettings.module.css";
import { PopoverFrameProvider } from "@/wab/client/components/sidebar/PopoverFrame";
import { Modal } from "@/wab/client/components/widgets/Modal";
import { useI18n } from "@/wab/client/i18n";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { useViewEntryForComponent } from "@/wab/client/studio-ctx/arena-state";
import { PageComponent } from "@/wab/shared/core/components";
import { cx } from "@/wab/shared/common";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import { Button, Typography } from "antd";
import React from "react";

export const PageSettingsDialog = React.memo(function PageSettingsDialog({
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
  const pageName = useInspectorTitle(studioCtx, undefined, page);
  const viewCtx = useViewEntryForComponent(studioCtx, page)?.view;
  return (
    <Modal
      open={open}
      centered
      width={560}
      title={
        page
          ? t("Page settings: {name}", { name: pageName ?? "" })
          : t("Page settings")
      }
      onCancel={onClose}
      styles={{ body: { overflow: "hidden" } }}
      footer={
        <div className={styles.dialogFooter}>
          <Typography.Text type="secondary">
            {t("Changes are saved automatically.")}
          </Typography.Text>
          <Button className={styles.doneButton} type="primary" onClick={onClose}>
            {t("Done")}
          </Button>
        </div>
      }
    >
      <PopoverFrameProvider containerSelector=".ant-modal-content">
        <Scrollbar
          scrollX={false}
          className={cx("studio-scrollbar", styles.dialogScroll)}
        >
          {page && (
            <PageSettings key={page.uuid} page={page} viewCtx={viewCtx} />
          )}
        </Scrollbar>
      </PopoverFrameProvider>
    </Modal>
  );
});
