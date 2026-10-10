import { FindReferencesModal } from "@/wab/client/components/sidebar/FindReferencesModal";
import { SidebarModalProvider } from "@/wab/client/components/sidebar/SidebarModal";
import { Modal } from "@/wab/client/components/widgets/Modal";
import { downloadImageAsset } from "@/wab/client/dom-utils";
import { useI18n } from "@/wab/client/i18n";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ImageAssetType } from "@/wab/shared/core/image-asset-type";
import { extractImageAssetUsages } from "@/wab/shared/core/image-assets";
import { ImageAsset } from "@/wab/shared/model/classes";
import { canWrite } from "@/wab/shared/ui-config-utils";
import { MoreOutlined } from "@ant-design/icons";
import { Alert, Button, Dropdown, Input, Typography } from "antd";
import { observer } from "mobx-react";
import React from "react";

export const ResourceAssetActions = observer(function ResourceAssetActions({
  studioCtx,
  asset,
}: {
  studioCtx: StudioCtx;
  asset: ImageAsset;
}) {
  const { t } = useI18n();
  const [view, setView] = React.useState<"preview" | "rename" | "references">();
  const [name, setName] = React.useState(asset.name);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(false);
  const pending = React.useRef(false);
  const canEdit = () =>
    studioCtx.site.imageAssets.includes(asset) &&
    studioCtx.canSave() &&
    canWrite(
      studioCtx.getLeftTabPermission("images"),
      studioCtx.getLeftTabPermission(
        asset.type === ImageAssetType.Icon ? "iconsSection" : "imagesSection",
      ),
    );
  const editable = canEdit();

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
    setError(false);
    try {
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
    } catch {
      setError(true);
      if (action === "delete") {
        setView("preview");
      }
    } finally {
      pending.current = false;
      setBusy(false);
    }
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
            ...(asset.dataUri
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
            setError(false);
            if (key === "download") {
              downloadImageAsset(asset);
            } else if (key === "delete") {
              void mutate("delete");
            } else if (
              key === "preview" ||
              key === "references" ||
              key === "rename"
            ) {
              setName(asset.name);
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
        title={view === "rename" ? t("Rename") : asset.name}
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
        {error && (
          <Alert
            type="error"
            title={t("Failed to update asset")}
            style={{ marginBottom: 12 }}
          />
        )}
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
              src={asset.dataUri ?? undefined}
              alt={asset.name}
              style={{ width: "100%", maxHeight: "60vh", objectFit: "contain" }}
            />
            {!!asset.width && !!asset.height && (
              <Typography.Text type="secondary">
                {asset.width} × {asset.height}
              </Typography.Text>
            )}
          </>
        )}
      </Modal>
      {view === "references" && (
        <SidebarModalProvider>
          <FindReferencesModal
            studioCtx={studioCtx}
            displayName={asset.name}
            icon={<MoreOutlined />}
            usageSummary={extractImageAssetUsages(studioCtx.site, asset)[1]}
            onClose={() => setView(undefined)}
          />
        </SidebarModalProvider>
      )}
    </div>
  );
});
