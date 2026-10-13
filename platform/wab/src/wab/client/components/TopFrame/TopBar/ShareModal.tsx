/** @format */

import { Modal } from "@/wab/client/components/widgets/Modal";
import ShareDialogContent from "@/wab/client/components/widgets/plasmic/ShareDialogContent";
import { useTopFrameCtx } from "@/wab/client/frame-ctx/top-frame-ctx";
import { ApiPermission, ApiProject } from "@/wab/shared/ApiSchema";
import { createStyles } from "antd-style";
import { observer } from "mobx-react";
import * as React from "react";

interface ShareModalProps {
  refreshProjectAndPerms: () => void;
  project: ApiProject;
  perms: ApiPermission[];
  showShareModal: boolean;
  setShowShareModal: (val: boolean) => Promise<void>;
}

const useStyles = createStyles(() => ({
  content: {
    "& > div:first-child > div:first-child": { paddingRight: 64 },
  },
}));

export const ShareModal = observer(function ShareModal({
  refreshProjectAndPerms,
  project,
  perms,
  showShareModal,
  setShowShareModal,
}: ShareModalProps) {
  const { hostFrameApi } = useTopFrameCtx();
  const { styles } = useStyles();

  return (
    <Modal
      onCancel={() => setShowShareModal(false)}
      open={showShareModal}
      footer={null}
      closable
      modalRender={(node) => (
        <div
          onKeyDownCapture={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              void setShowShareModal(false);
            }
          }}
        >
          {node}
        </div>
      )}
      maskClosable={true}
      width={500}
      styles={{ container: { padding: 0 } }}
      wrapClassName="no-padding-ant-modal"
    >
      <ShareDialogContent
        className={styles.content}
        closeDialog={() => setShowShareModal(false)}
        perms={perms}
        reloadPerms={async () => {
          await hostFrameApi.refreshSiteInfo();
          refreshProjectAndPerms();
        }}
        updateResourceCallback={async () => {
          await hostFrameApi.refreshSiteInfo();
          refreshProjectAndPerms();
        }}
        resource={{
          type: "project",
          resource: project,
        }}
      />
    </Modal>
  );
});

export default ShareModal;
