import { Modal } from "@/wab/client/components/widgets/Modal";
import { useI18n } from "@/wab/client/i18n";
import publish from "@/wab/client/plasmic/plasmic_kit_continuous_deployment/PlasmicPublishFlowDialog.module.css";
import button from "@/wab/client/plasmic/PlasmicButton.module.css";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import { createStyles } from "antd-style";
import * as React from "react";

const usePublishStyles = createStyles(({ token }) => ({
  content: {
    maxHeight: "calc(100vh - 240px)",
    minHeight: 0,
    color: token.colorText,
    [`& .${publish.root}`]: {
      width: "100%",
      background: token.colorBgContainer,
      border: 0,
      borderRadius: 0,
    },
    [`& .${publish.freeBox___11T7Q}`]: { background: token.colorBgContainer },
    [`& .${publish.addActionsContainer}, & .${publish.freeBox__uIv1}, & .${publish.addWebsitePanel}, & .${publish.addGithubPanel}, & .${publish.addWebhooksPanel}`]:
      {
        background: token.colorBgContainer,
        borderColor: token.colorBorderSecondary,
      },
    [`& .${button.slotTargetChildrentype_secondary}`]: {
      color: token.colorText,
    },
  },
}));

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
  const { styles } = usePublishStyles();
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
