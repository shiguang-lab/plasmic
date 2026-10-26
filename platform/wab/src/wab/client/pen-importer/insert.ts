import { uploadSvgImage } from "@/wab/client/components/canvas/site-ops";
import {
  ImageAssetOpts,
  ResizableImage,
  maybeUploadImage,
  parseImage,
} from "@/wab/client/dom-utils";
import type { PenDesign, PenLayer } from "@/wab/client/pen-importer/types";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { unwrap } from "@/wab/commons/neverthrow-utils";
import { FrameViewMode } from "@/wab/shared/Arenas";
import { RSH } from "@/wab/shared/RuleSetHelpers";
import { VariantTplMgr } from "@/wab/shared/VariantTplMgr";
import { extractUsedFontsFromComponents } from "@/wab/shared/codegen/fonts";
import { toJsIdentifier } from "@/wab/shared/codegen/util";
import { assert, ensure, uniqueName } from "@/wab/shared/common";
import {
  GlobalVariantFrame,
  RootComponentVariantFrame,
} from "@/wab/shared/component-frame";
import { ComponentType } from "@/wab/shared/core/components";
import { ImageAssetType } from "@/wab/shared/core/image-asset-type";
import { mkImageAssetRef } from "@/wab/shared/core/image-assets";
import {
  TplTagType,
  mkTplTagX,
  trackComponentRoot,
} from "@/wab/shared/core/tpls";
import { ImageAsset, RawText, TplNode } from "@/wab/shared/model/classes";
import { runInAction } from "mobx";
import { ok } from "neverthrow";

export type PenUploads = Map<
  string,
  { imageResult: ResizableImage; opts: ImageAssetOpts }
>;
export async function uploadPenAssets(
  studioCtx: StudioCtx,
  design: PenDesign,
): Promise<PenUploads> {
  const uploads: PenUploads = new Map();
  for (const asset of design.assets) {
    const result = asset.svg
      ? await uploadSvgImage(
          asset.svg,
          true,
          asset.width ?? 24,
          asset.height ?? 24,
          studioCtx.appCtx,
          asset.name,
        )
      : await maybeUploadImage(
          studioCtx.appCtx,
          ensure(
            await parseImage(studioCtx.appCtx, asset.data),
            `Invalid Pen image: ${asset.name}`,
          ),
          ImageAssetType.Picture,
          asset.name,
        );
    uploads.set(asset.id, {
      imageResult: ensure(result.imageResult, "Pen asset upload failed"),
      opts: ensure(result.opts, "Pen asset upload failed"),
    });
  }
  return uploads;
}

export async function insertPenDesign(
  studioCtx: StudioCtx,
  design: PenDesign,
  uploads: PenUploads,
  name: string,
) {
  assert(
    studioCtx.isAtTip &&
      studioCtx.canEditProject() &&
      studioCtx.canEditBranch(),
    "The project is no longer editable",
  );
  assert(
    Number.isFinite(design.width) &&
      design.width > 0 &&
      Number.isFinite(design.height) &&
      design.height > 0,
    "Invalid Pen canvas dimensions",
  );
  const inserted = unwrap(
    await studioCtx.change(() => {
      const arena = studioCtx.tplMgr().addArena(name);
      const component = studioCtx
        .tplMgr()
        .addComponent({ type: ComponentType.Frame });
      const frame = studioCtx
        .tplMgr()
        .addNewMixedArenaFrame(arena, name, component, {
          width: design.width,
          height: design.height,
          insertPt: studioCtx.currentViewportMidpt(),
        });
      const vtm = new VariantTplMgr(
        [new RootComponentVariantFrame(frame)],
        studioCtx.site,
        studioCtx.tplMgr(),
        new GlobalVariantFrame(studioCtx.site, frame),
      );
      const assets = new Map<string, ImageAsset>();
      uploads.forEach((upload, id) =>
        assets.set(
          id,
          studioCtx.siteOps().createImageAsset(upload.imageResult, upload.opts)
            .asset,
        ),
      );
      const names: string[] = [];
      const convert = (layer: PenLayer): TplNode => {
        const asciiName = layer.name.replace(/[^\x20-\x7e]/g, " ");
        const label =
          toJsIdentifier(asciiName, { capitalizeFirst: true }) ||
          (layer.text !== undefined
            ? "Text"
            : layer.asset
              ? "Icon"
              : "Container");
        const nodeName = uniqueName(names, label);
        names.push(nodeName);
        const tpl = layer.asset
          ? vtm.mkTplImage({
              asset: ensure(
                assets.get(layer.asset),
                "Missing Pen vector asset",
              ),
              name: nodeName,
            })
          : mkTplTagX(
              "div",
              {
                name: nodeName,
                type:
                  layer.text !== undefined ? TplTagType.Text : TplTagType.Other,
              },
              layer.children.map(convert),
            );
        const vs = vtm.ensureBaseVariantSetting(tpl);
        for (const [key, value] of Object.entries(layer.styles)) {
          const style = value.replace(/__PEN_ASSET_\d+__/g, (id) =>
            mkImageAssetRef(
              ensure(assets.get(id), "Missing Pen background image"),
            ),
          );
          RSH(vs.rs, tpl).set(key, style);
        }
        if (layer.text !== undefined)
          {vs.text = new RawText({ text: layer.text, markers: [] });}
        return tpl;
      };
      component.tplTree = convert(design.root);
      trackComponentRoot(component);
      frame.viewMode = FrameViewMode.Stretch;
      const rootStyle = RSH(
        vtm.ensureBaseVariantSetting(component.tplTree).rs,
        component.tplTree,
      );
      rootStyle.set("width", "stretch");
      rootStyle.set("height", "stretch");
      extractUsedFontsFromComponents(studioCtx.site, [component]).forEach(
        (font) => studioCtx.fontManager.useFont(studioCtx, font.fontFamily),
      );
      return ok({ arena, frame });
    }),
  );
  runInAction(() => {
    studioCtx.switchToArena(inserted.arena);
    studioCtx.setStudioFocusOnFrame({ frame: inserted.frame, autoZoom: true });
  });
}
