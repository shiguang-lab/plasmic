import { useAppCtx } from "@/wab/client/contexts/AppContexts";
import { getUploadedFile } from "@/wab/client/dom-utils";
import { useI18n } from "@/wab/client/i18n";
import { WorkspaceId } from "@/wab/shared/ApiSchema";
import { APP_ROUTES } from "@/wab/shared/route/app-routes";
import { ImportOutlined } from "@ant-design/icons";
import { Button, message } from "antd";
import * as React from "react";

export function ImportPlasmicButton(props: {
  className?: string;
  disabled?: boolean;
  workspaceId?: WorkspaceId;
}) {
  const { t } = useI18n();
  const appCtx = useAppCtx();
  const [loading, setLoading] = React.useState(false);

  const handleImport = () => {
    getUploadedFile(
      async (content: string, file?: File) => {
        setLoading(true);
        try {
          // Validate JSON
          const parsed = JSON.parse(content);
          if (!parsed || (typeof parsed !== "object" && !Array.isArray(parsed))) {
            throw new Error(t("Please select a valid .plasmic file."));
          }
          const suggestedName = file?.name?.replace(/\.(plasmic|json)$/i, "");
          const result = await appCtx.api.importProject(content, {
            projectName: suggestedName,
            workspaceId: props.workspaceId,
          });
          void message.success({
            content: t("Imported project successfully"),
          });
          window.location.href = APP_ROUTES.project.fill({
            projectId: result.projectId,
          });
        } catch (error) {
          console.error("Failed to import .plasmic file:", error);
          void message.error({
            content:
              error instanceof Error && error.message.includes(t("Please select a valid .plasmic file."))
                ? error.message
                : t("Failed to import .plasmic file"),
          });
          setLoading(false);
        }
      },
      {
        accept: ".plasmic,.json",
        onCancel: () => setLoading(false),
      },
    );
  };

  return (
    <Button
      className={props.className}
      disabled={props.disabled || loading}
      loading={loading}
      color="default"
      variant="text"
      icon={<ImportOutlined aria-hidden />}
      onClick={handleImport}
    >
      {t("Import .plasmic")}
    </Button>
  );
}
