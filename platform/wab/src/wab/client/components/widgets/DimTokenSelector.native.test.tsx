import "@/wab/client/components/sidebar/MixinControls";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { SidebarModalProvider } from "@/wab/client/components/sidebar/SidebarModal";
import { DimTokenSpinner } from "@/wab/client/components/widgets/DimTokenSelector";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { mkStyleToken, mkTokenRef } from "@/wab/commons/StyleToken";
import { createSite } from "@/wab/shared/core/sites";
import type { PkgVersionInfoMeta } from "@/wab/shared/SharedApi";
import { mock } from "vitest-mock-extended";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";

const studios: StudioCtx[] = [];
beforeEach(() => vi.stubGlobal("IntersectionObserver", class { observe() { return undefined; } unobserve() { return undefined; } disconnect() { return undefined; } }));
afterEach(async () => { cleanup(); for (const studio of studios.splice(0)) { await studio.awaitEval(); studio.dispose(); } vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function fixture() {
  const site = createSite();
  const base = mkStyleToken({ name: "Base", type: "Spacing", value: "8px" });
  const alias = mkStyleToken({ name: "Alias", type: "Spacing", value: mkTokenRef(base) });
  const other = mkStyleToken({ name: "Other", type: "Spacing", value: "24px" });
  site.styleTokens.push(base, alias, other);
  const f = fakeStudioCtx({ site }), studio = f.studioCtx; studios.push(studio);
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  const wrap = (children: React.ReactNode) => <AppCtxContext.Provider value={f.appCtx}><StudioCtxContext.Provider value={studio}><SidebarModalProvider>{children}</SidebarModalProvider></StudioCtxContext.Provider></AppCtxContext.Provider>;
  return { studio, site, base, alias, other, wrap, api: f.api };
}

it("keeps closed selected aliases live, supports undo, and preserves selection and keyboard edits", async () => {
  const f = await fixture(), changed = vi.fn();
  function Controlled() {
    const [value, setValue] = React.useState(mkTokenRef(f.alias));
    return <DimTokenSpinner studioCtx={f.studio} tokenType="Spacing" allowFunctions={false} value={value} onChange={(next, kind) => { changed(next, kind); setValue(next ?? ""); }} allowedUnits={["px"]} />;
  }
  render(f.wrap(<Controlled />));
  expect(screen.getByText("Alias")).toBeTruthy();
  expect(screen.queryByRole("listbox")).toBeNull();
  const reads = vi.spyOn(f.studio.modelSnapshots, "declaredField");
  await act(async () => { await f.studio.changeUnsafe(() => { f.other.value = "25px"; }); });
  expect(reads).not.toHaveBeenCalled();
  await act(async () => { await f.studio.changeUnsafe(() => { f.base.value = "16px"; f.alias.name = "Renamed alias"; }); });
  expect(screen.getByText("Renamed alias")).toBeTruthy(); expect(changed).not.toHaveBeenCalled();
  await act(async () => { await f.studio.undo(); });
  expect(screen.getByText("Alias")).toBeTruthy();
  await act(async () => { await f.studio.redo(); });
  expect(screen.getByText("Renamed alias")).toBeTruthy();
  const input = screen.getByRole("textbox");
  fireEvent.click(input);
  await waitFor(() => expect(screen.getByRole("option", { name: "Base" }).textContent).toContain("16px"));
  fireEvent.change(input, { target: { value: "Other" } });
  fireEvent.click(await screen.findByRole("option", { name: "Other" }));
  expect(changed).toHaveBeenLastCalledWith(mkTokenRef(f.other), "selected");
  expect(screen.queryByRole("listbox")).toBeNull();
  fireEvent.change(input, { target: { value: "30" } });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(changed).toHaveBeenLastCalledWith("30px", "raw");
  fireEvent.keyDown(input, { key: "ArrowUp" });
  expect(changed).toHaveBeenLastCalledWith("31px", "spin");
  const count = changed.mock.calls.length;
  fireEvent.change(input, { target: { value: "99" } }); fireEvent.keyDown(input, { key: "Escape" }); fireEvent.blur(input);
  expect(changed).toHaveBeenCalledTimes(count);
  expect(f.alias.value).toBe(mkTokenRef(f.base)); expect(f.other.value).toBe("25px");
});

it("resets an open menu on model replacement and resumes commands on the new owner", async () => {
  const f = await fixture(), changed = vi.fn();
  render(f.wrap(<DimTokenSpinner studioCtx={f.studio} tokenType="Spacing" allowFunctions={false} value="12px" onChange={changed} allowedUnits={["px"]} />));
  fireEvent.click(screen.getByRole("textbox"));
  expect(await screen.findByRole("option", { name: "Other" })).toBeTruthy();
  const previousModels = f.studio.modelSnapshots;
  const release = mock<PkgVersionInfoMeta>({ id: "dimension-world", pkgId: "dimension-world-pkg", version: "1.0.0", branchId: null });
  f.api.getPkgVersion.mockResolvedValueOnce({ pkg: { ...release, model: f.studio.bundleSite().site }, depPkgs: [], etag: "dimension-world-etag" });
  await act(async () => { await f.studio["loadVersion"](release, true); });
  expect(f.studio.modelSnapshots).not.toBe(previousModels);
  expect(screen.queryByRole("listbox")).toBeNull();
  fireEvent.click(screen.getByRole("textbox"));
  fireEvent.click(await screen.findByRole("option", { name: "Other" }));
  expect(changed).toHaveBeenLastCalledWith(mkTokenRef(f.other), "selected");
});

it("updates open candidates and keeps the original create-token command", async () => {
  const f = await fixture(), changed = vi.fn();
  render(f.wrap(<DimTokenSpinner studioCtx={f.studio} tokenType="Spacing" allowFunctions={false} value="12px" onChange={changed} allowedUnits={["px"]} />));
  fireEvent.click(screen.getByRole("textbox"));
  const added = mkStyleToken({ name: "Added", type: "Spacing", value: "42px" });
  await act(async () => { await f.studio.changeUnsafe(() => { f.site.styleTokens.push(added); }); });
  expect(await screen.findByRole("option", { name: "Added" })).toBeTruthy();
  await act(async () => { await f.studio.changeUnsafe(() => { f.site.styleTokens.splice(f.site.styleTokens.indexOf(added), 1); }); });
  expect(screen.queryByRole("option", { name: "Added" })).toBeNull();
  fireEvent.click(screen.getByRole("option", { name: "Add new token" }));
  await waitFor(() => expect(f.site.styleTokens.length).toBe(4));
  const created = f.site.styleTokens[3];
  expect(created.value).toBe("12px");
  expect(changed).toHaveBeenLastCalledWith(mkTokenRef(created), "selected");
});
