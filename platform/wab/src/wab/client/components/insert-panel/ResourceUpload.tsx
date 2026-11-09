import { showError } from "@/wab/client/ErrorNotifications";
import {
  maybeUploadImage,
  readAndSanitizeFileAsImage,
} from "@/wab/client/dom-utils";
import { useI18n } from "@/wab/client/i18n";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { useStudioSaveState } from "@/wab/client/studio-ctx/save-state";
import { ImageAssetType } from "@/wab/shared/core/image-asset-type";
import { canWrite, type UiAccess } from "@/wab/shared/ui-config-utils";
import { UploadOutlined } from "@ant-design/icons";
import { Button, Flex, Upload, message } from "antd";

import { ok } from "neverthrow";
import React from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";

type ResourceUploadAccess = Readonly<{
  canSave: boolean;
  images: UiAccess;
  imagesSection: UiAccess;
  iconsSection: UiAccess;
}>;

export const ResourceUpload = function ResourceUpload({
  studioCtx,
  onUploaded,
}: {
  studioCtx: StudioCtx;
  onUploaded: (type: ImageAssetType) => void;
}) {
  const { t } = useI18n();
  const [uploadingType, setUploadingType] = React.useState<ImageAssetType>();
  const uploading = uploadingType !== undefined;
  const pending = React.useRef(false);
  const canSave = useStudioSaveState(studioCtx, (state) => state.canSave);
  const [permission, imagesSectionPermission, iconsSectionPermission] =
    useStore(
      studioCtx.uiEnvironment.store,
      useShallow((state) => [
        state.leftTabPermissions.images,
        state.leftTabPermissions.imagesSection,
        state.leftTabPermissions.iconsSection,
      ] as const),
    );
  const canUpload = (type: ImageAssetType, access?: ResourceUploadAccess) =>
    (access?.canSave ?? studioCtx.canSave()) &&
    canWrite(
      access?.images ?? studioCtx.getLeftTabPermission("images"),
      type === ImageAssetType.Icon
        ? (access?.iconsSection ??
            studioCtx.getLeftTabPermission("iconsSection"))
        : (access?.imagesSection ??
            studioCtx.getLeftTabPermission("imagesSection")),
    );
  const access = {
    canSave,
    images: permission,
    imagesSection: imagesSectionPermission,
    iconsSection: iconsSectionPermission,
  };
  const canUploadImage = canUpload(ImageAssetType.Picture, access);
  const canUploadIcon = canUpload(ImageAssetType.Icon, access);
  if (!canUploadImage && !canUploadIcon) {
    return null;
  }

  async function upload(file: File, type: ImageAssetType) {
    if (pending.current || !canUpload(type)) {
      return false;
    }
    pending.current = true;
    setUploadingType(type);
    await (async () => {
      const image = await readAndSanitizeFileAsImage(studioCtx.appCtx, file);
      if (!image) {
        void message.error({ content: t("Invalid image") });
        return;
      }
      const { imageResult, opts } = await maybeUploadImage(
        studioCtx.appCtx,
        image,
        type,
        file,
      );
      if (!imageResult || !opts) {
        // Image type validation has already reported its specific error.
        return;
      }
      // Permissions and the editable version can change while the upload is in flight.
      if (!canUpload(type)) {
        return;
      }
      await studioCtx.change(() => {
        studioCtx.siteOps().createImageAsset(imageResult, opts);
        return ok();
      });
      void message.success({ content: t("Asset uploaded") });
      onUploaded(type);
    })().catch((error) => {
      showError(error, { title: "Failed to upload asset" });
    }).finally(() => {
      setUploadingType(undefined);
      pending.current = false;
    });
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
    </Flex>
  );
};
