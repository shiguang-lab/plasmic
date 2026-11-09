import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { DataSourceOpValuePreview } from "@/wab/client/components/sidebar-tabs/DataSource/DataSourceOpPicker";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ComponentType } from "@/wab/shared/core/components";
import { codeLit } from "@/wab/shared/core/exprs";
import { createSite } from "@/wab/shared/core/sites";
import { mkDataSourceOpExpr } from "@/wab/shared/data-sources-meta/data-sources";
import { ComponentDataQuery, DataSourceTemplate, TemplatedString, ensureKnownCustomCode } from "@/wab/shared/model/classes";
import { act, render, waitFor } from "@testing-library/react";
import * as React from "react";

const sdk = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("@/wab/client/components/sidebar-tabs/useSourceOp", () => ({ useSourceOp: () => ({ opMeta: { type: "read" } }) }));
vi.mock("@plasmicapp/react-web/lib/data-sources", async (original) => ({ ...await original<typeof import("@plasmicapp/react-web/lib/data-sources")>(), usePlasmicDataOp: (op: unknown) => { sdk.query(op); return { data: undefined }; } }));
it("refreshes operation evaluation after nested binding edits and refuses old expressions in another Studio", async () => {
  const site = createSite(), component = new TplMgr({ site }).addComponent({ name: "Lookup", type: ComponentType.Plain });
  const binding = codeLit("first"), expr = mkDataSourceOpExpr({ sourceId: "source", opId: "operation", opName: "getList", templates: { resource: new DataSourceTemplate({ fieldType: "text", value: new TemplatedString({ text: [binding] }), bindings: null }) } });
  component.dataQueries.push(new ComponentDataQuery({ uuid: "operation-preview", name: "Lookup", op: expr }));
  const { studioCtx: studio } = fakeStudioCtx({ site }), { studioCtx: nextStudio } = fakeStudioCtx();
  await waitFor(() => { expect(studio.initialRouteReady).toBe(true); expect(nextStudio.initialRouteReady).toBe(true); });
  const exprCtx = { component, projectFlags: studio.projectFlags(), inStudio: true }, env = {};
  const contents = (owner = studio) => <StudioCtxContext.Provider value={owner}><DataSourceOpValuePreview expr={expr} exprCtx={exprCtx} env={env} /></StudioCtxContext.Provider>;
  const mounted = render(contents());
  try {
    expect(sdk.query.mock.lastCall?.[0]).toMatchObject({ sourceId: "source", userArgs: { resource: ["first"] } });
    await act(async () => { await studio.changeUnsafe(() => { ensureKnownCustomCode(binding).code = '"second"'; }); });
    expect(sdk.query.mock.lastCall?.[0]).toMatchObject({ sourceId: "source", userArgs: { resource: ["second"] } });
    const before = sdk.query.mock.calls.length, admitted = vi.spyOn(nextStudio.modelSnapshots, "declaredField");
    mounted.rerender(contents(nextStudio));
    expect(sdk.query.mock.calls.length).toBe(before); expect(admitted).not.toHaveBeenCalled();
  } finally { mounted.unmount(); studio.dispose(); nextStudio.dispose(); sdk.query.mockClear(); }
});

