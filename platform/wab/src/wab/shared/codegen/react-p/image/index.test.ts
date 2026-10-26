import { maybeMakePlasmicImgSrc } from "@/wab/shared/codegen/react-p/image";
import { ImageAssetType } from "@/wab/shared/core/image-asset-type";
import { DEVFLAGS } from "@/wab/shared/devflags";
import { ImageAsset } from "@/wab/shared/model/classes";
import { mock } from "vitest-mock-extended";

it("preserves the uploaded asset origin in the canvas and serialized image source", () => {
  const src =
    "https://plasmic-studio.shiguanglab.com/assets/4af2ee2780865f194dcf0ac761833eaf.jpg";
  const asset = mock<ImageAsset>({
    type: ImageAssetType.Picture,
    dataUri: src,
    width: 800,
    height: 900,
  });
  expect(
    maybeMakePlasmicImgSrc(asset, {
      component: null,
      inStudio: true,
      projectFlags: { ...DEVFLAGS, usePlasmicImg: true },
    }),
  ).toMatchObject({ src, fullWidth: 800, fullHeight: 900 });
});
