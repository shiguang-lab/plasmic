import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import DataTokenRow from "@/wab/client/components/sidebar/DataTokenRow";
import { DataTokenControlsContext } from "@/wab/client/components/sidebar/LeftGeneralDataTokensPanel";
import MultiAssetsActions from "@/wab/client/components/sidebar/MultiAssetsActions";
import { Matcher } from "@/wab/client/components/view-common";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { deepMerged } from "@/wab/commons/collections";
import { mkDataToken } from "@/wab/commons/DataToken";
import { toOpaque } from "@/wab/commons/types";
import type { GetProjectResponse } from "@/wab/shared/ApiSchema";
import { MutableToken, ImmutableToken } from "@/wab/shared/core/tokens";
import type { UiConfig } from "@/wab/shared/ui-config-utils";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";

const rowRender = vi.hoisted(() => vi.fn());
vi.mock("@/wab/client/plasmic/plasmic_kit_left_pane/PlasmicGeneralTokenControl", () => ({
  default: ({ children, value, rowItem }: React.PropsWithChildren<{ value: React.ReactNode; rowItem: { menu?: React.ReactNode | (() => React.ReactNode); icon?: React.ReactNode; onClick?: () => void } }>) => {
    rowRender();
    return <div><output>{children}</output><output>{value}</output><button disabled={!rowItem.onClick} onClick={rowItem.onClick}>Open token</button>{typeof rowItem.menu === "function" ? rowItem.menu() : rowItem.menu}{rowItem.icon}</div>;
  },
}));
afterEach(() => { cleanup(); rowRender.mockClear(); });
function response(studio: StudioCtx, uiConfig: UiConfig) {
  return Object.assign(mock<GetProjectResponse>(), { project: { ...studio.siteInfo, uiConfig }, perms: studio.siteInfo.perms, owner: undefined, latestRevisionSynced: 0, hasAppAuth: false, appAuthProvider: undefined, isMainBranchProtected: false });
}

it("updates actual data-token policy from metadata without rerendering on unrelated policy and preserves commands/context", async () => {
  const { studioCtx: studio, api } = fakeStudioCtx();
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  const model = mkDataToken({ name: "Content/Caption", value: '"Value"' });
  await studio.changeUnsafe(() => { studio.site.dataTokens.push(model); });
  const token = new MutableToken(model);
  const controls: NonNullable<React.ContextType<typeof DataTokenControlsContext>> = { onSelect: vi.fn(), onDuplicate: vi.fn().mockResolvedValue(undefined), onAdd: vi.fn().mockResolvedValue(undefined), expandedHeaders: new Set(), setExpandedHeaders: vi.fn() };
  const handler = vi.spyOn(studio.uiActionBus, "registerHandler");
  const contents = (currentToken = token) => <StudioCtxContext.Provider value={studio}><DataTokenControlsContext.Provider value={controls}><MultiAssetsActions type="token" selectableAssets={[model.uuid]} onDelete={async () => false}><DataTokenRow token={currentToken} tokenValue={toOpaque<string, "DataTokenValue">(currentToken.value)} matcher={new Matcher("")} indentMultiplier={0} /></MultiAssetsActions></DataTokenControlsContext.Provider></StudioCtxContext.Provider>;
  const view = render(contents());
  try {
    fireEvent.click(screen.getByRole("button", { name: "Open token" }));
    expect(controls.onSelect).toHaveBeenLastCalledWith(token);
    fireEvent.click(screen.getByRole("menuitem", { name: "Duplicate" }));
    expect(controls.onDuplicate).toHaveBeenLastCalledWith(model);
    const renders = rowRender.mock.calls.length;
    api.getSiteInfo.mockResolvedValueOnce(response(studio, deepMerged(studio.getCurrentUiConfig(), { leftTabs: { fonts: "readable" } })));
    await act(async () => { await studio.refreshSiteInfo(); });
    expect(rowRender).toHaveBeenCalledTimes(renders);
    api.getSiteInfo.mockResolvedValueOnce(response(studio, deepMerged(studio.getCurrentUiConfig(), { leftTabs: { dataTokens: "readable" } })));
    await act(async () => { await studio.refreshSiteInfo(); });
    expect(screen.queryByRole("menuitem", { name: "Duplicate" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Delete" })).toBeNull();
    expect(screen.getByRole("button", { name: "Open token" })).toHaveProperty("disabled", true);
    api.getSiteInfo.mockResolvedValueOnce(response(studio, deepMerged(studio.getCurrentUiConfig(), { leftTabs: { dataTokens: "writable" } })));
    await act(async () => { await studio.refreshSiteInfo(); });
    fireEvent.click(screen.getByRole("menuitem", { name: "Start bulk selection" }));
    expect(screen.getByRole("button", { name: "Open token" })).toHaveProperty("disabled", false);
    fireEvent.click(screen.getByRole("button", { name: "Open token" }));
    expect(controls.onSelect).toHaveBeenCalledOnce();
    const replacement = mkDataToken({ name: "Content/New caption", value: model.value, uuid: "new-data-token" });
    await act(async () => { await studio.changeUnsafe(() => { studio.site.dataTokens.splice(studio.site.dataTokens.indexOf(model), 1, replacement); }); });
    view.rerender(contents(new MutableToken(replacement)));
    expect(screen.getByText("New caption")).toBeTruthy();
    expect(handler).toHaveBeenLastCalledWith("Model:DataToken:new-data-token", expect.any(Function));
    expect(model.uuid).not.toBe("new-data-token");
    expect(model.name).toBe("Content/Caption");
  } finally { view.unmount(); studio.dispose(); }
});

it("keeps imported immutable tokens read-only while allowing reference commands", async () => {
  const { studioCtx: studio } = fakeStudioCtx();
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  const model = mkDataToken({ name: "Imported", value: "42" });
  await studio.changeUnsafe(() => { studio.site.dataTokens.push(model); });
  const token = new ImmutableToken(model, false);
  const controls: NonNullable<React.ContextType<typeof DataTokenControlsContext>> = { onSelect: vi.fn(), onDuplicate: vi.fn().mockResolvedValue(undefined), onAdd: vi.fn().mockResolvedValue(undefined), expandedHeaders: new Set(), setExpandedHeaders: vi.fn() };
  const view = render(<StudioCtxContext.Provider value={studio}><DataTokenControlsContext.Provider value={controls}><MultiAssetsActions type="token" selectableAssets={[]} onDelete={async () => false}><DataTokenRow token={token} tokenValue={toOpaque<string, "DataTokenValue">("42")} matcher={new Matcher("")} indentMultiplier={1} /></MultiAssetsActions></DataTokenControlsContext.Provider></StudioCtxContext.Provider>);
  try {
    expect(screen.getByRole("button", { name: "Open token" })).toHaveProperty("disabled", true);
    expect(screen.queryByRole("menuitem", { name: "Start bulk selection" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Duplicate" })).toBeNull();
    fireEvent.click(screen.getByRole("menuitem", { name: "Find all references" }));
    await waitFor(() => expect(studio.findReferencesDataToken).toBe(model));
  } finally { view.unmount(); studio.dispose(); }
});
