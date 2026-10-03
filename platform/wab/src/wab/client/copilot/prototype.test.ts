import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { COPILOT_TOOLS } from "@/wab/client/copilot";
import { getTplComponentArg } from "@/wab/shared/TplMgr";
import { mapCopilotToolsToJsonSchema } from "@/wab/shared/copilot/copilot-tool-types";
import { PROTOTYPE_TOOL_META } from "@/wab/shared/copilot/prototype-tools";
import { ensure } from "@/wab/shared/common";
import { tryExtractJson } from "@/wab/shared/core/exprs";
import { mkParam } from "@/wab/shared/core/lang";
import { flattenTpls } from "@/wab/shared/core/tpls";
import { isKnownTplComponent } from "@/wab/shared/model/classes";
import { typeFactory } from "@/wab/shared/model/model-util";
import { ok } from "neverthrow";

function fixture() {
  const { studioCtx } = fakeStudioCtx();
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
    await expect(
      call("changeElement", {
        componentUuid: page.uuid,
        elementUuid: instance.uuid,
        props: { disabled: true, tone: "invalid" },
      }),
    ).rejects.toThrow("must be one of");
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

  it("does not claim a failed save succeeded", async () => {
    const { studioCtx, call, createPage } = fixture();
    await createPage();
    vi.spyOn(studioCtx, "save").mockResolvedValue("TimedOut");
    await expect(call("save")).rejects.toThrow("did not persist");
  });
});
