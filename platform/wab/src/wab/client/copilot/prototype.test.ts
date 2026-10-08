import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { svgData } from "@/wab/client/clipboard/__testonly__/clipboard-test-data";
import { COPILOT_TOOLS } from "@/wab/client/copilot";
import { getTplComponentArg } from "@/wab/shared/TplMgr";
import { ensure } from "@/wab/shared/common";
import { mapCopilotToolsToJsonSchema } from "@/wab/shared/copilot/copilot-tool-types";
import { PROTOTYPE_TOOL_META } from "@/wab/shared/copilot/prototype-tools";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { tryExtractJson } from "@/wab/shared/core/exprs";
import { mkParam } from "@/wab/shared/core/lang";
import { createSite } from "@/wab/shared/core/sites";
import {
  addComponentState,
  mkValueStateForTextInput,
} from "@/wab/shared/core/states";
import * as taggedUnbundle from "@/wab/shared/core/tagged-unbundle";
import { flattenTpls, mkSlot, mkTplTagX } from "@/wab/shared/core/tpls";
import {
  ProjectDependency,
  isKnownTplComponent,
  isKnownTplTag,
} from "@/wab/shared/model/classes";
import { typeFactory } from "@/wab/shared/model/model-util";
import { runInAction } from "mobx";
import { ok } from "neverthrow";
import { vi } from "vitest";

function fixture(site = createSite()) {
  const { studioCtx } = fakeStudioCtx({ site });
  const call = async (name: string, input: Record<string, unknown> = {}) =>
    JSON.parse(
      await ensure(COPILOT_TOOLS[name], "Tool not found").execute(
        studioCtx,
        input,
      ),
    );
  const createPage = async (name = "Prototype") => {
    const result = await call("createComponent", {
      name,
      type: "page",
      path: `/${name.toLowerCase()}`,
    });
    return ensure(
      studioCtx.site.components.find((c) => c.uuid === result.results[0].uuid),
      "Page not created",
    );
  };
  return { studioCtx, call, createPage };
}

