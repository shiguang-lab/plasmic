import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { ServerQueryOpSummary } from "@/wab/client/components/sidebar-tabs/ServerQuery/QueryResultPreview";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { mkCustomFunction } from "@/wab/shared/__testonly__/site-tests-utils";
import { ComponentType } from "@/wab/shared/core/components";
import { ComponentServerQuery, CustomCode, CustomFunctionExpr } from "@/wab/shared/model/classes";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import React from "react";

afterEach(cleanup);

it("rebinds the actual query summary when its function reference changes", async () => {
  const { studioCtx: studio } = fakeStudioCtx();
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  const first = mkCustomFunction({ importName: "loadFirst", namespace: "api" });
  const second = mkCustomFunction({ importName: "loadSecond", namespace: "api" });
  const expr = new CustomFunctionExpr({ func: first, args: [] });
  await studio.changeUnsafe(() => {
    studio.site.customFunctions.push(first, second);
    const component = studio.tplMgr().addComponent({ name: "Queries", type: ComponentType.Plain });
    component.serverQueries.push(new ComponentServerQuery({ uuid: "query-summary", name: "Query summary", op: expr }));
  });
  const contents = (value: CustomCode | CustomFunctionExpr = expr) => <StudioCtxContext.Provider value={studio}><ServerQueryOpSummary expr={value} /></StudioCtxContext.Provider>;
  const view = render(contents());
  try {
    expect(screen.getByText("Api.load first")).toBeTruthy();
    await act(async () => { await studio.changeUnsafe(() => { expr.func = second; }); });
    expect(screen.getByText("Api.load second")).toBeTruthy();
    await act(async () => { await studio.changeUnsafe(() => { first.importName = "oldFunction"; second.namespace = "newApi"; second.importName = "currentFunction"; }); });
    expect(screen.getByText("New api.current function")).toBeTruthy();
    view.rerender(contents(new CustomCode({ code: "1", fallback: null })));
    expect(screen.getByText("Custom code")).toBeTruthy();
    view.rerender(contents());
    expect(screen.getByText("New api.current function")).toBeTruthy();
  } finally { view.unmount(); studio.dispose(); }
});
