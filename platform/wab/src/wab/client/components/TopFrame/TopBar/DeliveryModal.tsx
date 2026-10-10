import { Modal } from "@/wab/client/components/widgets/Modal";
import { useI18n } from "@/wab/client/i18n";
import publish from "@/wab/client/plasmic/plasmic_kit_continuous_deployment/PlasmicPublishFlowDialog.module.css";
import button from "@/wab/client/plasmic/PlasmicButton.module.css";
import { Tabs } from "antd";
import { createStyles } from "antd-style";
import * as React from "react";

export type DeliveryTab = "share" | "code" | "publish";
export interface DeliveryNavigationProps {
  onSelectDelivery: (tab: DeliveryTab) => void;
}

const useDeliveryStyles = createStyles(({ token }) => ({
  content: {
    maxHeight: "calc(100vh - 240px)",
    overflowY: "auto",
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
  navigation: { marginBottom: 16 },
}));

export function DeliveryModal({
  tab,
  open,
  onClose,
  onSelectDelivery,
  busy = false,
  children,
}: DeliveryNavigationProps & {
  tab: DeliveryTab;
  open: boolean;
  onClose: () => void;
  busy?: boolean;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const { styles } = useDeliveryStyles();
  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={t("Project delivery")}
      footer={null}
      width={900}
      style={{ maxWidth: "calc(100vw - 32px)", top: 64 }}
      closable
      maskClosable={!busy}
    >
      <Tabs
        className={styles.navigation}
        activeKey={tab}
        onChange={(key) => {
          if (key === "share" || key === "code" || key === "publish") {
            onSelectDelivery(key);
          }
        }}
        items={(
          [
            { key: "share", label: t("Share") },
            { key: "code", label: t("Export code") },
            { key: "publish", label: t("Publish") },
          ] satisfies { key: DeliveryTab; label: string }[]
        ).map((item) => ({
          ...item,
          disabled: busy && item.key !== tab,
          children:
            item.key === tab ? (
              <div className={styles.content}>{children}</div>
            ) : null,
        }))}
      />
    </Modal>
  );
}
