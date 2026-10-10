import {
  maybeUploadImage,
  readAndSanitizeFileAsImage,
} from "@/wab/client/dom-utils";
import { useI18n } from "@/wab/client/i18n";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ImageAssetType } from "@/wab/shared/core/image-asset-type";
import { canWrite } from "@/wab/shared/ui-config-utils";
import { UploadOutlined } from "@ant-design/icons";
import { Alert, Button, Flex, Upload } from "antd";
import { observer } from "mobx-react";
import { ok } from "neverthrow";
import React from "react";

export const ResourceUpload = observer(function ResourceUpload({
  studioCtx,
  onUploaded,
}: {
  studioCtx: StudioCtx;
  onUploaded: (type: ImageAssetType) => void;
}) {
  const { t } = useI18n();
  const [uploadingType, setUploadingType] = React.useState<ImageAssetType>();
  const uploading = uploadingType !== undefined;
  const [feedback, setFeedback] = React.useState<
    "success" | "error" | "invalid" | undefined
  >();
  const pending = React.useRef(false);
  const editable = studioCtx.canSave();
  const permission = studioCtx.getLeftTabPermission("images");
  const canUploadImage =
    editable &&
    canWrite(permission, studioCtx.getLeftTabPermission("imagesSection"));
  const canUploadIcon =
    editable &&
    canWrite(permission, studioCtx.getLeftTabPermission("iconsSection"));
  if (!canUploadImage && !canUploadIcon) {
    return null;
  }

  async function upload(file: File, type: ImageAssetType) {
    if (
      pending.current ||
      !studioCtx.canSave() ||
      !canWrite(
        studioCtx.getLeftTabPermission("images"),
        studioCtx.getLeftTabPermission(
          type === ImageAssetType.Icon ? "iconsSection" : "imagesSection",
        ),
      )
    ) {
      return false;
    }
    pending.current = true;
    setUploadingType(type);
    setFeedback(undefined);
    try {
      const image = await readAndSanitizeFileAsImage(studioCtx.appCtx, file);
      if (!image) {
        setFeedback("invalid");
        return false;
      }
      const { imageResult, opts } = await maybeUploadImage(
        studioCtx.appCtx,
        image,
        type,
        file,
      );
      if (!imageResult || !opts) {
        setFeedback("invalid");
        return false;
      }
      // Permissions and the editable version can change while the upload is in flight.
      if (
        !studioCtx.canSave() ||
        !canWrite(
          studioCtx.getLeftTabPermission("images"),
          studioCtx.getLeftTabPermission(
            type === ImageAssetType.Icon ? "iconsSection" : "imagesSection",
          ),
        )
      ) {
        return false;
      }
      await studioCtx.change(() => {
        studioCtx.siteOps().createImageAsset(imageResult, opts);
        return ok();
      });
      setFeedback("success");
      onUploaded(type);
    } catch {
      setFeedback("error");
    } finally {
      setUploadingType(undefined);
      pending.current = false;
    }
    return false;
  }
  return (
    <Flex vertical gap={8} className="resource-panel-upload">
      <Flex gap={8} wrap>
        {canUploadImage && (
          <Upload
            accept="image/*"
            showUploadList={false}
            multiple={false}
            disabled={uploading}
            beforeUpload={(file) => upload(file, ImageAssetType.Picture)}
          >
            <Button
              size="small"
              icon={<UploadOutlined aria-hidden />}
              loading={uploadingType === ImageAssetType.Picture}
              disabled={uploading}
            >
              {t("Upload image")}
            </Button>
          </Upload>
        )}
        {canUploadIcon && (
          <Upload
            accept="image/svg+xml,.svg"
            showUploadList={false}
            multiple={false}
            disabled={uploading}
            beforeUpload={(file) => upload(file, ImageAssetType.Icon)}
          >
            <Button
              size="small"
              icon={<UploadOutlined aria-hidden />}
              loading={uploadingType === ImageAssetType.Icon}
              disabled={uploading}
            >
              {t("Upload icon")}
            </Button>
          </Upload>
        )}
      </Flex>
      {feedback && (
        <Alert
          showIcon
          type={feedback === "success" ? "success" : "error"}
          title={t(
            feedback === "success"
              ? "Asset uploaded"
              : feedback === "invalid"
                ? "Invalid image"
                : "Failed to upload asset",
          )}
        />
      )}
    </Flex>
  );
});
