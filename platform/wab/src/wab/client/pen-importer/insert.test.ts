import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { ResizableImage } from "@/wab/client/dom-utils";
import { insertPenDesign } from "@/wab/client/pen-importer/insert";
import { PenFileReader } from "@/wab/client/pen-importer/reader";
import { DomActions, ViewportCtx } from "@/wab/client/studio-ctx/ViewportCtx";
import { getArenaFrames } from "@/wab/shared/Arenas";
import { Bundler } from "@/wab/shared/bundler";
import { ensure } from "@/wab/shared/common";
import { ImageAssetType } from "@/wab/shared/core/image-asset-type";
import { flattenTpls } from "@/wab/shared/core/tpls";
import { asSvgDataUrl } from "@/wab/shared/data-urls";
import { Box, Pt } from "@/wab/shared/geom";
import { Site, isKnownTplTag } from "@/wab/shared/model/classes";
import { strToU8 } from "fflate";
import { runInAction, when } from "mobx";
import { mock } from "vitest-mock-extended";

vi.mock("@/wab/client/components/coding/FullCodeEditor.tsx", () => ({
  FullCodeEditor: () => null,
  CodePreview: () => null,
}));

async function setup() {
  const { studioCtx } = fakeStudioCtx();
  runInAction(() => {
    studioCtx.viewportCtx = new ViewportCtx({
      dom: mock<DomActions>(),
      initialArena: null,
      initialClipperBox: new Box(0, 0, 1024, 768),
      initialClipperScroll: Pt.zero(),
    });
  });
  await when(() => studioCtx.initialRouteReady);
  vi.spyOn(studioCtx, "tryZoomToFitArena").mockImplementation(() => undefined);
  vi.spyOn(studioCtx, "tryGetViewCtxForFrame").mockReturnValue(undefined);
  await studioCtx.changeUnsafe(() => undefined);
  return studioCtx;
}
async function design() {
  const reader = new PenFileReader();
  reader.read([
    {
      path: "design.pen",
      bytes: strToU8(
        JSON.stringify({
          version: "2.21",
          children: [
            {
              type: "frame",
              id: "root",
              width: 800,
              height: 600,
              layout: "vertical",
              children: [
                {
                  type: "text",
                  id: "label",
                  name: "Heading",
                  content: "可编辑内容",
                  fontSize: 18,
                  fill: "#123456",
                },
              ],
            },
          ],
        }),
      ),
    },
  ]);
  return reader.convert("design.pen", "root");
}

it("inserts a separate Pen canvas, persists native editable content, and undoes the import in one step", async () => {
  const ctx = await setup();
  const before = {
    arenas: ctx.site.arenas.length,
    components: ctx.site.components.length,
  };
  try {
    await insertPenDesign(ctx, await design(), new Map(), "导入设计");
    const frame = ensure(
      getArenaFrames(ctx.currentArena)[0],
      "Expected Pen canvas",
    );
    expect(frame.name).toBe("导入设计");
    expect(frame.width).toBe(800);
    const texts = (site: Site) =>
      site.components
        .flatMap((c) => flattenTpls(c.tplTree))
        .filter(isKnownTplTag)
        .flatMap((tpl) => tpl.vsettings.map((vs) => vs.text));
    expect(texts(ctx.site)).toEqual(
      expect.arrayContaining([expect.objectContaining({ text: "可编辑内容" })]),
    );
    const bundle = new Bundler().bundle(ctx.site, "pen-import", "");
    const reopened = new Bundler().unbundle(
      JSON.parse(JSON.stringify(bundle)),
      "pen-reopened",
    ) as Site;
    expect(texts(reopened)).toEqual(
      expect.arrayContaining([expect.objectContaining({ text: "可编辑内容" })]),
    );
    await ctx.undo();
    expect(ctx.site.arenas).toHaveLength(before.arenas);
    expect(ctx.site.components).toHaveLength(before.components);
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 10));
    ctx.viewportCtx?.dispose();
    ctx.dispose();
  }
});

it("rolls back failed conversion including its newly created canvas and component", async () => {
  const ctx = await setup();
  const beforeArena = ctx.currentArena;
  const bundler = new Bundler();
  const before = bundler.bundle(ctx.site, "pen-import", "");
  const broken = await design();
  broken.root.children[0].asset = "missing";
  try {
    await expect(
      insertPenDesign(ctx, broken, new Map(), "Failed import"),
    ).rejects.toThrow(/Missing Pen vector asset/);
    expect(bundler.bundle(ctx.site, "pen-import", "").map).toEqual(before.map);
    expect(ctx.currentArena).toBe(beforeArena);
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 10));
    ctx.viewportCtx?.dispose();
    ctx.dispose();
  }
});

it("registers vector and background assets in the import transaction and removes them on undo", async () => {
  const ctx = await setup();
  const before = ctx.site.imageAssets.length;
  const data = await design();
  data.root.styles.background = "__PEN_ASSET_1__ center / cover no-repeat";
  data.root.children.push({
    name: "CheckIcon",
    styles: { width: "16px", height: "16px" },
    asset: "__PEN_ASSET_0__",
    children: [],
  });
  const uploads = new Map([
    [
      "__PEN_ASSET_0__",
      {
        imageResult: new ResizableImage(
          asSvgDataUrl(
            '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><path d="M0 0L16 16" /></svg>',
          ),
          16,
          16,
          1,
        ),
        opts: { type: ImageAssetType.Icon, name: "Check" },
      },
    ],
    [
      "__PEN_ASSET_1__",
      {
        imageResult: new ResizableImage(
          "data:image/png;base64,iVBORw0KGgo=",
          1,
          1,
          1,
        ),
        opts: { type: ImageAssetType.Picture, name: "Background" },
      },
    ],
  ]);
  try {
    await insertPenDesign(ctx, data, uploads, "带资源的画布");
    expect(ctx.site.imageAssets).toHaveLength(before + 2);
    const component = ensure(
      getArenaFrames(ctx.currentArena)[0],
      "Expected Pen canvas",
    ).container.component;
    const tags = flattenTpls(component.tplTree).filter(isKnownTplTag);
    expect(tags.some((tpl) => tpl.tag === "svg")).toBe(true);
    expect(tags[0].vsettings[0].rs.values.background).toMatch(
      /^var\(--image-.+\) center \/ cover no-repeat$/,
    );
    await ctx.undo();
    expect(ctx.site.imageAssets).toHaveLength(before);
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 10));
    ctx.viewportCtx?.dispose();
    ctx.dispose();
  }
});
