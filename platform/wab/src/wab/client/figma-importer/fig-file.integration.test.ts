import { fig, node } from "@/wab/__testonly__/fig-file";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { denormalizeFigmaData, insertFigmaData } from "@/wab/client/figma";
import { FigFile } from "@/wab/client/figma-importer/fig-file";
import { DomActions, ViewportCtx } from "@/wab/client/studio-ctx/ViewportCtx";
import { getArenaFrames } from "@/wab/shared/Arenas";
import { Bundler } from "@/wab/shared/bundler";
import { ensure } from "@/wab/shared/common";
import { flattenTpls } from "@/wab/shared/core/tpls";
import { Box, Pt } from "@/wab/shared/geom";
import { Site, isKnownTplTag } from "@/wab/shared/model/classes";
import { runInAction, when } from "mobx";
import { mock } from "vitest-mock-extended";

vi.mock("@/wab/client/components/coding/FullCodeEditor.tsx", () => ({
  FullCodeEditor: () => null,
  CodePreview: () => null,
}));

function data() {
  const file = new FigFile();
  file.read(
    fig([
      node(1, 0, "CANVAS", { name: "Desktop" }),
      node(2, 1, "FRAME", {
        name: "Card",
        size: { x: 320, y: 100 },
        stackMode: "HORIZONTAL",
        stackSpacing: 12,
      }),
      node(3, 2, "TEXT", {
        name: "Title",
        size: { x: 100, y: 20 },
        fontSize: 18,
        textData: { characters: "Editable title" },
        fillPaints: [{ type: "SOLID", color: { r: 0, g: 0, b: 0, a: 1 } }],
      }),
    ]),
  );
  return {
    ...denormalizeFigmaData(file.convert("0:1")),
    uploadedImages: new Map(),
    nodeImages: new Map(),
  };
}

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

it("inserts editable layers into the Studio model, survives save/reopen, and is undone in one step", async () => {
  const studioCtx = await setup();
  await studioCtx.changeUnsafe(() => studioCtx.switchToArena(null));
  const before = {
    arenas: studioCtx.site.arenas.length,
    components: studioCtx.site.components.length,
  };
  try {
    expect(
      await insertFigmaData(data(), { studioCtx }, false, "Desktop"),
    ).toEqual({ handled: true, success: true });
    const frame = ensure(
      getArenaFrames(studioCtx.currentArena)[0],
      "Expected imported frame",
    );
    const component = frame.container.component;
    expect(frame.name).toBe("Desktop");
    expect(component.name).toBe("");
    const texts = (site: Site) =>
      site.components
        .flatMap((c) => flattenTpls(c.tplTree))
        .filter(isKnownTplTag)
        .flatMap((tpl) => tpl.vsettings.map((vs) => vs.text));
    expect(texts(studioCtx.site)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: "Editable title" }),
      ]),
    );
    const bundle = new Bundler().bundle(studioCtx.site, "fig-import", "");
    const reopened = new Bundler().unbundle(
      JSON.parse(JSON.stringify(bundle)),
      "fig-reopened",
    ) as Site;
    expect(texts(reopened)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: "Editable title" }),
      ]),
    );
    await studioCtx.undo();
    expect(studioCtx.site.arenas).toHaveLength(before.arenas);
    expect(studioCtx.site.components).toHaveLength(before.components);
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 10));
    studioCtx.viewportCtx?.dispose();
    studioCtx.dispose();
  }
});

it("rolls back an insertion with no convertible layers, leaving no empty canvas or assets", async () => {
  const studioCtx = await setup();
  const bundler = new Bundler();
  const before = bundler.bundle(studioCtx.site, "fig-import", "");
  try {
    await expect(
      insertFigmaData(
        { ...data(), nodes: [] },
        { studioCtx },
        false,
        "Desktop",
      ),
    ).rejects.toThrow();
    expect(bundler.bundle(studioCtx.site, "fig-import", "").map).toEqual(
      before.map,
    );
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 10));
    studioCtx.viewportCtx?.dispose();
    studioCtx.dispose();
  }
});
