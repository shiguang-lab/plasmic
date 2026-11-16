import styles from "@/wab/client/components/style-controls/ImageSelector.module.scss";
import configSearch from "@/wab/client/components/style-controls/ConfigSearch.module.scss";
import { useImageAssetList, useSelectedImageAsset } from "@/wab/client/studio-ctx/image-asset-inputs";
import { ReadableClipboard } from "@/wab/client/clipboard/ReadableClipboard";
import { ImageAssetSidebarPopup } from "@/wab/client/components/sidebar/image-asset-controls";
import { FileUploader, PlainLinkButton } from "@/wab/client/components/widgets";
import { Icon } from "@/wab/client/components/widgets/Icon";
import { useAppCtx } from "@/wab/client/contexts/AppContexts";
import {
  ResizableImage,
  maybeUploadImage,
  readAndSanitizeFileAsImage,
} from "@/wab/client/dom-utils";
import { useI18n } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import ArrowRightIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__ArrowRight";
import CloseIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Close";
import ImageBlockIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__ImageBlock";
import UploadSvgIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__UploadSvg";
import TriangleBottomIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__TriangleBottom";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { MaybeWrap } from "@/wab/commons/components/ReactUtil";
import {
  Cancelable,
  cx,
  ensure,
  makeCancelable,
  spawnWrapper,
} from "@/wab/shared/common";
import { ImageAssetType } from "@/wab/shared/core/image-asset-type";
import { isValidUrl } from "@/wab/shared/css/urls";
import { ImageAsset, isKnownImageAsset } from "@/wab/shared/model/classes";
import { placeholderImgUrl } from "@/wab/shared/urls";
import { Button, Input, Select, Space, Tooltip, notification } from "antd";
import L from "lodash";
import { ok } from "neverthrow";
import React, { CSSProperties } from "react";

export function ImageAssetPreviewAndPicker(props: {
    studioCtx: StudioCtx;
    value?: ImageAsset | string;
    onPicked: (picked: ImageAsset | string) => void;
    type: ImageAssetType;
    className?: string;
    keepOpen?: boolean; // don't allow user to close the image picker, if there is no image selected
    forFallback?: boolean;
  }) {
    const { t: uiT } = useI18n();
    const { studioCtx, value, onPicked, type, keepOpen, forFallback } = props;
    const asset = isKnownImageAsset(value) ? value : undefined;
    const assetInput = useSelectedImageAsset(studioCtx, asset);
    const uri =
      assetInput?.dataUri
        ? assetInput.dataUri
        : L.isString(value)
          ? value
          : undefined;
    const isIcon = type === ImageAssetType.Icon;

    const [pickingImage, setPickingImage] = React.useState(
      !forFallback && (uri === placeholderImgUrl(isIcon) || !uri),
    );
    const [assetPopupTarget, setAssetPopupTarget] = React.useState<ImageAsset>();

    React.useEffect(() => {
      if (!uri && !forFallback) {
        setPickingImage(true);
      }
    }, [uri, forFallback]);

    const previewHeight = forFallback ? 28 : isIcon ? 50 : 150;

    return (
      <div
        className={cx("flex-col", props.className)}
        data-test-id={"image-picker"}
      >
        {!pickingImage && (
          <>
            <ImagePreview
              uri={uri ?? placeholderImgUrl(isIcon)}
              style={{
                height: previewHeight,
              }}
              hoverMsg={
                <>
                  <UiText message={"Replace image..."} />
                </>
              }
              onClick={() => setPickingImage(true)}
              size="contain"
              showCheckboard={true}
            />
            {uri && (
              <div className="mt-sm">
                <ImgInfo
                  url={uri}
                  filename={
                    asset && (
                      <MaybeWrap
                        cond={!!assetInput?.editable}
                        wrapper={(x) => (
                          <Tooltip title={uiT("Update image asset")}>
                            <PlainLinkButton
                              onClick={() => setAssetPopupTarget(asset)}
                            >
                              {x as React.ReactElement}
                            </PlainLinkButton>
                          </Tooltip>
                        )}
                      >
                        <>
                          <Icon icon={ImageBlockIcon} className="mr-xs" />
                          {assetInput?.name}
                        </>
                      </MaybeWrap>
                    )
                  }
                />
              </div>
            )}
          </>
        )}
        {pickingImage && (
          <div className={styles.pickerContainer}>
            <ImageAssetOrUrlPicker
              studioCtx={studioCtx}
              value={value}
              onPicked={(picked) => {
                if (picked) {
                  onPicked(picked);
                }
                setPickingImage(false);
              }}
              onCancel={() => setPickingImage(false)}
              type={type}
              keepOpen={keepOpen}
            />
          </div>
        )}
        {asset && assetPopupTarget === asset && assetInput?.editable && (
          <ImageAssetSidebarPopup
            asset={asset}
            editable // consider using the left tab icons/images setting here?
            onClose={() => setAssetPopupTarget(undefined)}
            studioCtx={studioCtx}
          />
        )}
      </div>
    );
}