describe("AI prototype editor tools", () => {
  it("restores prop and empty-slot defaults without treating null as unset, and rejects destructive resets atomically", async () => {
    const site = createSite();
    const footer = mkParam({
      name: "footer",
      type: typeFactory.renderable(),
      paramType: "slot",
    });
    const slot = mkSlot(footer);
    const dialog = mkComponent({
      name: "Dialog",
      type: ComponentType.Plain,
      params: [
        mkParam({
          name: "configuration",
          type: typeFactory.any(),
          paramType: "prop",
        }),
        footer,
      ],
      tplTree: mkTplTagX("div", {}, [slot]),
    });
    site.components.push(dialog);
    const { studioCtx, call, createPage } = fixture(site);
    flattenTpls(dialog.tplTree).forEach((tpl) =>
      studioCtx.tplMgr().ensureBaseVariantSetting(tpl),
    );
    const page = await createPage("DefaultFooter");
    expect((await call("validate")).errors, "after setup").toEqual([]);
    await call("insertHtml", {
      componentUuid: page.uuid,
      html: '<plasmic-component data-plasmic-component="Dialog" data-props=\'{"configuration":null}\'><slot name="footer"></slot></plasmic-component><plasmic-component data-plasmic-component="Dialog"><slot name="footer"><button>Custom action</button></slot></plasmic-component>',
    });
    expect((await call("validate")).errors, "after insertion").toEqual([]);
    let instance = ensure(
      flattenTpls(page.tplTree).find(isKnownTplComponent),
      "Missing instance",
    );
    const arg = (name: string) =>
      instance.vsettings[0].args.find((a) => a.param.variable.name === name);
    expect(
      tryExtractJson(ensure(arg("configuration"), "Missing text").expr),
    ).toBeNull();
    expect(arg("footer")).toBeTruthy();
    await expect(
      call("changeElement", {
        componentUuid: page.uuid,
        elementUuid: instance.uuid,
        resetProps: ["configuration", "missing"],
      }),
    ).rejects.toThrow("Unknown component prop");
    expect(arg("configuration")).toBeTruthy();
    await call("changeElement", {
      componentUuid: page.uuid,
      elementUuid: instance.uuid,
      resetProps: ["configuration", "footer"],
    });
    expect(arg("configuration")).toBeUndefined();
    expect(arg("footer")).toBeUndefined();
    instance = ensure(
      flattenTpls(page.tplTree).filter(isKnownTplComponent)[1],
      "Missing custom-footer instance",
    );
    await call("changeElement", {
      componentUuid: page.uuid,
      elementUuid: instance.uuid,
      props: { configuration: "Continue" },
    });
    await expect(
      call("changeElement", {
        componentUuid: page.uuid,
        elementUuid: instance.uuid,
        resetProps: ["configuration", "footer"],
      }),
    ).rejects.toThrow("Remove nonempty slot content");
    expect(
      tryExtractJson(ensure(arg("configuration"), "Missing text").expr),
    ).toBe("Continue");
    expect(arg("footer")).toBeTruthy();
    await expect(
      call("changeElement", {
        componentUuid: page.uuid,
        elementUuid: instance.uuid,
        resetProps: ["configuration"],
        props: { configuration: "Set" },
      }),
    ).rejects.toThrow("Cannot set and reset");
    const validation = await call("validate");
    expect(validation.valid, JSON.stringify(validation)).toBe(true);
    studioCtx.copilotActivity.dispose();
  });
  it("undo skips selection/navigation records and preserves redo after changing the view", async () => {
    const { studioCtx, call, createPage } = fixture();
    const page = await createPage("History");
    await call("insertHtml", {
      componentUuid: page.uuid,
      elementUuid: page.tplTree.uuid,
      html: "<p>First</p>",
      location: "append",
    });
    const before = flattenTpls(page.tplTree).length;
    const records = studioCtx.undoLog._log.length;
    await call("navigate", { componentUuid: page.uuid });
    studioCtx.createViewStateUndoRecord();
    expect(studioCtx.undoLog._log).toHaveLength(records);
    await call("undo");
    expect(flattenTpls(page.tplTree).length).toBeLessThan(before);
    expect(studioCtx.canRedo()).toBe(true);
    studioCtx.createViewStateUndoRecord();
    expect(studioCtx.canRedo()).toBe(true);
    await studioCtx.redo();
    expect(flattenTpls(page.tplTree)).toHaveLength(before);
    studioCtx.copilotActivity.dispose();
  });
  it("returns empty editor context before a canvas is focused", async () => {
    const { studioCtx, call } = fixture();
    expect(await call("getEditorContext")).toMatchObject({
      frameUuid: null,
      selectedElementUuids: [],
      path: [],
      mode: "edit",
    });
    studioCtx.copilotActivity.dispose();
  });
  it("reports a blocked editor as non-editable", async () => {
    const { studioCtx, call } = fixture();
    studioCtx.blockChanges = true;
    expect(await call("getEditorContext")).toMatchObject({ canEdit: false });
    studioCtx.copilotActivity.dispose();
  });
  it.each(["live", "interactive"])(
    "reports %s preview and rejects edits and selection",
    async (mode) => {
      const { studioCtx, call } = fixture();
      if (mode === "live") {
        vi.spyOn(studioCtx, "isLiveMode", "get").mockReturnValue(true);
      } else {
        studioCtx.isInteractiveMode = true;
      }
      expect(await call("getEditorContext")).toMatchObject({
        mode: "preview",
        canEdit: false,
      });
      await expect(
        call("createComponent", { name: "Preview edit" }),
      ).rejects.toThrow();
      await expect(
        call("selectElement", {
          componentUuid: "page",
          elementUuid: "element",
          instanceIndex: 0,
        }),
      ).rejects.toThrow("Return to edit mode");
      studioCtx.copilotActivity.dispose();
    },
  );
  it("reports the active preview route independently of the retained editor selection", async () => {
    const { studioCtx, call, createPage } = fixture();
    const sql = await createPage("SQL");
    vi.spyOn(studioCtx, "isLiveMode", "get").mockReturnValue(true);
    Object.assign(studioCtx, {
      previewCtx: {
        component: sql,
        previewPath: "sql",
        width: 320,
        height: 480,
      },
    });
    const previewFrame = document.createElement("iframe");
    previewFrame.dataset.testId = "live-frame";
    Object.defineProperties(previewFrame, {
      clientWidth: { value: 1440 },
      clientHeight: { value: 1024 },
    });
    document.body.appendChild(previewFrame);
    expect(await call("getEditorContext")).toMatchObject({
      mode: "preview",
      canEdit: false,
      previewContext: {
        componentUuid: sql.uuid,
        path: "/sql",
        width: 1440,
        height: 1024,
      },
    });
    previewFrame.remove();
    studioCtx.copilotActivity.dispose();
  });
  it("tracks real read/edit targets and failures without writing feedback into the site", async () => {
    const { studioCtx, call, createPage } = fixture();
    const page = await createPage("Scan");
    studioCtx.copilotActivity.dispose();
    const change = vi.spyOn(studioCtx, "changeObserved");
    const selected = studioCtx.focusedViewCtx();
    await call("read", {
      elements: [{ componentUuid: page.uuid, elementUuid: page.tplTree.uuid }],
    });
    expect(change).not.toHaveBeenCalled();
    expect(studioCtx.focusedViewCtx()).toBe(selected);
    expect(studioCtx.copilotActivity.requests[0]).toMatchObject({
      mode: "read",
      status: "success",
      targets: [{ componentUuid: page.uuid, elementUuid: page.tplTree.uuid }],
    });
    await expect(
      call("deleteElement", {
        componentUuid: page.uuid,
        elementUuid: "missing",
      }),
    ).rejects.toThrow("not found");
    expect(studioCtx.copilotActivity.requests[1]).toMatchObject({
      mode: "edit",
      status: "error",
    });
    const count = studioCtx.copilotActivity.requests.length;
    await expect(call("read", { unknown: true })).rejects.toThrow();
    expect(studioCtx.copilotActivity.requests).toHaveLength(count);
    studioCtx.copilotActivity.dispose();
    change.mockRestore();
  });
  it("organizes canvases and keeps pages while replacing device previews with Desktop", async () => {
    const { studioCtx, call, createPage } = fixture();
    const page = await createPage();
    await call("createCanvas", { name: "Draft" });
    await call("createArtboard", {
      canvasName: "Draft",
      componentUuid: page.uuid,
      width: 1920,
      height: 1080,
    });
    const arena = ensure(
      studioCtx.site.arenas.find((a) => a.name === "Draft"),
      "Canvas missing",
    );
    const frame = arena.children[0];
    await call("updateArtboard", {
      canvasName: "Draft",
      frameUuid: frame.uuid,
      width: 1440,
      height: 1024,
      x: 0,
      y: 0,
    });
    expect(frame.width).toBe(1440);
    expect(frame.height).toBe(1024);
    await call("updateCanvas", { canvasName: "Draft", name: "Overview" });
    expect(arena.name).toBe("Overview");
    await call("setPageViewport", { preset: "Desktop" });
    for (const a of studioCtx.site.pageArenas) {
      for (const row of a.matrix.rows) {
        expect(row.cols).toHaveLength(1);
        expect(row.cols[0].frame.width).toBe(1440);
        expect(row.cols[0].frame.height).toBe(1024);
      }
    }
    const breakpoint = await call("createBreakpoint", {
      name: "Test mobile",
      maxWidth: 640,
    });
    const variant = ensure(
      studioCtx.site.activeScreenVariantGroup?.variants.find(
        (v) => v.name === "Test mobile",
      ),
      "Breakpoint missing",
    );
    await call("deleteBreakpoint", { variantUuid: variant.uuid });
    expect(studioCtx.site.activeScreenVariantGroup?.variants).not.toContain(
      variant,
    );
    expect(breakpoint).toBeDefined();
    await call("deleteCanvas", { canvasName: "Overview" });
    expect(studioCtx.site.arenas).not.toContain(arena);
    expect(studioCtx.site.components).toContain(page);
    expect((await call("validate")).valid).toBe(true);
    await call("undo");
    expect(studioCtx.site.arenas).toContain(arena);
    await expect(
      call("setPageViewport", { preset: "Unknown" }),
    ).rejects.toThrow("Unknown Studio device preset");
  });
  it("installs published libraries with the dependency manager and reloads registrations", async () => {
    const { studioCtx, call } = fixture();
    const dependency = new ProjectDependency({
      name: "overseas",
      pkgId: "pkg-overseas",
      projectId: "library-overseas",
      version: "1.0.0",
      uuid: "dep-overseas",
      site: createSite(),
    });
    const add = vi
      .spyOn(studioCtx.projectDependencyManager, "addByProjectId")
      .mockImplementation(async () => {
        runInAction(() => studioCtx.site.projectDependencies.push(dependency));
        return dependency;
      });
    const registry = vi
      .spyOn(studioCtx, "updateCcRegistry")
      .mockResolvedValue(undefined);
    try {
      expect(
        await call("installLibrary", { projectId: dependency.projectId }),
      ).toEqual({
        projectId: dependency.projectId,
        version: "1.0.0",
        installed: true,
      });
      expect(add).toHaveBeenCalledWith(dependency.projectId);
      expect(registry).toHaveBeenCalledOnce();
      expect(
        (await call("installLibrary", { projectId: dependency.projectId }))
          .installed,
      ).toBe(false);
      expect(add).toHaveBeenCalledOnce();
      const permission = vi
        .spyOn(studioCtx, "canEditProject")
        .mockReturnValue(false);
      try {
        await expect(
          call("installLibrary", { projectId: "other" }),
        ).rejects.toThrow("read-only");
      } finally {
        permission.mockRestore();
      }
    } finally {
      add.mockRestore();
      registry.mockRestore();
    }
  });
  it("upgrades installed library references through the dependency manager and skips unchanged versions", async () => {
    const { studioCtx, call } = fixture();
    const dependency = new ProjectDependency({
      name: "antd6",
      pkgId: "pkg-antd6",
      projectId: "library-antd6",
      version: "1.0.0",
      uuid: "dep-old",
      site: createSite(),
    });
    const published = new ProjectDependency({
      name: "antd6",
      pkgId: dependency.pkgId,
      projectId: dependency.projectId,
      version: "1.1.0",
      uuid: "dep-new",
      site: createSite(),
    });
    runInAction(() => studioCtx.site.projectDependencies.push(dependency));
    const originalFetch = studioCtx.appCtx.api.getPkgVersion;
    const fetch = vi.fn().mockResolvedValue({ pkg: {}, depPkgs: [] });
    studioCtx.appCtx.api.getPkgVersion = fetch;
    const unbundle = vi
      .spyOn(taggedUnbundle, "unbundleProjectDependency")
      .mockReturnValue({ projectDependency: published } as any);
    const upgrade = vi
      .spyOn(studioCtx.projectDependencyManager, "upgradeProjectDeps")
      .mockResolvedValue(undefined);
    try {
      expect(
        await call("upgradeLibrary", { projectId: dependency.projectId }),
      ).toEqual({
        projectId: dependency.projectId,
        previousVersion: "1.0.0",
        version: "1.1.0",
        upgraded: true,
      });
      expect(fetch).toHaveBeenCalledWith(dependency.pkgId);
      expect(upgrade).toHaveBeenCalledWith([published]);
      published.version = "1.0.0";
      upgrade.mockClear();
      expect(
        (await call("upgradeLibrary", { projectId: dependency.projectId }))
          .upgraded,
      ).toBe(false);
      expect(upgrade).not.toHaveBeenCalled();
      published.pkgId = "wrong-package";
      await expect(
        call("upgradeLibrary", { projectId: dependency.projectId }),
      ).rejects.toThrow("does not match");
    } finally {
      studioCtx.appCtx.api.getPkgVersion = originalFetch;
      unbundle.mockRestore();
      upgrade.mockRestore();
    }
  });
  it("rejects library upgrades on read-only projects and for uninstalled libraries", async () => {
    const { studioCtx, call } = fixture();
    await expect(
      call("upgradeLibrary", { projectId: "missing" }),
    ).rejects.toThrow("not installed");
    const permission = vi
      .spyOn(studioCtx, "canEditProject")
      .mockReturnValue(false);
    try {
      await expect(
        call("upgradeLibrary", { projectId: "missing" }),
      ).rejects.toThrow("read-only");
    } finally {
      permission.mockRestore();
    }
  });

  it("imports captured block paragraphs without adding flex-only styles", async () => {
    const { call, createPage } = fixture();
    const page = await createPage();
    const result = await call("insertHtml", {
      componentUuid: page.uuid,
      html: '<p style="display:block;width:416px;font-size:14px;line-height:22.4px">Captured paragraph</p>',
    });
    expect(result.results[0].baseVariantTplTree).toContain(
      "Captured paragraph",
    );
    expect((await call("validate")).valid).toBe(true);
  });
  it("exposes introspectable schemas for every executable tool", () => {
    const schemas = mapCopilotToolsToJsonSchema(PROTOTYPE_TOOL_META);
    expect(Object.keys(schemas).sort()).toEqual(
      Object.keys(COPILOT_TOOLS).sort(),
    );
    expect(schemas.insertHtml.inputSchema).toMatchObject({
      type: "object",
      additionalProperties: false,
    });
  });

  it("imports SVG geometry as an asset without invalid container defaults", async () => {
    const { call, createPage } = fixture();
    const page = await createPage();
    const { xml } = svgData();
    const result = await call("insertHtml", {
      componentUuid: page.uuid,
      html: xml,
    });
    expect(result.results[0].baseVariantTplTree).toContain("svg");
    expect((await call("validate")).valid).toBe(true);
  });

  it("reads and updates sanitized SVG paths without replacing the element or asset", async () => {
    const { studioCtx, call, createPage } = fixture();
    const page = await createPage();
    const { xml } = svgData();
    await call("insertHtml", { componentUuid: page.uuid, html: xml });
    const tpl = ensure(
      flattenTpls(page.tplTree).find((t) => "tag" in t && t.tag === "svg"),
      "SVG element missing",
    );
    const before = await call("readVector", {
      componentUuid: page.uuid,
      elementUuid: tpl.uuid,
    });
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30" viewBox="0 0 40 30"><path d="M0 0H40V30H0Z" fill="#1677ff"/></svg>';
    await call("updateVector", {
      componentUuid: page.uuid,
      elementUuid: tpl.uuid,
      svg,
    });
    const after = await call("readVector", {
      componentUuid: page.uuid,
      elementUuid: tpl.uuid,
    });
    expect(after.assetUuid).toBe(before.assetUuid);
    expect(after.elementUuid).toBe(before.elementUuid);
    expect(after.svg).toContain("40");
    expect(after.width).toBe(40);
    await call("undo");
    expect(
      (
        await call("readVector", {
          componentUuid: page.uuid,
          elementUuid: tpl.uuid,
        })
      ).svg,
    ).toBe(before.svg);
    expect(studioCtx.site.imageAssets.length).toBeGreaterThan(0);
  });

  it("creates freeform artboards, finds empty space in four directions and undoes one insertion", async () => {
    const { studioCtx, call, createPage } = fixture();
    const page = await createPage();
    await call("createCanvas", { name: "Acceptance canvas" });
    await call("createArtboard", {
      canvasName: "Acceptance canvas",
      componentUuid: page.uuid,
      width: 1366,
      height: 900,
    });
    const arena = ensure(
      studioCtx.site.arenas.find((a) => a.name === "Acceptance canvas"),
      "Canvas missing",
    );
    expect(arena.children).toHaveLength(1);
    expect(arena.children[0].left).toBe(0);
    for (const direction of ["top", "right", "bottom", "left"]) {
      const pos = await call("findEmptySpace", {
        canvasName: arena.name,
        width: 414,
        height: 900,
        direction,
        padding: 80,
        frameUuid: arena.children[0].uuid,
      });
      if (direction === "right") {
        expect(pos.x).toBe(1446);
      }
      if (direction === "bottom") {
        expect(pos.y).toBe(980);
      }
      if (direction === "left") {
        expect(pos.x).toBe(-494);
      }
      if (direction === "top") {
        expect(pos.y).toBe(-980);
      }
    }
    await call("createArtboard", {
      canvasName: arena.name,
      componentUuid: page.uuid,
      width: 414,
      height: 900,
    });
    expect(arena.children).toHaveLength(2);
    expect(arena.children[1].left).toBe(1446);
    expect((await call("validate")).valid).toBe(true);
    await call("undo");
    expect(arena.children).toHaveLength(1);
  });

  it("reads NAS SVG source and rejects raster responses", async () => {
    const { studioCtx, call, createPage } = fixture();
    const page = await createPage();
    const { xml } = svgData();
    await call("insertHtml", { componentUuid: page.uuid, html: xml });
    const tpl = ensure(
      flattenTpls(page.tplTree).find((t) => "tag" in t && t.tag === "svg"),
      "SVG missing",
    );
    const resource = await call("readVector", {
      componentUuid: page.uuid,
      elementUuid: tpl.uuid,
    });
    const asset = ensure(
      studioCtx.site.imageAssets.find((a) => a.uuid === resource.assetUuid),
      "Asset missing",
    );
    asset.dataUri = "https://studio.plasmic.shiguanglab.com/assets/fixture.svg";
    const fetcher = vi.spyOn(globalThis, "fetch");
    try {
      fetcher.mockResolvedValueOnce(
        new Response(xml, { headers: { "content-type": "image/svg+xml" } }),
      );
      expect(
        (
          await call("readVector", {
            componentUuid: page.uuid,
            elementUuid: tpl.uuid,
          })
        ).svg,
      ).toBe(xml);
      expect(fetcher).toHaveBeenCalledWith(
        asset.dataUri,
        expect.objectContaining({ credentials: "include" }),
      );
      fetcher.mockResolvedValueOnce(
        new Response("raster", { headers: { "content-type": "image/png" } }),
      );
      await expect(
        call("readVector", { componentUuid: page.uuid, elementUuid: tpl.uuid }),
      ).rejects.toThrow("not SVG");
    } finally {
      fetcher.mockRestore();
    }
  });

  it("reads the project, creates and edits an actual editable page", async () => {
    const { studioCtx, call, createPage } = fixture();
    expect(
      (
        await call("identify", {
          model: "test",
          client: "test",
          skill: "test",
          outputFormat: "json",
        })
      ).canEdit,
    ).toBe(true);
    expect((await call("read")).results[0].__type).toBe("Project");
    const page = await createPage();
    await call("insertHtml", {
      componentUuid: page.uuid,
      html: '<section data-plasmic-name="hero" style="display:flex;flex-direction:column;gap:16px;padding:24px"><h1>Project overview</h1><p>Editable content</p></section>',
    });
    const section = ensure(
      flattenTpls(page.tplTree).find((t) => "name" in t && t.name === "hero"),
      "Hero not found",
    );
    await call("changeElement", {
      componentUuid: page.uuid,
      elementUuid: section.uuid,
      styles: { padding: "32px" },
    });
    const resource = (await call("read", { componentUuids: [page.uuid] }))
      .results[0];
    expect(resource.baseVariantTplTree).toContain("Project overview");
    expect(resource.baseVariantTplTree).toContain("32px");
    expect(
      (await call("validate", { componentUuids: [page.uuid] })).valid,
    ).toBe(true);
    expect(studioCtx.hasUnsavedChanges()).toBe(true);
  });

  it("updates implicit state bindings and interaction code when a node is renamed", async () => {
    const { studioCtx, call, createPage } = fixture();
    const page = await createPage();
    await call("insertHtml", {
      componentUuid: page.uuid,
      html: '<button data-plasmic-name="submit">Submit</button>',
    });
    const input = mkTplTagX("input", { name: "queryInput" });
    await studioCtx.change(() => {
      const root = ensure(
        isKnownTplTag(page.tplTree) ? page.tplTree : undefined,
        "Root missing",
      );
      root.children.push(input);
      input.parent = root;
      addComponentState(
        studioCtx.site,
        page,
        mkValueStateForTextInput(input, page, studioCtx.tplMgr()),
      );
      return ok();
    });
    const button = ensure(
      flattenTpls(page.tplTree).find((t) => "name" in t && t.name === "submit"),
      "Button missing",
    );
    const stateIds = page.states.map((s) => s.param.uuid);
    expect(stateIds.length).toBeGreaterThan(0);
    await call("changeElement", {
      componentUuid: page.uuid,
      elementUuid: button.uuid,
      visibleIf: "{{ !!$state.queryInput.value }}",
    });
    await call("createInteraction", {
      componentUuid: page.uuid,
      elementUuid: button.uuid,
      eventName: "onClick",
      name: "Clear query",
      action: {
        actionName: "customFunction",
        code: "$state.queryInput.value = ''",
      },
    });
    await call("changeElement", {
      componentUuid: page.uuid,
      elementUuid: input.uuid,
      name: "GroupName",
    });
    const resource = (await call("read", { componentUuids: [page.uuid] }))
      .results[0];
    expect(resource.baseVariantTplTree).toContain("$state.groupName.value");
    expect(resource.baseVariantTplTree).not.toContain(
      "$state.queryInput.value",
    );
    expect(resource.interactions[0].code).toContain("$state.groupName.value");
    expect(page.states.map((s) => s.param.uuid)).toEqual(stateIds);
    studioCtx.copilotActivity.dispose();
  });

  it("reports slot and controlled-value contracts for the AI", async () => {
    const { studioCtx, call } = fixture();
    const created = (
      await call("createComponent", { name: "Reusable", type: "component" })
    ).results[0];
    await call("insertHtml", {
      componentUuid: created.uuid,
      html: '<div><slot-target name="children"><span>Default label</span></slot-target></div>',
    });
    const resource = (await call("read", { componentUuids: [created.uuid] }))
      .results[0];
    expect(resource.props).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "children", type: "slot" }),
      ]),
    );
    expect(studioCtx.site.components).toHaveLength(1);
  });

  it("renames existing nodes through an undoable batch without replacing them", async () => {
    const { studioCtx, call, createPage } = fixture();
    const page = await createPage();
    await call("insertHtml", {
      componentUuid: page.uuid,
      html: '<section data-plasmic-name="detailSummary"><button data-plasmic-name="backToList">Back</button></section>',
    });
    const section = ensure(
      flattenTpls(page.tplTree).find(
        (t) => "name" in t && t.name === "detailSummary",
      ),
      "Section missing",
    );
    const button = ensure(
      flattenTpls(page.tplTree).find(
        (t) => "name" in t && t.name === "backToList",
      ),
      "Button missing",
    );
    const before = (await call("read", { componentUuids: [page.uuid] }))
      .results[0].baseVariantTplTree;
    await call("executeBatch", {
      operations: [
        {
          name: "changeElement",
          input: {
            componentUuid: page.uuid,
            elementUuid: section.uuid,
            name: "DetailSummary",
          },
        },
        {
          name: "changeElement",
          input: {
            componentUuid: page.uuid,
            elementUuid: button.uuid,
            name: "BackToList",
          },
        },
      ],
    });
    const after = (await call("read", { componentUuids: [page.uuid] }))
      .results[0].baseVariantTplTree;
    expect(after).toBe(
      before
        .replace('label="detailSummary"', 'label="DetailSummary"')
        .replace('label="backToList"', 'label="BackToList"'),
    );
    await call("undo");
    expect(
      (await call("read", { componentUuids: [page.uuid] })).results[0]
        .baseVariantTplTree,
    ).toBe(before);
    studioCtx.copilotActivity.dispose();
  });

  it("rejects malformed schemas, duplicate pages, and destructive replacement without a target", async () => {
    const { studioCtx, call, createPage } = fixture();
    const page = await createPage();
    const before = studioCtx.site.components.length;
    await expect(
      call("createComponent", {
        name: "Other",
        type: "page",
        path: "/prototype",
      }),
    ).rejects.toThrow("already exists");
    await expect(
      call("createComponent", { name: "Prototype", type: "page" }),
    ).rejects.toThrow("already exists");
    await expect(
      call("createComponent", { name: "Other", unknown: true }),
    ).rejects.toThrow();
    await expect(
      call("insertHtml", {
        componentUuid: page.uuid,
        html: "<h1>Lost</h1>",
        location: "replace",
      }),
    ).rejects.toThrow("explicit elementUuid");
    expect(studioCtx.site.components).toHaveLength(before);
  });

  it("rejects unknown HTML components without inserting a partial tree", async () => {
    const { call, createPage } = fixture();
    const page = await createPage();
    const before = (await call("read", { componentUuids: [page.uuid] }))
      .results[0].baseVariantTplTree;
    await expect(
      call("insertHtml", {
        componentUuid: page.uuid,
        html: '<div>Valid content</div><plasmic-component data-plasmic-component="DoesNotExist" />',
      }),
    ).rejects.toThrow();
    expect(
      (await call("read", { componentUuids: [page.uuid] })).results[0]
        .baseVariantTplTree,
    ).toBe(before);
  });

  it.each(["blocked", "stale", "readOnly", "protectedMain"])(
    "rejects writes in %s sessions",
    async (state) => {
      const { studioCtx, call } = fixture();
      if (state === "blocked") {
        studioCtx.blockChanges = true;
      }
      if (state === "stale") {
        studioCtx.isAtTip = false;
      }
      if (state === "readOnly") {
        vi.spyOn(studioCtx, "canEditProject").mockReturnValue(false);
      }
      if (state === "protectedMain") {
        studioCtx.siteInfo.isMainBranchProtected = true;
      }
      await expect(
        call("createComponent", { name: "Unauthorized" }),
      ).rejects.toThrow();
      expect(studioCtx.site.components).toHaveLength(0);
    },
  );

  it("rolls back the whole props transaction after a later prop fails, then accepts valid edits", async () => {
    const { studioCtx, call, createPage } = fixture();
    const page = await createPage();
    const result = await call("createComponent", {
      name: "ReusableButton",
      type: "component",
    });
    const button = ensure(
      studioCtx.site.components.find((c) => c.uuid === result.results[0].uuid),
      "Button not found",
    );
    await studioCtx.change(() => {
      button.params.push(
        mkParam({
          name: "disabled",
          type: typeFactory.bool(),
          paramType: "prop",
        }),
        mkParam({
          name: "tone",
          type: typeFactory.choice(["primary", "default"]),
          paramType: "prop",
        }),
      );
      return ok();
    });
    await call("insertHtml", {
      componentUuid: page.uuid,
      html: '<plasmic-component data-plasmic-component="ReusableButton" data-props=\'{"disabled":false,"tone":"default"}\'></plasmic-component>',
    });
    const instance = ensure(
      flattenTpls(page.tplTree).find(isKnownTplComponent),
      "Instance not found",
    );
    const originalName = instance.name;
    await expect(
      call("changeElement", {
        componentUuid: page.uuid,
        elementUuid: instance.uuid,
        name: "RenamedButton",
        props: { disabled: true, tone: "invalid" },
      }),
    ).rejects.toThrow("must be one of");
    expect(instance.name).toBe(originalName);
    expect(
      tryExtractJson(
        ensure(
          getTplComponentArg(
            instance,
            instance.vsettings[0],
            ensure(
              instance.component.params.find(
                (p) => p.variable.name === "disabled",
              ),
              "Param missing",
            ).variable,
          ),
          "Arg missing",
        ).expr,
      ),
    ).toBe(false);
    await call("changeElement", {
      componentUuid: page.uuid,
      elementUuid: instance.uuid,
      props: { disabled: true, tone: "primary" },
    });
    expect(
      tryExtractJson(
        ensure(
          getTplComponentArg(
            instance,
            instance.vsettings[0],
            ensure(
              instance.component.params.find(
                (p) => p.variable.name === "disabled",
              ),
              "Param missing",
            ).variable,
          ),
          "Arg missing",
        ).expr,
      ),
    ).toBe(true);
  });

  it("creates state and validated interactions, protects the root, and supports undo", async () => {
    const { call, createPage } = fixture();
    const page = await createPage();
    await call("createState", {
      componentUuid: page.uuid,
      name: "count",
      variableType: "number",
      initialValue: 0,
    });
    await expect(
      call("createState", {
        componentUuid: page.uuid,
        name: "bad",
        variableType: "number",
        initialValue: "text",
      }),
    ).rejects.toThrow("not valid");
    await call("insertHtml", {
      componentUuid: page.uuid,
      html: '<button data-plasmic-name="increment">Add item</button>',
    });
    const button = ensure(
      flattenTpls(page.tplTree).find(
        (t) => "name" in t && t.name === "increment",
      ),
      "Button not found",
    );
    await call("createInteraction", {
      componentUuid: page.uuid,
      elementUuid: button.uuid,
      eventName: "onClick",
      name: "Increment",
      action: {
        actionName: "updateVariable",
        variable: ["count"],
        operation: "Increment",
      },
    });
    const result = (await call("read", { componentUuids: [page.uuid] }))
      .results[0];
    expect(result.states).toHaveLength(1);
    expect(result.interactions).toHaveLength(1);
    await expect(
      call("deleteElement", {
        componentUuid: page.uuid,
        elementUuid: page.tplTree.uuid,
      }),
    ).rejects.toThrow("root");
    await call("deleteElement", {
      componentUuid: page.uuid,
      elementUuid: button.uuid,
    });
    expect(flattenTpls(page.tplTree).some((t) => t.uuid === button.uuid)).toBe(
      false,
    );
    expect(await call("undo")).toEqual({ undone: true });
    expect(flattenTpls(page.tplTree).some((t) => t.uuid === button.uuid)).toBe(
      true,
    );
  });

  it("copies nested nodes with fresh UUIDs and moves existing nodes without losing identity", async () => {
    const { call, createPage } = fixture();
    const page = await createPage();
    await call("insertHtml", {
      componentUuid: page.uuid,
      html: '<section data-plasmic-name="section"><div data-plasmic-name="first"><span>Nested</span></div><div data-plasmic-name="last">Last</div></section>',
    });
    const section = ensure(
      flattenTpls(page.tplTree).find(
        (t) => "name" in t && t.name === "section",
      ),
      "Section missing",
    );
    const first = ensure(
      flattenTpls(page.tplTree).find((t) => "name" in t && t.name === "first"),
      "First missing",
    );
    const last = ensure(
      flattenTpls(page.tplTree).find((t) => "name" in t && t.name === "last"),
      "Last missing",
    );
    const before = flattenTpls(page.tplTree).map((t) => t.uuid);
    await call("copyElement", {
      componentUuid: page.uuid,
      elementUuid: first.uuid,
      targetUuid: last.uuid,
      location: "after",
    });
    expect(
      flattenTpls(page.tplTree).filter((t) => !before.includes(t.uuid)),
    ).toHaveLength(2);
    expect(new Set(flattenTpls(page.tplTree).map((t) => t.uuid)).size).toBe(
      flattenTpls(page.tplTree).length,
    );
    await call("moveElement", {
      componentUuid: page.uuid,
      elementUuid: first.uuid,
      targetUuid: section.uuid,
      location: "append",
    });
    expect("children" in section && section.children.at(-1)).toBe(first);
    await expect(
      call("moveElement", {
        componentUuid: page.uuid,
        elementUuid: section.uuid,
        targetUuid: first.uuid,
        location: "append",
      }),
    ).rejects.toThrow("descendant");
    await expect(
      call("moveElement", {
        componentUuid: page.uuid,
        elementUuid: page.tplTree.uuid,
        targetUuid: last.uuid,
        location: "after",
      }),
    ).rejects.toThrow("root");
    expect((await call("validate")).valid).toBe(true);
  });

  it("rolls back an entire batch, then records a successful batch as one undo", async () => {
    const { call, createPage } = fixture();
    const page = await createPage();
    const read = async () =>
      (await call("read", { componentUuids: [page.uuid] })).results[0]
        .baseVariantTplTree;
    const before = await read();
    await expect(
      call("executeBatch", {
        operations: [
          {
            name: "insertHtml",
            input: { componentUuid: page.uuid, html: "<p>Must roll back</p>" },
          },
          {
            name: "createState",
            input: {
              componentUuid: page.uuid,
              name: "invalid",
              variableType: "number",
              initialValue: "text",
            },
          },
        ],
      }),
    ).rejects.toThrow("Operation 1");
    expect(await read()).toBe(before);
    expect(page.states).toHaveLength(0);
    await call("executeBatch", {
      operations: [
        {
          name: "insertHtml",
          input: { componentUuid: page.uuid, html: "<p>Persist together</p>" },
        },
        {
          name: "createState",
          input: {
            componentUuid: page.uuid,
            name: "count",
            variableType: "number",
            initialValue: 2,
          },
        },
      ],
    });
    expect(await read()).toContain("Persist together");
    expect(page.states).toHaveLength(1);
    await call("undo");
    expect(await read()).toBe(before);
    expect(page.states).toHaveLength(0);
  });

  it("updates typed states, tokens and component variants using their returned IDs", async () => {
    const { studioCtx, call, createPage } = fixture();
    const page = await createPage();
    await call("createState", {
      componentUuid: page.uuid,
      name: "count",
      variableType: "number",
      initialValue: 2,
    });
    const state = page.states[0];
    await call("updateState", {
      componentUuid: page.uuid,
      stateUuid: state.param.uuid,
      name: "total",
      initialValue: 7,
    });
    expect(state.param.variable.name).toBe("total");
    expect(
      tryExtractJson(ensure(state.param.defaultExpr, "Default missing")),
    ).toBe(7);
    await expect(
      call("updateState", {
        componentUuid: page.uuid,
        stateUuid: state.param.uuid,
        initialValue: "bad",
      }),
    ).rejects.toThrow();
    await call("deleteState", {
      componentUuid: page.uuid,
      stateUuid: state.param.uuid,
    });
    expect(page.states).toHaveLength(0);
    const token = (
      await call("createStyleToken", {
        name: "Accent",
        type: "Color",
        value: "#123456",
      })
    ).results[0];
    await call("updateStyleToken", {
      tokenUuid: token.uuid,
      name: "Brand",
      value: "#654321",
    });
    expect(studioCtx.site.styleTokens[0]).toMatchObject({
      name: "Brand",
      value: "#654321",
    });
    await call("deleteStyleToken", { tokenUuid: token.uuid });
    expect(studioCtx.site.styleTokens).toHaveLength(0);
    await call("createVariantGroup", {
      componentUuid: page.uuid,
      name: "Tone",
      optionsType: "singleChoice",
    });
    const group = page.variantGroups[0];
    await call("createVariant", {
      componentUuid: page.uuid,
      groupUuid: group.uuid,
      name: "Dark",
    });
    const variant = group.variants[0];
    await call("changeElement", {
      componentUuid: page.uuid,
      elementUuid: page.tplTree.uuid,
      variantUuids: [variant.uuid],
      styles: { background: "#101828" },
    });
    expect(
      page.tplTree.vsettings.some((vs) => vs.variants.includes(variant)),
    ).toBe(true);
    expect((await call("validate")).valid).toBe(true);
  });

  it("sets and clears conditional and repeated content, rejecting invalid expressions atomically", async () => {
    const { call, createPage } = fixture();
    const page = await createPage();
    await call("insertHtml", {
      componentUuid: page.uuid,
      html: '<div data-plasmic-name="row">Row</div>',
    });
    const row = ensure(
      flattenTpls(page.tplTree).find((t) => "name" in t && t.name === "row"),
      "Row missing",
    );
    await call("changeElement", {
      componentUuid: page.uuid,
      elementUuid: row.uuid,
      visibleIf: "{{ true }}",
      repeat: { collection: "{{ [1,2,3] }}", itemName: "item" },
    });
    expect(row.vsettings[0].dataCond).toBeTruthy();
    expect(row.vsettings[0].dataRep?.element.name).toBe("item");
    await expect(
      call("changeElement", {
        componentUuid: page.uuid,
        elementUuid: row.uuid,
        visibleIf: null,
        repeat: { collection: "static text" },
      }),
    ).rejects.toThrow("Expected a JS expression");
    expect(row.vsettings[0].dataCond).toBeTruthy();
    await call("changeElement", {
      componentUuid: page.uuid,
      elementUuid: row.uuid,
      visibleIf: null,
      repeat: null,
    });
    expect(row.vsettings[0].dataCond).toBeNull();
    expect(row.vsettings[0].dataRep).toBeNull();
    expect((await call("validate")).valid).toBe(true);
  });

  it("creates theme variants, themed token values and responsive breakpoints", async () => {
    const { studioCtx, call, createPage } = fixture();
    await createPage();
    const read = await call("createGlobalVariantGroup", { name: "Theme" });
    const group = studioCtx.site.globalVariantGroups.find(
      (g) => g.param.variable.name === "Theme",
    );
    expect(JSON.stringify(read)).toContain(ensure(group, "Group missing").uuid);
    await call("createGlobalVariant", {
      groupUuid: ensure(group, "Group missing").uuid,
      name: "Dark",
    });
    const token = (
      await call("createStyleToken", {
        name: "Surface",
        type: "Color",
        value: "#fff",
      })
    ).results[0];
    await call("updateStyleToken", {
      tokenUuid: token.uuid,
      variantUuids: [ensure(group, "Group missing").variants[0].uuid],
      value: "#111",
    });
    expect(studioCtx.site.styleTokens[0].variantedValues).toHaveLength(1);
    await call("updateStyleToken", {
      tokenUuid: token.uuid,
      variantUuids: [ensure(group, "Group missing").variants[0].uuid],
      value: null,
    });
    expect(studioCtx.site.styleTokens[0].variantedValues).toHaveLength(0);
    await call("createBreakpoint", { name: "Mobile", maxWidth: 600 });
    expect(
      studioCtx.site.activeScreenVariantGroup?.variants.some(
        (v) => v.mediaQuery === "(max-width:600px)",
      ),
    ).toBe(true);
    await expect(
      call("createBreakpoint", {
        name: "Invalid",
        minWidth: 800,
        maxWidth: 600,
      }),
    ).rejects.toThrow("must not exceed");
    expect((await call("validate")).valid).toBe(true);
  });

  it("deletes unused pages as an undoable mutation and rejects later batch edits on removed components", async () => {
    const { studioCtx, call, createPage } = fixture();
    const page = await createPage();
    await expect(
      call("executeBatch", {
        operations: [
          { name: "deleteComponent", input: { componentUuid: page.uuid } },
          {
            name: "createState",
            input: {
              componentUuid: page.uuid,
              name: "invalid",
              variableType: "number",
            },
          },
        ],
      }),
    ).rejects.toThrow("Component removed during batch");
    expect(studioCtx.site.components).toContain(page);
    await call("deleteComponent", { componentUuid: page.uuid });
    expect(studioCtx.site.components).not.toContain(page);
    await call("undo");
    expect(studioCtx.site.components).toContain(page);
    expect((await call("validate")).valid).toBe(true);
  });

  it("queries native elements by name, tag and subtree without returning unrelated nodes", async () => {
    const { call, createPage } = fixture();
    const page = await createPage();
    await call("insertHtml", {
      componentUuid: page.uuid,
      html: '<section data-plasmic-name="hero"><button data-plasmic-name="action">Create</button></section><button data-plasmic-name="other">Cancel</button>',
    });
    const hero = ensure(
      flattenTpls(page.tplTree).find((t) => "name" in t && t.name === "hero"),
      "Hero missing",
    );
    const queried = await call("queryElements", {
      componentUuid: page.uuid,
      elementUuid: hero.uuid,
      tag: "button",
      nameContains: "action",
    });
    expect(queried.results).toHaveLength(1);
    expect(JSON.stringify(queried)).toContain("Create");
    expect(JSON.stringify(queried)).not.toContain("Cancel");
  });

  it("does not claim a failed save succeeded", async () => {
    const { studioCtx, call, createPage } = fixture();
    await createPage();
    vi.spyOn(studioCtx, "save").mockResolvedValue("TimedOut");
    await expect(call("save")).rejects.toThrow("did not persist");
  });
});
