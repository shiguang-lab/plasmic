import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { useI18n } from "@/wab/client/i18n";
import { Button, message } from "antd";
import * as React from "react";
import { useStore } from "zustand";

export function TemplatePublishButton() {
  const studio = useStudioCtx();
  const { t } = useI18n();
  const branchId = useStore(
    studio.uiEnvironment.store,
    (state) => state.branchId,
  );
  const [publishing, setPublishing] = React.useState(false);
  return (
    <Button
      type="primary"
      loading={publishing}
      disabled={branchId !== null}
      onClick={async () => {
        setPublishing(true);
        try {
          await studio.save({ noErrorNotification: true });
          if (studio.hasUnsavedChanges()) {
            void message.error(t("Save the template draft before publishing"));
          } else {
            await studio.appCtx.api.publishDesignTemplate(studio.siteInfo.id);
            void message.success(t("Template published"));
          }
        } catch (error) {
          void message.error(
            error instanceof Error
              ? error.message
              : t("Template operation failed"),
          );
        }
        setPublishing(false);
      }}
    >
      {t("Publish template")}
    </Button>
  );
}
