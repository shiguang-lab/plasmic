import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { mockDeepAuto } from "@/wab/__testonly__/mock";
import { ViewportCtx } from "@/wab/client/studio-ctx/ViewportCtx";
import { Pt } from "@/wab/shared/geom";
import { svgData } from "@/wab/client/clipboard/__testonly__/clipboard-test-data";
import { COPILOT_TOOLS } from "@/wab/client/copilot";
import * as htmlImporter from "@/wab/client/operations/html-to-tpl";
import { RSH } from "@/wab/shared/RuleSetHelpers";
import { ensureBaseVariantSetting, getBaseVariant } from "@/wab/shared/Variants";
import { getTplComponentArg } from "@/wab/shared/TplMgr";
import { fillVirtualSlotContents, isSlot } from "@/wab/shared/SlotUtils";
import { mkCodeComponent } from "@/wab/shared/code-components/code-components";
import { mkServerQuery } from "@/wab/shared/codegen/react-p/server-queries/__testonly__/test-utils";
import { ensure } from "@/wab/shared/common";
import { mapCopilotToolsToJsonSchema } from "@/wab/shared/copilot/copilot-tool-types";
import { PROTOTYPE_TOOL_META } from "@/wab/shared/copilot/prototype-tools";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { codeLit, customCode, tryExtractJson } from "@/wab/shared/core/exprs";
import { mkParam } from "@/wab/shared/core/lang";
import { createSite } from "@/wab/shared/core/sites";
import {
  addComponentState,
  mkValueStateForTextInput,
} from "@/wab/shared/core/states";
import * as taggedUnbundle from "@/wab/shared/core/tagged-unbundle";
import { flattenTpls, mkSlot, mkTplComponentX, mkTplTagX, trackComponentSite } from "@/wab/shared/core/tpls";
import {
  ProjectDependency,
  DataToken,
  isKnownTplComponent,
  isKnownTplTag,
  ensureKnownTplTag,
} from "@/wab/shared/model/classes";
import { typeFactory } from "@/wab/shared/model/model-util";
import { runInAction } from "mobx";
import { ok } from "neverthrow";
import { vi } from "vitest";
import { runInNewContext } from "node:vm";

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
      studioCtx.site.components.find((c) => c.uuid === result.created[0].uuid),
      "Page not created",
    );
  };
  return { studioCtx, call, createPage };
}