type ImgInfoProps = {
  url: string;
  filename?: React.ReactNode;
  imagePreview?: React.ReactNode;
  extended?: boolean;
};
interface ImgInfoState {
  img: HTMLImageElement | undefined;
}

function useImageSize(url: string) {
  const promiseRef = React.useRef<Cancelable<any> | null>(null);
  const [size, setSize] = React.useState<
    { width: number; height: number } | undefined
  >(undefined);
  React.useEffect(() => {
    if (!url) { setSize(undefined); return; }
    const img = new Image();
    promiseRef.current = makeCancelable(
      new Promise((resolve) => (img.onload = resolve)),
    );
    img.src = url;
    promiseRef.current.promise
      .then(() => {
        setSize({ width: img.width, height: img.height });
      })
      .catch(() => {});

    return () => {
      if (promiseRef.current) {
        promiseRef.current.cancel();
      }
    };
  }, [url]);
  return size;
}

export function ImgInfo(props: ImgInfoProps) {
  const { url, filename, imagePreview, extended } = props;
  const size = useImageSize(url);

  if (extended) {
    return (
      <div>
        <div className={"flex flex-vcenter overflow-hidden dimfg"}>
          <div className={"flex-fill flex flex-vcenter"}>{imagePreview}</div>
          {size && (
            <div className="flex-push-right nowrap ml-ch">{`${size.width} × ${size.height}`}</div>
          )}
        </div>
        <div className="text-ellipsis overflow-hidden dimfg">{filename}</div>
      </div>
    );
  }

  return (
    <div className={"flex flex-vcenter overflow-hidden dimfg"}>
      <div className={"flex-fill text-ellipsis flex flex-vcenter"}>
        {filename}
      </div>
      {size && (
        <div className="flex-push-right nowrap ml-ch">{`${size.width} × ${size.height}`}</div>
      )}
    </div>
  );
}

export function ImagePreview(props: {
  uri?: string;
  children?: React.ReactNode;
  className?: string;
  style?: CSSProperties;
  hoverMsg?: React.ReactNode;
  onClick?: () => void;
  size?: "cover" | "contain";
  showCheckboard?: boolean;
}) {
  const isPlaceholder =
    !props.children && (!props.uri || props.uri === placeholderImgUrl());
  return (
    <div
      className={cx("image-preview", props.className)}
      onClick={props.onClick}
      style={props.style}
    >
      <div
        className={cx("img-thumb__checkers", {
          "img-thumb__checkers--shown": props.showCheckboard,
        })}
      >
        <div
          className={cx("img-thumb", {
            "img-thumb--placeholder": isPlaceholder,
          })}
          style={{
            backgroundImage:
              !props.children && !isPlaceholder
                ? `url("${props.uri}")`
                : "none",
            backgroundSize: props.size || "cover",
          }}
        >
          {isPlaceholder ? <Icon icon={ImageBlockIcon} /> : props.children}
        </div>
      </div>
      {props.hoverMsg && (
        <div className="image-preview__msg-overlay">
          <div className="image-preview__msg">{props.hoverMsg}</div>
        </div>
      )}
    </div>
  );
}

