import { FreeBoxInsertion } from "@/wab/client/Dnd";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { COPILOT_TOOLS } from "@/wab/client/copilot";
import { Bundler } from "@/wab/shared/bundler";
import { ensure } from "@/wab/shared/common";
import {
  isFrameComponent,
  isPageComponent,
} from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { flattenTpls } from "@/wab/shared/core/tpls";
import { ValTag } from "@/wab/shared/core/val-nodes";
import { Box, Pt } from "@/wab/shared/geom";
import {
  ensureKnownSite,
  ensureKnownTplTag,
  isKnownRawText,
  isKnownTplTag,
} from "@/wab/shared/model/classes";
import { vi } from "vitest";

vi.mock("@/wab/client/coords", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/wab/client/coords")>()),
  clientToFramePt: (pt: Pt) => pt,
}));
vi.mock("@/wab/client/dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/wab/client/dom")>()),
  getPaddingRect: () => ({ left: 0, top: 0, width: 1200, height: 800 }),
}));

function fixture() {
  const site = createSite();
  site.arenas.splice(0);
  const { studioCtx } = fakeStudioCtx({ site });
  studioCtx.createViewStateUndoRecord();
  const call = async (name: string, input: Record<string, unknown> = {}) =>
    JSON.parse(
      await ensure(COPILOT_TOOLS[name], "Tool missing").execute(
        studioCtx,
        input,
      ),
    );
  return {
    studioCtx,
    call,
    importPage: (input: Record<string, unknown>) =>
      call("importWebPage", { projectId: studioCtx.siteInfo.id, ...input }),
  };
}