describe("AI prototype editor tools", () => {
  it("creates only native Desktop columns and one complete shared page overview", async () => {
    const { call, createPage, studioCtx } = fixture();
    await createPage("List");
    await createPage("Detail");
    const project = (await call("read", { view: "full" })).results[0];
    expect(project.pageFrames.map((f: { width: number; height: number }) => [f.width, f.height])).toEqual([[1440, 1024], [1440, 1024]]);
    expect(project.canvases).toHaveLength(1);
    expect(project.canvases[0].frames.map((f: { componentUuid: string }) => f.componentUuid).sort()).toEqual(studioCtx.site.components.map((c) => c.uuid).sort());
    expect(project.canvases[0].frames.every((f: { width: number; height: number }) => f.width === 1440 && f.height === 1024)).toBe(true);
    const before = await call("read", { view: "full" });
    await expect(call("createComponent", { name: "InvalidDevice", preset: "Unknown" })).rejects.toThrow("Unknown Studio device preset");
    expect(await call("read", { view: "full" })).toEqual(before);
    await call("createComponent", { name: "RequestedMobile", preset: "iPhone 8 Plus" });
    const mobile = (await call("read", { view: "full" })).results[0].pageFrames.at(-1);
    expect([mobile.width, mobile.height]).toEqual([414, 736]);
  });

  it("discovers imported resources by project and name without recursive inventories", async () => {
    const library = createSite();
    library.components.push(mkComponent({ name: "SearchForm", type: ComponentType.Plain, tplTree: mkTplTagX("div") }), mkComponent({ name: "DataTable", type: ComponentType.Plain, tplTree: mkTplTagX("div") }));
    const site = createSite();
    site.projectDependencies.push(new ProjectDependency({ name: "Library", pkgId: "pkg", projectId: "library", version: "1.2.0", uuid: "dep", site: library }));
    const { studioCtx, call } = fixture(site);
    for (const component of library.components) studioCtx.tplMgr().ensureBaseVariantSetting(component.tplTree);
    const imports = (await call("read", { collection: "importedProjects" })).results[0].importedProjects;
    expect(imports[0]).toMatchObject({ id: "library", version: "1.2.0" });
    expect(imports[0]).not.toHaveProperty("components");
    const found = await call("read", { fromProject: "library", collection: "components", nameContains: "form", limit: 1 });
    expect(found.total).toBe(1);
    expect(found.results[0].components[0].name).toBe("SearchForm");
    const scoped = await call("read", { fromProject: "library", componentUuids: [library.components[0].uuid], view: "contract" });
    expect(scoped.results[0].props).toEqual([]);
    const contracts = await call("read", { fromProject: "library", collection: "components", nameContains: "form", view: "contract", fields: ["uuid", "name", "props"] });
    expect(contracts.results[0].components).toEqual([{ uuid: library.components[0].uuid, name: "SearchForm", props: [] }]);
    expect(contracts.read.itemFields).toEqual(["uuid", "name", "props", "isContext"]);
    const completeContracts = await call("read", { fromProject: "library", collection: "components", view: "contract", limit: 1 });
    expect(completeContracts.total).toBe(2);
    expect(completeContracts.nextOffset).toBe(1);
    expect(completeContracts.results[0].components[0]).toHaveProperty("props");
    expect(completeContracts.results[0].components[0]).not.toHaveProperty("baseVariantTplTree");
    const own = await call("read", { fromProject: "library" });
    expect(own.results[0]).toMatchObject({ id: "library", counts: { components: 2 } });
    const local = await call("createComponent", { name: "Local" });
    await expect(call("read", { fromProject: "library", componentUuids: [local.created[0].uuid] })).rejects.toThrow("outside the requested project scope");
    expect((await call("read", { fromProject: studioCtx.siteInfo.id, componentUuids: [local.created[0].uuid], view: "contract" })).results[0].uuid).toBe(local.created[0].uuid);
    await expect(call("read", { fromProject: studioCtx.siteInfo.id, componentUuids: [library.components[0].uuid] })).rejects.toThrow("outside the requested project scope");
    const element = await call("read", { fromProject: "library", elements: [{ componentUuid: library.components[0].uuid, elementUuid: library.components[0].tplTree.uuid }], fields: ["uuid", "componentUuid"] });
    expect(element.results[0]).toEqual({ uuid: library.components[0].tplTree.uuid, componentUuid: library.components[0].uuid });
    expect((await call("read", { view: "full" })).results[0].importedProjects[0]).not.toHaveProperty("components");
    expect((await call("read", { view: "full", fromProject: "library" })).results[0].components).toHaveLength(2);
    const ownInventory = await call("read", { view: "full", fields: ["__type", "id", "components", "canvases", "pageFrames", "devicePresets"] });
    expect(ownInventory.results[0].components.map((c: { uuid: string }) => c.uuid)).toEqual([local.created[0].uuid]);
    expect(ownInventory.results[0]).not.toHaveProperty("importedProjects");
    expect(ownInventory.results[0]).toHaveProperty("pageFrames");
  });
  it("discovers global-context ownership, installed settings and qualified actions before any page writes", async () => {
    const options = vi.fn(() => { throw new Error("Metadata must not run"); });
    const meta = {
      name: "ProjectFeedback", importPath: "./feedback", __isContext: true,
      description: "Project-wide feedback settings",
      props: { colorPrimary: { type: "color" as const, defaultValue: "#1677ff" } },
      globalActions: {
        showMessage: { parameters: [
          { name: "kind", type: { type: "choice" as const, options } },
          { name: "content", type: "string" as const },
          { name: "duration", type: { type: "number" as const } },
        ] },
        clearMessages: { parameters: [] },
      },
    };
    const definition = mkCodeComponent(meta.name, meta, {});
    definition.params.push(mkParam({ name: "colorPrimary", paramType: "prop", type: typeFactory.color() }));
    const library = createSite();
    library.components.push(definition);
    const site = createSite();
    site.projectDependencies.push(new ProjectDependency({ name: "Feedback", pkgId: "feedback-pkg", projectId: "feedback-library", version: "1.0.0", uuid: "feedback-dep", site: library }));
    const context = mkTplComponentX({ component: definition, baseVariant: getBaseVariant(definition), args: { colorPrimary: codeLit("#123456") } });
    site.globalContexts.push(context);
    const { studioCtx, call } = fixture(site);
    const hostlessWindow = (studioCtx as any).hostLessPkgsFrame.contentWindow;
    const hostlessRegistry = (studioCtx as any).hostLessRegistry;
    hostlessWindow.__PlasmicContextRegistry = [];
    hostlessRegistry.clear();
    (studioCtx as any).hostLessPkgsLock = Promise.resolve().then(() => {
      hostlessWindow.__PlasmicContextRegistry = [{ component: () => null, meta }];
      hostlessRegistry.clear();
    });
    const counter = studioCtx._changeCounter;

    const inventory = await call("read", { collection: "components", fromProject: "feedback-library" });
    expect(inventory.results[0].components[0]).toMatchObject({ uuid: definition.uuid, type: "code", isContext: true });
    // Reproduce the exact narrow projection used before the invalid DS insertion.
    const narrow = await call("read", { componentUuids: [definition.uuid], view: "contract", fields: ["uuid", "name", "props", "states", "tree"] });
    expect(narrow.results[0].isContext).toBe(true);
    expect(narrow.results[0].props[0].registration).toMatchObject({ type: "color", defaultValue: "#1677ff" });
    const contract = await call("read", { componentUuids: [definition.uuid], view: "contract" });
    expect(contract.results[0]).toMatchObject({ isContext: true, description: meta.description, globalActions: [
      { name: "ProjectFeedback.showMessage", parameters: [
        { name: "kind", type: "choice", optionsDynamic: true },
        { name: "content", type: "string" },
        { name: "duration", type: "number" },
      ] },
      { name: "ProjectFeedback.clearMessages", parameters: [] },
    ] });
    const installed = await call("read", { collection: "globalContexts" });
    expect(installed.results[0].globalContexts).toEqual([{ uuid: context.uuid, componentUuid: definition.uuid, name: meta.name, properties: { colorPrimary: "#123456" } }]);
    expect((await call("read", { view: "full" })).results[0].globalContexts).toEqual(installed.results[0].globalContexts);
    expect(PROTOTYPE_TOOL_META.read.inputSchema.parse({ collection: "globalContexts" })).toMatchObject({ collection: "globalContexts" });
    expect(studioCtx.site.components).toHaveLength(0);
    expect(studioCtx._changeCounter).toBe(counter);
    expect(options).not.toHaveBeenCalled();
    studioCtx.copilotActivity.dispose();
  });

  it("reads complete indirect dependencies without expanding inventories or granting mutation access", async () => {
    const leaf = createSite();
    const component = mkComponent({ name: "NestedControl", type: ComponentType.Plain, tplTree: mkTplTagX("div", { name: "NestedRoot" }) });
    leaf.components.push(component);
    const library = createSite();
    library.projectDependencies.push(new ProjectDependency({ name: "Leaf", pkgId: "leaf-pkg", projectId: "leaf", version: "2.0.0", uuid: "leaf-dep", site: leaf }));
    const site = createSite();
    site.projectDependencies.push(new ProjectDependency({ name: "Library", pkgId: "library-pkg", projectId: "library", version: "1.0.0", uuid: "library-dep", site: library }));
    const { studioCtx, call } = fixture(site);
    studioCtx.tplMgr().ensureBaseVariantSetting(component.tplTree);
    const counter = studioCtx._changeCounter;
    const libraryModel = (await call("read", { fromProject: "library", view: "full" })).results[0];
    expect(libraryModel.importedProjects).toEqual([{ __type: "ImportedProject", id: "leaf", name: "Leaf", version: "2.0.0" }]);
    const inventory = (await call("read", { fromProject: "leaf", collection: "components" })).results[0];
    expect(inventory.components[0].uuid).toBe(component.uuid);
    const model = (await call("read", { fromProject: "leaf", componentUuids: [component.uuid], view: "full" })).results[0];
    expect(model.fromProject).toBe("leaf");
    expect(model.baseVariantTplTree).toContain("NestedRoot");
    expect((await call("queryElements", { componentUuid: component.uuid, nameContains: "NestedRoot" })).results[0].uuid).toBe(component.tplTree.uuid);
    expect(studioCtx._changeCounter).toBe(counter);
    await expect(call("deleteComponent", { componentUuid: component.uuid })).rejects.toThrow("not found in this project");
    expect(leaf.components).toContain(component);
    studioCtx.copilotActivity.dispose();
  });
  it("returns compact creation receipts and applies dependent edits in one undo", async () => {
    const { call, createPage, studioCtx } = fixture();
    const first = await createPage("BatchFirst");
    const before = await call("read", { componentUuids: [first.uuid], view: "full" });
    const undoCount = studioCtx.undoLog._log.length;
    const result = await call("executeBatch", { operations: [
      { as: "card", name: "insertHtml", input: { componentUuid: first.uuid, html: '<div data-plasmic-name="Card"><span>Child</span></div>' } },
      { name: "changeElement", input: { componentUuid: first.uuid, elementUuid: "$card", styles: { width: "320px" } } },
      { as: "copy", name: "copyElement", input: { componentUuid: first.uuid, elementUuid: "$card", targetUuid: "$card", location: "after" } },
    ] });
    expect(PROTOTYPE_TOOL_META.executeBatch.outputSchema.safeParse(result).success).toBe(true);
    expect(result.operations[0].created).toHaveLength(1);
    expect(result.operations[1].elementUuid).toBe(result.operations[0].created[0].uuid);
    expect(result.operations[2].created[0].uuid).not.toBe(result.operations[0].created[0].uuid);
    expect(JSON.stringify(result)).not.toContain("baseVariantTplTree");
    expect(studioCtx.undoLog._log.length).toBe(undoCount + 1);
    expect((await call("read", { componentUuids: [first.uuid], view: "full" })).results[0].baseVariantTplTree).toContain("320px");
    await call("undo");
    expect(await call("read", { componentUuids: [first.uuid], view: "full" })).toEqual(before);
  });
  it("creates an owner, imports HTML and edits its state and root in the same batch", async () => {
    const { call, studioCtx } = fixture();
    studioCtx.createViewStateUndoRecord();
    const result = await call("executeBatch", { operations: [
      { as: "page", name: "createComponent", input: { name: "NewPage", type: "page", path: "/new" } },
      { as: "row", name: "insertHtml", input: { componentUuid: "$page", html: '<div data-plasmic-name="Row">New content</div>' } },
      { as: "state", name: "createState", input: { componentUuid: "$page", name: "opened", variableType: "boolean", initialValue: false } },
      { name: "updateState", input: { componentUuid: "$page", stateUuid: "$state", initialValue: true } },
      { name: "changeElement", input: { componentUuid: "$page", elementUuid: "$page.root", name: "Root" } },
    ] });
    const page = result.operations[0].created[0];
    const model = (await call("read", { componentUuids: [page.uuid], view: "full" })).results[0];
    expect(model.baseVariantTplTree).toContain("New content");
    expect(model.states[0].initialValue).toBe(true);
    expect(model.rootElementUuid).toBe(page.rootElementUuid);
    await call("undo");
    expect(studioCtx.site.components.some((c) => c.uuid === page.uuid)).toBe(false);
  });
  it("rolls back dependent writes and rejects missing, forward and duplicate bindings", async () => {
    const { call, createPage } = fixture();
    const page = await createPage();
    const before = await call("read", { componentUuids: [page.uuid], view: "full" });
    await expect(call("executeBatch", { operations: [
      { as: "row", name: "insertHtml", input: { componentUuid: page.uuid, html: '<div>Rollback</div>' } },
      { name: "changeElement", input: { componentUuid: page.uuid, elementUuid: "$missing", styles: { width: "100px" } } },
    ] })).rejects.toThrow("Unknown or forward batch reference");
    expect(await call("read", { componentUuids: [page.uuid], view: "full" })).toEqual(before);
    await expect(call("executeBatch", { operations: [
      { name: "changeElement", input: { componentUuid: page.uuid, elementUuid: "$later", name: "Changed" } },
      { as: "later", name: "insertHtml", input: { componentUuid: page.uuid, html: "<div>Later</div>" } },
    ] })).rejects.toThrow("forward batch reference");
    await expect(call("executeBatch", { operations: [
      { as: "same", name: "insertHtml", input: { componentUuid: page.uuid, html: "<div>First</div>" } },
      { as: "same", name: "insertHtml", input: { componentUuid: page.uuid, html: "<div>Second</div>" } },
    ] })).rejects.toThrow("Duplicate batch binding");
    expect(await call("read", { componentUuids: [page.uuid], view: "full" })).toEqual(before);
  });
  it("uses bindings within local canvas scope and preserves literal business text", async () => {
    const { call, createPage } = fixture();
    const page = await createPage();
    const context = await call("getEditorContext");
    const binding = { projectId: context.projectId, branchId: context.branchId, sessionId: context.sessionId,
      changeCounter: context.changeCounter, componentUuid: page.uuid, elementUuids: [] };
    const result = await call("executeLocalEdit", { binding, name: "executeBatch", input: { operations: [
      { as: "button", name: "insertHtml", input: { componentUuid: page.uuid, html: '<button data-plasmic-name="Action">$button</button>' } },
      { name: "changeElement", input: { componentUuid: page.uuid, elementUuid: "$button", styles: { width: "150px" } } },
    ] } });
    const receipts = JSON.parse(result.result).operations;
    expect(receipts[0].created[0].kind).toBe("Element");
    expect(receipts[1].elementUuid).toBe(receipts[0].created[0].uuid);
    expect(result.result).not.toContain("baseVariantTplTree");
    expect(result.after).toContain("$button");
    expect(result.after).toContain("150px");
  });
  it("resolves a created breakpoint for removal in the same batch", async () => {
    const { call, studioCtx } = fixture();
    const result = await call("executeBatch", { operations: [
      { as: "screen", name: "createBreakpoint", input: { name: "Small", maxWidth: 600 } },
      { name: "deleteBreakpoint", input: { variantUuid: "$screen" } },
    ] });
    expect(result.operations[0].created[0].kind).toBe("GlobalVariant");
    expect(studioCtx.site.activeScreenVariantGroup?.variants.some((v) => v.uuid === result.operations[0].created[0].uuid)).toBe(false);
  });
  it("bounds tree reads, projects fields and pages queries without losing full native models", async () => {
    const { call, createPage } = fixture();
    const page = await createPage("LargeTree");
    await call("insertHtml", { componentUuid: page.uuid, html: Array.from({ length: 40 }, (_, i) =>
      `<div data-plasmic-name="Section${i}">${Array.from({ length: 8 }, (_, j) => `<p>${i}-${j} ${"Detailed business content ".repeat(18)}</p>`).join("")}</div>`).join("") });
    const full = await call("read", { componentUuids: [page.uuid], view: "full" });
    const shallow = await call("read", { componentUuids: [page.uuid] });
    expect(JSON.stringify(full).length).toBeGreaterThan(100000);
    expect(JSON.stringify(shallow).length).toBeLessThan(10000);
    expect(shallow.read.depth).toBe(0);
    expect(shallow.results[0].tree.children).toHaveLength(40);
    expect(Object.keys(shallow.results[0].tree.children[0])).toEqual(["uuid"]);
    expect(shallow.results[0]).not.toHaveProperty("baseVariantTplTree");
    expect(JSON.stringify(shallow)).not.toContain("Detailed business content");
    const pageOne = await call("queryElements", { componentUuid: page.uuid, nameContains: "Section", limit: 3, fields: ["uuid", "name"] });
    expect(pageOne.total).toBe(40);
    expect(pageOne.nextOffset).toBe(3);
    expect(Object.keys(pageOne.results[0]).sort()).toEqual(["name", "uuid"]);
    const pageTwo = await call("queryElements", { componentUuid: page.uuid, nameContains: "Section", offset: pageOne.nextOffset, limit: 3, fields: ["uuid"] });
    expect(pageTwo.results[0].uuid).not.toBe(pageOne.results[0].uuid);
    const nodes = await call("read", { elements: pageOne.results.map((node: { uuid: string }) => ({ componentUuid: page.uuid, elementUuid: node.uuid })), view: "full", depth: "all" });
    expect(nodes.results).toHaveLength(3);
    expect(nodes.results[0].baseVariantTplTree).toContain("Detailed business content");
    const contract = await call("read", { componentUuids: [page.uuid], view: "contract" });
    expect(contract.results[0].props).toEqual([]);
    expect(contract.results[0]).not.toHaveProperty("baseVariantTplTree");
    const context = await call("read", { componentUuids: [page.uuid], view: "context" });
    expect(context.results[0].states).toEqual([]);
    expect(context.results[0].interactions).toEqual([]);
    expect(context.results[0]).not.toHaveProperty("baseVariantTplTree");
    const overview = await call("read", { fields: ["id", "components"] });
    expect(Object.keys(overview.results[0]).sort()).toEqual(["components", "id"]);
  });
  it("separates large instance values from structural reads and preserves full native values", async () => {
    const { studioCtx, call, createPage } = fixture();
    const owner = (await call("createComponent", { name: "DataCarrier", type: "component" })).created[0];
    const definition = ensure(studioCtx.site.components.find((c) => c.uuid === owner.uuid), "Definition missing");
    definition.params.push(
      mkParam({ name: "data", type: typeFactory.any(), paramType: "prop" }),
      mkParam({ name: "label", type: typeFactory.text(), paramType: "prop" }),
      mkParam({ name: "count", type: typeFactory.num(), paramType: "prop" }),
      mkParam({ name: "disabled", type: typeFactory.bool(), paramType: "prop" }),
    );
    const page = await createPage("ReadValues");
    const values = { data: Array.from({ length: 300 }, (_, id) => ({ id, text: "Large business value ".repeat(20) })), label: "Current label", count: 0, disabled: false };
    await call("insertHtml", { componentUuid: page.uuid,
      html: `<plasmic-component data-plasmic-component="DataCarrier" data-plasmic-name="Carrier" data-props='${JSON.stringify(values)}' style="width:320px"></plasmic-component>` });
    const instance = ensure(flattenTpls(page.tplTree).find(isKnownTplComponent), "Instance missing");
    const target = { componentUuid: page.uuid, elementUuid: instance.uuid };
    const full = await call("read", { componentUuids: [page.uuid], view: "full" });
    const counter = studioCtx._changeCounter;
    expect(JSON.stringify(full).length).toBeGreaterThan(100000);
    const tree = await call("read", { elements: [target] });
    expect(tree.results[0]).toMatchObject({ uuid: instance.uuid, registeredComponentUuid: definition.uuid, slots: [] });
    expect(JSON.stringify(tree)).not.toContain("Large business value");
    expect(JSON.stringify(tree)).not.toContain("320px");
    expect(JSON.stringify(tree).length).toBeLessThan(2000);
    const properties = await call("read", { elements: [target], view: "properties" });
    expect(properties.results[0].properties).toEqual(values);
    expect(properties.results[0].styles.width).toBe("320px");
    expect(properties.results[0]).not.toHaveProperty("children");
    const selected = await call("queryElements", { componentUuid: page.uuid, nameContains: "Carrier", view: "properties", propNames: ["label", "count", "disabled"] });
    expect(selected.results[0].properties).toEqual({ label: "Current label", count: 0, disabled: false });
    expect(selected.read.propNames).toEqual(["label", "count", "disabled"]);
    expect(JSON.stringify(selected)).not.toContain("Large business value");
    for (const field of ["styles", "attributes", "text"]) expect(selected.results[0]).not.toHaveProperty(field);
    const styles = await call("read", { elements: [target], view: "properties", fields: ["uuid", "styles"] });
    expect(Object.keys(styles.results[0]).sort()).toEqual(["styles", "uuid"]);
    await expect(call("read", { elements: [target], propNames: ["data"] })).rejects.toThrow("requires");
    expect(await call("read", { componentUuids: [page.uuid], view: "full" })).toEqual(full);
    expect(studioCtx._changeCounter).toBe(counter);
    const contract = (await call("read", { componentUuids: [definition.uuid], view: "contract" })).results[0];
    const complete = (await call("read", { componentUuids: [definition.uuid], view: "full" })).results[0];
    expect(contract.props).toEqual(complete.props.map(({ uuid, __type, ...prop }: Record<string, unknown>) => prop));
    expect(contract.props.every((prop: { uuid?: string }) => !prop.uuid)).toBe(true);
    expect(complete.props.every((prop: { uuid?: string }) => !!prop.uuid)).toBe(true);
    const validation = await call("validate");
    expect(validation).not.toHaveProperty("antDesign6Instances");
    expect(validation.warnings.some((warning: string) => warning.includes("Ant Design"))).toBe(false);
  });
  it("discovers collections without dumping models and paginates the complete inventory", async () => {
    const { call, createPage } = fixture();
    await createPage("First");
    await createPage("Second");
    const summary = await call("read");
    expect(summary.results[0].counts.components).toBe(2);
    expect(summary.results[0]).not.toHaveProperty("components");
    const first = await call("read", { collection: "components", limit: 1 });
    const second = await call("read", { collection: "components", offset: first.nextOffset, limit: 1 });
    const full = await call("read", { view: "full" });
    expect(first.total).toBe(2);
    expect(second.nextOffset).toBeUndefined();
    expect([...first.results[0].components, ...second.results[0].components]).toEqual(full.results[0].components);
    await call("createCanvas", { name: "Overview" });
    expect(await call("navigateCanvas", { canvasName: "Overview" })).toEqual({ canvasName: "Overview" });
  });
  it("discards unsupported CSS while applying the valid edit", async () => {
    const { call, createPage } = fixture();
    const component = await createPage();
    const result = await call("changeElement", {
      componentUuid: component.uuid,
      elementUuid: component.tplTree.uuid,
      styles: { reason: "Explain a change", width: "320px" },
    });
    expect(result.messages).toEqual([
      'Ignored unsupported CSS property "reason".',
    ]);
    const styles = RSH(
      ensureBaseVariantSetting(component.tplTree).rs,
      component.tplTree,
    );
    expect(styles.getRaw("width")).toBe("320px");
    expect(styles.has("reason")).toBe(false);
  });

  it("reads installed contracts while keeping other pages and imported mutations outside scope", async () => {
    const librarySite = createSite();
    const library = mkComponent({
      name: "InstalledForm",
      type: ComponentType.Plain,
      tplTree: mkTplTagX("div"),
    });
    librarySite.components.push(library);
    const site = createSite();
    site.projectDependencies.push(
      new ProjectDependency({
        name: "Forms",
        pkgId: "forms-pkg",
        projectId: "forms-project",
        version: "1.0.0",
        uuid: "forms-dependency",
        site: librarySite,
      }),
    );
    const { studioCtx, call, createPage } = fixture(site);
    studioCtx.tplMgr().ensureBaseVariantSetting(library.tplTree);
    const page = await createPage("ContractConsumer");
    const other = await createPage("UnrelatedPage");
    const context = await call("getEditorContext");
    const binding = {
      projectId: context.projectId,
      branchId: context.branchId,
      sessionId: context.sessionId,
      changeCounter: context.changeCounter,
      componentUuid: page.uuid,
      elementUuids: [page.tplTree.uuid],
    };
    const history = studioCtx.undoLog._log.length;
    const beginActivity = vi.spyOn(studioCtx.copilotActivity, "begin");
    const result = await call("executeLocalEdit", {
      binding,
      name: "read",
      input: { view: "full", componentUuids: [library.uuid] },
    });
    expect(JSON.parse(result.result).results[0]).toMatchObject({
      name: "InstalledForm",
      uuid: library.uuid,
    });
    await expect(call("executeLocalEdit", {
      binding,
      name: "read",
      input: { view: "full", componentUuids: [other.uuid] },
    })).rejects.toThrow("bound page/canvas");
    expect(beginActivity).not.toHaveBeenCalled();
    await expect(
      call("executeLocalEdit", {
        binding,
        name: "changeElement",
        input: {
          componentUuid: library.uuid,
          elementUuid: library.tplTree.uuid,
          styles: { padding: "16px" },
        },
      }),
    ).rejects.toThrow("in this project");
    expect(studioCtx.undoLog._log.length).toBe(history);
    expect(studioCtx._changeCounter).toBe(binding.changeCounter);
    studioCtx.copilotActivity.dispose();
    beginActivity.mockRestore();
  });
  it("edits existing page state and event steps with stable identities and native undo", async () => {
    const { studioCtx, call, createPage } = fixture();
    const page = await createPage("ExistingEditing");
    const other = await createPage("OtherEditing");
    await call("insertHtml", {
      componentUuid: page.uuid,
      html: '<button data-plasmic-name="CreateRecord">Create</button>',
    });
    const button = ensure(
      flattenTpls(page.tplTree).find(
        (tpl) => "name" in tpl && tpl.name === "CreateRecord",
      ),
      "Button missing",
    );
    const context = await call("getEditorContext");
    let binding = {
      projectId: context.projectId,
      branchId: context.branchId,
      sessionId: context.sessionId,
      changeCounter: context.changeCounter,
      componentUuid: page.uuid,
      elementUuids: [] as string[],
    };
    const edit = async (name: string, input: Record<string, unknown>) => {
      const result = await call("executeLocalEdit", { binding, name, input });
      binding = result.binding;
      return result;
    };
    await edit("createState", {
      componentUuid: page.uuid,
      name: "createOpen",
      variableType: "boolean",
      initialValue: false,
    });
    const readPage = async () =>
      (await call("read", { view: "full", componentUuids: [page.uuid] })).results[0];
    const state = (await readPage()).states.find(
      (entry: { name: string }) => entry.name === "createOpen",
    );
    expect(state).toBeTruthy();
    const changedState = await edit("updateState", {
      componentUuid: page.uuid,
      stateUuid: state.uuid,
      initialValue: true,
    });
    expect(changedState.before).toContain('"initialValue":false');
    expect(changedState.after).toContain('"initialValue":true');
    await edit("undo", {});
    await edit("createInteraction", {
      componentUuid: page.uuid,
      elementUuid: button.uuid,
      eventName: "onClick",
      name: "OpenCreate",
      action: {
        actionName: "customFunction",
        code: "$state.createOpen = true",
      },
    });
    const step = (await readPage()).interactions[0];
    const subtree = await edit("read", { view: "full",
      elements: [{ componentUuid: page.uuid, elementUuid: button.uuid }],
    });
    expect(JSON.parse(subtree.result).results[0].interactions[0].uuid).toBe(
      step.uuid,
    );
    await edit("updateInteraction", {
      componentUuid: page.uuid,
      elementUuid: button.uuid,
      interactionUuid: step.uuid,
      name: "ToggleCreate",
      action: {
        actionName: "customFunction",
        code: "$state.createOpen = !$state.createOpen",
      },
    });
    expect((await readPage()).interactions[0]).toMatchObject({
      uuid: step.uuid,
      name: "ToggleCreate",
      code: "$state.createOpen = !$state.createOpen",
    });
    await expect(
      edit("updateInteraction", {
        componentUuid: other.uuid,
        elementUuid: other.tplTree.uuid,
        interactionUuid: step.uuid,
        name: "Wrong",
      }),
    ).rejects.toThrow("outside");
    await expect(
      edit("updateInteraction", {
        componentUuid: page.uuid,
        elementUuid: page.tplTree.uuid,
        interactionUuid: step.uuid,
        name: "Wrong",
      }),
    ).rejects.toThrow("not found");
    await edit("deleteInteraction", {
      componentUuid: page.uuid,
      elementUuid: button.uuid,
      interactionUuid: step.uuid,
    });
    expect((await readPage()).interactions).toEqual([]);
    await edit("undo", {});
    expect((await readPage()).interactions[0].uuid).toBe(step.uuid);
    expect(
      flattenTpls(page.tplTree).find((tpl) => tpl.uuid === button.uuid),
    ).toBe(button);
    binding = { ...binding, elementUuids: [button.uuid] };
    await edit("createState", {
      componentUuid: page.uuid,
      name: "selectionState",
      variableType: "boolean",
      initialValue: false,
    });
    await edit("executeBatch", {
      operations: [{
        name: "updateState",
        input: {
          componentUuid: page.uuid,
          stateUuid: state.uuid,
          initialValue: true,
        },
      }],
    });
    expect((await readPage()).states.find((entry: { uuid: string }) => entry.uuid === state.uuid).initialValue).toBe(true);
    expect((await readPage()).states.some((entry: { name: string }) => entry.name === "selectionState")).toBe(true);
    studioCtx.copilotActivity.dispose();
  });

  it("creates one page, scopes state and interactions, and preserves other page viewports", async () => {
    const { studioCtx, call, createPage } = fixture();
    const existing = await createPage("Existing");
    studioCtx.appCtx.appConfig.enableLocalAiPageGeneration = true;
    const context = await call("getEditorContext");
    let binding = {
      projectId: context.projectId,
      branchId: context.branchId,
      sessionId: context.sessionId,
      changeCounter: context.changeCounter,
      componentUuid: null as string | null,
      elementUuids: [],
      mode: "page",
    };
    const edit = async (name: string, input: Record<string, unknown>) => {
      const result = await call("executeLocalEdit", { binding, name, input });
      binding = result.binding;
      return result;
    };
    const created = await edit("createComponent", {
      name: "Generated",
      type: "page",
      path: "/generated",
    });
    const page = ensure(
      studioCtx.site.components.find((c) => c.uuid === binding.componentUuid),
      "New page missing",
    );
    expect(created.changed).toBe(true);
    await expect(
      edit("createComponent", {
        name: "Another",
        type: "page",
        path: "/another",
      }),
    ).rejects.toThrow("exactly one");
    await expect(
      edit("createState", {
        componentUuid: existing.uuid,
        name: "wrong",
        variableType: "boolean",
        initialValue: false,
      }),
    ).rejects.toThrow("outside");
    await edit("createState", {
      componentUuid: page.uuid,
      name: "createOpen",
      variableType: "boolean",
      initialValue: false,
    });
    await edit("insertHtml", {
      componentUuid: page.uuid,
      html: '<button data-plasmic-name="CreateRecord">Create</button>',
    });
    const button = ensure(
      flattenTpls(page.tplTree).find(
        (tpl) => "name" in tpl && tpl.name === "CreateRecord",
      ),
      "Button missing",
    );
    const wired = await edit("createInteraction", {
      componentUuid: page.uuid,
      elementUuid: button.uuid,
      eventName: "onClick",
      name: "OpenCreate",
      action: {
        actionName: "updateVariable",
        variable: ["createOpen"],
        operation: "NewValue",
        value: "{{ true }}",
      },
    });
    expect(wired.after).toContain("OpenCreate");
    const readback = (await call("read", { view: "full", componentUuids: [page.uuid] }))
      .results[0];
    expect(readback.states).toHaveLength(1);
    expect(readback.interactions).toHaveLength(1);
    await edit("undo", {});
    expect(
      (await call("read", { view: "full", componentUuids: [page.uuid] })).results[0]
        .interactions ?? [],
    ).toHaveLength(0);
    const untouched = studioCtx.site.pageArenas
      .find((arena) => arena.component === existing)
      ?.matrix.rows.map((row) =>
        row.cols.map((col) => [
          col.frame.uuid,
          col.frame.width,
          col.frame.height,
        ]),
      );
    await expect(
      edit("setPageViewport", { preset: "Desktop" }),
    ).rejects.toThrow("required");
    await edit("setPageViewport", {
      componentUuid: page.uuid,
      preset: "Desktop",
    });
    expect(
      studioCtx.site.pageArenas
        .find((arena) => arena.component === existing)
        ?.matrix.rows.map((row) =>
          row.cols.map((col) => [
            col.frame.uuid,
            col.frame.width,
            col.frame.height,
          ]),
        ),
    ).toEqual(untouched);
    studioCtx.copilotActivity.dispose();
  });

  it("gates creation and can undo the native new-page transaction", async () => {
    const { studioCtx, call } = fixture();
    studioCtx.createViewStateUndoRecord();
    const context = await call("getEditorContext");
    const binding = {
      projectId: context.projectId,
      branchId: context.branchId,
      sessionId: context.sessionId,
      changeCounter: context.changeCounter,
      componentUuid: null,
      elementUuids: [],
      mode: "page",
    };
    const request = {
      binding,
      name: "createComponent",
      input: { name: "Generated", type: "page", path: "/generated" },
    };
    await expect(call("executeLocalEdit", request)).rejects.toThrow("disabled");
    studioCtx.appCtx.appConfig.enableLocalAiPageGeneration = true;
    const created = await call("executeLocalEdit", request);
    const undone = await call("executeLocalEdit", {
      binding: created.binding,
      name: "undo",
      input: {},
    });
    expect(undone.binding.componentUuid).toBeNull();
    expect(studioCtx.site.components).toHaveLength(0);
    studioCtx.copilotActivity.dispose();
  });

  it("keeps local JSON results independent of an external MCP XML session", async () => {
    const { studioCtx, call, createPage } = fixture();
    const page = await createPage("OutputFormat");
    const context = await call("getEditorContext");
    const binding = {
      projectId: context.projectId,
      branchId: context.branchId,
      sessionId: context.sessionId,
      changeCounter: context.changeCounter,
      componentUuid: page.uuid,
      elementUuids: [],
    };
    studioCtx.setPreferredAiOutputFormat("xml");
    const result = await call("executeLocalEdit", {
      binding,
      name: "read",
      input: { view: "full", componentUuids: [page.uuid] },
    });
    expect(JSON.parse(result.result).results[0].name).toBe("OutputFormat");
    expect(studioCtx.preferredAiOutputFormat()).toBe("xml");
    const jsonContext = await COPILOT_TOOLS.getEditorContext.execute(
      studioCtx,
      {},
      { outputFormat: "json" },
    );
    expect(JSON.parse(jsonContext).projectId).toBe(binding.projectId);
    studioCtx.copilotActivity.dispose();
  });
  it("rejects a project edit if human editing occurred during async HTML preparation", async () => {
    const { studioCtx, call, createPage } = fixture();
    const page = await createPage("ConcurrentEdit");
    await call("insertHtml", {
      componentUuid: page.uuid,
      html: '<p data-plasmic-name="Title">Before</p>',
    });
    const title = ensure(
      flattenTpls(page.tplTree).find(
        (tpl) => "name" in tpl && tpl.name === "Title",
      ),
      "Title missing",
    );
    const context = await call("getEditorContext");
    const binding = {
      projectId: context.projectId,
      branchId: context.branchId,
      sessionId: context.sessionId,
      changeCounter: context.changeCounter,
      componentUuid: page.uuid,
      elementUuids: [],
    };
    let entered = () => {};
    let release = () => {};
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const paused = new Promise<void>((resolve) => {
      release = resolve;
    });
    const original = htmlImporter.htmlToTpl;
    const spy = vi
      .spyOn(htmlImporter, "htmlToTpl")
      .mockImplementationOnce(async (...args) => {
        const result = await original(...args);
        entered();
        await paused;
        return result;
      });
    const pending = call("executeLocalEdit", {
      binding,
      name: "insertHtml",
      input: { componentUuid: page.uuid, html: "<p>AI insertion</p>" },
    });
    await started;
    await call("changeElement", {
      componentUuid: page.uuid,
      elementUuid: title.uuid,
      text: "Human edit",
    });
    release();
    await expect(pending).rejects.toThrow("design changed");
    const result = JSON.stringify(
      await call("read", { view: "full", componentUuids: [page.uuid] }),
    );
    expect(result).toContain("Human edit");
    expect(result).not.toContain("AI insertion");
    spy.mockRestore();
    studioCtx.copilotActivity.dispose();
  });
  it("keeps node identities and rejects component root changes or stale writes", async () => {
    const { studioCtx, call, createPage } = fixture();
    const page = await createPage("ScopedEditing");
    await call("insertHtml", {
      componentUuid: page.uuid,
      html: '<section data-plasmic-name="EditRegion"><p data-plasmic-name="Title">Before</p></section><p data-plasmic-name="Outside">Untouched</p>',
    });
    const region = ensure(
      flattenTpls(page.tplTree).find(
        (t) => "name" in t && t.name === "EditRegion",
      ),
      "Region missing",
    );
    const title = ensure(
      flattenTpls(region).find((t) => "name" in t && t.name === "Title"),
      "Title missing",
    );
    const outside = ensure(
      flattenTpls(page.tplTree).find(
        (t) => "name" in t && t.name === "Outside",
      ),
      "Outside missing",
    );
    const context = await call("getEditorContext");
    const binding = {
      projectId: context.projectId,
      branchId: context.branchId,
      sessionId: context.sessionId,
      changeCounter: context.changeCounter,
      componentUuid: page.uuid,
      elementUuids: [region.uuid],
    };
    const beforeOutside = JSON.stringify(
      (
        await call("read", { view: "full",
          elements: [{ componentUuid: page.uuid, elementUuid: outside.uuid }],
        })
      ).results,
    );
    const edit = (
      name: string,
      input: Record<string, unknown>,
      guard = binding,
    ) => call("executeLocalEdit", { binding: guard, name, input });
    await expect(
      edit("deleteElement", {
        componentUuid: page.uuid,
        elementUuid: page.tplTree.uuid,
      }),
    ).rejects.toThrow("component root identity");
    await expect(
      edit("insertHtml", {
        componentUuid: page.uuid,
        elementUuid: page.tplTree.uuid,
        location: "before",
        html: "<p>Outside</p>",
      }),
    ).rejects.toThrow("component root identity");
    for (const patch of [
      { projectId: "other" },
      { branchId: "other" },
      { sessionId: "other" },
    ]) {
      await expect(
        edit(
          "changeElement",
          { componentUuid: page.uuid, elementUuid: title.uuid, text: "Wrong" },
          { ...binding, ...patch },
        ),
      ).rejects.toThrow("session changed");
    }
    const count = studioCtx.undoLog._log.length;
    const result = await edit("executeBatch", {
      operations: [
        {
          name: "changeElement",
          input: {
            componentUuid: page.uuid,
            elementUuid: title.uuid,
            text: "After",
          },
        },
        {
          name: "changeElement",
          input: {
            componentUuid: page.uuid,
            elementUuid: region.uuid,
            styles: { padding: "24px" },
          },
        },
      ],
    });
    expect(result.changed).toBe(true);
    expect(result.before).toContain("Before");
    expect(result.after).toContain("After");
    expect(flattenTpls(region).find((t) => t.uuid === title.uuid)).toBe(title);
    expect(studioCtx.undoLog._log.length).toBe(count + 1);
    expect(
      JSON.stringify(
        (
          await call("read", { view: "full",
            elements: [{ componentUuid: page.uuid, elementUuid: outside.uuid }],
          })
        ).results,
      ),
    ).toBe(beforeOutside);
    await expect(
      edit("changeElement", {
        componentUuid: page.uuid,
        elementUuid: title.uuid,
        text: "Stale",
      }),
    ).rejects.toThrow("design changed");
    await edit("undo", {}, result.binding);
    expect(
      JSON.stringify(
        await call("read", { view: "full",
          elements: [{ componentUuid: page.uuid, elementUuid: title.uuid }],
        }),
      ),
    ).toContain("Before");
    studioCtx.copilotActivity.dispose();
  });

  it.each([false, true])("edits only the pages in the bound canvas in one undoable transaction with selection=%s", async (selected) => {
    const { studioCtx, call, createPage } = fixture();
    const first = await createPage("FirstPage");
    const second = await createPage("SecondPage");
    const outside = await createPage("OutsideCanvas");
    await call("createCanvas", { name: "PageGroup" });
    for (const page of [first, second]) {
      await call("createArtboard", { canvasName: "PageGroup", componentUuid: page.uuid, width: 1440, height: 900 });
    }
    const context = await call("getEditorContext");
    const binding = {
      projectId: context.projectId,
      branchId: context.branchId,
      sessionId: context.sessionId,
      changeCounter: context.changeCounter,
      componentUuid: selected ? first.uuid : null,
      canvasName: "PageGroup",
      elementUuids: selected ? [first.tplTree.uuid] : [],
    };
    await expect(call("executeLocalEdit", { binding, name: "read", input: { componentUuids: [outside.uuid] } })).rejects.toThrow("bound page/canvas");
    await expect(call("executeLocalEdit", { binding, name: "changeElement", input: { componentUuid: outside.uuid, elementUuid: outside.tplTree.uuid, styles: { padding: "99px" } } })).rejects.toThrow("outside");
    await expect(call("executeLocalEdit", { binding, name: "navigate", input: { componentUuid: outside.uuid } })).rejects.toThrow("outside");
    const canvas = ensure(studioCtx.site.arenas.find((arena) => arena.name === "PageGroup"), "Canvas missing");
    const secondFrame = ensure(canvas.children.find((frame) => frame.container.component === second), "Second artboard missing");
    const switchArena = vi.spyOn(studioCtx, "switchToArena").mockImplementation(() => undefined);
    const focusFrame = vi.spyOn(studioCtx, "setStudioFocusOnFrame").mockImplementation(() => undefined);
    const switchComponent = vi.spyOn(studioCtx, "switchToComponentArena");
    await call("executeLocalEdit", { binding, name: "navigate", input: { componentUuid: second.uuid } });
    expect(switchArena).toHaveBeenCalledWith(canvas);
    expect(focusFrame).toHaveBeenCalledWith({ frame: secondFrame, autoZoom: true });
    expect(switchComponent).not.toHaveBeenCalled();
    switchArena.mockRestore();
    focusFrame.mockRestore();
    switchComponent.mockRestore();
    await expect(call("executeLocalEdit", { binding, name: "selectElement", input: { componentUuid: second.uuid, elementUuid: second.tplTree.uuid, frameUuid: "outside-frame" } })).rejects.toThrow("bound canvas");
    const select = vi.spyOn(COPILOT_TOOLS.selectElement, "execute").mockResolvedValue("{}");
    await call("executeLocalEdit", { binding, name: "selectElement", input: { componentUuid: second.uuid, elementUuid: second.tplTree.uuid } });
    expect(select).toHaveBeenCalledTimes(1);
    expect(select.mock.calls[0][1]).toEqual({ componentUuid: second.uuid, elementUuid: second.tplTree.uuid, frameUuid: secondFrame.uuid, instanceIndex: 0 });
    expect(select.mock.calls[0][2]).toEqual({ outputFormat: "json" });
    select.mockRestore();
    const history = studioCtx.undoLog._log.length;
    const result = await call("executeLocalEdit", {
      binding,
      name: "executeBatch",
      input: { operations: [first, second].map((page) => ({
        name: "changeElement",
        input: { componentUuid: page.uuid, elementUuid: page.tplTree.uuid, styles: { padding: "24px" } },
      })) },
    });
    expect(result.changed).toBe(true);
    expect(JSON.parse(result.before).results.map((resource: { uuid: string }) => resource.uuid)).toEqual([first.uuid, second.uuid]);
    expect(result.after).toContain("24px");
    expect(studioCtx.undoLog._log.length).toBe(history + 1);
    const checked = await call("executeLocalEdit", { binding: result.binding, name: "validate", input: {} });
    expect(JSON.parse(checked.result)).toMatchObject({ valid: true, components: 2 });
    await call("executeLocalEdit", { binding: result.binding, name: "undo", input: {} });
    const restored = await call("read", { view: "full", componentUuids: [first.uuid, second.uuid] });
    const prior = JSON.parse(result.before).results;
    expect(restored.results.map((model: Record<string, unknown>, index: number) => Object.fromEntries(Object.keys(prior[index]).map((key) => [key, model[key]])))).toEqual(prior);
    studioCtx.copilotActivity.dispose();
  });

  it("rolls back a canvas batch and rejects unsupported tools", async () => {
    const { studioCtx, call, createPage } = fixture();
    const page = await createPage("ScopedRollback");
    await call("insertHtml", {
      componentUuid: page.uuid,
      html: '<p data-plasmic-name="Title">Original</p>',
    });
    const title = ensure(
      flattenTpls(page.tplTree).find((t) => "name" in t && t.name === "Title"),
      "Title missing",
    );
    const context = await call("getEditorContext");
    const binding = {
      projectId: context.projectId,
      branchId: context.branchId,
      sessionId: context.sessionId,
      changeCounter: context.changeCounter,
      componentUuid: page.uuid,
      elementUuids: [],
    };
    const before = await call("read", { view: "full", componentUuids: [page.uuid] });
    await expect(
      call("executeLocalEdit", {
        binding,
        name: "executeBatch",
        input: {
          operations: [
            {
              name: "changeElement",
              input: {
                componentUuid: page.uuid,
                elementUuid: title.uuid,
                text: "Should roll back",
              },
            },
            {
              name: "changeElement",
              input: {
                componentUuid: page.uuid,
                elementUuid: title.uuid,
                props: { invalid: true },
              },
            },
          ],
        },
      }),
    ).rejects.toThrow("component instance");
    expect(await call("read", { view: "full", componentUuids: [page.uuid] })).toEqual(before);
    await expect(
      call("executeLocalEdit", {
        binding,
        name: "executeBatch",
        input: {
          operations: [
            {
              name: "createStyleToken",
              input: {
                name: "Global",
                type: "Color",
                value: "#000000",
              },
            },
          ],
        },
      }),
    ).rejects.toThrow("not allowed");
    studioCtx.copilotActivity.dispose();
  });
  it("reads configured query definitions with edit permission denied and leaves design state unchanged", async () => {
    const { studioCtx, call, createPage } = fixture();
    const page = await createPage("QueryInspection");
    const op = customCode("$props.records");
    const query = mkServerQuery("Records", op);
    runInAction(() => page.serverQueries.push(query));
    vi.spyOn(studioCtx, "canEditProject").mockReturnValue(false);
    expect(
      (
        await call("identify", {
          model: "test",
          client: "test",
          skill: "plasmic",
          outputFormat: "json",
        })
      ).canEdit,
    ).toBe(false);
    const history = studioCtx.undoLog._log.length;
    const result = await call("read", { view: "full", componentUuids: [page.uuid] });
    expect(result.results[0].dataQueries).toEqual([
      {
        __type: "DataQuery",
        name: "Records",
        uuid: query.uuid,
        reference: "$q.records",
        kind: "customCode",
        code: op.code,
      },
    ]);
    expect(page.serverQueries).toEqual([query]);
    expect(studioCtx.undoLog._log).toHaveLength(history);
    studioCtx.copilotActivity.dispose();
  });
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
    const reset = await call("changeElement", {
        componentUuid: page.uuid,
        elementUuid: instance.uuid,
        resetProps: ["configuration", "missing"],
      });
    expect(reset.messages).toEqual(['Ignored reset of unknown component prop "missing".']);
    expect(arg("configuration")).toBeUndefined();
    await call("changeElement", {
      componentUuid: page.uuid,
      elementUuid: instance.uuid,
      resetProps: ["footer"],
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
  it("reports native project counts, current canvas name and save state without changing the model", async () => {
    const { studioCtx, call, createPage } = fixture();
    await createPage("Overview");
    await createPage("Detail");
    await call("createComponent", {name:"SharedPanel",type:"component"});
    await call("createCanvas", {name:"BusinessFlow"});
    await call("navigateCanvas", {canvasName:"BusinessFlow"});
    const before = await call("read", {view:"full"});
    const context = await call("getEditorContext");
    expect(context.projectSummary).toEqual({pages:2,components:1});
    expect(context.canvasName).toBe("BusinessFlow");
    expect(context.saveStatus).toBe(studioCtx.saveStatus);
    expect(await call("read", {view:"full"})).toEqual(before);
    studioCtx.copilotActivity.dispose();
  });
  it("reports a blocked editor as non-editable", async () => {
    const { studioCtx, call } = fixture();
    studioCtx.blockChanges = true;
    expect(await call("getEditorContext")).toMatchObject({ canEdit: false });
    studioCtx.copilotActivity.dispose();
  });
  it("binds an open page before a canvas or element is focused", async () => {
    const { studioCtx, call, createPage } = fixture();
    const page = await createPage("OpenPage");
    vi.spyOn(studioCtx, "currentArena", "get").mockReturnValue(
      ensure(
        studioCtx.site.pageArenas.find((arena) => arena.component === page),
        "Page arena missing",
      ),
    );
    vi.spyOn(studioCtx, "focusedViewCtx").mockReturnValue(undefined);
    expect(await call("getEditorContext")).toMatchObject({
      componentUuid: page.uuid,
      selectedElementUuids: [],
      path: [],
      mode: "edit",
    });
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
        componentName: "SQL",
        path: "/sql",
        width: 1440,
        height: 1024,
      },
    });
    previewFrame.remove();
    studioCtx.copilotActivity.dispose();
  });
  it("opens native Preview with a temporary viewport without changing Page models or device columns", async () => {
    const { studioCtx, call, createPage } = fixture();
    const page = await createPage("List");
    vi.spyOn(studioCtx, "awaitStudioReady").mockResolvedValue();
    const before = await call("read", { view: "full" });
    const preview = {
      isLive: false, popup: undefined as Window | undefined,
      component: page, previewPath: "list", width: 1440, height: 1024,
      toggleLiveMode: vi.fn(async () => { preview.isLive = !preview.isLive; }),
      stopLiveMode: vi.fn(() => { preview.isLive = false; }),
      parseRoute: vi.fn(async () => {}),
      pushComponent: vi.fn(async () => {}),
      pushViewport: vi.fn(async (value: { width: number; height: number }) => { preview.width = value.width; preview.height = value.height; }),
    };
    Object.assign(studioCtx, { previewCtx: preview });
    await expect(call("preview", { action: "open", width: 1440 })).rejects.toThrow("supplied together");
    expect(preview.toggleLiveMode).not.toHaveBeenCalled();
    expect(await call("preview", { action: "open", componentUuid: page.uuid, width: 1440, height: 720 })).toEqual({
      mode: "preview", componentUuid: page.uuid, path: "/list", width: 1440, height: 720, canGoBack: false, canGoForward: false,
    });
    expect(preview.pushComponent).toHaveBeenCalledWith(page);
    expect(preview.pushViewport).toHaveBeenCalledWith({ viewport: "custom", width: 1440, height: 720 });
    await expect(call("preview", { action: "close", height: 720, width: 1440 })).rejects.toThrow("close accepts no");
    expect(await call("preview", { action: "close" })).toEqual({ mode: "edit", componentUuid: null, path: null, width: null, height: null, canGoBack: false, canGoForward: false });
    expect(await call("read", { view: "full" })).toEqual(before);
    preview.popup = {} as Window;
    await expect(call("preview", { action: "open" })).rejects.toThrow("external Preview");
    studioCtx.copilotActivity.dispose();
  });
  it("delegates Preview navigation and refresh without opening Preview or editing models", async () => {
    const { studioCtx, call } = fixture();
    const preview = {
      isLive: false, popup: undefined, component: undefined,
      previewPath: "groups", width: 1440, height: 900,
      canGoBack: true, canGoForward: false,
      parseRoute: vi.fn().mockResolvedValue(undefined),
      goBack: vi.fn(async () => { preview.canGoBack = false; preview.canGoForward = true; }),
      goForward: vi.fn(async () => { preview.canGoBack = true; preview.canGoForward = false; }),
      refresh: vi.fn(), toggleLiveMode: vi.fn(),
    };
    Object.assign(studioCtx, { previewCtx: preview });
    const before = await call("read", { view: "full" });
    for (const action of ["back", "forward", "refresh"]) {
      await expect(call("preview", { action })).rejects.toThrow("Open native Preview before");
    }
    preview.isLive = true;
    expect(await call("preview", { action: "back" })).toMatchObject({ mode: "preview", canGoBack: false, canGoForward: true });
    expect(await call("preview", { action: "forward" })).toMatchObject({ mode: "preview", canGoBack: true, canGoForward: false });
    expect(await call("preview", { action: "refresh" })).toMatchObject({ mode: "preview", canGoBack: true, canGoForward: false });
    expect(preview.goBack).toHaveBeenCalledOnce();
    expect(preview.goForward).toHaveBeenCalledOnce();
    expect(preview.refresh).toHaveBeenCalledOnce();
    expect(preview.toggleLiveMode).not.toHaveBeenCalled();
    await expect(call("preview", { action: "back", width: 1440, height: 900 })).rejects.toThrow("back accepts no");
    expect(await call("read", { view: "full" })).toEqual(before);
    studioCtx.copilotActivity.dispose();
  });
  it("closes a different Preview Page back to the original overview artboard and viewport, awaiting canvas recovery", async () => {
    const { studioCtx, call, createPage } = fixture();
    const original = await createPage("Original");
    const target = await createPage("Target");
    const arena = ensure(studioCtx.site.arenas[0], "Overview missing");
    const frame = ensure(arena.children.find((f) => f.container.component === original), "Original artboard missing");
    studioCtx.currentArena = arena;
    vi.spyOn(studioCtx, "focusedFrame").mockReturnValue(frame);
    const viewport = mockDeepAuto<ViewportCtx>();
    viewport.scale.mockReturnValue(0.75);
    viewport.scroll.mockReturnValue(new Pt(123, 456));
    viewport.canvasPadding.mockReturnValue(Pt.zero());
    vi.spyOn(studioCtx, "viewportCtx", "get").mockReturnValue(viewport);
    const releases: Array<() => void> = [];
    const ready = vi.spyOn(studioCtx, "awaitStudioReady").mockImplementation(() => new Promise<void>((resolve) => { releases.push(resolve); }));
    const restored = vi.spyOn(studioCtx, "restoreStudioViewportSnapshot").mockReturnValue(undefined);
    const preview = {
      isLive: false, component: target, previewPath: "target", width: 1440, height: 1024, popup: undefined,
      toggleLiveMode: vi.fn(async () => { preview.isLive = true; }),
      stopLiveMode: vi.fn(async () => { preview.isLive = false; }),
      parseRoute: vi.fn().mockResolvedValue(undefined), pushComponent: vi.fn().mockResolvedValue(undefined),
    };
    Object.assign(studioCtx, { previewCtx: preview });
    const model = await call("read", { view: "full" });
    await call("preview", { action: "open", componentUuid: target.uuid });
    studioCtx.currentArena = ensure(studioCtx.site.pageArenas.find((a) => a.component === target), "Target arena missing");
    let done = false;
    const close = call("preview", { action: "close" }).then((result) => { done = true; return result; });
    await vi.waitFor(() => expect(ready).toHaveBeenCalledTimes(1));
    expect(done).toBe(false);
    expect(restored).not.toHaveBeenCalled();
    ready.mockResolvedValue(); ensure(releases[0], "Canvas readiness was not requested")();
    expect(await close).toMatchObject({ mode: "edit" });
    expect(studioCtx.currentArena).toBe(arena);
    expect(restored).toHaveBeenCalledWith({ focusedArenaFrame: frame, scale: 0.75, scroll: new Pt(123, 456), canvasPadding: Pt.zero() }, true);
    await call("preview", { action: "close" });
    expect(restored).toHaveBeenCalledTimes(1);
    await call("preview", { action: "open", componentUuid: target.uuid });
    preview.isLive = false;
    const manuallySelected = ensure(studioCtx.site.pageArenas.find((a) => a.component === target), "Target arena missing");
    studioCtx.currentArena = manuallySelected;
    await call("preview", { action: "close" });
    expect(studioCtx.currentArena).toBe(manuallySelected);
    expect(restored).toHaveBeenCalledTimes(1);
    expect(await call("read", { view: "full" })).toEqual(model);
    studioCtx.copilotActivity.dispose();
  });
  it.each(["read", "queryElements"])(
    "keeps successful and failed %s calls silent without writing feedback into the site",
    async (name) => {
      const { studioCtx, call, createPage } = fixture();
      const page = await createPage("Scan");
      studioCtx.copilotActivity.dispose();
      const change = vi.spyOn(studioCtx, "changeObserved");
      const beginActivity = vi.spyOn(studioCtx.copilotActivity, "begin");
      const selected = studioCtx.focusedViewCtx();
      const input =
        name === "read"
          ? { elements: [{ componentUuid: page.uuid, elementUuid: page.tplTree.uuid }] }
          : { componentUuid: page.uuid };
      await call(name, input);
      expect(change).not.toHaveBeenCalled();
      expect(studioCtx.focusedViewCtx()).toBe(selected);
      expect(studioCtx.copilotActivity.requests).toHaveLength(0);
      await expect(
        call(
          name,
          name === "read"
            ? { componentUuids: ["missing"] }
            : { componentUuid: "missing" },
        ),
      ).rejects.toThrow("not found");
      expect(studioCtx.copilotActivity.requests).toHaveLength(0);
      expect(beginActivity).not.toHaveBeenCalled();
      await expect(call(name, { unknown: true })).rejects.toThrow();
      expect(studioCtx.copilotActivity.requests).toHaveLength(0);
      studioCtx.copilotActivity.dispose();
      change.mockRestore();
      beginActivity.mockRestore();
    },
  );
  it("tracks actual edits and returns failures to the agent without retaining failure feedback", async () => {
    const { studioCtx, call, createPage } = fixture();
    const page = await createPage("Scan");
    studioCtx.copilotActivity.dispose();
    const caller = { id: "codex", name: "Codex" };
    await COPILOT_TOOLS.executeBatch.execute(studioCtx, {
      operations: [
        {
          name: "changeElement",
          input: {
            componentUuid: page.uuid,
            elementUuid: page.tplTree.uuid,
            styles: { color: "red" },
          },
        },
      ],
    }, { caller });
    expect(studioCtx.copilotActivity.requests[0]).toMatchObject({
      caller,
      status: "success",
      targets: [{ componentUuid: page.uuid, elementUuid: page.tplTree.uuid }],
    });
    await expect(
      call("deleteElement", {
        componentUuid: page.uuid,
        elementUuid: "missing",
      }),
    ).rejects.toThrow("not found");
    expect(studioCtx.copilotActivity.requests).toHaveLength(1);
    expect(studioCtx.copilotActivity.requests[0].status).toBe("success");
    studioCtx.copilotActivity.dispose();
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
      viewMode: "stretch",
    });
    expect(frame.width).toBe(1440);
    expect(frame.height).toBe(1024);
    expect(frame.viewMode).toBe("stretch");

    const comp = mkComponent({
      name: "Widget",
      type: ComponentType.Plain,
      tplTree: mkTplTagX("div"),
    });
    studioCtx.site.components.push(comp);
    trackComponentSite(comp, studioCtx.site);
    studioCtx.tplMgr().ensureBaseVariantSetting(comp.tplTree);
    await call("createArtboard", {
      canvasName: "Draft",
      componentUuid: comp.uuid,
      width: 1440,
      height: 1024,
    });
    const compFrame = arena.children[1];
    expect(compFrame.viewMode).toBe("centered");
    await call("updateArtboard", {
      canvasName: "Draft",
      frameUuid: compFrame.uuid,
      viewMode: "stretch",
    });
    expect(compFrame.viewMode).toBe("stretch");
    await call("updateArtboard", {
      canvasName: "Draft",
      frameUuid: compFrame.uuid,
      viewMode: "centered",
    });
    expect(compFrame.viewMode).toBe("centered");

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
  it("deletes the active canvas through native view cleanup and keeps metadata readable", async () => {
    const { studioCtx, call, createPage } = fixture();
    const page = await createPage();
    await call("createCanvas", { name: "Temporary" });
    await call("createArtboard", { canvasName: "Temporary", componentUuid: page.uuid, width: 1440, height: 1024 });
    const arena = ensure(studioCtx.site.arenas.find((a) => a.name === "Temporary"), "Missing canvas");
    studioCtx.switchToArena(arena);
    const vc = ensure(studioCtx.tryGetViewCtxForFrame(arena.children[0]), "Missing view");
    studioCtx.setStudioFocusOnFrame({ frame: arena.children[0], autoZoom: false });
    const disposedWhenClearing: boolean[] = [];
    const clearFocus = vc.clearViewCtxFocus.bind(vc);
    vi.spyOn(vc, "clearViewCtxFocus").mockImplementation(() => {
      disposedWhenClearing.push(vc.isDisposed);
      clearFocus();
    });
    await call("deleteCanvas", { canvasName: "Temporary" });
    expect(studioCtx.currentArena).not.toBe(arena);
    expect(studioCtx.viewCtxs.includes(vc)).toBe(false);
    expect(disposedWhenClearing).toEqual([false]);
    expect(studioCtx.site.components).toContain(page);
    expect(await call("getEditorContext")).toBeDefined();
    await call("undo");
    expect(studioCtx.site.arenas).toContain(arena);
    expect(arena.children).toHaveLength(1);
  });

  it("rejects non-slot props used as slots without corrupting detached HTML variants", async () => {
    const site = createSite();
    const meta = { name: "InputField", importPath: "./input", props: { placeholder: "string", children: "slot" } } as const;
    const definition = mkCodeComponent(meta.name, meta, {});
    const children = mkParam({ name: "children", paramType: "slot", type: typeFactory.renderable() });
    definition.params.push(mkParam({ name: "placeholder", paramType: "prop", type: typeFactory.text() }), children);
    const slot = mkSlot(children, []);
    ensureKnownTplTag(definition.tplTree).children.push(slot);
    slot.parent = definition.tplTree;

    site.components.push(definition);
    const { studioCtx, call, createPage } = fixture(site);
    studioCtx.tplMgr().ensureBaseVariantSetting(slot);
    vi.spyOn(studioCtx, "getCodeComponentMeta").mockImplementation((component) => component === definition ? meta : undefined);
    const page = await createPage();
    const before = await call("read", { componentUuids: [page.uuid], view: "full" });
    await expect(call("insertHtml", { componentUuid: page.uuid, html: '<plasmic-component data-plasmic-component="InputField"><slot name="placeholder">搜索客群</slot></plasmic-component>' })).rejects.toThrow(/prop "placeholder" is not a Slot; pass it in data-props/);
    expect(await call("read", { componentUuids: [page.uuid], view: "full" })).toEqual(before);
    await call("insertHtml", { componentUuid: page.uuid, html: '<plasmic-component data-plasmic-component="InputField" data-props=\'{"placeholder":"搜索客群"}\'><slot name="children"><span style="color:red">内容</span></slot></plasmic-component>' });
    const model = (await call("read", { componentUuids: [page.uuid], view: "full" })).results[0];
    expect(model.baseVariantTplTree).toContain("搜索客群");
    expect(model.baseVariantTplTree).toContain("color: red");
    expect((await call("validate")).valid).toBe(true);
  });
  it("discovers UUIDs and differing prop/Slot types together, then composes from those contracts", async () => {
    const site = createSite();
    const inputMeta = { name: "InputField", importPath: "./input", props: { placeholder: "string" } } as const;
    const selectMeta = { name: "SelectField", importPath: "./select", props: { placeholder: "slot" } } as const;
    const input = mkCodeComponent(inputMeta.name, inputMeta, {});
    input.params.push(mkParam({ name: "placeholder", paramType: "prop", type: typeFactory.text() }));
    const select = mkCodeComponent(selectMeta.name, selectMeta, {});
    const placeholder = mkParam({ name: "placeholder", paramType: "slot", type: typeFactory.renderable() });
    select.params.push(placeholder);
    const placeholderSlot = mkSlot(placeholder, []);
    ensureKnownTplTag(select.tplTree).children.push(placeholderSlot);
    placeholderSlot.parent = select.tplTree;
    site.components.push(input, select);
    const { studioCtx, call, createPage } = fixture(site);
    studioCtx.tplMgr().ensureBaseVariantSetting(placeholderSlot);
    vi.spyOn(studioCtx, "getCodeComponentMeta").mockImplementation((component) =>
      component === input ? inputMeta : component === select ? selectMeta : undefined);
    const discovery = await call("read", { collection: "components", nameContains: "Field", view: "contract", fields: ["uuid", "name", "props"] });
    const contracts = discovery.results[0].components;
    expect(contracts).toHaveLength(2);
    expect(contracts[0]).toMatchObject({ uuid: input.uuid, name: inputMeta.name, props: [{ name: "placeholder", type: "text" }] });
    expect(contracts[1]).toMatchObject({ uuid: select.uuid, name: selectMeta.name, props: [{ name: "placeholder", type: "slot" }] });
    const targeted = await call("read", { componentUuids: contracts.map((contract: { uuid: string }) => contract.uuid), view: "contract" });
    expect(targeted.results.map((contract: { uuid: string }) => contract.uuid)).toEqual([input.uuid, select.uuid]);
    const page = await createPage();
    await call("insertHtml", {
      componentUuid: page.uuid,
      html: contracts.map((contract: { name: string; props: { name: string; type: string }[] }) => {
        const field = ensure(contract.props.find((prop) => prop.name === "placeholder"), "Placeholder contract");
        return field.type === "slot"
          ? `<plasmic-component data-plasmic-component="${contract.name}"><slot name="placeholder"><span>Select a market</span></slot></plasmic-component>`
          : `<plasmic-component data-plasmic-component="${contract.name}" data-props='{"placeholder":"Search name"}'></plasmic-component>`;
      }).join(""),
    });
    const markup = (await call("read", { componentUuids: [page.uuid], view: "full" })).results[0].baseVariantTplTree;
    expect(markup).toContain("Search name");
    expect(markup).toContain("Select a market");
    expect(markup).toContain('<slot name="placeholder">');
    expect((await call("validate")).valid).toBe(true);
  });
  it("an explicit empty trigger Slot suppresses the registered default opener without resetting it", async () => {
    const site = createSite();
    const meta = { name: "ControlledDialog", importPath: "./dialog", props: { trigger: { type: "slot" as const } } };
    const definition = mkCodeComponent(meta.name, meta, {});
    const trigger = mkParam({ name: "trigger", paramType: "slot", type: typeFactory.renderable() });
    definition.params.push(trigger);
    const triggerSlot = mkSlot(trigger, []);
    ensureKnownTplTag(definition.tplTree).children.push(triggerSlot);
    triggerSlot.parent = definition.tplTree;
    ensure(definition.codeComponentMeta, "Code contract").defaultSlotContents.trigger = { type: "text", value: "Show modal" };
    site.components.push(definition);
    trackComponentSite(definition, site);
    const { studioCtx, call, createPage } = fixture(site);
    studioCtx.tplMgr().ensureBaseVariantSetting(triggerSlot);
    vi.spyOn(studioCtx, "getCodeComponentMeta").mockImplementation((component) => component === definition ? meta : undefined);
    const page = await createPage("ControlledOverlay");
    await call("insertHtml", { componentUuid: page.uuid, html: '<plasmic-component data-plasmic-component="ControlledDialog" data-plasmic-name="DefaultDialog"></plasmic-component><plasmic-component data-plasmic-component="ControlledDialog" data-plasmic-name="ExternalDialog"><slot name="trigger"></slot></plasmic-component>' });
    const instances = flattenTpls(page.tplTree).filter(isKnownTplComponent);
    expect(instances).toHaveLength(2);
    const args = instances.map((instance) => ensure(getTplComponentArg(instance, instance.vsettings[0], trigger.variable), "Explicit trigger").expr);
    expect(args[0]).toMatchObject({ tpl: [expect.anything()] });
    expect(args[1]).toMatchObject({ tpl: [] });
    const model = (await call("read", { componentUuids: [page.uuid], view: "full" })).results[0];
    expect(model.baseVariantTplTree.match(/Show modal/g)).toHaveLength(1);
    const validation = await call("validate");
    expect(validation.valid, JSON.stringify(validation)).toBe(true);
    studioCtx.copilotActivity.dispose();
  });
  it("new code-component instances use current registered defaults while old library definitions and explicit props stay intact", async () => {
    const site = createSite();
    const stored = [{ value: "old", label: "Old" }], current = [{ key: "create", label: "Create" }];
    const meta = runInNewContext('({name:"CurrentMenu",importPath:"./menu",props:{items:{type:"array",defaultValue:[{key:"create",label:"Create"}]}}})');
    const definition = mkCodeComponent(meta.name, meta, {});
    const items = mkParam({ name: "items", paramType: "prop", type: typeFactory.any(), defaultExpr: codeLit(stored) });
    definition.params.push(items);
    site.components.push(definition);
    const { studioCtx, call, createPage } = fixture(site);
    vi.spyOn(studioCtx, "getCodeComponentMeta").mockImplementation((component) => component === definition ? meta : undefined);
    const page = await createPage("CurrentDefaults");
    await call("insertHtml", { componentUuid: page.uuid, html: '<plasmic-component data-plasmic-component="CurrentMenu" data-plasmic-name="DefaultMenu"></plasmic-component><plasmic-component data-plasmic-component="CurrentMenu" data-plasmic-name="ExplicitMenu" data-props=\'{"items":[{"key":"explicit","label":"Explicit"}]}\'></plasmic-component>' });
    const instances = flattenTpls(page.tplTree).filter(isKnownTplComponent);
    const values = instances.map((instance) => tryExtractJson(ensure(getTplComponentArg(instance, instance.vsettings[0], items.variable), "Inserted items").expr));
    expect(values).toEqual([current, [{ key: "explicit", label: "Explicit" }]]);
    expect(tryExtractJson(ensure(items.defaultExpr, "Stored default"))).toEqual(stored);
    const contract = (await call("read", { componentUuids: [definition.uuid], view: "contract" })).results[0].props[0];
    expect(contract.default).toEqual(stored);
    expect(contract.registration.defaultValue).toEqual(current);
    expect((await call("validate")).valid).toBe(true);
    studioCtx.copilotActivity.dispose();
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
  it("atomically aligns installed transitive dependencies while preserving unrelated libraries and graph validation", async () => {
    const dep = (name: string, version: string, dependencies: ProjectDependency[] = []) => {
      const site = createSite();
      site.projectDependencies.push(...dependencies);
      return new ProjectDependency({
        name, version, pkgId: `pkg-${name}`, projectId: `library-${name}`,
        uuid: `${name}-${version}`, site,
      });
    };
    const oldShell = dep("shell", "1.4.0");
    const oldTemplates = dep("templates", "0.0.1", [oldShell]);
    const unrelated = dep("unrelated", "2.0.0");
    const newShell = dep("shell", "1.7.0");
    const newIntermediate = dep("intermediate", "1.0.0", [newShell]);
    const published = dep("templates", "1.0.0", [newIntermediate]);
    const site = createSite();
    site.projectDependencies.push(oldTemplates, oldShell, unrelated);
    const { studioCtx, call } = fixture(site);
    const manager = studioCtx.projectDependencyManager;
    // The old single-library operation fails before touching the model.
    expect(() => manager.ensureCanUpgradeDeps([published])).toThrow("conflicting dependencies");
    const originalFetch = studioCtx.appCtx.api.getPkgVersion;
    const fetch = vi.fn().mockResolvedValue({ pkg: {}, depPkgs: [] });
    studioCtx.appCtx.api.getPkgVersion = fetch;
    const unbundle = vi.spyOn(taggedUnbundle, "unbundleProjectDependency")
      .mockReturnValue({ projectDependency: published } as any);
    const upgrade = vi.spyOn(manager, "upgradeProjectDeps")
      .mockImplementation(async (targets) => manager.ensureCanUpgradeDeps(targets));
    try {
      expect((await call("upgradeLibrary", { projectId: oldTemplates.projectId })).upgraded).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith(oldTemplates.pkgId);
      expect(upgrade).toHaveBeenCalledTimes(1);
      expect(upgrade).toHaveBeenCalledWith([published, newShell]);
      // An unrelated parent pinning the old shell must still block the upgrade.
      runInAction(() => unrelated.site.projectDependencies.push(oldShell));
      await expect(call("upgradeLibrary", { projectId: oldTemplates.projectId }))
        .rejects.toThrow("conflicting dependencies");
      expect(site.projectDependencies).toEqual([oldTemplates, oldShell, unrelated]);
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
    await call("insertHtml", {
      componentUuid: page.uuid,
      html: '<p style="display:block;width:416px;font-size:14px;line-height:22.4px">Captured paragraph</p>',
    });
    expect((await call("read", { componentUuids: [page.uuid], view: "full" })).results[0].baseVariantTplTree).toContain(
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
    await call("insertHtml", {
      componentUuid: page.uuid,
      html: xml,
    });
    expect((await call("read", { componentUuids: [page.uuid], view: "full" })).results[0].baseVariantTplTree).toContain("svg");
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
    studioCtx.copilotActivity.dispose();
    const beginActivity = vi.spyOn(studioCtx.copilotActivity, "begin");
    const resource = await call("readVector", {
      componentUuid: page.uuid,
      elementUuid: tpl.uuid,
    });
    const asset = ensure(
      studioCtx.site.imageAssets.find((a) => a.uuid === resource.assetUuid),
      "Asset missing",
    );
    asset.dataUri = "https://plasmic-studio.shiguanglab.com/assets/fixture.svg";
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
      expect(beginActivity).not.toHaveBeenCalled();
      expect(studioCtx.copilotActivity.requests).toHaveLength(0);
    } finally {
      fetcher.mockRestore();
      beginActivity.mockRestore();
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
    const resource = (await call("read", { view: "full", componentUuids: [page.uuid] }))
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
    const resource = (await call("read", { view: "full", componentUuids: [page.uuid] }))
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
    ).created[0];
    await call("insertHtml", {
      componentUuid: created.uuid,
      html: '<div><slot-target name="children"><span>Default label</span></slot-target></div>',
    });
    const resource = (await call("read", { view: "full", componentUuids: [created.uuid] }))
      .results[0];
    expect(resource.props).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "children", type: "slot" }),
      ]),
    );
    expect(studioCtx.site.components).toHaveLength(1);
  });

  it("reads the registered value-function signature before accepting a native function binding", async () => {
    const site = createSite();
    // Studio's internal function control is registered this way by Pagination.showTotal.
    const meta = { name: "SummaryWidget", importPath: "./summary-widget", props: { summary: { type: "function", argNames: ["total", "range"], argValues: [12, [1, 10]] } as any } };
    const definition = mkCodeComponent("SummaryWidget", meta, {});
    definition.params.push(mkParam({ name: "summary", paramType: "prop", type: typeFactory.any() }));
    site.components.push(definition);
    const { studioCtx, call, createPage } = fixture(site);
    vi.spyOn(studioCtx, "getCodeComponentMeta").mockImplementation((component) => component === definition ? meta : undefined);
    const contract = (await call("read", { componentUuids: [definition.uuid], view: "contract" })).results[0];
    expect(contract.props[0].registration).toMatchObject({ type: "function", args: [{ name: "total" }, { name: "range" }] });
    const page = await createPage();
    await call("insertHtml", { componentUuid: page.uuid, html: '<plasmic-component data-plasmic-component="SummaryWidget" data-props=\'{"summary":"{{ (total, range) => `共 ${total} 条` }}"}\'></plasmic-component>' });
    const read = (await call("read", { componentUuids: [page.uuid], view: "full" })).results[0];
    expect(read.baseVariantTplTree).toContain("(total, range)");
    expect((await call("validate")).valid).toBe(true);
  });

  it("uses declared custom rule metadata for both HTML insertion and subsequent native edits", async () => {
    const site = createSite();
    const rules = { type: "formValidationRules", itemType: { type: "object", fields: {
      ruleType: { type: "choice", options: ["required"], required: true },
    } } };
    const meta = { name: "ValidatedField", importPath: "./field", props: { rules: rules as any } };
    const definition = mkCodeComponent(meta.name, meta, {});
    definition.params.push(mkParam({ name: "rules", paramType: "prop", type: typeFactory.any() }));
    site.components.push(definition);
    const { studioCtx, call, createPage } = fixture(site);
    vi.spyOn(studioCtx, "getCodeComponentMeta").mockImplementation((component) => component === definition ? meta : undefined);
    vi.spyOn(studioCtx.codeComponentsRegistry, "getRegisteredCodeComponentsMap").mockReturnValue(new Map([[meta.name, { impl: () => null, meta }]]));
    const page = await createPage();
    const before = await call("read", { componentUuids: [page.uuid], view: "full" });
    await expect(call("insertHtml", { componentUuid: page.uuid,
      html: '<plasmic-component data-plasmic-component="ValidatedField" data-props=\'{"rules":[{"required":true}]}\'></plasmic-component>',
    })).rejects.toThrow("rules[0].ruleType is required");
    expect(await call("read", { componentUuids: [page.uuid], view: "full" })).toEqual(before);
    await call("insertHtml", { componentUuid: page.uuid,
      html: '<plasmic-component data-plasmic-name="NameField" data-plasmic-component="ValidatedField" data-props=\'{"rules":[{"ruleType":"required"}]}\'></plasmic-component>',
    });
    const field = ensure(flattenTpls(page.tplTree).find((tpl) => isKnownTplComponent(tpl) && tpl.component === definition), "Field missing");
    const saved = await call("read", { componentUuids: [page.uuid], view: "full" });
    await expect(call("changeElement", { componentUuid: page.uuid, elementUuid: field.uuid,
      props: { rules: [{ required: true }] },
    })).rejects.toThrow("rules[0].ruleType is required");
    expect(await call("read", { componentUuids: [page.uuid], view: "full" })).toEqual(saved);
    studioCtx.copilotActivity.dispose();
  });

  it("awaits hostless contracts and uses the same array metadata for reads, insertion and edits", async () => {
    const site = createSite();
    const tagOptions = { type: "array", itemType: { type: "object", fields: { value: "string", label: "string", color: "color" } } };
    const meta = { name: "HostlessColumn", importPath: "./column", props: { tagOptions: tagOptions as any } };
    const definition = mkCodeComponent(meta.name, meta, {});
    definition.params.push(mkParam({ name: "tagOptions", paramType: "prop", type: typeFactory.any() }));
    site.components.push(definition);
    const { studioCtx, call, createPage } = fixture(site);
    const hostlessWindow = (studioCtx as any).hostLessPkgsFrame.contentWindow;
    const hostlessRegistry = (studioCtx as any).hostLessRegistry;
    const loadRegistrations = () => {
      hostlessWindow.__PlasmicComponentRegistry = [];
      hostlessRegistry.clear();
      (studioCtx as any).hostLessPkgsLock = Promise.resolve().then(() => {
        hostlessWindow.__PlasmicComponentRegistry = [{ component: () => null, meta }];
        hostlessRegistry.clear();
      });
    };
    loadRegistrations();
    // Hostless registrations are absent from the app host's registry.
    vi.spyOn(studioCtx.codeComponentsRegistry, "getRegisteredCodeComponentsMap").mockReturnValue(new Map());
    const contract = (await call("read", { componentUuids: [definition.uuid], view: "contract" })).results[0];
    expect(contract.props[0].registration).toMatchObject({ type: "array", itemType: { type: "object", fields: { value: { type: "string" } } } });
    const page = await createPage();
    const before = await call("read", { componentUuids: [page.uuid], view: "full" });
    const bad = { 常规: { label: "常规", color: "geekblue" } };
    loadRegistrations();
    await expect(call("insertHtml", { componentUuid: page.uuid, html: `<plasmic-component data-plasmic-component="HostlessColumn" data-props='${JSON.stringify({ tagOptions: bad })}'></plasmic-component>` })).rejects.toThrow("tagOptions expects an array");
    expect(await call("read", { componentUuids: [page.uuid], view: "full" })).toEqual(before);
    const good = [{ value: "常规", label: "常规", color: "geekblue" }];
    await call("insertHtml", { componentUuid: page.uuid, html: `<plasmic-component data-plasmic-component="HostlessColumn" data-props='${JSON.stringify({ tagOptions: good })}'></plasmic-component>` });
    const column = ensure(flattenTpls(page.tplTree).find((tpl) => isKnownTplComponent(tpl) && tpl.component === definition), "Column missing");
    const saved = await call("read", { componentUuids: [page.uuid], view: "full" });
    await expect(call("changeElement", { componentUuid: page.uuid, elementUuid: column.uuid, props: { tagOptions: bad } })).rejects.toThrow("tagOptions expects an array");
    expect(await call("read", { componentUuids: [page.uuid], view: "full" })).toEqual(saved);
    studioCtx.copilotActivity.dispose();
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
    const before = (await call("read", { view: "full", componentUuids: [page.uuid] }))
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
    const after = (await call("read", { view: "full", componentUuids: [page.uuid] }))
      .results[0].baseVariantTplTree;
    expect(after).toBe(
      before
        .replace('label="detailSummary"', 'label="DetailSummary"')
        .replace('label="backToList"', 'label="BackToList"'),
    );
    await call("undo");
    expect(
      (await call("read", { view: "full", componentUuids: [page.uuid] })).results[0]
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

  it.each([
    { tool: "insertHtml", fit: "cover", registeredDefault: false },
    { tool: "insertHtml", fit: "contain", registeredDefault: true },
    { tool: "executeBatch", fit: "cover", registeredDefault: false },
    { tool: "executeBatch", fit: "contain", registeredDefault: true },
  ] as const)(
    "preserves code component $fit styles through read and $tool",
    async ({ tool, fit, registeredDefault }) => {
      const site = createSite();
      const media = mkCodeComponent(
        "RegisteredMedia",
        {
          name: "RegisteredMedia",
          importPath: "./registered-media",
          props: {},
          ...(registeredDefault ? { defaultStyles: { objectFit: fit } } : {}),
        },
        {},
      );
      site.components.push(media);
      const { call, createPage } = fixture(site);
      const page = await createPage();
      await call("insertHtml", {
        componentUuid: page.uuid,
        html: '<plasmic-component data-plasmic-component="RegisteredMedia"></plasmic-component>',
      });
      const original = ensure(
        flattenTpls(page.tplTree).find(isKnownTplComponent),
        "Media instance not found",
      );
      const updated = await call("changeElement", {
        componentUuid: page.uuid,
        elementUuid: original.uuid,
        styles: { "object-position": "25% 75%" },
      });
      expect(updated.messages ?? []).toEqual([]);
      const read = await call("read", { view: "full",
        elements: [{ componentUuid: page.uuid, elementUuid: original.uuid }],
      });
      const html = read.results[0].baseVariantTplTree;
      expect(html).toContain(`object-fit: ${fit}`);
      expect(html).toContain("object-position: 25% 75%");
      const input = { componentUuid: page.uuid, html };
      const result = await call(
        tool,
        tool === "executeBatch"
          ? { operations: [{ name: "insertHtml", input }] }
          : input,
      );
      const messages =
        tool === "executeBatch" ? result.operations[0].messages : result.messages;
      expect(messages ?? []).toEqual([]);
      const instances = flattenTpls(page.tplTree).filter(isKnownTplComponent);
      expect(instances).toHaveLength(2);
      for (const instance of instances) {
        expect(instance.component).toBe(media);
        const styles = RSH(ensureBaseVariantSetting(instance).rs, instance);
        expect(styles.getRaw("object-fit")).toBe(fit);
        expect(styles.getRaw("object-position")).toBe("25% 75%");
      }
      const reread = await call("read", { view: "full",
        elements: [{ componentUuid: page.uuid, elementUuid: instances[1].uuid }],
      });
      expect(reread.results[0].baseVariantTplTree).toContain(
        "object-position: 25% 75%",
      );
    },
  );

  it.each(["insertHtml", "executeBatch"])(
    "cleans safe style and prop errors without blocking %s",
    async (tool) => {
      const site = createSite();
      const widget = mkCodeComponent(
        "Widget",
        {
          name: "Widget",
          importPath: "./widget",
          props: {},
        },
        {},
      );
      widget.params.push(
        mkParam({ name: "label", paramType: "prop", type: typeFactory.text() }),
        mkParam({
          name: "disabled",
          paramType: "prop",
          type: typeFactory.bool(),
        }),
        mkParam({
          name: "tone",
          paramType: "prop",
          type: typeFactory.choice(["primary", "default"]),
        }),
      );
      site.components.push(widget);
      const { call, createPage } = fixture(site);
      const page = await createPage();
      const input = {
        componentUuid: page.uuid,
        html: '<style>.widget { reason: ignored; }</style><plasmic-component class="widget" data-plasmic-component="Widget" data-props=\'{"label":"Kept","disabled":"yes","tone":"invalid","extra":42}\' style="width:240px;list-style-type:disc"></plasmic-component>',
      };
      const result = await call(
        tool,
        tool === "executeBatch"
          ? { operations: [{ name: "insertHtml", input }] }
          : input,
      );
      const messages: string[] =
        tool === "executeBatch" ? result.operations[0].messages : result.messages;
      expect(messages).toHaveLength(5);
      expect(messages.join(" ")).toContain('Invalid prop "disabled"');
      expect(messages.join(" ")).toContain('Invalid prop "tone"');
      expect(messages.join(" ")).toContain('Invalid prop "extra"');
      expect(messages.join(" ")).toContain("list-style-type");
      expect(messages.join(" ")).toContain("Unsupported CSS property");
      const instance = ensure(
        flattenTpls(page.tplTree).find(isKnownTplComponent),
        "Widget missing",
      );
      const vs = ensureBaseVariantSetting(instance);
      expect(vs.args.map((arg) => arg.param.variable.name)).toEqual(["label"]);
      expect(tryExtractJson(vs.args[0].expr)).toBe("Kept");
      const styles = RSH(vs.rs, instance);
      expect(styles.getRaw("width")).toBe("240px");
      expect(styles.has("list-style-type")).toBe(false);
      expect(styles.has("reason")).toBe(false);
      expect(vs.attrs.style).toBeUndefined();
      const changed = await call("changeElement", {
        componentUuid: page.uuid,
        elementUuid: instance.uuid,
        props: { label: "Updated", disabled: "invalid", unknown: 123 },
      });
      expect(changed.messages).toHaveLength(2);
      expect(tryExtractJson(vs.args[0].expr)).toBe("Updated");
      expect(vs.args).toHaveLength(1);
      expect((await call("validate")).valid).toBe(true);
    },
  );

  it.each(["ProjectEnvironment", "SharedNotifications"])(
    "rejects global context %s in HTML without partial insertion or blocking editing",
    async (name) => {
      const site = createSite();
      const meta = { name, importPath: "./context", props: {}, __isContext: true };
      const context = mkCodeComponent(name, meta, {});
      site.components.push(context);
      const { studioCtx, call, createPage } = fixture(site);
      const page = await createPage("ContextSafety");
      const before = await call("read", { view: "full", componentUuids: [page.uuid] });
      const contextHtml = `<plasmic-component data-plasmic-component="${name}" />`;

      for (const html of [contextHtml, `<section>Valid sibling${contextHtml}</section>`]) {
        await expect(call("insertHtml", { componentUuid: page.uuid, html })).rejects.toThrow(
          `Component "${name}" is a global context and cannot be inserted into a component tree`,
        );
        expect(await call("read", { view: "full", componentUuids: [page.uuid] })).toEqual(before);
        expect(await call("getEditorContext")).toMatchObject({ canEdit: true });
        expect(studioCtx.blockChanges).toBe(false);
        expect(studioCtx.isAtTip).toBe(true);
      }

      await expect(call("executeBatch", { operations: [
        { name: "changeElement", input: { componentUuid: page.uuid, elementUuid: page.tplTree.uuid, name: "TransientRename" } },
        { name: "insertHtml", input: { componentUuid: page.uuid, html: contextHtml } },
      ] })).rejects.toThrow("is a global context");
      expect(await call("read", { view: "full", componentUuids: [page.uuid] })).toEqual(before);
      expect(await call("getEditorContext")).toMatchObject({ canEdit: true });
      studioCtx.copilotActivity.dispose();
    },
  );

  it.each([
    '<plasmic-component data-plasmic-component="DoesNotExist" />',
    '<div>Valid content</div><plasmic-component data-plasmic-component="DoesNotExist" />',
  ])(
    "rejects unknown HTML components without inserting a partial tree: %s",
    async (html) => {
      const { call, createPage } = fixture();
      const page = await createPage();
      const before = (await call("read", { view: "full", componentUuids: [page.uuid] }))
        .results[0].baseVariantTplTree;
      await expect(
        call("insertHtml", {
          componentUuid: page.uuid,
          html,
        }),
      ).rejects.toThrow("correct the component reference, and retry");
      expect(
        (await call("read", { view: "full", componentUuids: [page.uuid] })).results[0]
          .baseVariantTplTree,
      ).toBe(before);
    },
  );

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

  it("rolls back the whole props transaction after a required prop fails, then accepts valid edits", async () => {
    const { studioCtx, call, createPage } = fixture();
    const page = await createPage();
    const result = await call("createComponent", {
      name: "ReusableButton",
      type: "component",
    });
    const button = ensure(
      studioCtx.site.components.find((c) => c.uuid === result.created[0].uuid),
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
          required: true,
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
    const result = (await call("read", { view: "full", componentUuids: [page.uuid] }))
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
      (await call("read", { view: "full", componentUuids: [page.uuid] })).results[0]
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
    ).created[0];
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
    ).created[0];
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
    ).rejects.toThrow("not found in this project");
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
    const queried = await call("queryElements", { view: "full", depth: "all",
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

it("discovers text, number and expression data tokens through project read without changing their identities", async () => {
  const site = createSite();
  const tokens = [
    ["TextValue", '"中文"', "string", "中文"],
    ["NumberValue", "26", "number", "26"],
    ["ExpressionValue", "(13 * 2)", "code", "13 * 2"],
  ] as const;
  site.dataTokens.push(...tokens.map(([name, value]) => new DataToken({ name, value, type: "Data", uuid: name, variantedValues: [], isRegistered: false, regKey: undefined })));
  const { call, studioCtx } = fixture(site);
  const before = studioCtx._changeCounter;
  const resource = (await call("read", { view: "full" })).results[0];
  expect(resource.dataTokens).toEqual(tokens.map(([name, _value, type, value]) => expect.objectContaining({ name, uuid: name, type, value, reference: expect.stringContaining(name.charAt(0).toLowerCase() + name.slice(1)) })));
  expect(studioCtx._changeCounter).toBe(before);
  studioCtx.copilotActivity.dispose();
});

it("marks inherited slot nodes as readonly and locates their real source contract", async () => {
  const { studioCtx, call, createPage } = fixture();
  const source = (await call("createComponent", { name: "AuditReusable", type: "component" })).created[0];
  await call("insertHtml", { componentUuid: source.uuid, html: '<div><slot-target name="children"><span>Inherited label</span></slot-target></div>' });
  const page = await createPage("AuditConsumer");
  await call("insertHtml", { componentUuid: page.uuid, html: '<plasmic-component data-plasmic-component="AuditReusable"></plasmic-component>' });
  const instance = ensure(flattenTpls(page.tplTree).find(isKnownTplComponent), "instance");
  await call("changeElement", { componentUuid: page.uuid, elementUuid: instance.uuid, resetProps: ["children"] });
  const slotParam = ensure(instance.component.params.find(isSlot), "source slot param");
  runInAction(() => fillVirtualSlotContents(studioCtx.tplMgr(), instance, [slotParam.tplSlot]));
  const model = (await call("read", { view: "full", componentUuids: [page.uuid] })).results[0];
  expect(model.baseVariantTplTree).toContain('data-editable="false"');
  expect(model.baseVariantTplTree).toContain('data-source-component="' + source.uuid + '"');
  expect(model.baseVariantTplTree).toContain('data-source-slot="children"');
  const structure = (await call("read", { elements: [{ componentUuid: page.uuid, elementUuid: instance.uuid }], depth: "all" })).results[0];
  expect(structure.slots[0].name).toBe("children");
  expect(structure.slots[0].children[0]).toMatchObject({ editable: false, source: { componentUuid: source.uuid, slotName: "children" } });
  expect(JSON.stringify(structure)).not.toContain("Inherited label");
  const sourceModel = (await call("read", { view: "full", componentUuids: [source.uuid] })).results[0];
  expect(sourceModel.baseVariantTplTree).not.toContain('data-editable="false"');
  const sourceComponent = ensure(studioCtx.site.components.find(c => c.uuid === source.uuid), "source");
  const span = ensure(flattenTpls(sourceComponent.tplTree).find(t => isKnownTplTag(t) && t.tag === "span"), "default span");
  await call("changeElement", { componentUuid: source.uuid, elementUuid: span.uuid, text: "Source edited" });
  expect((await call("read", { view: "full", componentUuids: [source.uuid] })).results[0].baseVariantTplTree).toContain("Source edited");
  studioCtx.copilotActivity.dispose();
});

it("diagnoses elements defined in another component and confirms deleteCanvas with messages", async () => {
  const { studioCtx, call, createPage } = fixture();
  const child = (await call("createComponent", { name: "ChildComp", type: "component" })).created[0];
  await call("insertHtml", { componentUuid: child.uuid, html: '<button id="btn">Click me</button>' });
  const childComp = ensure(studioCtx.site.components.find((c) => c.uuid === child.uuid), "child");
  const btn = ensure(flattenTpls(childComp.tplTree).find((t) => isKnownTplTag(t) && t.tag === "button"), "button");

  const page = await createPage("HostPage");
  // Mutation targeting child's element using page's componentUuid provides an informative hint
  await expect(
    call("changeElement", { componentUuid: page.uuid, elementUuid: btn.uuid, text: "New" }),
  ).rejects.toThrow(`defined in component "ChildComp" (${child.uuid}). Pass componentUuid: "${child.uuid}"`);

  // deleteCanvas returns explicit deletion message
  await call("createCanvas", { name: "TestCanvas" });
  const deleteResult = await call("deleteCanvas", { canvasName: "TestCanvas" });
  expect(deleteResult.created).toEqual([]);
  expect(deleteResult.messages).toContain('Canvas "TestCanvas" deleted.');

  // Preview rejects non-page components with clear guidance
  await expect(
    call("preview", { action: "open", componentUuid: child.uuid }),
  ).rejects.toThrow(`Preview target must be a local Page; "ChildComp" is a component. To inspect component rendering, navigate to its canvas artboard and use get_screenshot.`);

  studioCtx.copilotActivity.dispose();
});