export function ImageAssetOrUrlPicker(props: {
    studioCtx: StudioCtx;
    value?: ImageAsset | string;
    onPicked: (picked: ImageAsset | string | undefined) => void;
    onCancel?: () => void;
    type: ImageAssetType;
    keepOpen?: boolean;
    hideCancel?: boolean;
  }) {
    const { t: uiT } = useI18n();
    const { studioCtx, onPicked, onCancel, type, value, keepOpen, hideCancel } =
      props;
    const [urlInputError, setUrlInputError] = React.useState<
      string | undefined
    >(undefined);
    const [urlInput, setUrlInput] = React.useState(() =>
      L.isString(value) && !value.startsWith("data:") && value !== placeholderImgUrl()
        ? value
        : "",
    );
    const urlErrorId = React.useId();

    const handleImageUploaded = async (image: ResizableImage, file?: File) => {
      const { imageResult, opts } = await studioCtx.app.withSpinner(
        (async () => {
          return await maybeUploadImage(studioCtx.appCtx, image, type, file);
        })(),
      );
      if (!imageResult || !opts) {
        return;
      }
      return studioCtx.change(() => {
        const asset = studioCtx.siteOps().createImageAsset(imageResult, opts);
        if (asset) {
          onPicked(asset.asset);
        }
        return ok();
      });
    };

    const handleUrlInput = (e: React.FormEvent) => {
      e.preventDefault();

      // Somehow this form submit was triggering the form in ComponentPropModal,
      // even the forms are on separate DOM trees. Perhaps it's because they are
      // on the same React tree? Weird... either way, stopPropagation() fixes it.
      e.stopPropagation();

      if (!isValidUrl(urlInput)) {
        setUrlInputError("Enter a valid URL");
        return;
      }
      setUrlInput("");
      onPicked(urlInput);
    };

    const urlForm = (
      <form className={styles.field} onSubmit={handleUrlInput}>
        <span className={styles.fieldLabel}>{uiT("Image URL")}</span>
        <Space.Compact block>
          <Input
            className={configSearch.input}
            aria-label={uiT("Image URL")}
            aria-invalid={!!urlInputError}
            aria-describedby={urlInputError ? urlErrorId : undefined}
            onFocus={(event) => event.target.select()}
            value={urlInput}
            onChange={(event) => {
              setUrlInput(event.target.value);
              setUrlInputError(undefined);
            }}
            placeholder={uiT("Enter a URL")}
            data-test-id="image-url-input"
            status={urlInputError ? "error" : undefined}
          />
          <Button htmlType="submit" aria-label={uiT("Apply")} icon={<Icon icon={ArrowRightIcon} />} />
        </Space.Compact>
        {urlInputError && (
          <div id={urlErrorId} role="alert" className="validation-error">{uiT("Enter a valid URL")}</div>
        )}
      </form>
    );

    const { rows: assetRows, resolve } = useImageAssetList(studioCtx, "direct");
    const selectedAsset = useSelectedImageAsset(studioCtx, isKnownImageAsset(value) ? value : undefined);
    const selectableAssets = assetRows.filter((asset) => asset.type === type && asset.dataUri);

    return (
      <div className={styles.picker}>
        <div className={styles.header}>
          <span>{uiT(type === ImageAssetType.Icon ? "Icon" : "Image")}</span>
          {onCancel && (!keepOpen || value) && !hideCancel && (
            <Button
              type="text"
              size="small"
              aria-label={uiT("Cancel")}
              onClick={onCancel}
              icon={<Icon icon={CloseIcon} />}
            />
          )}
        </div>
        <div className={styles.fields}>
          {selectableAssets.length > 0 && (
            <div className={styles.field}>
              <div className={styles.fieldLabel}>
                <UiText
                  message="Pick an existing {kind}"
                  values={{
                    kind:
                      type === ImageAssetType.Icon ? (
                        <UiText message={"icon"} />
                      ) : (
                        <UiText message={"image"} />
                      ),
                  }}
                />
              </div>
              <Select
                className={cx(styles.assetSelect, configSearch.select)}
                aria-label={uiT(type === ImageAssetType.Icon ? "Select an icon" : "Select an image")}
                value={selectedAsset?.uuid}
                onChange={(val) =>
                  props.onPicked(
                    resolve(ensure(
                      selectableAssets.find((asset) => asset.uuid === val),
                      "Unexpected undefined asset selected",
                    ).ref),
                  )
                }
                showSearch
                filterOption={(val, option) =>
                  !!(
                    option &&
                    option.name.toLowerCase().includes(val.toLowerCase())
                  )
                }
                optionLabelProp="label"
                suffixIcon={<Icon icon={TriangleBottomIcon} />}
                placeholder={uiT(
                  type === ImageAssetType.Icon
                    ? "Select an icon"
                    : "Select an image",
                )}
                options={selectableAssets.map((asset) => ({
                  value: asset.uuid,
                  label: (
                    <>
                      <ImagePreview
                        className="mr-ch"
                        uri={ensure(
                          asset.dataUri,
                          "Unexpected undefinde dataUri in asset",
                        )}
                        style={{ width: 28, height: 28 }}
                      />
                      <span className={styles.assetName}>{asset.name}</span>
                    </>
                  ),
                  name: asset.name,
                }))}
              />
            </div>
          )}
          <ImageUploader
            onUploaded={handleImageUploaded}
            accept={type === ImageAssetType.Picture ? "image" : "svg"}
          >
            <span className={styles.uploadLabel}>
              <Icon icon={UploadSvgIcon} />
              {uiT("Upload image")}
            </span>
          </ImageUploader>
          <ImagePaster onPasted={handleImageUploaded} />
          {type === ImageAssetType.Picture && urlForm}
          <div className={styles.resources}>
            {type === ImageAssetType.Icon ? (
              <a href="https://www.svgrepo.com/" target="_blank" rel="noreferrer">SVG Repo</a>
            ) : (
              <>
                <a href="https://unsplash.com/" target="_blank" rel="noreferrer">Unsplash</a>
                <span>·</span>
                <a href="https://burst.shopify.com/" target="_blank" rel="noreferrer">Burst</a>
              </>
            )}
          </div>
        </div>
      </div>
    );
}

