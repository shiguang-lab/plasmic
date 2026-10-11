import { showTemporaryPrompt } from "@/wab/client/components/quick-modals";
import { Modal } from "@/wab/client/components/widgets/Modal";
import { useI18n } from "@/wab/client/i18n";
import { zIndex } from "@/wab/client/z-index";
import { Button, Flex } from "antd";
import React from "react";

export function BranchVersionDialog({
  hasSavedVersion,
  onSaveVersion,
  onUseLastVersion,
  onCancel,
}: {
  hasSavedVersion: boolean;
  onSaveVersion: () => void;
  onUseLastVersion: () => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  return (
    <Modal
      open
      centered
      width={520}
      zIndex={zIndex.quickModal}
      title={t("Save a version before branching")}
      onCancel={onCancel}
      footer={
        <Flex gap={8} justify="flex-end" wrap>
          <Button onClick={onCancel}>{t("Cancel")}</Button>
          {hasSavedVersion && (
            <Button onClick={onUseLastVersion}>
              {t("Use last saved version")}
            </Button>
          )}
          <Button type="primary" onClick={onSaveVersion}>
            {t("Go to save version")}
          </Button>
        </Flex>
      }
    >
      <p>
        {t(
          hasSavedVersion
            ? "The source branch has changes that are not included in its latest saved version. Save a new version to include them, or create the branch from the last saved version."
            : "This project does not have a saved version yet. Auto-save keeps your edits, while a version provides the starting point for a branch.",
        )}
      </p>
      <p>
        {t(
          "Use Save version in the publishing panel, then return here to create the branch.",
        )}
      </p>
    </Modal>
  );
}

export function promptBranchVersion(hasSavedVersion: boolean) {
  return showTemporaryPrompt<"save" | "use-last">((onSubmit, onCancel) => (
    <BranchVersionDialog
      hasSavedVersion={hasSavedVersion}
      onSaveVersion={() => onSubmit("save")}
      onUseLastVersion={() => onSubmit("use-last")}
      onCancel={onCancel}
    />
  ));
}
