import styles from "./PublishModal.module.less";
import { Modal } from "@/wab/client/components/widgets/Modal";
import { useI18n } from "@/wab/client/i18n";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import * as React from "react";

export function PublishModal({
  open,
  onClose,
  busy = false,
  children,
  compact = false,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  busy?: boolean;
  children: React.ReactNode;
  compact?: boolean;
  footer: React.ReactNode;
}) {
  const { t } = useI18n();

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={t("Publish")}
      footer={footer}
      width={900}
      style={{ maxWidth: "calc(100vw - 32px)", top: 64 }}
      closable
      mask={{ closable: !busy }}
    >
      {compact ? (
        children
      ) : (
        <Scrollbar scrollX={false} className={styles.content}>
          {children}
        </Scrollbar>
      )}
    </Modal>
  );
}