export function ImageUploader(props: {
  onUploaded: (image: ResizableImage, file: File) => void;
  accept: "image" | "svg";
  children?: React.ReactNode;
  isDisabled?: boolean;
}) {
  const { t: studioUiT } = useI18n();

  const appCtx = useAppCtx();
  const { onUploaded, accept, children, isDisabled } = props;
  const handleUploadChange = async (fileList: FileList | null) => {
    if (fileList === null || fileList.length === 0) {
      return;
    }
    const file = fileList[0];
    const image = await readAndSanitizeFileAsImage(appCtx, file);
    if (!image) {
      notification.error({
        message: studioUiT("Invalid image"),
      });
      return;
    }
    onUploaded(image, file);
  };
  return (
    <FileUploader
      onChange={handleUploadChange}
      accept={accept}
      children={children}
      disabled={isDisabled}
    />
  );
}

export function ImagePaster(props: {
  onPasted: (image: ResizableImage) => void;
}) {
  const { t: studioUiT } = useI18n();

  const appCtx = useAppCtx();
  const [isProcessing, setProcessing] = React.useState(false);
  const ref = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    const handler = spawnWrapper(async (event: ClipboardEvent) => {
      if (!event.clipboardData) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setProcessing(true);
      const image = await ReadableClipboard.fromDataTransfer(
        event.clipboardData,
      ).getImage(appCtx);
      if (image) {
        props.onPasted(image);
      } else {
        notification.error({
          message: studioUiT("Detected no image..."),
        });
      }
      setProcessing(false);
    });
    ref.current?.addEventListener("paste", handler);
    return () => ref.current?.removeEventListener("paste", handler);
  }, [props.onPasted, ref, isProcessing]);

  return (
    <textarea
      ref={ref}
      className="textbox image-paster"
      aria-label={studioUiT("or paste a new image from clipboard")}
      placeholder={
        isProcessing
          ? studioUiT("Pasting...")
          : studioUiT("Select and paste here")
      }
      value=""
      disabled={isProcessing}
    />
  );
}
