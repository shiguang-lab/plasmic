import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { COPILOT_TOOLS } from "@/wab/client/copilot";
import { ensure } from "@/wab/shared/common";
import { getComponentArenaBaseFrame } from "@/wab/shared/component-arenas";
import { createSite } from "@/wab/shared/core/sites";
import { flattenTpls } from "@/wab/shared/core/tpls";
import { isKnownRawText, isKnownTplTag } from "@/wab/shared/model/classes";

function fixture() {
  const { studioCtx } = fakeStudioCtx({ site: createSite() });
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
  it("creates an editable page and its imported content in a single undo transaction", async () => {
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
    expect(page.name).toBe("ImportedPage");
    expect(result.elementUuids).toHaveLength(1);
    expect(
      flattenTpls(page.tplTree).some(
        (node) => node.uuid === result.elementUuids[0],
      ),
    ).toBe(true);
    expect(getComponentArenaBaseFrame(studioCtx.site.pageArenas[0]).width).toBe(
      1280,
    );
    expect(
      getComponentArenaBaseFrame(studioCtx.site.pageArenas[0]).height,
    ).toBe(400);
    expect(studioCtx.undoLog._log.length).toBe(history + 1);
    await call("undo");
    expect(studioCtx.site.components).toHaveLength(0);
    expect(studioCtx.site.pageArenas).toHaveLength(0);
  });

  it("appends to an explicit local destination and undo leaves its existing content intact", async () => {
    const { studioCtx, call, importPage } = fixture();
    const first = await importPage({ html: "<p>Original</p>" });
    const page = ensure(
      studioCtx.site.components.find((c) => c.uuid === first.componentUuid),
      "Page missing",
    );
    const before = flattenTpls(page.tplTree).map((node) => node.uuid);
    const result = await importPage({
      componentUuid: page.uuid,
      html: "<p>Appended</p>",
    });
    expect(result.componentUuid).toBe(page.uuid);
    expect(studioCtx.site.components).toHaveLength(1);
    await call("undo");
    expect(flattenTpls(page.tplTree).map((node) => node.uuid)).toEqual(before);
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

  it("rejects a changed project or empty source without leaving an empty page", async () => {
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
  });
});
