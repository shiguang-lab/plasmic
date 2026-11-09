import { useVariantModelWorld } from "@/wab/client/components/variants/variant-model-world";
import { useSelectedImageAsset } from "@/wab/client/studio-ctx/image-asset-inputs";
import { useModelSelector } from "@/wab/client/stores/model-revisions-react";
import { modelKeys } from "@/wab/shared/model-revisions";
import { showError } from "@/wab/client/ErrorNotifications";
import { FindReferencesModal } from "@/wab/client/components/sidebar/FindReferencesModal";
import { SidebarModalProvider } from "@/wab/client/components/sidebar/SidebarModal";
import { Modal } from "@/wab/client/components/widgets/Modal";
import { downloadImageAsset } from "@/wab/client/dom-utils";
import { useI18n } from "@/wab/client/i18n";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { useStudioSaveState } from "@/wab/client/studio-ctx/save-state";
import { ImageAssetType } from "@/wab/shared/core/image-asset-type";
import { extractImageAssetUsages } from "@/wab/shared/core/image-assets";
import { ImageAsset } from "@/wab/shared/model/classes";
import { canWrite } from "@/wab/shared/ui-config-utils";
import { MoreOutlined } from "@ant-design/icons";
import { Button, Dropdown, Input, Typography } from "antd";
import React from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";

export const ResourceAssetActions = React.memo(function ResourceAssetActions({
  studioCtx,
  asset,
}: {
  studioCtx: StudioCtx;
  asset: ImageAsset;
}) {
  const { t } = useI18n();
  const selected = useSelectedImageAsset(studioCtx, asset);
  const fields = React.useMemo(() => ({
    width: studioCtx.modelSnapshots.field(asset, "width"),
    height: studioCtx.modelSnapshots.field(asset, "height"),
    type: studioCtx.modelSnapshots.field(asset, "type"),
  }), [studioCtx, asset]);
  const width = useStore(fields.width);
  const height = useStore(fields.height);
  const type = useStore(fields.type);
  const assetName = selected?.name ?? "";
  const dataUri = selected?.dataUri;
  const [view, setView] = React.useState<"preview" | "rename" | "references">();
  const [name, setName] = React.useState(assetName);
  const [busy, setBusy] = React.useState(false);
  const pending = React.useRef(false);
  const canSave = useStudioSaveState(studioCtx, (state) => state.canSave);
  const [imagesPermission, imagesSectionPermission, iconsSectionPermission] =
    useStore(
      studioCtx.uiEnvironment.store,
      useShallow((state) => [
        state.leftTabPermissions.images,
        state.leftTabPermissions.imagesSection,
        state.leftTabPermissions.iconsSection,
      ] as const),
    );
  const canEdit = () => studioCtx.site.imageAssets.includes(asset) && studioCtx.canSave() && canWrite(
    studioCtx.getLeftTabPermission("images"),
    asset.type === ImageAssetType.Icon ? studioCtx.getLeftTabPermission("iconsSection") : studioCtx.getLeftTabPermission("imagesSection"),
  );
  const editable = !!selected?.editable && canSave && canWrite(
    imagesPermission,
    type === ImageAssetType.Icon ? iconsSectionPermission : imagesSectionPermission,
  );

  async function mutate(action: "rename" | "delete") {
    if (
      pending.current ||
      !canEdit() ||
      (action === "rename" && !name.trim())
    ) {
      return;
    }
    pending.current = true;
    setBusy(true);
    return await (async () => {
      if (action === "rename") {
        await studioCtx.changeUnsafe(() => {
          if (canEdit()) {
            studioCtx.siteOps().renameImageAsset(asset, name.trim());
          }
        });
        setView(undefined);
      } else {
        // The existing operation checks usages and owns deletion confirmation.
        await studioCtx.siteOps().tryDeleteImageAssets([asset]);
      }
    })().catch((cause) => {
      showError(cause, { title: "Failed to update asset" });
    }).finally(() => {
      pending.current = false;
      setBusy(false);
    });
  }

  return (
    <div
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onWheel={(event) => {
        if (view) {
          event.stopPropagation();
        }
      }}
      onKeyDown={(event) => {
        if (view) {
          event.stopPropagation();
        }
      }}
      style={{ position: "absolute", right: 4, top: 4 }}
    >
      <Dropdown
        trigger={["click"]}
        menu={{
          items: [
            { key: "preview", label: t("Preview") },
            { key: "references", label: t("Find all references") },
            ...(dataUri
              ? [{ key: "download", label: t("Download image") }]
              : []),
            ...(editable
              ? [
                  { key: "rename", label: t("Rename") },
                  { key: "delete", label: t("Delete"), danger: true },
                ]
              : []),
          ],
          onClick: ({ key, domEvent }) => {
            domEvent.stopPropagation();
            if (key === "download") {
              downloadImageAsset(asset);
            } else if (key === "delete") {
              void mutate("delete");
            } else if (
              key === "preview" ||
              key === "references" ||
              key === "rename"
            ) {
              setName(assetName);
              setView(key);
            }
          },
        }}
      >
        <Button
          size="small"
          aria-label={t("Asset actions")}
          icon={<MoreOutlined aria-hidden />}
          disabled={busy}
        />
      </Dropdown>
      <Modal
        open={view === "preview" || view === "rename"}
        title={view === "rename" ? t("Rename") : assetName}
        onCancel={(event) => {
          event.stopPropagation();
          if (!busy) {
            setView(undefined);
          }
        }}
        closable={!busy}
        mask={{ closable: !busy }}
        keyboard={!busy}
        footer={
          view === "rename" ? (
            <Button
              type="primary"
              loading={busy}
              disabled={!editable || !name.trim()}
              onClick={() => void mutate("rename")}
            >
              {t("Save")}
            </Button>
          ) : null
        }
      >
        {view === "rename" ? (
          <>
            <Input
              aria-label={t("Asset name")}
              autoFocus
              value={name}
              disabled={busy || !editable}
              onChange={(event) => setName(event.target.value)}
              onPressEnter={() => void mutate("rename")}
            />
          </>
        ) : (
          <>
            <img
              src={dataUri ?? undefined}
              alt={assetName}
              style={{ width: "100%", maxHeight: "60vh", objectFit: "contain" }}
            />
            {!!width && !!height && (
              <Typography.Text type="secondary">
                {width} × {height}
              </Typography.Text>
            )}
          </>
        )}
      </Modal>
      {view === "references" && (
        <SidebarModalProvider>
          <AssetReferences studioCtx={studioCtx} asset={asset} onClose={() => setView(undefined)} />
        </SidebarModalProvider>
      )}
    </div>
  );
});


function AssetReferences({ studioCtx, asset, onClose }: {
  studioCtx: StudioCtx;
  asset: ImageAsset;
  onClose: () => void;
}) {
  const world = useVariantModelWorld(studioCtx, asset);
  const selected = useSelectedImageAsset(studioCtx, asset);
  const query = React.useCallback(() => world.isCurrent() ? extractImageAssetUsages(world.site, asset)[1] : { components: [], frames: [] }, [world, asset]);
  const usageSummary = useModelSelector(studioCtx.modelRevisions, [modelKeys.site], query);
  return <FindReferencesModal studioCtx={studioCtx} displayName={selected?.name ?? ""} icon={<MoreOutlined />}
    usageSummary={usageSummary} onClose={onClose} />;
}