describe("captured browser imports", () => {
  it("creates an independent editable artboard and its content in a single undo transaction", async () => {
    const { studioCtx, call, importPage } = fixture();
    const history = studioCtx.undoLog._log.length;
    const result = await importPage({
      html: '<section style="display:flex;padding:24px"><h1>Imported content</h1><p>Edit me</p></section>',
      width: 1280,
      height: 400,
    });
    const page = ensure(
      studioCtx.site.components.find((c) => c.uuid === result.componentUuid),
      "Page missing",
    );
    expect(page.name).toBe("");
    expect(isFrameComponent(page)).toBe(true);
    expect(studioCtx.site.pageArenas).toHaveLength(0);
    expect(studioCtx.site.componentArenas).toHaveLength(0);
    expect(result.elementUuids).toHaveLength(1);
    expect(
      flattenTpls(page.tplTree).some(
        (node) => node.uuid === result.elementUuids[0],
      ),
    ).toBe(true);
    const frame = studioCtx.site.arenas[0].children[0];
    expect(frame.uuid).toBe(result.frameUuid);
    expect(frame.name).toBe("ImportedPage");
    expect(frame.width).toBe(1280);
    expect(frame.height).toBe(400);
    expect(studioCtx.site.arenas[0].name).toBe(result.canvasName);
    expect(studioCtx.undoLog._log.length).toBe(history + 1);
    await call("undo");
    expect(studioCtx.site.components).toHaveLength(0);
    expect(studioCtx.site.pageArenas).toHaveLength(0);
    expect(studioCtx.site.arenas).toHaveLength(0);
  });

  it("imports every selection into its own frame and undo preserves earlier imports", async () => {
    const { studioCtx, call, importPage } = fixture();
    const first = await importPage({ html: "<p>Original</p>" });
    const page = ensure(
      studioCtx.site.components.find((c) => c.uuid === first.componentUuid),
      "Page missing",
    );
    const before = flattenTpls(page.tplTree).map((node) => node.uuid);
    const result = await importPage({
      html: "<p>Appended</p>",
      name: "ImportedSection",
      width: 180,
      height: 72,
    });
    expect(result.componentUuid).not.toBe(page.uuid);
    expect(result.frameUuid).not.toBe(first.frameUuid);
    expect(result.canvasName).toBe(first.canvasName);
    expect(studioCtx.site.components).toHaveLength(2);
    expect(studioCtx.site.arenas[0].children).toHaveLength(2);
    const [left, right] = studioCtx.site.arenas[0].children;
    expect(right.left).toBeGreaterThanOrEqual(
      ensure(left.left, "Artboard position missing") + left.width,
    );
    expect(right.width).toBe(180);
    await call("undo");
    expect(flattenTpls(page.tplTree).map((node) => node.uuid)).toEqual(before);
    expect(studioCtx.site.arenas[0].children).toHaveLength(1);
  });

  it("uses the current mixed canvas even when a page container is selected", async () => {
    const { studioCtx, call, importPage } = fixture();
    await call("createComponent", { name: "ExistingPage", type: "page" });
    await call("createCanvas", { name: "Workspace" });
    const page = ensure(
      studioCtx.site.components.find((c) => c.name === "ExistingPage"),
      "Source page missing",
    );
    const canvas = studioCtx.site.arenas[0];
    studioCtx.currentArena = canvas;
    const result = await importPage({ html: "<section>Independent</section>" });
    expect(result.canvasName).toBe("Workspace");
    expect(canvas.children).toHaveLength(1);
    expect(flattenTpls(page.tplTree)).toHaveLength(1);
    expect(studioCtx.site.pageArenas).toHaveLength(1);
  });

  it("creates and reuses a free canvas with a reference to the source page", async () => {
    const { studioCtx, call, importPage } = fixture();
    await call("createComponent", { name: "ExistingPage", type: "page" });
    const pageArena = studioCtx.site.pageArenas[0];
    studioCtx.currentArena = pageArena;
    const result = await importPage({ html: "<section>Independent</section>" });
    const canvas = studioCtx.site.arenas[0];
    expect(canvas.children).toHaveLength(2);
    expect(canvas.children[0].container.component).toBe(pageArena.component);
    expect(studioCtx.site.pageArenas).toHaveLength(1);
    const second = await importPage({ html: "<section>Another</section>" });
    expect(second.canvasName).toBe(result.canvasName);
    expect(canvas.children).toHaveLength(3);
    await call("undo");
    await call("undo");
    expect(studioCtx.site.arenas).toHaveLength(0);
    expect(studioCtx.site.components).toEqual([pageArena.component]);
  });

  it("preserves the source arena captured before a browser read", async () => {
    const { studioCtx, call, importPage } = fixture();
    await call("createCanvas", { name: "Source" });
    await call("createCanvas", { name: "Other" });
    studioCtx.currentArena = studioCtx.site.arenas[1];
    const result = await importPage({
      html: "<p>Captured</p>",
      sourceArena: { id: "Source", type: "custom" },
    });
    expect(result.canvasName).toBe("Source");
    expect(studioCtx.site.arenas[1].children).toHaveLength(0);
  });

  it("uses an associated canvas from page detail without adding another page reference", async () => {
    const { studioCtx, call, importPage } = fixture();
    await call("createComponent", { name: "ExistingPage", type: "page" });
    await call("createCanvas", { name: "Workspace" });
    const page = studioCtx.site.pageArenas[0].component;
    await call("createArtboard", {
      canvasName: "Workspace",
      componentUuid: page.uuid,
      width: 1280,
      height: 800,
    });
    studioCtx.currentArena = studioCtx.site.pageArenas[0];
    const result = await importPage({ html: "<section>Independent</section>" });
    expect(result.canvasName).toBe("Workspace");
    expect(studioCtx.site.arenas[0].children).toHaveLength(2);
  });

  it("keeps external expression text literal and strips registrations, state bindings and handlers", async () => {
    const { studioCtx, importPage } = fixture();
    const literal = "{{ globalThis.__webImportExecuted = true }}";
    const result = await importPage({
      html: `<plasmic-component data-plasmic-component="Missing" data-props='{"onClick":"{{ alert(1) }}"}' data-repeat="{{ [1] }}" onclick="alert(1)"><p title="{{ alert(1) }}">${literal}</p></plasmic-component>`,
    });
    const page = ensure(
      studioCtx.site.components.find((c) => c.uuid === result.componentUuid),
      "Page missing",
    );
    const nodes = flattenTpls(page.tplTree);
    expect(nodes.every(isKnownTplTag)).toBe(true);
    const texts = nodes.flatMap((node) =>
      node.vsettings.flatMap((vs) =>
        isKnownRawText(vs.text) ? [vs.text.text] : [],
      ),
    );
    expect(texts).toContain(literal);
    for (const node of nodes) {
      for (const vs of node.vsettings) {
        expect(vs.dataRep ?? null).toBeNull();
        expect(vs.dataCond ?? null).toBeNull();
        expect(vs.attrs).not.toHaveProperty("onClick");
        expect(vs.attrs).not.toHaveProperty("onclick");
      }
    }
  });

  it("moves content into a page, prunes the empty scratch frame, and undoes both changes together", async () => {
    const { studioCtx, call, importPage } = fixture();
    await call("createComponent", { name: "ExistingPage", type: "page" });
    studioCtx.currentArena = studioCtx.site.pageArenas[0];
    const imported = await importPage({
      html: '<section style="padding:24px;background-color:rgb(20, 40, 60)"><p>Drag me</p></section>',
    });
    const canvas = studioCtx.site.arenas[0];
    studioCtx.currentArena = canvas;
    const source = ensure(
      studioCtx.tryGetViewCtxForFrame(canvas.children[1]),
      "Source frame missing",
    );
    const destination = ensure(
      studioCtx.tryGetViewCtxForFrame(canvas.children[0]),
      "Destination frame missing",
    );
    const root = ensureKnownTplTag(destination.currentComponent().tplTree);
    const node = ensure(
      flattenTpls(source.currentComponent().tplTree).find(
        (tpl) => tpl.uuid === imported.elementUuids[0],
      ),
      "Imported root missing",
    );
    vi.spyOn(destination.getViewOps(), "getTplDom").mockReturnValue(undefined);
    vi.spyOn(destination, "selectNewTpl").mockImplementation(() => undefined);
    vi.spyOn(studioCtx, "setStudioFocusOnFrameContents").mockImplementation(
      () => undefined,
    );
    const selectable = new ValTag({
      tpl: root,
      children: [],
      className: "",
      key: "root",
      fullKey: "root",
      frameUid: 1,
      fibers: [],
      parent: undefined,
      valOwner: undefined,
      slotInfo: undefined,
    });
    const box = new Box(0, 0, 1200, 800);
    const insertion = new FreeBoxInsertion(
      {
        selectable,
        dom: document.createElement("div"),
        box,
        paddingBox: box,
        boxInScaler: box,
        flowDir: "vertical",
        isInFlex: false,
        isInFlexReverse: false,
        acceptsChildren: true,
        acceptsNeighbors: true,
        measuredGrid: undefined,
        containerType: "flex-column",
      },
      true,
      new Pt(30, 40),
    );
    const history = studioCtx.undoLog._log.length;
    const clip = { ...source.getViewOps().createTplClip(node), origNode: node };
    await studioCtx.changeUnsafe(() => {
      expect(
        destination
          .getViewOps()
          .moveFreeFrameContent(source, [clip], insertion),
      ).toBe(true);
    });
    expect(root.children).toHaveLength(1);
    expect(root.children[0].uuid).not.toBe(node.uuid);
    expect(root.children[0].vsettings[0].rs.values["padding-top"]).toBe("24px");
    expect(studioCtx.site.components).not.toContain(source.currentComponent());
    expect(canvas.children).toHaveLength(1);
    expect(studioCtx.undoLog._log.length).toBe(history + 1);
    await call("undo");
    expect(root.children).toHaveLength(0);
    expect(canvas.children).toHaveLength(2);
    expect(studioCtx.site.components).toContain(source.currentComponent());
    expect(flattenTpls(source.currentComponent().tplTree)).toContain(node);
  });

  it.each(["component", "page"] as const)(
    "converts a scratch artboard to a %s and round-trips its persisted model",
    async (type) => {
      const { studioCtx, call, importPage } = fixture();
      const imported = await importPage({
        html: "<section><p>Reusable content</p></section>",
      });
      const canvas = studioCtx.site.arenas[0];
      studioCtx.currentArena = canvas;
      const vc = ensure(
        studioCtx.tryGetViewCtxForFrame(canvas.children[0]),
        "Imported frame missing",
      );
      await vc.getViewOps().convertFrameToComponent("ImportedContent", type);
      await studioCtx.changeUnsafe(() => undefined);
      const component = vc.currentComponent();
      expect(isFrameComponent(component)).toBe(false);
      expect(isPageComponent(component)).toBe(type === "page");
      expect(component.name).toBe("ImportedContent");
      expect(
        type === "page"
          ? studioCtx.site.pageArenas
          : studioCtx.site.componentArenas,
      ).toHaveLength(1);
      const bundled = new Bundler().bundle(studioCtx.site, "project", "test");
      const reopened = ensureKnownSite(
        new Bundler().unbundle(JSON.parse(JSON.stringify(bundled)), "project"),
      );
      const saved = ensure(
        reopened.components.find((c) => c.uuid === imported.componentUuid),
        "Reopened component missing",
      );
      expect(saved.name).toBe("ImportedContent");
      expect(reopened.arenas[0].children[0].container.component).toBe(saved);
      expect(flattenTpls(saved.tplTree).map((tpl) => tpl.uuid)).toContain(
        imported.elementUuids[0],
      );
      await call("undo");
      expect(isFrameComponent(component)).toBe(true);
      expect(component.name).toBe("");
    },
  );

  it("rejects a changed project or empty source without leaving an empty artboard or canvas", async () => {
    const { studioCtx, importPage } = fixture();
    await expect(
      importPage({
        projectId: "another-project",
        html: "<p>Wrong project</p>",
      }),
    ).rejects.toThrow("no longer open");
    await expect(
      importPage({ html: "<script>alert(1)</script>" }),
    ).rejects.toThrow();
    expect(studioCtx.site.components).toHaveLength(0);
    expect(studioCtx.site.pageArenas).toHaveLength(0);
    expect(studioCtx.site.arenas).toHaveLength(0);
  });
});
