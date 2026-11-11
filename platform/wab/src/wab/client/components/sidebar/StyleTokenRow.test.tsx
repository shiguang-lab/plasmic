import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { StyleTokenControlsContext } from "@/wab/client/components/sidebar/LeftGeneralTokensPanel";
import MultiAssetsActions from "@/wab/client/components/sidebar/MultiAssetsActions";
import StyleTokenRow from "@/wab/client/components/sidebar/StyleTokenRow";
import { Matcher } from "@/wab/client/components/view-common";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { mkStyleToken, mkTokenRef } from "@/wab/commons/StyleToken";
import { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import type { GetProjectResponse } from "@/wab/shared/ApiSchema";
import { OverrideableToken } from "@/wab/shared/core/tokens";
import { StyleTokenOverride } from "@/wab/shared/model/classes";
import type { UiConfig } from "@/wab/shared/ui-config-utils";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { notification } from "antd";
import React from "react";
import { mock } from "vitest-mock-extended";

const renders = vi.hoisted(() => vi.fn());
vi.mock("@/wab/client/components/sidebar/GeneralTokenControl", () => ({ default: ({ indicatorType, onClick, menu }: { indicatorType?: string; onClick?: () => void; menu: () => React.ReactNode }) => {
  renders();
  return <div><output>{indicatorType}</output><button disabled={!onClick} onClick={onClick}>Open token</button>{menu()}</div>;
} }));
afterEach(() => { cleanup(); renders.mockClear(); });
function response(studio: StudioCtx, uiConfig: UiConfig) {
  return Object.assign(mock<GetProjectResponse>(), { project: { ...studio.siteInfo, uiConfig }, perms: studio.siteInfo.perms, owner: undefined, latestRevisionSynced: 0, hasAppAuth: false, appAuthProvider: undefined, isMainBranchProtected: false });
}

it("refreshes same-value override indicators and native permissions while retaining the exact token command", async () => {
  const { studioCtx: studio, api } = fakeStudioCtx();
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  const model = mkStyleToken({ name: "Space", type: "Spacing", value: "12px" });
  await studio.changeUnsafe(() => { model.isRegistered = true; studio.site.styleTokens.push(model); });
  const token = new OverrideableToken(model, studio.site), helper = new VariantedStylesHelper(studio.site);
  const controls: NonNullable<React.ContextType<typeof StyleTokenControlsContext>> = {
    vsh: helper, resolver: (value, vsh) => (vsh ?? helper).getActiveTokenValue(value),
    onDuplicate: vi.fn().mockResolvedValue(undefined), onSelect: vi.fn(), onDeleteOverride: vi.fn(), onAdd: vi.fn().mockResolvedValue(undefined), expandedHeaders: new Set(), setExpandedHeaders: vi.fn(),
  };
  const view = render(<StudioCtxContext.Provider value={studio}><StyleTokenControlsContext.Provider value={controls}><MultiAssetsActions type="token" selectableAssets={[model.uuid]} onDelete={async () => false}><StyleTokenRow token={token} tokenValue={helper.getActiveTokenValue(token)} matcher={new Matcher("")} indentMultiplier={0} /></MultiAssetsActions></StyleTokenControlsContext.Provider></StudioCtxContext.Provider>);
  try {
    expect(screen.getByText("inherited")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open token" })).toHaveProperty("disabled", true);
    await act(async () => { await studio.changeUnsafe(() => { studio.site.styleTokenOverrides.push(new StyleTokenOverride({ token: model, value: "12px", variantedValues: [] })); }); });
    expect(screen.getByText("set")).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Remove override" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open token" }));
    expect(controls.onSelect).toHaveBeenLastCalledWith(token);
    const before = renders.mock.calls.length;
    api.getSiteInfo.mockResolvedValueOnce(response(studio, { ...studio.getCurrentUiConfig(), leftTabs: { ...studio.uiEnvironment.store.getState().leftTabPermissions, fonts: "readable" } }));
    await act(async () => { await studio.refreshSiteInfo(); });
    expect(renders).toHaveBeenCalledTimes(before);
    api.getSiteInfo.mockResolvedValueOnce(response(studio, { ...studio.getCurrentUiConfig(), canOverrideRegisteredTokens: false }));
    await act(async () => { await studio.refreshSiteInfo(); });
    expect(screen.getByRole("button", { name: "Open token" })).toHaveProperty("disabled", true);
    expect(screen.queryByRole("menuitem", { name: "Override value" })).toBeNull();
    expect(model.value).toBe("12px"); expect(token.base).toBe(model);
  } finally { view.unmount(); studio.dispose(); }
});

it("reports a token replacement cycle through the Studio command", async () => {
  const { studioCtx: studio } = fakeStudioCtx();
  const notify = vi.spyOn(notification, "error").mockImplementation(() => {});
  try {
    await waitFor(() => expect(studio.initialRouteReady).toBe(true));
    const source = mkStyleToken({ name: "Source", type: "Color", value: "#fff" });
    const alias = mkStyleToken({ name: "Alias", type: "Color", value: mkTokenRef(source) });
    await studio.changeUnsafe(() => {
      studio.site.styleTokens.push(source, alias);
    });

    await studio.siteOps().swapTokens(source, alias);

    expect(alias.value).toBe(mkTokenRef(source));
    expect(notify).toHaveBeenCalledOnce();
  } finally {
    notify.mockRestore();
    studio.dispose();
  }
});
