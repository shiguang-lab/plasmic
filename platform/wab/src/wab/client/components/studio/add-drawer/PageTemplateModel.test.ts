import { SiteOps } from "@/wab/client/components/canvas/site-ops";
import { createAddPageTemplate } from "@/wab/client/components/studio/add-drawer/AddDrawer";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { Bundler } from "@/wab/shared/bundler";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { ImageAssetType } from "@/wab/shared/core/image-asset-type";
import { createSite } from "@/wab/shared/core/sites";
import {
  flattenTpls,
  mkTplInlinedText,
  mkTplTagX,
  TplTagType,
} from "@/wab/shared/core/tpls";
import { Pt } from "@/wab/shared/geom";
import {
  ImageAssetRef,
  isKnownImageAssetRef,
  isKnownRawText,
  isKnownSite,
} from "@/wab/shared/model/classes";
import { ensurePageOverviewArena } from "@/wab/shared/page-overview";
import { assertSiteInvariants } from "@/wab/shared/site-invariants";
import { TplMgr } from "@/wab/shared/TplMgr";
import { $$$ } from "@/wab/shared/TplQuery";
import { getBaseVariant } from "@/wab/shared/Variants";

it("imports real template text, image and styles into a Page, and persists the shared artboard reference", () => {
  const source = createSite();
  const sourceMgr = new TplMgr({ site: source });
  const template = sourceMgr.addComponent({
    name: "CustomerPage",
    type: ComponentType.Page,
  });
  const title = mkTplInlinedText("客户管理", [getBaseVariant(template)], "h1");
  title.vsettings[0].rs.values.color = "#1677ff";
  const asset = sourceMgr.addImageAsset({
    name: "BrandLogo",
    type: ImageAssetType.Picture,
    dataUri: "https://example.com/brand.png",
    width: 64,
    height: 64,
  });
  const image = mkTplTagX("img", {
    type: TplTagType.Image,
    baseVariant: getBaseVariant(template),
    attrs: { src: new ImageAssetRef({ asset }) },
  });
  $$$(template.tplTree).append(title);
  $$$(template.tplTree).append(image);
  expect(isKnownImageAssetRef(image.vsettings[0].attrs.src)).toBe(true);
  const site = createSite();
  const mgr = new TplMgr({ site });
  mgr.addComponent({ name: "ExistingPage", type: ComponentType.Page });
  const arena = ensurePageOverviewArena(mgr);
  const firstFrame = arena.children[0];
  firstFrame.left = 120;
  firstFrame.top = 80;
  const deps: Pick<
    StudioCtx["projectDependencyManager"],
    "plumeSite" | "syncDirectDeps"
  > = { plumeSite: undefined, syncDirectDeps: vi.fn() };
  const fonts: Pick<StudioCtx["fontManager"], "useFont"> = { useFont: vi.fn() };
  const ctx: Partial<StudioCtx> = {
    site,
    currentArena: arena,
    canSave: () => true,
    tplMgr: () => mgr,
    addComponent: (name) =>
      mgr.addComponent({ name, type: ComponentType.Page }),
    projectDependencyManager: deps as StudioCtx["projectDependencyManager"],
    fontManager: fonts as StudioCtx["fontManager"],
    currentViewportMidpt: () => new Pt(600, 400),
    setStudioFocusOnFrame: vi.fn<StudioCtx["setStudioFocusOnFrame"]>(),
  };
  const sc = ctx as StudioCtx;
  ctx.siteOps = () => new SiteOps(sc);
  const item = createAddPageTemplate({
    type: "insertable-templates-item",
    componentName: template.name,
    projectId: "source-template",
  });
  expect(
    item.factory(sc, {
      site: source,
      component: template,
      projectId: "source-template",
      screenVariant: undefined,
      hostLessDependencies: {},
      resolution: {},
    }),
  ).toBe(arena);
  const page = ensure(
    site.components.find((c) => c.name === "CustomerPage"),
    "Missing created page",
  );
  const nodes = flattenTpls(page.tplTree);
  const importedText = nodes
    .flatMap((node) => node.vsettings.map((vs) => vs.text))
    .find(isKnownRawText);
  expect(importedText?.text).toBe("客户管理");
  expect(
    nodes.find((node) => node.vsettings.some((vs) => vs.text === importedText))
      ?.vsettings[0].rs.values.color,
  ).toBe("#1677ff");
  const importedImage = nodes
    .flatMap((node) => node.vsettings.flatMap((vs) => Object.values(vs.attrs)))
    .find(isKnownImageAssetRef);
  expect(importedImage).toBeDefined();
  expect(importedImage?.asset).toBe(site.imageAssets[0]);
  expect(importedImage?.asset).not.toBe(asset);
  expect(site.imageAssets[0].dataUri).toBe(asset.dataUri);
  expect(page.tplTree.uuid).not.toBe(template.tplTree.uuid);
  expect(arena.children).toHaveLength(2);
  expect(arena.children[1].container.component).toBe(page);
  expect(firstFrame.left).toBe(120);
  expect(firstFrame.top).toBe(80);
  assertSiteInvariants(site);
  const saved = new Bundler().bundle(site, "imported-page", "test-version");
  const reopened = new Bundler().unbundle(saved, "imported-page");
  expect(isKnownSite(reopened)).toBe(true);
  if (!isKnownSite(reopened)) {
    throw new Error("Expected saved Site");
  }
  const restoredPage = reopened.components.find(
    (c) => c.name === "CustomerPage",
  );
  expect(
    reopened.arenas.find((a) => a.name === arena.name)?.children[1].container
      .component,
  ).toBe(restoredPage);
  const restoredArena = ensure(
    reopened.arenas.find((a) => a.name === arena.name),
    "Saved arena",
  );
  expect(restoredArena.children[0].left).toBe(120);
  expect(restoredArena.children[0].top).toBe(80);
  expect(source.components).toHaveLength(1);
  expect(source.imageAssets[0]).toBe(asset);
});
